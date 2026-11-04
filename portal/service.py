"""Portal operations. Each function takes the database, the acting user, and plain data."""

import base64
import binascii
import hashlib
import json
import re
import threading
import weakref
import zlib
from array import array
from collections import OrderedDict
from operator import itemgetter
from urllib.parse import unquote, quote
from datetime import date, datetime
from pathlib import Path

from . import auth, checklist, qa, sphinx, winston_lutz, derived
from .db import now

TEST_TYPES = ("numeric", "boolean", "status", "text", "choice")
# Accepted spellings for a status check: Pass / Warning / Fail.
STATUS_WORDS = {"pass": "pass", "passed": "pass", "warn": "warn", "warning": "warn", "fail": "fail", "failed": "fail"}


class PortalError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def require(user, permission):
    if not auth.can(user, permission):
        raise PortalError("You do not have permission to do that.", 403)


def _text(data, key, required=False, default=""):
    value = str(data.get(key) if data.get(key) is not None else default).strip()
    if required and not value:
        raise PortalError(f"{key.replace('_', ' ').capitalize()} is required.")
    return value


def _number(data, key):
    value = data.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise PortalError(f"{key.replace('_', ' ').capitalize()} must be a number.")


def _tolerance(data, key):
    value = _number(data, key)
    if value is not None and value < 0:
        raise PortalError(f"{key.capitalize()} tolerance cannot be negative.")
    return value


def _limits(data, allow_blank_mode):
    limits = {"expected": _number(data, "expected"), "warn": _tolerance(data, "warn"), "fail": _tolerance(data, "fail")}
    mode = data.get("tol_mode") or None
    if mode is None and not allow_blank_mode:
        mode = "absolute"
    if mode is not None and mode not in ("absolute", "percent"):
        raise PortalError("Tolerance mode must be absolute or percent.")
    if limits["warn"] is not None and limits["fail"] is not None and limits["warn"] > limits["fail"]:
        raise PortalError("Warning tolerance must not be larger than the fail tolerance.")
    limits["tol_mode"] = mode
    return limits


def _get(db, table, row_id):
    row = db.one(f"SELECT * FROM {table} WHERE id = ?", (row_id,))
    if not row:
        raise PortalError(f"{table[:-1].capitalize()} not found.", 404)
    return row


def _flag(data, key, default=True):
    return 1 if data.get(key, default) not in (False, 0, "0", "false") else 0


# ---- users -----------------------------------------------------------------

def list_users(db, user):
    require(user, "manage_users")
    return db.all("SELECT id, username, full_name, role, active, created_at FROM users ORDER BY username")


def create_user(db, user, data):
    require(user, "manage_users")
    try:
        return {"id": auth.create_user(db, data.get("username"), data.get("full_name"), data.get("role"), data.get("password") or "", user["id"])}
    except ValueError as exc:
        raise PortalError(str(exc))


def import_users(db,user,data):
    require(user,'manage_users')
    rows=data.get('users')
    if not isinstance(rows,list) or not 1<=len(rows)<=500:
        raise PortalError('Upload 1–500 users at a time.')
    names=set()
    for i,row in enumerate(rows,2):
        username=str(row.get('username') or '').strip()
        if not username or username.lower() in names or db.one('SELECT id FROM users WHERE username=? COLLATE NOCASE',(username,)):
            raise PortalError(f'Row {i}: username is missing or already exists. No users were imported.')
        names.add(username.lower())
        if row.get('role') not in auth.ROLES:
            raise PortalError(f'Row {i}: choose Admin, Physicist, Therapist or MPA.')
        try: auth.validate_password(row.get('password') or '')
        except ValueError:
            raise PortalError(f'Row {i}: temporary password needs at least 10 characters. No users were imported.')
    with db.transaction():
        ids=[auth.create_user(db,str(row['username']).strip(),row.get('full_name'),row['role'],row['password'],user['id']) for row in rows]
    return {'created':len(ids)}


