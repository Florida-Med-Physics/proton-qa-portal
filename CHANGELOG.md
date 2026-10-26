# Changelog — Physics QA Portal (proton-qa-portal)

All notable changes to this project are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). No version has been tagged yet. The suggested first tag is `v0.1.0`, once the host-PC deployment has been tried.

**How to keep this file up to date:** with every commit, add a one-line, plain-language entry under **Unreleased**. When you cut a release, rename **Unreleased** to the new version number and date, and start a new empty **Unreleased** section above it.

Entries marked **[Physics review]** change QA tests, tolerances, templates, or how results are judged, so a qualified medical physicist should review them before relying on the change. This software is not validated for clinical use.

## [Unreleased]

- Let Perform QA columns size to their contents so enlarged numbers, headers and controls cannot overlap; keep horizontal overflow inside each table on narrow screens.

- Use plus icons for comments, reserve space for test numbers and headers, show Pass as the boolean baseline, and fill missing matched Ortho axis defaults from the supplied workbook (cm conversion); preserve existing values and machine overrides.

- Allow blank or partial QA lists to be submitted for review; preserve unanswered tests in review/PDF and never count them as passes.

- Refresh the browser backend cache fingerprint so the four demo accounts load into Users and rights.

- Add the temporary MPA / MPA demo login without resetting existing account passwords.

- Replace browser role selection with temporary password accounts (Physicist, Therapy, Admin), reject incorrect passwords, and support Admin-created accounts and password resets.

- Add MPA role with provisional QA-entry access; record therapist sign-off before required Physicist final approval.
- Prepare shared-server deployment, HTTPS proxy configuration and verified shared-drive snapshots; the UFHPTI host installation remains pending.
- Make Add user prominent in Data Administration with an explicit Admin sign-in explanation for other roles.

- Show the most recently edited template first within each modality, including test edits and same-second changes.

- Edit test names, categories and result types directly in template rows; Save template commits definitions and defaults together with rollback on validation errors.

- Use Select Import Folder in Machine Trends with recursive CSV/XLS discovery and visible subfolder paths.
- Generalize PBS template labels, apply matching workbook warning/action bands without changing baselines/overrides, unify Perform typography, and prevent scroll-wheel changes to numbers.

- Move machine-schedule editing beside the left menu and permit zero-test QA lists to be completed as recorded, pending review, with normal PDF generation.

- Place pass-percentage circles beside their measurement/energy labels instead of at the far edge.

- Show Skewness as two side-by-side axis subplots, all energies in X and all energies in Y, with matching energy colors.

- Restrict trend statistics to marker, energy, reference, trend average ± SD, and maximum outlier/date.

- Replace latest-status chart badges with selected-period pass-percentage rings and per-energy breakdowns on expansion; include warning/action segments and all measurements, including plot-excluded extremes.

- Remove duplicate energy entries from the chart legend and prevent absent exclusion notices from rendering as “null”.

- Group isocenter coincidence axis measurements into one side-by-side subplot panel.

- Separate spot Position X/Y energy families; exclude >5-SD extreme values from plotting, scaling and least-squares fits using each point’s other-series results (minimum five), with a visible exclusion note and raw values preserved.

- Default charts to Absolute with prediction off; restrict statistics to colored marker, energy, average ± standard deviation, and maximum outlier/date.

- Limit displayed trend measurements, statistics, fits, insights, and axis values to two significant figures; preserve saved/exported precision and exact energy/date labels.

- Preserve template/CSV measurement and energy order in Machine Trends instead of sorting graphs alphabetically or energies numerically.

- Preserve energy colors in absolute subplots, add a four-week prediction toggle, and remove outlier rings around measured points.

- Show absolute energy plots in a compact responsive 3×2 grid with a shared legend and explicit date ticks on every chart.

- Explicitly label chart trend lines as least-squares fits; each series uses its own measurements from the selected period.

- Group every measurement repeated across energies on one trend chart, including fall off, proximal depth, width, and shared X/Y series.

- Group all Distal Depth energies together on one machine trend chart, including the linked values/detail view.

- Simplify Machine Trends to one machine, grouped expandable measurements, clickable insights, energy-only spot labels, and shared X/Y graphs.

- Scan all default-folder Sphinx XLS/CSV exports, automatically import new files for review, skip duplicates, and explain unreadable files. Recheck every minute while Data Administration is open.

