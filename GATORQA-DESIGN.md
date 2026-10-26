# Proton QA Portal on floridaphysics.com — design note

*Draft for discussion, 22 October 2026. Nothing here is built yet.*

Proton QA Portal is the machine QA portal prototyped in
[Florida-Med-Physics/proton-qa-portal](https://github.com/Florida-Med-Physics/proton-qa-portal):
QA list templates instantiated per machine, scheduled daily lists, Sphinx export
auto-fill, review and sign-off, history and trends. This note is the plan for
bringing it onto this site so that daily QA and the existing Monthly QA page
live on one platform, with one sign-in, one table and one set of rules.

It is a draft tool for physicist review. Nothing in it is validated or
commissioned for clinical use.

## What stays exactly as it is

The Monthly QA page established the shape of the site, and Proton QA Portal adopts it
rather than bringing its own:

- **One platform.** Plain HTML/CSS/JS in `web/`, Cognito sign-in, the one
  Lambda in `api/users/index.mjs`, the one DynamoDB table. No framework, no
  build step, no second stack. Proton QA Portal's Python server and SQLite file are not
  deployed here.
- **Templates are data in the table, never files in `web/`.** A QA protocol
  with its tolerances is internal; it travels through the API behind the
  sign-in. `scripts/qa/load-template.py` stays the way a template gets in.
- **The worksheet is the spec for monthly QA.** `extract-qa-template.py`
  keeps producing the monthly template from `GTR5_Monthly_QA_Worksheet.xlsx`.
  Daily templates come from their own sources (the myQA TG-224 export and the
  RadMachine lists), through importers that emit the same schema.
- **Vocabulary.** PASS / WARNING / ACTION everywhere. Proton QA Portal's current
  "Warn ±" / "Fail ±" labels are renamed to "Warning ±" / "Action ±" when it
  moves onto the site.
- **Deploy rules in `CLAUDE.md`.** `AWS_PROFILE=fp`, only `web/` is published,
  nothing that looks like config or a document goes in `web/`.

## What changes

### 1. One template schema for monthly and daily

The monthly template's item shape is extended, not replaced:

```
{ n, section, label, setup, help, unit, kind, baseline, warn, action,
  inputs, quarterly,                      // as today
  frequency: "daily" | "monthly" | …,     // new: which list it belongs to
  source: "sphinx:<canonical key>" |      // new: filled from a Sphinx export
          "calc:<rule>" | null,           //      or computed from other items
  tgLimit, row }                          // as today
```

`kind` keeps its meanings. Proton QA Portal's cases map onto them directly:
`functional` is a Pass / Fail / N/A check, `absolute` and `percent` are numeric
limits, `radial` is an X / Y / Z offset with its 3D magnitude, `dose` and
`derived` are the computed items (`[calc: …]` in Proton QA Portal today). The kTP and
√(dx²+dy²+dz²) formulas are already identical in both codebases.

A template is stored once per machine and frequency:
`pk QATEMPLATE / sk GTR1#daily`, `pk QATEMPLATE / sk GTR5#monthly`.
"Instantiate on a Machine" from Proton QA Portal becomes: copy the base template item to
the machine's key and let Setup QA edit that copy. The `QAMACHINES` index row
lists both frequencies.

### 2. Entries at daily grain, same pattern as monthly

Monthly: `pk QA#GTR5 / sk 2026-09` (one item per machine-month, unchanged).
Daily: `pk DAILY#GTR1 / sk 2026-10-22` (one item per machine-day).

A month of daily history, or a year of monthly history, is a single Query on
the key with a range on `sk` — the same query the schedule's month view uses.
Drafts (a list saved part-way) are the same item with `status: "draft"`.

### 3. Entries are written with their derived values

This is the one deliberate change to the Monthly QA rule of storing inputs
only. An entry stores the inputs **and** everything derived from them — kTP,
computed dose, 3D offsets, deviations, percentages and the PASS / WARNING /
ACTION verdict — plus `templateVersion`, the id of the template in force when
it was evaluated.

Why: the record on file is exactly what the physicist signed, and a trend chart
or an audit never depends on today's code to reproduce yesterday's verdict.

What the inputs-only rule was protecting is kept as an explicit action instead
of an implicit one: an admin-only **Re-evaluate** that recomputes an entry or a
date range against the current template, writes the new values back, and logs
in the audit trail what changed and why. A corrected tolerance or formula still
fixes the history — deliberately, visibly and signed, not silently on page load.

`web/js/qa-eval.js` remains the single evaluation module; Proton QA Portal's numeric,
Yes/No and calculation rules are added to it, and `test/qa-eval.test.mjs` grows
with them. The same module runs at entry time in the browser and at
re-evaluation time.

### 4. Trends for monthly and daily alike

The Trends page draws from the stored values: dots joined by lines, the
WARNING and ACTION bands from the template version in force on each date, a
key, an absolute / Δ-from-baseline toggle, and the recent values under their
dates beside each chart. Monthly items trend over months exactly as daily items
trend over days.

### 5. Sphinx exports, and the one piece that has to run on-site

Sphinx daily exports are `.xls` files on the G: drive. Two things happen:

- **Upload in the browser.** A Perform QA page accepts the file and parses it
  client-side (SheetJS as a single file under `web/js`, no build step). Values
  are matched to template items by what they measure (Proton QA Portal's canonical key),
  filled in read-only, evaluated, and saved with the entry.
- **An on-site agent** on a UFHPTI host PC (a Python script run as a scheduled
  task) does what nothing in AWS can: it watches the Sphinx folders on G: and
  posts new exports to the API, and it pulls a nightly export of the table into
  a local SQLite/JSON copy. That local copy is the department's own database on
  its own machine; Proton QA Portal's existing Python server can run from it as an
  offline viewer if the site is unreachable. DynamoDB (with point-in-time
  recovery) is the source of truth.

### 6. Pages and roles

"QA" becomes a section of the site: **Daily** (Perform QA), **Monthly** (the
existing form, rendered from the shared schema), **Trends**, **Setup**
(templates, machines, instantiation, re-evaluate), **Review** (sign-off).
Cognito groups carry the roles Proton QA Portal has today: admin, physicist, therapist.
Site styling stays; Proton QA Portal's dot-grid mark and status colours become the QA
section's accent.

## Phasing

Each step leaves the site working.

1. Shared template schema and shared `qa-eval.js`; the GTR5 monthly template
   re-emitted into the schema; tests extended. No visible change.
2. Daily entries and the daily Perform QA page with browser-side Sphinx upload.
   One-time import of the GTR1 and GTR5 history from the local SQLite file.
3. Trends and Setup pages; Cognito groups for roles; Re-evaluate.
4. On-site agent: folder watcher and nightly local export.
5. Proton QA Portal's Python server becomes the offline viewer of that export; the
   public GitHub Pages demo is retired or kept as a sandbox with synthetic data.

## Open questions

- Should monthly entries also carry per-run drafts and review/sign-off states,
  or stay as one editable item per month?
- Which Cognito group may run Re-evaluate, and should it require a note?
- GTR5's Sphinx exports carry nine spots; the current daily template has the
  six-spot configuration. Decide per machine before phase 2's history import.
