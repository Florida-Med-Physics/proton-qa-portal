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
  but not scheduled. In the seed (Brook, 2026-11-20) the instruction-only steps of the daily list are directions
  (the seven setup steps of Setup and Safety; seventeen in Mechanical and Imaging for the block below them; "Retract panels A
  and B.", "Go to MyQA…" and "Deliver the beam." for the Sphinx Measurements section), tests share rows (2026-11-26:
  delivered MU with beam time; chamber, electrometer, their factors and the overall factor on one line; before that: chamber and
  electrometer with their factors, Charge [nC] with Dose [cGy], the coincidence X offset with Y), block 2.02
  is "Mechanical-to-kV/kV Isocenter [cm]" (X, Y, Z, 3D), 2.03 "Mechanical-to-CBCT Correction Vector [cm]" (baselines
  X −5, Y −1, Z +4.5 cm, Warning ±0.15, Action ±0.2, from Brook; fifth step "DO NOT APPLY Correction") and 2.04
  "Mechanical-to-kV/kV Correction Vector [cm]" (X, Y, Z and a 3D like 2.03's; the same baselines and limits as 2.03,
  on Brook's word; its steps end with recording the vector and then applying the correction), and nothing
  outside the Sphinx measurements reads in mm (Brook: "if there are mm anywhere in that queue, it shouldnt be there";
  the Sphinx values stay in mm until Brook says otherwise: export, baselines, limits and history are in mm). An
  existing install renames and switches them in Setup QA. GTR5's exports carry nine spots; only six are on the list (open question).
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
  Measured/Latest · Result · Comment · History · (30 days) · Trends`. Per-energy/spot measurements are
  one titled table with one row per energy ("Spot 1 · 226.4 MeV" on one line); X/Y/Z (+3D) likewise, no lines
  between its rows. One sequential number per block, centred in the # column, identical on both pages
  (`blockNumbers()`). One decimal count per table. History = dates in a header row, values in equal slots under
  them, only as many as fit one line. A numeric result's deviation follows its verdict chip in plain brackets,
  "PASS (Δ +0.30 mm)" (Brook, 2026-11-04: no Deviation column); hidden on phones. Comments behind a
  pencil icon. Yes before No.
- **QA form (Brook, 2026-11-19; overrides the notes above where they differ):** columns in the order `# · Test · Baseline ·
  Measured · Unit · Result · History · Note · Trend` (`QA_COLUMNS` in `app.js`, one list for headings, rows, widths and
  the Columns box). The QA form starts without History; a saved run keeps it. **Columns** lets each person show, hide
  and reorder (kept in the browser per person and page; #, Test, Measured and Result always show). Process and
  procedure instructions are in info bubbles, not on the page: Protocol button, ⓘ beside a test or group title, the
  import ⓘ; PBS daily steps show a short label (`QA_STEP_LABELS`, draft wording) with the instruction in the ⓘ. One
  names row per section; a group's title is a band with its limits. An X / Y / Z group (and its 3D) is ONE row, the
  axes side by side (Brook, 2026-11-19: "put all in one row"; per-energy groups stay one row per energy). Finish Gantry 1 (GTR1) before expanding to other
  machines. floridaphysics.com sizes these columns by `col[data-col]` in its `site-overrides.css`: keep the keys.
- **QA form, round 3 (Brook, 2026-11-20):** setup steps that are only instructions are **Directions**, not Yes / No
  rows: a popout list behind the ⓘ beside the section's title ("instead of things to select yes or no on"), or
  behind the ⓘ of the test or group below them ("2.01 should be the instructions for Room lasers, and 2.03 and 2.04
  … for Mechanical-to-kV/kV Imaging Isocenter"). A list item becomes one in Setup QA (Result Type "Direction:
  section" / "Direction: test below": a Text item carrying `[direction: section]` / `[direction: next]`, no number,
  nothing recorded; `directionKind`, `sectionDirections`, `item.steps`). A test's ⓘ cites its report (TG-224, TG-142,
  TG-198, MPPG 8.a/8.b) from its Reference (below): never guess a citation; Brook or the reviewing physicist supplies
  it. (The Columns popout of this round became the Column Chooser, below.) A heading can be dragged left or right in the table. A group's
  Warning / Action (and baseline) sit under its black name at the left of the title band, never at the far right.
  Energy labels sit at the left under the group's name (no wide blank under the name). A titled block reads as ONE
  test ("all of this is 2.02 … it should look like a block not two rows broken up"): its number beside its name
  (`.measure-n`), no band behind the name and no line between the name, its limits and its fields; axes with their own
  baselines are named on the limits line. A test's ⓘ is one combined list (the directions above it, then its own
  direction as the last step), never steps plus a separate Directions box. On an X / Y / Z row each field reads
  "X: [ ]" (letter beside its box; "I want X: [] Y: [], and Z:[] on each of these rows"), and the whole block is
  marked on hover, its name line too.
- **QA form, round 4 (Brook, 2026-11-20 evening):** tests on one row ("Same row as the test above") are a row of the
  table, "lined up as if they were aligned in an Excel table": the last test is the row's value (Baseline, Measured,
  Unit, Result in their columns), the ones before it are answered beside their names in the Test column, name and box
  on the same line ("Chamber should be on the same line as the Chamber drop down"); shared words are said once in bold
  (`inlineRow`, `joinedNames`). "Whenever theres nC and cGy, keep it on the same row." An X / Y pair is a titled block
  like 2.02: "3.20 Isocenter Coincidence [X-ray vs. Proton Beam] and then … X: [] and a Y: [] on the row below". The
  Sphinx import is the first row of the Sphinx Measurements section and reads "Import Sphinx Measurements"; what Sphinx
  measures (homogeneity and the coincidence offsets too) is filled from the file. The **Column Chooser** is "like there
  is in Mosaiq and in Aria": a small window over the page (its button, or a right-click on a heading), names dragged to
  reorder or onto a heading, a heading dragged in to hide (`openQaColumnChooser`). A test's **Reference** is a
  `Reference:` line of its field, edited in Setup QA's test form and shown last behind the ⓘ (`referenceOf`,
  `withReference`); the seed's are the department's own TG-224 notes, unverified against the report. Setup QA: ＋ Test
  and ＋ Block on each section's title. A saved run draws tests on one row the same way (`inlineRun`; Brook, 2026-11-25),
  and an X / Y pair as rows of their own like its X / Y / Z rows (`runRows`). Brook does not like cm and mm mixed in one
  list: open, see "Waiting on Brook".
- **Monthly form (Brook's meeting notes, 2026-11-25; the proton monthly list, from the GTR5 monthly worksheet):** "Compress",
  "Make it tabular", "Range / Output / XRV / Sphinx", "Go back to look at the excel sheet". A list's own repeated
  measurements are one table: names "<what> – <energy> MeV[ – <which>] [unit]" or "<what> — G<angle> [unit]"
  (`listMeasureParts`, `tableParts`); several values per row are a matrix, a column per value with a head row saying the
  baseline and limits its tests share (`matrix` in `measureTable`; output charge and dose on one row, spot QA's four
  values). Never widen `measureParts` for this: it also decides which fields a Sphinx import fills and locks. Brook
  (2026-11-26, of the spot QA matrix): "this looks good, I like things like this". The seed's list (2026-11-26) has
  sections of its own, in Brook's order: 3 Isocentricity / XRV ("in dosimetry, not mechanical"), 4 Range / Zebra,
  5 Spot Characteristics / Sphinx, 6 Output, then 7 Imaging; couch translation X / Y / Z is one line, couch pitch /
  roll / yaw one line, the couch isocentricity ranges and the maximum radial displacement one line (the maximum last);
  the chamber and N_Dw, k_Q, k_s, k_pol are one line, from Equipment. Still open: a Sphinx file that fills the spot
  table ("upload a sphinx file and read in all these numbers automatically") and an XRV file reader ("there's a file
  that gets uploaded and read in for that as well"): each needs a sample export and how its numbers map to the tests,
  never guessed; the spot tests' directions still say Lynx (from the worksheet) under a section named Sphinx;
  "Take default off" (Brook had no preference which); "Add in TG 224" (the tests carry a "TG-224: …" line; no column
  yet); the same tables on a saved run and in Machine Trends.
- **Equipment (Brook, 2026-11-25: "Put in equipment inventory", "Chamber selection", "Ndw … aren't editable"):** Setup QA,
  More, Equipment (`renderEquipment`, `equipmentModel`, `equipmentSaves`, `equipmentConnection`). Nothing new is stored: a
  list chooses a device with a multiple-choice test tagged `[device: chamber]` / `[device: electrometer]`, and a test a
  device fills carries a `QADerived` lookup with a value per device; the page edits those tests of every list through
  `/api/tests`. One inventory per kind for all lists. Brook chose that a chamber carries all four of N_Dw, k_Q, k_s,
  k_pol. Never put a value in for a device: a connected test is blank until a Physicist types it. A device's value
  shows on the form as typed (`setDerived`), a calculated one to three figures. The seed's monthly list is connected
  (Brook, 2026-11-26: "all of these from monthly should be setup in the equipment spot, not in the monthly input"):
  its chamber is a choice of the sample devices and its four constants are blank look-ups; a list already edited is
  connected from the page. Open: the 22 °C / 1013.25 hPa baselines ("Take default off": Brook had no preference which
  default); serial, calibration date and other equipment (Zebra, XRV-124) are not held.
- **QA form, round 5 (Brook, 2026-11-26; overrides the notes above where they differ):** "Make this look a lot more
  tabular", "make each row have much less height", "reduce row height all throughout the application", "really we are
  just looking for a much more simplified look", and of the GTR5 monthly worksheet "take inspiration on how tabular
  that is". A test is ONE line: columns `# · Test · Baseline · Measured · Unit · Warning ± · Action ± · Result ·
  History · Note · Trend` (`QA_COLUMNS`; keys `warn`, `action`), the Baseline a number alone; the limits go back under
  the name (`.qa-limits-under`, `.qa-no-limit-cols`) only when both limit columns are hidden or the window has no room
  for them (`fitQaTable.tight`). Tests on one row are one line, every test beside its own name ("the dose [cGy] needs
  to be closer to the actual line item its measuring"; `lineRow`, `lineRun`, `lineLayout`): shared first and last
  words once in bold with the shared baseline and limits under them; the one value a device on the line fills has no
  label of its own. A passing test on a line, or an axis of an X / Y / Z row, shows PASS alone (its Δ on the chip); a
  test on a row of its own still says "PASS (Δ +0.30 mm)". A table of several energies or spots that a file fills
  starts closed, one line with its verdict and the worst row named ("make all the spot characteristics pass fail, with
  the ability to expand the results"; "Anytime there's multiple energies and something is coming directly from an
  excel sheet, I don't want you to show all the energies automatically, allow the user to expand it out, but don't
  automatically show it, I'm trying to reduce the amount of scrolling required"): never open one by itself, not even
  for an ACTION ("Next unanswered" may open the one it lands in). Typed tables stay open. Rows are short everywhere:
  padding and control heights in `app.css` (last block) and in the site's `site-overrides.css` (7b); a phone's cards
  keep their sizes. An X / Y / Z block and an X / Y pair keep their title, limits line and row of axes.
- **QA form, round 6 (Brook, 2026-11-27; overrides the notes above where they differ):** "Make this more cell
  like/tabular … For all QA tests": on a computer a QA table is a grid of cells, a hairline on every side of every
  cell (this overrides "no vertical rules" for QA tables only), and a box a person fills is its whole cell, lightly
  tinted; one filled for them is grey. "Theres way too much white space after the test name label": the Test column
  is only as wide as its longest name, section by section (`qaFitTestColumns`), so the table is as wide as its columns
  and sits at the left of its card; a row of several tests asks for the width that keeps it on one line. "Column
  chooser should be transposed": the columns side by side in the table's order, each name over its tick and its ← →.
  "Each QA list to run should have much smaller row heights": on the Perform QA list a list is one short line, its
  schedule after its name, the pass-rate ring 22 px with its number beside it (not inside: too small to read there).
  A matrix table does not repeat the general headings above its own head row, and its verdicts follow their boxes.
- **Machine Trends (Brook, 2026-11-04):** one QA list at a time (the one with the most runs in the period unless a
  link names one); numbers to 2 decimal places; distal depth and spot position first under "Key checks"; spot
  position as X and Y panels in Δ from each result's baseline. Machine Trends and its CSV export load the period in
  parts (machineHistory); never ask for a machine's whole history in one reply.
- **Charts:** views "Absolute <unit>" and "Δ from Reference", unit unchanged between them; several series in
  Absolute = stacked subplots. Lines join dots; green band inside warning, orange strips warning→action; the axis
  takes in the limits drawn, out to Action on both sides (Warning where there is no Action), with the same margin
  beyond on every chart (Brook, 2026-11-25: "more consistent margins for the warning and error axis levels"; it was
  "spans the warning band"); calendar x-axis with a line per month; HTML key under the chart; biggest outlier ringed; click a
  dot to show date, value, Δ. Pass-rate rings: thick, green/red only, small number inside; per test ("30 days"
  column) and beside each machine's last result on the Dashboard; never a row of rings at the top. (On the Perform QA
  list the ring is small with its number beside it: round 6.)
- **One QA list object (Brook, 2026-10-22, emphatic):** Setup QA, Perform QA and Machine Trends all read the same
  list row; a list is scheduled on machines directly (never copied per machine). Default baseline / Warning / Action
  live on the list; a machine's own values are overrides on its schedule, edited with "Values for" in the list
  editor. Never reintroduce per-machine copies, templates-vs-instances, or auto-sync. Numbering is `blockNumbers`
  everywhere (editor, Perform, Trends).
- **Lists and actions:** Setup QA has a QA Lists table (✎ left of the name; ＋ schedule on machines, 🗑 delete,
  ⋯ Duplicate / Re-evaluate / Archive; Scheduled On chips) and a Machine Schedules table grouped by machine
  (Machine Values count; ⋯ Set Active/Inactive, Values for this machine, Schedule and import folder).
  Perform QA: green ▶ before every list (no Start column), due lists first, Mark in Progress button (saves the draft; Brook renamed it 2026-11-04), frozen title row;
  no runs-waiting-for-review list there (Brook: "I just want to perform QA"; they live on Review QA).
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
daily table (CT Sim tolerances), and the MRI daily items. PBS daily list: whether the Sphinx values (export,
baselines, limits, history in mm) should be shown in cm like the imaging checks, or the imaging checks in mm (never
converted silently); the sign of the 2.03 / 2.04 baselines (Brook gave X −5, Y −1, Z +4.5 cm; the department's TG-224
daily list expects +5, +1, −4.5 cm); the 2.03 / 2.04 limits (±0.15 / ±0.2 cm) against that list's "couch translational
motion < 1 mm"; references for the checks that have none; and checking the seeded references against TG-224 itself.
Proton monthly list: a sample Sphinx export of the monthly spot check (one per gantry angle) and how each number of the
spot table comes from it; a sample XRV-124 export; whether the spot tests' directions should say Sphinx (they say
Lynx, from the worksheet); the real chambers and their N_Dw, k_Q, k_s, k_pol (typed under Equipment by a Physicist).

## Portal updates agreed with Brook (2026-10-22)

- Automatically publish requested portal edits to GitHub and Pages after checks; verify live files.
- Favor therapist ease and low cognitive load: one shared template, simple machine selection, explicit exception labels.
- A machine may exclude shared tests or add machine-only tests without copying the list. Selection is stored on the assignment; template changes remain live. Do not rewrite historical results.
- Setup uses QA Template Lists; row controls are pencil, vertical three-dot menu, name. No Actions column. Activation is per machine; display Active/Inactive beside the name, not repeated beside the toggle.
- HDR Flexitron has Daily QA and Source Exchange QA on demand. The seed lists are empty until approved departmental checks are supplied; do not invent clinical tests or limits.
- Additional regression checks: `node tests/test_autosave.cjs` and `node tests/test_report.cjs`.

## Machine Schedules controls (2026-10-23)

Machine schedule rows have a three-dot menu before a plain list name; no left pencil or shared-test Edit link. The schedule description has its own pencil on the right for frequency/import-folder editing. Menu actions are Active/Inactive, Set tolerances for this machine, Duplicate, Re-evaluate, Archive, Delete. All actions affect only that assignment. Duplicate snapshots the effective machine list and starts inactive; deleting a schedule with recorded results is refused. Archive is reversible and preserves prior activity, membership, values, and history. Shared tests are edited only from QA Template Lists.

## Dashboard and template creation (2026-10-23)

- Show one machine at a time in Machine Trends, defaulting to GTR1. Use organized expandable measurement rows, omit spot numbers in display labels, group same-energy X/Y on one graph, and link insights to their graphs. Keep locally calculated, explained pattern insights. Do not label these as external AI or clinical conclusions.
- Keep file settings behind a gear; reuse existing per-list import folders and remember per-machine export folders on this browser/computer. Multi-machine mode labels the machine used for file operations.
- New QA Template List is the creation label. Offer existing departmental starters, blank lists and reviewed Excel/MyQA checklist exports. Native PLD parsing awaits a representative file; do not claim it is implemented. Never infer clinical limits from ambiguous text.

## Responsive home and machines (2026-10-23)

- Home is a 2×2 Proton/Photon/Brachy/Simulation card layout on desktop, stacked on phones. Show each machine's active Daily/Monthly/on-demand QA, not only its daily list.
- Use fluid screen width on Setup and Review and larger readable fonts. Verify desktop, tablet and phone widths without horizontal overflow.
- Linac 1 is removed from active defaults. Machines without runs may be deleted; machines with history must be retired. Preserve shared templates and history. Never re-add a deleted seeded machine automatically.
