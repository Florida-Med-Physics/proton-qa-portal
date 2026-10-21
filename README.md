# Proton QA Portal

A RadMachine-style QA portal for the proton gantries: user accounts, machines, a test library, QA queues that are scheduled per machine, result entry with pass/warn/fail, physicist review and sign-off, trends, and an audit log.

> **Draft software for review by a qualified medical physicist.** It is not validated or commissioned for clinical use. Every limit, schedule, and the pass/warn/fail logic must be checked before anyone relies on it.

## Running it

Requires Python 3.11 or newer. The portal uses only the Python standard library, so there is nothing to install.

```
python run_portal.py create-admin
python run_portal.py serve --open
```

`create-admin` prompts for a password; no passwords are stored in code or config. The database is `data/portal.db` (change it with `--db` or the `PROTON_QA_DB` environment variable).

By default the portal listens only on this computer at http://127.0.0.1:8790. To share it with other workstations, run it on one host PC with `--host 0.0.0.0` and have others browse to `http://<host-name>:8790`. On a shared network, put it behind HTTPS (for example IIS or a reverse proxy) and add `--secure-cookies`.

`Start Portal.bat` starts the server and opens the browser on Windows.

### Demo data

`python seed_demo.py` builds `data/demo.db` with two synthetic gantries, a month of synthetic results, and three demo accounts (credentials written to `data/demo-credentials.txt`). Then run `python run_portal.py --db data/demo.db serve`. Demo values are placeholders, not beam data.

## How it fits together

| Concept | What it is |
| --- | --- |
| **Machine** | A gantry or device. Can be retired without losing history. |
| **Test** | One check in the library: numeric (with unit, expected value, warning and fail tolerances), pass/fail, or free text. |
| **QA queue** | An ordered list of tests, such as "Daily QA – TG-224". A queue can tighten or change limits for its tests. |
| **Schedule** | A queue assigned to a machine: daily on chosen weekdays, weekly, monthly, quarterly, semiannual, annual, or every N days. |
| **Machine limits** | Per-machine adjustments to a scheduled queue's expected values and tolerances. |
| **Run** | One completed queue. Limits are copied onto each result, so later changes never rewrite history. |

Limits resolve from most to least specific: machine adjustment, then queue, then test library default.

### Roles

- **Admin**: everything, including managing users.
- **Physicist**: configure machines, tests, queues, schedules and limits; perform and review runs; read the audit log.
- **Therapist**: perform QA runs and view results.

A run must be reviewed by someone other than the person who performed it. Rejections need a comment.

### Evaluation rules (assumptions to confirm)

- Deviation is `result − expected`; for percent tolerances it is `100 × (result − expected) / expected`.
- |deviation| greater than the fail tolerance is **Fail**; greater than the warning tolerance is **Warn**; otherwise **Pass**. A value exactly on a tolerance counts as within it.
- A test with no expected value, or no tolerances, is stored as **Recorded** and not judged.
- A schedule is due on its next scheduled date after the last completed run; earlier dates without a run make it **Overdue**.

## Development

```
python -m unittest discover -s tests -v
```

Code layout: `portal/db.py` (schema), `portal/auth.py` (passwords, sessions, roles), `portal/qa.py` (evaluation and scheduling), `portal/service.py` (operations), `portal/server.py` (HTTP API and static files), `portal/static/` (browser interface).

## Not built yet

- Importing the Sphinx daily `.xls` exports (G1/G5) into Daily QA runs.
- Seeding the test library from the TG-224 daily template.
- Email or in-app notifications for overdue QA or failures.
- Attachments (images, PDFs) on runs.
