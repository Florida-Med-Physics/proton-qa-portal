# Physics QA Portal

A RadMachine-style machine QA portal for every treatment and imaging machine (proton gantries GTR1/GTR2/GTR5, TrueBeam, CT simulator, MRI simulator): user accounts, machines, a test library, QA queues that are scheduled per machine, result entry with pass/warn/fail, physicist review and sign-off, trends, and an audit log.

> **Draft software for review by a qualified medical physicist.** It is not validated or commissioned for clinical use. Every limit, schedule, and the pass/warn/fail logic must be checked before anyone relies on it.

## Two ways to run it

**On one host PC for the department (server) — the intended deployment.** One Python process on a host PC keeps everything in a single SQLite file (`data/portal.db`): accounts with passwords, machines, lists, every run and its review. Other workstations use it through their browser at `http://<host-name>:8790`. Setup is in *Running the server* below; `Start Portal.bat` does the first-run steps on Windows (create the admin account, load the machines and daily QA templates, start serving).

**In the browser, no server (GitHub Pages) — for trying it out.** Open the published page. Everything you record is stored in that browser on that computer (IndexedDB); nothing is sent anywhere. Use *Setup → Backup* to save a backup file and to move the data to another computer. The page starts with one daily template per machine type (proton gantry per TG-224, TrueBeam per TG-142 / TG-198, CT simulator along TG-66, MRI placeholder) plus an SRS QA template for the TrueBeam, and six machines (GTR1, GTR2, GTR5, TrueBeam, CT Sim, MRI Sim), each with its own copy of its templates. Daily lists are scheduled on weekdays; the SRS list is "as needed". Under *Setup → Database location* you can pick a file (on a shared drive, say) that holds the whole database: every change is written there and the page loads from it. The seed lists are in `docs/seed-data.js`. Temporary demo accounts are Physicist / Physicist, Therapy / Therapy, Admin / Admin, and MPA / MPA (username / password). This browser-only login gate is not server-side access protection. Existing browser records are preserved; legacy accounts without a password need an Admin password reset. Use the shared server for real access control. The files live in `docs/`; `python build_pages.py` refreshes them from the shared interface.

`python export_backup.py --db data/portal.db out.json` turns a server database into a file the browser build can restore.

## Running the server

Requires Python 3.11 or newer. Reading Sphinx `.xls` exports needs `xlrd`; reading DoseLab PDFs needs `pypdf` (pinned in `requirements.txt`).

```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python run_portal.py create-admin
.venv\Scripts\python run_portal.py seed-defaults --user admin
.venv\Scripts\python run_portal.py serve --open
```

`create-admin` prompts for a password; no passwords are stored in code or config. `seed-defaults` loads `portal/seed.json` (the six machines, one daily template per machine type, the TrueBeam SRS list, and a scheduled copy of each on its machines) into an empty database; it refuses to run twice. After that, add people under *Setup QA → People*, and set each list's default import folder (a path on the host PC, or a network share the host can read) under *Change schedule*. The database is `data/portal.db` (change it with `--db` or the `PROTON_QA_DB` environment variable).

By default the portal listens only on this computer at http://127.0.0.1:8790. To share it with other workstations, run it on one host PC with `--host 0.0.0.0` and have others browse to `http://<host-name>:8790`. On a shared network, put it behind HTTPS (for example IIS or a reverse proxy) and add `--secure-cookies`.

`Start Portal.bat` does all of this on Windows: on first run it creates the admin account and loads the starting data, then it serves and opens the browser. To keep the portal running on the host PC, run it as a scheduled task at log-on (or as a service), with `--host 0.0.0.0` so other workstations can reach it.

**Backups.** The database is the one file `data/portal.db` (plus `-wal`/`-shm` journal files while running). Copy it with the host's normal backup, or run `python export_backup.py --db data/portal.db backup.json` for a portable copy.

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

## Templates and machine lists

A **template** is the master QA list (for example "Daily QA template", built from the TG-224 daily template export with `import-checklist`). It is never scheduled directly. **Duplicate** it for a machine: every check is copied, so that machine's list owns its checks and their limits, and tuning one machine never changes another or the template. Sphinx measurements are added to a machine's list automatically the first time one of its exports is loaded.

The entry form follows the template's sections: **0.0 Setup** instructions, **1.0 Safety**, **2.0 Mechanical and imaging**, **3.0 Sphinx dosimetry**, with each check's number and directions shown beside it.

## How it fits together

| Concept | What it is |
| --- | --- |
| **Machine** | A gantry or device. Can be retired without losing history. |
| **Test** | One check in the library: numeric (with unit, expected value, warning and fail tolerances), pass/fail, pass/warning/fail (chosen directly, as on a checklist), or free text. |
| **QA queue** | An ordered list of tests, such as "Daily QA – TG-224". A queue can tighten or change limits for its tests. |
| **Schedule** | A queue assigned to a machine: daily on chosen weekdays, weekly, monthly, quarterly, semiannual, annual, every N days, or as needed (SRS QA on SRS days: never overdue, always startable). A schedule can name a **default import folder**; the Perform page then lists that folder's export files, newest first, with the ones already recorded marked. In the server build it is a path on the host PC; in the browser build it is chosen with the browser's folder picker and remembered on that computer. |
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

- Importers for the TrueBeam: Sun Nuclear DQA3 export and Varian MPC results (sample exports needed first), and the Dose Pro SRS export.
- TG-66 daily tolerances for the CT simulator and the MRI daily items (sources to follow).
- Watching the export folders and importing new files automatically.
- Monthly and annual templates (the model supports them; only the daily template is seeded).
- Email or in-app notifications for overdue QA or failures.
- Attachments (images, PDFs) on runs.

