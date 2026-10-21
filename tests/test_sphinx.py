"""Sphinx import tests. Report grids are synthetic, shaped like the myQA export layout."""

import base64
import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import run_portal
from portal import service, sphinx
from portal.db import Database
from portal.service import PortalError
from tests.test_portal import make_users


def grid(offset=0, finished="10/21/2026 5:35:11 AM", intensity="71.75 %", intensity_status="Failed", dose="101.500 cGy"):
    """A small report. offset shifts the result columns, as the G5 export does relative to G1."""
    o = offset

    def measure(metric, warn, fail, expected, result, status, setup=None):
        cells = [(4, setup[0]), (6, setup[1])] if setup else []
        return cells + [(9, metric), (16 + o, warn), (18 + o, fail), (22 + o, expected), (24 + o, result), (28 + o, status)]

    return [
        [(0, "synthetic-site"), (13 + o, "GX")],
        [],
        [(0, "Test Name"), (2, "User\nFinishing Date"), (4, "Setup"), (7, "Acceptance Criteria")],
        [(0, "Sphinx"), (2, "synthetic-user"), (4, "Image")],
        [(0, "Other"), (2, finished)],
        [(4, "Integration Time"), (11, "90.000 sec")],
        [(4, "Energy")],
        [(28 + o, "Passed")],
        [(4, "Energy [100.00 MeV]")],
        measure("Distal Depth", "± 0.9 mm", "± 1.0 mm", "77.8 mm", "77.7 mm", "Passed", ("X Start", "71.0 mm")),
        measure("DFO", "± 0.9 mm", "± 1.0 mm", "2.1 mm", "2.1 mm", "Passed", ("X Stop", "98.0 mm")),
        [(4, "Wedge Thickness")],
        [(4, "34.0 mm / 58.0 mm")],
        [(4, "Spot")],
        [(4, "Spot 1 [ 120 MeV ]")],
        measure("Intensity", "± 2.50 %", "± 3.00 %", "68.36 %", intensity, intensity_status),
        measure("Skewness X", "± 0.250 ", "± 0.300 ", "0.000 ", "0.086 ", "Passed"),
        [(4, "Output")],
        [(28 + o, "Passed")],
        measure("Absolute Dose", "± 1.00 %", "± 2.00 %", "100.000 cGy", dose, "Passed", ("PPC-05", "")),
        [(14, "Date"), (21, "Name / Signature")],
    ]


EXPECTED_NAMES = [
    ("Energy", "Energy [100.00 MeV] – Distal Depth"),
    ("Energy", "Energy [100.00 MeV] – DFO"),
    ("Spot", "Spot 1 [120 MeV] – Intensity"),
    ("Spot", "Spot 1 [120 MeV] – Skewness X"),
    ("Output", "PPC-05 – Absolute Dose"),
]


def drop_empty(rows):
    return [[(c, t) for c, t in row if t] for row in rows]


