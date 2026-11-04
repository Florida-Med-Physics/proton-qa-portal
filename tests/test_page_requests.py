"""Fewer requests per page, same answers, in the server build (synthetic machines, lists and results only).

GET /api/assignments is every machine's GET /api/machines/:id/assignments, machine by machine in GET /api/machines
order, so Setup QA, Machines, Machine Trends and Data Administration ask once instead of once per machine.
POST /api/assignments/:id/runs with clear_draft: true (the QA form's Submit) also clears that person's draft of that
list, in the same transaction, and says so (draft_cleared); without it nothing else changes. The browser build is
checked the same way, with the pages themselves, in tests/test_page_requests.cjs."""
import http.client
import json
import threading
import unittest
from datetime import date, timedelta
from urllib.parse import quote

from portal import service
from portal.db import Database
from portal.server import PortalServer
from portal.service import PortalError
from tests.test_portal import PASSWORD, make_users


def seeded():
    """The seeded machines and lists, with an archived list and a retired machine that has history."""
    db = Database(":memory:")
    users = make_users(db)
    admin = users["admin"]
    service.seed_defaults(db, admin)
    machines = service.list_machines(db, admin)
    gtr1 = next(m for m in machines if m["name"] == "GTR1")
    lists = service.list_assignments(db, admin, gtr1["id"])
    daily = next(a for a in lists if "PBS DailyQA" in a["queue_name"])
    other = next(a for a in lists if a["id"] != daily["id"])
    service.archive_assignment(db, admin, other["id"], {"archived": True})
    retired = next(m for m in machines if m["name"] not in ("GTR1",) and service.list_assignments(db, admin, m["id"]))
    template = service.run_template(db, admin, service.list_assignments(db, admin, retired["id"])[0]["id"])
    service.submit_run(db, admin, template["assignment"]["id"], {"qa_date": date.today().isoformat(), "results": []})
    service.save_machine(db, admin, {**retired, "active": 0}, retired["id"])
    return db, users, daily


class AllAssignmentsTests(unittest.TestCase):
    def test_every_machine_list_in_one_reply(self):
        db, users, _ = seeded()
        self.addCleanup(db.close)
        for role in ("admin", "physicist", "therapist", "mpa"):
            user = users[role]
            machines = service.list_machines(db, user)
            expected = [row for m in machines for row in service.list_assignments(db, user, m["id"])]
            everything = service.list_all_assignments(db, user)
            self.assertEqual(everything, expected)
            for m in machines:   # what a page picks out for one machine is that machine's own reply, in its order
                self.assertEqual([a for a in everything if a["machine_id"] == m["id"]], service.list_assignments(db, user, m["id"]))
        self.assertTrue(any(a["archived"] for a in everything))
        self.assertTrue(any(not m["active"] for m in machines))


