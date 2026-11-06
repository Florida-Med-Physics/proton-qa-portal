# Physics QA Portal

A RadMachine-style machine QA portal for every treatment and imaging machine (proton gantries GTR1/GTR2/GTR5, TrueBeam, CT simulator, MRI simulator): user accounts, machines, a test library, QA queues that are scheduled per machine, result entry with pass/warn/fail, physicist review and sign-off, trends, and an audit log.

> **Draft software for review by a qualified medical physicist.** It is not validated or commissioned for clinical use. Every limit, schedule, and the pass/warn/fail logic must be checked before anyone relies on it.

## Two ways to run it

**On one host PC for the department (server) — the intended deployment.** One Python process on a host PC keeps everything in a single SQLite file (`data/portal.db`): accounts with passwords, machines, lists, every run and its review. Other workstations use it through their browser at `http://<host-name>:8790`. Setup is in *Running the server* below; `Start Portal.bat` does the first-run steps on Windows (create the admin account, load the machines and daily QA templates, start serving).

**In the browser, no server (GitHub Pages) — for trying it out.** Open the published page. Everything you record is stored in that browser on that computer (IndexedDB); nothing is sent anywhere. Use *Setup → Backup* to save a backup file and to move the data to another computer. The page starts with one daily template per machine type (proton gantry per TG-224, TrueBeam per TG-142 / TG-198, CT simulator along TG-66, MRI placeholder) plus an SRS QA template for the TrueBeam, and six machines (GTR1, GTR2, GTR5, TrueBeam, CT Sim, MRI Sim), each with its own copy of its templates. Daily lists are scheduled on weekdays; the SRS list is "as needed". Under *Setup → Database location* you can pick a file (on a shared drive, say) that holds the whole database: every change is written there and the page loads from it. The seed lists are in `docs/seed-data.js`. Temporary demo accounts are Physicist / Physicist, Therapist / Therapist, Admin / Admin, and MPA / MPA (username / password). This browser-only login gate is not server-side access protection. Existing browser records are preserved; legacy accounts without a password need an Admin password reset. Use the shared server for real access control. The files live in `docs/`; `python build_pages.py` refreshes them from the shared interface.

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

Folders are searched recursively; duplicate files, empty files, and sessions Sphinx marked Skipped are reported and skipped. Imported runs are marked **Historical import** (no review needed) unless `--pending` is given. A historical import keeps the expected value, tolerances, and pass/warn/fail verdict from its own file.

A new import that awaits review (`--pending`, or the automatic folder scan in Data Administration) is judged by the list's own baseline and tolerances, as if the values had been entered on the Perform page. Where Sphinx's verdict differs, the result's comment says so.

**No review for automatic imports.** `POST /api/assignments/<id>/sphinx/import` takes `review: false` (both builds): the file is judged by the list's limits exactly as a new import, but the run is recorded as **Historical import** with no therapy or physics review step. The scheduled folder import on floridaphysics.com should send this, so trending fills in on its own; a file imported by hand in GatorQA's pages still waits for review.

**History up to a date.** `POST /api/assignments/<id>/sphinx/import` also takes `history_before: "YYYY-MM-DD"` (both builds). Each file whose QA date is before that day is imported as history, exactly as with `historical: true`; each file on or after it awaits review, exactly as with `historical: false`; `historical` is then ignored. A scheduled folder import can send the day it was set up, so the files already in the folder become history and only new QA waits for review. Without `history_before` nothing changes.

