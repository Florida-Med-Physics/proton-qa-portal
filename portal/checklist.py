"""Read the manual checks from a myQA daily-QA template export (sheet 'WithFullDetails').

Each check starts with a numbered title in column A ('1.01: Door interlock'), followed by its
category ('Safety'), optional instructions, 'Acceptance Criteria', and optionally a table
(Name / Expected/Ref / Warn / Fail). Checks without a table are pass/fail; each table row is a
numeric test. Section 0 (setup instructions) is returned separately. Section 3 ("3.01: Sphinx Tests")
lists every Sphinx parameter (Parameter / Expected / Warning / Error) under Energy, Spot, Coincidence,
Homogeneity and Output; those become tests named the same way the Sphinx import names them, so the
values filled from an export land on the template's tests.
"""

import re

from .sphinx import SPHINX_CATEGORIES, SphinxError, quantity, read_rows, spot_number, standard_name

_TITLE = re.compile(r"^(\d+)\.(\d{2}):?\s+(.+)$")
_NUMBER = re.compile(r"[-+]?\d+(?:\.\d+)?")


def _number(text):
    match = _NUMBER.search(text or "")
    return float(match[0]) if match else None


def parse_rows(rows):
    setup, protocol, checks, current, header = "", "", [], None, None
    sph = {"category": None, "item": None, "cols": None}
    for cells in rows:
        by_col = dict(cells)
        first = by_col.get(0, "")
        if not protocol and first.startswith("Daily QA protocol"):
            protocol = first.strip()
        title = _TITLE.match(first)
        if title:
            section, label = int(title[1]), title[3].strip()
            current = {"number": f"{title[1]}.{title[2]}", "section": section, "title": label, "category": None,
                       "instructions": "", "rows": []}
            header = None
            if section == 0:
                current["setup"] = True
            else:
                checks.append(current)
            continue
        if current is not None and current["section"] >= 3:
            _sphinx_row(current, sph, cells, by_col, first)
            continue
        if current is None or not first:
            continue
        if current.get("setup"):
            if first not in ("Other", "Acceptance Criteria", "Functional") and len(first) > 40:
                setup = first.strip()
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
    return {"setup": "\n\n".join(x for x in (protocol, setup) if x), "checks": checks}


def _sphinx_row(current, sph, cells, by_col, first):
    """One row of the template's Sphinx section: a category, an item heading, a column header, or a parameter."""
    texts = {c: t.strip() for c, t in cells}
    if first in SPHINX_CATEGORIES:
        sph["category"], sph["item"] = first, None
    elif first and current["category"] is None:
        current["category"] = first                      # "Dosimetry"
    elif first and not current["instructions"] and len(first) > 40:
        current["instructions"] = first
    elif first and sph["category"] and first not in ("PLD",):
        sph["item"] = first                              # "Energy [100.81 MeV]", "Spot 1 [226.4 MeV]", "PPC-05-862"
    elif "Parameter" in texts.values():
        sph["cols"] = {t.lower(): c for c, t in texts.items()}
    elif sph["cols"] and sph["category"] and texts.get(sph["cols"].get("parameter")):
        cols = sph["cols"]
        expected, warn, fail = (quantity(texts.get(cols.get(k), "")) for k in ("expected", "warning", "error"))
        if warn is None and fail is None:
            return                                       # setup rows (X Start / X Stop), not a measured parameter
        unit = (expected or (None, ""))[1] or ""
        warn_unit = (warn or (None, ""))[1] or unit
        current["rows"].append({
            "sphinx": True, "category": sph["category"], "item": sph["item"] or sph["category"],
            "name": texts[cols["parameter"]], "unit": unit or "unitless",
            "expected": expected[0] if expected else None, "warn": warn[0] if warn else None, "fail": fail[0] if fail else None,
            "tol_mode": "percent" if warn_unit == "%" and unit != "%" else "absolute",
        })


def to_tests(parsed):
    """Portal tests in queue order, named '<Category> – <Check>' or '<Category> – <Check> – <Row>'."""
    tests = []
    for check in parsed["checks"]:
        category = check["category"] or "General"
        description = f"Template {check['number']}." + (f" {check['instructions']}" if check["instructions"] else "")
        if check["rows"] and check["rows"][0].get("sphinx"):
            spots = {}
            for i, row in enumerate(check["rows"]):
                if row["category"] == "Spot" and row["item"] not in spots:
                    spots[row["item"]] = spot_number(row["item"]) or len(spots) + 1
                label = f"{row['item']} – {row['name']}" if row["item"] != row["category"] else row["name"]
                note = description if i == 0 else f"Template {check['number']}."
                tests.append({"category": row["category"], "type": "numeric", "unit": row["unit"],
                              "name": standard_name(row["category"], row["item"], row["name"], spots.get(row["item"])),
                              "expected": row["expected"], "warn": row["warn"], "fail": row["fail"], "tol_mode": row["tol_mode"],
                              "description": f"{note} Measured by Sphinx; template label: {label}."})
            continue
        if not check["rows"]:
            tests.append({"category": category, "name": f"{category} – {check['title']}", "type": "boolean", "description": description})
        for row in check["rows"]:
            tests.append({"category": category, "name": f"{category} – {check['title']} – {row['name']}", "type": "numeric",
                          "expected": row["expected"], "warn": row["warn"], "fail": row["fail"], "tol_mode": "absolute",
                          "description": description})
    return tests


def parse_file(data):
    return parse_rows(read_rows(data))
