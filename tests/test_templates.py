"""Template QA lists and per-list check ownership. Synthetic data only."""

import unittest

from portal import service
from portal.db import Database
from portal.service import PortalError
from tests.test_portal import make_users


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.users = make_users(self.db)
        self.admin = self.users["admin"]
        self.machine = service.save_machine(self.db, self.admin, {"name": "Synthetic GTR"})["id"]
        self.template = service.save_queue(self.db, self.admin, {"name": "Daily template", "is_template": True, "description": "Setup steps."})["id"]
        self.door = service.save_test(self.db, self.admin, {"name": "Safety – Door interlock", "category": "Safety", "type": "boolean",
                                                            "owner_queue_id": self.template})["id"]
        self.depth = service.save_test(self.db, self.admin, {"name": "Energy 100 MeV – Distal depth", "category": "Energy", "unit": "mm",
                                                             "expected": 77.8, "warn": 0.5, "fail": 1.0, "owner_queue_id": self.template})["id"]
        service.save_queue(self.db, self.admin, {"name": "Daily template", "is_template": True, "description": "Setup steps.",
                                                 "items": [{"test_id": self.door}, {"test_id": self.depth, "warn": 0.4}]}, self.template)

    def test_template_cannot_be_scheduled(self):
        with self.assertRaisesRegex(PortalError, "template"):
            service.save_assignment(self.db, self.admin, {"machine_id": self.machine, "queue_id": self.template, "frequency": "daily"})

    def test_duplicate_copies_checks_with_effective_limits(self):
        copy = service.duplicate_queue(self.db, self.admin, self.template, {"name": "Daily QA – Synthetic GTR", "machine_id": self.machine,
                                                                            "frequency": "daily", "weekdays": [0, 1, 2, 3, 4]})
        self.assertIn("assignment_id", copy)
        q = service.get_queue(self.db, self.admin, copy["id"])
        self.assertEqual((q["template_id"], q["is_template"], q["description"]), (self.template, 0, "Setup steps."))
        self.assertEqual([i["name"] for i in q["items"]], ["Safety – Door interlock", "Energy 100 MeV – Distal depth"])
        self.assertNotIn(self.depth, [i["test_id"] for i in q["items"]])  # its own copies, not the template's checks
        owned = self.db.all("SELECT * FROM tests WHERE owner_queue_id = ? ORDER BY id", (copy["id"],))
        self.assertEqual((owned[1]["warn"], owned[1]["expected"]), (0.4, 77.8))  # the template's queue-level tweak is folded in
        # Changing the copy leaves the template untouched.
        service.save_test(self.db, self.admin, {**owned[1], "warn": 0.3}, owned[1]["id"])
        self.assertEqual(self.db.one("SELECT warn FROM tests WHERE id = ?", (self.depth,))["warn"], 0.5)
        with self.assertRaisesRegex(PortalError, "already exists"):
            service.duplicate_queue(self.db, self.admin, self.template, {"name": "Daily QA – Synthetic GTR"})

    def test_checks_stay_with_their_list(self):
        other = service.save_queue(self.db, self.admin, {"name": "Other list"})["id"]
        with self.assertRaisesRegex(PortalError, "belongs to another"):
            service.save_queue(self.db, self.admin, {"name": "Other list", "items": [{"test_id": self.door}]}, other)
        shared = service.save_test(self.db, self.admin, {"name": "Shared note", "type": "text"})["id"]
        service.save_queue(self.db, self.admin, {"name": "Other list", "items": [{"test_id": shared}]}, other)
        # Same name is fine in a different list, but not twice in one list.
        service.save_test(self.db, self.admin, {"name": "Safety – Door interlock", "category": "Safety", "type": "boolean", "owner_queue_id": other})
        with self.assertRaisesRegex(PortalError, "already exists"):
            service.save_test(self.db, self.admin, {"name": "Safety – Door interlock", "category": "Safety", "type": "boolean", "owner_queue_id": self.template})
        listed = {t["name"]: t["owner_name"] for t in service.list_tests(self.db, self.admin)}
        self.assertEqual((listed["Shared note"], listed["Energy 100 MeV – Distal depth"]), (None, "Daily template"))

    def test_scheduled_list_cannot_become_template(self):
        copy = service.duplicate_queue(self.db, self.admin, self.template, {"name": "On a machine", "machine_id": self.machine, "frequency": "daily"})
        with self.assertRaisesRegex(PortalError, "cannot become a template"):
            service.save_queue(self.db, self.admin, {"name": "On a machine", "is_template": True}, copy["id"])

    def test_therapist_cannot_duplicate(self):
        with self.assertRaises(PortalError):
            service.duplicate_queue(self.db, self.users["therapist"], self.template, {"name": "Nope"})