def update_user(db, user, user_id, data):
    require(user, "manage_users")
    target = _get(db, "users", user_id)
    role = data.get("role", target["role"])
    if role not in auth.ROLES:
        raise PortalError("Unknown role.")
    active = _flag(data, "active", bool(target["active"]))
    if target["id"] == user["id"] and (role != "admin" or not active):
        raise PortalError("You cannot remove your own admin access.")
    db.run("UPDATE users SET full_name = ?, role = ?, active = ? WHERE id = ?",
           (_text(data, "full_name", default=target["full_name"]), role, active, user_id))
    if data.get("password"):
        try:
            auth.validate_password(data["password"])
        except ValueError as exc:
            raise PortalError(str(exc))
        db.run("UPDATE users SET password_hash = ? WHERE id = ?", (auth.hash_password(data["password"]), user_id))
        db.run("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.audit(user["id"], "update", "user", user_id, role=role, active=active, password_reset=bool(data.get("password")))
    return {"ok": True}


def change_own_password(db, user, data):
    row = db.one("SELECT password_hash FROM users WHERE id = ?", (user["id"],))
    if not auth.verify_password(data.get("current") or "", row["password_hash"]):
        raise PortalError("Current password is incorrect.")
    try:
        auth.validate_password(data.get("new") or "")
    except ValueError as exc:
        raise PortalError(str(exc))
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", (auth.hash_password(data["new"]), user["id"]))
    db.audit(user["id"], "change_password", "user", user["id"])
    return {"ok": True}


# ---- machines --------------------------------------------------------------

def list_machines(db, user):
    return db.all("SELECT * FROM machines ORDER BY active DESC, name")


def delete_machine(db, user, machine_id):
    require(user, "configure")
    machine = _get(db, "machines", machine_id)
    if db.one("SELECT id FROM runs WHERE machine_id = ? LIMIT 1", (machine_id,)):
        raise PortalError("This machine has recorded QA results. Retire it to remove it from active lists and preserve its history.")
    with db.transaction():
        db.run("DELETE FROM drafts WHERE assignment_id IN (SELECT id FROM assignments WHERE machine_id = ?)", (machine_id,))
        db.run("DELETE FROM assignment_overrides WHERE assignment_id IN (SELECT id FROM assignments WHERE machine_id = ?)", (machine_id,))
        db.run("DELETE FROM assignments WHERE machine_id = ?", (machine_id,))
        db.run("DELETE FROM machines WHERE id = ?", (machine_id,))
        db.audit(user["id"], "delete", "machine", machine_id, name=machine["name"])
    return {"ok": True}


def save_machine(db, user, data, machine_id=None):
    require(user, "configure")
    fields = (_text(data, "name", required=True), _text(data, "kind"), _text(data, "location"), _text(data, "notes"), _flag(data, "active"))
    clash = db.one("SELECT id FROM machines WHERE name = ? AND id != ?", (fields[0], machine_id or 0))
    if clash:
        raise PortalError(f"A machine named '{fields[0]}' already exists.")
    if machine_id is None:
        machine_id = db.run("INSERT INTO machines (name, kind, location, notes, active, created_at) VALUES (?, ?, ?, ?, ?, ?)", fields + (now(),))
        db.audit(user["id"], "create", "machine", machine_id, name=fields[0])
    else:
        _get(db, "machines", machine_id)
        db.run("UPDATE machines SET name = ?, kind = ?, location = ?, notes = ?, active = ? WHERE id = ?", fields + (machine_id,))
        db.audit(user["id"], "update", "machine", machine_id, name=fields[0], active=fields[4])
    return {"id": machine_id}


# ---- test library ----------------------------------------------------------

def list_tests(db, user):
    return db.all("SELECT t.*, q.name AS owner_name, "
                  "(SELECT MIN(qi.position) FROM queue_items qi WHERE qi.test_id = t.id AND qi.queue_id = t.owner_queue_id) AS position "
                  "FROM tests t LEFT JOIN queues q ON q.id = t.owner_queue_id "
                  "ORDER BY t.active DESC, q.name, position, t.category, t.name")


def _owner(db, data, current=None):
    """Which QA list a check belongs to (None = shared library check)."""
    raw = data.get("owner_queue_id", current)
    if raw in (None, "", 0, "0"):
        return None
    return _get(db, "queues", int(raw))["id"]


def choice_options(description):
    match=re.search(r'\[choices: ([^\]]+)\]', description or '')
    try:
        choices=json.loads(unquote(match[1])) if match else []
    except (ValueError,TypeError):
        choices=[]
    return choices if isinstance(choices,list) and all(isinstance(c,str) for c in choices) else []


def save_test(db, user, data, test_id=None):
    require(user, "configure")
    data=dict(data)
    test_type = data.get("type") or "numeric"
    if test_type=='derived':
        try:
            rule=data.get('derived')
            if isinstance(rule,str):rule=json.loads(rule)
            rule=rule or derived.read(data.get('description'))
            derived.validate(rule)
            data['description']=derived.encode(data.get('description'),rule)
        except (ValueError,TypeError,SyntaxError) as exc:raise PortalError(str(exc))
        test_type='numeric'
    elif 'derived' in data:
        data['description']=derived.encode(data.get('description'),None)
    if test_type not in TEST_TYPES:
        raise PortalError("Test type must be numeric, boolean, status, or text.")
    data=dict(data)
    if test_type == 'choice':
        choices=data.get('choices')
        if isinstance(choices,str): choices=[c.strip() for c in choices.splitlines() if c.strip()]
        if choices is None: choices=choice_options(data.get('description'))
        if not isinstance(choices,list) or not (0 if re.search(r'\[device: (?:chamber|electrometer)\]',data.get('description') or '') else 2)<=len(choices)<=100 or len(set(choices))!=len(choices) or any(not isinstance(c,str) or not c.strip() or len(c)>200 for c in choices):
            raise PortalError('Multiple choice needs 2–100 unique, nonempty choices (up to 200 characters each).')
        clean=re.sub(r'\s*\[choices: [^\]]+\]','',data.get('description') or '')
        data['description']=clean+' [choices: '+quote(json.dumps(choices),safe='')+']'
    limits = _limits(data, allow_blank_mode=False) if test_type == "numeric" else {"expected": None, "warn": None, "fail": None, "tol_mode": "absolute"}
    name, category = _text(data, "name", required=True), _text(data, "category")
    existing = _get(db, "tests", test_id) if test_id is not None else None
    owner = _owner(db, data, existing["owner_queue_id"] if existing else None)
    clash = db.one("SELECT id FROM tests WHERE name = ? AND category = ? AND owner_queue_id IS ? AND id != ?", (name, category, owner, test_id or 0))
    if clash:
        raise PortalError(f"A check named '{name}' already exists in that category" + (" of this QA list." if owner else "."))
    values = (name, category, test_type, _text(data, "unit"), _text(data, "description"),
              limits["expected"], limits["warn"], limits["fail"], limits["tol_mode"], _flag(data, "active"), owner)
    if test_id is None:
        test_id = db.run("INSERT INTO tests (name, category, type, unit, description, expected, warn, fail, tol_mode, active, owner_queue_id) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values)
        db.audit(user["id"], "create", "test", test_id, name=name, owner=owner, **limits)
    else:
        db.run("UPDATE tests SET name = ?, category = ?, type = ?, unit = ?, description = ?, expected = ?, warn = ?, fail = ?, "
               "tol_mode = ?, active = ?, owner_queue_id = ? WHERE id = ?", values + (test_id,))
        db.audit(user["id"], "update", "test", test_id, name=name, owner=owner, **limits)
    return {"id": test_id}


# ---- queues ----------------------------------------------------------------

def merge_copies(db, user):
    """Make every QA list one object. Each per-machine copy that has the same tests (name and type, in order) as the list it
    was made from is folded back into that list: its schedules, runs, results and drafts move onto the list's tests, any
    limit that differed becomes that machine's own value (an override on its schedule), and the copy is removed. Tests
    dropped from a copy that still carry results move with their history (into a same-named test of the list when that is
    safe). A copy whose tests differ stays as a list of its own. Audited; run once, after a backup."""
    require(user, "configure")
    merged, kept = [], []
    items_of = lambda qid: db.all("SELECT qi.*, t.name, t.type FROM queue_items qi JOIN tests t ON t.id = qi.test_id "
                                  "WHERE qi.queue_id = ? ORDER BY qi.position", (qid,))
    with db.transaction():
        for copy in db.all("SELECT * FROM queues WHERE template_id IS NOT NULL AND is_template = 0 ORDER BY id"):
            source = db.one("SELECT * FROM queues WHERE id = ?", (copy["template_id"],))
            mine = items_of(copy["id"])
            theirs = items_of(source["id"]) if source else []
            schedules = db.all("SELECT * FROM assignments WHERE queue_id = ?", (copy["id"],))
            same = source is not None and [(i["name"], i["type"]) for i in mine] == [(i["name"], i["type"]) for i in theirs]
            clash = source is not None and any(db.one("SELECT 1 FROM assignments WHERE queue_id = ? AND machine_id = ?", (source["id"], a["machine_id"]))
                                               for a in schedules)
            if not same or clash:
                db.run("UPDATE queues SET template_id = NULL WHERE id = ?", (copy["id"],))
                kept.append(copy["name"])
                continue
            pair = {m["test_id"]: t["test_id"] for m, t in zip(mine, theirs)}
            sids = [a["id"] for a in schedules]
            for sid in sids:
                for old, new in pair.items():
                    db.run("UPDATE assignment_overrides SET test_id = ? WHERE assignment_id = ? AND test_id = ?", (new, sid, old))
            for m, t in zip(mine, theirs):
                own = qa.resolve_limits(_get(db, "tests", m["test_id"]), m)
                shared = qa.resolve_limits(_get(db, "tests", t["test_id"]), t)
                if own != shared:
                    for sid in sids:
                        if not db.one("SELECT 1 FROM assignment_overrides WHERE assignment_id = ? AND test_id = ?", (sid, t["test_id"])):
                            db.run("INSERT INTO assignment_overrides (assignment_id, test_id, expected, warn, fail, tol_mode) VALUES (?, ?, ?, ?, ?, ?)",
                                   (sid, t["test_id"], own["expected"], own["warn"], own["fail"], own["tol_mode"]))
            for old, new in pair.items():
                db.run("UPDATE results SET test_id = ? WHERE test_id = ?", (new, old))
            for t in db.all("SELECT * FROM tests WHERE owner_queue_id = ?", (copy["id"],)):
                if t["id"] in pair:
                    continue
                if not db.one("SELECT 1 FROM results WHERE test_id = ? LIMIT 1", (t["id"],)):
                    db.run("DELETE FROM tests WHERE id = ?", (t["id"],))
                    continue
                twin = db.one("SELECT id FROM tests WHERE owner_queue_id = ? AND name = ? AND category = ?", (source["id"], t["name"], t["category"]))
                overlap = twin and db.one("SELECT 1 FROM results a JOIN results b ON a.run_id = b.run_id WHERE a.test_id = ? AND b.test_id = ? LIMIT 1",
                                          (t["id"], twin["id"]))
                if twin and not overlap:
                    db.run("UPDATE results SET test_id = ? WHERE test_id = ?", (twin["id"], t["id"]))
                    db.run("DELETE FROM tests WHERE id = ?", (t["id"],))
                else:
                    db.run("UPDATE tests SET owner_queue_id = ?, name = ? WHERE id = ?",
                           (source["id"], f"{t['name']} ({copy['name']})" if twin else t["name"], t["id"]))
            runs = db.one("SELECT COUNT(*) AS n FROM runs WHERE queue_id = ?", (copy["id"],))["n"]
            db.run("UPDATE runs SET queue_id = ? WHERE queue_id = ?", (source["id"], copy["id"]))
            db.run("UPDATE assignments SET queue_id = ? WHERE queue_id = ?", (source["id"], copy["id"]))
            for sid in sids:
                for d in db.all("SELECT rowid AS rid, data FROM drafts WHERE assignment_id = ?", (sid,)):
                    data = json.loads(d["data"])
                    for r in data.get("results") or []:
                        r["test_id"] = pair.get(int(r.get("test_id") or 0), r.get("test_id"))
                    db.run("UPDATE drafts SET data = ? WHERE rowid = ?", (json.dumps(data), d["rid"]))
            db.run("DELETE FROM queue_items WHERE queue_id = ?", (copy["id"],))
            db.run("DELETE FROM tests WHERE owner_queue_id = ? AND id NOT IN (SELECT test_id FROM results)", (copy["id"],))
            db.run("UPDATE queues SET template_id = NULL WHERE template_id = ?", (copy["id"],))
            db.run("DELETE FROM queues WHERE id = ?", (copy["id"],))
            db.audit(user["id"], "merge", "queue", source["id"], name=source["name"], merged=copy["name"], runs=runs,
                     machines=[a["machine_id"] for a in schedules])
            merged.append(copy["name"])
    return {"merged": merged, "kept": kept}


def list_queues(db, user):
    return _list_queues(db)


def _list_queues(db):
    return db.all(
        "SELECT q.*, (SELECT COUNT(*) FROM queue_items qi WHERE qi.queue_id = q.id) AS item_count, "
        "(SELECT COUNT(*) FROM assignments a WHERE a.queue_id = q.id AND a.active = 1) AS machine_count, "
        "(SELECT name FROM queues t WHERE t.id = q.template_id) AS template_name, "
        "(SELECT MAX(a.at) FROM audit a WHERE (a.entity = 'queue' AND a.entity_id = q.id) "
        " OR (a.entity = 'test' AND a.entity_id IN (SELECT id FROM tests WHERE owner_queue_id = q.id))) AS modified_at, "
        "(SELECT a.id FROM audit a WHERE (a.entity = 'queue' AND a.entity_id = q.id) OR (a.entity = 'test' AND a.entity_id IN (SELECT id FROM tests WHERE owner_queue_id = q.id)) ORDER BY a.at DESC,a.id DESC LIMIT 1) AS modified_order, "
        "(SELECT COALESCE(u.full_name, u.username, 'system') FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE ((a.entity = 'queue' AND a.entity_id = q.id) "
        " OR (a.entity = 'test' AND a.entity_id IN (SELECT id FROM tests WHERE owner_queue_id = q.id))) ORDER BY a.at DESC, a.id DESC LIMIT 1) AS modified_by, "
        "(SELECT GROUP_CONCAT(m.name, ', ') FROM assignments a JOIN machines m ON m.id = a.machine_id WHERE a.queue_id = q.id AND a.active = 1) AS machines "
        "FROM queues q ORDER BY q.is_template DESC, q.active DESC, q.name")


def get_queue(db, user, queue_id):
    queue = _get(db, "queues", queue_id)
    queue["import_blocks"]=json.loads(queue.get("import_blocks") or "[]")
    queue["items"] = db.all(
        "SELECT qi.test_id, qi.position, qi.expected, qi.warn, qi.fail, qi.tol_mode, t.name, t.category, t.type, t.unit, "
        "t.expected AS default_expected, t.warn AS default_warn, t.fail AS default_fail, t.tol_mode AS default_tol_mode "
        "FROM queue_items qi JOIN tests t ON t.id = qi.test_id WHERE qi.queue_id = ? ORDER BY qi.position", (queue_id,))
    # Last change to each test, from the audit log; tests never edited since the list was made show when it was made.
    changed = {r["entity_id"]: r for r in db.all(
        "SELECT a.entity_id, a.at, u.username, u.full_name FROM audit a LEFT JOIN users u ON u.id = a.user_id "
        "WHERE a.entity = 'test' AND a.id IN (SELECT MAX(id) FROM audit WHERE entity = 'test' GROUP BY entity_id)")}
    made = db.one("SELECT a.at, u.username, u.full_name FROM audit a LEFT JOIN users u ON u.id = a.user_id "
                  "WHERE (a.entity = 'queue' AND a.entity_id = ?) OR a.action = 'seed' ORDER BY (a.entity = 'queue') DESC, a.id LIMIT 1", (queue_id,))
    for item in queue["items"]:
        row = changed.get(item["test_id"]) or made or {}
        item["modified_at"] = row.get("at")
        item["modified_by"] = row.get("full_name") or row.get("username") or ("starting data" if row else None)
    # The machines that run this very list (one object, shared; each machine may hold its own values as overrides).
    queue["schedules"] = db.all("SELECT a.id, a.machine_id, a.active, m.name AS machine FROM assignments a JOIN machines m ON m.id = a.machine_id "
                                "WHERE a.queue_id = ? ORDER BY m.name", (queue_id,))
    return queue


def save_queue(db, user, data, queue_id=None, _within_transaction=False):
    require(user, "configure")
    if data.get("test_updates"):
        if queue_id is None:
            raise PortalError("Save the template before editing its tests.")
        member_ids = {int(item["test_id"]) for item in data.get("items", [])}
        with db.transaction():
            for update in data["test_updates"]:
                tid = int(update["test_id"])
                existing = _get(db, "tests", tid)
                if tid not in member_ids or (existing["owner_queue_id"] is not None and existing["owner_queue_id"] != queue_id):
                    raise PortalError("Only this template's tests can be edited here.")
                fields = {key: update[key] for key in ("name", "category", "type", "choices", "derived", "description") if key in update}
                save_test(db, user, {**existing, **fields}, tid)
            return save_queue(db, user, {**data, "test_updates": []}, queue_id, _within_transaction=True)
    name = _text(data, "name", required=True)
    clash = db.one("SELECT id FROM queues WHERE name = ? AND id != ?", (name, queue_id or 0))
    if clash:
        raise PortalError(f"A queue named '{name}' already exists.")
    items = []
    for position, item in enumerate(data.get("items") or []):
        test = _get(db, "tests", int(item.get("test_id")))
        if test["owner_queue_id"] is not None and test["owner_queue_id"] != queue_id:
            raise PortalError(f"'{test['name']}' belongs to another QA list. Duplicate that list, or add a new check here.")
        limits = _limits(item, allow_blank_mode=True) if test["type"] == "numeric" else {"expected": None, "warn": None, "fail": None, "tol_mode": None}
        items.append((test["id"], position, limits))
    prior=[]
    for tid,position,limits in items:
        test=_get(db,'tests',tid)
        try:
            rule=derived.read(test.get('description'))
            if rule:derived.resolve(rule,prior)
        except (ValueError,TypeError,SyntaxError) as exc:raise PortalError(str(exc))
        prior.append(test)
    if len({i[0] for i in items}) != len(items):
        raise PortalError("A check can only appear once in a QA list.")
    existing = _get(db, "queues", queue_id) if queue_id is not None else None
    from . import import_blocks
    try: blocks=import_blocks.validate(data.get('import_blocks',json.loads(existing.get('import_blocks') or '[]') if existing else []),prior)
    except (ValueError,TypeError,KeyError) as exc: raise PortalError(str(exc))
    is_template = _flag(data, "is_template", bool(existing["is_template"]) if existing else False)
    from contextlib import nullcontext
    with (nullcontext() if _within_transaction else db.transaction()):
        if queue_id is None:
            queue_id = db.run("INSERT INTO queues (name, description, active, is_template) VALUES (?, ?, ?, ?)",
                              (name, _text(data, "description"), _flag(data, "active"), is_template))
            action = "create"
        else:
            db.run("UPDATE queues SET name = ?, description = ?, active = ?, is_template = ? WHERE id = ?",
                   (name, _text(data, "description"), _flag(data, "active"), is_template, queue_id))
            before = {r["test_id"]: r for r in db.all("SELECT * FROM queue_items WHERE queue_id = ?", (queue_id,))}
            db.run("DELETE FROM queue_items WHERE queue_id = ?", (queue_id,))
            action = "update"
        db.run('UPDATE queues SET import_blocks=? WHERE id=?',(json.dumps(blocks),queue_id))
        for test_id, position, limits in items:
            db.run("INSERT INTO queue_items (queue_id, test_id, position, expected, warn, fail, tol_mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (queue_id, test_id, position, limits["expected"], limits["warn"], limits["fail"], limits["tol_mode"]))
        db.audit(user["id"], action, "queue", queue_id, name=name, tests=[i[0] for i in items])
        if action == "update":
            # Record each test whose limits on this list changed, so Setup QA can show who changed it and when.
            for test_id, _, limits in items:
                old = before.get(test_id)
                if old is None or any(old[k] != limits[k] for k in limits):
                    db.audit(user["id"], "update_limits" if old else "add_to_list", "test", test_id, queue=name, **limits)
    return {"id": queue_id}


def rename_queue(db, user, queue_id, data):
    """Rename a QA list without touching its tests."""
    require(user, "configure")
    queue = _get(db, "queues", queue_id)
    name = _text(data, "name", required=True)
    if db.one("SELECT id FROM queues WHERE name = ? AND id != ?", (name, queue_id)):
        raise PortalError(f"A QA list named '{name}' already exists.")
    db.run("UPDATE queues SET name = ? WHERE id = ?", (name, queue_id))
    db.audit(user["id"], "rename", "queue", queue_id, was=queue["name"], name=name)
    return {"id": queue_id, "name": name}


def reevaluate_queue(db, user, queue_id):
    """Re-judge every recorded result on this list against the limits in force now (a deliberate, logged admin step).
    Each result's stored expected / warning / action / mode and status are rewritten, and each run's overall with them."""
    require(user, "configure")
    queue = _get(db, "queues", queue_id)
    changed = 0
    runs = set()
    overrides = {(o["machine_id"], o["test_id"]): o for o in db.all(
        "SELECT o.*, a.machine_id FROM assignment_overrides o JOIN assignments a ON a.id = o.assignment_id WHERE a.queue_id = ?", (queue_id,))}
    with db.transaction():
        for item in db.all("SELECT qi.*, t.type FROM queue_items qi JOIN tests t ON t.id = qi.test_id WHERE qi.queue_id = ?", (queue_id,)):
            test = _get(db, "tests", item["test_id"])
            for res in db.all("SELECT res.id, res.run_id, res.value_num, res.value_text, res.status, r.machine_id FROM results res JOIN runs r ON r.id = res.run_id "
                              "WHERE res.test_id = ? AND r.queue_id = ?", (test["id"], queue_id)):
                limits = qa.resolve_limits(test, item, overrides.get((res["machine_id"], test["id"])))   # that machine's own values
                value = res["value_num"] if test["type"] == "numeric" else (res["value_num"] if test["type"] == "boolean" else res["value_text"])
                if value is None:
                    continue
                status = qa.evaluate(test["type"], value, limits)
                db.run("UPDATE results SET expected = ?, warn = ?, fail = ?, tol_mode = ?, status = ? WHERE id = ?",
                       (limits["expected"], limits["warn"], limits["fail"], limits["tol_mode"], status, res["id"]))
                if status != res["status"]:
                    changed += 1
                runs.add(res["run_id"])
        for run_id in runs:
            db.run("UPDATE runs SET overall = ? WHERE id = ?", (_results_overall(db.all("SELECT status, value_num, value_text FROM results WHERE run_id = ?", (run_id,))), run_id))
        db.audit(user["id"], "reevaluate", "queue", queue_id, name=queue["name"], runs=len(runs), verdicts_changed=changed)
    return {"runs": len(runs), "changed": changed}


def archive_queue(db, user, queue_id, data):
    """Hide a QA list without deleting anything; preserve each machine's activation setting."""
    require(user, "configure")
    queue = _get(db, "queues", queue_id)
    archived = bool(data.get("archived", True))
    with db.transaction():
        db.run("UPDATE queues SET active = ? WHERE id = ?", (0 if archived else 1, queue_id))
        db.audit(user["id"], "archive" if archived else "restore", "queue", queue_id, name=queue["name"])
    return {"ok": True}


def delete_queue(db, user, queue_id):
    """Permanently delete a QA list, its schedules and its own tests. Refused once any result exists,
    so QA history can never be deleted this way (archive the list instead)."""
    require(user, "configure")
    queue = _get(db, "queues", queue_id)
    runs = db.one("SELECT COUNT(*) AS n FROM runs WHERE queue_id = ?", (queue_id,))["n"]
    if runs:
        raise PortalError(f"'{queue['name']}' has {runs} recorded QA run(s), so it cannot be deleted. Archive it instead to hide it.")
    with db.transaction():
        db.run("DELETE FROM assignment_overrides WHERE assignment_id IN (SELECT id FROM assignments WHERE queue_id = ?)", (queue_id,))
        db.run("DELETE FROM assignments WHERE queue_id = ?", (queue_id,))
        db.run("DELETE FROM queue_items WHERE queue_id = ?", (queue_id,))
        db.run("DELETE FROM tests WHERE owner_queue_id = ? AND id NOT IN (SELECT test_id FROM results)", (queue_id,))
        db.run("UPDATE queues SET template_id = NULL WHERE template_id = ?", (queue_id,))
        db.run("DELETE FROM queues WHERE id = ?", (queue_id,))
        db.audit(user["id"], "delete", "queue", queue_id, name=queue["name"])
    return {"ok": True}


def duplicate_queue(db, user, source_id, data):
    """Copy a QA list (usually a template). Every check is copied, so the copy owns its own limits."""
    require(user, "configure")
    source = get_queue(db, user, source_id)
    name = _text(data, "name", required=True)
    if db.one("SELECT id FROM queues WHERE name = ?", (name,)):
        raise PortalError(f"A QA list named '{name}' already exists.")
    with db.transaction():
        as_template = _flag(data, "as_template", default=False)
        queue_id = db.run("INSERT INTO queues (name, description, active, is_template, template_id) VALUES (?, ?, 1, ?, ?)",
                          (name, source["description"], 1 if as_template else 0, None))
        db.run("UPDATE queues SET import_blocks=? WHERE id=?",(json.dumps(source.get("import_blocks",[])),queue_id))
        for item in source["items"]:
            test = _get(db, "tests", item["test_id"])
            limits = qa.resolve_limits(test, item)
            new_id = db.run("INSERT INTO tests (name, category, type, unit, description, expected, warn, fail, tol_mode, active, owner_queue_id) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
                            (test["name"], test["category"], test["type"], test["unit"], test["description"],
                             limits["expected"], limits["warn"], limits["fail"], limits["tol_mode"], queue_id))
            db.run("INSERT INTO queue_items (queue_id, test_id, position) VALUES (?, ?, ?)", (queue_id, new_id, item["position"]))
        db.audit(user["id"], "duplicate", "queue", queue_id, name=name, source=source["name"], checks=len(source["items"]))
    result = {"id": queue_id}
    if data.get("machine_id"):
        result["assignment_id"] = save_assignment(db, user, {**data, "queue_id": queue_id})["id"]
    return result


# ---- starting data ------------------------------------------------------------------

SEED_FILE = Path(__file__).with_name("seed.json")


def template_starters(db, user):
    require(user, "configure")
    seed = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    return seed.get("templates", [])


def create_template(db, user, data):
    """Create a reviewed starter/import atomically, with list-owned checks and no schedules."""
    require(user, "configure")
    name = _text(data, "name", required=True)
    if db.one("SELECT id FROM queues WHERE name = ? COLLATE NOCASE", (name,)):
        raise PortalError("A QA template list with that name already exists.")
    description = _text(data, "description")
    source = _text(data, "starter")
    if source:
        starter = next((s for s in template_starters(db, user) if s["name"] == source), None)
        if not starter:
            raise PortalError("Choose an available starter template.")
        checks = starter.get("checks", [])
        description = starter.get("setup", "")
    else:
        checks = data.get("tests", [])
    if not isinstance(checks, list) or len(checks) > 500:
        raise PortalError("Import up to 500 tests at a time.")
    with db.transaction():
        qid = db.run("INSERT INTO queues (name, description, active, is_template) VALUES (?, ?, 1, 1)", (name, description))
        for position, check in enumerate(checks):
            if not isinstance(check, dict):
                raise PortalError("Each imported test must have a name and type.")
            tid = save_test(db, user, {**check, "owner_queue_id": qid})["id"]
            db.run("INSERT INTO queue_items (queue_id, test_id, position) VALUES (?, ?, ?)", (qid, tid, position))
        db.audit(user["id"], "create_template", "queue", qid, name=name, source=source or _text(data, "source") or "blank", tests=len(checks))
    return {"id": qid, "tests": len(checks)}


def seed_defaults(db, user, seed=None):
    """Create the templates, tests, machines and schedules from seed.json (the same data the browser build starts with).

    Refuses to run on a database that already has machines or templates, so it cannot duplicate anything."""
    require(user, "configure")
    seed = seed if seed is not None else json.loads(SEED_FILE.read_text(encoding="utf-8"))
    if db.one("SELECT id FROM machines LIMIT 1") or db.one("SELECT id FROM queues WHERE is_template = 1 LIMIT 1"):
        raise PortalError("This database already has machines or templates; the starting data is only loaded into an empty one.")
    by_kind = {}
    with db.transaction():
        for tpl in seed.get("templates", []):
            queue_id = db.run("INSERT INTO queues (name, description, active, is_template) VALUES (?, ?, 1, 1)", (tpl["name"], tpl.get("setup", "")))
            for position, c in enumerate(tpl.get("checks", [])):
                test_id = db.run("INSERT INTO tests (name, category, type, unit, description, expected, warn, fail, tol_mode, active, owner_queue_id) "
                                 "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
                                 (c["name"], c.get("category", ""), c.get("type", "numeric"), c.get("unit", ""), c.get("description", ""),
                                  c.get("expected"), c.get("warn"), c.get("fail"), c.get("tol_mode") or "absolute", queue_id))
                db.run("INSERT INTO queue_items (queue_id, test_id, position) VALUES (?, ?, ?)", (queue_id, test_id, position))
            by_kind.setdefault(tpl.get("kind", ""), []).append({**tpl, "id": queue_id})
        db.audit(user["id"], "seed", "portal", None, templates=[t["name"] for t in seed.get("templates", [])])
    machines = []
    for m in seed.get("machines", []):
        machine_id = save_machine(db, user, {"name": m["name"], "kind": m.get("kind", ""), "location": m.get("location", ""), "notes": m.get("notes", "")})["id"]
        machines.append(m["name"])
        for tpl in by_kind.get(m.get("kind", ""), []):
            # The same list on every machine of its kind (no per-machine copies).
            save_assignment(db, user, {"machine_id": machine_id, "queue_id": tpl["id"], "frequency": tpl.get("frequency") or "daily",
                                       "weekdays": m.get("weekdays", [0, 1, 2, 3, 4])})
    return {"templates": [t["name"] for t in seed.get("templates", [])], "machines": machines}


# ---- drafts: a Perform QA page saved part-way, per user and list --------------

def get_draft(db, user, assignment_id):
    row = db.one("SELECT data, saved_at FROM drafts WHERE assignment_id = ? AND user_id = ?", (assignment_id, user["id"]))
    return {**json.loads(row["data"]), "saved_at": row["saved_at"]} if row else None


def save_draft(db, user, assignment_id, data):
    require(user, "perform")
    _get(db, "assignments", assignment_id)
    payload = {"qa_date": data.get("qa_date"), "comment": data.get("comment") or "", "results": data.get("results") or []}
    db.run("INSERT INTO drafts (assignment_id, user_id, data, saved_at) VALUES (?, ?, ?, ?) "
           "ON CONFLICT(assignment_id, user_id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at",
           (assignment_id, user["id"], json.dumps(payload), now()))
    return {"saved_at": now()}


def delete_draft(db, user, assignment_id):
    db.run("DELETE FROM drafts WHERE assignment_id = ? AND user_id = ?", (assignment_id, user["id"]))
    return {"ok": True}


# ---- machine assignments (scheduled queues) ---------------------------------

def _last_done(db, assignment_id):
    row = db.one("SELECT MAX(qa_date) AS last FROM runs WHERE trashed_at IS NULL AND assignment_id = ?", (assignment_id,))
    return date.fromisoformat(row["last"]) if row and row["last"] else None


def list_assignments(db, user, machine_id, today=None):
    today = today or date.today()
    rows = db.all("SELECT a.*, q.name AS queue_name, (SELECT COUNT(*) FROM assignment_overrides o WHERE o.assignment_id = a.id) AS override_count "
                  "FROM assignments a JOIN queues q ON q.id = a.queue_id WHERE a.machine_id = ? AND q.active = 1 ORDER BY a.active DESC, q.name", (machine_id,))
    for row in rows:
        row["archived"] = bool(json.loads(row.get("test_selection") or "{}").get("archived"))
        if row["archived"]:
            row["active"] = 0
        row["schedule"] = qa.describe_schedule(row)
        row.update(qa.due_state(row, _last_done(db, row["id"]), today))
    return rows


def list_all_assignments(db, user, today=None):
    """Every machine's schedules in one reply (GET /api/assignments), for pages that show several machines: machine by
    machine in list_machines order, so one machine's rows are exactly its list_assignments."""
    today = today or date.today()
    return [row for machine in list_machines(db, user) for row in list_assignments(db, user, machine["id"], today)]


def archive_assignment(db, user, assignment_id, data):
    require(user, "configure")
    a = _get(db, "assignments", assignment_id)
    selection = json.loads(a.get("test_selection") or "{}")
    archived = bool(data.get("archived", True))
    if archived == bool(selection.get("archived")):
        return {"ok": True}
    if archived:
        selection["active_before_archive"] = bool(a["active"])
        selection["archived"] = True
        active = 0
    else:
        active = 1 if selection.pop("active_before_archive", True) else 0
        selection.pop("archived", None)
    with db.transaction():
        db.run("UPDATE assignments SET active = ?, test_selection = ? WHERE id = ?", (active, json.dumps(selection), assignment_id))
        db.audit(user["id"], "archive" if archived else "restore", "assignment", assignment_id)
    return {"ok": True}


def delete_assignment(db, user, assignment_id):
    require(user, "configure")
    _get(db, "assignments", assignment_id)
    if db.one("SELECT id FROM runs WHERE assignment_id = ? LIMIT 1", (assignment_id,)):
        raise PortalError("This machine schedule has recorded results. Archive it to preserve its history.")
    with db.transaction():
        db.run("DELETE FROM assignment_overrides WHERE assignment_id = ?", (assignment_id,))
        db.run("DELETE FROM drafts WHERE assignment_id = ?", (assignment_id,))
        db.run("DELETE FROM assignments WHERE id = ?", (assignment_id,))
        db.audit(user["id"], "delete", "assignment", assignment_id)
    return {"ok": True}


def duplicate_assignment(db, user, assignment_id, data):
    require(user, "configure")
    source = run_template(db, user, assignment_id)
    name = _text(data, "name", required=True)
    if db.one("SELECT id FROM queues WHERE name = ?", (name,)):
        raise PortalError("A QA list with that name already exists.")
    a = source["assignment"]
    with db.transaction():
        qid = db.run("INSERT INTO queues (name, description, active, is_template) VALUES (?, ?, 1, 0)", (name, source["queue"]["description"]))
        db.run("UPDATE queues SET import_blocks=? WHERE id=?",(json.dumps(source["queue"].get("import_blocks",[])),qid))
        for position, item in enumerate(source["items"]):
            l = item["limits"]
            tid = db.run("INSERT INTO tests (name, category, type, unit, description, expected, warn, fail, tol_mode, active, owner_queue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
                         (item["name"], item["category"], item["type"], item["unit"], item["description"], l["expected"], l["warn"], l["fail"], l["tol_mode"], qid))
            db.run("INSERT INTO queue_items (queue_id, test_id, position) VALUES (?, ?, ?)", (qid, tid, position))
        sid = db.run("INSERT INTO assignments (machine_id, queue_id, frequency, interval_days, weekdays, start_date, active, import_folder) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
                     (a["machine_id"], qid, a["frequency"], a["interval_days"], a["weekdays"], a["start_date"], a["import_folder"]))
        db.audit(user["id"], "duplicate", "assignment", sid, source=assignment_id, queue_id=qid, name=name)
    return {"id": qid, "assignment_id": sid}


def reevaluate_assignment(db, user, assignment_id):
    require(user, "configure")
    a = _get(db, "assignments", assignment_id)
    queue_items = {i["test_id"]: i for i in get_queue(db, user, a["queue_id"])["items"]}
    overrides = {i["test_id"]: i for i in db.all("SELECT * FROM assignment_overrides WHERE assignment_id = ?", (assignment_id,))}
    runs, changed = set(), 0
    with db.transaction():
        for res in db.all("SELECT res.* FROM results res JOIN runs r ON r.id = res.run_id WHERE r.assignment_id = ?", (assignment_id,)):
            test = _get(db, "tests", res["test_id"])
            limits = qa.resolve_limits(test, queue_items.get(test["id"], {}), overrides.get(test["id"]))
            value = res["value_num"] if test["type"] in ("numeric", "boolean") else res["value_text"]
            if value is None:
                continue
            status = qa.evaluate(test["type"], value, limits)
            changed += status != res["status"]
            db.run("UPDATE results SET expected = ?, warn = ?, fail = ?, tol_mode = ?, status = ? WHERE id = ?", (limits["expected"], limits["warn"], limits["fail"], limits["tol_mode"], status, res["id"]))
            runs.add(res["run_id"])
        for rid in runs:
            db.run("UPDATE runs SET overall = ? WHERE id = ?", (_results_overall(db.all("SELECT status, value_num, value_text FROM results WHERE run_id = ?", (rid,))), rid))
        db.audit(user["id"], "reevaluate", "assignment", assignment_id, runs=len(runs), verdicts_changed=changed)
    return {"runs": len(runs), "changed": changed}


def save_assignment(db, user, data, assignment_id=None):
    require(user, "configure")
    frequency = data.get("frequency")
    if frequency not in qa.FREQUENCIES:
        raise PortalError("Choose a frequency.")
    interval = data.get("interval_days")
    if frequency == "custom":
        try:
            interval = int(interval)
            assert interval > 0
        except (TypeError, ValueError, AssertionError):
            raise PortalError("Custom schedules need a whole number of days greater than zero.")
    else:
        interval = None
    weekdays = ",".join(str(d) for d in sorted(qa.parse_weekdays(",".join(str(d) for d in data.get("weekdays", [0, 1, 2, 3, 4])))))
    try:
        start = date.fromisoformat(data.get("start_date") or date.today().isoformat()).isoformat()
    except ValueError:
        raise PortalError("Start date must be YYYY-MM-DD.")
    active = _flag(data, "active")
    folder = _text(data, "import_folder")
    if assignment_id is None:
        machine = _get(db, "machines", int(data.get("machine_id") or 0))
        queue = _get(db, "queues", int(data.get("queue_id") or 0))
        if db.one("SELECT id FROM assignments WHERE machine_id = ? AND queue_id = ?", (machine["id"], queue["id"])):
            raise PortalError(f"'{queue['name']}' is already scheduled on {machine['name']}.")
        assignment_id = db.run("INSERT INTO assignments (machine_id, queue_id, frequency, interval_days, weekdays, start_date, active, import_folder) "
                               "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (machine["id"], queue["id"], frequency, interval, weekdays, start, active, folder))
        db.audit(user["id"], "create", "assignment", assignment_id, machine=machine["name"], queue=queue["name"], frequency=frequency)
    else:
        target = _get(db, "assignments", assignment_id)
        if json.loads(target.get("test_selection") or "{}").get("archived"):
            raise PortalError("Restore this archived schedule before changing it.")
        db.run("UPDATE assignments SET frequency = ?, interval_days = ?, weekdays = ?, start_date = ?, active = ?, import_folder = ? WHERE id = ?",
               (frequency, interval, weekdays, start, active, folder, assignment_id))
        db.audit(user["id"], "update", "assignment", assignment_id, frequency=frequency, weekdays=weekdays, start=start, active=active,
                 import_folder=folder)
    return {"id": assignment_id}


# ---- default import folder (where each scheduled list's export files appear) ----------------

IMPORT_EXTENSIONS = (".xls", ".csv", ".pdf")  # Sphinx exports today; DQA3 exports once that importer exists.


def _import_root(assignment):
    folder = assignment["import_folder"]
    if not folder:
        raise PortalError("This list has no default import folder. Set one under Change schedule.")
    root = Path(folder).expanduser()
    if not root.is_dir():
        raise PortalError(f"Import folder not found: {folder}")
    return root.resolve()


def list_import_files(db, user, assignment_id, limit=None):
    """Newest export files in the list's default folder (searched recursively), with any run already recorded from each."""
    assignment = _get(db, "assignments", assignment_id)
    if not assignment["import_folder"]:
        return {"folder": "", "files": []}
    root = _import_root(assignment)
    paths = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMPORT_EXTENSIONS and not p.name.startswith("~$")]
    paths.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    files = []
    for path in paths[:limit]:
        stat = path.stat()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        run = db.one("SELECT id, qa_date FROM runs WHERE source_ref = ?", (digest,))
        files.append({"name": path.name, "path": path.relative_to(root).as_posix(), "size": stat.st_size,
                      "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="minutes"),
                      "run_id": run["id"] if run else None, "qa_date": run["qa_date"] if run else None})
    return {"folder": str(root), "files": files}


def read_import_file(db, user, assignment_id, relative):
    """One file from the default folder, in the same {name, data} form as an uploaded file."""
    root = _import_root(_get(db, "assignments", assignment_id))
    target = (root / (relative or "")).resolve()
    if root not in target.parents or not target.is_file() or target.suffix.lower() not in IMPORT_EXTENSIONS:
        raise PortalError("That file is not in this list's import folder.")
    return {"name": target.name, "data": base64.b64encode(target.read_bytes()).decode()}


def save_test_selection(db, user, assignment_id, data):
    """Store only membership exceptions; shared template items remain live."""
    require(user, "configure")
    assignment = _get(db, "assignments", assignment_id)
    queue_id = assignment["queue_id"]
    base = {i["test_id"] for i in get_queue(db, user, queue_id)["items"]}
    try:
        excluded = list(dict.fromkeys(int(x) for x in data.get("excluded", [])))
        added = list(dict.fromkeys(int(x) for x in data.get("added", [])))
    except (TypeError, ValueError):
        raise PortalError("Choose valid tests.")
    for tid in excluded + added:
        test = _get(db, "tests", tid)
        if test.get("owner_queue_id") not in (None, queue_id):
            raise PortalError("That test belongs to another QA list.")
        if tid in added and not test["active"]:
            raise PortalError("Choose an active test.")
    selection = {**json.loads(assignment.get("test_selection") or "{}"), "excluded": excluded, "added": [tid for tid in added if tid not in base]}
    with db.transaction():
        db.run("UPDATE assignments SET test_selection = ? WHERE id = ?", (json.dumps(selection), assignment_id))
        db.audit(user["id"], "update", "test_selection", assignment_id, **selection)
    return {"ok": True, **selection}


def run_template(db, user, assignment_id):
    """The queue as it applies to one machine: each test with its resolved limits."""
    assignment = _get(db, "assignments", assignment_id)
    if json.loads(assignment.get("test_selection") or "{}").get("archived"):
        assignment["active"] = 0
    machine = _get(db, "machines", assignment["machine_id"])
    queue = get_queue(db, user, assignment["queue_id"])
    overrides = {o["test_id"]: o for o in db.all("SELECT * FROM assignment_overrides WHERE assignment_id = ?", (assignment_id,))}
    selection = json.loads(assignment.get("test_selection") or "{}")
    base_ids = {item["test_id"] for item in queue["items"]}
    added_ids = [tid for tid in selection.get("added", []) if tid not in base_ids]
    all_items = []
    for item in queue["items"] + [{"test_id": tid} for tid in added_ids]:
        test = _get(db, "tests", item["test_id"])
        override = overrides.get(test["id"])
        # last_text: newest by qa_date then numeric run id. Known difference, kept until a physicist chooses the rule:
        # local-backend.js compares the (qa_date + run id) strings, so same-date runs 9999 and 10000 can disagree.
        all_items.append({
            "excluded": test["id"] in selection.get("excluded", []) or (machine['name'] in ('GTR1','GTR2') and 'PBS DailyQA' in queue['name'] and (test['name'].startswith('[OBs]') or "OB's DR image" in test['name'])), "machine_only": test["id"] not in base_ids,
            "test_id": test["id"], "name": test["name"], "category": test["category"], "type": test["type"],
            "unit": test["unit"], "description": test["description"],
            "limits": qa.resolve_limits(test, item, override),
            "queue_limits": qa.resolve_limits(test, item),
            "override": {k: override[k] for k in ("expected", "warn", "fail", "tol_mode")} if override else None,
            "last_text": (db.one("SELECT res.value_text FROM results res JOIN runs r ON r.id = res.run_id WHERE r.trashed_at IS NULL AND res.test_id = ? AND r.machine_id = ? AND res.value_text <> '' "
                                 "ORDER BY r.qa_date DESC, r.id DESC LIMIT 1", (test["id"], machine["id"])) or {}).get("value_text") if test["type"] == "text" else None,
        })
    assignment["schedule"] = qa.describe_schedule(assignment)
    return {"assignment": assignment, "machine": machine, "queue": {"id": queue["id"], "name": queue["name"], "description": queue["description"], "active": queue["active"], "import_blocks": queue.get("import_blocks",[])}, "items": [i for i in all_items if not i["excluded"]], "all_items": all_items, "test_selection": selection}


def save_overrides(db, user, assignment_id, data):
    """Per-machine tweaks to a queue's limits. Blank fields fall back to the queue."""
    require(user, "configure")
    _get(db, "assignments", assignment_id)
    rows = []
    for item in data.get("overrides") or []:
        limits = _limits(item, allow_blank_mode=True)
        if any(v is not None for v in limits.values()):
            rows.append((int(item["test_id"]), limits))
    with db.transaction():
        db.run("DELETE FROM assignment_overrides WHERE assignment_id = ?", (assignment_id,))
        for test_id, limits in rows:
            db.run("INSERT INTO assignment_overrides (assignment_id, test_id, expected, warn, fail, tol_mode) VALUES (?, ?, ?, ?, ?, ?)",
                   (assignment_id, test_id, limits["expected"], limits["warn"], limits["fail"], limits["tol_mode"]))
        db.audit(user["id"], "update", "overrides", assignment_id, overrides={t: l for t, l in rows})
    return {"ok": True}


# ---- dashboard ---------------------------------------------------------------

def dashboard(db, user, today=None):
    today = today or date.today()
    machines = []
    for machine in db.all("SELECT * FROM machines WHERE active = 1 ORDER BY name"):
        queues = [a for a in list_assignments(db, user, machine["id"], today) if a["active"]]
        for a in queues:
            last = db.one("SELECT id, overall, review_status, qa_date FROM runs WHERE trashed_at IS NULL AND assignment_id = ? ORDER BY qa_date DESC, id DESC LIMIT 1", (a["id"],))
            a["last_run"] = last
            a['history_counts']={r['status']:r['n'] for r in db.all('SELECT res.status,COUNT(*) AS n FROM results res JOIN runs r ON r.id=res.run_id WHERE r.trashed_at IS NULL AND r.assignment_id=? GROUP BY res.status',(a['id'],))}
        machine["queues"] = queues
        machine['history_counts']={r['status']:r['n'] for r in db.all('SELECT res.status,COUNT(*) AS n FROM results res JOIN runs r ON r.id=res.run_id WHERE r.trashed_at IS NULL AND r.machine_id=? GROUP BY res.status',(machine['id'],))}
        machine["pending_review"] = sum(_review_ready(db,r) for r in db.all("SELECT * FROM runs WHERE trashed_at IS NULL AND machine_id=? AND review_status='pending'",(machine["id"],)))
        machines.append(machine)
    return {"today": today.isoformat(), "machines": machines}


# ---- runs --------------------------------------------------------------------

def submit_run(db, user, assignment_id, data):
    require(user, "perform")
    template = run_template(db, user, assignment_id)
    if not template["assignment"]["active"] or not template["machine"]["active"] or not template["queue"]["active"]:
        raise PortalError("This queue is not active on this machine.")
    try:
        qa_date = date.fromisoformat(data.get("qa_date") or date.today().isoformat())
    except ValueError:
        raise PortalError("QA date must be YYYY-MM-DD.")
    if qa_date > date.today():
        raise PortalError("QA date cannot be in the future.")
    entered = {int(r["test_id"]): r for r in data.get("results") or []}
    results = []
    prior=[]
    computed={}
    for item in template["items"]:
        raw = entered.get(item["test_id"], {})
        value = raw.get("value")
        try:
            rule=derived.read(item.get('description'))
            if rule:value=derived.calculate(rule,prior,lambda x:computed.get(x['test_id']))
        except (ValueError,TypeError,SyntaxError) as exc:raise PortalError(f"{item['name']}: {exc}")
        prior.append(item)
        computed[item['test_id']]=value
        if value is None or (isinstance(value, str) and not value.strip()):
            if item["type"] != "text":
                results.append((item, None, "recorded", _text(raw, "comment")))
            continue
        if item["type"] == "numeric":
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise PortalError(f"{item['name']}: enter a number.")
        elif item["type"] == "boolean":
            value = value in (True, 1, "1", "true", "pass", "yes")
        elif item["type"] == "choice":
            value=str(value)
            if value not in choice_options(item.get('description')):
                raise PortalError(f"{item['name']}: choose an available answer.")
        elif item["type"] == "status":
            value = STATUS_WORDS.get(str(value).strip().lower())
            if value is None:
                raise PortalError(f"{item['name']}: choose Pass, Warning, or Fail.")
        else:
            value = str(value)
        try:
            status = qa.evaluate(item["type"], value, item["limits"])
        except ValueError as exc:
            raise PortalError(f"{item['name']}: {exc}")
        results.append((item, value, status, _text(raw, "comment")))
    source_ref = _text(data, "source_ref") or None
    _check_not_imported(db, source_ref)
    rows = [{"test_id": item["test_id"], "value_num": float(value) if value is not None and item["type"] in ("numeric", "boolean") else None,
             "value_text": value if item["type"] in ("text", "status", "choice") else None, "limits": item["limits"], "status": status, "comment": comment}
            for item, value, status, comment in results]
    # clear_draft: true (the QA form's Submit) clears this person's draft of the list in the same transaction, instead of a
    # second request (POST .../draft/clear) after it; draft_cleared says so. Without it nothing else changes.
    return _insert_run(db, user, template, qa_date.isoformat(), rows, _text(data, "comment"),
                       "hdr-pdf" if source_ref and source_ref.startswith("hdrpdf:") else "sphinx" if source_ref else "manual", source_ref, "pending",
                       clear_draft=data.get("clear_draft") is True)


def _check_not_imported(db, source_ref):
    if source_ref:
        existing = db.one("SELECT id, qa_date FROM runs WHERE source_ref = ?", (source_ref,))
        if existing:
            raise PortalError(f"This Sphinx file was already recorded as run #{existing['id']} ({existing['qa_date']}).")


def needs_therapist_approval(template):
    import re
    return any(re.search(r'therapist', item.get('name', ''), re.I) and re.search(r'review|approv', item.get('name', ''), re.I)
               or '[approval: therapist]' in item.get('description', '').lower() for item in template['items'])


def _results_overall(rows):
    rows = list(rows)
    verdict = qa.overall(r["status"] for r in rows) if rows else "recorded"
    if verdict == "pass" and any(r["value_num"] is None and r["value_text"] is None for r in rows):
        return "recorded"
    return verdict


def _insert_run(db, user, template, qa_date, rows, comment, source, source_ref, review_status, clear_draft=False):
    result_overall = _results_overall(rows)
    with db.transaction():
        run_id = db.run(
            "INSERT INTO runs (assignment_id, machine_id, queue_id, performed_by, performed_at, qa_date, overall, comment, source, "
            "source_ref, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (template["assignment"]["id"], template["machine"]["id"], template["queue"]["id"], user["id"], now(), qa_date,
             result_overall, comment, source, source_ref, review_status))
        if review_status == 'pending' and needs_therapist_approval(template):
            db.run('UPDATE runs SET therapist_approval_required=1 WHERE id=?', (run_id,))
        for r in rows:
            limits = r["limits"]
            db.run("INSERT INTO results (run_id, test_id, value_num, value_text, expected, warn, fail, tol_mode, status, comment) "
                   "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (run_id, r["test_id"], r["value_num"], r["value_text"], limits["expected"], limits["warn"], limits["fail"],
                    limits["tol_mode"], r["status"], r["comment"]))
        db.audit(user["id"], "import" if review_status == "imported" else "submit", "run", run_id,
                 machine=template["machine"]["name"], queue=template["queue"]["name"], overall=result_overall, source=source)
        if clear_draft:   # delete_draft's statement, in this transaction: the run and the cleared draft commit together
            db.run("DELETE FROM drafts WHERE assignment_id = ? AND user_id = ?", (template["assignment"]["id"], user["id"]))
    return {"id": run_id, "overall": result_overall, **({"draft_cleared": True} if clear_draft else {})}


# ---- Sphinx exports ------------------------------------------------------------

SPHINX_STATUS = {"Passed": "pass", "Warning": "warn", "Failed": "fail"}


def _parse_sphinx(name, data):
    try:
        parsed = winston_lutz.parse_file(data, name) if name.lower().endswith(".pdf") else sphinx.parse_file(data, name)
        parsed["sha256"] = hashlib.sha256(data).hexdigest()
        return parsed
    except (sphinx.SphinxError, ValueError, ImportError) as exc:
        raise PortalError(f"{name}: {exc}")


def _decode_upload(upload):
    try:
        return upload.get("name") or "upload.xls", base64.b64decode(upload.get("data") or "", validate=True)
    except (binascii.Error, ValueError):
        raise PortalError("The uploaded file could not be read.")


def _file_limits(m):
    return {"expected": m["expected"], "warn": m["warn"], "fail": m["fail"], "tol_mode": m["tol_mode"], **({"criterion":m["criterion"]} if m.get("criterion") else {})}


def _sphinx_test_ids(db, user, template, measurements, create):
    """Map each measurement to a test in this queue, adding library tests and queue items if allowed."""
    excluded = [i for i in template.get("all_items", []) if i.get("excluded")]
    excluded_keys = {(i["category"], i["name"]) for i in excluded}
    excluded_meanings = {sphinx.canonical_key(i["name"]) for i in excluded if sphinx.canonical_key(i["name"])}
    in_queue = {(i["category"], i["name"]): i["test_id"] for i in template["items"]}
    by_meaning = {sphinx.canonical_key(i["name"]): i["test_id"] for i in template["items"] if sphinx.canonical_key(i["name"])}
    ids, added = {}, []
    uniform=sphinx.is_pbs_template(template["queue"]["name"])
    for m in measurements:
        key = (m["category"], m["name"])
        if key in excluded_keys or sphinx.canonical_key(m["name"]) in excluded_meanings:
            continue
        if uniform and key not in in_queue:
            equivalent=sphinx.template_match(template['items'],m['name'])
            if equivalent: in_queue[key]=equivalent['test_id']
        if key not in in_queue and sphinx.canonical_key(m["name"]) in by_meaning:
            in_queue[key] = by_meaning[sphinx.canonical_key(m["name"])]  # same measurement under the list's own wording
        if key in in_queue:
            ids[key] = in_queue[key]
            continue
        if not create or uniform:
            continue
        require(user, "configure")
        queue_id = template["queue"]["id"]
        # Each QA list owns its checks, so the file's limits go straight onto this list's own copy.
        test = db.one("SELECT id FROM tests WHERE owner_queue_id = ? AND category = ? AND name = ?", (queue_id,) + key)
        test_id = test["id"] if test else save_test(db, user, {
            "category": m["category"], "name": m["name"], "unit": m["unit"], **_file_limits(m), "owner_queue_id": queue_id,
            "description": f"Measured by Sphinx. Export label: {m['sphinx_label']}."})["id"]
        assignment = _get(db, "assignments", template["assignment"]["id"])
        selection = json.loads(assignment.get("test_selection") or "{}")
        selection["added"] = list(dict.fromkeys(selection.get("added", []) + [test_id]))
        db.run("UPDATE assignments SET test_selection = ? WHERE id = ?", (json.dumps(selection), assignment["id"]))
        ids[key] = in_queue[key] = test_id
        added.append(m["name"])
    if added:
        db.audit(user["id"], "add_sphinx_tests", "queue", template["queue"]["id"], tests=added)
    return ids, added


def sphinx_preview(db, user, assignment_id, upload):
    """Match one Sphinx file to the queue so the entry form can be filled in."""
    require(user, "perform")
    name, data = _decode_upload(upload)
    parsed = _parse_sphinx(name, data)
    template = run_template(db, user, assignment_id)
    if name.lower().endswith(".pdf") and not any("[rule: wl-max-delta]" in (i.get("description") or "") for i in template["items"]):
        raise PortalError("Choose the SRS Winston-Lutz QA list for this PDF.")
    if re.search("truebeam", name, re.I) and "truebeam" not in template["machine"]["name"].lower():
        raise PortalError("The filename identifies TrueBeam. Choose the TrueBeam machine.")
    items = {(i["category"], i["name"]): i for i in template["items"]}
    by_meaning = {sphinx.canonical_key(i["name"]): i for i in template["items"] if sphinx.canonical_key(i["name"])}
    excluded = [i for i in template.get("all_items", []) if i.get("excluded")]
    excluded_keys = {(i["category"], i["name"]) for i in excluded}
    excluded_meanings = {sphinx.canonical_key(i["name"]) for i in excluded if sphinx.canonical_key(i["name"])}
    matched, unmatched = [], []
    for m in parsed["measurements"]:
        if (m["category"], m["name"]) in excluded_keys or sphinx.canonical_key(m["name"]) in excluded_meanings:
            continue
        item = items.get((m["category"], m["name"])) or by_meaning.get(sphinx.canonical_key(m["name"]))
        if not item and sphinx.is_pbs_template(template['queue']['name']):
            item=sphinx.template_match(template['items'],m['name'])
        if not item:
            if sphinx.is_pbs_template(template["queue"]["name"]): continue
            unmatched.append(m)
            continue
        file_limits = _file_limits(m)
        differs = any(item["limits"].get(k) != file_limits[k] for k in file_limits)
        matched.append({"test_id": item["test_id"], "value": m["result"], "sphinx_status": m["sphinx_status"],
                        "file_limits": file_limits, "limits_differ": differs})
    duplicate = db.one("SELECT id FROM runs WHERE source_ref = ?", (parsed["sha256"],))
    return {"filename": name, "qa_date": parsed["qa_date"], "finished": parsed["finished"], "sphinx_user": parsed["sphinx_user"],
            "report_machine": parsed.get("report_machine", ""), "source_ref": parsed["sha256"], "duplicate_run": duplicate["id"] if duplicate else None,
            "matched": matched, "unmatched": [{"category": m["category"], "name": m["name"], "unit": m["unit"]} for m in unmatched]}


def sphinx_add_tests(db, user, assignment_id, upload):
    require(user, "configure")
    name, data = _decode_upload(upload)
    parsed = _parse_sphinx(name, data)
    _, added = _sphinx_test_ids(db, user, run_template(db, user, assignment_id), parsed["measurements"], create=True)
    return {"added": added}


def import_sphinx(db, user, assignment_id, files, historical=True, history_before=None):
    """Record Sphinx files as runs. New runs (historical=False, awaiting review) are judged by the list's limits;
    history (historical=True) keeps the limits and verdict from its own file. With history_before ('YYYY-MM-DD'),
    each file dated before it is history and each file on or after it awaits review; historical is then ignored.

    files: iterable of (filename, bytes). Duplicate files (same content) are skipped.
    """
    require(user, "configure")
    template = run_template(db, user, assignment_id)
    imported, skipped = [], []
    for name, data in files:
        try:
            parsed = _parse_sphinx(name, data)
            _check_not_imported(db, parsed["sha256"])
            if name.lower().endswith('.pdf'):
                if not any('[rule: wl-max-delta]' in (i.get('description') or '') for i in template['items']):
                    raise PortalError('Choose the SRS Winston-Lutz QA list for this PDF.')
                if re.search('truebeam',name,re.I) and 'truebeam' not in template['machine']['name'].lower():
                    raise PortalError('The filename identifies TrueBeam. Choose the TrueBeam machine.')
            ids, added = _sphinx_test_ids(db, user, template, parsed["measurements"], create=True)
        except PortalError as exc:
            skipped.append({"file": name, "reason": str(exc).removeprefix(f"{name}: ")})
            continue
        if added:
            template = run_template(db, user, assignment_id)
        list_items = {i["test_id"]: i for i in template["items"]}
        as_history = parsed["qa_date"] < history_before if history_before else historical
        rows = []
        for m in parsed["measurements"]:
            if (m["category"], m["name"]) not in ids:
                continue
            test_id = ids[(m["category"], m["name"])]
            # New results are judged by the list's limits, as when the QA is done on the form; the file's own verdict
            # is noted when it differs. Old files brought in as history keep the limits and verdict written in them.
            limits = _file_limits(m) if as_history or test_id not in list_items else list_items[test_id]["limits"]
            try:
                ours = qa.evaluate("numeric", m["result"], limits)
            except ValueError:
                ours = "recorded"
            sphinx_verdict = SPHINX_STATUS.get(m["sphinx_status"])
            if as_history:
                status = sphinx_verdict or ours
                note = f"Sphinx: {m['sphinx_status']}; portal rule on the rounded values gives {ours}." if status != ours else ""
            else:
                status = ours
                note = f"Sphinx: {m['sphinx_status']}; judged by this list's limits." if sphinx_verdict and sphinx_verdict != ours else ""
            rows.append({"test_id": test_id, "value_num": m["result"], "value_text": None,
                         "limits": limits, "status": status, "comment": note})
        if not rows:
            skipped.append({"file": name, "reason": "No included tests match this machine's list."})
            continue
        comment = f"Imported from {name}. Sphinx finished {parsed['finished'].replace('T', ' ')}" + \
                  (f" by {parsed['sphinx_user']}." if parsed["sphinx_user"] else ".")
        run = _insert_run(db, user, template, parsed["qa_date"], rows, comment, "sphinx", parsed["sha256"],
                          "imported" if as_history else "pending")
        imported.append({"file": name, "run_id": run["id"], "qa_date": parsed["qa_date"], "overall": run["overall"]})
    return {"imported": imported, "skipped": skipped}


def import_checklist(db, user, queue_id, parsed):
    """Add a myQA template's manual checks to a queue (tests are created in the library if missing)."""
    require(user, "configure")
    queue = _get(db, "queues", queue_id)
    in_queue = {r["test_id"] for r in db.all("SELECT test_id FROM queue_items WHERE queue_id = ?", (queue_id,))}
    added = []
    for spec in checklist.to_tests(parsed):
        test = db.one("SELECT id FROM tests WHERE owner_queue_id = ? AND category = ? AND name = ?", (queue_id, spec["category"], spec["name"]))
        test_id = test["id"] if test else save_test(db, user, {**spec, "owner_queue_id": queue_id})["id"]
        if test_id in in_queue:
            continue
        position = db.one("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM queue_items WHERE queue_id = ?", (queue_id,))["p"]
        db.run("INSERT INTO queue_items (queue_id, test_id, position) VALUES (?, ?, ?)", (queue_id, test_id, position))
        in_queue.add(test_id)
        added.append(spec["name"])
    if parsed.get("setup") and not queue["description"]:
        db.run("UPDATE queues SET description = ? WHERE id = ?", (parsed["setup"], queue_id))
    db.audit(user["id"], "add_checklist", "queue", queue_id, tests=added)
    return {"added": added}


def _iso_day(value, key):
    """A day written YYYY-MM-DD in ASCII digits that is on the calendar; the same rule and words as local-backend.js isoDay."""
    if isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            pass
    raise PortalError(f"{key}: give a date as YYYY-MM-DD.")


def _optional_row(db, data, key, table, missing):
    """An optional id in a request body: absent or null means none; anything else must be a whole number naming a row
    (JSON 3.0 counts as 3, as it does in JavaScript)."""
    value = data.get(key)
    if value is None:
        return None
    whole = (isinstance(value, int) and not isinstance(value, bool)) or (isinstance(value, float) and value.is_integer())
    row = db.one(f"SELECT * FROM {table} WHERE id = ?", (int(value),)) if whole and 0 < value <= 2 ** 53 - 1 else None
    if not row:
        raise PortalError(missing, 404)
    return row


def import_sphinx_uploads(db, user, assignment_id, data):
    require(user, "configure")
    history_before = None if data.get("history_before") is None else _iso_day(data.get("history_before"), "history_before")
    files = [_decode_upload(u) for u in data.get("files") or []]
    if not files:
        raise PortalError("Choose one or more Sphinx .xls files.")
    return import_sphinx(db, user, assignment_id, files, historical=bool(data.get("historical", True)), history_before=history_before)


# The note a Sphinx file import writes: "Imported from <file>. Sphinx finished <date> <time>…" (import_sphinx), or
# "Imported from <file>.xls/.csv/.pdf" and nothing more (the browser folder import, which sends each file through the
# form). The same pattern as local-backend.js IMPORT_NOTE.
_IMPORT_NOTE = re.compile(r"Imported from [^\n]+(\. Sphinx finished [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}"
                          r"|\.([Xx][Ll][Ss]|[Cc][Ss][Vv]|[Pp][Dd][Ff])\Z)")


def _imported_from_file(run):
    """A run made by a Sphinx file import, known by the note the import writes. A run performed on the Perform form keeps
    the note the person typed, so it is not chosen, even when a file filled it in."""
    return run["source"] == "sphinx" and bool(_IMPORT_NOTE.match(run["comment"] or ""))


def record_history(db, user, data):
    """Past Sphinx imports still waiting for review become history, as if imported as history in the first place:
    results, limits, verdicts, comments and any therapist sign-off stay as they are. Mirrors local-backend.js recordHistory.

    data: until 'YYYY-MM-DD' (required, QA dates up to and including it), machine_id, assignment_id, dry_run.
    A dry run returns {count, runs} and changes nothing; otherwise {count}, with one audit entry per run."""
    require(user, "review")
    until = _iso_day(data.get("until"), "until")
    machine = _optional_row(db, data, "machine_id", "machines", "Machine not found.")
    assignment = _optional_row(db, data, "assignment_id", "assignments", "Schedule not found.")
    dry_run = data.get("dry_run")
    if dry_run is not None and not isinstance(dry_run, bool):
        raise PortalError("dry_run: give true or false.")
    if machine and assignment and assignment["machine_id"] != machine["id"]:
        raise PortalError("That schedule is not on that machine.")
    clauses, params = ["trashed_at IS NULL", "review_status = 'pending'", "source = 'sphinx'", "qa_date <= ?"], [until]
    for key, row in (("machine_id", machine), ("assignment_id", assignment)):
        if row:
            clauses.append(f"{key} = ?")
            params.append(row["id"])
    with db.transaction():
        runs = [r for r in db.all("SELECT * FROM runs WHERE " + " AND ".join(clauses) + " ORDER BY id", params) if _imported_from_file(r)]
        if dry_run:
            return {"count": len(runs), "runs": [r["id"] for r in runs]}
        for r in runs:
            previous = {"review_status": r["review_status"], "therapist_approval_required": bool(r["therapist_approval_required"]),
                        "therapist_approved_by": r["therapist_approved_by"], "therapist_approved_at": r["therapist_approved_at"]}
            db.run("UPDATE runs SET review_status = 'imported', therapist_approval_required = 0 WHERE id = ?", (r["id"],))
            db.audit(user["id"], "record_history", "run", r["id"], previous=previous, until=until)
    return {"count": len(runs)}


_RUN_SELECT = ("SELECT r.*, m.name AS machine_name, q.name AS queue_name, pu.full_name AS performer_name, pu.username AS performer, "
               "ru.full_name AS reviewer_name, ru.username AS reviewer FROM runs r JOIN machines m ON m.id = r.machine_id "
               "JOIN queues q ON q.id = r.queue_id JOIN users pu ON pu.id = r.performed_by LEFT JOIN users ru ON ru.id = r.reviewed_by ")


def _pbs_therapist_results(db, run):
    queue=db.one('SELECT name FROM queues WHERE id=?',(run['queue_id'],))
    if not queue or not re.search(r'PBS\s*Daily\s*QA.*Sphinx',queue['name'],re.I):
        return None
    return db.all("SELECT res.* FROM results res JOIN tests t ON t.id=res.test_id WHERE res.run_id=? AND (lower(trim(t.name))='qa reviewed by therapist?' OR t.description LIKE '%Template 4.06.%')",(run['id'],))


def _review_ready(db, run):
    checks=_pbs_therapist_results(db,run)
    if run.get('trashed_at') or run.get('therapist_approval_required') and not run.get('therapist_approved_by'): return False
    return checks is None or bool(checks) and all(r['status']=='pass' for r in checks)


def list_runs(db, user, filters):
    clauses, params = ["r.trashed_at IS NOT NULL" if str(filters.get('trashed',''))=='1' else "r.trashed_at IS NULL"], []
    for key in ("machine_id", "queue_id"):
        if filters.get(key):
            clauses.append(f"r.{key} = ?")
            params.append(int(filters[key]))
    if filters.get("review_status"):
        clauses.append("r.review_status = ?")
        params.append(filters["review_status"])
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    limit = min(int(filters.get("limit") or 200), 1000)
    runs=db.all(_RUN_SELECT + where + " ORDER BY r.qa_date DESC, r.id DESC", params)
    for run in runs: run['review_ready']=_review_ready(db,run)
    if filters.get('review_status')=='pending':runs=[r for r in runs if r['review_ready']]
    return runs[:limit]


def get_run(db, user, run_id):
    run = db.one(_RUN_SELECT + "WHERE r.id = ?", (run_id,))
    if not run:
        raise PortalError("Run not found.", 404)
    run['review_ready']=_review_ready(db,run)
    signer = db.one('SELECT username, full_name FROM users WHERE id=?', (run['therapist_approved_by'],)) if run['therapist_approved_by'] else None
    run['therapist_approver_name'] = (signer['full_name'] or signer['username']) if signer else None
    run["results"] = db.all("SELECT res.*, t.name, t.category, t.type, t.unit, t.description FROM results res JOIN tests t ON t.id = res.test_id "
                            "WHERE res.run_id = ? ORDER BY res.id", (run_id,))
    return run


def trash_run(db, user, run_id, data):
    run=_get(db,'runs',run_id)
    if not (auth.can(user,'review') or auth.can(user,'therapist_approve') or auth.can(user,'perform') and run['performed_by']==user['id'] and run['review_status']=='pending'):
        raise PortalError('Only a reviewer, therapist, or the performer of an unreviewed submission can move this QA to trash.',403)
    trashed=data.get('trashed',True) is not False
    reason=_text(data,'reason') or 'Created in error'
    with db.transaction():
        db.run('UPDATE runs SET trashed_at=?,trashed_by=?,trash_reason=? WHERE id=?',(now() if trashed else None,user['id'] if trashed else None,reason if trashed else None,run_id))
        db.audit(user['id'],'trash_run' if trashed else 'restore_run','run',run_id,reason=reason)
    return {'ok':True}


def therapist_approve_run(db, user, run_id):
    require(user, 'therapist_approve')
    with db.transaction():
        run = _get(db, 'runs', run_id)
        if run.get('trashed_at') or run['review_status'] != 'pending' or not run['therapist_approval_required']:
            raise PortalError('This run is not waiting for therapist approval.')
        if run['therapist_approved_by']:
            raise PortalError('Therapist approval is already recorded.')
        db.run('UPDATE runs SET therapist_approved_by=?, therapist_approved_at=? WHERE id=?', (user['id'],now(),run_id))
        checks=_pbs_therapist_results(db,run)
        if checks:
            for row in checks:db.run("UPDATE results SET value_num=1,value_text=NULL,status='pass' WHERE id=?",(row['id'],))
            rows=db.all('SELECT status,value_num,value_text FROM results WHERE run_id=?',(run_id,))
            db.run('UPDATE runs SET overall=? WHERE id=?',(_results_overall(rows),run_id))
        db.audit(user['id'],'therapist_approved','run',run_id)
    return {'ok': True}


def set_therapist_review(db,user,run_id,data):
    require(user,'therapist_approve')
    decision=data.get('decision')
    if decision not in ('pass','fail','clear'):raise PortalError('Choose Pass, Fail or Clear.')
    with db.transaction():
        run=_get(db,'runs',run_id)
        if run.get('trashed_at') or not run['therapist_approval_required'] or decision=='clear' and run['review_status']!='pending':
            raise PortalError('Therapist review can be changed only before physicist review.')
        checks=_pbs_therapist_results(db,run)
        if checks is None:checks=db.all("SELECT res.* FROM results res JOIN tests t ON t.id=res.test_id WHERE res.run_id=? AND lower(trim(t.name))='qa reviewed by therapist?'",(run_id,))
        if not checks:raise PortalError('This QA has no therapist review test to change.')
        previous={'approved_by':run['therapist_approved_by'],'approved_at':run['therapist_approved_at'],'physics':{k:run.get(k) for k in ('review_status','reviewed_by','reviewed_at','review_comment')},'results':[{'test_id':r['test_id'],'status':r['status'],'value':r['value_num']} for r in checks]}
        if decision=='pass' and run['therapist_approved_by'] and all(r['status']=='pass' for r in checks):return {'ok':True}
        if run['review_status']!='pending':
            db.run("UPDATE runs SET review_status='pending',reviewed_by=NULL,reviewed_at=NULL,review_comment='' WHERE id=?",(run_id,))
        value=1 if decision=='pass' else 0 if decision=='fail' else None
        status='recorded' if decision=='clear' else decision
        for row in checks:db.run('UPDATE results SET value_num=?,value_text=NULL,status=? WHERE id=?',(value,status,row['id']))
        rows=db.all('SELECT status,value_num,value_text FROM results WHERE run_id=?',(run_id,))
        db.run('UPDATE runs SET therapist_approved_by=?,therapist_approved_at=?,overall=? WHERE id=?',(user['id'] if decision=='pass' else None,now() if decision=='pass' else None,_results_overall(rows),run_id))
        db.audit(user['id'],'change_therapist_review','run',run_id,previous=previous,decision=decision)
    return {'ok':True}


def unapprove_therapist_review(db,user,run_id):
    require(user,'therapist_approve')
    with db.transaction():
        run=_get(db,'runs',run_id)
        if run.get('trashed_at') or not run['therapist_approved_by']:
            raise PortalError('This QA has no therapist approval to undo.')
        # A run recorded as history keeps its sign-off but no longer asks for one; as in set_therapist_review, it stays as it is.
        if not run['therapist_approval_required']:
            raise PortalError('Therapist review can be changed only before physicist review.')
        previous={k:run.get(k) for k in ('therapist_approved_by','therapist_approved_at','review_status','reviewed_by','reviewed_at','review_comment')}
        checks=_pbs_therapist_results(db,run)
        if checks is None:checks=db.all("SELECT res.* FROM results res JOIN tests t ON t.id=res.test_id WHERE res.run_id=? AND lower(trim(t.name))='qa reviewed by therapist?'",(run_id,))
        previous['results']=[{'test_id':r['test_id'],'value':r['value_num'],'status':r['status']} for r in checks]
        for row in checks:db.run("UPDATE results SET value_num=NULL,value_text=NULL,status='recorded' WHERE id=?",(row['id'],))
        rows=db.all('SELECT status,value_num,value_text FROM results WHERE run_id=?',(run_id,))
        db.run("UPDATE runs SET therapist_approved_by=NULL,therapist_approved_at=NULL,review_status='pending',reviewed_by=NULL,reviewed_at=NULL,review_comment='',overall=? WHERE id=?",(_results_overall(rows),run_id))
        db.audit(user['id'],'unapprove_therapist_review','run',run_id,previous=previous,physics_approval_cleared=run['review_status']=='approved')
    return {'ok':True}


def unapprove_physics_review(db,user,run_id):
    require(user,'review')
    if user['role']!='physicist':raise PortalError('Only a physicist can undo physics approval.',403)
    with db.transaction():
        run=_get(db,'runs',run_id)
        if run.get('trashed_at') or run['review_status']!='approved':raise PortalError('This QA has no physics approval to undo.')
        previous={k:run.get(k) for k in ('review_status','reviewed_by','reviewed_at','review_comment')}
        db.run("UPDATE runs SET review_status='pending',reviewed_by=NULL,reviewed_at=NULL,review_comment='' WHERE id=?",(run_id,))
        db.audit(user['id'],'unapprove_physics_review','run',run_id,previous=previous)
    return {'ok':True}


def review_run(db, user, run_id, data):
    with db.transaction():
        require(user, "review")
        run = _get(db, "runs", run_id)
        if not _review_ready(db,run):
            raise PortalError("Therapist approval with test 4.06 marked Pass is required before physicist review.")
        if run['therapist_approval_required']:
            if not run['therapist_approved_by']:
                raise PortalError('Therapist approval is required before medical physicist review.')
            if user['role'] != 'physicist':
                raise PortalError('This run requires review by a medical physicist.')
        decision = data.get("decision")
        if decision not in ("approved", "rejected"):
            raise PortalError("Decision must be approve or reject.")
        if run["review_status"] != "pending":
            raise PortalError("This run has already been reviewed.")
        if run["performed_by"] == user["id"]:
            raise PortalError("Runs must be reviewed by someone other than the person who performed them.")
        comment = _text(data, "comment")
        db.run("UPDATE runs SET review_status = ?, reviewed_by = ?, reviewed_at = ?, review_comment = ? WHERE id = ?",
               (decision, user["id"], now(), comment, run_id))
        db.audit(user["id"], decision, "run", run_id, comment=comment)
        return {"ok": True}

def _history_key(test):
    semantic=sphinx.canonical_key(test['name']) if test['type']=='numeric' else None
    return (test['type'],test.get('unit') or '',semantic or (test.get('category') or '')+'|'+test['name'].lower().strip())


def trend(db, user, machine_id, test_id):
    test=_get(db,'tests',test_id)
    return {'test':test,'points':machine_trends(db,user,machine_id,tests={int(test_id)}).get(str(test_id),[])}


def trend_window(q):
    """Optional window on machine_trends, as in local-backend.js trendWindow. With none given the whole history comes
    back in one reply. tests: only these tests' series (each still built from every test that shares its history key);
    until: only QA dates up to this one; from (returned as since): only QA dates from this one on; last: the newest N
    points of each series. page: the same answer in parts (trend_page); Machine Trends and the CSV export use it
    (app.js machineHistory). The PDF report and a saved run's quick trend do not read this endpoint's whole history."""
    def given(name):
        v=q.get(name)
        return v is not None and v!=''
    def whole(text):
        # ASCII digits only, as local-backend.js trendWindow does (float() and \d would also take '1_0' or other scripts' digits).
        return int(text) if re.fullmatch(r'[0-9]+',str(text)) else None
    window={}
    if given('tests'):
        ids=[whole(x) for x in str(q['tests']).split(',')]
        if any(n is None or n<1 for n in ids): raise PortalError('tests: give test ids separated by commas.')
        window['tests']=set(ids)
    if given('last'):
        n=whole(q['last'])
        if n is None or n<1: raise PortalError('last: give a whole number of points, 1 or more.')
        window['last']=n
    if given('until'):
        if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}',str(q['until'])): raise PortalError('until: give a date as YYYY-MM-DD.')
        window['until']=str(q['until'])
    if given('from'):
        if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}',str(q['from'])): raise PortalError('from: give a date as YYYY-MM-DD.')
        window['since']=str(q['from'])
    if given('page'):
        if str(q['page'])!='start' and not _TREND_CURSOR.fullmatch(str(q['page'])):
            raise PortalError('page: give start, or the next value from the previous page.')
        if window.get('last'): raise PortalError('page: cannot be combined with last.')
        window['page']=str(q['page'])
    return window