class ParserTests(unittest.TestCase):
    def test_g1_and_g5_layouts_parse_the_same(self):
        for offset in (0, 1):
            parsed = sphinx.parse_rows(drop_empty(grid(offset)))
            self.assertEqual([(m["category"], m["name"]) for m in parsed["measurements"]], EXPECTED_NAMES)
            self.assertEqual((parsed["qa_date"], parsed["sphinx_user"]), ("2026-10-21", "synthetic-user"))
        m = {x["name"]: x for x in parsed["measurements"]}
        self.assertEqual(m["Energy [100.00 MeV] – Distal Depth"],
                         {**m["Energy [100.00 MeV] – Distal Depth"], "expected": 77.8, "result": 77.7, "warn": 0.9, "fail": 1.0,
                          "unit": "mm", "tol_mode": "absolute", "sphinx_status": "Passed"})
        self.assertEqual((m["Spot 1 [120 MeV] – Intensity"]["unit"], m["Spot 1 [120 MeV] – Intensity"]["tol_mode"]), ("%", "absolute"))
        self.assertEqual(m["Spot 1 [120 MeV] – Skewness X"]["unit"], "")
        self.assertEqual((m["PPC-05 – Absolute Dose"]["unit"], m["PPC-05 – Absolute Dose"]["tol_mode"]), ("cGy", "percent"))

    def test_date_from_filename_and_errors(self):
        rows = drop_empty(grid(finished="not a date"))
        self.assertEqual(sphinx.parse_rows(rows, "GTR1_DailyQA_09152026_b.xls")["qa_date"], "2026-09-15")
        with self.assertRaisesRegex(sphinx.SphinxError, "QA date"):
            sphinx.parse_rows(rows, "unnamed.xls")
        skipped = [[(0, "site")], [(0, "tests"), (20, "Skipped")], [(4, "Setup")]]
        with self.assertRaisesRegex(sphinx.SphinxError, "Skipped"):
            sphinx.parse_rows(skipped)
        with self.assertRaisesRegex(sphinx.SphinxError, "empty"):
            sphinx.read_rows(b"")

    def test_quantity(self):
        self.assertEqual(sphinx.quantity("± 0.9 mm"), (0.9, "mm"))
        self.assertEqual(sphinx.quantity("-49.4 mm"), (-49.4, "mm"))
        self.assertEqual(sphinx.quantity("0.086 "), (0.086, ""))
        self.assertIsNone(sphinx.quantity("Passed"))


GRIDS = {}


def fake_file(name, **kwargs):
    data = f"synthetic:{name}".encode()
    GRIDS[data] = drop_empty(grid(**kwargs))
    return data


def upload(name, data):
    return {"name": name, "data": base64.b64encode(data).decode()}


def fake_read_rows(data):
    if data not in GRIDS:
        raise sphinx.SphinxError("Not a readable .xls file.")
    return GRIDS[data]