### Machine-specific tests without copying a template

Open a QA template and select the machine under **Tests and limits for**. Use **Customize tests** to uncheck shared tests for that machine, or add an existing test. **New test** while a machine is selected adds a machine-only test. Default-template changes still flow to every included shared test; the machine's limit overrides remain its own. **Reset to template** in Customize tests resets test inclusion, leaving limit overrides intact. Previously recorded runs keep their recorded results.

New Sphinx tests added from a machine's export belong only to that machine's schedule; explicitly excluded tests are ignored. Promote a machine-only test to the shared list by selecting Default template and adding it there.

HDR Flexitron starts with **Daily QA** and **Source Exchange QA**, both **as needed**. These are empty list shells: add the department's approved checks and limits before use.

### Trends dashboard and file defaults

Machine Trends shows one machine at a time, defaulting to GTR1 when available. Choose a machine, QA list, and period, then expand measurements organized by list and category. Spot numbers are omitted from display labels; same-energy X/Y measurements share a graph. Saved test identities are unchanged. Each insight opens its grouped graph and values. Insights are calculated locally (documented straight-line fit, minimum five distinct dates), not an external AI or clinical assessment.

Use **Import**, **Export CSV**, and the folder-settings gear. Import reuses that machine's QA-list folder and supports Sphinx `.xls`/`.csv` history. Export uses the current list/period/test selection and includes both recorded and current limits/verdicts. Export directories are remembered per machine/user in this browser; Downloads is the fallback. Directory permissions may need reconnecting after a browser restart.

### New QA Template List

Choose an existing departmental starter (including TG-142/TG-224 and CT simulation references), a blank template, or an Excel/MyQA checklist export. Spreadsheet import supports `.xlsx`, `.xls`, and `.csv`, with worksheet choice, adjustable column mapping and a test preview before creation. Numeric limits are read only from explicit mapped cells; unsupported text criteria remain instructions. Review every imported test and limit before use. Native MyQA `.pld` parsing is not implemented; export the checklist to Excel first. Creation is unscheduled and atomic, so an invalid import does not leave a partial template.

Client regression checks: `node tests/test_trend_tools.cjs`, `node tests/test_autosave.cjs`, and `node tests/test_report.cjs`.

### Responsive home and machine management

The home dashboard uses four modality cards (Proton, Photon, Brachy and Simulation), two columns on desktop and one on phones. Each machine lists its active Daily, Monthly and on-demand QA with a separate due/start control. Setup and Review use available desktop width and labeled rows on phones; base text is enlarged.

Manage machines from Setup QA. Unused machines can be deleted along with their schedules, preserving shared templates. Machines with recorded QA cannot be deleted; retire them to remove them from active views while preserving results. Linac 1 is retired from existing browser setups and removed from new starting data at the user's request. Deleted seeded machines are not automatically recreated.


## Shared UFHPTI deployment

The planned staff deployment runs on one always-on UFHPTI computer with a local central database and scheduled shared-drive snapshots. See [deployment steps](deploy/LOCAL_DEPLOYMENT.md). `requirements-deploy.txt` installs the Waitress server; the GitHub Pages build remains browser-only. Four roles are available: Admin, Physicist, Therapist and MPA. MPA currently has restricted QA-entry access pending policy confirmation. Required therapist sign-off is separate from medical physicist final approval.

## Current import and mobile behavior

On phones, QA entry uses stacked test cards and an expandable menu; desktop tables retain their layout. PASS is bright green and ACTION is bright red. Result labels match the measurement heading size.

Choose an import folder once for the machine schedule. The Perform page searches its subfolders for supported CSV/XLS exports and DoseLab Winston-Lutz PDFs, using the **acquisition date inside the report** to match the selected QA date. While the page stays open, it checks every 30 seconds. Folder permission may need to be granted again after reopening a browser. Existing measurements are preserved. A filename containing TrueBeam routes to TrueBeam even when the PDF internal machine label differs. Missing/unsupported reports leave manual entry and optional upload available.

The TrueBeam SRS starter uses **Maximum delta < 1 mm** as its only measurement verdict. Exactly 1 mm fails. Maximum total delta and Mean total delta are context only. Empty and partial lists can still be submitted for review. The importer never treats missing values as passes. The supplied Daily HDR and TrueBeam Monthly starters have no prefilled historical measurements or signatures. TrueBeam monthly workbook upload/export preserves the native workbook structure; printed limits govern where original Excel formulas conflict, with review notes retained.

GitHub Pages and the local static server serve the same `docs/` build. Their browser data and folder permissions remain separate by origin; identical app files do not synchronize accounts or recorded results. Shared multi-user deployment is separate work on the AWS integration branch.

Review QA opens the full numbered results immediately. A signed-in therapist can use **Pass & sign** at the therapist-review test; the system records their identity and then enables the separate physicist stage. Review and Perform share the machine's matching historical measurements and inline graphs. Graph tooltips show the QA date, measurement and difference from its reference.

Use **Trash** for an erroneous run. It is excluded from review, charts and schedule completion, while its original results and audit record are retained. Expand **Trash** on Review QA to restore it. Reviewers may manage any run; performers may manage their own pending submissions.

Therapists can use **Change** beside their signed decision to select Pass, Fail, or Clear until physicist review is finalized. Changing away from Pass removes the signature and takes the run out of the physicist queue. Changes are audited. **Done — back to Review QA** closes the detail; therapist queues separate **Needs your review** from **Sent for physicist review**.