# A paged reply holds whole points until the next one would take its JSON (compact, UTF-8, measured as local-backend.js
# JSON.stringify writes it, so both servers split the same answer at the same points) past this many bytes; it always
# holds at least one, so paging always moves on. On the site the reply goes back through a Lambda (synchronous response
# limit recalled as 6 MB; check AWS quotas), whose wrapping adds to it, so the budget is well under half of that.
TREND_PAGE_BYTES=2500000
# Cursor: how many points of the answer, in the order trend_page sends them, the earlier parts held (a whole number from
# 1, ASCII digits), as in local-backend.js. It counts places, not stored values; the token tells the caller when they changed.
_TREND_CURSOR=re.compile(r'[1-9][0-9]{0,14}')
_POINT_KEYS=('source_test_id','source_test_number','run_id','source','source_order','assignment_id','qa_date','value','expected','warn','fail','tol_mode','status')


def _js_number(v):
    """A float as JavaScript's JSON.stringify writes it (shortest round-trip digits, JavaScript's exponent rules)."""
    if v!=v or v in (float('inf'),float('-inf')): return 'null'
    if v==0: return '0'
    text=repr(v);sign=''
    if text[0]=='-': sign,text='-',text[1:]
    mantissa,_,exponent=text.partition('e');whole,_,fraction=mantissa.partition('.')
    every=whole+fraction;digits=every.lstrip('0')
    n=len(whole)+int(exponent or 0)-(len(every)-len(digits))   # value = 0.<digits> x 10^n
    digits=digits.rstrip('0');k=len(digits)
    if k<=n<=21: out=digits+'0'*(n-k)
    elif 0<n<=21: out=digits[:n]+'.'+digits[n:]
    elif -6<n<=0: out='0.'+'0'*(-n)+digits
    else:
        e=n-1;out=digits[0]+('.'+digits[1:] if k>1 else '')+'e'+('+' if e>=0 else '-')+str(abs(e))
    return sign+out


