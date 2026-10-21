"""Create a throwaway demo database with synthetic machines, tests, queues, and history.

  python seed_demo.py              writes data/demo.db and data/demo-credentials.txt
  python run_portal.py --db data/demo.db serve

All values are synthetic placeholders for trying the interface. They are not
beam data or clinical tolerances.
"""

import argparse
import random
import secrets
from datetime import date, timedelta
from pathlib import Path

from portal import auth, service
from portal.db import Database

ROOT = Path(__file__).resolve().parent


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=str(ROOT / "data" / "demo.db"))
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args(argv)

    path = Path(args.db)
    for suffix in ("", "-wal", "-shm"):
        Path(str(path) + suffix).unlink(missing_ok=True)
    db = Database(path)

    password = secrets.token_urlsafe(12)
    users = {}
    for username, role in (("demo-admin", "admin"), ("demo-physicist", "physicist"), ("demo-therapist", "therapist")):
        user_id = auth.create_user(db, username, f"Demo {role.title()}", role, password)
        users[role] = db.one("SELECT id, username, full_name, role FROM users WHERE id = ?", (user_id,))
    creds = path.with_name("demo-credentials.txt")
    creds.write_text(f"Demo accounts for {path.name} (synthetic, local testing only)\n"
                     f"usernames: demo-admin, demo-physicist, demo-therapist\npassword: {password}\n")

    admin = users["admin"]
    machines = [service.save_machine(db, admin, {"name": name, "kind": "Demo gantry", "location": "Demo room"})["id"]
                for name in ("Demo Gantry 1", "Demo Gantry 2")]
    t = lambda **kw: service.save_test(db, admin, kw)["id"]
    door = t(name="Door interlock", category="Safety", type="boolean")
    av = t(name="Audio / video", category="Safety", type="boolean")
    depth = t(name="Distal depth (demo)", category="Energy", unit="mm", expected=100, warn=0.5, fail=1.0)
    sigma = t(name="Spot sigma X (demo)", category="Spot", unit="mm", expected=3.0, warn=0.2, fail=0.4)
    output = t(name="Output (demo)", category="Output", unit="cGy", expected=100, warn=1, fail=2, tol_mode="percent")
    notes = t(name="Session notes", category="General", type="text")
    daily = service.save_queue(db, admin, {"name": "Demo daily QA", "description": "Synthetic example queue.",
                                           "items": [{"test_id": i} for i in (door, av, depth, sigma, output, notes)]})["id"]
    monthly = service.save_queue(db, admin, {"name": "Demo monthly QA", "items": [{"test_id": output, "warn": 0.5}]})["id"]

    start = date.today() - timedelta(days=args.days)
    rng = random.Random(7)
    for machine in machines:
        a = service.save_assignment(db, admin, {"machine_id": machine, "queue_id": daily, "frequency": "daily",
                                                "weekdays": [0, 1, 2, 3, 4], "start_date": start.isoformat()})["id"]
        service.save_assignment(db, admin, {"machine_id": machine, "queue_id": monthly, "frequency": "monthly",
                                            "start_date": start.isoformat()})
        for offset in range(args.days):
            day = start + timedelta(days=offset)
            if day.weekday() > 4 or (machine == machines[1] and offset >= args.days - 3):
                continue
            run = service.submit_run(db, users["therapist"], a, {"qa_date": day.isoformat(), "results": [
                {"test_id": door, "value": "pass"}, {"test_id": av, "value": "pass"},
                {"test_id": depth, "value": round(100 + rng.gauss(0, 0.3), 2)},
                {"test_id": sigma, "value": round(3.0 + rng.gauss(0, 0.12), 2)},
                {"test_id": output, "value": round(100 + rng.gauss(0, 0.7), 2)}]})
            if offset < args.days - 5:
                service.review_run(db, users["physicist"], run["id"], {"decision": "approved"})
    print(f"Demo database: {path}\nCredentials:   {creds}")


if __name__ == "__main__":
    main()
