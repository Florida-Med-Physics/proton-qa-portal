"""Tests use synthetic machines, tests, and limits only."""

import http.client
import json
import threading
import unittest
from datetime import date, timedelta

from portal import auth, qa, service
from portal.db import Database
from portal.server import PortalServer
from portal.service import PortalError

PASSWORD = "synthetic-pass-123"


def make_users(db):
    ids = {role: auth.create_user(db, role, role.title(), role, PASSWORD) for role in auth.ROLES}
    return {role: db.one("SELECT id, username, full_name, role FROM users WHERE id = ?", (i,)) for role, i in ids.items()}


class EvaluateTests(unittest.TestCase):
    limits = {"expected": 10.0, "warn": 1.0, "fail": 2.0, "tol_mode": "absolute"}

    def test_absolute_bands(self):
        self.assertEqual(qa.evaluate("numeric", 10.5, self.limits), "pass")
        self.assertEqual(qa.evaluate("numeric", 11.0, self.limits), "pass")  # on the warning line counts as within
        self.assertEqual(qa.evaluate("numeric", 8.5, self.limits), "warn")
        self.assertEqual(qa.evaluate("numeric", 12.0, self.limits), "warn")
        self.assertEqual(qa.evaluate("numeric", 12.01, self.limits), "fail")

    def test_float_noise_on_boundary(self):
        limits = {"expected": 0.3, "warn": 0.1, "fail": 0.2, "tol_mode": "absolute"}
        self.assertEqual(qa.evaluate("numeric", 0.1 + 0.3, limits), "pass")

    def test_percent(self):
        limits = {"expected": 200.0, "warn": 1.0, "fail": 2.0, "tol_mode": "percent"}
        self.assertEqual(qa.evaluate("numeric", 202.0, limits), "pass")
        self.assertEqual(qa.evaluate("numeric", 203.0, limits), "warn")
        self.assertEqual(qa.evaluate("numeric", 195.0, limits), "fail")
        with self.assertRaises(ValueError):
            qa.evaluate("numeric", 1.0, {"expected": 0.0, "warn": 1.0, "fail": 2.0, "tol_mode": "percent"})

    def test_no_limits_and_other_types(self):
        self.assertEqual(qa.evaluate("numeric", 5.0, {"expected": None, "warn": 1, "fail": 2, "tol_mode": "absolute"}), "recorded")
        self.assertEqual(qa.evaluate("numeric", 5.0, {"expected": 5.0, "warn": None, "fail": None, "tol_mode": "absolute"}), "recorded")
        self.assertEqual(qa.evaluate("boolean", True, {}), "pass")
        self.assertEqual(qa.evaluate("boolean", False, {}), "fail")
        self.assertEqual(qa.evaluate("text", "ok", {}), "recorded")
        self.assertEqual(qa.evaluate("status", "warn", {}), "warn")
        self.assertEqual(qa.evaluate("status", "pass", {}), "pass")
        self.assertEqual(qa.evaluate("status", "bogus", {}), "fail")
        self.assertEqual(qa.overall(["pass", "recorded", "warn", "pass"]), "warn")
        self.assertEqual(qa.overall(["warn", "fail"]), "fail")

    def test_resolve_limits_precedence(self):
        test = {"expected": 1.0, "warn": 0.5, "fail": 1.0, "tol_mode": "absolute"}
        item = {"expected": None, "warn": 0.4, "fail": None, "tol_mode": None}
        override = {"expected": 2.0, "warn": None, "fail": None, "tol_mode": "percent"}
        self.assertEqual(qa.resolve_limits(test, item, override), {"expected": 2.0, "warn": 0.4, "fail": 1.0, "tol_mode": "percent"})


