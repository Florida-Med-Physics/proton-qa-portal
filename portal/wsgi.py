"""Shared portal WSGI application, served by Waitress behind an HTTPS proxy."""
import json
import logging
import mimetypes
import secrets
import threading
import time
from collections import defaultdict, deque
from http import HTTPStatus
from http.cookies import SimpleCookie
from urllib.parse import parse_qs
from . import auth, service
from .server import ROUTES, STATIC, COOKIE, MAX_BODY

LOG = logging.getLogger(__name__)

class PortalApplication:
    def __init__(self, db, origin, secure_cookies=True):
        self.db, self.origin, self.secure_cookies = db, origin.rstrip('/'), secure_cookies
        self.failures = defaultdict(deque)
        self.peers = defaultdict(deque)
        self.lock = threading.Lock()
        self.dummy_hash = auth.hash_password(secrets.token_urlsafe(32))

    def _cookie(self, value, age):
        return ('Set-Cookie', f'{COOKIE}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}' + ('; Secure' if self.secure_cookies else ''))

    def __call__(self, env, start_response):
        headers = [('X-Content-Type-Options','nosniff'), ('Referrer-Policy','same-origin'), ('X-Frame-Options','DENY'),
                   ('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'")]
        def respond(status, payload, extra=(), content_type='application/json; charset=utf-8'):
            data = payload if isinstance(payload, bytes) else json.dumps(payload,default=str).encode()
            start_response(f'{status} {HTTPStatus(status).phrase}', headers + [('Content-Type',content_type),('Content-Length',str(len(data))),('Cache-Control','no-store')] + list(extra))
            return [data]
        try:
            method, path = env.get('REQUEST_METHOD','GET'), env.get('PATH_INFO','/')
            if path == '/healthz' and method == 'GET':
                self.db.one('SELECT 1')
                return respond(200, {'ok':True})
            if not path.startswith('/api/'):
                if method != 'GET': return respond(405, {'error':'Method not allowed.'})
                target = (STATIC / ('index.html' if path == '/' else path.lstrip('/'))).resolve()
                if STATIC.resolve() not in target.parents or not target.is_file(): return respond(404, {'error':'Not found.'})
                return respond(200,target.read_bytes(), content_type=mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
            body = {}
            if method not in ('GET','HEAD'):
                if env.get('HTTP_X_PORTAL') != '1' or env.get('HTTP_ORIGIN') != self.origin:
                    raise service.PortalError('Request origin or header not allowed.',403)
                try: length = int(env.get('CONTENT_LENGTH') or 0)
                except ValueError: raise service.PortalError('Invalid request length.')
                if length < 0 or length > MAX_BODY: raise service.PortalError('Request too large.',413)
                try: body = json.loads(env['wsgi.input'].read(length) or b'{}')
                except (ValueError,UnicodeError): raise service.PortalError('Request body must be JSON.')
                if not isinstance(body,dict): raise service.PortalError('Request body must be a JSON object.')
            cookie=SimpleCookie();cookie.load(env.get('HTTP_COOKIE',''))
            token=cookie[COOKIE].value if COOKIE in cookie else None
            if path == '/api/login' and method == 'POST':
                username=str(body.get('username') or '').strip().lower()
                with self.lock:
                    current=time.monotonic()
                    if len(self.failures)>10000:
                        self.failures={k:v for k,v in self.failures.items() if v and current-v[-1]<300}
                        self.failures=defaultdict(deque,self.failures)
                    peer=env.get('REMOTE_ADDR','unknown')
                    if len(self.peers)>10000:self.peers=defaultdict(deque,{k:v for k,v in self.peers.items() if v and current-v[-1]<300})
                    recent=self.peers[peer]
                    while recent and current-recent[0]>300:recent.popleft()
                    if len(recent)>=300:raise service.PortalError('Too many sign-in attempts from this connection. Try again later.',429)
                    recent.append(current)
                    attempts=self.failures[username]
                    while attempts and current-attempts[0]>300:attempts.popleft()
                    if len(attempts)>=10:raise service.PortalError('Too many sign-in attempts. Try again in five minutes.',429)
                    attempts.append(current)
                row=auth.authenticate(self.db,username,body.get('password'))
                if not row:
                    if not self.db.one('SELECT id FROM users WHERE username=?',(username,)):
                        auth.verify_password(str(body.get('password') or ''),self.dummy_hash)
                    self.db.audit(None,'login_failed','user',None,username=username[:80])
                    raise service.PortalError('Incorrect username or password.',401)
                with self.lock:self.failures.pop(username,None)
                token=auth.create_session(self.db,row['id']);self.db.audit(row['id'],'login','user',row['id'])
                return respond(200,{'user':{k:row[k] for k in ('id','username','full_name','role')}},[self._cookie(token,auth.SESSION_HOURS*3600)])
            if path == '/api/logout' and method == 'POST':
                auth.end_session(self.db,token);return respond(200,{'ok':True},[self._cookie('',0)])
            if path == '/api/dbswitch':raise service.PortalError('Shared server database is managed by the deployment administrator.',403)
            user=auth.session_user(self.db,token)
            query={k:v[-1] for k,v in parse_qs(env.get('QUERY_STRING','')).items()}
            for route_method,pattern,handler,public in ROUTES:
                match=pattern.fullmatch(path)
                if route_method==method and match:
                    if not user and not public:raise service.PortalError('Please sign in.',401)
                    result=handler(self.db,user,match,body,query)
                    if path=='/api/dbinfo':result['managed']=True
                    return respond(200,result)
            raise service.PortalError('Not found.',404)
        except service.PortalError as exc:return respond(exc.status,{'error':str(exc)})
        except Exception:
            LOG.exception('Portal request failed')
            return respond(500,{'error':'Unexpected server error. Contact the portal administrator.'})
