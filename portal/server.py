import json
import mimetypes
import re
import sys
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from . import auth, service
from .service import PortalError

STATIC = Path(__file__).with_name("static")
COOKIE = "qa_portal_session"
MAX_BODY = 16 * 1024 * 1024

# (method, pattern, handler(db, user, match, body, query)); None user means login not required.
ROUTES = []


def route(method, pattern, public=False):
    def register(fn):
        ROUTES.append((method, re.compile(f"^{pattern}$"), fn, public))
        return fn
    return register


@route("GET", "/api/me", public=True)
def me(db, user, m, body, q):
    return {"user": user}


@route("POST", "/api/password")
def password(db, user, m, body, q):
    return service.change_own_password(db, user, body)


@route("GET", "/api/dashboard")
def get_dashboard(db, user, m, body, q):
    return service.dashboard(db, user)


@route("GET", "/api/users")
def users(db, user, m, body, q):
    return service.list_users(db, user)


@route("POST", "/api/users")
def new_user(db, user, m, body, q):
    return service.create_user(db, user, body)


@route("PUT", r"/api/users/(\d+)")
def edit_user(db, user, m, body, q):
    return service.update_user(db, user, int(m[1]), body)


@route("GET", "/api/machines")
def machines(db, user, m, body, q):
    return service.list_machines(db, user)


@route("POST", "/api/machines")
def new_machine(db, user, m, body, q):
    return service.save_machine(db, user, body)


@route("PUT", r"/api/machines/(\d+)")
def edit_machine(db, user, m, body, q):
    return service.save_machine(db, user, body, int(m[1]))


@route("GET", r"/api/machines/(\d+)/assignments")
def machine_assignments(db, user, m, body, q):
    return service.list_assignments(db, user, int(m[1]))


@route("GET", "/api/tests")
def tests(db, user, m, body, q):
    return service.list_tests(db, user)


@route("POST", "/api/tests")
def new_test(db, user, m, body, q):
    return service.save_test(db, user, body)


@route("PUT", r"/api/tests/(\d+)")
def edit_test(db, user, m, body, q):
    return service.save_test(db, user, body, int(m[1]))


@route("GET", "/api/queues")
def queues(db, user, m, body, q):
    return service.list_queues(db, user)


@route("GET", r"/api/queues/(\d+)")
def queue(db, user, m, body, q):
    return service.get_queue(db, user, int(m[1]))


@route("POST", "/api/queues")
def new_queue(db, user, m, body, q):
    return service.save_queue(db, user, body)


@route("PUT", r"/api/queues/(\d+)")
def edit_queue(db, user, m, body, q):
    return service.save_queue(db, user, body, int(m[1]))


@route("POST", r"/api/queues/(\d+)/duplicate")
def duplicate_queue(db, user, m, body, q):
    return service.duplicate_queue(db, user, int(m[1]), body)


@route("POST", "/api/assignments")
def new_assignment(db, user, m, body, q):
    return service.save_assignment(db, user, body)


@route("PUT", r"/api/assignments/(\d+)")
def edit_assignment(db, user, m, body, q):
    return service.save_assignment(db, user, body, int(m[1]))


@route("GET", r"/api/assignments/(\d+)/template")
def template(db, user, m, body, q):
    return service.run_template(db, user, int(m[1]))


@route("PUT", r"/api/assignments/(\d+)/overrides")
def overrides(db, user, m, body, q):
    return service.save_overrides(db, user, int(m[1]), body)


@route("POST", r"/api/assignments/(\d+)/runs")
def submit(db, user, m, body, q):
    return service.submit_run(db, user, int(m[1]), body)


@route("GET", r"/api/assignments/(\d+)/files")
def import_files(db, user, m, body, q):
    return service.list_import_files(db, user, int(m[1]))


@route("GET", r"/api/assignments/(\d+)/file")
def import_file(db, user, m, body, q):
    return service.read_import_file(db, user, int(m[1]), q.get("path", ""))


@route("POST", r"/api/assignments/(\d+)/sphinx/preview")
def sphinx_preview(db, user, m, body, q):
    return service.sphinx_preview(db, user, int(m[1]), body.get("file") or {})


