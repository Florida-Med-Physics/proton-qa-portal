# Changelog — Physics QA Portal (proton-qa-portal)

All notable changes to this project are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). No version has been tagged yet. The suggested first tag is `v0.1.0`, once the host-PC deployment has been tried.

**How to keep this file up to date:** with every commit, add a one-line, plain-language entry under **Unreleased**. When you cut a release, rename **Unreleased** to the new version number and date, and start a new empty **Unreleased** section above it.

Entries marked **[Physics review]** change QA tests, tolerances, templates, or how results are judged, so a qualified medical physicist should review them before relying on the change. This software is not validated for clinical use.

## [Unreleased]

Development from 2026-10-21 to 2026-10-22. Everything is on `main` and pushed.

### Added
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
- QA list editor columns: Test Name, Category, Expected (with units), Tolerance (warning and fail, with units), Modified Date and Modified By. Saving a list now records each test whose limits changed.
- UF Health Proton Therapy Institute branding (logo, navy header, orange rule), light by default, with a "Dark mode: On/Off" button remembered on each computer, as in the TrueBeam Service Log.
- **[Physics review]** CT Sim is now "Big Bore CT (7064)", running "Bigbore CT Daily": the 13 tests, names, categories and reference values from the RadMachine list. Warning and fail tolerances are not entered yet, so CT values are recorded, not judged. Browsers that already had the old CT Sim list are upgraded automatically if no CT results were recorded.

### Fixed
- Machine Trends no longer fails because of a missing section helper, and a machine's trends now load in one request.

[Unreleased]: https://github.com/Florida-Med-Physics/proton-qa-portal/commits/main
