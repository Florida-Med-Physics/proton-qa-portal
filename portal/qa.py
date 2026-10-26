"""Tolerance evaluation and QA scheduling rules.

Assumptions to be confirmed by the reviewing physicist:
- A numeric result is compared to its expected value; |deviation| above the fail
  tolerance is FAIL, above the warning tolerance is WARN, otherwise PASS. A value
  exactly on a tolerance counts as within it.
- 'percent' tolerances are relative to the expected value (100 * deviation / expected).
- A queue item is due on the next scheduled date after its last completed run.
"""

import calendar
from datetime import date, timedelta

STATUS_RANK = {"pass": 0, "recorded": 0, "warn": 1, "fail": 2}
MONTH_STEPS = {"monthly": 1, "quarterly": 3, "semiannual": 6, "annual": 12}
FREQUENCIES = ("daily", "weekly", "monthly", "quarterly", "semiannual", "annual", "custom", "asneeded")
# "asneeded": run on the days it is needed (SRS QA on SRS treatment days); never due or overdue on its own.
WEEKDAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_EPS = 1e-9


def resolve_limits(test, queue_item=None, override=None):
    """Most specific setting wins: machine override, then queue item, then test default."""
    limits = {}
    for key in ("expected", "warn", "fail", "tol_mode"):
        value = test.get(key)
        for layer in (queue_item, override):
            if layer and layer.get(key) is not None:
                value = layer[key]
        limits[key] = value
    limits["tol_mode"] = limits["tol_mode"] or "absolute"
    if "[rule: wl-max-delta]" in (test.get("description") or ""):
        limits["criterion"] = "wl-max-delta"
    return limits


def deviation(value, expected, tol_mode):
    if expected is None:
        return None
    diff = value - expected
    if tol_mode == "percent":
        if expected == 0:
            raise ValueError("A percent tolerance needs a non-zero expected value.")
        return 100.0 * diff / expected
    return diff


def evaluate(test_type, value, limits):
    """Return 'pass', 'warn', 'fail', or 'recorded' (no limits to judge against)."""
    if limits.get("criterion") == "wl-max-delta":
        return "pass" if 0 <= value < 1 else "fail"
    if test_type == "boolean":
        return "pass" if value else "fail"
    if test_type == "status":
        # The person performing QA picks Pass / Warning / Fail directly (as on a RadMachine checklist).
        return value if value in ("pass", "warn", "fail") else "fail"
    if test_type in ("text", "choice"):
        return "recorded"
    dev = deviation(value, limits.get("expected"), limits.get("tol_mode"))
    if dev is None:
        return "recorded"
    size = abs(dev)
    fail, warn = limits.get("fail"), limits.get("warn")
    if fail is not None and size > fail + _EPS:
        return "fail"
    if warn is not None and size > warn + _EPS:
        return "warn"
    if fail is None and warn is None:
        return "recorded"
    return "pass"


def overall(statuses):
    worst = "pass"
    for status in statuses:
        if STATUS_RANK.get(status, 0) > STATUS_RANK[worst]:
            worst = status
    return worst


def parse_weekdays(text):
    days = {int(d) for d in str(text or "").split(",") if d.strip().isdigit() and 0 <= int(d) <= 6}
    return days or set(range(7))


def month_end(day):
    return date(day.year, day.month, calendar.monthrange(day.year, day.month)[1])


def add_months(day, months):
    month_index = day.month - 1 + months
    year, month = day.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def next_due(assignment, last_done):
    """Date the queue is next due, given the date of its last completed run (or None)."""
    start = date.fromisoformat(assignment["start_date"])
    freq = assignment["frequency"]
    if freq == "asneeded":
        return None
    if freq == "daily":
        days = parse_weekdays(assignment.get("weekdays"))
        candidate = max(start, last_done + timedelta(days=1)) if last_done else start
        while candidate.weekday() not in days:
            candidate += timedelta(days=1)
        return candidate
    if freq in MONTH_STEPS:
        # Monthly (and longer) lists are due at the end of the month: the start month's end at first, then the
        # end of the month one period after the last run.
        period_end = month_end(start) if last_done is None else month_end(add_months(last_done, MONTH_STEPS[freq]))
        return max(start, period_end)
    if last_done is None:
        return start
    if freq == "weekly":
        return max(start, last_done + timedelta(days=7))
    interval = assignment.get("interval_days") or 1
    return max(start, last_done + timedelta(days=int(interval)))


def due_state(assignment, last_done, today):
    due = next_due(assignment, last_done)
    if due is None:
        return {"next_due": None, "state": "done" if last_done == today else "ready",
                "last_done": last_done.isoformat() if last_done else None}
    if due < today:
        state = "overdue"
    elif due == today:
        state = "due"
    elif last_done == today:
        state = "done"
    else:
        state = "upcoming"
    return {"next_due": due.isoformat(), "state": state, "last_done": last_done.isoformat() if last_done else None}


def describe_schedule(assignment):
    freq = assignment["frequency"]
    if freq == "daily":
        days = sorted(parse_weekdays(assignment.get("weekdays")))
        if days == list(range(7)):
            return "Daily"
        if days == list(range(5)):
            return "Daily (weekdays)"
        return "Daily (" + ", ".join(WEEKDAY_NAMES[d] for d in days) + ")"
    if freq == "custom":
        return f"Every {assignment.get('interval_days') or 1} days"
    if freq == "asneeded":
        return "As needed (run on the days it applies)"
    if freq in MONTH_STEPS:
        return f"{freq.capitalize()} (due at month end)"
    return freq.capitalize()