- Home dashboard: responsive 2×2 Proton/Photon/Brachy/Simulation cards, including active daily/monthly/on-demand lists with individual due/start controls.
- Remove Linac 1 from active defaults; expose machine deletion for unused machines and retirement for machines with history.
- Increase typography and use fluid lateral scaling; Setup/Review adapt into labeled rows on small screens.

- Machine Trends dashboard: default GTR1/GTR2/GTR5 comparisons, multi-machine picker, summary metrics, chart cards, and explainable local pattern insights.
- New QA Template List: add departmental starters, blank templates, and worksheet/column-reviewed Excel or MyQA checklist import with atomic creation; bundle the spreadsheet reader for offline use.

- Machine Trends: add compact Import, Export CSV and folder settings; remember import list and per-machine export folders, reuse existing import folders, and export only the selected list/period/tests with recorded and current limits.

- Simplify Machine Schedules: edit only the schedule with a pencil beside its description; shared tests are edited in QA Template Lists.
- Scope inactive/tolerances/duplicate/re-evaluate/archive/delete actions to the selected machine schedule, preserve history, and add archived schedule restoration.

- Setup QA: expose Add machine at the top and Manage machines below; new machines open directly to QA list scheduling.

- Add Archive to template menus and a restorable Archived templates section; keep results and per-machine settings and prevent performing archived templates.

- Setup QA: group QA Template Lists into Proton, Photon, Brachytherapy and Simulation, with search across all groups.

- Keep one shared template with per-machine excluded and extra tests, a searchable Customize tests checklist and Reset to template; machine-only Sphinx imports respect exclusions.
- Add HDR Flexitron with Daily QA and Source Exchange QA, both on demand; approved checklists still needed.
- Widen Perform QA test labels and template category columns for readable names.

- Show due countdowns in Hours below 24 hours and Days for longer deadlines.

- Perform QA: autosave drafts while entering results, automatically download a completion PDF, and allow report downloads from saved runs.

- Template usability: test search with counts, sticky save controls, clear unsaved status, and protection against switching limit scopes before saving.

- Use Default Warning and Default Action in the template column heading and individual test editor as well as limit rows.

- Remove Schedule on machines from Machine Schedules menus; retain it in QA Template Lists.

- Machine Schedules: show Active/Inactive only beside the QA list name, leaving the toggle without repeated text.

- Schedule dialog: allow existing machines to be unticked or reactivated while keeping their settings and history.

- QA Template Lists: place the options menu between the pencil and name and remove the Actions column.

- Template limits: label Default Warning and Default Action and use radio buttons to select per-machine limits.

- Show test modification details only in the individual test editor, not as a list column.

- QA list editor: automatically group related X/Y/Z measurements under one heading and show shared directions once.

- Warning/action level mode: offer only Absolute or Percent, showing the effective mode for inherited values.

- Remove Active from QA Template Lists; activation is controlled per machine in Machine Schedules.

- Keep menus beside edit pencils opening toward the table contents.

- Machine Schedules: place all list options, including Edit, in a three-dot menu beside the pencil.

- Machine Schedules: remove Actions and Last Modified columns.

- Machine Schedules: add per-machine Active switches and preserve machine settings when toggling the shared list.

- Setup QA: combine template list actions into one vertical three-dot menu at the right.

- Machine Values: show Default when a schedule uses the list defaults.

- QA Template Lists: label the column Active and use one on/off control with green Active text.

- Setup QA: use Active/Inactive radio buttons for each QA template list and remove its Last Modified column.

- Setup QA: rename QA Template Lists and add an Active/Inactive status column, keeping inactive lists available for reactivation.

Development from 2026-10-21 to 2026-10-22. Everything is on `main` and pushed.

