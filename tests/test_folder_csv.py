import csv
import io
import unittest
from portal import sphinx
from tests.test_sphinx import grid

class FolderCsvTests(unittest.TestCase):
    def test_csv_preserves_sphinx_values_and_dates(self):
        for delimiter in (",", ";", "\t"):
            output = io.StringIO()
            writer = csv.writer(output, delimiter=delimiter)
            for cells in grid():
                row = [""] * 30
                for col, text in cells:
                    row[col] = text
                writer.writerow(row)
            parsed = sphinx.parse_rows(sphinx.read_rows(output.getvalue().encode("utf-8-sig")), "report.csv")
            self.assertEqual(parsed["qa_date"], "2026-10-21")
            self.assertEqual(len(parsed["measurements"]), 5)
            self.assertEqual(parsed["measurements"][0]["result"], 77.7)