@mock.patch("portal.sphinx.read_rows", side_effect=fake_read_rows)
class ImportTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.users = make_users(self.db)
        admin = self.users["admin"]
        machine = service.save_machine(self.db, admin, {"name": "Synthetic Gantry"})["id"]
        self.queue = service.save_queue(self.db, admin, {"name": "Synthetic Sphinx daily"})["id"]
        self.assignment = service.save_assignment(self.db, admin, {"machine_id": machine, "queue_id": self.queue, "frequency": "daily",
                                                                   "weekdays": list(range(7)), "start_date": "2026-01-01"})["id"]

    def test_fill_flow(self, _):
        day = upload("GTR1_DailyQA_10212026.xls", fake_file("fill"))
        preview = service.sphinx_preview(self.db, self.users["therapist"], self.assignment, day)
        self.assertEqual((len(preview["matched"]), len(preview["unmatched"])), (0, 5))
        with self.assertRaises(PortalError):
            service.sphinx_add_tests(self.db, self.users["therapist"], self.assignment, day)
        added = service.sphinx_add_tests(self.db, self.users["physicist"], self.assignment, day)["added"]
        self.assertEqual(len(added), 5)
        preview = service.sphinx_preview(self.db, self.users["therapist"], self.assignment, day)
        self.assertEqual((len(preview["matched"]), preview["unmatched"]), (5, []))
        self.assertFalse(any(m["limits_differ"] for m in preview["matched"]))
        results = [{"test_id": m["test_id"], "value": m["value"]} for m in preview["matched"]]
        run = service.submit_run(self.db, self.users["therapist"], self.assignment,
                                 {"qa_date": preview["qa_date"], "results": results, "source_ref": preview["source_ref"]})
        stored = service.get_run(self.db, self.users["admin"], run["id"])
        self.assertEqual((stored["source"], stored["review_status"], stored["overall"]), ("sphinx", "pending", "fail"))
        with self.assertRaisesRegex(PortalError, "already recorded"):
            service.submit_run(self.db, self.users["therapist"], self.assignment,
                               {"qa_date": preview["qa_date"], "results": results, "source_ref": preview["source_ref"]})
        self.assertEqual(service.sphinx_preview(self.db, self.users["therapist"], self.assignment, day)["duplicate_run"], run["id"])

    def test_bulk_import_keeps_file_verdicts(self, _):
        files = [("a.xls", fake_file("a")), ("b.xls", fake_file("b", finished="10/22/2026 6:00:00 AM", intensity="68.0 %", intensity_status="Passed")),
                 ("a-copy.xls", fake_file("a")), ("bad.xls", b"not a report")]
        result = service.import_sphinx(self.db, self.users["physicist"], self.assignment, files)
        self.assertEqual([r["file"] for r in result["imported"]], ["a.xls", "b.xls"])
        self.assertEqual({s["file"] for s in result["skipped"]}, {"a-copy.xls", "bad.xls"})
        self.assertIn("already recorded", result["skipped"][0]["reason"])
        run = service.get_run(self.db, self.users["admin"], result["imported"][0]["run_id"])
        self.assertEqual((run["review_status"], run["qa_date"], run["overall"]), ("imported", "2026-10-21", "fail"))
        dose = next(r for r in run["results"] if r["name"] == "PPC-05 – Absolute Dose")
        # 101.5 vs 100 is outside the ±1 % warning on the rounded value, but Sphinx said Passed; Sphinx's verdict is kept.
        self.assertEqual((dose["status"], dose["tol_mode"], dose["warn"]), ("pass", "percent", 1.0))
        self.assertIn("portal rule", dose["comment"])
        self.assertEqual(service.get_run(self.db, self.users["admin"], result["imported"][1]["run_id"])["overall"], "pass")
        self.assertEqual(service.dashboard(self.db, self.users["admin"])["machines"][0]["pending_review"], 0)
        with self.assertRaises(PortalError):
            service.import_sphinx(self.db, self.users["therapist"], self.assignment, files)

    def test_upload_endpoint_validation(self, _):
        with self.assertRaisesRegex(PortalError, "Choose"):
            service.import_sphinx_uploads(self.db, self.users["admin"], self.assignment, {"files": []})
        with self.assertRaisesRegex(PortalError, "could not be read"):
            service.import_sphinx_uploads(self.db, self.users["admin"], self.assignment, {"files": [{"name": "x", "data": "@@@"}]})
        result = service.import_sphinx_uploads(self.db, self.users["admin"], self.assignment,
                                               {"files": [upload("u.xls", fake_file("u"))], "historical": False})
        run = service.get_run(self.db, self.users["admin"], result["imported"][0]["run_id"])
        self.assertEqual(run["review_status"], "pending")


@mock.patch("portal.sphinx.read_rows", side_effect=fake_read_rows)
class CommandLineTests(unittest.TestCase):
    def test_import_folder_with_create(self, _):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp, "exports", "10 October")
            folder.mkdir(parents=True)
            Path(folder, "GTR5_10212026.xls").write_bytes(fake_file("cli1"))
            Path(folder, "GTR5_10222026.xls2.xls").write_bytes(fake_file("cli2", finished="10/22/2026 6:00:00 AM"))
            Path(folder, "notes.txt").write_text("ignored")
            db_path = str(Path(tmp, "portal.db"))
            setup_db = Database(db_path)
            make_users(setup_db)
            setup_db.close()
            out = io.StringIO()
            args = ["--db", db_path, "import-sphinx", "--machine", "Synthetic G5", "--queue", "Sphinx daily", "--user", "physicist",
                    "--create", str(Path(tmp, "exports"))]
            with contextlib.redirect_stdout(out):
                run_portal.main(args)
                run_portal.main(args)
            self.assertIn("Done: 2 imported, 0 skipped.", out.getvalue())
            self.assertIn("Done: 0 imported, 2 skipped.", out.getvalue())
            db = Database(db_path)
            self.assertEqual(db.one("SELECT COUNT(*) AS n FROM runs WHERE review_status = 'imported'")["n"], 2)
            self.assertEqual(db.one("SELECT COUNT(*) AS n FROM queue_items")["n"], 5)
            db.close()


if __name__ == "__main__":
    unittest.main()
