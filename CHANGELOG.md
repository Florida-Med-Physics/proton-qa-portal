# Changelog — Physics QA Portal (proton-qa-portal)

All notable changes to this project are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). No version has been tagged yet. The suggested first tag is `v0.1.0`, once the host-PC deployment has been tried.

**How to keep this file up to date:** with every commit, add a one-line, plain-language entry under **Unreleased**. When you cut a release, rename **Unreleased** to the new version number and date, and start a new empty **Unreleased** section above it.

Entries marked **[Physics review]** change QA tests, tolerances, templates, or how results are judged, so a qualified medical physicist should review them before relying on the change. This software is not validated for clinical use.

## [Unreleased]

Development from 2026-10-21 to 2026-10-22. Everything is on `main` and pushed.

### Added
- Setup QA: Set Active / Set Inactive button on each machine-assigned list with an (Active) tag by the name; a Modified By column; templates are "Instantiate"d onto machines; table rows are indented under their (larger) headers; the portal is now "UFHPTI Machine QA Portal" in UF orange.
- Portal with user accounts, machines, scheduled QA queues, results review, and trend charts.
- **[Physics review]** Import of Sphinx daily QA exports (G1/G5): fills in the entry form, imports history in bulk, and has a command-line tool.
- **[Physics review]** Template QA lists with per-list tests, GTR naming, and import of the TG-224 checklist.
- **[Physics review]** All machines alongside the proton gantries: TrueBeam, CT Sim, and MRI Sim. There is one starting daily template per machine type: proton (TG-224), TrueBeam (Penn daily list), CT Sim (following TG-66, with no tolerances entered yet), and an MRI placeholder. There is also an as-needed SRS QA list for the TrueBeam.
- New Pass / Warning / Fail test type, and an "as needed" frequency.
- Each scheduled list can have a default import folder, and the Perform page lists the files in it.
- Browser-only build for GitHub Pages; this version can keep the whole database in a file you choose.
- The server build loads shared starting data (machines and templates) on first run.
- Project notes (CLAUDE.md) and a launch configuration for the browser pane.

