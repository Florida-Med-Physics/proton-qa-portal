"""Past Sphinx imports recorded as history (POST /api/runs/record-history) and Sphinx imports split by history_before,
in the server build, on synthetic report grids only. The same checks run against docs/local-backend.js in
tests/test_record_history.cjs; the refusals, word for word, come from tests/record_history_cases.json for both."""

import http.client
import json
import threading
import unittest
from pathlib import Path
from unittest import mock

from portal import auth, service
from portal.db import Database
from portal.server import COOKIE, Handler, PortalServer
from portal.service import PortalError
from tests.test_portal import PASSWORD, make_users
from tests.test_sphinx import fake_file, fake_read_rows, upload

CASES = json.loads(Path(__file__).with_name("record_history_cases.json").read_text(encoding="utf-8"))
REFUSED = "You do not have permission to do that."


def day(n):
    """A Sphinx 'finished' stamp on 2026-10-<n>."""
    return f"10/{n:02d}/2026 6:00:00 AM"


@mock.patch("portal.sphinx.read_rows", side_effect=fake_read_rows)
class RecordHistoryTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.addCleanup(self.db.close)
        self.users = make_users(self.db)
        admin = self.users["admin"]
        self.gantry_a = service.save_machine(self.db, admin, {"name": "Synthetic Gantry A"})["id"]
        self.gantry_b = service.save_machine(self.db, admin, {"name": "Synthetic Gantry B"})["id"]
        # One daily list on two machines, with a therapist sign-off step, and a second list on gantry A.
        daily = service.save_queue(self.db, admin, {"name": "Synthetic Sphinx daily"})["id"]
        sign = service.save_test(self.db, admin, {"name": "QA reviewed by therapist?", "type": "boolean", "owner_queue_id": daily})["id"]
        service.save_queue(self.db, admin, {"name": "Synthetic Sphinx daily", "items": [{"test_id": sign}]}, daily)
        other = service.save_queue(self.db, admin, {"name": "Synthetic Sphinx other"})["id"]
        sched = lambda machine, queue: service.save_assignment(self.db, admin, {"machine_id": machine, "queue_id": queue, "frequency": "daily",
                                                                               "weekdays": list(range(7)), "start_date": "2026-01-01"})["id"]
        self.daily_a, self.daily_b, self.other_a = sched(self.gantry_a, daily), sched(self.gantry_b, daily), sched(self.gantry_a, other)

    def imp(self, assignment, name, n, **options):
        result = service.import_sphinx(self.db, self.users["admin"], assignment, [(f"{name}.xls", fake_file(f"rh-{name}", finished=day(n)))], **options)
        return result["imported"][0]["run_id"]

    def run_row(self, run_id):
        return self.db.one("SELECT * FROM runs WHERE id = ?", (run_id,))

    def state(self):
        return (self.db.all("SELECT * FROM runs ORDER BY id"), self.db.all("SELECT * FROM results ORDER BY id"),
                self.db.one("SELECT COUNT(*) AS n FROM audit")["n"])

    def make_runs(self):
        u = self.users
        r = {name: self.imp(self.daily_a, name, n, historical=False) for name, n in (("first", 1), ("signed", 2), ("on_until", 3), ("later", 4),
                                                                                 ("trashed", 1), ("approved", 1), ("rejected", 1))}
        r["other_machine"] = self.imp(self.daily_b, "other_machine", 1, historical=False)
        r["other_list"] = self.imp(self.other_a, "other_list", 2, historical=False)
        r["history"] = self.imp(self.daily_a, "history", 1)
        # Performed on the form: one filled in from a Sphinx file (source 'sphinx'), one typed in.
        r["form_sphinx"] = service.submit_run(self.db, u["therapist"], self.daily_a, {"qa_date": "2026-10-01", "results": [],
                                              "source_ref": "synthetic-form-file", "comment": "Done at the console"})["id"]
        r["form_manual"] = service.submit_run(self.db, u["therapist"], self.daily_a, {"qa_date": "2026-10-01", "results": []})["id"]
        service.trash_run(self.db, u["physicist"], r["trashed"], {"trashed": True})
        for name in ("signed", "approved", "rejected"):
            service.therapist_approve_run(self.db, u["therapist"], r[name])
        service.review_run(self.db, u["physicist"], r["approved"], {"decision": "approved"})
        service.review_run(self.db, u["physicist"], r["rejected"], {"decision": "rejected", "comment": "Synthetic rejection"})
        return r

    def test_selection_and_dry_run_change_nothing(self, _):
        r = self.make_runs()
        self.assertEqual(self.run_row(r["form_sphinx"])["source"], "sphinx")
        self.assertTrue(self.run_row(r["first"])["therapist_approval_required"])
        before = self.state()
        dry = lambda **body: service.record_history(self.db, self.users["physicist"], {"until": "2026-10-03", "dry_run": True, **body})
        self.assertEqual(dry(), {"count": 5, "runs": sorted([r["first"], r["signed"], r["on_until"], r["other_machine"], r["other_list"]])})
        self.assertEqual(dry(machine_id=self.gantry_a)["runs"], sorted([r["first"], r["signed"], r["on_until"], r["other_list"]]))
        self.assertEqual(dry(machine_id=self.gantry_a, assignment_id=self.daily_a)["runs"], [r["first"], r["signed"], r["on_until"]])
        self.assertEqual(dry(assignment_id=self.daily_b)["runs"], [r["other_machine"]])
        self.assertEqual(dry(until="2026-10-01")["runs"], sorted([r["first"], r["other_machine"]]))
        self.assertEqual(dry(until="2026-09-30"), {"count": 0, "runs": []})
        self.assertEqual(self.state(), before)

    def test_record_keeps_results_verdicts_and_sign_offs(self, _):
        r = self.make_runs()
        before = {row["id"]: row for row in self.state()[0]}
        results = self.state()[1]
        signer = before[r["signed"]]
        self.assertTrue(signer["therapist_approved_by"])
        self.assertEqual(service.record_history(self.db, self.users["admin"], {"until": "2026-10-03", "assignment_id": self.daily_a}), {"count": 3})
        chosen = [r["first"], r["signed"], r["on_until"]]
        for run_id, row in before.items():
            now = self.run_row(run_id)
            if run_id in chosen:   # only the review state changes
                self.assertEqual((now["review_status"], now["therapist_approval_required"]), ("imported", 0))
                self.assertEqual({k: v for k, v in now.items() if k not in ("review_status", "therapist_approval_required")},
                                 {k: v for k, v in row.items() if k not in ("review_status", "therapist_approval_required")})
            else:
                self.assertEqual(now, row)
        self.assertEqual(self.state()[1], results)
        self.assertEqual((self.run_row(r["signed"])["therapist_approved_by"], self.run_row(r["signed"])["therapist_approved_at"]),
                         (signer["therapist_approved_by"], signer["therapist_approved_at"]))
        entries = self.db.all("SELECT * FROM audit WHERE action = 'record_history' ORDER BY id")
        self.assertEqual([(e["entity"], e["entity_id"], e["user_id"]) for e in entries], [("run", i, self.users["admin"]["id"]) for i in chosen])
        details = {e["entity_id"]: json.loads(e["detail"]) for e in entries}
        self.assertEqual(details[r["first"]], {"previous": {"review_status": "pending", "therapist_approval_required": True,
                                                            "therapist_approved_by": None, "therapist_approved_at": None}, "until": "2026-10-03"})
        self.assertEqual(details[r["signed"]]["previous"], {"review_status": "pending", "therapist_approval_required": True,
                                                            "therapist_approved_by": signer["therapist_approved_by"],
                                                            "therapist_approved_at": signer["therapist_approved_at"]})
        # They leave every review queue; the rest still wait.
        waiting = {x["id"] for x in service.list_runs(self.db, self.users["admin"], {}) if x["review_status"] == "pending"}
        self.assertEqual(waiting, {r["later"], r["other_machine"], r["other_list"], r["form_sphinx"], r["form_manual"]})
        self.assertEqual(service.record_history(self.db, self.users["admin"], {"until": "2026-10-03", "assignment_id": self.daily_a, "dry_run": True}),
                         {"count": 0, "runs": []})
        self.assertEqual(service.record_history(self.db, self.users["physicist"], {"until": "2026-10-04", "dry_run": False}), {"count": 3})
        self.assertEqual(self.run_row(r["later"])["review_status"], "imported")
        self.assertEqual(self.db.one("SELECT COUNT(*) AS n FROM audit WHERE action = 'record_history'")["n"], 6)

    def test_permission_refusals(self, _):
        self.make_runs()
        before = self.state()
        admin = self.users["admin"]
        for user in (self.users["therapist"], self.users["mpa"], auth.act_as(admin, "therapist"), auth.act_as(admin, "mpa"), None):
            for body in ({"until": "2026-10-03"}, {"until": "2026-10-03", "dry_run": True}, {"until": "not a date"}):
                with self.assertRaisesRegex(PortalError, f"^{REFUSED}$"):
                    service.record_history(self.db, user, body)
        self.assertEqual(self.state(), before)
        for user in (self.users["physicist"], admin, auth.act_as(admin, "physicist")):
            self.assertEqual(service.record_history(self.db, user, {"until": "2026-10-03", "dry_run": True})["count"], 5)

    def test_refusals_match_the_browser_build(self, _):
        self.make_runs()
        before = self.state()
        user = self.users["physicist"]
        for body, message in CASES["refused"]:
            with self.subTest(body=body), self.assertRaises(PortalError) as caught:
                service.record_history(self.db, user, body)
            self.assertEqual(str(caught.exception), message)
        for value in CASES["bad_dates"]:
            with self.subTest(until=value), self.assertRaises(PortalError) as caught:
                service.record_history(self.db, user, {"until": value, "dry_run": True})
            self.assertEqual(str(caught.exception), "until: give a date as YYYY-MM-DD.")
        with self.assertRaisesRegex(PortalError, "^That schedule is not on that machine.$"):
            service.record_history(self.db, user, {"until": "2026-10-03", "machine_id": self.gantry_b, "assignment_id": self.daily_a})
        for value in CASES["good_dates"]:
            service.record_history(self.db, user, {"until": value, "dry_run": True})
        self.assertEqual(service.record_history(self.db, user, {"until": "2026-10-03", "machine_id": float(self.gantry_b), "dry_run": True})["count"], 1)
        self.assertEqual(self.state(), before)

    def test_history_before_splits_one_import(self, _):
        admin = self.users["admin"]
        # historical is ignored once history_before is given, whichever way it is set; a file dated exactly on it waits.
        for historical in (True, False, None):
            files = [upload(f"split-{n}.xls", fake_file(f"rh-split-{historical}-{n}", finished=day(n))) for n in (4, 2, 3)]
            body = {"files": files, "history_before": "2026-10-03", **({} if historical is None else {"historical": historical})}
            result = service.import_sphinx_uploads(self.db, admin, self.daily_a, body)
            self.assertEqual([x["qa_date"] for x in result["imported"]], ["2026-10-04", "2026-10-02", "2026-10-03"])
            ids = [x["run_id"] for x in sorted(result["imported"], key=lambda x: x["qa_date"])]
            rows = [self.run_row(i) for i in ids]
            self.assertEqual([(x["review_status"], x["therapist_approval_required"]) for x in rows], [("imported", 0), ("pending", 1), ("pending", 1)])
        # Each half is exactly what historical: true / false gives for the same values (another file, another machine).
        same = lambda n, historical: self.imp(self.daily_b, f"same-{n}-{historical}", n, historical=historical)
        shape = lambda run_id: [(x["name"], x["value_num"], x["expected"], x["warn"], x["fail"], x["tol_mode"], x["status"], x["comment"])
                                for x in service.get_run(self.db, admin, run_id)["results"]]
        self.assertEqual(shape(ids[0]), shape(same(2, True)))
        self.assertEqual(shape(ids[1]), shape(same(3, False)))
        self.assertEqual(shape(ids[2]), shape(same(4, False)))
        self.assertNotEqual(shape(ids[0]), shape(ids[1]))   # the synthetic dose is judged differently by the two rules
        # Without it (or null) nothing changes: historical decides.
        later = upload("later.xls", fake_file("rh-later", finished=day(6)))
        result = service.import_sphinx_uploads(self.db, admin, self.daily_a, {"files": [later], "history_before": None, "historical": False})
        self.assertEqual(self.run_row(result["imported"][0]["run_id"])["review_status"], "pending")
        result = service.import_sphinx_uploads(self.db, admin, self.daily_a, {"files": [upload("later2.xls", fake_file("rh-later2", finished=day(6)))]})
        self.assertEqual(self.run_row(result["imported"][0]["run_id"])["review_status"], "imported")

    def test_history_before_refusals(self, _):
        admin, file = self.users["admin"], upload("x.xls", fake_file("rh-refused", finished=day(2)))
        count = lambda: self.db.one("SELECT COUNT(*) AS n FROM runs")["n"]
        for value in CASES["bad_dates"]:
            with self.subTest(history_before=value), self.assertRaises(PortalError) as caught:
                service.import_sphinx_uploads(self.db, admin, self.daily_a, {"files": [file], "history_before": value})
            self.assertEqual(str(caught.exception), "history_before: give a date as YYYY-MM-DD.")
        with self.assertRaisesRegex(PortalError, "^history_before: give a date as YYYY-MM-DD.$"):
            service.import_sphinx_uploads(self.db, admin, self.daily_a, {"files": [], "history_before": "2026-10-32"})
        with self.assertRaisesRegex(PortalError, "^Choose one or more Sphinx .xls files.$"):
            service.import_sphinx_uploads(self.db, admin, self.daily_a, {"files": [], "history_before": "2026-10-03"})
        for user in (self.users["therapist"], self.users["mpa"], auth.act_as(admin, "therapist")):
            with self.assertRaisesRegex(PortalError, f"^{REFUSED}$"):
                service.import_sphinx_uploads(self.db, user, self.daily_a, {"files": [file], "history_before": "bad"})
        self.assertEqual(count(), 0)
        for value in CASES["good_dates"]:
            service.import_sphinx_uploads(self.db, admin, self.daily_a, {"files": [upload(f"{value}.xls", fake_file(f"rh-good-{value}", finished=day(2)))],
                                                                         "history_before": value})
        self.assertEqual(count(), len(CASES["good_dates"]))