class ScheduleTests(unittest.TestCase):
    def test_daily_weekdays(self):
        a = {"frequency": "daily", "weekdays": "0,1,2,3,4", "start_date": "2026-10-19"}  # a Monday
        self.assertEqual(qa.next_due(a, None), date(2026, 10, 19))
        self.assertEqual(qa.next_due(a, date(2026, 10, 23)), date(2026, 10, 26))  # Friday -> Monday
        self.assertEqual(qa.due_state(a, date(2026, 10, 21), date(2026, 10, 21))["state"], "done")
        self.assertEqual(qa.due_state(a, date(2026, 10, 20), date(2026, 10, 21))["state"], "due")
        self.assertEqual(qa.due_state(a, date(2026, 10, 19), date(2026, 10, 21))["state"], "overdue")
        self.assertEqual(qa.due_state(a, date(2026, 10, 23), date(2026, 10, 24))["state"], "upcoming")  # Saturday

    def test_monthly_and_custom(self):
        monthly = {"frequency": "monthly", "start_date": "2026-01-01"}
        self.assertEqual(qa.next_due(monthly, date(2026, 1, 31)), date(2026, 2, 28))
        annual = {"frequency": "annual", "start_date": "2026-01-01"}
        self.assertEqual(qa.next_due(annual, date(2026, 3, 5)), date(2027, 3, 5))
        custom = {"frequency": "custom", "interval_days": 10, "start_date": "2026-01-01"}
        self.assertEqual(qa.next_due(custom, date(2026, 1, 5)), date(2026, 1, 15))
        future_start = {"frequency": "weekly", "start_date": "2026-12-01"}
        self.assertEqual(qa.next_due(future_start, date(2026, 10, 1)), date(2026, 12, 1))

    def test_as_needed_is_never_due(self):
        a = {"frequency": "asneeded", "start_date": "2026-01-01", "weekdays": "0,1,2,3,4"}
        self.assertIsNone(qa.next_due(a, None))
        self.assertEqual(qa.due_state(a, None, date(2026, 3, 2))["state"], "ready")
        self.assertEqual(qa.due_state(a, date(2026, 3, 2), date(2026, 3, 2))["state"], "done")
        self.assertEqual(qa.due_state(a, date(2026, 3, 1), date(2026, 3, 2))["state"], "ready")
        self.assertIn("As needed", qa.describe_schedule(a))

    def test_describe(self):
        self.assertEqual(qa.describe_schedule({"frequency": "daily", "weekdays": "0,1,2,3,4"}), "Daily (weekdays)")
        self.assertEqual(qa.describe_schedule({"frequency": "custom", "interval_days": 14}), "Every 14 days")


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.users = make_users(self.db)
        admin = self.users["admin"]
        self.machine = service.save_machine(self.db, admin, {"name": "Synthetic Gantry A"})["id"]
        self.dist = service.save_test(self.db, admin, {"name": "Distal depth", "category": "Energy", "unit": "mm",
                                                       "expected": 100, "warn": 0.9, "fail": 1.0})["id"]
        self.door = service.save_test(self.db, admin, {"name": "Door interlock", "category": "Safety", "type": "boolean"})["id"]
        self.note = service.save_test(self.db, admin, {"name": "Notes", "type": "text"})["id"]
        self.queue = service.save_queue(self.db, admin, {"name": "Synthetic daily", "items": [
            {"test_id": self.door}, {"test_id": self.dist, "warn": 0.5}, {"test_id": self.note}]})["id"]
        self.assignment = service.save_assignment(self.db, admin, {"machine_id": self.machine, "queue_id": self.queue,
                                                                   "frequency": "daily", "weekdays": [0, 1, 2, 3, 4, 5, 6],
                                                                   "start_date": "2026-01-01"})["id"]

    def submit(self, user, dist="100.2", door="pass", qa_date=None):
        return service.submit_run(self.db, self.users[user], self.assignment, {
            "qa_date": qa_date or date.today().isoformat(),
            "results": [{"test_id": self.dist, "value": dist}, {"test_id": self.door, "value": door}]})

    def test_permissions(self):
        with self.assertRaises(PortalError) as err:
            service.save_machine(self.db, self.users["therapist"], {"name": "X"})
        self.assertEqual(err.exception.status, 403)
        with self.assertRaises(PortalError):
            service.list_users(self.db, self.users["physicist"])
        with self.assertRaises(PortalError):
            service.update_user(self.db, self.users["admin"], self.users["admin"]["id"], {"role": "therapist"})

    def test_validation(self):
        admin = self.users["admin"]
        with self.assertRaisesRegex(PortalError, "already exists"):
            service.save_machine(self.db, admin, {"name": "synthetic gantry a"})
        with self.assertRaisesRegex(PortalError, "larger than the fail"):
            service.save_test(self.db, admin, {"name": "Bad", "expected": 1, "warn": 2, "fail": 1})
        with self.assertRaisesRegex(PortalError, "already scheduled"):
            service.save_assignment(self.db, admin, {"machine_id": self.machine, "queue_id": self.queue, "frequency": "weekly"})
        with self.assertRaisesRegex(PortalError, "whole number"):
            service.save_assignment(self.db, admin, {"frequency": "custom", "interval_days": 0}, self.assignment)
        with self.assertRaisesRegex(PortalError, "only appear once"):
            service.save_queue(self.db, admin, {"name": "Dup", "items": [{"test_id": self.dist}, {"test_id": self.dist}]})

    def test_queue_limits_then_machine_override(self):
        items = {i["test_id"]: i for i in service.run_template(self.db, self.users["admin"], self.assignment)["items"]}
        self.assertEqual(items[self.dist]["limits"], {"expected": 100.0, "warn": 0.5, "fail": 1.0, "tol_mode": "absolute"})
        service.save_overrides(self.db, self.users["physicist"], self.assignment,
                               {"overrides": [{"test_id": self.dist, "expected": "101", "warn": "", "fail": ""}]})
        items = {i["test_id"]: i for i in service.run_template(self.db, self.users["admin"], self.assignment)["items"]}
        self.assertEqual(items[self.dist]["limits"]["expected"], 101.0)
        self.assertEqual(items[self.dist]["queue_limits"]["expected"], 100.0)

    def test_submit_and_review(self):
        result = self.submit("therapist", dist="100.7")
        self.assertEqual(result["overall"], "warn")
        run = service.get_run(self.db, self.users["admin"], result["id"])
        dist = next(r for r in run["results"] if r["test_id"] == self.dist)
        self.assertEqual((dist["status"], dist["warn"]), ("warn", 0.5))  # limits are snapshotted on the result
        with self.assertRaisesRegex(PortalError, "permission"):
            service.review_run(self.db, self.users["therapist"], result["id"], {"decision": "approved"})
        with self.assertRaisesRegex(PortalError, "comment"):
            service.review_run(self.db, self.users["physicist"], result["id"], {"decision": "rejected"})
        service.review_run(self.db, self.users["physicist"], result["id"], {"decision": "approved"})
        with self.assertRaisesRegex(PortalError, "already been reviewed"):
            service.review_run(self.db, self.users["admin"], result["id"], {"decision": "approved"})
        own = self.submit("physicist")
        with self.assertRaisesRegex(PortalError, "someone other"):
            service.review_run(self.db, self.users["physicist"], own["id"], {"decision": "approved"})

    def test_status_check_pass_warn_fail(self):
        admin = self.users["admin"]
        water = service.save_test(self.db, admin, {"name": "Water level", "category": "Safety", "type": "status"})["id"]
        queue = service.save_queue(self.db, admin, {"name": "Linac daily (synthetic)", "items": [{"test_id": water}]})["id"]
        machine = service.save_machine(self.db, admin, {"name": "synthetic linac", "kind": "Linac"})["id"]
        assignment = service.save_assignment(self.db, admin, {"machine_id": machine, "queue_id": queue, "frequency": "daily"})["id"]
        submit = lambda value: service.submit_run(self.db, self.users["therapist"], assignment,
                                                  {"results": [{"test_id": water, "value": value}]})
        self.assertEqual(submit("Warning")["overall"], "warn")
        self.assertEqual(submit("pass")["overall"], "pass")
        run = service.get_run(self.db, admin, submit("fail")["id"])
        self.assertEqual((run["results"][0]["status"], run["results"][0]["value_text"], run["results"][0]["value_num"]), ("fail", "fail", None))
        with self.assertRaisesRegex(PortalError, "choose Pass, Warning, or Fail"):
            submit("maybe")
        with self.assertRaisesRegex(PortalError, "numeric, boolean, status, or text"):
            service.save_test(self.db, admin, {"name": "Odd", "type": "tristate"})

    def test_default_import_folder(self):
        import os
        import tempfile
        from pathlib import Path
        admin = self.users["admin"]
        self.assertEqual(service.list_import_files(self.db, admin, self.assignment), {"folder": "", "files": []})
        with tempfile.TemporaryDirectory() as tmp:
            older, newer = Path(tmp, "G1_old.xls"), Path(tmp, "sub", "G1_new.xls")
            newer.parent.mkdir()
            older.write_bytes(b"synthetic old export")
            newer.write_bytes(b"synthetic new export")
            Path(tmp, "notes.txt").write_text("ignored")
            os.utime(older, (1_700_000_000, 1_700_000_000))
            service.save_assignment(self.db, admin, {"frequency": "daily", "import_folder": tmp}, self.assignment)
            listing = service.list_import_files(self.db, admin, self.assignment)
            self.assertEqual([f["path"] for f in listing["files"]], ["sub/G1_new.xls", "G1_old.xls"])
            self.assertIsNone(listing["files"][0]["run_id"])
            upload = service.read_import_file(self.db, admin, self.assignment, "sub/G1_new.xls")
            self.assertEqual(upload["name"], "G1_new.xls")
            with self.assertRaisesRegex(PortalError, "not in this list's import folder"):
                service.read_import_file(self.db, admin, self.assignment, "../outside.xls")
            with self.assertRaisesRegex(PortalError, "not in this list's import folder"):
                service.read_import_file(self.db, admin, self.assignment, "notes.txt")
        service.save_assignment(self.db, admin, {"frequency": "daily", "import_folder": "/nonexistent/folder"}, self.assignment)
        with self.assertRaisesRegex(PortalError, "Import folder not found"):
            service.list_import_files(self.db, admin, self.assignment)

    def test_submit_rules(self):
        self.assertEqual(self.submit("therapist", door="fail")["overall"], "fail")
        with self.assertRaisesRegex(PortalError, "Missing results for: Door interlock"):
            service.submit_run(self.db, self.users["therapist"], self.assignment, {"results": [{"test_id": self.dist, "value": "100"}]})
        with self.assertRaisesRegex(PortalError, "enter a number"):
            self.submit("therapist", dist="abc")
        with self.assertRaisesRegex(PortalError, "future"):
            self.submit("therapist", qa_date=(date.today() + timedelta(days=1)).isoformat())

    def test_dashboard_and_trend(self):
        board = service.dashboard(self.db, self.users["therapist"])
        self.assertEqual(board["machines"][0]["queues"][0]["state"], "overdue")
        self.submit("therapist")
        board = service.dashboard(self.db, self.users["therapist"])
        queue = board["machines"][0]["queues"][0]
        self.assertEqual((queue["state"], queue["last_run"]["overall"]), ("done", "pass"))
        self.assertEqual(board["machines"][0]["pending_review"], 1)
        points = service.trend(self.db, self.users["therapist"], self.machine, self.dist)["points"]
        self.assertEqual([p["value"] for p in points], [100.2])

    def test_audit_trail(self):
        self.submit("therapist")
        actions = {(a["action"], a["entity"]) for a in service.list_audit(self.db, self.users["admin"])}
        self.assertTrue({("create", "machine"), ("create", "queue"), ("submit", "run")} <= actions)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = Database(":memory:")
        make_users(cls.db)
        cls.server = PortalServer(("127.0.0.1", 0), cls.db)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, method, path, body=None, cookie=None, portal_header=True):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_address[1], timeout=10)
        headers = {"Content-Type": "application/json"}
        if portal_header:
            headers["X-Portal"] = "1"
        if cookie:
            headers["Cookie"] = cookie
        conn.request(method, path, json.dumps(body) if body is not None else None, headers)
        response = conn.getresponse()
        raw = response.read()
        conn.close()
        return response, raw

    def login(self, username):
        response, _ = self.request("POST", "/api/login", {"username": username, "password": PASSWORD})
        self.assertEqual(response.status, 200)
        return response.getheader("Set-Cookie").split(";")[0]

    def test_auth_and_csrf(self):
        response, _ = self.request("GET", "/api/machines")
        self.assertEqual(response.status, 401)
        response, _ = self.request("POST", "/api/login", {"username": "admin", "password": "wrong-password"})
        self.assertEqual(response.status, 401)
        cookie = self.login("admin")
        self.assertIn("HttpOnly", self.request("POST", "/api/login", {"username": "admin", "password": PASSWORD})[0].getheader("Set-Cookie"))
        response, _ = self.request("POST", "/api/machines", {"name": "Synthetic B"}, cookie, portal_header=False)
        self.assertEqual(response.status, 403)
        response, raw = self.request("POST", "/api/machines", {"name": "Synthetic B"}, cookie)
        self.assertEqual(response.status, 200, raw)
        response, raw = self.request("GET", "/api/machines", cookie=cookie)
        self.assertIn("Synthetic B", [m["name"] for m in json.loads(raw)])
        self.request("POST", "/api/logout", {}, cookie)
        self.assertEqual(self.request("GET", "/api/machines", cookie=cookie)[0].status, 401)

    def test_therapist_cannot_configure(self):
        cookie = self.login("therapist")
        response, raw = self.request("POST", "/api/queues", {"name": "Nope"}, cookie)
        self.assertEqual(response.status, 403)
        self.assertIn("permission", json.loads(raw)["error"])

    def test_static_files(self):
        response, raw = self.request("GET", "/")
        self.assertEqual(response.status, 200)
        self.assertIn(b"UFHPTI Machine QA Portal", raw)
        self.assertIn("default-src 'self'", response.getheader("Content-Security-Policy"))
        self.assertEqual(self.request("GET", "/../portal/db.py")[0].status, 404)
        self.assertEqual(self.request("GET", "/app.js")[0].status, 200)


if __name__ == "__main__":
    unittest.main()
