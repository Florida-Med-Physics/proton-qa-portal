"""Start the Proton QA Portal or manage its users.

  python run_portal.py create-admin         first-time setup (prompts for a password)
  python run_portal.py serve                local only, http://127.0.0.1:8790
  python run_portal.py serve --host 0.0.0.0 share on the network

The database location defaults to data/portal.db and can be set with --db or PROTON_QA_DB.
"""

import argparse
import getpass
import os
import sys
import webbrowser
from pathlib import Path

from portal import auth
from portal.db import Database
from portal.server import PortalServer

DEFAULT_DB = Path(__file__).resolve().parent / "data" / "portal.db"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Proton QA Portal (draft; not validated for clinical use)")
    parser.add_argument("--db", default=os.environ.get("PROTON_QA_DB", str(DEFAULT_DB)))
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8790)
    serve.add_argument("--open", action="store_true", help="open the portal in the default browser")
    serve.add_argument("--secure-cookies", action="store_true", help="mark the session cookie Secure (use behind HTTPS)")
    admin = commands.add_parser("create-admin")
    admin.add_argument("--username", default="admin")
    admin.add_argument("--full-name", default="")
    args = parser.parse_args(argv)

    db = Database(args.db)
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
    print(f"Proton QA Portal running at {url} (database: {args.db}). Press Ctrl+C to stop.")
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