**Past imports waiting for review.** If past exports were imported as waiting for review, a Physicist or Admin can choose **Record past imports as history…** on Data Administration, under Import folders: pick a machine and QA list (or All) and the last QA date (yesterday at first). The dialog says how many runs will change before you confirm. Only runs made by a Sphinx file import that still wait for review change: a run counts as one when its source is Sphinx and its note is the one the import writes ("Imported from <file>. Sphinx finished <date> <time>…", or "Imported from <file>.xls" and nothing more from the folder import in the browser; Winston-Lutz PDFs come in the same way and count too). Runs performed on the Perform page keep the note the person typed, so they do not change even when a file filled them in (unless that note is exactly such a line); trashed runs and runs already approved or rejected never change. The chosen runs become **Historical import**: values, limits, verdicts, comments and any therapist sign-off already given stay as they are (a sign-off still shows on the run page and in the PDF report, and can no longer be undone or changed), and each run gets an audit entry (`record_history`, with its previous review state and therapist fields). The API is `POST /api/runs/record-history` with `{until: "YYYY-MM-DD", machine_id, assignment_id, dry_run}` (only `until` is required); a dry run returns `{count, runs}` and changes nothing, otherwise the answer is `{count}`. Both builds check the input the same way and refuse it with the same words (`tests/record_history_cases.json`).

Checked against the full archive on 2026-10-21 (942 G1 and 201 G5 sessions, 74,998 values): the portal's rule matched Sphinx's verdict on all but 7 values, each sitting exactly on a tolerance in the one-decimal file values. Sphinx judges unrounded values, so historical imports keep Sphinx's verdict and add a comment where the two differ. A new import judged by the list's limits can disagree with Sphinx at those same edges; the comment flags it for the reviewer.

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

Machine Trends shows one machine and one QA list at a time: GTR1 when available, and that machine's list with the most recorded runs unless a link names another list. Choose a machine, QA list, and period, then expand measurements organized by list and category. Spot numbers are omitted from display labels; same-energy X/Y measurements share a graph. Saved test identities are unchanged. Each insight opens its grouped graph and values. Insights are calculated locally (documented straight-line fit, minimum five distinct dates), not an external AI or clinical assessment.

Use **Import Folder** and **Export CSV**. Import Folder reads a folder of Sphinx `.xls`/`.csv` history (subfolders included) into the selected list. Export uses the current list/period/test selection and includes both recorded and current limits/verdicts; it goes to Downloads (or to an export folder chosen in an earlier version, in that browser).

