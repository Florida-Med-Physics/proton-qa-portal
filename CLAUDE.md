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

- Tests: `.venv\Scripts\python -m unittest discover -s . -p "test_*.py" -t .` (38 pass; synthetic data only).
- `build_pages.py` regenerates `docs/` (the Pages build) from `portal/static` and `portal/seed.json`.
  Edit the seed JSON, never `docs/seed-data.js`.
- Code layout: `portal/db.py` schema and migrations, `portal/qa.py` evaluation and scheduling,
  `portal/service.py` operations, `portal/server.py` HTTP, `portal/sphinx.py` Sphinx reader,
  `portal/static/` interface shared by both builds, `docs/local-backend.js` browser-only backend
  (keep its rules in step with `qa.py` / `service.py`).
- `.claude/launch.json` attaches the app's browser pane to a server you start yourself
  (`run_portal.py serve --port 8790`); the app's own runner may not be able to launch Python.

## Machines and lists (portal/seed.json)

- GTR1, GTR2, GTR5 — Proton gantry. TG-224 daily list from the myQA template; Sphinx `.xls` import works.
- TrueBeam — Linac. Daily list mirrors the Penn list exactly: 1.00–1.12 Safety, 2.01–2.12 Dosimetry per
  energy, 3.0 Physics Review, every item Pass / Warning / Fail. Plus `SRS QA – TrueBeam` scheduled
  "as needed" (Dose Pro, SRS days only).
- CT Sim — CT simulator. Follows the TG-66 daily structure; tolerances not entered yet.
- MRI Sim — MRI simulator. Placeholder until we know what is collected daily.

## Interface decisions

- Tabs: Perform QA / Setup QA / Machine Trends (myQA-style). No History tab; past results via a link.
- Perform QA shows one table per machine type, with pending reviews for physicists.
- "Tests", not "checks". Test types: numeric, pass/fail, pass/warning/fail (`status`), text.
- Frequencies include `asneeded` (never overdue, always startable).
- Each scheduled list can have a default import folder; the Perform page lists that folder's files.

## Waiting on Brook

DQA3 sample export and MPC results format (TrueBeam importers), the Dose Pro procedure, the TG-66
daily table (CT Sim tolerances), and the MRI daily items.
