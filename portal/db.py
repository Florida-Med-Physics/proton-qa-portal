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
    type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean', 'status', 'text', 'choice')),
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
        run_fields={r[1] for r in self.conn.execute('PRAGMA table_info(runs)')}
        for name,kind in [('trashed_at','TEXT'),('trashed_by','INTEGER REFERENCES users(id)'),('trash_reason','TEXT')]:
            if name not in run_fields:self.run(f'ALTER TABLE runs ADD COLUMN {name} {kind}')
        self._generalize_pbs_templates()
        self._apply_imaging_defaults()
        self._install_department_templates()
        self._install_srs_winston_lutz()
        for name,number in [('Maximum total delta','1.02'),('Mean total delta','1.03')]:
            self.run("UPDATE tests SET expected=0 WHERE expected IS NULL AND name=? AND description LIKE ? AND category='Winston-Lutz' AND type='numeric' AND unit='mm' AND warn IS NULL AND fail IS NULL AND id IN (SELECT qi.test_id FROM queue_items qi JOIN queues q ON q.id=qi.queue_id WHERE q.name=?)",(name,'Template '+number+'.%','SRS QA template – TrueBeam (Dose Pro)'))
        self._install_requested_dashboard_schedules()
        self._install_derived_calculations()

    def _install_derived_calculations(self):
        from . import derived
        seed=json.loads((Path(__file__).parent/'seed.json').read_text())
        changed=0
        with self.transaction():
            for q in self.all('SELECT * FROM queues'):
                tpl=next((t for t in seed['templates'] if t['name']==q['name']),None)
                if not tpl:continue
                prior=[]
                for test in self.all('SELECT t.* FROM queue_items qi JOIN tests t ON t.id=qi.test_id WHERE qi.queue_id=? ORDER BY qi.position',(q['id'],)):
                    original=next((x for x in tpl['checks'] if x['name']==test['name'] and x['category']==test['category']),None)
                    rule=derived.read(original['description']) if original else None
                    if rule and not derived.read(test['description']) and ('[calc:' in test['description'] or test['category']=='HDR treatment-day QA'):
                        try:derived.resolve(rule,prior)
                        except ValueError:pass
                        else:
                            self.run('UPDATE tests SET description=? WHERE id=?',(derived.encode(test['description'],rule),test['id']));changed+=1
                    prior.append(test)
            if changed:self.audit(None,'install_derived_calculations','test',None,count=changed)

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

    def _install_requested_dashboard_schedules(self):
        with self.transaction():
            for machine in self.all('SELECT * FROM machines'):
                hdr=bool(re.search(r'HDR.*Flex',machine['name'],re.I));tb=machine['name'].lower()=='truebeam'
                if not (hdr or tb):continue
                for queue in self.all('SELECT * FROM queues WHERE active=1'):
                    matches=(re.search('monthly',queue['name'],re.I) and re.search('truebeam',queue['name'],re.I)) if tb else (re.search(r'HDR.*Flex',queue['name'],re.I) and re.search(r'Daily QA|Source Exchange',queue['name'],re.I))
                    if not matches:continue
                    key=f"20261026:{machine['id']}:{queue['id']}"
                    if self.one("SELECT id FROM audit WHERE action='requested_dashboard_schedule' AND detail LIKE ?",('%'+key+'"%',)):continue
                    a=self.one('SELECT * FROM assignments WHERE machine_id=? AND queue_id=?',(machine['id'],queue['id']))
                    if a and json.loads(a.get('test_selection') or '{}').get('archived'):continue
                    frequency='monthly' if tb else 'asneeded'
                    if a:
                        aid=a['id'];self.run('UPDATE assignments SET frequency=?,active=1,interval_days=NULL WHERE id=?',(frequency,aid))
                    else:
                        aid=self.run('INSERT INTO assignments(machine_id,queue_id,frequency,start_date,active) VALUES(?,?,?,?,1)',(machine['id'],queue['id'],frequency,now()[:10]))
                    self.run('UPDATE machines SET active=1 WHERE id=?',(machine['id'],))
                    self.audit(None,'requested_dashboard_schedule','assignment',aid,key=key,frequency=frequency)

    def _install_srs_winston_lutz(self):
        seed=json.loads((Path(__file__).parent/'seed.json').read_text())
        tpl=next(t for t in seed['templates'] if t['name']=='SRS QA template – TrueBeam (Dose Pro)')
        for q in self.all('SELECT * FROM queues WHERE name=?',(tpl['name'],)):
            items=self.all('SELECT t.name FROM queue_items i JOIN tests t ON t.id=i.test_id WHERE i.queue_id=?',(q['id'],))
            if len(items)!=5 or not all(i['name'] in seed['srs_placeholder_names'] for i in items): continue
            with self.transaction():
                self.run('DELETE FROM queue_items WHERE queue_id=?',(q['id'],))
                for position,c in enumerate(tpl['checks']):
                    tid=self.run('INSERT INTO tests(name,category,type,unit,description,expected,warn,fail,tol_mode,active,owner_queue_id) VALUES(?,?,?,?,?,?,?,?,?,1,?)',(c['name'],c['category'],c['type'],c['unit'],c['description'],c['expected'],c['warn'],c['fail'],'absolute',q['id']))
                    self.run('INSERT INTO queue_items(queue_id,test_id,position) VALUES(?,?,?)',(q['id'],tid,position))
                self.run('UPDATE queues SET description=? WHERE id=?',(tpl['setup'],q['id']))
                self.audit(None,'install_winston_lutz','queue',q['id'],rule='Maximum delta < 1 mm')

    def _install_department_templates(self):
        # Install only into existing departmental databases; empty databases use seed-defaults.
        if not self.one("SELECT id FROM machines LIMIT 1"):
            return
        seed=json.loads((Path(__file__).parent/'seed.json').read_text())
        with self.transaction():
            for tpl in seed['templates']:
                key=tpl.get('departmental_id')
                if not key or self.one("SELECT id FROM audit WHERE action='install_department_template' AND detail LIKE ?", ('%'+key+'"%',)):
                    continue
                if not self.one('SELECT id FROM machines WHERE name=?',(tpl['install_machine'],)):
                    continue
                q=self.one('SELECT * FROM queues WHERE name=? COLLATE NOCASE',(tpl['name'],))
                if q and (self.one('SELECT id FROM queue_items WHERE queue_id=?',(q['id'],)) or self.one('SELECT id FROM tests WHERE owner_queue_id=?',(q['id'],))):
                    continue
                qid=q['id'] if q else self.run('INSERT INTO queues(name,description,active,is_template) VALUES(?,?,1,1)',(tpl['name'],tpl['setup']))
                self.run('UPDATE queues SET description=? WHERE id=?',(tpl['setup'],qid))
                for position,c in enumerate(tpl['checks']):
                    tid=self.run('INSERT INTO tests(name,category,type,unit,description,expected,warn,fail,tol_mode,active,owner_queue_id) VALUES(?,?,?,?,?,?,?,?,?,1,?)',(c['name'],c['category'],c['type'],c.get('unit',''),c['description'],c.get('expected'),c.get('warn'),c.get('fail'),c.get('tol_mode','absolute'),qid))
                    self.run('INSERT INTO queue_items(queue_id,test_id,position) VALUES(?,?,?)',(qid,tid,position))
                m=self.one('SELECT id FROM machines WHERE name=?',(tpl['install_machine'],))
                if m and not self.one('SELECT id FROM assignments WHERE machine_id=? AND queue_id=?',(m['id'],qid)):
                    self.run("INSERT INTO assignments(machine_id,queue_id,frequency,start_date,active) VALUES(?,?,?,?,1)",(m['id'],qid,tpl['frequency'],now()[:10]))
                self.audit(None,'install_department_template','queue',qid,source=key,tests=len(tpl['checks']))

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
        if tests_sql and "'choice'" not in tests_sql[0]:
            # The 'status' check type (Pass / Warning / Fail) was added; SQLite cannot change a CHECK, so rebuild.
            self.conn.executescript("""
                PRAGMA foreign_keys = OFF;
                BEGIN;
                CREATE TABLE tests_new (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
                    type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean', 'status', 'text', 'choice')), unit TEXT NOT NULL DEFAULT '',
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
        from .auth import ACTING_ROLE
        if ACTING_ROLE.get():detail={**detail,'acting_role':ACTING_ROLE.get(),'authenticated_role':'admin'}
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
