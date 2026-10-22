"""Start the Physics QA Portal or manage its users.

  python run_portal.py create-admin         first-time setup (prompts for a password)
  python run_portal.py seed-defaults        load the machines and daily QA templates into an empty database
  python run_portal.py serve                local only, http://127.0.0.1:8790
  python run_portal.py serve --host 0.0.0.0 share on the network
  python run_portal.py import-sphinx --machine G1 --queue "Daily QA – G1" --user admin --create "G:\\...\\G1 Sphinx"
                                            load Sphinx .xls exports (files or folders) as historical runs

The database location defaults to data/portal.db and can be set with --db or PROTON_QA_DB.
"""

import argparse
import getpass
import os
import sys
import webbrowser
from pathlib import Path

from portal import auth, checklist, service, sphinx
from portal.db import Database
from portal.server import PortalServer

DEFAULT_DB = Path(__file__).resolve().parent / "data" / "portal.db"
SETTINGS = Path(__file__).resolve().parent / "data" / "portal-settings.json"


def remembered_db():
    """The database an admin chose under Data Administration, if any."""
    try:
        import json
        return json.loads(SETTINGS.read_text(encoding="utf-8")).get("db") or None
    except (OSError, ValueError):
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(description="Physics QA Portal (draft; not validated for clinical use)")
    parser.add_argument("--db", default=os.environ.get("PROTON_QA_DB") or remembered_db() or str(DEFAULT_DB))
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8790)
    serve.add_argument("--open", action="store_true", help="open the portal in the default browser")
    serve.add_argument("--secure-cookies", action="store_true", help="mark the session cookie Secure (use behind HTTPS)")
    admin = commands.add_parser("create-admin")
    admin.add_argument("--username", default="admin")
    admin.add_argument("--full-name", default="")
    seed = commands.add_parser("seed-defaults", help="load the machines, templates and daily lists from portal/seed.json into an empty database")
    seed.add_argument("--user", default="admin", help="portal username recorded as the creator")
    imp = commands.add_parser("import-sphinx", help="import Sphinx daily QA .xls exports")
    imp.add_argument("--machine", required=True, help="machine name in the portal")
    imp.add_argument("--queue", required=True, help="queue name in the portal")
    imp.add_argument("--user", required=True, help="portal username recorded as the importer (admin or physicist)")
    imp.add_argument("--create", action="store_true", help="create the machine, queue, and a weekday-daily schedule if missing")
    imp.add_argument("--pending", action="store_true", help="mark runs as awaiting review instead of historical")
    imp.add_argument("paths", nargs="+", help=".xls files or folders (searched recursively)")
    chk = commands.add_parser("import-checklist", help="add the manual checks from a myQA daily-QA template to a queue")
    chk.add_argument("--queue", required=True)
    chk.add_argument("--user", required=True)
    chk.add_argument("template", help="myQA template export (.xls)")
    args = parser.parse_args(argv)

    db = Database(args.db)
    try:
        run_command(db, args)
    finally:
        db.close()


def run_command(db, args):
    if args.command == "import-sphinx":
        return import_sphinx(db, args)
    if args.command == "import-checklist":
        return import_checklist(db, args)
    if args.command == "seed-defaults":
        user = db.one("SELECT id, username, full_name, role FROM users WHERE username = ? AND active = 1", (args.user,))
        if not user:
            sys.exit(f"No active portal user '{args.user}'. Run create-admin first.")
        try:
            result = service.seed_defaults(db, user)
        except service.PortalError as exc:
            sys.exit(str(exc))
        print(f"Loaded {len(result['templates'])} templates and {len(result['machines'])} machines: {', '.join(result['machines'])}")
        return
    if args.command == "create-admin":
        password = getpass.getpass("New admin password (10+ characters): ")
        if password != getpass.getpass("Repeat password: "):
            sys.exit("Passwords do not match.")
        try:
            auth.create_user(db, args.username, args.full_name, "admin", password)
        except ValueError as exc:
            sys.exit(str(exc))
        print(f"Created admin '{args.username}' in {args.db}")
        return

    if not db.one("SELECT id FROM users LIMIT 1"):
        sys.exit("No users yet. Run: python run_portal.py create-admin")
    server = PortalServer((args.host, args.port), db)
    server.secure_cookies = args.secure_cookies
    url = f"http://{'127.0.0.1' if args.host in ('0.0.0.0', '::') else args.host}:{args.port}/"
    print(f"Physics QA Portal running at {url} (database: {args.db}). Press Ctrl+C to stop.")
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def import_checklist(db, args):
    user = db.one("SELECT id, username, full_name, role FROM users WHERE username = ? AND active = 1", (args.user,))
    queue = db.one("SELECT id FROM queues WHERE name = ?", (args.queue,))
    if not user or not queue:
        sys.exit("User or queue not found.")
    try:
        parsed = checklist.parse_file(Path(args.template).read_bytes())
        result = service.import_checklist(db, user, queue["id"], parsed)
    except (service.PortalError, sphinx.SphinxError) as exc:
        sys.exit(str(exc))
    print(f"Added {len(result['added'])} check(s) to {args.queue}.")


def import_sphinx(db, args):
    user = db.one("SELECT id, username, full_name, role FROM users WHERE username = ? AND active = 1", (args.user,))
    if not user:
        sys.exit(f"No active portal user '{args.user}'.")
    try:
        machine = db.one("SELECT id FROM machines WHERE name = ?", (args.machine,))
        if not machine and args.create:
            machine = {"id": service.save_machine(db, user, {"name": args.machine})["id"]}
        queue = db.one("SELECT id FROM queues WHERE name = ?", (args.queue,))
        if not queue and args.create:
            queue = {"id": service.save_queue(db, user, {"name": args.queue, "description": "Sphinx daily QA (imported)."})["id"]}
        if not machine or not queue:
            sys.exit("Machine or queue not found. Check the names or add --create.")
        assignment = db.one("SELECT id FROM assignments WHERE machine_id = ? AND queue_id = ?", (machine["id"], queue["id"]))
        if not assignment and args.create:
            assignment = service.save_assignment(db, user, {"machine_id": machine["id"], "queue_id": queue["id"], "frequency": "daily"})
        if not assignment:
            sys.exit(f"'{args.queue}' is not scheduled on {args.machine}. Schedule it in the portal or add --create.")
    except service.PortalError as exc:
        sys.exit(str(exc))

    paths = []
    for raw in args.paths:
        p = Path(raw)
        paths.extend(sorted(f for f in p.rglob("*") if f.is_file() and ".xls" in f.name.lower()) if p.is_dir() else [p])
    print(f"Importing {len(paths)} file(s) into {args.queue} on {args.machine}...")
    totals = {"imported": 0, "skipped": 0}
    for start in range(0, len(paths), 50):
        batch = [(p.name, p.read_bytes()) for p in paths[start:start + 50]]
        try:
            result = service.import_sphinx(db, user, assignment["id"], batch, historical=not args.pending)
        except service.PortalError as exc:
            sys.exit(str(exc))
        totals["imported"] += len(result["imported"])
        totals["skipped"] += len(result["skipped"])
        for s in result["skipped"]:
            print(f"  skipped {s['file']}: {s['reason']}")
    print(f"Done: {totals['imported']} imported, {totals['skipped']} skipped.")


if __name__ == "__main__":
    main()