def _js_json(v):
    if v is None: return 'null'
    if v is True: return 'true'
    if v is False: return 'false'
    if isinstance(v,int): return str(v)
    if isinstance(v,float): return _js_number(v)
    return json.dumps(v,ensure_ascii=False,separators=(',',':'),default=str)


def _point_bytes(p):
    """Size of one point's JSON as local-backend.js writes it (compact, UTF-8); key order does not change the size."""
    text='{'+','.join(f'"{k}":{_js_json(p[k])}' for k in _POINT_KEYS)+'}'
    return len(text) if text.isascii() else len(text.encode('utf-8'))


_point_key=itemgetter('qa_date','run_id','source_order')   # (p['qa_date'], p['run_id'], p['source_order'])


# A point's JSON exactly as the reply writes it (json.dumps(reply, default=str): spaces after ',' and ':', \uXXXX escapes).
_REPLY_JSON=json.JSONEncoder(default=str).encode


def _point_size(p, text):
    """_point_bytes(p), worked out quickly from text, p as _REPLY_JSON writes it. JavaScript's compact JSON has no space
    after ',' and ':' and writes a float without a final '.0' (and a few floats its own way); a point with anything
    Python writes as a \\u escape (non-ASCII, control characters, DEL) is measured the slow way."""
    if '\\u' in text or len(p)!=len(_POINT_KEYS): return _point_bytes(p)
    n=len(text)-2*len(p)+1
    for v in p.values():
        if type(v) is float:
            if 1e-4<=abs(v)<1e16:   # Python writes no exponent here, and the same digits as JavaScript
                if v.is_integer(): n-=2
            elif v==0: n-=len(repr(v))-1   # '0.0' or '-0.0': JavaScript writes 0
            else: n+=len(_js_number(v))-len(json.dumps(v))
    return n


