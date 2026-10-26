import json
import re
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('admin', 'physicist', 'therapist', 'mpa')),
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    kind TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean', 'status', 'text')),
    unit TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    expected REAL,
    warn REAL,
    fail REAL,
    tol_mode TEXT NOT NULL DEFAULT 'absolute' CHECK (tol_mode IN ('absolute', 'percent')),
    active INTEGER NOT NULL DEFAULT 1,
    owner_queue_id INTEGER REFERENCES queues(id),
    UNIQUE (owner_queue_id, category, name)
);
CREATE TABLE IF NOT EXISTS queues (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    is_template INTEGER NOT NULL DEFAULT 0,
    template_id INTEGER REFERENCES queues(id),
    auto_sync INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS queue_items (
    id INTEGER PRIMARY KEY,
    queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES tests(id),
    position INTEGER NOT NULL DEFAULT 0,
    expected REAL,
    warn REAL,
    fail REAL,
    tol_mode TEXT CHECK (tol_mode IS NULL OR tol_mode IN ('absolute', 'percent')),
    UNIQUE (queue_id, test_id)
);
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    queue_id INTEGER NOT NULL REFERENCES queues(id),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom', 'asneeded')),
    interval_days INTEGER,
    weekdays TEXT NOT NULL DEFAULT '0,1,2,3,4',
    start_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    import_folder TEXT NOT NULL DEFAULT '',
    test_selection TEXT NOT NULL DEFAULT '{}',
    UNIQUE (machine_id, queue_id)
);
CREATE TABLE IF NOT EXISTS assignment_overrides (
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES tests(id),
    expected REAL,
    warn REAL,
    fail REAL,
    tol_mode TEXT CHECK (tol_mode IS NULL OR tol_mode IN ('absolute', 'percent')),
    PRIMARY KEY (assignment_id, test_id)
);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    machine_id INTEGER NOT NULL REFERENCES machines(id),
    queue_id INTEGER NOT NULL REFERENCES queues(id),
    performed_by INTEGER NOT NULL REFERENCES users(id),
    performed_at TEXT NOT NULL,
    qa_date TEXT NOT NULL,
    overall TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'imported')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    review_comment TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES tests(id),
    value_num REAL,
    value_text TEXT,
    expected REAL,
    warn REAL,
    fail REAL,
    tol_mode TEXT,
    status TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    detail TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS drafts (
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    PRIMARY KEY (assignment_id, user_id)
);
CREATE INDEX IF NOT EXISTS runs_by_assignment ON runs (assignment_id, qa_date);
CREATE INDEX IF NOT EXISTS results_by_test ON results (test_id);
CREATE UNIQUE INDEX IF NOT EXISTS runs_by_source ON runs (source_ref) WHERE source_ref IS NOT NULL;
"""


def now():
    return datetime.now().isoformat(timespec="seconds")


class Database:
    """One SQLite connection guarded by a lock; the portal's write volume is tiny."""

    def __init__(self, path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        if self.path != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
        run_columns = {r[1] for r in self.conn.execute("PRAGMA table_info(runs)")}
        if run_columns and "source_ref" not in run_columns:
            raise RuntimeError(f"{self.path} was made by the first preview build and cannot be upgraded. "
                               "Delete it and start again (for the demo, rerun seed_demo.py).")
        self._migrate()
        self.conn.executescript(SCHEMA)
        self._approval_migrations()
        self._generalize_pbs_templates()
        self._apply_imaging_defaults()

    def _approval_migrations(self):
        users_schema = self.one("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")["sql"]
        if "'mpa'" not in users_schema:
            self.conn.executescript("""
                PRAGMA foreign_keys=OFF;
                BEGIN;
                CREATE TABLE users_new (
                  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                  full_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('admin','physicist','therapist','mpa')),
                  password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
                INSERT INTO users_new SELECT id,username,full_name,role,password_hash,active,created_at FROM users;
                DROP TABLE users;
                ALTER TABLE users_new RENAME TO users;
                COMMIT;
                PRAGMA foreign_keys=ON;
            """)
        columns = {r[1] for r in self.conn.execute('PRAGMA table_info(runs)')}
        for name, definition in [('therapist_approval_required','INTEGER NOT NULL DEFAULT 0'),
                                 ('therapist_approved_by','INTEGER REFERENCES users(id)'),
                                 ('therapist_approved_at','TEXT')]:
            if name not in columns:
                self.conn.execute(f'ALTER TABLE runs ADD COLUMN {name} {definition}')
        self.run("UPDATE runs SET therapist_approval_required=1 WHERE review_status='pending' AND EXISTS (SELECT 1 FROM results res JOIN tests t ON t.id=res.test_id WHERE res.run_id=runs.id AND lower(t.name) LIKE '%therapist%' AND (lower(t.name) LIKE '%review%' OR lower(t.name) LIKE '%approv%'))")

    def _apply_imaging_defaults(self):
        seed = json.loads((Path(__file__).parent / "seed.json").read_text())
        with self.transaction():
            for q in self.all("SELECT id,name FROM queues"):
                if not re.search(r"PBS\s*DailyQA", q["name"], re.I):
                    continue
                for t in self.all("SELECT DISTINCT t.* FROM tests t LEFT JOIN queue_items i ON i.test_id=t.id WHERE t.owner_queue_id=? OR i.queue_id=?", (q["id"],q["id"])):
                    if self.one("SELECT id FROM audit WHERE action='apply_imaging_defaults' AND entity='test' AND entity_id=?", (t["id"],)):
                        continue
                    rule = next((r for r in seed.get('pbs_imaging_defaults',[]) if r['name']==t['name'] and r['unit']==t['unit'] and t['type']=='numeric' and (t['tol_mode'] or 'absolute')=='absolute'), None)
                    if not rule:
                        continue
                    changed = {k:rule[k] for k in ('expected','warn','fail') if t[k] is None}
                    self.run("UPDATE tests SET expected=COALESCE(expected,?),warn=COALESCE(warn,?),fail=COALESCE(fail,?) WHERE id=?", (rule['expected'],rule['warn'],rule['fail'],t['id']))
                    self.audit(None,'apply_imaging_defaults','test',t['id'],source=seed.get('pbs_tolerance_source'),source_row=rule['source_row'],changed=changed)

    def _generalize_pbs_templates(self):
        from .sphinx import canonical_key
        clean = lambda text: re.sub(r"\bGTR\s*\d+[ _-]*", "", text or "", flags=re.I).strip()
        seed = json.loads((Path(__file__).parent / "seed.json").read_text())
        rules = seed.get("pbs_tolerances", [])
        queues = [q for q in self.all("SELECT * FROM queues") if re.search(r"PBS\s*DailyQA", q["name"], re.I)]
        with self.transaction():
            for q in queues:
                self.run("UPDATE queues SET name=?, description=? WHERE id=?", (clean(q["name"]), clean(q["description"]), q["id"]))
                tests = self.all("SELECT DISTINCT t.* FROM tests t LEFT JOIN queue_items i ON i.test_id=t.id WHERE t.owner_queue_id=? OR i.queue_id=?", (q["id"], q["id"]))
                for t in tests:
                    name, description, category = clean(t["name"]), clean(t["description"]), clean(t["category"])
                    self.run("UPDATE tests SET name=?, description=?, category=? WHERE id=?", (name, description, category, t["id"]))
                    if self.one("SELECT id FROM audit WHERE action='apply_workbook_tolerances' AND entity='test' AND entity_id=?", (t["id"],)):
                        continue
                    rule = next((r for r in rules if r["key"] == canonical_key(name) and r["unit"] == t["unit"]), None)
                    if rule:
                        self.run("UPDATE tests SET warn=?, fail=?, tol_mode=? WHERE id=?", (rule["warn"],rule["fail"],rule["tol_mode"],t["id"]))
                        self.audit(None, "apply_workbook_tolerances", "test", t["id"], source=seed.get("pbs_tolerance_source"), source_row=rule["source_row"], before={k:t[k] for k in ("warn","fail","tol_mode")})

    def _migrate(self):
        """Bring older databases up to date. Each step is skipped once applied."""
        queue_columns = {r[1] for r in self.conn.execute("PRAGMA table_info(queues)")}
        if queue_columns and "is_template" not in queue_columns:
            self.conn.execute("ALTER TABLE queues ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0")
            self.conn.execute("ALTER TABLE queues ADD COLUMN template_id INTEGER REFERENCES queues(id)")
        queue_columns = {r[1] for r in self.conn.execute("PRAGMA table_info(queues)")}
        if queue_columns and "auto_sync" not in queue_columns:
            # A machine list can follow later edits to its template (off unless ticked in Setup QA).
            self.conn.execute("ALTER TABLE queues ADD COLUMN auto_sync INTEGER NOT NULL DEFAULT 0")
        test_columns = {r[1] for r in self.conn.execute("PRAGMA table_info(tests)")}
        if test_columns and "owner_queue_id" not in test_columns:
            # Checks now belong to one QA list; the unique key changes, so the table is rebuilt.
            self.conn.executescript("""
                PRAGMA foreign_keys = OFF;
                BEGIN;
                CREATE TABLE tests_new (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
                    type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean', 'text')), unit TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '', expected REAL, warn REAL, fail REAL,
                    tol_mode TEXT NOT NULL DEFAULT 'absolute' CHECK (tol_mode IN ('absolute', 'percent')),
                    active INTEGER NOT NULL DEFAULT 1, owner_queue_id INTEGER REFERENCES queues(id),
                    UNIQUE (owner_queue_id, category, name));
                INSERT INTO tests_new (id, name, category, type, unit, description, expected, warn, fail, tol_mode, active)
                    SELECT id, name, category, type, unit, description, expected, warn, fail, tol_mode, active FROM tests;
                DROP TABLE tests;
                ALTER TABLE tests_new RENAME TO tests;
                COMMIT;
                PRAGMA foreign_keys = ON;
            """)
        assignment_columns = {r[1] for r in self.conn.execute("PRAGMA table_info(assignments)")}
        if assignment_columns and "import_folder" not in assignment_columns:
            self.conn.execute("ALTER TABLE assignments ADD COLUMN import_folder TEXT NOT NULL DEFAULT ''")
        assignments_sql = self.conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'assignments'").fetchone()
        if assignments_sql and "'asneeded'" not in assignments_sql[0]:
            # The 'asneeded' frequency was added (SRS QA on SRS days); SQLite cannot change a CHECK, so rebuild.
            self.conn.executescript("""
                PRAGMA foreign_keys = OFF;
                BEGIN;
                CREATE TABLE assignments_new (
                    id INTEGER PRIMARY KEY,
                    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
                    queue_id INTEGER NOT NULL REFERENCES queues(id),
                    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom', 'asneeded')),
                    interval_days INTEGER,
                    weekdays TEXT NOT NULL DEFAULT '0,1,2,3,4',
                    start_date TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    import_folder TEXT NOT NULL DEFAULT '',
                    UNIQUE (machine_id, queue_id));
                INSERT INTO assignments_new SELECT id, machine_id, queue_id, frequency, interval_days, weekdays, start_date, active, import_folder FROM assignments;
                DROP TABLE assignments;
                ALTER TABLE assignments_new RENAME TO assignments;
                COMMIT;
                PRAGMA foreign_keys = ON;
            """)
        tests_sql = self.conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tests'").fetchone()
        if tests_sql and "'status'" not in tests_sql[0]:
            # The 'status' check type (Pass / Warning / Fail) was added; SQLite cannot change a CHECK, so rebuild.
            self.conn.executescript("""
                PRAGMA foreign_keys = OFF;
                BEGIN;
                CREATE TABLE tests_new (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
                    type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean', 'status', 'text')), unit TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '', expected REAL, warn REAL, fail REAL,
                    tol_mode TEXT NOT NULL DEFAULT 'absolute' CHECK (tol_mode IN ('absolute', 'percent')),
                    active INTEGER NOT NULL DEFAULT 1, owner_queue_id INTEGER REFERENCES queues(id),
                    UNIQUE (owner_queue_id, category, name));
                INSERT INTO tests_new SELECT id, name, category, type, unit, description, expected, warn, fail, tol_mode, active, owner_queue_id FROM tests;
                DROP TABLE tests;
                ALTER TABLE tests_new RENAME TO tests;
                COMMIT;
                PRAGMA foreign_keys = ON;
            """)
        columns = {r[1] for r in self.conn.execute("PRAGMA table_info(assignments)")}
        if columns and "test_selection" not in columns:
            self.conn.execute("ALTER TABLE assignments ADD COLUMN test_selection TEXT NOT NULL DEFAULT '{}' ")
        self.lock = threading.RLock()

    def all(self, sql, params=()):
        with self.lock:
            return [dict(r) for r in self.conn.execute(sql, params).fetchall()]

    def one(self, sql, params=()):
        with self.lock:
            row = self.conn.execute(sql, params).fetchone()
            return dict(row) if row else None

    def run(self, sql, params=()):
        with self.lock:
            return self.conn.execute(sql, params).lastrowid

    def close(self):
        with self.lock:
            self.conn.close()

    def transaction(self):
        return _Transaction(self)

    def audit(self, user_id, action, entity, entity_id=None, **detail):
        self.run(
            "INSERT INTO audit (at, user_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
            (now(), user_id, action, entity, entity_id, json.dumps(detail, default=str)),
        )


class _Transaction:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        self.db.lock.acquire()
        self.db.conn.execute("BEGIN")
        return self.db

    def __exit__(self, exc_type, *_):
        try:
            self.db.conn.execute("ROLLBACK" if exc_type else "COMMIT")
        finally:
            self.db.lock.release()
        return False
