# Physics QA Portal — project notes for Claude Code

A RadMachine-style machine QA tool for the UF Health Proton Therapy Institute physics group. Draft for
physicist review: nothing here is validated or commissioned for clinical use. Never invent tolerances or
beam data; a limit that is not confirmed stays blank, which the portal records without judging.

## Where things are

- Repo: github.com/Florida-Med-Physics/proton-qa-portal, branch `main`, public. Keep real export files,
  credentials and anything patient-related out of it.
- Live browser-only demo (GitHub Pages, data stays in the browser): https://florida-med-physics.github.io/proton-qa-portal/
- Sphinx exports: Google Drive `Protons/ProtonDaily/G1 Sphinx` and `G5 Sphinx/2026/<month>`.

## Deployment decision

The **server build** is the real deployment: one host PC, Python 3.11+, one SQLite file `data/portal.db`,
accounts with passwords, other workstations use it in the browser at `http://<host>:8790`.
The Pages build is only for trying it out.

Windows setup: clone, `python -m venv .venv`, `.venv\Scripts\python -m pip install -r requirements.txt`,
then `Start Portal.bat` (first run: `create-admin`, `seed-defaults --user admin`, then `serve --open`).
Share with `--host 0.0.0.0`.

## Working on it

- Tests: `.venv\Scripts\python -m unittest discover -s . -p "test_*.py" -t .` (synthetic data only).
- `build_pages.py` regenerates `docs/` (the Pages build) from `portal/static` and `portal/seed.json`.
  Edit the seed JSON, never `docs/seed-data.js`.
- Code layout: `portal/db.py` schema and migrations, `portal/qa.py` evaluation and scheduling,
  `portal/service.py` operations, `portal/server.py` HTTP, `portal/sphinx.py` Sphinx reader,
  `portal/static/` interface shared by both builds, `docs/local-backend.js` browser-only backend
  (keep its rules in step with `qa.py` / `service.py`).
- `.claude/launch.json` attaches the app's browser pane to a server you start yourself
  (`run_portal.py serve --port 8790`); the app's own runner may not be able to launch Python.

## Machines and lists (portal/seed.json)

- GTR1, GTR2, GTR5 — Proton gantry. Daily list = `PBS DailyQA Template - Sphinx` (six spots with the myQA TG-224
  references and Warning/Action limits; Sphinx `.xls` auto-fill); monthly list = `Monthly QA template – Proton
  gantry (TG-224)` from the boss's GTR5 monthly worksheet (floridaphysics repo). The TG-224 daily template is kept
  but not scheduled. GTR5's exports carry nine spots; only six are on the list (open question).
- Eyeline GTR4 — Proton eyeline. One `Eyeline Daily QA` list (PDD / Output (partial) / Imaging / Safety).
- TrueBeam — Linac (daily per Penn list + `SRS QA – TrueBeam` as needed). Linac 1 (Elekta Synergy), Ethos.
- Big Bore CT (7064) — CT simulator. MRI Sim — MRI simulator (placeholder).

## Brook's preferences — how it must look and behave

These were stated directly (2026-10-22) and override older notes. Check every change against them.

- **Wording:** PASS / WARNING / ACTION; limits "Warning ±" / "Action ±" (never Tolerance/Action or Warn/Fail).
  "Δ", never "delta". Title case in chart text; statistics "Mean … ± … · 95% CI … · N … · Range … · Biggest
  Outlier … on <date>". A list is "Schedule"d on machines; "Duplicate" makes a separate list under a new name.
- **Look:** calm — no vertical rules, no zebra, no orange direction blocks, no boxes or colour on axis letters
  (X/Y/Z, Pitch/Roll/Rotation are plain text; only chart lines are coloured). Directions are one quiet line under
  the test (full text on hover). Large fonts (base 16 px). Nothing scrolls sideways. Never show "null",
  "undefined", "[object …]" or "unitless". Keep words to a minimum (the boss called an earlier layout "too busy").
- **Tables** (Perform QA and Machine Trends share the layout): `# · Test/Energy/Axis · Unit · Baseline ·
  Measured/Latest · Deviation · Result · Comment · History · (30 days) · Trends`. Per-energy/spot measurements are
  one titled table with one row per energy ("Spot 1 · 226.4 MeV" on one line); X/Y/Z (+3D) likewise, no lines
  between its rows. One sequential number per block, centred in the # column, identical on both pages
  (`blockNumbers()`). One decimal count per table. History = dates in a header row, values in equal slots under
  them, only as many as fit one line. Every numeric result gets a green/yellow/red Δ badge. Comments behind a
  pencil icon. Yes before No.
- **Charts:** views "Absolute <unit>" and "Δ from Reference", unit unchanged between them; several series in
  Absolute = stacked subplots. Lines join dots; green band inside warning, orange strips warning→action; axis spans
  the warning band; calendar x-axis with a line per month; HTML key under the chart; biggest outlier ringed; click a
  dot to show date, value, Δ. Pass-rate rings: thick, green/red only, small number inside; per test ("30 days"
  column) and beside each machine's last result on the Dashboard; never a row of rings at the top.
- **One QA list object (Brook, 2026-10-22, emphatic):** Setup QA, Perform QA and Machine Trends all read the same
  list row; a list is scheduled on machines directly (never copied per machine). Default baseline / Warning / Action
  live on the list; a machine's own values are overrides on its schedule, edited with "Values for" in the list
  editor. Never reintroduce per-machine copies, templates-vs-instances, or auto-sync. Numbering is `blockNumbers`
  everywhere (editor, Perform, Trends).
- **Lists and actions:** Setup QA has a QA Lists table (✎ left of the name; ＋ schedule on machines, 🗑 delete,
  ⋯ Duplicate / Re-evaluate / Archive; Scheduled On chips) and a Machine Schedules table grouped by machine
  (Machine Values count; ⋯ Set Active/Inactive, Values for this machine, Schedule and import folder).
  Perform QA: green ▶ before every list (no Start column), due lists first, Save (draft) button, frozen title row.
  Tabs: ⌂ (Dashboard, icon only) · Perform QA · Review QA · Setup QA · Machine Trends · Data Administration — no
  Machines tab (machine pages open from Setup QA names).
- **Data rules:** "QA Performed By" starts as the signed-in user; other text fields carry forward the last recorded
  value (no fixed defaults). Monthly lists are due on the last day of the month; daily at 6:00 AM on weekdays.
  Sphinx-measured fields are read-only and filled from the export (acquisition date/time too). Records store inputs
  and derived values (kTP, dose, 3D, Δ, verdicts) plus the template version; Re-evaluate is an explicit, logged
  admin action. Keep localhost and the GitHub page in sync and verify the live files after every push; one-line
  CHANGELOG entry per commit.

## Waiting on Brook

DQA3 sample export and MPC results format (TrueBeam importers), the Dose Pro procedure, the TG-66
daily table (CT Sim tolerances), and the MRI daily items.