# Paged trends work out a machine's whole windowed answer once and keep it for the following parts (and the next
# visitor), where each part used to recompute it: about 0.75 s a part for three years of a gantry's synthetic records.
# Kept per open Database, whose version() moves with any change to the file, to any table, by this server or another
# process: an answer is used only while that version is unchanged, and a new version drops every kept answer. At most
# TREND_CACHE_ENTRIES answers (machine and window), least recently used dropped first; each holds only its token, order
# and the tests sharing each series, plus per point its series, size and JSON text, compressed in blocks.
TREND_CACHE_ENTRIES=4
_TREND_BLOCK=256   # points per compressed block of JSON text
_TREND_CACHES=weakref.WeakKeyDictionary()   # Database -> _TrendCache (versions of different connections do not compare)
_TREND_CACHES_LOCK=threading.Lock()


class _TrendCache:
    """Used only under db.lock, which also guards every read of db.version(): the cache moves to each version as it is
    read, in the order read, so a request that read its version earlier can never set it back to an older one."""
    def __init__(self):
        self.version=None;self.answers=OrderedDict()

    def get(self, db, key):
        """(db's version now, the answer kept for key or None); version None (inside an open transaction): keep nothing."""
        with db.lock:
            version=db.version()
            if version is None: return None,None
            if version!=self.version: self.answers.clear();self.version=version
            answer=self.answers.get(key)
            if answer is not None: self.answers.move_to_end(key)
            return version,answer

    def put(self, db, key, version, answer):
        """Keep answer, worked out after get read version, only if db's version is still that one."""
        with db.lock:
            if version!=self.version or db.version()!=version: return   # the file changed while this answer was worked out: never keep it
            self.answers[key]=answer;self.answers.move_to_end(key)
            while len(self.answers)>TREND_CACHE_ENTRIES: self.answers.popitem(last=False)


