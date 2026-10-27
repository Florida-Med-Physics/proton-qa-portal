import hashlib
import hmac
import secrets
from contextvars import ContextVar
from datetime import datetime, timedelta

from .db import now

ROLES = ("admin", "physicist", "therapist", "mpa")
# What each role may do; admins can do everything.
PERMISSIONS = {
    "perform": {"admin", "physicist", "therapist", "mpa"},
    "therapist_approve": {"therapist"},
    "review": {"admin", "physicist"},
    "configure": {"admin", "physicist"},
    "manage_users": {"admin"},
}
SESSION_HOURS = 12
_ITERATIONS = 600_000


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        scheme, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return hmac.compare_digest(candidate.hex(), digest)


def validate_password(password):
    if len(password or "") < 10:
        raise ValueError("Password must be at least 10 characters.")


def _token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db, user_id):
    token = secrets.token_urlsafe(32)
    expires = (datetime.now() + timedelta(hours=SESSION_HOURS)).isoformat(timespec="seconds")
    db.run("DELETE FROM sessions WHERE expires_at < ?", (now(),))
    db.run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", (_token_hash(token), user_id, expires))
    return token


def session_user(db, token):
    if not token:
        return None
    return db.one(
        "SELECT u.id, u.username, u.full_name, u.role FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1",
        (_token_hash(token), now()),
    )


def end_session(db, token):
    if token:
        db.run("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def can(user, permission):
    return bool(user) and user["role"] in PERMISSIONS[permission]


def create_user(db, username, full_name, role, password, actor_id=None):
    username = (username or "").strip()
    if not username:
        raise ValueError("Username is required.")
    if role not in ROLES:
        raise ValueError(f"Role must be one of: {', '.join(ROLES)}.")
    validate_password(password)
    if db.one("SELECT id FROM users WHERE username = ?", (username,)):
        raise ValueError(f"User '{username}' already exists.")
    user_id = db.run(
        "INSERT INTO users (username, full_name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        (username, (full_name or "").strip(), role, hash_password(password), now()),
    )
    db.audit(actor_id, "create", "user", user_id, username=username, role=role)
    return user_id


def authenticate(db, username, password):
    row = db.one("SELECT * FROM users WHERE username = ? AND active = 1", ((username or "").strip(),))
    if row and verify_password(password or "", row["password_hash"]):
        return row
    return None


ACTING_ROLE = ContextVar('qa_acting_role', default=None)

def act_as(user,role):
    """Only an authenticated Admin may use another role, with their own identity."""
    if not role:return user
    if not user or user['role']!='admin' or role not in ROLES:
        raise ValueError('Only an Admin can switch operating roles.')
    return {**user,'role':role,'authenticated_role':'admin'}