@route("POST", r"/api/assignments/(\d+)/sphinx/tests")
def sphinx_tests(db, user, m, body, q):
    return service.sphinx_add_tests(db, user, int(m[1]), body.get("file") or {})


@route("POST", r"/api/assignments/(\d+)/sphinx/import")
def sphinx_import(db, user, m, body, q):
    return service.import_sphinx_uploads(db, user, int(m[1]), body)


@route("GET", "/api/runs")
def runs(db, user, m, body, q):
    return service.list_runs(db, user, q)


@route("GET", r"/api/runs/(\d+)")
def run(db, user, m, body, q):
    return service.get_run(db, user, int(m[1]))


@route("POST", r"/api/runs/(\d+)/review")
def review(db, user, m, body, q):
    return service.review_run(db, user, int(m[1]), body)


@route("GET", r"/api/trend")
def trend(db, user, m, body, q):
    try:
        return service.trend(db, user, int(q.get("machine_id")), int(q.get("test_id")))
    except (TypeError, ValueError):
        raise PortalError("Choose a machine and a test.")


@route("GET", "/api/audit")
def audit(db, user, m, body, q):
    return service.list_audit(db, user)


class PortalServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, db):
        super().__init__(address, Handler)
        self.db = db


class Handler(BaseHTTPRequestHandler):
    server_version = "ProtonQAPortal"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def _token(self):
        cookie = SimpleCookie(self.headers.get("Cookie") or "")
        return cookie[COOKIE].value if COOKIE in cookie else None

    def _send(self, status, payload, headers=()):
        data = json.dumps(payload, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for name, value in headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(data)

    def _set_cookie(self, token, max_age):
        secure = "; Secure" if getattr(self.server, "secure_cookies", False) else ""
        return ("Set-Cookie", f"{COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}")

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise PortalError("Request too large.", 413)
        if not length:
            return {}
        try:
            body = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            raise PortalError("Request body must be JSON.")
        if not isinstance(body, dict):
            raise PortalError("Request body must be a JSON object.")
        return body

    def _dispatch(self, method):
        url = urlsplit(self.path)
        if not url.path.startswith("/api/"):
            return self._static(url.path) if method == "GET" else self._send(405, {"error": "Method not allowed."})
        db = self.server.db
        try:
            # Browsers cannot add custom headers to cross-site form posts, so this blocks CSRF.
            if method != "GET" and self.headers.get("X-Portal") != "1":
                raise PortalError("Missing request header.", 403)
            body = self._body() if method != "GET" else {}
            query = {k: v[-1] for k, v in parse_qs(url.query).items()}
            if url.path == "/api/login" and method == "POST":
                return self._login(db, body)
            if url.path == "/api/logout" and method == "POST":
                auth.end_session(db, self._token())
                return self._send(200, {"ok": True}, [self._set_cookie("", 0)])
            user = auth.session_user(db, self._token())
            for route_method, pattern, handler, public in ROUTES:
                match = pattern.match(url.path)
                if match and route_method == method:
                    if not user and not public:
                        raise PortalError("Please sign in.", 401)
                    return self._send(200, handler(db, user, match, body, query))
            raise PortalError("Not found.", 404)
        except PortalError as exc:
            self._send(exc.status, {"error": str(exc)})
        except Exception as exc:  # keep the server up; report the failure to the client
            self.log_error("Unhandled error on %s %s: %r", method, url.path, exc)
            self._send(500, {"error": "Unexpected server error. See the server log."})

    def _login(self, db, body):
        row = auth.authenticate(db, body.get("username"), body.get("password"))
        if not row:
            db.audit(None, "login_failed", "user", None, username=str(body.get("username") or "")[:80])
            raise PortalError("Incorrect username or password.", 401)
        token = auth.create_session(db, row["id"])
        db.audit(row["id"], "login", "user", row["id"])
        user = {k: row[k] for k in ("id", "username", "full_name", "role")}
        return self._send(200, {"user": user}, [self._set_cookie(token, auth.SESSION_HOURS * 3600)])

    def _static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (STATIC / name).resolve()
        if STATIC.resolve() not in target.parents or not target.is_file():
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(target.name)[0] or "application/octet-stream") + ("; charset=utf-8" if target.suffix in (".html", ".js", ".css") else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'")
        self.end_headers()
        self.wfile.write(data)