def _trend_cache(db):
    with _TREND_CACHES_LOCK:
        cache=_TREND_CACHES.get(db)
        if cache is None: cache=_TREND_CACHES[db]=_TrendCache()
        return cache


class _TrendAnswer:
    """A window's whole answer as trend_page sends it in parts. token and order as sent; members: the test ids sharing
    each series, by series index; then per point, in the order the parts send them: series (its series index), sizes
    (_point_bytes) and its _REPLY_JSON text, in zlib blocks of _TREND_BLOCK points joined by newlines (JSON text written
    with \\u escapes holds none). Never changed once made, so threads share it without a lock."""
    __slots__=('token','order','members','series','sizes','blocks')

    def texts(self, start, end):
        """The JSON text of points start to end-1."""
        out=[]
        for b in range(start//_TREND_BLOCK,(end-1)//_TREND_BLOCK+1) if end>start else ():
            out.extend(zlib.decompress(self.blocks[b]).decode('utf-8').split('\n')[max(start-b*_TREND_BLOCK,0):end-b*_TREND_BLOCK])
        return out


def _trend_answer(db, user, machine_id, tests, until, since):
    """Work out the whole answer that trend_page sends in parts (see there)."""
    whole=machine_trends(db,user,machine_id,tests=tests,until=until)
    series,members=[],{}   # each distinct series once, in order of its first (lowest) test id
    for test_id in sorted(whole,key=int):
        points=whole[test_id]
        if id(points) not in members: members[id(points)]=[];series.append(points)
        members[id(points)].append(test_id)
    newest,order={},{}
    imported=[(p,points) for points in series for p in points if p['source']=='sphinx' and p['assignment_id'] is not None]
    for p,_ in imported:
        # Math.max from 0, as local-backend.js and the overview did: a run with id 0 still counts.
        newest[p['assignment_id']]=max(newest.get(p['assignment_id'],0),p['run_id'])
    for p,points in imported:
        if newest.get(p['assignment_id'])==p['run_id']:
            o=order.setdefault(str(p['assignment_id']),{})
            for test_id in members[id(points)]: o[test_id]=p['source_order']
    kept=[[p for p in points if p['qa_date']>=since] for points in series] if since else series
    # Every point by _point_key (a stable sort); only the series of each place is taken from this order: each series keeps
    # its own order (see local-backend.js trendPage).
    pool=[p for points in kept for p in points];owner=[s for s,points in enumerate(kept) for _ in points]
    keys=list(map(_point_key,pool))
    places=[owner[i] for i in sorted(range(len(pool)),key=keys.__getitem__)]
    del pool,keys,owner
    texts=[[_REPLY_JSON(p) for p in points] for points in kept]
    sizes=[[_point_size(p,t) for p,t in zip(points,texts[s])] for s,points in enumerate(kept)]
    answer=_TrendAnswer()
    answer.members=tuple(tuple(members[id(points)]) for points in series)
    # The token: a checksum of json.dumps([[[tests, points] for each series with points in it], order], default=str),
    # read in pieces; as long as local-backend.js's, so parts split alike.
    crc,adler=0,1
    for piece in _token_pieces(kept,texts,answer.members,order):
        piece=piece.encode('utf-8');crc=zlib.crc32(piece,crc);adler=zlib.adler32(piece,adler)
    answer.token=f'{crc:08x}{adler:08x}-{len(places)}'
    answer.order=order
    answer.series=array('I',places)
    taken=[iter(x) for x in sizes];answer.sizes=array('I',[next(taken[s]) for s in places])
    taken=[iter(x) for x in texts];texts=[next(taken[s]) for s in places]
    answer.blocks=tuple(zlib.compress('\n'.join(texts[i:i+_TREND_BLOCK]).encode('utf-8'),1) for i in range(0,len(texts),_TREND_BLOCK))
    return answer


def _token_pieces(kept, texts, members, order):
    """json.dumps([[[members[s], kept[s]] for each s with points], order], default=str) in pieces, from the points' texts."""
    yield '[['
    comma=''
    for s,points in enumerate(kept):
        if points:
            yield comma+'['+json.dumps(list(members[s]))+', ['+', '.join(texts[s])+']]';comma=', '
    yield '], '+json.dumps(order,default=str)+']'


def _trend_part(answer, page):
    """One part of answer, from page ('start', or the point to start at), as the reply's bytes."""
    count=len(answer.series)
    start=0 if page=='start' else min(int(page),count)
    out={'series':[],'tests':{},'next':None,'token':answer.token}
    if page=='start': out['order']=answer.order
    size=len(json.dumps(out,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
    entries,end,index,parts=0,start,{},[]
    for i in range(start,count):
        s=answer.series[i]
        add,ids=answer.sizes[i],None
        if s in index: add+=1
        else:
            k=str(len(index));ids=answer.members[s];add+=(1 if index else 0)+2
            for test_id in ids: add+=(1 if entries or test_id!=ids[0] else 0)+len(test_id)+len(k)+3
        next_bytes=len(str(i+1))-2 if i+1<count else 0   # "cursor" in place of null
        if i>start and size+add+next_bytes>TREND_PAGE_BYTES: break
        size+=add;end=i+1
        if ids:
            index[s]=len(parts)
            for test_id in ids: out['tests'][test_id]=len(parts)
            entries+=len(ids);parts.append([])
        parts[index[s]].append(i)
    if end<count: out['next']=str(end)
    # json.dumps(out, default=str) with out['series'] the points' kept texts, as the server used to write the whole reply.
    texts=answer.texts(start,end)
    out['series']=None;rest=json.dumps(out,default=str)
    series='['+', '.join('['+', '.join(texts[i-start] for i in part)+']' for part in parts)+']'
    return ('{"series": '+series+rest[len('{"series": null'):]).encode('utf-8')


def trend_page_json(db, user, machine_id, tests=None, until=None, since=None, page='start'):
    """trend_page's reply as the server sends it (the bytes json.dumps(trend_page(...), default=str) writes), from the
    kept answer when the database has not changed since it was worked out (see TREND_CACHE_ENTRIES)."""
    key=(machine_id,None if tests is None else frozenset(tests),until,since)
    cache=_trend_cache(db)
    version,answer=cache.get(db,key)   # read first: a change made while the answer is worked out then never passes as current
    if answer is None:
        answer=_trend_answer(db,user,machine_id,tests,until,since)
        if version is not None: cache.put(db,key,version,answer)
    return _trend_part(answer,page)


def trend_page(db, user, machine_id, tests=None, until=None, since=None, page='start'):
    """One part of a machine's trends, as local-backend.js trendPage (see there for the reply and its rules). Joining
    every part's series per test id, in order, gives exactly machine_trends for the same tests/until/since. The token is
    a checksum of the whole answer (each series with points in it, the tests sharing it, and order), this server's own
    (the browser build's differs); it is compared only between parts. The server sends trend_page_json's bytes; this
    returns them parsed, so a value JSON cannot hold arrives as the reply carries it (str(), e.g. a BLOB as "b'...'")."""
    return json.loads(trend_page_json(db,user,machine_id,tests=tests,until=until,since=since,page=page))


def machine_trends(db, user, machine_id, tests=None, last=None, until=None, since=None):
    """Same-machine measurements across list copies, matched by type, units and identity. tests / last / until / since: see trend_window."""
    wanted=tests
    tests=db.all('SELECT * FROM tests');by_id={t['id']:t for t in tests}
    aliases={}
    for q in db.all('SELECT id,name FROM queues'):
        if not sphinx.is_pbs_template(q['name']): continue
        base=db.all('SELECT t.* FROM queue_items i JOIN tests t ON t.id=i.test_id WHERE i.queue_id=?',(q['id'],))
        base_ids={t['id'] for t in base}
        for t in tests:
            if t.get('owner_queue_id')==q['id'] and t['id'] not in base_ids:
                target=sphinx.template_match(base,t['name'])
                if target: aliases[t['id']]=target
    keys={}
    def key(t):
        if t['id'] not in keys: keys[t['id']]=_history_key(aliases.get(t['id'],t))
        return keys[t['id']]
    wanted_keys={key(t) for t in tests if t['id'] in wanted} if wanted is not None else None
    rows=db.all('SELECT res.test_id,res.id AS source_order,r.source,r.id AS run_id,r.assignment_id,r.qa_date,res.value_num AS value,res.expected,res.warn,res.fail,res.tol_mode,res.status FROM results res JOIN runs r ON r.id=res.run_id WHERE r.trashed_at IS NULL AND r.machine_id=? AND res.value_num IS NOT NULL'
                +(' AND r.qa_date<=?' if until else '')+(' AND r.qa_date>=?' if since else '')+' ORDER BY r.qa_date,r.id,res.id',
                (machine_id,)+((until,) if until else ())+((since,) if since else ()))
    groups={}
    for row in rows:
        test=by_id.get(row.pop('test_id'))
        if test:
            if wanted_keys is not None and key(test) not in wanted_keys: continue
            row['source_test_id']=test['id']
            number=re.search(r'Template\s+(\d+\.\d+)',test.get('description') or '')
            row['source_test_number']=number.group(1) if number else None
            groups.setdefault(key(test),[]).append(row)
    if last:
        groups={k:v[-last:] for k,v in groups.items()}
    return {str(t['id']):groups[key(t)] for t in tests if (wanted is None or t['id'] in wanted) and key(t) in groups}


def list_audit(db, user, limit=300):
    require(user, "review")
    return db.all("SELECT a.*, u.username FROM audit a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?", (min(int(limit), 2000),))
