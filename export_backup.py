"""Export a server database as a backup file the browser-only build can restore (Setup → Restore).

  python export_backup.py --db data/portal.db out.json

Passwords are not exported; the browser build has none.
"""

import argparse
import json
from datetime import datetime

from portal.db import Database

TABLES = {
    "users": "SELECT id, username, full_name, role, '' AS password_hash, active, created_at FROM users",
    "machines": "SELECT * FROM machines",
    "tests": "SELECT * FROM tests",
    "queues": "SELECT * FROM queues",
    "queue_items": "SELECT * FROM queue_items",
    "assignments": "SELECT * FROM assignments",
    "overrides": "SELECT rowid AS id, * FROM assignment_overrides",
    "runs": "SELECT * FROM runs",
    "results": "SELECT * FROM results",
    "audit": "SELECT * FROM audit",
}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("out")
    args = parser.parse_args(argv)
    db = Database(args.db)
    state = {"version": 1, "seq": {}}
    for table, sql in TABLES.items():
        rows = db.all(sql)
        state[table] = rows
        state["seq"][table] = max((r["id"] for r in rows), default=0)
    db.close()
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"exported_at": datetime.now().isoformat(timespec="seconds"), "state": state}, f)
    print(f"Wrote {args.out}: " + ", ".join(f"{len(state[t])} {t}" for t in TABLES))


if __name__ == "__main__":
    main()