### Changed
- Renamed to Physics QA Portal, with three tabs: Perform QA, Test Setup, and Machine Trends.
- **[Physics review]** Sphinx test names are standardized across machines, and per-queue limits are kept for shared tests.
- Perform QA shows one table per machine type, plus pending reviews. The Setup QA tab now uses the same layout.
- **[Physics review]** In Machine Trends, the X, Y, and Z values of a test share one chart (shown as deviation from expected), with statistics and values for each axis.
- Lighter screens; template sections include directions; added a trend overview.
- The README describes running the portal on a host PC as the intended setup.
- Four tabs: Perform QA, Setup QA (the editable QA lists and templates), Machines (add machines and assign QA lists to each), and Machine Trends.
- QA lists are shown by their full name everywhere, for example "Daily QA – GTR1".
- The Templates section is now called "QA List Templates".
- Setup QA has two tables: QA List Templates on top, and Machine-Specific QA Lists (each machine's own copy of a template; edits there do not affect the template) below.
- Machine Trends: couch Pitch, Roll and Rotation share one chart, like X/Y/Z.
- Machine Trends: the overview is a table (one row per chart) instead of card panels; charts plot dots instead of lines (one colour per axis, warning/fail ringed); all dates show the year.
- **[Physics review]** Built like the myQA sheet: every numbered item is its title, then a Directions block, then the result. "0.01 Daily QA Setup" is now a pass/fail test with its directions (it was loose setup text); the protocol note stays at the top.
- **[Physics review]** Units on the proton template's 2.02–2.06 measurements (laser/kV alignment offsets, CBCT and kV/kV correction vectors, kV/kV-to-CBCT deltas): mm. The myQA table has no unit column; the values are millimetres (a −5 cm shift is entered as 50). The editor now flags any measured test without a unit.
- Setup QA tables: Tests column centred, a Last Modified column (from the audit log), and the buttons column titled Actions.
- "Due today" now reads "Due in XX hours (date)", counting down to the end of the due day.
- Perform QA: measurements repeated per energy or spot (distal depth, DFO, sigma X, …) are shown as one table per measurement: energy, measurement, reference, tolerance, action, status, comment, the last five results, and a button that plots the trend in place.
- Perform QA no longer lists the folder's files; the newest unrecorded export is read in automatically and one line says which.
- Setup QA: click a QA list's name to rename it; the machine lists are grouped under each machine ("Machine-Assigned QA List Instances"), with a "Generated from" column naming the template each came from.
- Header is one compact bar in the RadMachine style: brand at the left, home icon and tabs, the signed-in person at the right (the logo stays on the sign-in page). Tables have light column separators.
- QA list editor: drag a test by its ⠿ handle to reorder it (or use ↑/↓); Save keeps the new order.
- **[Physics review]** Limits are named as in RadMachine: "Tolerance ±" (was warning) and "Action ±" (was fail); results outside tolerance read "Tolerance", beyond the action level "Action". Pass/fail checks keep Pass/Fail (or Yes/No).
- **[Physics review]** New template "PBS DailyQA GTR5 - Sphinx", transcribed from the RadMachine list (125 tests in RadMachine's order, wording and categories; three named sections; No/Yes checks; RadMachine references as expected values). Tolerances were not shown, so values are recorded, not judged; 30 spot references (spots 3–7) were not in the screenshots and are marked to be entered. Calculated RadMachine fields are entered by hand here.
- Sphinx exports now fill tests by what they measure, so RadMachine-style names ("GTR5_Energy [100.00 MeV]: Spot1 Pos X [mm]") are filled as well as the portal's own.
- "Linac 1 Synergy" renamed "Linac 1"; Setup QA action buttons line up between the two tables.
- Renamed "UF Proton Machine QA Portal"; the header uses the UF Health deep navy (#0d1d3e) and orange (#f37021) sampled from the logo.
- Machines are grouped Proton, Photon and Simulation (Big Bore CT, MRI Sim). Added Linac 1 Synergy and Ethos to Photon (no QA lists yet).
- Setup QA's two tables share one width and column layout; on Machines, hovering a QA list row no longer matches the machine row colour.
- QA lists can be archived (hidden from Perform QA, Machines and Trends; tests and results kept; restore from "Archived QA lists" in Setup QA) or deleted permanently. Delete is refused for any list with recorded results, so QA history cannot be deleted.
- Data Administration (server build): an admin can switch the portal to another database file. A new file is created empty with the admin's account copied in; the choice is remembered across restarts (data/portal-settings.json) unless --db or PROTON_QA_DB is given.
- Home: an Active QA lists column, and no machine-type label under each machine (also removed on Perform QA).
- New Home dashboard (house icon at the far left of the tabs): QA to do today, overdue, machines whose last result failed, runs waiting for review, then every machine with today's status and last result. Perform QA moved to its own tab address.
- Perform QA, Machines and Home group machines into two tables, Proton and Photon (TrueBeam, CT and MRI simulators), with the same width and column layout.
- Admin is renamed Data Administration.
- Section headings (0.0 Setup, 1.0 Safety, …) stand out more than the items in them, and each item's directions run the full width directly below its labelled test, in both the QA list editor and Perform.
- The QA list editor in Setup QA follows the same layout: section headings (0.0 Setup, 1.0 Safety, …), each item numbered ("0.01: Daily QA Setup") with its Directions block, then its result type and limits.
- Perform QA shows the machine name on every row (e.g. both TrueBeam lists).
- New Admin tab (5th tab): users and what each role may do (admins add users and change roles), and an import folder for each scheduled QA list. When QA is started, the newest export file in that folder not yet recorded is read in automatically.
- Admin also holds the database settings: the database file location (shown on the host PC for the server version; choosable plus backup/restore in the browser version), moved from Setup QA.
- Tables size to their content instead of stretching across the page, with a maximum column width.
- **[Physics review]** "Daily QA template – Proton gantry (TG-224)" now matches the myQA TG-224 template outline exactly: 0.01 setup (with the protocol note), 1.01–1.10 Safety, 2.02–2.06 Mechanical / CBCT, and 3.01 Sphinx Tests with every Energy, Spot 1–6, Coincidence, Homogeneity and Output parameter and the template's expected, warning and error values (82 tests). Machine-specific lists are unchanged.
- **[Physics review]** Sphinx test names follow the myQA template and keep the spot number: "Spot 1 [225 MeV] – Sigma X", "Energy [100 MeV] – Distal Depth". GTR5 exports have no spot numbers, so its spots are numbered in file order (Spot 1 = 100 MeV … Spot 9 = 80 MeV). Existing tests are renamed in place.
- **[Physics review]** Couch translation is no longer imported from Sphinx exports (it is documented in RadMachine). Couch tests already imported from Sphinx are taken off their lists; their stored values are kept.
- Every trend chart now shows its statistics (n, mean, SD, range, with units), a y axis titled with the unit and auto-scaled to the data (limit bands are clipped to fit), and a dated x axis titled "Date".
- Units shown everywhere: chart axes, limits, deviations, means. CT BB geometry tests are in mm (RadMachine labels them "(BB)"), and spot skewness is labelled "unitless".
- QA list editor columns: Test Name, Category, Expected (with units), Tolerance (warning and fail, with units), Modified Date and Modified By. Saving a list now records each test whose limits changed.
- UF Health Proton Therapy Institute branding (logo, navy header, orange rule), light by default, with a "Dark mode: On/Off" button remembered on each computer, as in the TrueBeam Service Log.
- **[Physics review]** CT Sim is now "Big Bore CT (7064)", running "Bigbore CT Daily": the 13 tests, names, categories and reference values from the RadMachine list. Warning and fail tolerances are not entered yet, so CT values are recorded, not judged. Browsers that already had the old CT Sim list are upgraded automatically if no CT results were recorded.

### Fixed
- Machine Trends no longer fails because of a missing section helper, and a machine's trends now load in one request.

[Unreleased]: https://github.com/Florida-Med-Physics/proton-qa-portal/commits/main
