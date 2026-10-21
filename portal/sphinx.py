"""Read IBA myQA Sphinx daily-QA report exports (.xls, sheet 'ReportTestRepositoryFlatS').

The G1 and G5 exports put the same content one column apart, so rows are read by
their text, not by fixed columns. Each measurement row reads, left to right:
  [setup label] [setup value] metric  ±warning  ±fail  expected  result  Passed/Failed
Section headings ('Energy', 'Spot', ...) and item headings ('Energy [100.81 MeV]',
'Spot 1 [226.18 MeV]', 'PPC-05', ...) sit alone in the Setup column.
"""

import hashlib
import io
import re
from datetime import datetime

CATEGORIES = ("Energy", "Spot", "Coincidence", "Homogeneity", "Output", "Couch Translation")
SETUP_LABELS = {"X Start", "X Stop", "Y Start", "Y Stop", "Wedge Thickness", "Additional Thickness"}
SPHINX_STATUSES = ("Passed", "Failed", "Warning")
_QUANTITY = re.compile(r"^±?\s*([-+]?\d+(?:\.\d+)?)\s*(.*?)\s*$")
_FINISHED = re.compile(r"^\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2}:\d{2} [AP]M$")
_FILE_DATE = re.compile(r"(\d{2})(\d{2})(20\d{2})")
# Setup values such as '0.0 mm' or '34.0 mm / 58.0 mm' (item headings like '100 MeV' are not values).
_SETUP_VALUE = re.compile(r"^[-+]?\d+(?:\.\d+)?\s*(?:mm|cm|°|%|px|sec|pF)?(?:\s*/\s*[-+]?\d+(?:\.\d+)?\s*(?:mm|cm)?)?$")


class SphinxError(ValueError):
    pass


def quantity(text):
    """'± 0.9 mm' -> (0.9, 'mm'); '68.36 %' -> (68.36, '%'); None if not a number."""
    match = _QUANTITY.match(text or "")
    return (float(match[1]), match[2]) if match else None


def _clean_item(text):
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"\s+\]", "]", re.sub(r"\[\s+", "[", text))


def _cell_text(value):
    if isinstance(value, float):
        return f"{value:g}"
    return str(value).strip()


def read_rows(data):
    """Rows of the first sheet as lists of (column, text), skipping empty cells."""
    try:
        import xlrd
    except ImportError as exc:  # pragma: no cover - depends on the install
        raise SphinxError("Reading Sphinx files needs the xlrd package (pip install -r requirements.txt).") from exc
    if not data:
        raise SphinxError("The file is empty.")
    try:
        book = xlrd.open_workbook(file_contents=data, logfile=io.StringIO())
    except Exception as exc:
        raise SphinxError(f"Not a readable .xls file ({exc}).") from exc
    sheet = book.sheet_by_index(0)
    rows = []
    for r in range(sheet.nrows):
        cells = [(c, _cell_text(sheet.cell_value(r, c))) for c in range(sheet.ncols)]
        rows.append([(c, t) for c, t in cells if t])
    return rows


def parse_rows(rows, filename=""):
    setup_col = finished_col = None
    finished = sphinx_user = None
    category = item = None
    measurements = []
    for index, cells in enumerate(rows):
        texts = [t for _, t in cells]
        if setup_col is None:
            setup_col = next((c for c, t in cells if t == "Setup"), None)
        if finished is None:
            for col, text in cells:
                if _FINISHED.match(text):
                    finished, finished_col = datetime.strptime(text, "%m/%d/%Y %I:%M:%S %p"), col
                    above = dict(rows[index - 1]) if index else {}
                    sphinx_user = above.get(col)
        tolerances = [i for i, t in enumerate(texts) if t.startswith("±")]
        setup_text = dict(cells).get(setup_col) if setup_col is not None else None
        if len(tolerances) >= 2:
            if category is None:
                continue
            if setup_text and setup_text not in SETUP_LABELS and not _SETUP_VALUE.match(setup_text):
                item = _clean_item(setup_text)
            first, second = tolerances[0], tolerances[1]
            if first == 0:
                raise SphinxError(f"Row {index + 1}: tolerance without a metric name.")
            after = texts[second + 1:]
            numbers = [q for q in (quantity(t) for t in after) if q]
            if len(numbers) < 2:
                raise SphinxError(f"Row {index + 1}: expected an expected value and a result.")
            warn, fail = quantity(texts[first]), quantity(texts[second])
            (expected, unit), (result, _) = numbers[0], numbers[1]
            tol_mode = "percent" if warn[1] == "%" and unit != "%" else "absolute"
            measurements.append({
                "category": category,
                "item": item or category,
                "metric": texts[first - 1].strip(),
                "unit": unit,
                "expected": expected,
                "result": result,
                "warn": warn[0],
                "fail": fail[0],
                "tol_mode": tol_mode,
                "sphinx_status": next((t for t in after if t in SPHINX_STATUSES), None),
            })
            continue
        if setup_text and len(cells) == 1:
            if setup_text in CATEGORIES and setup_text != category:
                category, item = setup_text, None
            elif category and setup_text not in SETUP_LABELS and not _SETUP_VALUE.match(setup_text):
                item = _clean_item(setup_text)
    for m in measurements:
        m["name"] = m["metric"] if m["item"] == m["category"] else f"{m['item']} – {m['metric']}"
    if finished is None:
        match = _FILE_DATE.search(filename or "")
        if match:
            finished = datetime(int(match[3]), int(match[1]), int(match[2]))
    if not measurements:
        if any(t == "Skipped" for cells in rows[:10] for _, t in cells):
            raise SphinxError("Sphinx marked this session as Skipped; it has no measurements.")
        raise SphinxError("No Sphinx measurements found in this file.")
    if finished is None:
        raise SphinxError("Could not find the QA date in the file or its name.")
    return {
        "finished": finished.isoformat(timespec="seconds"),
        "qa_date": finished.date().isoformat(),
        "sphinx_user": sphinx_user or "",
        "header": " ".join(t for _, t in rows[0]) if rows and rows[0] else "",
        "measurements": measurements,
    }


def parse_file(data, filename=""):
    parsed = parse_rows(read_rows(data), filename)
    parsed["filename"] = filename
    parsed["sha256"] = hashlib.sha256(data).hexdigest()
    return parsed
