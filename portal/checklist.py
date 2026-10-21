"""Read the manual checks from a myQA daily-QA template export (sheet 'WithFullDetails').

Each check starts with a numbered title in column A ('1.01: Door interlock'), followed by its
category ('Safety'), optional instructions, 'Acceptance Criteria', and optionally a table
(Name / Expected/Ref / Warn / Fail). Checks without a table are pass/fail; each table row is a
numeric test. Section 0 (setup instructions) is returned separately; section 3 (Sphinx tests) is
skipped because Sphinx measurements come from the Sphinx exports.
"""

import re

from .sphinx import SphinxError, read_rows

_TITLE = re.compile(r"^(\d+)\.(\d{2}):?\s+(.+)$")
_NUMBER = re.compile(r"[-+]?\d+(?:\.\d+)?")


def _number(text):
    match = _NUMBER.search(text or "")
    return float(match[0]) if match else None


def parse_rows(rows):
    setup, checks, current, header = "", [], None, None
    for cells in rows:
        by_col = dict(cells)
        first = by_col.get(0, "")
        title = _TITLE.match(first)
        if title:
            section, label = int(title[1]), title[3].strip()
            current = {"number": f"{title[1]}.{title[2]}", "section": section, "title": label, "category": None,
                       "instructions": "", "rows": []}
            header = None
            if section == 0:
                current["setup"] = True
            elif section < 3:
                checks.append(current)
            continue
        if current is None or not first:
            continue
        if current.get("setup"):
            if first not in ("Other", "Acceptance Criteria", "Functional") and len(first) > 40:
                setup = first.strip()
            continue
        if current["section"] >= 3:
            continue
        if current["category"] is None:
            current["category"] = first.strip()
        elif first == "Acceptance Criteria":
            continue
        elif first == "Name" and len(cells) > 1:
            header = {t.strip().lower(): c for c, t in cells}
        elif header:
            current["rows"].append({
                "name": first.strip(),
                "expected": _number(by_col.get(header.get("expected/ref"))),
                "warn": _number(by_col.get(header.get("warn"))),
                "fail": _number(by_col.get(header.get("fail"))),
            })
        elif not current["instructions"]:
            current["instructions"] = first.strip()
    if not checks:
        raise SphinxError("No numbered checks found; is this a myQA template export?")
    return {"setup": setup, "checks": checks}


def to_tests(parsed):
    """Portal tests in queue order, named '<Category> – <Check>' or '<Category> – <Check> – <Row>'."""
    tests = []
    for check in parsed["checks"]:
        category = check["category"] or "General"
        description = f"Template {check['number']}." + (f" {check['instructions']}" if check["instructions"] else "")
        if not check["rows"]:
            tests.append({"category": category, "name": f"{category} – {check['title']}", "type": "boolean", "description": description})
        for row in check["rows"]:
            tests.append({"category": category, "name": f"{category} – {check['title']} – {row['name']}", "type": "numeric",
                          "expected": row["expected"], "warn": row["warn"], "fail": row["fail"], "tol_mode": "absolute",
                          "description": description})
    return tests


def parse_file(data):
    return parse_rows(read_rows(data))