@mock.patch("portal.sphinx.read_rows", side_effect=fake_read_rows)
class RecordHistoryHttpTests(unittest.TestCase):
    """The route on the HTTP server, with View As (X-Act-As-Role) as the app sends it."""

    def setUp(self):
        self.db = Database(":memory:")
        self.users = make_users(self.db)
        admin = self.users["admin"]
        machine = service.save_machine(self.db, admin, {"name": "Synthetic Gantry H"})["id"]
        queue = service.save_queue(self.db, admin, {"name": "Synthetic Sphinx daily H"})["id"]
        self.assignment = service.save_assignment(self.db, admin, {"machine_id": machine, "queue_id": queue, "frequency": "daily"})["id"]
        self.addCleanup(setattr, PortalServer, "current", PortalServer.current)
        self.server = PortalServer(("127.0.0.1", 0), self.db)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.db.close)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        quiet = mock.patch.object(Handler, "log_message")
        quiet.start()
        self.addCleanup(quiet.stop)

    def post(self, path, body, username, act_as=None):
        token = auth.create_session(self.db, self.users[username]["id"])
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_address[1], timeout=10)
        headers = {"Content-Type": "application/json", "X-Portal": "1", "Cookie": f"{COOKIE}={token}"}
        if act_as:
            headers["X-Act-As-Role"] = act_as
        conn.request("POST", path, json.dumps(body), headers)
        response = conn.getresponse()
        answer = (response.status, json.loads(response.read()))
        conn.close()
        return answer

    def test_route_permissions_and_split_import(self, _):
        files = [upload(f"h-{n}.xls", fake_file(f"rh-http-{n}", finished=day(n))) for n in (1, 2, 3)]
        status, result = self.post(f"/api/assignments/{self.assignment}/sphinx/import", {"files": files, "history_before": "2026-10-02"}, "admin")
        self.assertEqual(status, 200, result)
        statuses = [self.db.one("SELECT review_status FROM runs WHERE id = ?", (x["run_id"],))["review_status"] for x in result["imported"]]
        self.assertEqual(statuses, ["imported", "pending", "pending"])
        self.assertEqual(self.post(f"/api/assignments/{self.assignment}/sphinx/import", {"files": files, "history_before": "2026-10-2"}, "admin"),
                         (400, {"error": "history_before: give a date as YYYY-MM-DD."}))
        body = {"until": "2026-10-02", "dry_run": True}
        for username, act_as in (("therapist", None), ("mpa", None), ("admin", "therapist"), ("admin", "mpa")):
            self.assertEqual(self.post("/api/runs/record-history", body, username, act_as), (403, {"error": REFUSED}))
        self.assertEqual(self.post("/api/runs/record-history", {"until": "2026-10-02", "machine_id": 999999}, "physicist"),
                         (404, {"error": "Machine not found."}))
        self.assertEqual(self.post("/api/runs/record-history", body, "physicist"), (200, {"count": 1, "runs": [result["imported"][1]["run_id"]]}))
        self.assertEqual(self.post("/api/runs/record-history", {"until": "2026-10-03"}, "admin", "physicist"), (200, {"count": 2}))
        entry = self.db.one("SELECT * FROM audit WHERE action = 'record_history' ORDER BY id DESC LIMIT 1")
        self.assertEqual((entry["user_id"], json.loads(entry["detail"])["acting_role"]), (self.users["admin"]["id"], "physicist"))
        self.assertEqual(self.db.one("SELECT COUNT(*) AS n FROM runs WHERE review_status = 'pending'")["n"], 0)


if __name__ == "__main__":
    unittest.main()