class MigrationTests(unittest.TestCase):
    def test_seed_defaults_loads_every_machine_once(self):
        db = Database(":memory:")
        users = make_users(db)
        result = service.seed_defaults(db, users["admin"])
        self.assertEqual(result["machines"], ["GTR1", "GTR2", "GTR5", "TrueBeam", "Linac 1", "Ethos", "Big Bore CT (7064)", "MRI Sim"])
        lists = {q["name"]: q for q in service.list_queues(db, users["admin"])}
        self.assertIn("Daily QA – TrueBeam", lists)
        self.assertIn("SRS QA – TrueBeam", lists)
        self.assertTrue(lists["Daily QA template – TrueBeam (TG-142 / TG-198)"]["is_template"])
        truebeam = next(m for m in service.list_machines(db, users["admin"]) if m["name"] == "TrueBeam")
        schedules = {a["queue_name"]: a for a in service.list_assignments(db, users["admin"], truebeam["id"])}
        self.assertEqual(schedules["SRS QA – TrueBeam"]["frequency"], "asneeded")
        self.assertEqual(schedules["Daily QA – TrueBeam"]["frequency"], "daily")
        items = service.run_template(db, users["admin"], schedules["Daily QA – TrueBeam"]["id"])["items"]
        self.assertEqual(len(items), 25)
        self.assertEqual(items[0]["type"], "status")
        with self.assertRaisesRegex(PortalError, "already has machines"):
            service.seed_defaults(db, users["admin"])
        with self.assertRaisesRegex(PortalError, "permission"):
            service.seed_defaults(Database(":memory:"), users["therapist"])

    def test_old_tests_table_is_rebuilt(self):
        import sqlite3
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp, "old.db"))
            db = Database(path)
            db.close()
            raw = sqlite3.connect(path)
            raw.executescript("""
                DROP TABLE tests;
                CREATE TABLE tests (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
                    type TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
                    expected REAL, warn REAL, fail REAL, tol_mode TEXT NOT NULL DEFAULT 'absolute', active INTEGER NOT NULL DEFAULT 1,
                    UNIQUE (category, name));
                INSERT INTO tests (name, category, type, expected) VALUES ('Old check', 'Energy', 'numeric', 1.0);
                ALTER TABLE queues DROP COLUMN template_id;
                ALTER TABLE queues DROP COLUMN is_template;
            """)
            raw.commit()
            raw.close()
            db = Database(path)
            row = db.one("SELECT name, owner_queue_id FROM tests")
            self.assertEqual((row["name"], row["owner_queue_id"]), ("Old check", None))
            self.assertIn("is_template", {r["name"] for r in db.all("PRAGMA table_info(queues)")})
            db.close()


if __name__ == "__main__":
    unittest.main()


class ArchiveDeleteTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.users = make_users(self.db)
        self.admin = self.users["admin"]
        self.machine = service.save_machine(self.db, self.admin, {"name": "Synthetic GTR"})["id"]
        self.queue = service.save_queue(self.db, self.admin, {"name": "Synthetic list"})["id"]
        test = service.save_test(self.db, self.admin, {"name": "Door", "type": "boolean", "owner_queue_id": self.queue})["id"]
        service.save_queue(self.db, self.admin, {"name": "Synthetic list", "items": [{"test_id": test}]}, self.queue)
        self.assignment = service.save_assignment(self.db, self.admin, {"machine_id": self.machine, "queue_id": self.queue, "frequency": "daily",
                                                                        "weekdays": list(range(7)), "start_date": "2026-01-01"})["id"]
        self.test = test

    def test_archive_hides_and_restore_brings_back(self):
        service.archive_queue(self.db, self.admin, self.queue, {"archived": True})
        self.assertEqual(service.dashboard(self.db, self.admin)["machines"][0]["queues"], [])
        self.assertEqual(self.db.one("SELECT active FROM queues WHERE id = ?", (self.queue,))["active"], 0)
        service.archive_queue(self.db, self.admin, self.queue, {"archived": False})
        self.assertEqual(len(service.dashboard(self.db, self.admin)["machines"][0]["queues"]), 1)
        with self.assertRaises(PortalError):
            service.archive_queue(self.db, self.users["therapist"], self.queue, {"archived": True})

    def test_delete_only_without_results(self):
        service.submit_run(self.db, self.users["therapist"], self.assignment, {"results": [{"test_id": self.test, "value": "pass"}]})
        with self.assertRaisesRegex(PortalError, "Archive it instead"):
            service.delete_queue(self.db, self.admin, self.queue)
        empty = service.save_queue(self.db, self.admin, {"name": "Unused list"})["id"]
        service.delete_queue(self.db, self.admin, empty)
        self.assertIsNone(self.db.one("SELECT id FROM queues WHERE id = ?", (empty,)))
