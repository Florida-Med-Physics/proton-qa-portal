# Proton QA Portal

A RadMachine-style QA portal for the proton gantries: user accounts, machines, a test library, QA queues that are scheduled per machine, result entry with pass/warn/fail, physicist review and sign-off, trends, and an audit log.

> **Draft software for review by a qualified medical physicist.** It is not validated or commissioned for clinical use. Every limit, schedule, and the pass/warn/fail logic must be checked before anyone relies on it.

## Running it

Requires Python 3.11 or newer. The portal itself uses only the standard library; reading Sphinx `.xls` exports needs `xlrd` (pinned in `requirements.txt`).

```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python run_portal.py create-admin
.venv\Scripts\python run_portal.py serve --open
```

`create-admin` prompts for a password; no passwords are stored in code or config. The database is `data/portal.db` (change it with `--db` or the `PROTON_QA_DB` environment variable).

By default the portal listens only on this computer at http://127.0.0.1:8790. To share it with other workstations, run it on one host PC with `--host 0.0.0.0` and have others browse to `http://<host-name>:8790`. On a shared network, put it behind HTTPS (for example IIS or a reverse proxy) and add `--secure-cookies`.

`Start Portal.bat` starts the server and opens the browser on Windows.

### Demo data

`python seed_demo.py` builds `data/demo.db` with two synthetic gantries, a month of synthetic results, and three demo accounts (credentials written to `data/demo-credentials.txt`). Then run `python run_portal.py --db data/demo.db serve`. Demo values are placeholders, not beam data.

## Sphinx daily QA exports

The portal reads the IBA myQA Sphinx report export (`.xls`, sheet `ReportTestRepositoryFlatS`) from both the G1 and G5 layouts.

**Test names are standardized** so the same measurement has the same name on every machine, whatever wording the export uses:

| Kind | Pattern | Example |
| --- | --- | --- |
| Energy-specific | `<Category> <energy> MeV – <Metric>` | `Energy 100 MeV – Distal Depth`, `Spot 140 MeV – Sigma X` |
| Everything else | `<Category> – <Metric>` | `Coincidence – Distance X`, `Homogeneity – Flatness`, `Output – Absolute Dose` |

Energies are filed to the nearest 5 MeV (`ENERGY_STEP` in `portal/sphinx.py`), so G1's `Energy [100.81 MeV]` and G5's `100 MeV` are the same test; the exact export label is kept in the test's description. If two items in one file would get the same name, both keep their export label instead. A test shared by several machines keeps each machine's own expected value and tolerances on that machine's queue. Queues follow `Daily QA – <machine>`.

**Daily use.** On a queue's Perform page, choose that day's Sphinx file. The measured values and the QA date are filled in, with Sphinx's own verdict shown under each test and a note when the file's limits differ from the portal's. Complete the manual checks and submit for review. If the file has measurements the queue doesn't have yet, a physicist can add them with one click. Each file can be recorded only once.

**History.** Load past exports from the machine page (**Import Sphinx** on a scheduled queue) or from the command line:

```
.venv\Scripts\python run_portal.py import-sphinx --machine G1 --queue "Daily QA – G1" --user <physicist> --create "G:\My Drive\...\ProtonDaily\G1 Sphinx"
```

Folders are searched recursively; duplicate files, empty files, and sessions Sphinx marked Skipped are reported and skipped. Imported runs are marked **Historical import** (no review needed) unless `--pending` is given. Each imported result keeps the expected value, tolerances, and pass/warn/fail verdict from its own file.

Checked against the full archive on 2026-10-21 (942 G1 and 201 G5 sessions, 74,998 values): the portal's rule matched Sphinx's verdict on all but 7 values, each sitting exactly on a tolerance in the one-decimal file values. Sphinx judges unrounded values, so imports keep Sphinx's verdict and add a comment where the two differ.

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
.venv\Scripts\python -m unittest discover -s . -p "test_*.py" -t .
```

Tests use synthetic data only; Sphinx tests use synthetic report grids in the export's layout.

Code layout: `portal/db.py` (schema), `portal/auth.py` (passwords, sessions, roles), `portal/qa.py` (evaluation and scheduling), `portal/sphinx.py` (Sphinx export reader), `portal/service.py` (operations), `portal/server.py` (HTTP API and static files), `portal/static/` (browser interface).

## Not built yet

- Seeding the manual checks from the TG-224 daily template.
- Watching the Sphinx export folders and importing new files automatically.
- Email or in-app notifications for overdue QA or failures.
- Attachments (images, PDFs) on runs.