class ClearDraftTests(unittest.TestCase):
    def setUp(self):
        self.db, self.users, self.daily = seeded()
        self.addCleanup(self.db.close)
        self.other = next(a for a in service.list_all_assignments(self.db, self.users["admin"]) if a["active"] and a["id"] != self.daily["id"])

    def draft(self, role, assignment):
        service.save_draft(self.db, self.users[role], assignment["id"], {"qa_date": date.today().isoformat(), "comment": f"synthetic {role}", "results": []})

    def drafts(self):
        return {(r["assignment_id"], r["user_id"]) for r in self.db.all("SELECT assignment_id, user_id FROM drafts")}

    def submit(self, role, assignment, **extra):
        return service.submit_run(self.db, self.users[role], assignment["id"], {"qa_date": date.today().isoformat(), "results": [], **extra})

    def test_submit_clears_only_its_own_draft_when_asked(self):
        for role in ("therapist", "physicist"):
            self.draft(role, self.daily)
        self.draft("therapist", self.other)
        mine = (self.daily["id"], self.users["therapist"]["id"])
        before = self.drafts()
        # Without clear_draft (Sphinx import, monthly Excel import, other callers): the draft stays, the reply is as before.
        plain = self.submit("therapist", self.daily)
        self.assertEqual(set(plain), {"id", "overall"})
        self.assertEqual(self.drafts(), before)
        # Only true counts.
        for value in ("true", 1, "1", None, False):
            self.assertNotIn("draft_cleared", self.submit("therapist", self.daily, clear_draft=value))
            self.assertEqual(self.drafts(), before)
        runs = self.db.one("SELECT COUNT(*) AS n FROM runs")["n"]
        result = self.submit("therapist", self.daily, clear_draft=True)
        self.assertEqual(result, {"id": result["id"], "overall": result["overall"], "draft_cleared": True})
        self.assertEqual(self.db.one("SELECT COUNT(*) AS n FROM runs")["n"], runs + 1)
        self.assertEqual(self.drafts(), before - {mine})   # the other person's draft and this person's other list stay
        self.assertIsNone(service.get_draft(self.db, self.users["therapist"], self.daily["id"]))

    def test_refused_submit_keeps_the_draft(self):
        self.draft("therapist", self.daily)
        before, runs = self.drafts(), self.db.one("SELECT COUNT(*) AS n FROM runs")["n"]
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        with self.assertRaises(PortalError):
            service.submit_run(self.db, self.users["therapist"], self.daily["id"], {"qa_date": tomorrow, "results": [], "clear_draft": True})
        self.assertEqual((self.drafts(), self.db.one("SELECT COUNT(*) AS n FROM runs")["n"]), (before, runs))

    def test_run_and_cleared_draft_commit_together(self):
        # If clearing the draft fails, the run is not recorded either, so the person's error is never a run already saved.
        self.draft("therapist", self.daily)
        before, runs = self.drafts(), self.db.one("SELECT COUNT(*) AS n FROM runs")["n"]
        real = self.db.run
        def run(sql, params=()):
            if sql.startswith("DELETE FROM drafts"):
                raise RuntimeError("synthetic failure")
            return real(sql, params)
        self.db.run = run
        try:
            with self.assertRaises(RuntimeError):
                self.submit("therapist", self.daily, clear_draft=True)
        finally:
            self.db.run = real
        self.assertEqual((self.drafts(), self.db.one("SELECT COUNT(*) AS n FROM runs")["n"]), (before, runs))


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.db, self.users, self.daily = seeded()
        self.server = PortalServer(("127.0.0.1", 0), self.db)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.db.close()

    def fetch(self, method, path, body=None, cookie=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_address[1], timeout=10)
        headers = {"Content-Type": "application/json", "X-Portal": "1", **({"Cookie": cookie} if cookie else {})}
        conn.request(method, path, json.dumps(body) if body is not None else None, headers)
        response = conn.getresponse()
        raw = response.read()
        conn.close()
        return response, json.loads(raw)

    def request(self, method, path, body=None, cookie=None):
        response, data = self.fetch(method, path, body, cookie)
        self.assertEqual(response.status, 200, data)
        return response, data

    def login(self, username):
        response, _ = self.request("POST", "/api/login", {"username": username, "password": PASSWORD})
        return response.getheader("Set-Cookie").split(";")[0]

    def test_batch_answers_each_path_as_on_its_own(self):
        batch = lambda paths, cookie: self.fetch("GET", "/api/batch?paths=" + quote(json.dumps(paths)), cookie=cookie)
        mix = ["/api/machines", f"/api/assignments/{self.daily['id']}/template", "/api/runs?limit=3", "/api/users", "/api/trend?machine_id=1",
               "/api/nothing", "/api/queues/999999", "/api/assignments", f"/api/machines/{self.daily['machine_id']}/trends?page=start"]
        for role in ("therapist", "admin"):
            cookie = self.login(role)
            each = []
            for path in mix:
                response, data = self.fetch("GET", path, cookie=cookie)
                each.append({"ok": True, "value": data} if response.status == 200 else {"ok": False, "error": data["error"]})
            response, data = batch(mix, cookie)
            self.assertEqual((response.status, data), (200, each))
            self.assertTrue(any(r["ok"] for r in each) and not all(r["ok"] for r in each))
        refused = ["/api/me", "/api/batch", "/api/backup", "/api/dbfile", "/api/dbinfo", f"/api/assignments/{self.daily['id']}/draft",
                   f"/api/assignments/{self.daily['id']}/files", f"/api/assignments/{self.daily['id']}/file?path=x"]
        self.assertEqual(batch(refused, cookie)[1], [{"ok": False, "error": f"{p.split('?')[0]} cannot be asked for in a batch."} for p in refused])
        for bad in (None, "", "x", "[]", "{}", "[1]", '["api/machines"]', json.dumps(["/api/machines"] * 21)):
            response, data = self.fetch("GET", "/api/batch" + ("" if bad is None else "?paths=" + quote(bad)), cookie=cookie)
            self.assertEqual((response.status, data), (400, {"error": "paths: give a JSON list of 1 to 20 paths, each starting /api/."}))
        self.assertEqual(self.fetch("GET", "/api/batch?paths=" + quote('["/api/machines"]'))[0].status, 401)

    def test_pages_requests(self):
        cookie = self.login("therapist")
        _, machines = self.request("GET", "/api/machines", cookie=cookie)
        _, everything = self.request("GET", "/api/assignments", cookie=cookie)
        each = [row for m in machines for row in self.request("GET", f"/api/machines/{m['id']}/assignments", cookie=cookie)[1]]
        self.assertEqual(everything, each)
        path = f"/api/assignments/{self.daily['id']}"
        self.request("PUT", f"{path}/draft", {"qa_date": date.today().isoformat(), "comment": "synthetic", "results": []}, cookie)
        _, result = self.request("POST", f"{path}/runs", {"qa_date": date.today().isoformat(), "results": [], "clear_draft": True}, cookie)
        self.assertIs(result["draft_cleared"], True)
        self.assertIsNone(self.request("GET", f"{path}/draft", cookie=cookie)[1])


if __name__ == "__main__":
    unittest.main()