**Trends API** (`GET /api/machines/<id>/trends`, the same in both builds). Without options it returns the machine's whole history in one reply: `{testId: [points]}`, where tests that share a history key each get the same series, sorted by QA date, run and result. Options, which accept ASCII digits and dates only: `tests=3,7` (only these tests' series, each still built from every test sharing its key), `until=YYYY-MM-DD` and `from=YYYY-MM-DD` (QA dates up to / from that day), `last=N` (the newest N points of each series). `page=start` returns the same answer in parts, for histories too large for one reply: `{series: [[points]], tests: {testId: index into series}, next, token, order}`. Pass each reply's `next` back as `page` until it is `null`, and join each test's points across the parts in order; `next` is an opaque cursor (today the number of points already sent, so it holds only while `token` stays the same). Each series is sent once per part, and a part holds whole points up to 2,500,000 bytes of compact JSON as the browser build writes it (`TREND_PAGE_BYTES`, at least one point each; the server build splits at the same points but sends its JSON with spaces, so its parts are somewhat larger on the wire); on the shared site the reply passes through a Lambda whose synchronous response limit is recalled as 6 MB (recalled; check AWS quotas). `token` is a checksum of the whole answer: if it changes between parts, the results changed, so start again from `page=start` (the app tries three times, then says so). Each build computes its own token, so compare tokens only within one build's replies. `order` (first part only) gives each QA list's newest Sphinx import as `{assignmentId: {testId: result order}}`, from the history before `from`; Machine Trends orders its charts by it. `page` cannot be combined with `last`. Machine Trends and **Export CSV** ask for the chosen period this way (`from` = the period's first day, none for All history); the trend detail page and a saved run's quick trend use `GET /api/trend`, one test at a time.

The server build works out a paged answer once and keeps it in memory for the following parts (at most four machine/period answers, compressed, about 3 MB each for three years of a gantry's synthetic records); any change to the database, by the portal or another program, drops what it kept. The parts and tokens are the same, byte for byte, as working the answer out again for every part.

### New QA Template List

Choose an existing departmental starter (including TG-142/TG-224 and CT simulation references), a blank template, or an Excel/MyQA checklist export. Spreadsheet import supports `.xlsx`, `.xls`, and `.csv`, with worksheet choice, adjustable column mapping and a test preview before creation. Numeric limits are read only from explicit mapped cells; unsupported text criteria remain instructions. Review every imported test and limit before use. Native MyQA `.pld` parsing is not implemented; export the checklist to Excel first. Creation is unscheduled and atomic, so an invalid import does not leave a partial template.

Client regression checks: `node tests/test_trend_tools.cjs`, `node tests/test_autosave.cjs`, `node tests/test_report.cjs`, `node tests/test_host_folders.cjs`, and `node tests/test_page_requests.cjs`.

### Responsive home and machine management

The home dashboard uses four modality cards (Proton, Photon, Brachy and Simulation), two columns on desktop and one on phones. Each machine lists its active Daily, Monthly and on-demand QA with a separate due/start control. Setup and Review use available desktop width and labeled rows on phones; base text is enlarged.

Manage machines from Setup QA. Unused machines can be deleted along with their schedules, preserving shared templates. Machines with recorded QA cannot be deleted; retire them to remove them from active views while preserving results. Linac 1 is retired from existing browser setups and removed from new starting data at the user's request. Deleted seeded machines are not automatically recreated.

## Pages hosted by another site (`window.QA_HOST`)

A page that hosts these pages (floridaphysics.com does) may set this before `app.js` loads:

```
window.QA_HOST = { browserFolders: false };
```

Then no page opens a folder: no folder picker, no `window.localFolders`, no `GET /api/assignments/:id/files` or `/file`, no folder `<input webkitdirectory>` and no export folder. Each list's **Default import folder** is a typed path (in the schedule editor, and in Data Administration for a Physicist or Admin), saved with its schedule by `PUT /api/assignments/:id`. It is typed once the list is saved: adding a list, or scheduling one on several machines at once, offers no folder, so one folder is never set on several lists. The scheduled import on a UFHPTI computer reads those folders. Perform QA keeps its single-file import, Machine Trends has **Export CSV** only (a browser download), and Data Administration does not scan. Without `QA_HOST`, or with any other value, both builds work as before; `tests/test_host_folders.cjs` checks both.

## Fewer requests per page

Every request a page makes costs a round trip, and on a site that runs the backend once per request (floridaphysics.com runs the browser build's `local-backend.js` on AWS Lambda) each one also starts the backend on a whole copy of the records. So the pages ask for what they need in as few requests as they can, and in as few steps one after another. The same in both builds:

- **`GET /api/assignments`**: every machine's schedules in one reply, machine by machine in `GET /api/machines` order, each machine's rows exactly as `GET /api/machines/<id>/assignments` gives them. Setup QA, Machines, Machine Trends, Data Administration and "Schedule on machines" use it instead of one request per machine.
- **`GET /api/batch?paths=<JSON list of GET paths>`**: several GETs answered in one reply, in order, each `{ok: true, value}` or `{ok: false, error}` with the error that path would have had on its own; at most 20 paths (the page sends more as several batches side by side). Never `/api/me`, a draft, the folder or database answers (a hosting page may answer or screen those itself), `/api/backup` or another batch. The Dashboard, Review QA, Setup QA, Machines, Machine Trends and Data Administration use it.
- **`clear_draft: true`** on `POST /api/assignments/<id>/runs` (the QA form's **Submit for review**): the run is recorded and that person's draft of the list cleared in the same save, and the reply says `draft_cleared: true`. Without it nothing else changes. Against a server that does not say so (an older build) the page sends `POST .../draft/clear` afterwards, as before.

What the pages now ask for (synthetic records; `tests/test_page_requests.cjs` runs the pages against the browser build and checks these, `tests/test_page_requests.py` the server build):

| Page | Before | Now |
| --- | --- | --- |
| Dashboard | 2 requests, one after the other | 1 |
| Review QA | 2, one after the other | 1 |
| Machine Trends (overview) | machines, then the machine's lists, then the period's history beside each list's template, then the lists and the chosen list's template again: 5 steps | 3 steps of one request each: machines and lists; the templates; the history (in parts, one after another) |
| Machine Trends (a group of tests) | one request per test, side by side | 1 |
| Open a run, and the review after Submit | the run, then its history beside its list's template | the run, then 1 |
| Data Administration | users and machines, then each active machine's lists, one machine after another (11 requests, 10 in a row) | 1 |
| Setup QA, Machines | 11 requests in 2 or 3 steps, one for each machine's lists | 1 |
| Submit for review | two saves: the run, then clearing the draft | one save |

No page sends two requests side by side: on a site that runs the backend once per request, the second would go to a second server, which may first have to start or catch up with the latest records, and that costs more than the round trip it saves. (More than 20 paths still go as several batches at once.)

The QA form still asks for its template, then the history of its tests, then the draft, one after another: the history needs the template's tests, and a hosting page that screens the draft reply when it arrives (floridaphysics.com holds back a draft from an earlier day and says so on the form) needs the form drawn first. A site that hosts these pages should update its backend copy before, or with, these pages: the pages need the new requests.

## Shared UFHPTI deployment

The planned staff deployment runs on one always-on UFHPTI computer with a local central database and scheduled shared-drive snapshots. See [deployment steps](deploy/LOCAL_DEPLOYMENT.md). `requirements-deploy.txt` installs the Waitress server; the GitHub Pages build remains browser-only. Four roles are available: Admin, Physicist, Therapist and MPA. MPA currently has restricted QA-entry access pending policy confirmation. Required therapist sign-off is separate from medical physicist final approval.

## Current import and mobile behavior

On phones, QA entry uses stacked test cards and an expandable menu; desktop tables retain their layout. PASS is bright green and ACTION is bright red. Result labels match the measurement heading size.

Choose an import folder once for the machine schedule. The Perform page searches its subfolders for supported CSV/XLS exports and DoseLab Winston-Lutz PDFs, using the **acquisition date inside the report** to match the selected QA date. While the page stays open, it checks every 30 seconds. Folder permission may need to be granted again after reopening a browser. Existing measurements are preserved. A filename containing TrueBeam routes to TrueBeam even when the PDF internal machine label differs. Missing/unsupported reports leave manual entry and optional upload available.

The TrueBeam SRS starter uses **Maximum delta < 1 mm** as its only measurement verdict. Exactly 1 mm fails. Maximum total delta and Mean total delta are context only. Empty and partial lists can still be submitted for review. The importer never treats missing values as passes. The supplied Daily HDR and TrueBeam Monthly starters have no prefilled historical measurements or signatures. TrueBeam monthly workbook upload/export preserves the native workbook structure; printed limits govern where original Excel formulas conflict, with review notes retained.

GitHub Pages and the local static server serve the same `docs/` build. Their browser data and folder permissions remain separate by origin; identical app files do not synchronize accounts or recorded results. Shared multi-user deployment is separate work on the AWS integration branch.

Review QA lists your own queue first (**Awaiting Physics Review** for physicists and admins, **Awaiting Therapy Review** for others), then recent decisions, then Trash; a row opens its run. After **Approve**, the next run below it that waits for your approval opens (from the top again after the last; never your own run); when none is left, Review QA. A run opens the full numbered results immediately. A signed-in therapist can use **Pass / Fail** at the therapist-review test; the system records their identity and then enables the separate physicist stage. Review and Perform share the machine's matching historical measurements and inline graphs. Graph tooltips show the QA date, measurement and difference from its reference.

Use **Trash** (the bin at the top of the run's page) for an erroneous run. It is excluded from review, charts and schedule completion, while its original results and audit record are retained. Expand **Trash** on Review QA to restore it. Reviewers may manage any run; performers may manage their own pending submissions.

Therapists use the same dynamic Pass / Fail controls as Perform QA. Clicking a selected Pass withdraws approval; changing therapy approval also clears dependent physics approval. Changing away from Pass removes the signature and takes the run out of the physicist queue. Changes are audited. **Done — back to Review QA** closes the detail; therapists see **Awaiting Therapy Review** before **Awaiting Physics Review**.

Admin can operate as each role using the eye-icon View As selector. Permissions follow the selected role, while actions retain the authenticated Admin identity and acting role in the audit trail. Therapists can trash and restore submissions from any performer; actions are audited.

### Derived results
In template setup, choose **Derived** as a result type, select earlier numeric tests, and enter an arithmetic formula using A, B, C in the displayed input order. For example `100*(A-B)/A` computes a signed percentage difference. Supported functions are `sqrt`, `abs`, `min`, `max`, and `mean`. Derived outputs remain numeric for units, tolerances, trends, and exports. Inputs must precede the output, so forward references and cycles are rejected. Missing inputs, zero denominators, and nonfinite results stay unanswered. Derived values are recalculated during submission rather than trusted from the client. Changing a source name or category requires updating dependent definitions. Historical results are preserved.

The template audit is recorded in `calculation-audit.json`: 658 tests reviewed, 31 explicit arithmetic calculations connected to Derived, and 41 TrueBeam calculations retained in the native Excel formula engine. Imported metrics without sufficient source readings remain measurements.

Perform QA keeps derived formulas behind an optional information button. Frequently used QA shortcuts use each signed-in user’s submission history. HDR Daily PDFs use a dedicated local reader with a confirmation preview; unreadable checkboxes stay unanswered. The bundled OCR assets run in the browser.

Historical trend charts retain the baseline, tolerance and verdict stored with each source result. Current-template comparisons remain separate, labeled CSV columns. Same-day retests remain separate rows; result links and chart points open the exact source run and highlight its test. QA tables adapt the visible history count to the available width and use the compact layout on smaller screens. Notes open only through the plus button, including when restoring a draft.

### Tests on one row
In Setup QA's list editor, tick **Same row as the test above** on a test (Physicist or Admin) to show it on the row of the test above it on the QA form and a saved run, for example TCS Sk, decay-table Sk and their difference as one row 1.08. The box keeps the tag `[row: with above]` in the test's directions, hidden wherever directions are shown, so neither server nor database changes. A joined test has no number of its own: the row keeps the first test's number and the next row takes the next one, alike in Setup QA, the QA form, a saved run, the PDF report and Machine Trends. Each test is still its own result with its own value, verdict, comment and trend; the row lays out each test as in a row of its own (name and unit with its details button, input, result and deviation, baseline and limits, comment), with one + for all their comments, and History and the quick trend of the first test with limits, named. The box is offered only where a test can join the one above (not on the first test of a list or section, nor after a set of X/Y/Z or per-energy readings); a calculation whose inputs then share a number keeps its letters in its details.

Device-selection calibration uses the Derived “Device calibration lookup” method. PBS and Eyeline chamber/electrometer selections supply the calibration factors and downstream calculations. The bundled SAMPLE devices and factors are placeholders, editable in Setup QA. Blank or unknown selections leave dependent values unanswered; the backend recalculates lookups during submission.

Perform and Review submission bars scroll after the form rather than staying fixed over tests. Execution table headings do not wrap or offer column sorting; rows retain protocol order. HDR uses concise display labels with full directions available through the first-line information button. Stored test identities, measurements and limits are unchanged.
