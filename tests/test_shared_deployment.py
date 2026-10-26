import io
import json
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from portal import auth, service
from portal.db import Database, SCHEMA
from portal.wsgi import PortalApplication
from deploy.backup import backup_database
from tests.test_portal import make_users

ORIGIN='https://qa.test.invalid'

def request(app,path,method='GET',body=None,token=None,origin=ORIGIN):
    data=json.dumps(body or {}).encode();response={}
    env={'PATH_INFO':path,'REQUEST_METHOD':method,'QUERY_STRING':'','wsgi.input':io.BytesIO(data),'CONTENT_LENGTH':str(len(data)),
         'HTTP_X_PORTAL':'1','HTTP_ORIGIN':origin,'HTTP_COOKIE':f'qa_portal_session={token}' if token else '', 'REMOTE_ADDR':'127.0.0.1'}
    def start(status,headers):response.update(status=int(status.split()[0]),headers=dict(headers))
    raw=b''.join(app(env,start));response['body']=json.loads(raw)
    return response

class SharedDeploymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'live.db';self.db=Database(self.path)
        self.users=make_users(self.db);self.app=PortalApplication(self.db,ORIGIN)
    def tearDown(self):self.db.close();self.tmp.cleanup()
    def test_auth_origin_and_managed_database(self):
        self.assertEqual(request(self.app,'/api/machines')['status'],401)
        self.assertEqual(request(self.app,'/api/login','POST',{},origin='https://evil.invalid')['status'],403)
        login=request(self.app,'/api/login','POST',{'username':'mpa','password':'synthetic-pass-123'})
        self.assertEqual(login['status'],200)
        self.assertIn('; Secure',login['headers']['Set-Cookie'])
        token=login['headers']['Set-Cookie'].split('=',1)[1].split(';',1)[0]
        self.assertEqual(request(self.app,'/api/machines','POST',{'name':'Unauthorized'},token)['status'],403)
        self.assertEqual(request(self.app,'/api/dbswitch','POST',{'path':'/tmp/other.db'},token)['status'],403)
    def test_100_authenticated_users_write_separate_drafts(self):
        admin=self.users['admin'];m=service.save_machine(self.db,admin,{'name':'Synthetic load'})['id']
        q=service.save_queue(self.db,admin,{'name':'Synthetic load'})['id']
        a=service.save_assignment(self.db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded','start_date':'2026-10-26'})['id']
        stored=self.db.one('SELECT password_hash FROM users WHERE id=?',(admin['id'],))['password_hash']
        tokens=[]
        for index in range(100):
            uid=self.db.run("INSERT INTO users(username,full_name,role,password_hash,created_at) VALUES(?,?,'mpa',?,datetime('now'))",(f'load-{index}',f'Load {index}',stored))
            tokens.append(auth.create_session(self.db,uid))
        def work(pair):
            index,token=pair
            return request(self.app,f'/api/assignments/{a}/draft','PUT',{'qa_date':'2026-10-26','comment':f'user-{index}','results':[]},token)['status']
        with ThreadPoolExecutor(max_workers=100) as pool: statuses=list(pool.map(work,enumerate(tokens)))
        self.assertTrue(all(s==200 for s in statuses))
        self.assertEqual(self.db.one('SELECT COUNT(*) AS n FROM drafts WHERE assignment_id=?',(a,))['n'],100)
    def test_consistent_backup_is_readable(self):
        folder=Path(self.tmp.name)/'backup';folder.mkdir()
        target=backup_database(self.path,folder)
        with sqlite3.connect(target) as db:
            self.assertEqual(db.execute('PRAGMA quick_check').fetchone()[0],'ok')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM users').fetchone()[0],4)
        self.assertFalse(list(folder.glob('*.partial')))
    def test_legacy_user_constraint_migrates_without_losing_sessions(self):
        legacy=Path(self.tmp.name)/'legacy.db'
        with sqlite3.connect(legacy) as conn:
            conn.executescript(SCHEMA.replace("'therapist', 'mpa'","'therapist'"))
            conn.execute("INSERT INTO users(id,username,role,password_hash,created_at) VALUES(1,'existing','admin','synthetic','2026-10-26')")
            conn.execute("INSERT INTO sessions VALUES('synthetic',1,'2099-01-01')")
        db=Database(legacy)
        self.assertIsNotNone(db.one('SELECT * FROM sessions WHERE user_id=1'))
        auth.create_user(db,'new-mpa','New MPA','mpa','synthetic-pass-123')
        self.assertEqual(db.all('PRAGMA foreign_key_check'),[]);db.close()