### Added
- GitHub page: script and stylesheet links carry a content fingerprint, so browsers load the new version right after a push.
- Browser build: the Sphinx assignment step no longer switches off monthly lists; monthly schedules it had switched off are switched back on once.
- Setup QA and the list editor: the edit pencil sits to the left of each list or test name.
- **[Physics review]** One QA list object: a list is scheduled on machines directly and Setup QA, Perform QA and Machine Trends all read it; per-machine copies were merged into their lists (history moved intact; differing limits became that machine's own values); Auto-sync removed.
- List editor: "Values for" switch edits the default baseline / Warning / Action or one machine's own values; numbering matches Perform QA and Trends; header row pinned; blank unit shows nothing.
- Setup QA: one QA Lists table (Scheduled On) and a Machine Schedules table (Machine Values); Perform QA titles name the machine.
- Machine Trends: a chart of every energy (or spot) under each energy table, opening on Δ from Reference.
- Machine Trends: the machine, a new QA list picker and the period sit in a frozen row at the top of the page.
- **[Physics review]** Auto-sync: a machine list with Auto-sync ticked (Setup QA, off by default) that still matches its template takes every later template edit (limits, names, units, notes, order, tests added or removed); lists changed on their machine are left alone. Removed tests with results are kept as records; each sync is audited.
- Dashboard shows only each machine's Daily QA list (its most frequent list) with the start arrow, and its Due Date follows that list; monthly and other lists stay on Perform QA.
- Energy rows read "226.4 MeV" (no "Spot n"); the 30-Day Avg shows its Δ from the list baseline underneath.
- Chart statistics (Mean, SD, 95% CI, Range, Outlier, Trend, projection) are shown to three significant figures.
- Instantiate on a Machine keeps the template's name and takes several machines at once (tick boxes), creating one list per machine on the same schedule.
- History shows the last three QA dates; Machine Trends adds a 30-Day Avg column (mean of the last 30 days' values) left of the pass ring.
- Setup QA and the list editor show one Last Modified column (date, then who) instead of two.
- The reference (baseline) line on charts is a solid, thicker black line.
- Every History value carries its unit ("77.7 mm").
- **[Physics review]** Trend charts draw a red straight-line (least-squares) fit through the results and project it 4 weeks past the last result (dotted red); the statistics line adds the slope per week and the projected value.
- **[Physics review]** Machine Trends uses the QA list's current limits (reference, warning, action as resolved for that machine) for the limits line, bands, Δ badges, result chips and 30-day rings; the verdict recorded at QA time is unchanged in Review QA.
- Chart Y axes name the quantity ("Y Offset (mm)", "Δ Distal Depth (mm)") instead of "Absolute".
- Inline trend charts fill the row, are taller, use larger text, show their key, and draw the red fit on top of the series.
- Table cells are centred both ways (test names stay left) and the 30-days ring fits inside its row.
- Perform QA is grouped by machine like Setup QA: a header row per machine, then its lists (daily above monthly); the Machine column is gone. Numbers are centred in their columns everywhere.
- Dashboard: a ring beside each machine's last result shows the share of its tests that passed in that run, and a green start dot sits before each list in Active QA lists (daily above monthly, with space between). CLAUDE.md now carries Brook's look-and-behaviour preferences.
- Setup QA actions are three icons per row — pencil (edit tests), plus (instantiate on a machine / duplicate), trash (delete) — with Set Active, Make Template, Re-evaluate and Archive behind a small "⋯" menu.
- Trend charts: the absolute view of an X / Y / Z set is drawn as stacked subplots (one per axis, each on its own scale around its own reference) instead of one squashed axis.
- Trend charts have a true calendar x-axis with a vertical line at each month (labelled every few months), the within-warning band is green again, and clicking a dot lights it up with its date, value and Δ (click again to clear).
- Trend charts: "Δ" is never spelled out; the statistics read "Mean ± SD · 95% CI · n · range · biggest outlier (date)", the biggest outlier is ringed on the chart, and the within-warning band is baby blue.
- Trend charts: the two views are "Absolute <unit>" and "Delta from Reference", the axis keeps the unit in both, the band inside the warning limits is green and the band between warning and action is orange, named "Within Warning" and "Warning to Action" in the key.
- Fewer words: the chart legend line on the trend page is gone (the chart has its own key) and the "Calculated here: …" / "Filled in from the Sphinx export file" notes are removed from every test; calculations still run.
- Every font size steps up two sizes across the portal; the pass rings are thicker and read green (passed) or red (warning or action).
- Machine Trends: a "30 days" column right of History holds an open-circle ring per test with the share of its results that passed in the last 30 days (warning and action arcs in their colours).
- New "Review QA" tab to the right of Perform QA: submitted runs awaiting a physicist's sign-off (with a Review button), then recent decisions, and a link to all past results.
- "QA Performed By" starts as the signed-in user on every list (still editable if someone else performed the QA). Table titles, their directions and limits are much larger; the "Reference and limits from the Sphinx reference sheet" notes are gone; "Spot 1 · 226.4 MeV" always sits on one line.
- Baseline, latest and history values in a table share one number of decimals (the most any of them needs), so 3.0 mm sits beside 2.7 mm rather than "3 mm".
- **[Physics review]** Machine Trends shows, with each table, the WARNING / ACTION limits its latest results were actually judged against (not the list's current limits), so the verdicts and deltas read consistently. Setup QA gains a logged admin "Re-evaluate" action that re-judges every recorded result on a machine list against its current limits and rewrites the stored limits, verdicts and run overalls.
- Test numbers are one per block and sequential within a section (a single test, a per-energy / per-spot table or an X/Y/Z table each count once), computed from the list itself so Perform QA and Machine Trends show the same numbers. Energy / axis tables give the Energy column more room.
- Machine Trends: the "N at action level" and "N outside tolerance" chips are buttons that narrow the tables to those tests (click again to show everything).
- Machine Trends uses the Perform QA layout: a heading per section, a box per category, Sphinx energy tables with one row per energy, X / Y / Z axis tables, and columns # · Test · Unit · Baseline · Latest · Deviation · Result · History · Trends, with the chart opening under the row from the dot icon. Perform QA: the Start column is gone — the green arrow in front of every list opens it — and due lists sort to the top.
- Monthly (and quarterly / semi-annual / annual) lists fall due on the last day of the month — the start month at first, then the month one period after the last run — and say so in their schedule.
- Text fields on Perform QA (QA Performed By, PTS Version, PTS Config Version, …) start from the value recorded last time on that list, or from a "[default: …]" set in the test's directions; either can be overtyped.
- Sphinx list: the file-name item (old 3.10) is gone and "Sphinx acquisition date and time" is filled from the export itself (read-only); section 3 renumbered. Test column widened; section summaries no longer print "[object HTMLSpanElement]".
- **[Physics review]** Perform QA rows now follow the Monthly QA page layout: # · Test · Unit · Baseline · Measured · Deviation · Result · Comment · History · Trends, with PASS / WARNING / ACTION wording site-wide, limits under the test name, directions as a quiet one-liner (full text on hover), notes behind a pencil icon and no vertical rules. New "Monthly QA template – Proton gantry (TG-224)" (128 items from the GTR5 Monthly QA worksheet: chamber conditions with calculated kTP, safety, mechanical with BB-walkout X/Y/Z and radial, output dose = M × kTP × N_Dw × k_Q × k_s × k_pol, Zebra ranges, quarterly spot QA, imaging), instantiated monthly on GTR1, GTR2 and GTR5; commissioning baselines are blank until entered. The Machines tab is gone; machine pages open from Setup QA machine names and Data Administration. X / Y / Z offsets are small titled tables with one row per axis (and the 3D magnitude), like the Sphinx energy tables; the table carries one number (in the # column, larger, centred on the block), plain axis letters and no lines between its rows.
- GATORQA-DESIGN.md: the plan for bringing GatorQA onto floridaphysics.com alongside its Monthly QA page (shared platform and template schema, PASS / WARNING / ACTION, entries stored with derived values plus template version, trends for monthly and daily, on-site agent with a nightly local copy).
- Eyeline GTR4 has one daily list, "Eyeline Daily QA" (sections Administrative / Dosimetry: PDD / Dosimetry: Output (partial) / Imaging / Safety), replacing the three separate lists.
- Machine Trends: the table is Test · Reference · Warn · Fail · History (values under their QA dates, as in Perform QA) · Trends, and a search box narrows it to matching tests. Axis labels (X / Y / Z, Pitch / Roll / Rotation) are plain text everywhere, never coloured; only chart lines carry colour.
- Perform QA: a Save button keeps what has been entered (per user and list) without submitting, and it is restored when the list is opened again; the list's title row stays frozen at the top while scrolling. Chart toggle reads "<unit> | Δ from reference" in one colour, the chosen one underlined.
- **[Physics review]** New machine "Eyeline GTR4" (proton eye line) with three daily lists transcribed from RadMachine: Dosimetry: PDD (22 items; Total Offset and Measured Range Eyeline are calculated), Imaging (17 items) and a PARTIAL Dosimetry: Output list (the screenshot was unreadable past the first items — to be completed). Setup QA: "Generated from" says "No changes" or "Changed (n tests)" comparing each machine list with its template. Perform QA: X, Y, Z and 3D stack in one column; history dates sit in one line of separated slots, only as many as fit the column.
- **[Physics review]** The limits are called Warn ± and Fail ± everywhere (was Tolerance / Action). The Sphinx template and its GTR1/GTR2/GTR5 instances carry the warn / fail limits from the myQA TG-224 template export (60 tests matched by what they measure). Perform QA: the Start button is the third column.
- Perform QA: an X / Y / Z offset (and its calculated 3D offset) is one row with the three fields side by side, one status, one comment, history per axis, and a trend that plots X, Y and Z together. Machine Trends groups such tests the same way even when the name ends with a unit.
- Every numeric result shows its Δ from the reference as a green / yellow / red badge (Perform QA as you type, run pages, Machine Trends; history chips carry it in their tooltip). Chart keys are plain text under each chart, readable at any chart size; the "Last Edited By" direction is gone (the field still fills itself).
- Dimensionless values (skewness, correction factors) show no unit at all instead of the word "unitless"; a chart with no unit titles its axis "Value". Yes/No checks read Yes then No.
- **[Physics review]** Perform QA: every measured test is a table row (Measurement, Reference, Tolerance, Action, Status, Comment, History, Trends), not only the Sphinx families. RadMachine transcription notes are gone or do the action: "Last Edited By" fills in with the signed-in user; 3D offsets are √(X²+Y²+Z²) of the three fields above; kTP = (273.15+T)/(273.15+22) × 101.325/P (TG-51 reference conditions, to be confirmed); overall calibration factor = chamber × electrometer; daily output dose [cGy] = charge [nC] × 10⁻⁹ × overall factor [Gy/C] × kTP × 100 (formula to be confirmed against RadMachine). A stray "null" under section headings is fixed, and the page can no longer show "null" or "undefined" for a missing element anywhere.
- No sideways scrolling anywhere: tables shrink to the page (history slots wrap, headers wrap at spaces). Machine Trends table has the Perform QA columns (Measurement, Reference, Tolerance, Action, Status, Trends). Trend charts draw a line from result to result, carry a key (series, reference, Tolerance and Action bands) and switch between Absolute and Δ from reference.
- Header search box (Ctrl+Shift+F) that finds machines, QA lists and tests; every table sorts by clicking a column header (arrow shows the direction); Setup QA has a filter box above each table, templates say "Instantiate on a Machine", and a machine's list can be saved back as a template ("Make Template"); daily lists are due at 6:00 am on weekdays ("Due in N hours (date 6:00 AM)" / "Due now"); the Machine Trends tab is text only again.
- **[Physics review]** The Sphinx list ("PBS DailyQA Template - Sphinx") is now the proton daily list, instantiated on GTR1, GTR2 and GTR5 (the TG-224 instances are retired, nothing deleted); it has six spots with the references and Tolerance/Action limits from the Sphinx reference sheet, sections 1.0 Setup and Safety / 2.0 Mechanical and Imaging / 3.0 Sphinx Measurements / 4.0 Final safety checks, "Distal Fall Off" spelled out and the GTR5_ prefix dropped. Perform QA: the measurement file is the first step of 3.0, Sphinx-measured fields are filled from the file only (read-only), the history column shows the QA dates in its header, the Trends column opens the trend with the dot icon, "Spot" reads "Spot Characteristics", and "Reference: Yes" directions are gone. Setup QA shows (Inactive) beside unscheduled lists. Local data: GTR1 (942) and GTR5 (201) runs moved onto the new lists where a matching test exists.
- Setup QA: Set Active / Set Inactive button on each machine-assigned list with an (Active) tag by the name; a Modified By column; templates are "Instantiate"d onto machines; table rows are indented under their (larger) headers; the home icon now opens "Dashboard", whose Today column is now Due Date; Machine Trends and the quick-trend buttons carry a dot-grid trend icon; the portal is now "GatorQA – UFHPTI Machine QA" with a UF Proton dot-grid mark (orange centre spot) in the header, on the login page and as the favicon.
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

## 2026-10-26 — QA entry, imports and departmental templates

- Phone QA cards preserve original inputs and desktop layout; vivid PASS/ACTION results and uniform result labels.
- Daily HDR and TrueBeam Monthly source-based starters; original monthly Excel upload and filled workbook export.
- Multiple choice tests, bulk user spreadsheet import, password-change access, and dashboard history rings.
- Recursive folder imports without a second file picker; Perform autofills only reports matching the selected QA date and keeps existing entries.
- DoseLab Winston-Lutz PDF import: filename identifies TrueBeam; only Maximum delta < 1 mm passes (1 mm fails); total delta values are informational.
- Template seed updates preserve local customization and historical results.

- PBS Daily QA Sphinx enters the physicist review queue only after test 4.06 is Pass. Blank/failed checks remain saved; therapist sign-off records the passing check and preserves the separate physicist approval.
