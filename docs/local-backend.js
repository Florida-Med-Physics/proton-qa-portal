"use strict";

// Browser-only backend for the Physics QA Portal (GitHub Pages build).
// Answers the same /api/... requests as portal/server.py, but keeps everything in this
// browser's IndexedDB. Nothing is sent anywhere. Rules mirror portal/qa.py and
// portal/service.py; keep them in step.

(() => {
  const DB_NAME = "proton-qa-portal";
  const STORE = "kv";
  const TABLES = ["users", "machines", "tests", "queues", "queue_items", "assignments", "overrides", "runs", "results", "audit"];
  const ROLES = ["admin", "physicist", "therapist", "mpa"];
  const PERMISSIONS = {
    perform: ["admin", "physicist", "therapist", "mpa"], therapist_approve: ["therapist"], review: ["admin", "physicist"], configure: ["admin", "physicist"], manage_users: ["admin"],
  };
  const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "semiannual", "annual", "custom", "asneeded"];
  const MONTH_STEPS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
  const STATUS_RANK = { pass: 0, recorded: 0, warn: 1, fail: 2 };
  const SPHINX_STATUS = { Passed: "pass", Warning: "warn", Failed: "fail" };
  const STATUS_WORDS = { pass: "pass", passed: "pass", warn: "warn", warning: "warn", fail: "fail", failed: "fail" };
  const EPS = 1e-9;

  // ---- storage ---------------------------------------------------------------

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function readState() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).get("state");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }
  async function kvGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  async function kvPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  async function kvDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---- database file: where the whole database is saved (optional) --------------------------
  // Chosen once under Setup. Every save also writes the state there, and the page loads from it on start, so
  // the file (on a shared drive, say) is the database and this browser's storage is only a cache.
  const DB_FILE_KEY = "dbfile";
  async function dbFileHandle() { return kvGet(DB_FILE_KEY); }
  async function dbFilePermission(handle) {
    try { return await handle.queryPermission({ mode: "readwrite" }); } catch { return "denied"; }
  }
  async function dbFileInfo() {
    const h = await dbFileHandle();
    if (!h) return { name: null, permission: "none", supported: "showSaveFilePicker" in window };
    return { name: h.name, permission: await dbFilePermission(h), supported: true };
  }
  async function writeDbFile() {
    const h = await dbFileHandle();
    if (!h || (await dbFilePermission(h)) !== "granted") return false;
    const w = await h.createWritable();
    await w.write(JSON.stringify({ exported_at: now(), state: S }));
    await w.close();
    return true;
  }
  async function readDbFile() {
    const h = await dbFileHandle();
    if (!h || (await dbFilePermission(h)) !== "granted") return null;
    const text = await (await h.getFile()).text();
    if (!text.trim()) return null;
    const backup = JSON.parse(text);
    if (!validState(backup.state)) throw new Error(`${h.name} is not a portal database file.`);
    return backup.state;
  }
  const validState = (s) => !!s && TABLES.every((t) => Array.isArray(s[t])) && !!s.seq;

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const db = await openDb();
        db.transaction(STORE, "readwrite").objectStore(STORE).put(JSON.parse(JSON.stringify(S)), "state");
      } catch (err) {
        console.error("Could not save", err);
      }
      try {
        await writeDbFile();
      } catch (err) {
        console.error("Could not write the database file", err);
      }
    }, 150);
  }

  // ---- default import folders (one per scheduled list) -----------------------------------
  // The folder handle lives in this browser's storage; the list keeps only the folder's name.
  const FOLDER_PREFIX = "folder:";
  const IMPORT_EXTENSIONS = [".xls", ".csv", ".pdf"];
  async function folderHandle(assignmentId) { return kvGet(FOLDER_PREFIX + assignmentId); }
  async function folderPermission(handle) {
    try { return await handle.queryPermission({ mode: "read" }); } catch { return "denied"; }
  }
  async function walkFolder(handle, prefix, depth, out) {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === "file") {
        if (IMPORT_EXTENSIONS.some((x) => name.toLowerCase().endsWith(x)) && !name.startsWith("~$")) {
          out.push({ path: prefix + name, entry });
        }
      } else if (depth > 0) {
        await walkFolder(entry, `${prefix}${name}/`, depth - 1, out);
      }
    }
  }
  async function listImportFiles(assignmentId, limit = undefined) {
    const a = get("assignments", assignmentId, "Schedule");
    const handle = await folderHandle(a.id);
    if (!handle) return { folder: a.import_folder || "", files: [], permission: "none" };
    const permission = await folderPermission(handle);
    if (permission !== "granted") return { folder: handle.name, files: [], permission };
    const found = [];
    await walkFolder(handle, "", Infinity, found);
    const withFiles = await Promise.all(found.map(async (f) => ({ ...f, file: await f.entry.getFile() })));
    withFiles.sort((x, y) => y.file.lastModified - x.file.lastModified);
    const files = [];
    for (const f of withFiles.slice(0, limit)) {
      const digest = await sha256(new Uint8Array(await f.file.arrayBuffer()));
      const run = S.runs.find((r) => r.source_ref === digest);
      files.push({ name: f.file.name, path: f.path, size: f.file.size, modified: new Date(f.file.lastModified).toISOString().slice(0, 16),
        run_id: run ? run.id : null, qa_date: run ? run.qa_date : null });
    }
    return { folder: handle.name, files, permission };
  }
  async function readImportFile(assignmentId, path) {
    const a = get("assignments", assignmentId, "Schedule");
    const handle = await folderHandle(a.id);
    if (!handle) throw new Error("This list has no default import folder. Set one under Change schedule.");
    const parts = String(path || "").split("/").filter((p) => p && p !== "." && p !== "..");
    if (!parts.length || !IMPORT_EXTENSIONS.some((x) => parts[parts.length - 1].toLowerCase().endsWith(x))) throw new Error("That file is not in this list's import folder.");
    let dir = handle;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const file = await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] || "" });
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  function emptyState() {
    const s = { version: 1, seq: {} };
    for (const t of TABLES) { s[t] = []; s.seq[t] = 0; }
    return s;
  }
  let S = emptyState();

  const now = () => new Date().toISOString().slice(0, 19);
  const todayIso = () => localIso(new Date());
  function localIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const fromIso = (s) => new Date(s + "T00:00");
  const insert = (table, row) => { row.id = ++S.seq[table]; S[table].push(row); save(); return row.id; };
  const byId = (table, id) => S[table].find((r) => r.id === Number(id));
  function get(table, id, label) {
    const row = byId(table, id);
    if (!row) throw new Error(`${label || table.slice(0, -1)} not found.`);
    return row;
  }
  let actingContext=null;
  function audit(userId, action, entity, entityId, detail) {
    if(actingContext)detail={...(detail||{}),acting_role:actingContext,authenticated_role:'admin'};
    insert("audit", { at: now(), user_id: userId, action, entity, entity_id: entityId ?? null, detail: JSON.stringify(detail || {}) });
  }

  // ---- helpers mirroring service.py ------------------------------------------

  const text = (data, key, def = "") => String(data[key] ?? def).trim();
  function required(data, key) {
    const v = text(data, key);
    if (!v) throw new Error(`${key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} is required.`);
    return v;
  }
  function number(data, key) {
    const v = data[key];
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`${key} must be a number.`);
    return n;
  }
  function tolerance(data, key) {
    const n = number(data, key);
    if (n !== null && n < 0) throw new Error(`${key} tolerance cannot be negative.`);
    return n;
  }
  function limitsOf(data, allowBlankMode) {
    const l = { expected: number(data, "expected"), warn: tolerance(data, "warn"), fail: tolerance(data, "fail") };
    let mode = data.tol_mode || null;
    if (mode === null && !allowBlankMode) mode = "absolute";
    if (mode !== null && !["absolute", "percent"].includes(mode)) throw new Error("Tolerance mode must be absolute or percent.");
    if (l.warn !== null && l.fail !== null && l.warn > l.fail) throw new Error("Warning tolerance must not be larger than the fail tolerance.");
    l.tol_mode = mode;
    return l;
  }
  const flag = (data, key, def = true) => ([false, 0, "0", "false"].includes(data[key] ?? def) ? 0 : 1);
  const can = (user, perm) => !!user && PERMISSIONS[perm].includes(user.role);
  function require(user, perm) {
    if (!can(user, perm)) throw new Error("You do not have permission to do that.");
  }

  function resolveLimits(test, item, override) {
    const out = {};
    for (const k of ["expected", "warn", "fail", "tol_mode"]) {
      let v = test[k];
      for (const layer of [item, override]) if (layer && layer[k] !== null && layer[k] !== undefined) v = layer[k];
      out[k] = v;
    }
    out.tol_mode = out.tol_mode || "absolute";
    if ((test.description || "").includes("[rule: wl-max-delta]")) out.criterion = "wl-max-delta";
    return out;
  }
  function evaluate(type, value, limits) {
    if (limits.criterion === "wl-max-delta") return value >= 0 && value < 1 ? "pass" : "fail";
    if (type === "boolean") return value ? "pass" : "fail";
    if (type === "status") return ["pass", "warn", "fail"].includes(value) ? value : "fail";
    if (type === "text" || type === "choice") return "recorded";
    if (limits.expected === null || limits.expected === undefined) return "recorded";
    let dev = value - limits.expected;
    if (limits.tol_mode === "percent") {
      if (limits.expected === 0) throw new Error("A percent tolerance needs a non-zero expected value.");
      dev = (100 * dev) / limits.expected;
    }
    const size = Math.abs(dev);
    const has = (x) => x !== null && x !== undefined;
    if (has(limits.fail) && size > limits.fail + EPS) return "fail";
    if (has(limits.warn) && size > limits.warn + EPS) return "warn";
    if (!has(limits.fail) && !has(limits.warn)) return "recorded";
    return "pass";
  }
  const resultOverall = rows => {
    const verdict = rows.length ? overall(rows.map(r=>r.status)) : "recorded";
    return verdict === "pass" && rows.some(r=>r.value_num == null && r.value_text == null) ? "recorded" : verdict;
  };
  const overall = (statuses) => statuses.reduce((w, s) => ((STATUS_RANK[s] || 0) > STATUS_RANK[w] ? s : w), "pass");

  // ---- scheduling (qa.py) ----------------------------------------------------

  function parseWeekdays(t) {
    const days = new Set(String(t || "").split(",").map((d) => d.trim()).filter((d) => /^\d$/.test(d)).map(Number).filter((d) => d <= 6));
    return days.size ? days : new Set([0, 1, 2, 3, 4, 5, 6]);
  }
  const pyWeekday = (d) => (d.getDay() + 6) % 7; // Monday = 0, as in Python
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, months) {
    const idx = d.getMonth() + months;
    const y = d.getFullYear() + Math.floor(idx / 12), m = ((idx % 12) + 12) % 12;
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d.getDate(), last));
  }
  const maxDate = (a, b) => (a > b ? a : b);
  function nextDue(a, lastDone) {
    const start = fromIso(a.start_date);
    if (a.frequency === "asneeded") return null;
    if (a.frequency === "daily") {
      const days = parseWeekdays(a.weekdays);
      let c = lastDone ? maxDate(start, addDays(lastDone, 1)) : start;
      while (!days.has(pyWeekday(c))) c = addDays(c, 1);
      return c;
    }
    if (MONTH_STEPS[a.frequency]) {
      // Due at the end of the month: the start month's end at first, then the end of the month one period after the last run.
      const monthEnd = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return maxDate(start, monthEnd(lastDone ? addMonths(lastDone, MONTH_STEPS[a.frequency]) : start));
    }
    if (!lastDone) return start;
    if (a.frequency === "weekly") return maxDate(start, addDays(lastDone, 7));
    return maxDate(start, addDays(lastDone, Number(a.interval_days || 1)));
  }
  function dueState(a, lastDone, today) {
    const due = nextDue(a, lastDone);
    const t = localIso(today), l = lastDone ? localIso(lastDone) : null;
    if (due === null) return { next_due: null, state: l === t ? "done" : "ready", last_done: l };
    const d = localIso(due);
    const state = d < t ? "overdue" : d === t ? "due" : l === t ? "done" : "upcoming";
    return { next_due: d, state, last_done: l };
  }
  const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function describeSchedule(a) {
    if (a.frequency === "daily") {
      const days = [...parseWeekdays(a.weekdays)].sort();
      if (days.length === 7) return "Daily";
      if (days.join() === "0,1,2,3,4") return "Daily (weekdays)";
      return "Daily (" + days.map((d) => WEEKDAY_NAMES[d]).join(", ") + ")";
    }
    if (a.frequency === "custom") return `Every ${a.interval_days || 1} days`;
    if (a.frequency === "asneeded") return "As needed (run on the days it applies)";
    const word = a.frequency[0].toUpperCase() + a.frequency.slice(1);
    return MONTH_STEPS[a.frequency] ? `${word} (due at month end)` : word;
  }

  // ---- Sphinx export reader (sphinx.py) ---------------------------------------

  const CATEGORIES = ["Energy", "Spot", "Coincidence", "Homogeneity", "Output", "Couch Translation"];
  // Read (so the sections parse) but not imported: couch translation is documented in RadMachine, not from Sphinx.
  const NOT_IMPORTED = new Set(["Couch Translation"]);
  const SETUP_LABELS = new Set(["X Start", "X Stop", "Y Start", "Y Stop", "Wedge Thickness", "Additional Thickness"]);
  const SPHINX_STATUSES = ["Passed", "Failed", "Warning"];
  const QUANTITY = /^±?\s*([-+]?\d+(?:\.\d+)?)\s*(.*?)\s*$/;
  const FINISHED = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) ([AP]M)$/;
  const FILE_DATE = /(\d{2})(\d{2})(20\d{2})/;
  const SETUP_VALUE = /^[-+]?\d+(?:\.\d+)?\s*(?:mm|cm|°|%|px|sec|pF)?(?:\s*\/\s*[-+]?\d+(?:\.\d+)?\s*(?:mm|cm)?)?$/;
  const ENERGY = /(\d+(?:\.\d+)?)\s*MeV/i;
  const ENERGY_STEP = 5;

  const quantity = (t) => { const m = QUANTITY.exec(t || ""); return m ? [Number(m[1]), m[2]] : null; };
  const cleanItem = (t) => t.replace(/\s+/g, " ").trim().replace(/\[\s+/g, "[").replace(/\s+\]/g, "]");
  function nominalEnergy(item) {
    const m = ENERGY.exec(item || "");
    return m ? Math.round(ENERGY_STEP * Math.round(Number(m[1]) / ENERGY_STEP)) : null;
  }
  // Names follow the myQA template: "Spot 1 [225 MeV] – Sigma X", "Energy [100 MeV] – Distal Depth" (mirrors sphinx.py).
  // What a Sphinx value measures, independent of wording (mirrors sphinx.canonical_key), so one export fills
  // "Spot 1 [100 MeV] – Position X" or RadMachine's "GTR5_Energy [100.00 MeV]: Spot1 Pos X [mm]".
  function canonicalKey(name) {
    const n = String(name || "").toLowerCase().replace(/\s+/g, " ");
    const rules = [[/distal fall ?off|\bdfo\b/, "dfo"], [/distal depth/, "distal"], [/proximal depth/, "proximal"],
      [/\bpos(ition)? x\b/, "pos_x"], [/\bpos(ition)? y\b/, "pos_y"], [/sigma x/, "sigma_x"], [/sigma y/, "sigma_y"],
      [/skewness x/, "skew_x"], [/skewness y/, "skew_y"], [/intensity/, "intensity"], [/homogeneity|flatness/, "flatness"],
      [/absolute dose/, "output"], [/coincidence.*(x offset|distance x)/, "coin_x"], [/coincidence.*(y offset|distance y)/, "coin_y"], [/\bwidth\b/, "width"]];
    const hit = rules.find(([re]) => re.test(n));
    if (!hit) return null;
    const metric = hit[1];
    const spot = /spot ?(\d+)/.exec(n);
    const energy = ["dfo", "distal", "proximal", "width"].includes(metric) || spot ? nominalEnergy(name) : null;
    return `${metric}|${energy ?? ""}|${spot ? spot[1] : ""}`;
  }
  const isPbsTemplate=name=>/PBS\s*DailyQA/i.test(name||'');
  function templateMatch(items,name){
    const key=canonicalKey(name);if(!key)return null;
    const [metric,energy,spot]=key.split('|');if(!spot)return null;
    const matches=items.filter(i=>{const k=(canonicalKey(i.name)||'').split('|');return k[0]===metric&&k[1]===energy&&/spot\s*\d+/i.test(i.name);});
    return matches.length===1?matches[0]:null;
  }
  function standardName(category, item, metric, spot) {
    metric = metric.replace(/\s+/g, " ").trim();
    const e = nominalEnergy(item);
    if (e === null) return `${category} – ${metric}`;
    if (category === "Spot" && spot) return `Spot ${spot} [${e} MeV] – ${metric}`;
    return `${category} [${e} MeV] – ${metric}`;
  }
  function cellText(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    return String(v).trim();
  }
  function readRows(bytes) {
    if (!bytes.length) throw new Error("The file is empty.");
    if (!window.XLSX) throw new Error("The spreadsheet reader did not load. Reload the portal.");
    let wb;
    try {
      wb = XLSX.read(bytes, { type: "array", codepage: 65001, raw: true });
    } catch (err) {
      throw new Error(`Not a readable .xls file (${err.message}).`);
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
    return aoa.map((row) => row.map((v, c) => [c, cellText(v)]).filter(([, t]) => t));
  }
  function parseRows(rows, filename) {
    let setupCol = null, finished = null, sphinxUser = null, category = null, item = null;
    const measurements = [];
    rows.forEach((cells, index) => {
      const texts = cells.map(([, t]) => t);
      const cols = Object.fromEntries(cells);
      if (setupCol === null) { const f = cells.find(([, t]) => t === "Setup"); if (f) setupCol = f[0]; }
      if (finished === null) {
        for (const [col, t] of cells) {
          const m = FINISHED.exec(t);
          if (m) {
            let h = Number(m[4]) % 12; if (m[7] === "PM") h += 12;
            finished = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]), Number(m[6]));
            const above = index ? Object.fromEntries(rows[index - 1]) : {};
            sphinxUser = above[col] || null;
          }
        }
      }
      const tolerances = texts.map((t, i) => (t.startsWith("±") ? i : -1)).filter((i) => i >= 0);
      const setupText = setupCol !== null ? cols[setupCol] : undefined;
      if (tolerances.length >= 2) {
        if (category === null || NOT_IMPORTED.has(category)) return;
        if (setupText && !SETUP_LABELS.has(setupText) && !SETUP_VALUE.test(setupText)) item = cleanItem(setupText);
        const [first, second] = tolerances;
        if (first === 0) throw new Error(`Row ${index + 1}: tolerance without a metric name.`);
        const after = texts.slice(second + 1);
        const numbers = after.map(quantity).filter(Boolean);
        if (numbers.length < 2) throw new Error(`Row ${index + 1}: expected an expected value and a result.`);
        const warn = quantity(texts[first]), fail = quantity(texts[second]);
        const [expected, unit] = numbers[0], [result] = numbers[1];
        measurements.push({
          category, item: item || category, metric: texts[first - 1].trim(), unit: unit || "", expected, result,
          warn: warn[0], fail: fail[0], tol_mode: warn[1] === "%" && unit !== "%" ? "percent" : "absolute",
          sphinx_status: after.find((t) => SPHINX_STATUSES.includes(t)) || null,
        });
        return;
      }
      if (setupText && cells.length === 1) {
        if (CATEGORIES.includes(setupText) && setupText !== category) { category = setupText; item = null; }
        else if (category && !SETUP_LABELS.has(setupText) && !SETUP_VALUE.test(setupText)) item = cleanItem(setupText);
      }
    });
    const spotOrder = new Map();
    for (const m of measurements) {
      if (m.category === "Spot" && !spotOrder.has(m.item)) {
        const n = /^Spot\s+(\d+)/.exec(m.item);
        spotOrder.set(m.item, n ? Number(n[1]) : spotOrder.size + 1);
      }
    }
    const seen = new Map();
    for (const m of measurements) {
      m.sphinx_label = m.item === m.category ? m.metric : `${m.item} – ${m.metric}`;
      m.name = standardName(m.category, m.item, m.metric, m.category === "Spot" ? spotOrder.get(m.item) : null);
      const k = `${m.category}|${m.name}`;
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(m);
    }
    for (const group of seen.values()) if (group.length > 1) for (const m of group) m.name = `${m.category} – ${m.sphinx_label}`;
    if (finished === null) {
      const m = FILE_DATE.exec(filename || "");
      if (m) finished = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    }
    if (!measurements.length) {
      if (rows.slice(0, 10).some((cells) => cells.some(([, t]) => t === "Skipped"))) throw new Error("Sphinx marked this session as Skipped; it has no measurements.");
      throw new Error("No Sphinx measurements found in this file.");
    }
    if (finished === null) throw new Error("Could not find the QA date in the file or its name.");
    return {
      finished: `${localIso(finished)}T${String(finished.getHours()).padStart(2, "0")}:${String(finished.getMinutes()).padStart(2, "0")}:${String(finished.getSeconds()).padStart(2, "0")}`,
      qa_date: localIso(finished), sphinx_user: sphinxUser || "", measurements,
    };
  }
  async function sha256(bytes) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function decodeUpload(upload) {
    try {
      const bin = atob(upload.data || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return [upload.name || "upload.xls", bytes];
    } catch {
      throw new Error("The uploaded file could not be read.");
    }
  }
  async function parseUpload(upload) {
    const [name, bytes] = decodeUpload(upload);
    let parsed;
    try {
      parsed = /\.pdf$/i.test(name) ? await window.QAWinstonLutz.parse(bytes, name) : parseRows(readRows(bytes), name);
    } catch (err) {
      throw new Error(`${name}: ${err.message}`);
    }
    parsed.filename = name;
    parsed.sha256 = await sha256(bytes);
    return parsed;
  }
  const fileLimits = (m) => ({ expected: m.expected, warn: m.warn, fail: m.fail, tol_mode: m.tol_mode, ...(m.criterion ? {criterion:m.criterion} : {}) });

  // ---- users / session --------------------------------------------------------

  async function passwordHash(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:new TextEncoder().encode(salt), iterations:100000, hash:'SHA-256'}, key, 256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
  }
  async function setPassword(user, password) {
    user.password_salt = crypto.randomUUID();
    user.password_hash = await passwordHash(password, user.password_salt);
  }
  async function checkPassword(user, password) {
    return !!(user && user.password_salt && user.password_hash === await passwordHash(password, user.password_salt));
  }
  async function setupDemoAccounts() {
    if(!S.demoTherapistRenameV1){
      const old=S.users.find(u=>u.username.toLowerCase()==='therapy'&&u.role==='therapist');
      if(old&&!S.users.some(u=>u.username.toLowerCase()==='therapist')){
        old.username='Therapist';old.full_name='Therapist';await setPassword(old,'Therapist');
        audit(null,'rename_demo_therapist','user',old.id,{previous_username:'Therapy',username:'Therapist'});
      }
      S.demoTherapistRenameV1=true;save();
    }
    if (S.demoPasswordAccountsV1) return;
    for (const [name, role] of [['Physicist','physicist'],['Therapist','therapist'],['Admin','admin']]) {
      let user = S.users.find(u => u.username.toLowerCase() === name.toLowerCase());
      if (!user) user = byId('users', insert('users', {username:name, full_name:name, role, active:1, created_at:now()}));
      user.role = role;
      user.active = 1;
      await setPassword(user, name);
    }
    localStorage.removeItem('qa_portal_user');
    sessionStorage.removeItem('qa_portal_password_user');
    S.demoPasswordAccountsV1 = true;
    save();
  }

  const publicUser = (u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role });
  function currentUser() {
    const id = Number(sessionStorage.getItem("qa_portal_password_user") || 0);
    const u = id && byId("users", id);
    return u && u.active ? publicUser(u) : null;
  }

  // ---- queues / tests ---------------------------------------------------------

  function choiceOptions(description) {
    const m=/\[choices: ([^\]]+)\]/.exec(description||'');
    try {const choices=m?JSON.parse(decodeURIComponent(m[1])):[];return Array.isArray(choices)&&choices.every(c=>typeof c==='string')?choices:[];}catch{return [];}
  }

  function saveTest(user, data, testId) {
    require(user, "configure");
    data={...data};
    let type = data.type || "numeric";
    if(type==='derived') {let rule=typeof data.derived==='string'?JSON.parse(data.derived):data.derived;rule=rule||QADerived.read(data.description);data.description=QADerived.encode(data.description,QADerived.validate(rule));type='numeric';}
    else if('derived' in data)data.description=QADerived.encode(data.description,null);
    if (!["numeric", "boolean", "status", "text", "choice"].includes(type)) throw new Error("Test type must be numeric, boolean, status, or text.");
    data={...data};
    if(type==='choice') {
      const choices=typeof data.choices==='string'?data.choices.split(/\r?\n/).map(c=>c.trim()).filter(Boolean):data.choices||choiceOptions(data.description);
      if(!Array.isArray(choices)||choices.length<(/\[device: (?:chamber|electrometer)\]/.test(data.description||'')?0:2)||choices.length>100||new Set(choices).size!==choices.length||choices.some(c=>typeof c!=='string'||!c.trim()||c.length>200))throw Error('Multiple choice needs 2–100 unique, nonempty choices (up to 200 characters each).');
      data.description=(data.description||'').replace(/\s*\[choices: [^\]]+\]/g,'')+' [choices: '+encodeURIComponent(JSON.stringify(choices))+']';
    }
    const limits = type === "numeric" ? limitsOf(data, false) : { expected: null, warn: null, fail: null, tol_mode: "absolute" };
    const name = required(data, "name"), category = text(data, "category");
    const existing = testId ? get("tests", testId, "Check") : null;
    let owner = data.owner_queue_id ?? (existing ? existing.owner_queue_id : null);
    owner = owner ? get("queues", owner, "QA list").id : null;
    if (S.tests.some((t) => t.name === name && t.category === category && (t.owner_queue_id ?? null) === owner && t.id !== (testId || 0))) {
      throw new Error(`A check named '${name}' already exists in that category${owner ? " of this QA list." : "."}`);
    }
    const row = { name, category, type, unit: text(data, "unit"), description: text(data, "description"), ...limits, active: flag(data, "active"), owner_queue_id: owner };
    if (!existing) {
      const id = insert("tests", row);
      audit(user.id, "create", "test", id, { name, owner });
      return { id };
    }
    Object.assign(existing, row);
    save();
    audit(user.id, "update", "test", existing.id, { name, owner });
    return { id: existing.id };
  }

  function queueItems(queueId) {
    // Last change to each test, from the audit log; untouched tests show when the list was made (mirrors service.get_queue).
    const last = {};
    for (const a of S.audit) if (a.entity === "test") last[a.entity_id] = a;
    const made = S.audit.find((a) => a.entity === "queue" && a.entity_id === queueId) || S.audit.find((a) => a.action === "seed");
    const who = (a) => { if (!a) return null; const u = a.user_id ? byId("users", a.user_id) : null; return u ? (u.full_name || u.username) : "starting data"; };
    return S.queue_items.filter((i) => i.queue_id === queueId).sort((a, b) => a.position - b.position).map((i) => {
      const t = byId("tests", i.test_id);
      const a = last[i.test_id] || made;
      return { ...i, name: t.name, category: t.category, type: t.type, unit: t.unit,
        default_expected: t.expected, default_warn: t.warn, default_fail: t.fail, default_tol_mode: t.tol_mode,
        modified_at: a ? a.at : null, modified_by: who(a) };
    });
  }
  function getQueue(id) {
    const q = get("queues", id, "QA list");
    // The machines that run this very list (one object, shared; each machine may hold its own values as overrides).
    const schedules = S.assignments.filter((a) => a.queue_id === q.id).map((a) => ({ id: a.id, machine_id: a.machine_id, active: a.active,
      machine: (byId("machines", a.machine_id) || {}).name })).sort((a, b) => String(a.machine).localeCompare(String(b.machine)));
    return { ...q, items: queueItems(q.id), schedules };
  }
  function listQueues() {
    return S.queues.map((q) => ({
      ...q,
      item_count: S.queue_items.filter((i) => i.queue_id === q.id).length,
      machine_count: S.assignments.filter((a) => a.queue_id === q.id && a.active).length,
      template_name: q.template_id ? (byId("queues", q.template_id) || {}).name || null : null,
      ...(() => { const own = new Set(S.tests.filter((t) => t.owner_queue_id === q.id).map((t) => t.id));
        const newest = S.audit.filter((a) => (a.entity === "queue" && a.entity_id === q.id) || (a.entity === "test" && own.has(a.entity_id))).reduce((m, a) => (!m || a.at > m.at || (a.at === m.at && a.id > m.id) ? a : m), null);
        const u = newest && newest.user_id ? byId("users", newest.user_id) : null;
        return { modified_order: newest ? newest.id : 0, modified_at: newest ? newest.at : null, modified_by: u ? (u.full_name || u.username) : (newest ? "system" : null) }; })(),
      machines: S.assignments.filter((a) => a.queue_id === q.id && a.active).map((a) => byId("machines", a.machine_id).name).join(", ") || null,
    })).sort((a, b) => (b.is_template - a.is_template) || (b.active - a.active) || a.name.localeCompare(b.name));
  }
  function saveQueue(user, data, queueId) {
    require(user, "configure");
    if (data.test_updates && data.test_updates.length) {
      if (!queueId) throw new Error('Save the template before editing its tests.');
      const snapshot = JSON.parse(JSON.stringify(S));
      try {
        const members = new Set((data.items || []).map(item => Number(item.test_id)));
        for (const update of data.test_updates) {
          const test = get('tests', update.test_id, 'Check');
          if (!members.has(test.id) || (test.owner_queue_id && test.owner_queue_id !== queueId)) throw new Error("Only this template's tests can be edited here.");
          const fields = Object.fromEntries(['name','category','type','choices','derived'].filter(key => key in update).map(key => [key,update[key]]));
          saveTest(user, {...test,...fields}, test.id);
        }
        return saveQueue(user, {...data,test_updates:[]}, queueId);
      } catch (err) { S = snapshot; save(); throw err; }
    }
    const name = required(data, "name");
    if (S.queues.some((q) => q.name.toLowerCase() === name.toLowerCase() && q.id !== (queueId || 0))) throw new Error(`A QA list named '${name}' already exists.`);
    const items = (data.items || []).map((item, position) => {
      const test = get("tests", item.test_id, "Check");
      if (test.owner_queue_id && test.owner_queue_id !== queueId) throw new Error(`'${test.name}' belongs to another QA list. Duplicate that list, or add a new check here.`);
      const limits = test.type === "numeric" ? limitsOf(item, true) : { expected: null, warn: null, fail: null, tol_mode: null };
      return { test_id: test.id, position, ...limits };
    });
    const priorDerived=[];for(const item of items){const test=get('tests',item.test_id,'Check');const rule=QADerived.read(test.description);if(rule)QADerived.resolve(rule,priorDerived);priorDerived.push(test);}
    if (new Set(items.map((i) => i.test_id)).size !== items.length) throw new Error("A check can only appear once in a QA list.");
    const existing = queueId ? get("queues", queueId, "QA list") : null;
    const isTemplate = flag(data, "is_template", existing ? !!existing.is_template : false);
    const blocks=QAMappedImports.validate(data.import_blocks??existing?.import_blocks??[],items.map(i=>get("tests",i.test_id)));
    const fields = { name, description: text(data, "description"), active: flag(data, "active"), is_template: isTemplate, import_blocks:blocks };
    let id;
    if (!existing) {
      id = insert("queues", { ...fields, template_id: null });
    } else {
      Object.assign(existing, fields);
      id = existing.id;
      var before = Object.fromEntries(S.queue_items.filter((i) => i.queue_id === id).map((i) => [i.test_id, i]));
      S.queue_items = S.queue_items.filter((i) => i.queue_id !== id);
    }
    for (const i of items) insert("queue_items", { queue_id: id, ...i });
    audit(user.id, existing ? "update" : "create", "queue", id, { name, tests: items.map((i) => i.test_id) });
    if (existing) {
      for (const i of items) {
        const old = before[i.test_id];
        if (!old || ["expected", "warn", "fail", "tol_mode"].some((k) => (old[k] ?? null) !== (i[k] ?? null))) {
          audit(user.id, old ? "update_limits" : "add_to_list", "test", i.test_id, { queue: name });
        }
      }
    }
    return { id };
  }
  // Archive hides a list and its schedules; delete is refused once any result exists (mirrors service.py).
  function renameQueue(user, queueId, data) {
    require(user, "configure");
    const q = get("queues", queueId, "QA list");
    const name = required(data, "name");
    if (S.queues.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== q.id)) throw new Error(`A QA list named '${name}' already exists.`);
    const was = q.name;
    q.name = name;
    save();
    audit(user.id, "rename", "queue", q.id, { was, name });
    return { id: q.id, name };
  }
  function reevaluateQueue(user, queueId) {
    require(user, "configure");
    const q = get("queues", queueId, "QA list");
    const rank = { pass: 0, recorded: 0, warn: 1, fail: 2 };
    const runs = new Set();
    let changed = 0;
    const own = new Map(S.overrides.map((o) => { const a = byId("assignments", o.assignment_id); return a && a.queue_id === q.id ? [`${a.machine_id}|${o.test_id}`, o] : null; }).filter(Boolean));
    for (const item of S.queue_items.filter((i) => i.queue_id === q.id)) {
      const test = byId("tests", item.test_id);
      if (!test) continue;
      for (const res of S.results.filter((r) => r.test_id === test.id && (byId("runs", r.run_id) || {}).queue_id === q.id)) {
        const limits = resolveLimits(test, item, own.get(`${byId("runs", res.run_id).machine_id}|${test.id}`));   // that machine's own values
        const value = test.type === "text" ? res.value_text : res.value_num;
        if (value === null || value === undefined) continue;
        const status = evaluate(test.type, test.type === "boolean" ? (res.value_num ? "pass" : "fail") : value, limits);
        if (status !== res.status) changed++;
        Object.assign(res, { expected: limits.expected, warn: limits.warn, fail: limits.fail, tol_mode: limits.tol_mode, status });
        runs.add(res.run_id);
      }
    }
    for (const runId of runs) {
      const run = byId("runs", runId);
      if (run) run.overall = resultOverall(S.results.filter((r) => r.run_id === runId));
    }
    save();
    audit(user.id, "reevaluate", "queue", q.id, { name: q.name, runs: runs.size, verdicts_changed: changed });
    return { runs: runs.size, changed };
  }
  function archiveQueue(user, queueId, data) {
    require(user, "configure");
    const q = get("queues", queueId, "QA list");
    const archived = data.archived !== false;
    q.active = archived ? 0 : 1;
    save();
    audit(user.id, archived ? "archive" : "restore", "queue", q.id, { name: q.name });
    return { ok: true };
  }
  function deleteQueue(user, queueId) {
    require(user, "configure");
    const q = get("queues", queueId, "QA list");
    const runs = S.runs.filter((r) => r.queue_id === q.id).length;
    if (runs) throw new Error(`'${q.name}' has ${runs} recorded QA run(s), so it cannot be deleted. Archive it instead to hide it.`);
    const assignmentIds = new Set(S.assignments.filter((a) => a.queue_id === q.id).map((a) => a.id));
    S.overrides = S.overrides.filter((o) => !assignmentIds.has(o.assignment_id));
    S.assignments = S.assignments.filter((a) => a.queue_id !== q.id);
    S.queue_items = S.queue_items.filter((i) => i.queue_id !== q.id);
    S.tests = S.tests.filter((t) => t.owner_queue_id !== q.id || S.results.some((r) => r.test_id === t.id));
    for (const other of S.queues) if (other.template_id === q.id) other.template_id = null;
    S.queues = S.queues.filter((x) => x.id !== q.id);
    save();
    audit(user.id, "delete", "queue", q.id, { name: q.name });
    return { ok: true };
  }
  function createTemplate(user, data) {
    require(user, "configure");
    const name = required(data, "name");
    if (S.queues.some((q) => q.name.toLowerCase() === name.toLowerCase())) throw new Error("A QA template list with that name already exists.");
    const starter = data.starter ? ((window.PORTAL_SEED || {}).templates || []).find((t) => t.name === data.starter) : null;
    if (data.starter && !starter) throw new Error("Choose an available starter template.");
    const checks = starter ? starter.checks : data.tests || [];
    if (!Array.isArray(checks) || checks.length > 500) throw new Error("Import up to 500 tests at a time.");
    const before = JSON.parse(JSON.stringify(S));
    try {
      const id = insert("queues", { name, description: starter ? starter.setup || "" : data.description || "", active: 1, is_template: 1, template_id: null });
      checks.forEach((check, position) => {
        const tid = saveTest(user, { ...check, owner_queue_id: id }).id;
        insert("queue_items", { queue_id: id, test_id: tid, position, expected: null, warn: null, fail: null, tol_mode: null });
      });
      save(); audit(user.id, "create_template", "queue", id, { name, source: data.starter || data.source || "blank", tests: checks.length });
      return { id, tests: checks.length };
    } catch (err) { S = before; save(); throw err; }
  }
  function duplicateQueue(user, sourceId, data) {
    require(user, "configure");
    const source = getQueue(sourceId);
    const name = required(data, "name");
    if (S.queues.some((q) => q.name.toLowerCase() === name.toLowerCase())) throw new Error(`A QA list named '${name}' already exists.`);
    const asTemplate = !!flag(data, "as_template", false);
    const id = insert("queues", { name, description: source.description, import_blocks:JSON.parse(JSON.stringify(source.import_blocks||[])), active: 1, is_template: asTemplate ? 1 : 0, template_id: null });
    for (const item of source.items) {
      const test = byId("tests", item.test_id);
      const limits = resolveLimits(test, item);
      const newId = insert("tests", { name: test.name, category: test.category, type: test.type, unit: test.unit, description: test.description,
        ...limits, active: 1, owner_queue_id: id });
      insert("queue_items", { queue_id: id, test_id: newId, position: item.position, expected: null, warn: null, fail: null, tol_mode: null });
    }
    audit(user.id, "duplicate", "queue", id, { name, source: source.name, checks: source.items.length });
    const result = { id };
    if (data.machine_id) result.assignment_id = saveAssignment(user, { ...data, queue_id: id }).id;
    return result;
  }

  // ---- machines / assignments -------------------------------------------------

  function deleteMachine(user, machineId) {
    require(user, "configure");
    const m=get("machines",machineId,"Machine");
    if(S.runs.some((r)=>r.machine_id===m.id))throw new Error("This machine has recorded QA results. Retire it to remove it from active lists and preserve its history.");
    const ids=new Set(S.assignments.filter((a)=>a.machine_id===m.id).map((a)=>a.id));
    S.overrides=S.overrides.filter((o)=>!ids.has(o.assignment_id));S.drafts=(S.drafts||[]).filter((d)=>!ids.has(d.assignment_id));
    S.assignments=S.assignments.filter((a)=>a.machine_id!==m.id);S.machines=S.machines.filter((x)=>x.id!==m.id);
    S.deletedSeedMachines=[...new Set([...(S.deletedSeedMachines||[]),m.name])];
    save();audit(user.id,"delete","machine",m.id,{name:m.name});return {ok:true};
  }
  function saveMachine(user, data, machineId) {
    require(user, "configure");
    const name = required(data, "name");
    if (S.machines.some((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== (machineId || 0))) throw new Error(`A machine named '${name}' already exists.`);
    const fields = { name, kind: text(data, "kind"), location: text(data, "location"), notes: text(data, "notes"), active: flag(data, "active") };
    if (!machineId) {
      const id = insert("machines", { ...fields, created_at: now() });
      audit(user.id, "create", "machine", id, { name });
      return { id };
    }
    const m = get("machines", machineId);
    Object.assign(m, fields);
    save();
    audit(user.id, "update", "machine", m.id, { name });
    return { id: m.id };
  }
  const lastDone = (assignmentId) => {
    const dates = S.runs.filter((r) => !r.trashed_at && r.assignment_id === assignmentId).map((r) => r.qa_date).sort();
    return dates.length ? fromIso(dates[dates.length - 1]) : null;
  };
  function listAssignments(machineId, today) {
    today = today || new Date();
    return S.assignments.filter((a) => a.machine_id === Number(machineId) && byId("queues", a.queue_id).active).map((a) => ({
      ...a, archived: !!testSelection(a).archived, active: testSelection(a).archived ? 0 : a.active, queue_name: byId("queues", a.queue_id).name, schedule: describeSchedule(a), ...dueState(a, lastDone(a.id), today),
      override_count: S.overrides.filter((o) => o.assignment_id === a.id).length,
    })).sort((a, b) => (b.active - a.active) || a.queue_name.localeCompare(b.queue_name));
  }
  function archiveAssignment(user, assignmentId, data) {
    require(user, "configure");
    const a = get("assignments", assignmentId, "Schedule"), selection = testSelection(a), archived = data.archived !== false;
    if (!!selection.archived === archived) return { ok: true };
    if (archived) { selection.active_before_archive = !!a.active; selection.archived = true; a.active = 0; }
    else { a.active = selection.active_before_archive === false ? 0 : 1; delete selection.archived; delete selection.active_before_archive; }
    a.test_selection = selection; save(); audit(user.id, archived ? "archive" : "restore", "assignment", a.id, {});
    return { ok: true };
  }
  function deleteAssignment(user, assignmentId) {
    require(user, "configure");
    const a = get("assignments", assignmentId, "Schedule");
    if (S.runs.some((r) => r.assignment_id === a.id)) throw new Error("This machine schedule has recorded results. Archive it to preserve its history.");
    S.overrides = S.overrides.filter((o) => o.assignment_id !== a.id);
    S.drafts = (S.drafts || []).filter((d) => d.assignment_id !== a.id);
    S.assignments = S.assignments.filter((x) => x.id !== a.id);
    save(); audit(user.id, "delete", "assignment", a.id, {}); return { ok: true };
  }
  function duplicateAssignment(user, assignmentId, data) {
    require(user, "configure");
    const t = runTemplate(assignmentId), name = required(data, "name");
    if (S.queues.some((q) => q.name.toLowerCase() === name.toLowerCase())) throw new Error("A QA list with that name already exists.");
    const id = insert("queues", { name, description: t.queue.description, import_blocks:JSON.parse(JSON.stringify(t.queue.import_blocks||[])), active: 1, is_template: 0, template_id: null });
    t.items.forEach((item, position) => {
      const testId = insert("tests", { name: item.name, category: item.category, type: item.type, unit: item.unit, description: item.description, ...item.limits, active: 1, owner_queue_id: id });
      insert("queue_items", { queue_id: id, test_id: testId, position, expected: null, warn: null, fail: null, tol_mode: null });
    });
    const a = t.assignment;
    const sid = saveAssignment(user, { machine_id: a.machine_id, queue_id: id, frequency: a.frequency, interval_days: a.interval_days,
      weekdays: String(a.weekdays).split(',').filter(Boolean).map(Number), start_date: a.start_date, active: false, import_folder: a.import_folder || '' }).id;
    save(); audit(user.id, "duplicate", "assignment", sid, { source: a.id, queue_id: id, name });
    return { id, assignment_id: sid };
  }
  function reevaluateAssignment(user, assignmentId) {
    require(user, "configure");
    const a = get("assignments", assignmentId, "Schedule"), q = getQueue(a.queue_id), runs = new Set(); let changed = 0;
    for (const r of S.results.filter((r) => (byId("runs", r.run_id) || {}).assignment_id === a.id)) {
      const test = get("tests", r.test_id), item = q.items.find((i) => i.test_id === test.id) || {};
      const own = S.overrides.find((o) => o.assignment_id === a.id && o.test_id === test.id), limits = resolveLimits(test, item, own);
      const value = ["numeric", "boolean"].includes(test.type) ? r.value_num : r.value_text;
      if (value === null || value === undefined) continue;
      const status = evaluate(test.type, test.type === "boolean" ? (value ? "pass" : "fail") : value, limits);
      if (status !== r.status) changed++;
      Object.assign(r, { ...limits, status }); runs.add(r.run_id);
    }
    for (const id of runs) byId("runs", id).overall = resultOverall(S.results.filter((r) => r.run_id === id));
    save(); audit(user.id, "reevaluate", "assignment", a.id, { runs: runs.size, verdicts_changed: changed });
    return { runs: runs.size, changed };
  }
  function saveAssignment(user, data, assignmentId) {
    require(user, "configure");
    if (assignmentId && testSelection(get("assignments", assignmentId)).archived) throw new Error("Restore this archived schedule before changing it.");
    const frequency = data.frequency;
    if (!FREQUENCIES.includes(frequency)) throw new Error("Choose a frequency.");
    let interval = null;
    if (frequency === "custom") {
      interval = Number(data.interval_days);
      if (!Number.isInteger(interval) || interval <= 0) throw new Error("Custom schedules need a whole number of days greater than zero.");
    }
    const weekdays = [...parseWeekdays((data.weekdays ?? [0, 1, 2, 3, 4]).join ? data.weekdays.join(",") : data.weekdays)].sort().join(",");
    const start = data.start_date || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || isNaN(fromIso(start))) throw new Error("Start date must be YYYY-MM-DD.");
    const active = flag(data, "active");
    if (!assignmentId) {
      const machine = get("machines", data.machine_id), queue = get("queues", data.queue_id, "QA list");
      if (S.assignments.some((a) => a.machine_id === machine.id && a.queue_id === queue.id)) throw new Error(`'${queue.name}' is already scheduled on ${machine.name}.`);
      const id = insert("assignments", { machine_id: machine.id, queue_id: queue.id, frequency, interval_days: interval, weekdays, start_date: start, active,
        import_folder: text(data, "import_folder") });
      audit(user.id, "create", "assignment", id, { machine: machine.name, queue: queue.name, frequency });
      return { id };
    }
    const a = get("assignments", assignmentId, "Schedule");
    Object.assign(a, { frequency, interval_days: interval, weekdays, start_date: start, active });
    if (data.import_folder !== undefined) a.import_folder = text(data, "import_folder");
    save();
    audit(user.id, "update", "assignment", a.id, { frequency, weekdays, start, active, import_folder: a.import_folder || "" });
    return { id: a.id };
  }
  function testSelection(a) {
    return typeof a.test_selection === "string" ? JSON.parse(a.test_selection || "{}") : a.test_selection || {};
  }
  function saveTestSelection(user, assignmentId, data) {
    require(user, "configure");
    const a = get("assignments", assignmentId, "Schedule"), base = new Set(getQueue(a.queue_id).items.map((i) => i.test_id));
    if (![data.added || [], data.excluded || []].every(Array.isArray)) throw new Error("Choose valid tests.");
    const excluded = [...new Set((data.excluded || []).map(Number))], added = [...new Set((data.added || []).map(Number))];
    for (const tid of [...excluded, ...added]) {
      const t = get("tests", tid, "Test");
      if (t.owner_queue_id && t.owner_queue_id !== a.queue_id) throw new Error("That test belongs to another QA list.");
      if (added.includes(tid) && !t.active) throw new Error("Choose an active test.");
    }
    a.test_selection = { ...testSelection(a), excluded, added: added.filter((tid) => !base.has(tid)) };
    save(); audit(user.id, "update", "test_selection", a.id, a.test_selection);
    return { ok: true, ...a.test_selection };
  }
  function runTemplate(assignmentId) {
    const a = { ...get("assignments", assignmentId, "Schedule") };
    if (testSelection(a).archived) a.active = 0;
    const machine = get("machines", a.machine_id);
    const queue = getQueue(a.queue_id);
    const overrides = Object.fromEntries(S.overrides.filter((o) => o.assignment_id === a.id).map((o) => [o.test_id, o]));
    const selection = testSelection(a), base = new Set(queue.items.map((i) => i.test_id));
    const extra = (selection.added || []).filter((tid) => !base.has(tid)).map((test_id) => ({ test_id }));
    const allItems = [...queue.items, ...extra].map((item) => {
      const test = byId("tests", item.test_id);
      const o = overrides[test.id];
      return { excluded: (selection.excluded || []).includes(test.id), machine_only: !base.has(test.id), test_id: test.id, name: test.name, category: test.category, type: test.type, unit: test.unit, description: test.description,
        limits: resolveLimits(test, item, o), queue_limits: resolveLimits(test, item),
        override: o ? { expected: o.expected, warn: o.warn, fail: o.fail, tol_mode: o.tol_mode } : null,
        last_text: test.type === "text" ? (S.results.filter((r) => r.test_id === test.id && r.value_text).map((r) => ({ r, run: byId("runs", r.run_id) }))
          .filter((x) => x.run && !x.run.trashed_at && x.run.machine_id === a.machine_id)                      // this machine's last entry
          .sort((x, y) => (y.run.qa_date + y.run.id).localeCompare(x.run.qa_date + x.run.id))[0] || {}).r?.value_text || null : null };
    });
    return { assignment: { ...a, schedule: describeSchedule(a) }, machine, queue: { id: queue.id, name: queue.name, description: queue.description, active: queue.active, import_blocks:queue.import_blocks||[] }, items: allItems.filter((i) => !i.excluded), all_items: allItems, test_selection: selection };
  }
  function saveOverrides(user, assignmentId, data) {
    require(user, "configure");
    get("assignments", assignmentId, "Schedule");
    S.overrides = S.overrides.filter((o) => o.assignment_id !== Number(assignmentId));
    for (const item of data.overrides || []) {
      const limits = limitsOf(item, true);
      if (Object.values(limits).some((v) => v !== null)) insert("overrides", { assignment_id: Number(assignmentId), test_id: Number(item.test_id), ...limits });
    }
    save();
    audit(user.id, "update", "overrides", Number(assignmentId), {});
    return { ok: true };
  }
  function dashboard() {
    const today = new Date();
    const machines = S.machines.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name)).map((m) => {
      const queues = listAssignments(m.id, today).filter((a) => a.active).map((a) => {
        const runs = S.runs.filter((r) => !r.trashed_at && r.assignment_id === a.id).sort((x, y) => (y.qa_date.localeCompare(x.qa_date)) || (y.id - x.id));
        const ids=new Set(runs.map(r=>r.id)),history_counts={};
        for(const res of S.results.filter(r=>ids.has(r.run_id)))history_counts[res.status]=(history_counts[res.status]||0)+1;
        return { ...a, history_counts, last_run: runs[0] ? { id: runs[0].id, overall: runs[0].overall, review_status: runs[0].review_status, qa_date: runs[0].qa_date } : null };
      });
      const history_counts={};for(const q of queues)for(const [key,count]of Object.entries(q.history_counts))history_counts[key]=(history_counts[key]||0)+count;
      return { ...m, queues, history_counts, pending_review: S.runs.filter((r) => !r.trashed_at && r.machine_id === m.id && r.review_status === "pending" && reviewReady(r)).length };
    });
    return { today: localIso(today), machines };
  }

  // ---- runs -------------------------------------------------------------------

  function insertRun(user, t, qaDate, rows, comment, source, sourceRef, reviewStatus) {
    const result = resultOverall(rows);
    const id = insert("runs", { assignment_id: t.assignment.id, machine_id: t.machine.id, queue_id: t.queue.id, performed_by: user.id,
      performed_at: now(), qa_date: qaDate, overall: result, comment, source, source_ref: sourceRef, review_status: reviewStatus, therapist_approval_required: reviewStatus === 'pending' && t.items.some(item => /therapist/i.test(item.name) && /review|approv/i.test(item.name) || /\[approval: therapist\]/i.test(item.description || '')), therapist_approved_by: null, therapist_approved_at: null,
      reviewed_by: null, reviewed_at: null, review_comment: "" });
    for (const r of rows) insert("results", { run_id: id, test_id: r.test_id, value_num: r.value_num, value_text: r.value_text, ...r.limits, status: r.status, comment: r.comment });
    audit(user.id, reviewStatus === "imported" ? "import" : "submit", "run", id, { machine: t.machine.name, queue: t.queue.name, overall: result, source });
    return { id, overall: result };
  }
  function checkNotImported(ref) {
    if (!ref) return;
    const r = S.runs.find((x) => x.source_ref === ref);
    if (r) throw new Error(`This Sphinx file was already recorded as run #${r.id} (${r.qa_date}).`);
  }
  function submitRun(user, assignmentId, data) {
    require(user, "perform");
    const t = runTemplate(assignmentId);
    if (!t.assignment.active || !t.machine.active || !t.queue.active) throw new Error("This queue is not active on this machine.");
    const qaDate = data.qa_date || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(qaDate)) throw new Error("QA date must be YYYY-MM-DD.");
    if (qaDate > todayIso()) throw new Error("QA date cannot be in the future.");
    const entered = Object.fromEntries((data.results || []).map((r) => [Number(r.test_id), r]));
    const rows = [];
    const prior=[],computed={};
    for (const item of t.items) {
      const raw = entered[item.test_id] || {};
      let value = raw.value;
      const rule=QADerived.read(item.description);
      if(rule)value=QADerived.calculate(rule,prior,x=>computed[x.test_id]);
      prior.push(item);computed[item.test_id]=value;
      if (value === null || value === undefined || String(value).trim() === "") { if (item.type !== "text") rows.push({test_id:item.test_id, value_num:null, value_text:null, limits:item.limits, status:"recorded", comment:text(raw,"comment")}); continue; }
      if (item.type === "numeric") { value = Number(value); if (!Number.isFinite(value)) throw new Error(`${item.name}: enter a number.`); }
      else if (item.type === "boolean") value = [true, 1, "1", "true", "pass", "yes"].includes(value);
      else if (item.type === 'choice') {value=String(value);if(!choiceOptions(item.description).includes(value))throw Error(`${item.name}: choose an available answer.`);}
      else if (item.type === "status") {
        value = STATUS_WORDS[String(value).trim().toLowerCase()];
        if (!value) throw new Error(`${item.name}: choose Pass, Warning, or Fail.`);
      }
      else value = String(value);
      let status;
      try { status = evaluate(item.type, value, item.limits); } catch (err) { throw new Error(`${item.name}: ${err.message}`); }
      const textual = item.type === "text" || item.type === "status" || item.type === "choice";
      rows.push({ test_id: item.test_id, value_num: textual ? null : Number(value), value_text: textual ? value : null,
        limits: item.limits, status, comment: text(raw, "comment") });
    }
    const ref = text(data, "source_ref") || null;
    checkNotImported(ref);
    return insertRun(user, t, qaDate, rows, text(data, "comment"), ref?.startsWith("hdrpdf:")?"hdr-pdf":ref ? "sphinx" : "manual", ref, "pending");
  }
  function pbsTherapistResults(run) {
    if(!/PBS\s*Daily\s*QA.*Sphinx/i.test(byId('queues',run.queue_id)?.name||''))return null;
    return S.results.filter(r=>{const t=byId('tests',r.test_id);return r.run_id===run.id && (t?.name?.trim().toLowerCase()==='qa reviewed by therapist?' || /Template 4\.06\./.test(t?.description||''));});
  }
  function reviewReady(run) {if(run.trashed_at||run.therapist_approval_required&&!run.therapist_approved_by)return false;const checks=pbsTherapistResults(run);return checks===null || checks.length>0&&checks.every(r=>r.status==='pass');}
  function runRow(r) {
    const m = byId("machines", r.machine_id), q = byId("queues", r.queue_id), p = byId("users", r.performed_by) || {}, rv = r.reviewed_by ? byId("users", r.reviewed_by) : null;
    return { ...r, review_ready:reviewReady(r), therapist_approver_name: r.therapist_approved_by ? (byId('users',r.therapist_approved_by)||{}).full_name : null, machine_name: m.name, queue_name: q.name, performer_name: p.full_name, performer: p.username,
      reviewer_name: rv ? rv.full_name : null, reviewer: rv ? rv.username : null };
  }
  function listRuns(q) {
    let runs = S.runs.filter(r=>String(q.trashed||'')==='1'?!!r.trashed_at:!r.trashed_at);
    if (q.machine_id) runs = runs.filter((r) => r.machine_id === Number(q.machine_id));
    if (q.queue_id) runs = runs.filter((r) => r.queue_id === Number(q.queue_id));
    if (q.review_status) runs = runs.filter((r) => r.review_status === q.review_status && (q.review_status!=="pending" || reviewReady(r)));
    const limit = Math.min(Number(q.limit || 200), 1000);
    return runs.slice().sort((a, b) => b.qa_date.localeCompare(a.qa_date) || b.id - a.id).slice(0, limit).map(runRow);
  }
  function getRun(id) {
    const r = get("runs", id);
    const results = S.results.filter((x) => x.run_id === r.id).map((x) => { const t = byId("tests", x.test_id); return { ...x, name: t.name, category: t.category, type: t.type, unit: t.unit, description:t.description }; });
    return { ...runRow(r), results };
  }
  function trashRun(user,id,data) {
    const run=get('runs',id);
    if(!(can(user,'review') || can(user,'therapist_approve') || can(user,'perform')&&run.performed_by===user.id&&run.review_status==='pending'))throw Error('Only a reviewer, therapist, or the performer of an unreviewed submission can move this QA to trash.');
    const trashed=data.trashed!==false,reason=data.reason||'Created in error';
    Object.assign(run,{trashed_at:trashed?now():null,trashed_by:trashed?user.id:null,trash_reason:trashed?reason:null});
    audit(user.id,trashed?'trash_run':'restore_run','run',id,{reason});save();return {ok:true};
  }
  function therapistApproveRun(user,id) {
    require(user,'therapist_approve');
    const run=get('runs',id,'Run');
    if(run.trashed_at||run.review_status!=='pending'||!run.therapist_approval_required||run.therapist_approved_by) throw new Error('This run is not waiting for therapist approval.');
    Object.assign(run,{therapist_approved_by:user.id,therapist_approved_at:now()});
    const checks=pbsTherapistResults(run);if(checks?.length){checks.forEach(row=>Object.assign(row,{value_num:1,value_text:null,status:'pass'}));run.overall=resultOverall(S.results.filter(r=>r.run_id===run.id));}
    audit(user.id,'therapist_approved','run',id);save();return {ok:true};
  }
  function setTherapistReview(user,id,data) {
    require(user,'therapist_approve');const decision=data.decision;
    if(!['pass','fail','clear'].includes(decision))throw Error('Choose Pass, Fail or Clear.');
    const run=get('runs',id);
    if(run.trashed_at||!run.therapist_approval_required||decision==='clear'&&run.review_status!=='pending')throw Error('Therapist review can be changed only before physicist review.');
    const checks=pbsTherapistResults(run)??S.results.filter(r=>r.run_id===id&&byId('tests',r.test_id)?.name.trim().toLowerCase()==='qa reviewed by therapist?');
    if(!checks.length)throw Error('This QA has no therapist review test to change.');
    const previous={approved_by:run.therapist_approved_by,approved_at:run.therapist_approved_at,physics:{review_status:run.review_status,reviewed_by:run.reviewed_by,reviewed_at:run.reviewed_at,review_comment:run.review_comment},results:checks.map(r=>({test_id:r.test_id,status:r.status,value:r.value_num}))};
    if(decision==='pass'&&run.therapist_approved_by&&checks.every(r=>r.status==='pass'))return {ok:true};
    if(run.review_status!=='pending')Object.assign(run,{review_status:'pending',reviewed_by:null,reviewed_at:null,review_comment:null});
    checks.forEach(r=>Object.assign(r,{value_num:decision==='pass'?1:decision==='fail'?0:null,value_text:null,status:decision==='clear'?'recorded':decision}));
    Object.assign(run,{therapist_approved_by:decision==='pass'?user.id:null,therapist_approved_at:decision==='pass'?now():null,overall:resultOverall(S.results.filter(r=>r.run_id===id))});
    audit(user.id,'change_therapist_review','run',id,{previous,decision});save();return {ok:true};
  }
  function unapproveTherapistReview(user,id) {
    require(user,'therapist_approve');const run=get('runs',id);
    if(run.trashed_at||!run.therapist_approved_by)throw Error('This QA has no therapist approval to undo.');
    const previous={};for(const k of ['therapist_approved_by','therapist_approved_at','review_status','reviewed_by','reviewed_at','review_comment'])previous[k]=run[k];
    const checks=pbsTherapistResults(run)??S.results.filter(r=>r.run_id===id&&byId('tests',r.test_id)?.name.trim().toLowerCase()==='qa reviewed by therapist?');
    previous.results=checks.map(r=>({test_id:r.test_id,value:r.value_num,status:r.status}));
    checks.forEach(r=>Object.assign(r,{value_num:null,value_text:null,status:'recorded'}));
    Object.assign(run,{therapist_approved_by:null,therapist_approved_at:null,review_status:'pending',reviewed_by:null,reviewed_at:null,review_comment:null,overall:resultOverall(S.results.filter(r=>r.run_id===id))});
    audit(user.id,'unapprove_therapist_review','run',id,{previous,physics_approval_cleared:previous.review_status==='approved'});save();return {ok:true};
  }
  function unapprovePhysicsReview(user,id) {
    require(user,'review');if(user.role!=='physicist')throw Error('Only a physicist can undo physics approval.');
    const run=get('runs',id);if(run.trashed_at||run.review_status!=='approved')throw Error('This QA has no physics approval to undo.');
    const previous={};for(const k of ['review_status','reviewed_by','reviewed_at','review_comment'])previous[k]=run[k];
    Object.assign(run,{review_status:'pending',reviewed_by:null,reviewed_at:null,review_comment:null});audit(user.id,'unapprove_physics_review','run',id,{previous});save();return {ok:true};
  }
  function reviewRun(user, id, data) {
    require(user, "review");
    const r = get("runs", id);
    if(!reviewReady(r)) throw Error("PBS Daily QA Sphinx needs test 4.06 marked Pass before physicist review.");
    if(r.therapist_approval_required) {
      if(!r.therapist_approved_by) throw new Error('Therapist approval is required before medical physicist review.');
      if(user.role!=='physicist') throw new Error('This run requires review by a medical physicist.');
    }
    if (!["approved", "rejected"].includes(data.decision)) throw new Error("Decision must be approve or reject.");
    if (r.review_status !== "pending") throw new Error("This run has already been reviewed.");
    if (r.performed_by === user.id) throw new Error("Runs must be reviewed by someone other than the person who performed them.");
    const comment = text(data, "comment");
    Object.assign(r, { review_status: data.decision, reviewed_by: user.id, reviewed_at: now(), review_comment: comment });
    save();
    audit(user.id, data.decision, "run", r.id, { comment });
    return { ok: true };
  }
  function historyKey(test) {
    const semantic=test.type==='numeric'?canonicalKey(test.name):null;
    return JSON.stringify([test.type,test.unit||'',semantic||`${test.category||''}|${test.name.toLowerCase().trim()}`]);
  }
  function trend(machineId,testId) {const test=get('tests',testId,'Check');return {test,points:machineTrends(machineId)[testId]||[]};}
  function machineTrends(machineId) {
    const runs=Object.fromEntries(S.runs.filter(r=>!r.trashed_at&&r.machine_id===Number(machineId)).map(r=>[r.id,r]));
    const aliases=new Map();
    for(const q of S.queues.filter(q=>isPbsTemplate(q.name))){
      const base=S.queue_items.filter(i=>i.queue_id===q.id).map(i=>byId('tests',i.test_id));
      const ids=new Set(base.map(t=>t.id));
      for(const t of S.tests.filter(t=>t.owner_queue_id===q.id&&!ids.has(t.id))){const target=templateMatch(base,t.name);if(target)aliases.set(t.id,target);}
    }
    const keyFor=t=>historyKey(aliases.get(t.id)||t);
    const groups=new Map();
    for(const x of S.results){
      if(!runs[x.run_id] || x.value_num==null)continue;
      const test=byId('tests',x.test_id);if(!test)continue;
      const key=keyFor(test);if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({source_test_id:x.test_id,source_test_number:/Template\s+(\d+\.\d+)/.exec(test.description||'')?.[1]||null,run_id:x.run_id,source:runs[x.run_id].source,source_order:x.id,assignment_id:runs[x.run_id].assignment_id,qa_date:runs[x.run_id].qa_date,value:x.value_num,expected:x.expected,warn:x.warn,fail:x.fail,tol_mode:x.tol_mode,status:x.status});
    }
    for(const pts of groups.values())pts.sort((a,b)=>a.qa_date.localeCompare(b.qa_date)||a.run_id-b.run_id||a.source_order-b.source_order);
    const out={};for(const test of S.tests){const pts=groups.get(keyFor(test));if(pts)out[test.id]=pts;}
    return out;
  }

  // ---- Sphinx into lists --------------------------------------------------------

  function sphinxTestIds(user, t, measurements, create) {
    const inQueue = Object.fromEntries(t.items.map((i) => [`${i.category}|${i.name}`, i.test_id]));
    const byMeaning = Object.fromEntries(t.items.filter((i) => canonicalKey(i.name)).map((i) => [canonicalKey(i.name), i.test_id]));
    const excluded = (t.all_items || []).filter((i) => i.excluded);
    const isExcluded = (m) => excluded.some((i) => (i.category === m.category && i.name === m.name) || (canonicalKey(i.name) && canonicalKey(i.name) === canonicalKey(m.name)));
    const ids = {}, added = [],uniform=isPbsTemplate(t.queue.name);
    for (const m of measurements) {
      if (isExcluded(m)) continue;
      const key = `${m.category}|${m.name}`;
      if(uniform&&!inQueue[key]){const equivalent=templateMatch(t.items,m.name);if(equivalent)inQueue[key]=equivalent.test_id;}
      if (!inQueue[key] && byMeaning[canonicalKey(m.name)]) inQueue[key] = byMeaning[canonicalKey(m.name)];
      if (inQueue[key]) { ids[key] = inQueue[key]; continue; }
      if (!create || uniform) continue;
      require(user, "configure");
      const queueId = t.queue.id;
      const existing = S.tests.find((x) => x.owner_queue_id === queueId && x.category === m.category && x.name === m.name);
      const testId = existing ? existing.id : saveTest(user, { category: m.category, name: m.name, unit: m.unit, ...fileLimits(m), owner_queue_id: queueId,
        description: `Measured by Sphinx. Export label: ${m.sphinx_label}.` }).id;
      const assignment = get("assignments", t.assignment.id), selection = testSelection(assignment);
      assignment.test_selection = { ...selection, added: [...new Set([...(selection.added || []), testId])] };
      ids[key] = inQueue[key] = testId;
      added.push(m.name);
    }
    if (added.length) audit(user.id, "add_sphinx_tests", "queue", t.queue.id, { tests: added });
    return [ids, added];
  }
  async function sphinxPreview(user, assignmentId, upload) {
    require(user, "perform");
    const parsed = await parseUpload(upload);
    const t = runTemplate(assignmentId);
    if (/\.pdf$/i.test(parsed.filename) && !t.items.some(i=>(i.description||"").includes("[rule: wl-max-delta]"))) throw Error("Choose the SRS Winston-Lutz QA list for this PDF.");
    if (/truebeam/i.test(parsed.filename) && !/truebeam/i.test(t.machine.name)) throw Error("The filename identifies TrueBeam. Choose the TrueBeam machine.");
    const items = Object.fromEntries(t.items.map((i) => [`${i.category}|${i.name}`, i]));
    const byMeaning = Object.fromEntries(t.items.filter((i) => canonicalKey(i.name)).map((i) => [canonicalKey(i.name), i]));
    const matched = [], unmatched = [];
    const excluded = (t.all_items || []).filter((i) => i.excluded);
    for (const m of parsed.measurements) {
      if (excluded.some((i) => (i.category === m.category && i.name === m.name) || (canonicalKey(i.name) && canonicalKey(i.name) === canonicalKey(m.name)))) continue;
      const item = items[`${m.category}|${m.name}`] || byMeaning[canonicalKey(m.name)] || (isPbsTemplate(t.queue.name)?templateMatch(t.items,m.name):null);
      if (!item && isPbsTemplate(t.queue.name)) continue;
      if (!item) { unmatched.push({ category: m.category, name: m.name, unit: m.unit }); continue; }
      const fl = fileLimits(m);
      matched.push({ test_id: item.test_id, value: m.result, sphinx_status: m.sphinx_status, file_limits: fl,
        limits_differ: Object.keys(fl).some((k) => item.limits[k] !== fl[k]) });
    }
    const dup = S.runs.find((r) => r.source_ref === parsed.sha256);
    return { filename: parsed.filename, qa_date: parsed.qa_date, finished: parsed.finished, sphinx_user: parsed.sphinx_user, report_machine: parsed.report_machine || "",
      source_ref: parsed.sha256, duplicate_run: dup ? dup.id : null, matched, unmatched };
  }
  async function sphinxAddTests(user, assignmentId, upload) {
    require(user, "configure");
    const parsed = await parseUpload(upload);
    const [, added] = sphinxTestIds(user, runTemplate(assignmentId), parsed.measurements, true);
    return { added };
  }
  async function importSphinx(user, assignmentId, data) {
    require(user, "configure");
    const uploads = data.files || [];
    if (!uploads.length) throw new Error("Choose one or more Sphinx .xls files.");
    const historical = data.historical !== false;
    let t = runTemplate(assignmentId);
    const imported = [], skipped = [];
    for (const u of uploads) {
      let parsed, ids, added;
      try {
        parsed = await parseUpload(u);
        checkNotImported(parsed.sha256);
        if (/\.pdf$/i.test(parsed.filename) && !t.items.some(i=>(i.description||'').includes('[rule: wl-max-delta]'))) throw Error('Choose the SRS Winston-Lutz QA list for this PDF.');
        if (/truebeam/i.test(parsed.filename) && !/truebeam/i.test(t.machine.name)) throw Error('The filename identifies TrueBeam. Choose the TrueBeam machine.');
        [ids, added] = sphinxTestIds(user, t, parsed.measurements, true);
      } catch (err) {
        skipped.push({ file: u.name, reason: err.message.replace(`${u.name}: `, "") });
        continue;
      }
      if (added.length) t = runTemplate(assignmentId);
      const rows = parsed.measurements.filter((m) => ids[`${m.category}|${m.name}`]).map((m) => {
        const limits = fileLimits(m);
        let ours;
        try { ours = evaluate("numeric", m.result, limits); } catch { ours = "recorded"; }
        const status = SPHINX_STATUS[m.sphinx_status] || ours;
        return { test_id: ids[`${m.category}|${m.name}`], value_num: m.result, value_text: null, limits, status,
          comment: status !== ours ? `Sphinx: ${m.sphinx_status}; portal rule on the rounded values gives ${ours}.` : "" };
      });
      if (!rows.length) { skipped.push({ file: u.name, reason: "No included tests match this machine's list." }); continue; }
      const comment = `Imported from ${parsed.filename}. Sphinx finished ${parsed.finished.replace("T", " ")}${parsed.sphinx_user ? " by " + parsed.sphinx_user : ""}.`;
      const run = insertRun(user, t, parsed.qa_date, rows, comment, "sphinx", parsed.sha256, historical ? "imported" : "pending");
      imported.push({ file: parsed.filename, run_id: run.id, qa_date: parsed.qa_date, overall: run.overall });
    }
    return { imported, skipped };
  }

  // ---- seed ---------------------------------------------------------------------

  function seed() {
    // seed-data.js: one daily template per machine type, and the machines that get a copy of each.
    // (An older seed with a single {setup, checks} is still accepted.)
    const sys = { id: 0, role: "admin" };
    const seedData = window.PORTAL_SEED || {};
    const templates = seedData.templates || [{ name: "Daily QA template", kind: "Proton gantry", setup: seedData.setup || "", checks: seedData.checks || [] }];
    const machines = seedData.machines || ["GTR1", "GTR2", "GTR5"].map((name) => ({ name, kind: "Proton gantry" }));
    const byKind = {};
    for (const tpl of templates) {
      const templateId = insert("queues", { name: tpl.name, description: tpl.setup || "", active: 1, is_template: 1, template_id: null });
      (byKind[tpl.kind] = byKind[tpl.kind] || []).push({ ...tpl, id: templateId });
      (tpl.checks || []).forEach((c, position) => {
        const id = insert("tests", { name: c.name, category: c.category, type: c.type, unit: c.unit || "", description: c.description || "",
          expected: c.expected ?? null, warn: c.warn ?? null, fail: c.fail ?? null, tol_mode: c.tol_mode || "absolute", active: 1, owner_queue_id: templateId });
        insert("queue_items", { queue_id: templateId, test_id: id, position, expected: null, warn: null, fail: null, tol_mode: null });
      });
    }
    for (const m of machines) {
      const machineId = insert("machines", { name: m.name, kind: m.kind || "", location: m.location || "", notes: m.notes || "", active: 1, created_at: now() });
      for (const tpl of byKind[m.kind] || []) {
        try {
          // The same list on every machine of its kind (no per-machine copies).
          saveAssignment({ ...sys, role: "admin" }, { machine_id: machineId, queue_id: tpl.id, frequency: tpl.frequency || "daily", weekdays: m.weekdays || [0, 1, 2, 3, 4] });
        } catch (err) {
          console.error(err);
        }
      }
    }
    audit(null, "seed", "portal", null, { templates: templates.map((t) => t.name), machines: machines.map((m) => m.name) });
  }

  // ---- router -------------------------------------------------------------------

  const ready = (async () => {
    let fromFile = null;
    try { fromFile = await readDbFile(); } catch (err) { console.error(err); }
    const stored = await readState();
    if (fromFile) S = fromFile;
    else if (stored) S = stored;
    else { seed(); save(); }
    await setupDemoAccounts();
    if (!S.demoMpaAccountV1) {
      let user = S.users.find(u => u.username.toLowerCase() === 'mpa');
      if (!user) user = byId('users', insert('users', {username:'MPA', full_name:'MPA', role:'mpa', active:1, created_at:now()}));
      if (!user.password_salt) { user.role = 'mpa'; user.active = 1; await setPassword(user, 'MPA'); }
      S.demoMpaAccountV1 = true;
      save();
    }
    upgradeCtList();
    upgradeBbUnits();
    dropSphinxCouch();
    renameSphinxTests();
    refreshTemplates();
    addSeedMachines();
    if (!S.retiredLinac1) {
      const old=S.machines.find((m)=>m.name==="Linac 1" || m.name==="Linac 1 Synergy");
      if(old){old.active=0;audit(null,"retire","machine",old.id,{name:old.name,reason:"Removed from active list at user request"});}
      S.retiredLinac1=true;save();
    }
    spellOutNames();
    reassignSphinx();
    retireSplitEyelineLists();
    instantiateSeedTemplates();
    mergeCopies();
    restoreMonthlySchedules();
    generalizePbsTemplates();
    applyImagingDefaults();
    installDepartmentTemplates();
    installSrsWinstonLutz();
    expandWinstonLutzFields();
    for(const q of S.queues.filter(q=>q.name==='SRS QA template – TrueBeam (Dose Pro)'))for(const qi of S.queue_items.filter(i=>i.queue_id===q.id)){
      const t=get('tests',qi.test_id,'Check');const number={'Maximum total delta':'1.02','Mean total delta':'1.03'}[t.name];
      if(number&&t.description.startsWith('Template '+number+'.')&&t.category==='Winston-Lutz'&&t.type==='numeric'&&t.unit==='mm'&&t.expected==null&&t.warn==null&&t.fail==null){t.expected=0;save();}
    }
    installRequestedDashboardSchedules();
    installDerivedCalculations();
    unifyPbsSelections();
    for (const run of S.runs) if (run.review_status === 'pending' && S.results.some(res => res.run_id === run.id && /therapist/i.test((byId('tests',res.test_id)||{}).name||'') && /review|approv/i.test((byId('tests',res.test_id)||{}).name||''))) run.therapist_approval_required = true;
  })();

  function unifyPbsSelections(){
    for(const q of S.queues.filter(q=>isPbsTemplate(q.name))){
      const items=S.queue_items.filter(i=>i.queue_id===q.id).map(i=>byId('tests',i.test_id));
      for(const a of S.assignments.filter(a=>a.queue_id===q.id)){
        const selection=testSelection(a);if(selection.uniform_g5_v1)continue;
        for(const tid of selection.added||[]){
          const old=byId('tests',tid),target=old&&templateMatch(items,old.name);
          const override=S.overrides.find(o=>o.assignment_id===a.id&&o.test_id===tid);
          if(target&&override&&!S.overrides.some(o=>o.assignment_id===a.id&&o.test_id===target.id))override.test_id=target.id;
        }
        a.test_selection={...selection,added:[],excluded:[],uniform_g5_v1:true};
        audit(null,'unify_pbs_template','assignment',a.id,{source:'G5 shared template',preserve_historical_results:true});save();
      }
    }
  }

  function installDerivedCalculations(){
    let changed=0;
    for(const q of S.queues){const tpl=PORTAL_SEED.templates.find(t=>t.name===q.name);if(!tpl)continue;const prior=[];
      for(const qi of S.queue_items.filter(x=>x.queue_id===q.id).sort((a,b)=>a.position-b.position)){const t=get('tests',qi.test_id,'Check');const seed=tpl.checks.find(x=>x.name===t.name&&x.category===t.category);if(seed?.type==='choice'&&seed.description.includes('[device:')&&t.type==='text'){t.type='choice';t.description+=' '+/\[device: [^\]]+\]/.exec(seed.description)[0]+' '+/\[choices: [^\]]+\]/.exec(seed.description)[0];changed++;}const rule=seed&&QADerived.read(seed.description);
        if(rule&&!QADerived.read(t.description)&&(/\[calc:/.test(t.description||'')||t.category==='HDR treatment-day QA'||rule.kind==='lookup')){try{QADerived.resolve(rule,prior);t.description=QADerived.encode(t.description,rule);changed++;}catch{/* Customized lists need explicit input selection. */}}
        prior.push(t);
      }
    }
    if(changed){audit(null,'install_derived_calculations','test',null,{count:changed});save();}
  }

  function installRequestedDashboardSchedules() {
    if(S.requestedDashboardSchedules20261026)return;
    for(const machine of S.machines){
      const hdr=/HDR.*Flex/i.test(machine.name),tb=/^TrueBeam$/i.test(machine.name);
      if(!hdr&&!tb)continue;
      for(const queue of S.queues.filter(q=>q.active && (tb ? /monthly/i.test(q.name)&&/truebeam/i.test(q.name) : /HDR.*Flex/i.test(q.name)&&/Daily QA|Source Exchange/i.test(q.name)))){
        let a=S.assignments.find(a=>a.machine_id===machine.id&&a.queue_id===queue.id);
        if(a&&testSelection(a).archived)continue;
        const frequency=tb?'monthly':'asneeded';
        if(!a){const result=saveAssignment({id:null,role:'admin'},{machine_id:machine.id,queue_id:queue.id,frequency,weekdays:[0,1,2,3,4],active:1});a=byId('assignments',result.id);}
        if(a){Object.assign(a,{frequency,active:1,interval_days:null});machine.active=1;audit(null,'requested_dashboard_schedule','assignment',a.id,{frequency,source:'2026-10-26 user request'});}
      }
    }
    S.requestedDashboardSchedules20261026=true;save();
  }

  function installSrsWinstonLutz() {
    const tpl=window.PORTAL_SEED.templates.find(t=>t.name==='SRS QA template – TrueBeam (Dose Pro)');
    for (const q of S.queues.filter(q=>q.name===tpl.name)) {
      const items=S.queue_items.filter(i=>i.queue_id===q.id);
      if (items.length!==5 || !items.every(i=>window.PORTAL_SEED.srs_placeholder_names.includes(byId('tests',i.test_id)?.name))) continue;
      S.queue_items=S.queue_items.filter(i=>i.queue_id!==q.id);
      tpl.checks.forEach((c,position)=>{const id=insert('tests',{...c,tol_mode:'absolute',active:1,owner_queue_id:q.id});insert('queue_items',{queue_id:q.id,test_id:id,position,expected:null,warn:null,fail:null,tol_mode:null});});
      q.description=tpl.setup;audit(null,'install_winston_lutz','queue',q.id,{rule:'Maximum delta < 1 mm'});save();
    }
  }

  function expandWinstonLutzFields() {
    S.wlExpandedFieldsV1 ||= {};
    const tpl=window.PORTAL_SEED.templates.find(t=>t.name==='SRS QA template – TrueBeam (Dose Pro)');
    for(const q of S.queues.filter(q=>q.name===tpl.name)){
      if(S.wlExpandedFieldsV1[q.id])continue;
      const items=S.queue_items.filter(i=>i.queue_id===q.id).map(i=>byId('tests',i.test_id));
      if(!items.some(t=>t?.name==='Maximum delta'&&t.category==='Winston-Lutz'))continue;
      let position=Math.max(0,...S.queue_items.filter(i=>i.queue_id===q.id).map(i=>i.position));
      for(const c of tpl.checks.slice(3)){
        if(items.some(t=>t?.name===c.name&&t.category===c.category))continue;
        const id=insert('tests',{...c,tol_mode:'absolute',active:1,owner_queue_id:q.id});
        insert('queue_items',{queue_id:q.id,test_id:id,position:++position,expected:null,warn:null,fail:null,tol_mode:null});
      }
      q.description=tpl.setup;S.wlExpandedFieldsV1[q.id]=true;save();
    }
  }

  function installDepartmentTemplates() {
    S.departmentTemplates = S.departmentTemplates || {};
    for (const tpl of (window.PORTAL_SEED.templates || []).filter(t=>t.departmental_id)) {
      if (S.departmentTemplates[tpl.departmental_id] || !S.machines.some(m=>m.name===tpl.install_machine)) continue;
      let q=S.queues.find(q=>q.name.toLowerCase()===tpl.name.toLowerCase());
      if (q && (S.queue_items.some(i=>i.queue_id===q.id) || S.tests.some(t=>t.owner_queue_id===q.id))) { S.departmentTemplates[tpl.departmental_id]=true; save(); continue; }
      if (!q) q=byId('queues',insert('queues',{name:tpl.name,description:tpl.setup,active:1,is_template:1,template_id:null}));
      q.description=tpl.setup;
      tpl.checks.forEach((c,position)=>{
        const id=insert('tests',{...c,unit:c.unit||'',expected:c.expected??null,warn:c.warn??null,fail:c.fail??null,tol_mode:c.tol_mode||'absolute',active:1,owner_queue_id:q.id});
        insert('queue_items',{queue_id:q.id,test_id:id,position,expected:null,warn:null,fail:null,tol_mode:null});
      });
      const machine=S.machines.find(m=>m.name===tpl.install_machine);
      if (machine && !S.assignments.some(a=>a.machine_id===machine.id&&a.queue_id===q.id)) saveAssignment({id:null,role:'admin'},{machine_id:machine.id,queue_id:q.id,frequency:tpl.frequency,weekdays:[0,1,2,3,4]});
      S.departmentTemplates[tpl.departmental_id]=true;
      audit(null,'install_department_template','queue',q.id,{source:tpl.departmental_id,tests:tpl.checks.length});save();
    }
  }

  function applyImagingDefaults() {
    S.pbsImagingDefaultsV1 = S.pbsImagingDefaultsV1 || {};
    const ids = new Set(S.queues.filter(q => /PBS\s*DailyQA/i.test(q.name)).map(q=>q.id));
    for (const t of S.tests) {
      if (S.pbsImagingDefaultsV1[t.id] || !(ids.has(t.owner_queue_id) || S.queue_items.some(i=>i.test_id===t.id && ids.has(i.queue_id)))) continue;
      const rule = (window.PORTAL_SEED.pbs_imaging_defaults || []).find(r=>r.name===t.name && r.unit===t.unit && t.type==='numeric' && (t.tol_mode || 'absolute')==='absolute');
      if (!rule) continue;
      const changed = {};
      for (const key of ['expected','warn','fail']) if (t[key] == null) { t[key]=rule[key]; changed[key]=rule[key]; }
      S.pbsImagingDefaultsV1[t.id] = true;
      audit(null,'apply_imaging_defaults','test',t.id,{source:window.PORTAL_SEED.pbs_tolerance_source,row:rule.source_row,changed});
      save();
    }
  }

  function generalizePbsTemplates() {
    const clean = value => String(value || '').replace(/\bGTR\s*\d+[ _-]*/gi, '').trim();
    const queues = S.queues.filter(q => /PBS\s*DailyQA/i.test(q.name));
    const queueIds = new Set(queues.map(q => q.id));
    const testIds = new Set(S.queue_items.filter(i => queueIds.has(i.queue_id)).map(i => i.test_id));
    const rules = (window.PORTAL_SEED.pbs_tolerances || []);
    S.pbsWorkbookAppliedIds = S.pbsWorkbookAppliedIds || {};
    let changed = false;
    for (const q of queues) for (const field of ['name','description']) {
      const text = clean(q[field]); if (text !== q[field]) { q[field] = text; changed = true; }
    }
    for (const t of S.tests.filter(t => testIds.has(t.id) || queueIds.has(t.owner_queue_id))) {
      for (const field of ['name','description','category']) {
        const text = clean(t[field]); if (text !== t[field]) { t[field] = text; changed = true; }
      }
      if (S.pbsWorkbookAppliedIds[t.id]) continue;
      const rule = rules.find(r => r.key === canonicalKey(t.name) && (r.unit || '') === (t.unit || ''));
      if (rule) {
        const before = {warn:t.warn,fail:t.fail,tol_mode:t.tol_mode};
        t.warn = rule.warn; t.fail = rule.fail; t.tol_mode = rule.tol_mode;
        S.pbsWorkbookAppliedIds[t.id] = true;
        audit(null, 'apply_workbook_tolerances', 'test', t.id, {source:window.PORTAL_SEED.pbs_tolerance_source,row:rule.source_row,before,after:{warn:t.warn,fail:t.fail,tol_mode:t.tol_mode}});
        changed = true;
      }
    }
    if (changed) { audit(null,'generalize','queue',null,{reason:'Shared PBS template labels and matching workbook tolerances'}); save(); }
  }

  // An earlier Sphinx step switched off every other list on the proton gantries, monthly QA included; it now only
  // touches other daily lists. Switch those monthly schedules back on once.
  function restoreMonthlySchedules() {
    if (S.monthlyRestored) return;
    let n = 0;
    for (const a of S.assignments) {
      const q = byId("queues", a.queue_id);
      if (q && /Monthly QA/.test(q.name) && a.frequency === "monthly" && !a.active && !testSelection(a).archived) { a.active = 1; n++; }
    }
    S.monthlyRestored = true;
    if (n) audit(null, "upgrade", "assignments", null, { monthly_reactivated: n });
    save();
  }

  // Schedule a list on a machine unless that machine already runs it (or an old copy of it).
  function scheduleOn(user, list, machine, opts) {
    const has = S.assignments.some((a) => a.machine_id === machine.id && (a.queue_id === list.id || (byId("queues", a.queue_id) || {}).template_id === list.id));
    if (has) return false;
    saveAssignment(user, { machine_id: machine.id, queue_id: list.id, frequency: opts.frequency || "daily", weekdays: [0, 1, 2, 3, 4], import_folder: opts.import_folder || "" });
    return true;
  }

  // One QA list object (mirrors service.merge_copies): each per-machine copy with the same tests as the list it came from
  // is folded back into it (schedules, runs, results, drafts; differing limits become that machine's own values).
  function mergeCopies() {
    const itemsOf = (qid) => S.queue_items.filter((i) => i.queue_id === qid).sort((a, b) => a.position - b.position);
    const key = (i) => { const t = byId("tests", i.test_id) || {}; return `${t.name}\u0001${t.type}`; };
    const merged = [];
    let touched = false;
    for (const copy of S.queues.filter((q) => q.template_id && !q.is_template)) {
      const source = byId("queues", copy.template_id);
      const mine = itemsOf(copy.id), theirs = source ? itemsOf(source.id) : [];
      const schedules = S.assignments.filter((a) => a.queue_id === copy.id);
      const same = !!source && mine.length === theirs.length && mine.every((i, k) => key(i) === key(theirs[k]));
      const clash = !!source && schedules.some((a) => S.assignments.some((b) => b.queue_id === source.id && b.machine_id === a.machine_id));
      touched = true;
      if (!same || clash) { copy.template_id = null; continue; }
      const pair = new Map(mine.map((i, k) => [i.test_id, theirs[k].test_id]));
      const sids = new Set(schedules.map((a) => a.id));
      for (const o of S.overrides) if (sids.has(o.assignment_id) && pair.has(o.test_id)) o.test_id = pair.get(o.test_id);
      mine.forEach((i, k) => {
        const own = resolveLimits(byId("tests", i.test_id), i), shared = resolveLimits(byId("tests", theirs[k].test_id), theirs[k]);
        if (["expected", "warn", "fail", "tol_mode"].every((f) => (own[f] ?? null) === (shared[f] ?? null))) return;
        for (const a of schedules) if (!S.overrides.some((o) => o.assignment_id === a.id && o.test_id === theirs[k].test_id)) {
          S.overrides.push({ assignment_id: a.id, test_id: theirs[k].test_id, expected: own.expected, warn: own.warn, fail: own.fail, tol_mode: own.tol_mode });
        }
      });
      for (const r of S.results) if (pair.has(r.test_id)) r.test_id = pair.get(r.test_id);
      const withResults = new Set(S.results.map((r) => r.test_id));
      for (const t of S.tests.filter((x) => x.owner_queue_id === copy.id && !pair.has(x.id))) {
        if (!withResults.has(t.id)) { S.tests = S.tests.filter((x) => x !== t); continue; }
        const twin = S.tests.find((x) => x.owner_queue_id === source.id && x.name === t.name && x.category === t.category);
        const runsOf = (id) => new Set(S.results.filter((r) => r.test_id === id).map((r) => r.run_id));
        const overlap = twin && [...runsOf(t.id)].some((rid) => runsOf(twin.id).has(rid));
        if (twin && !overlap) { for (const r of S.results) if (r.test_id === t.id) r.test_id = twin.id; S.tests = S.tests.filter((x) => x !== t); }
        else { if (twin) t.name = `${t.name} (${copy.name})`; t.owner_queue_id = source.id; }
      }
      for (const r of S.runs) if (r.queue_id === copy.id) r.queue_id = source.id;
      for (const a of schedules) a.queue_id = source.id;
      for (const d of S.drafts || []) if (sids.has(d.assignment_id)) for (const r of (d.data && d.data.results) || []) if (pair.has(Number(r.test_id))) r.test_id = pair.get(Number(r.test_id));
      S.queue_items = S.queue_items.filter((i) => i.queue_id !== copy.id);
      const stillUsed = new Set(S.results.map((r) => r.test_id));
      S.tests = S.tests.filter((x) => !(x.owner_queue_id === copy.id && !stillUsed.has(x.id)));
      for (const q of S.queues) if (q.template_id === copy.id) q.template_id = null;
      S.queues = S.queues.filter((q) => q !== copy);
      merged.push(copy.name);
    }
    if (merged.length) audit(null, "merge", "queues", null, { merged });
    if (touched) save();
  }

  // The three separate Eyeline lists became one "Eyeline Daily QA"; drop the split ones where nothing was recorded on them.
  function retireSplitEyelineLists() {
    const names = ["Eyeline Daily QA – Dosimetry: PDD template", "Eyeline Daily QA – Dosimetry: Output template", "Eyeline Daily QA – Imaging template"];
    let gone = 0;
    for (const tpl of S.queues.filter((q) => q.is_template && names.includes(q.name))) {
      for (const q of [...S.queues.filter((x) => x.template_id === tpl.id), tpl]) {
        const own = S.tests.filter((t) => t.owner_queue_id === q.id).map((t) => t.id);
        if (S.results.some((r) => own.includes(r.test_id))) continue;
        S.assignments = S.assignments.filter((a) => a.queue_id !== q.id);
        S.drafts = (S.drafts || []).filter((d) => S.assignments.some((a) => a.id === d.assignment_id));
        S.queue_items = S.queue_items.filter((i) => i.queue_id !== q.id);
        S.tests = S.tests.filter((t) => t.owner_queue_id !== q.id);
        S.queues = S.queues.filter((x) => x.id !== q.id);
        gone++;
      }
    }
    if (gone) { audit(null, "upgrade", "queues", null, { retired: gone }); save(); }
  }

  // Templates added to the starting data later (e.g. the Eyeline lists) get their machine instance once, as a fresh seed would.
  function instantiateSeedTemplates() {
    const admin = S.users.find((u) => u.role === "admin") || S.users[0];
    let made = 0;
    for (const t of (window.PORTAL_SEED || {}).templates || []) {
      if (!t.kind) continue;
      const tpl = S.queues.find((q) => q.is_template && q.name === t.name);
      if (!tpl) continue;
      for (const m of S.machines.filter((x) => x.kind === t.kind && x.active)) {
        const name = `${t.list || "Daily QA"} – ${m.name}`;
        if (S.queues.some((q) => q.name === name)) continue;   // an older copy (merged or kept as its own list)
        if (scheduleOn(admin, tpl, m, { frequency: t.frequency || "daily" })) made++;
      }
    }
    if (made) { audit(null, "upgrade", "queues", null, { instantiated: made }); save(); }
  }

  // "Distal Fall Off" spelled out and the GTR5_ prefix dropped from measurement names (mirrors the starting data).
  // RadMachine transcription notes -> the action itself (markers drive the Perform page) or nothing.
  const NOTE_REWRITES = [
      ["Reference and limits from the Sphinx reference sheet (2026-10-22).", ""],
      ["A choice list in RadMachine.", ""],
      ["Filled automatically in RadMachine.", "[auto: user]"],
      ["[auto: user] Filled in with the signed-in user.", "[auto: user]"],
      ["Calculated in RadMachine (3D offset from X, Y, Z).", "[calc: 3d-offset] Calculated here: √(X² + Y² + Z²) from the three offsets above."],
      ["Calculated in RadMachine (3D offset).", "[calc: 3d-offset] Calculated here: √(X² + Y² + Z²) from the three offsets above."],
      ["Calculated in RadMachine from temperature and pressure.", "[calc: ktp] Calculated here: kTP = (273.15 + T) / (273.15 + 22) × 101.325 / P, with T in °C and P in kPa (TG-51 reference conditions 22 °C, 101.325 kPa — physicist to confirm)."],
      ["Calculated in RadMachine (chamber x electrometer factor).", "[calc: product] Calculated here: chamber calibration factor × electrometer calibration factor."],
      ["Calculated in RadMachine from charge, calibration and temperature-pressure correction.", "[calc: dose] Calculated here: dose [cGy] = charge [nC] × 10⁻⁹ × overall calibration factor [Gy/C] × kTP × 100 (physicist to confirm the formula matches RadMachine)."],
      ["Load the Sphinx export with 'Sphinx file' at the top of this page; it fills the values below.", "Load the Sphinx export in the Measurement file step above; it fills in every Sphinx value."],
  ];
  function spellOutNames() {
    let n = 0;
    for (const t of S.tests) if (t.name === "QA Performed By:" && !/\[auto: performer\]/.test(t.description || "")) { t.description = `${t.description || ""} [auto: performer]`.trim(); n++; }
    // Sphinx list: the file-name item is gone (the file is chosen in the Measurement file step) and the acquisition
    // date/time is filled from the export; numbering in section 3 closes up.
    for (const q of S.queues) {
      const items = S.queue_items.filter((i) => i.queue_id === q.id).sort((a, b) => a.position - b.position);
      let touched = false;
      for (const i of items) {
        const t = byId("tests", i.test_id);
        if (!t) continue;
        if (t.name === "File_GTR5_Sphinx_DQA_Results" && !S.results.some((r) => r.test_id === t.id)) {
          S.queue_items = S.queue_items.filter((x) => x !== i); S.tests = S.tests.filter((x) => x.id !== t.id); touched = true; n++;
        } else if (t.name === "DailyQA_Sphinx_GTR5: Acquisition Date and Time") {
          t.name = "Sphinx acquisition date and time"; t.description = (t.description || "").replace("From the Sphinx export.", "[auto: sphinx-finished] Filled in from the Sphinx export file."); touched = true; n++;
        }
      }
      if (touched) {
        const count = {};
        for (const i of S.queue_items.filter((x) => x.queue_id === q.id).sort((a, b) => a.position - b.position)) {
          const t = byId("tests", i.test_id); const m = /^Template (\d+)\.(\d+)\./.exec(t && t.description || "");
          if (!m) continue;
          count[m[1]] = (count[m[1]] || 0) + 1;
          t.description = `Template ${m[1]}.${String(count[m[1]]).padStart(2, "0")}.` + t.description.slice(m[0].length);
        }
      }
    }
    const old = S.queues.find((q) => q.is_template && q.name === "PBS DailyQA GTR5 - Sphinx");
    if (old) { old.name = "PBS DailyQA Template - Sphinx"; n++; }
    for (const t of S.tests) {
      const name = t.name.replace(/^GTR5_(Energy|Field|Isocenter|Daily output|Beam)/, "$1").replace("Distal FallOff", "Distal Fall Off").replace("– DFO", "– Distal Fall Off");
      if (name !== t.name) { t.name = name; n++; }
      let d = (t.description || "").replace(/\s*Reference: Yes\.?/g, "").trimEnd();   // "Reference: Yes" is not a direction
      for (const [o, nw] of NOTE_REWRITES) d = d.split(o).join(nw).trimEnd();            // transcription notes become actions
      d = d.replace(/\s*Calculated here:.*$/, "").replace(/\s*Filled in from the Sphinx export file\.?/, "").replace(/\s*Load the Sphinx export in the Measurement file step above; it fills in every Sphinx value\.?/, "").trimEnd();
      if (d !== (t.description || "")) { t.description = d; n++; }
    }
    if (n) { audit(null, "upgrade", "tests", null, { renamed: n }); save(); }
  }

  // The Sphinx list is the proton daily list: one instance per proton gantry, and the TG-224 instances come off the schedule.
  function reassignSphinx() {
    if (S.sphinxAssigned) return;
    const tpl = S.queues.find((q) => q.is_template && q.name === "PBS DailyQA Template - Sphinx");
    if (!tpl) return;
    const admin = S.users.find((u) => u.role === "admin") || S.users[0];
    for (const m of S.machines.filter((x) => x.kind === "Proton gantry")) {
      let folder = "";
      for (const a of S.assignments.filter((x) => x.machine_id === m.id && x.active)) {
        const q = byId("queues", a.queue_id);
        if (!q || q.id === tpl.id || q.template_id === tpl.id || a.frequency !== "daily") continue;   // only the other daily lists step aside
        folder = folder || a.import_folder || "";
        a.active = 0;
        a.import_folder = "";
      }
      const name = `PBS Daily QA (Sphinx) – ${m.name}`;
      if (S.queues.some((q) => q.name === name)) continue;
      scheduleOn(admin, tpl, m, { frequency: "daily", import_folder: folder });
    }
    S.sphinxAssigned = true;
    audit(null, "upgrade", "assignments", null, { sphinx: "assigned to proton gantries" });
    save();
  }

  // Machines added to the starting data later (e.g. Linac 1 Synergy, Ethos) appear in browsers seeded before them.
  function addSeedMachines() {
    let added = 0;
    const renamed = S.machines.find((x) => x.name === "Linac 1 Synergy");
    if (renamed) { renamed.name = "Linac 1"; added++; }
    for (const m of (window.PORTAL_SEED || {}).machines || []) {
      if ((S.deletedSeedMachines || []).includes(m.name)) continue;
      if (S.machines.some((x) => x.name === m.name)) continue;
      if (m.name === "Big Bore CT (7064)" && S.machines.some((x) => x.name === "CT Sim")) continue;
      insert("machines", { name: m.name, kind: m.kind || "", location: m.location || "", notes: m.notes || "", active: 1, created_at: now() });
      added++;
    }
    if (added) { audit(null, "upgrade", "machines", null, { added }); save(); }
  }

  // Templates follow the starting data (e.g. the proton template now matches the myQA TG-224 outline exactly).
  // Only templates are refreshed; machine-specific lists are separate copies and are left alone.
  function refreshTemplates() {
    const seedTemplates = (window.PORTAL_SEED || {}).templates || [];
    let changed = 0;
    for (const t of seedTemplates) {
      let q = S.queues.find((x) => x.is_template && x.name === t.name);
      if (!q) {
        // A template added to the starting data later (e.g. PBS DailyQA Template - Sphinx): create it once.
        S.seededTemplates = S.seededTemplates || S.queues.filter((x) => x.is_template).map((x) => x.name);
        if (S.seededTemplates.includes(t.name)) continue;   // it was here before and someone deleted it: leave it gone
        const id = insert("queues", { name: t.name, description: t.setup || "", active: 1, is_template: 1, template_id: null });
        S.seededTemplates.push(t.name);
        q = byId("queues", id);
      }
      const items = S.queue_items.filter((i) => i.queue_id === q.id).sort((a, b) => a.position - b.position).map((i) => byId("tests", i.test_id));
      const seedKey = JSON.stringify([t.setup || "", t.checks]);
      S.seedApplied = S.seedApplied || {};
      if (S.seedApplied[t.name] === seedKey) continue;     // already applied: later edits to this shared list are kept
      const same = items.length === t.checks.length && items.every((x, k) => x && x.name === t.checks[k].name && (x.description || "") === (t.checks[k].description || "") && (x.unit || "") === (t.checks[k].unit || ""));
      let previous=null;try{previous=JSON.parse(S.seedApplied[t.name]||'null')?.[1];}catch{}
      const matches=(checks)=>Array.isArray(checks)&&items.length===checks.length&&items.every((x,k)=>x&&['name','category','type','unit','description','expected','warn','fail'].every(f=>(x[f]??(f==='unit'||f==='description'?'':null))===(checks[k][f]??(f==='unit'||f==='description'?'':null))));
      const srsPlaceholder=t.name==='SRS QA template – TrueBeam (Dose Pro)'&&items.length===5&&items.every(x=>(window.PORTAL_SEED.srs_placeholder_names||[]).includes(x?.name));
      // A seed revision must never replace a locally customized shared template.
      if (!same && items.length && !matches(previous) && !srsPlaceholder) { S.seedApplied[t.name]=seedKey; continue; }
      S.seedApplied[t.name] = seedKey;
      if (same) continue;
      const old = new Set(items.map((x) => x && x.id));
      S.queue_items = S.queue_items.filter((i) => i.queue_id !== q.id);
      S.tests = S.tests.filter((x) => !(old.has(x.id) && x.owner_queue_id === q.id && !S.results.some((r) => r.test_id === x.id)));
      t.checks.forEach((c, position) => {
        const id = insert("tests", { name: c.name, category: c.category, type: c.type, unit: c.unit || "", description: c.description || "",
          expected: c.expected ?? null, warn: c.warn ?? null, fail: c.fail ?? null, tol_mode: c.tol_mode || "absolute", active: 1, owner_queue_id: q.id });
        insert("queue_items", { queue_id: q.id, test_id: id, position, expected: null, warn: null, fail: null, tol_mode: null });
      });
      q.description = t.setup || q.description;
      changed++;
    }
    if (changed) { audit(null, "update", "templates", null, { refreshed: changed }); save(); }
  }

  // Sphinx tests take the template naming ("Spot 1 [225 MeV] – Sigma X"); rebuild names from each test's export label.
  function renameSphinxTests() {
    let renamed = 0;
    for (const q of S.queues) {
      const rows = S.queue_items.filter((i) => i.queue_id === q.id).sort((a, b) => a.position - b.position)
        .map((i) => byId("tests", i.test_id)).filter((t) => t && /^Measured by Sphinx/.test(t.description || ""));
      const spotOrder = new Map();
      const parsed = [];
      for (const t of rows) {
        const m = /Export label: (.*)\.$/.exec(t.description);
        if (!m) continue;
        const cut = m[1].lastIndexOf(" – ");
        const item = cut >= 0 ? m[1].slice(0, cut) : t.category;
        const metric = cut >= 0 ? m[1].slice(cut + 3) : m[1];
        if (t.category === "Spot" && !spotOrder.has(item)) {
          const n = /^Spot\s+(\d+)/.exec(item);
          spotOrder.set(item, n ? Number(n[1]) : spotOrder.size + 1);
        }
        parsed.push([t, item, metric]);
      }
      for (const [t, item, metric] of parsed) {
        const name = standardName(t.category, item, metric, t.category === "Spot" ? spotOrder.get(item) : null);
        if (name !== t.name) { t.name = name; renamed++; }
      }
    }
    if (renamed) { audit(null, "rename", "tests", null, { reason: "Template naming", tests: renamed }); save(); }
  }

  // Couch translation is documented in RadMachine, not imported from Sphinx: take any Sphinx-imported couch
  // tests off their lists (their stored values are kept).
  function dropSphinxCouch() {
    const ids = new Set(S.tests.filter((t) => t.category === "Couch Translation" && /^Measured by Sphinx/.test(t.description || "")).map((t) => t.id));
    const before = S.queue_items.length;
    S.queue_items = S.queue_items.filter((i) => !ids.has(i.test_id));
    if (S.queue_items.length !== before) { audit(null, "remove_from_list", "tests", null, { reason: "Couch translation is documented in RadMachine" }); save(); }
  }

  // CT BB geometry tests came in without a unit; they are millimetres.
  function upgradeBbUnits() {
    let changed = 0;
    for (const t of S.tests) if (/\(BB\)$/.test(t.name) && !t.unit) { t.unit = "mm"; changed++; }
    for (const t of S.tests) if (t.unit === "unitless") { t.unit = ""; changed++; }   // a blank unit, not the word
    for (const t of S.tests) if (t.type === "numeric" && !t.unit && /^(Mechanical|CBCT kv\/MV) – /.test(t.name)) { t.unit = "mm"; changed++; }
    if (changed) { audit(null, "upgrade", "tests", null, { unit: "mm", tests: changed }); save(); }
  }

  // 2026-10-22: the CT simulator became "Big Bore CT (7064)" running "Bigbore CT Daily" (the RadMachine list).
  // Browsers seeded earlier still hold the old placeholder; swap it in place, but only if no CT results exist.
  function upgradeCtList() {
    const machine = S.machines.find((m) => m.name === "CT Sim");
    const seedTpl = ((window.PORTAL_SEED || {}).templates || []).find((t) => t.kind === "CT simulator");
    if (!machine || !seedTpl || S.runs.some((r) => r.machine_id === machine.id)) return;
    const replaceTests = (queueId) => {
      const old = new Set(S.queue_items.filter((i) => i.queue_id === queueId).map((i) => i.test_id));
      S.queue_items = S.queue_items.filter((i) => i.queue_id !== queueId);
      S.tests = S.tests.filter((t) => !(old.has(t.id) && t.owner_queue_id === queueId));
      seedTpl.checks.forEach((c, position) => {
        const id = insert("tests", { name: c.name, category: c.category, type: c.type, unit: c.unit || "", description: c.description || "",
          expected: c.expected ?? null, warn: c.warn ?? null, fail: c.fail ?? null, tol_mode: c.tol_mode || "absolute", active: 1, owner_queue_id: queueId });
        insert("queue_items", { queue_id: queueId, test_id: id, position, expected: null, warn: null, fail: null, tol_mode: null });
      });
    };
    const lists = S.assignments.filter((a) => a.machine_id === machine.id).map((a) => byId("queues", a.queue_id)).filter(Boolean);
    const templates = S.queues.filter((q) => q.is_template && /CT simulator/.test(q.name));
    machine.name = "Big Bore CT (7064)";
    for (const q of templates) { q.name = seedTpl.name; q.description = seedTpl.setup || ""; replaceTests(q.id); }
    for (const q of lists) { q.name = `${seedTpl.list} – ${machine.name}`; q.description = seedTpl.setup || ""; replaceTests(q.id); }
    audit(null, "upgrade", "machine", machine.id, { renamed: "CT Sim → Big Bore CT (7064)", list: seedTpl.list });
    save();
  }

  const routes = [];
  const route = (method, pattern, handler, pub) => routes.push({ method, pattern: new RegExp(`^${pattern}$`), handler, pub });

  route("GET", "/api/me", () => ({ user: currentUser() }), true);
  route("POST", "/api/login", async (u, m, body) => {
    const name = required(body, "username");
    const user = S.users.find(x => x.username.toLowerCase() === name.toLowerCase());
    if (!user || !user.active || !await checkPassword(user, body.password || '')) throw new Error('Incorrect username or password.');
    sessionStorage.setItem('qa_portal_password_user', String(user.id));
    audit(user.id, 'login', 'user', user.id, {});
    return {user:publicUser(user)};
  }, true);
  route("POST", "/api/logout", () => { sessionStorage.removeItem('qa_portal_password_user'); localStorage.removeItem('qa_portal_user'); return {ok:true}; }, true);
  route("POST", "/api/password", async (u, m, body) => {
    const user = get('users', u.id);
    if (!await checkPassword(user, body.current || '')) throw new Error('Incorrect current password.');
    if ((body.new || '').length < 10) throw new Error('Use at least 10 characters.');
    await setPassword(user, body.new); save(); return {ok:true};
  });
  route("GET", "/api/dashboard", () => dashboard());
  route("GET", "/api/users", (u) => { require(u, "manage_users"); return S.users.map((x) => ({ ...publicUser(x), active: x.active, created_at: x.created_at })); });
  route("POST", "/api/users", async (u, m, body) => {
    require(u, "manage_users");
    const name = required(body, "username");
    if (!ROLES.includes(body.role)) throw new Error("Choose a role.");
    if (S.users.some((x) => x.username.toLowerCase() === name.toLowerCase())) throw new Error(`User '${name}' already exists.`);
    if ((body.password || "").length < 10) throw new Error("Use at least 10 characters.");
    const id = insert("users", { username: name, full_name: text(body, "full_name"), role: body.role, password_hash: "", active: 1, created_at: now() });
    await setPassword(byId("users",id), body.password); save();
    audit(u.id, "create", "user", id, { username: name, role: body.role });
    return { id };
  });
  route('POST','/api/users/import',async (u,m,body)=>{
    require(u,'manage_users');const rows=body.users;
    if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('Upload 1–500 users at a time.');
    const names=new Set();
    rows.forEach((r,i)=>{const name=String(r.username||'').trim();if(!name||names.has(name.toLowerCase())||S.users.some(u=>u.username.toLowerCase()===name.toLowerCase()))throw Error(`Row ${i+2}: username is missing or already exists. No users were imported.`);names.add(name.toLowerCase());if(!ROLES.includes(r.role))throw Error(`Row ${i+2}: choose Admin, Physicist, Therapist or MPA.`);if(typeof r.password!=='string'||r.password.length<10)throw Error(`Row ${i+2}: temporary password needs at least 10 characters. No users were imported.`);});
    const prepared=[];for(const r of rows){const user={username:r.username.trim(),full_name:r.full_name||r.username.trim(),role:r.role,active:1,created_at:now()};await setPassword(user,r.password);prepared.push(user);}
    for(const user of prepared){const id=insert('users',user);audit(u.id,'create','user',id,{username:user.username,role:user.role,source:'spreadsheet'});}save();return {created:prepared.length};
  });
  route("PUT", "/api/users/(\\d+)", async (u, m, body) => {
    require(u, "manage_users");
    const target = get("users", m[1]);
    const role = body.role || target.role;
    if (!ROLES.includes(role)) throw new Error("Unknown role.");
    const active = flag(body, "active", !!target.active);
    if (target.id === u.id && (role !== "admin" || !active)) throw new Error("You cannot remove your own admin access.");
    if (body.password) {
      if (body.password.length < 10) throw new Error("Use at least 10 characters.");
      await setPassword(target, body.password);
    }
    Object.assign(target, { full_name: text(body, "full_name", target.full_name), role, active });
    save();
    audit(u.id, "update", "user", target.id, { role, active });
    return { ok: true };
  });
  route("GET", "/api/machines", () => S.machines.slice().sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name)));
  route("POST", "/api/machines", (u, m, body) => saveMachine(u, body));
  route("POST", "/api/machines/(\\d+)/delete", (u,m)=>deleteMachine(u,Number(m[1])));
  route("PUT", "/api/machines/(\\d+)", (u, m, body) => saveMachine(u, body, Number(m[1])));
  route("GET", "/api/machines/(\\d+)/assignments", (u, m) => listAssignments(Number(m[1])));
  route("GET", "/api/tests", () => S.tests.map((t) => ({ ...t, owner_name: t.owner_queue_id ? (byId("queues", t.owner_queue_id) || {}).name || null : null,
      position: (S.queue_items.find((i) => i.test_id === t.id && i.queue_id === t.owner_queue_id) || {}).position ?? null }))
    .sort((a, b) => (b.active - a.active) || String(a.owner_name).localeCompare(String(b.owner_name)) || ((a.position ?? 1e9) - (b.position ?? 1e9))
      || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
  route("POST", "/api/tests", (u, m, body) => saveTest(u, body));
  route("PUT", "/api/tests/(\\d+)", (u, m, body) => saveTest(u, body, Number(m[1])));
  route("GET", "/api/queues", () => listQueues());
  route("GET", "/api/template-starters", (u) => { require(u, "configure"); return (window.PORTAL_SEED || {}).templates || []; });
  route("POST", "/api/templates", (u, m, body) => createTemplate(u, body));
  route("GET", "/api/queues/(\\d+)", (u, m) => getQueue(Number(m[1])));
  route("POST", "/api/queues", (u, m, body) => saveQueue(u, body));
  route("PUT", "/api/queues/(\\d+)", (u, m, body) => saveQueue(u, body, Number(m[1])));
  route("POST", "/api/queues/(\\d+)/duplicate", (u, m, body) => duplicateQueue(u, Number(m[1]), body));
  route("POST", "/api/queues/(\\d+)/rename", (u, m, body) => renameQueue(u, Number(m[1]), body));
  route("POST", "/api/queues/(\\d+)/reevaluate", (u, m) => reevaluateQueue(u, Number(m[1])));
  route("POST", "/api/queues/(\\d+)/archive", (u, m, body) => archiveQueue(u, Number(m[1]), body));
  route("POST", "/api/queues/(\\d+)/delete", (u, m) => deleteQueue(u, Number(m[1])));
  route("POST", "/api/assignments", (u, m, body) => saveAssignment(u, body));
  route("PUT", "/api/assignments/(\\d+)", (u, m, body) => saveAssignment(u, body, Number(m[1])));
  route("GET", "/api/assignments/(\\d+)/draft", (u, m) => { const d = (S.drafts || []).find((x) => x.assignment_id === Number(m[1]) && x.user_id === u.id); return d ? { ...d.data, saved_at: d.saved_at } : null; });
  route("PUT", "/api/assignments/(\\d+)/draft", (u, m, body) => {
    require(u, "perform");
    S.drafts = (S.drafts || []).filter((x) => !(x.assignment_id === Number(m[1]) && x.user_id === u.id));
    const saved_at = now();
    S.drafts.push({ assignment_id: Number(m[1]), user_id: u.id, data: { qa_date: body.qa_date, comment: body.comment || "", results: body.results || [] }, saved_at });
    save();
    return { saved_at };
  });
  route("POST", "/api/assignments/(\\d+)/draft/clear", (u, m) => { S.drafts = (S.drafts || []).filter((x) => !(x.assignment_id === Number(m[1]) && x.user_id === u.id)); save(); return { ok: true }; });
  route("GET", "/api/assignments/(\\d+)/template", (u, m) => runTemplate(Number(m[1])));
  route("POST", "/api/assignments/(\\d+)/archive", (u, m, body) => archiveAssignment(u, Number(m[1]), body));
  route("POST", "/api/assignments/(\\d+)/delete", (u, m, body) => deleteAssignment(u, Number(m[1])));
  route("POST", "/api/assignments/(\\d+)/duplicate", (u, m, body) => duplicateAssignment(u, Number(m[1]), body));
  route("POST", "/api/assignments/(\\d+)/reevaluate", (u, m, body) => reevaluateAssignment(u, Number(m[1])));
  route("PUT", "/api/assignments/(\\d+)/tests", (u, m, body) => saveTestSelection(u, Number(m[1]), body));
  route("PUT", "/api/assignments/(\\d+)/overrides", (u, m, body) => saveOverrides(u, Number(m[1]), body));
  route("POST", "/api/assignments/(\\d+)/runs", (u, m, body) => submitRun(u, Number(m[1]), body));
  route("GET", "/api/assignments/(\\d+)/files", (u, m) => listImportFiles(Number(m[1])));
  route("GET", "/api/assignments/(\\d+)/file", (u, m, body, q) => readImportFile(Number(m[1]), q.path));
  route("GET", "/api/dbfile", () => dbFileInfo());
  route("POST", "/api/assignments/(\\d+)/sphinx/preview", (u, m, body) => sphinxPreview(u, Number(m[1]), body.file || {}));
  route("POST", "/api/assignments/(\\d+)/sphinx/tests", (u, m, body) => sphinxAddTests(u, Number(m[1]), body.file || {}));
  route("POST", "/api/assignments/(\\d+)/sphinx/import", (u, m, body) => importSphinx(u, Number(m[1]), body));
  route("GET", "/api/runs", (u, m, body, q) => listRuns(q));
  route("GET", "/api/runs/(\\d+)", (u, m) => getRun(Number(m[1])));
  route("POST", "/api/runs/(\\d+)/trash", (u,m,body)=>trashRun(u,Number(m[1]),body));
  route("POST", "/api/runs/(\\d+)/therapist-unapprove",(u,m)=>unapproveTherapistReview(u,Number(m[1])));
  route("POST", "/api/runs/(\\d+)/physics-unapprove",(u,m)=>unapprovePhysicsReview(u,Number(m[1])));
  route("POST", "/api/runs/(\\d+)/therapist-review",(u,m,body)=>setTherapistReview(u,Number(m[1]),body));
  route("POST", "/api/runs/(\\d+)/therapist-approve", (u,m) => therapistApproveRun(u,Number(m[1])));
  route("POST", "/api/runs/(\\d+)/review", (u, m, body) => reviewRun(u, Number(m[1]), body));
  route("GET", "/api/machines/(\\d+)/trends", (u, m) => machineTrends(Number(m[1])));
  route("GET", "/api/trend", (u, m, body, q) => {
    if (!q.machine_id || !q.test_id) throw new Error("Choose a machine and a test.");
    return trend(q.machine_id, q.test_id);
  });
  route("GET", "/api/audit", (u) => { require(u, "review"); return S.audit.slice().reverse().slice(0, 300).map((a) => ({ ...a, username: a.user_id ? (byId("users", a.user_id) || {}).username : null })); });
  // Backup and restore: the only way data leaves or enters this browser.
  route("GET", "/api/backup", (u) => { require(u, "configure"); return { exported_at: now(), state: S }; });
  route("POST", "/api/restore", (u, m, body) => {
    require(u, "configure");
    const s = body.state;
    if (!s || !TABLES.every((t) => Array.isArray(s[t])) || !s.seq) throw new Error("That file is not a portal backup.");
    S = s;
    save();
    audit(u.id, "restore", "portal", null, { exported_at: body.exported_at });
    return { ok: true };
  });

  // Called by the interface from a click (the pickers need a user gesture).
  window.localFolders = {
    async choose(assignmentId) {
      await ready;
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const a = get("assignments", assignmentId, "Schedule");
      await kvPut(FOLDER_PREFIX + a.id, handle);
      a.import_folder = handle.name;
      save();
      audit(currentUser() ? currentUser().id : null, "update", "assignment", a.id, { import_folder: handle.name });
      return handle.name;
    },
    async request(assignmentId) {
      const handle = await folderHandle(assignmentId);
      if (!handle) return "none";
      return handle.requestPermission({ mode: "read" });
    },
    async clear(assignmentId) {
      await ready;
      await kvDelete(FOLDER_PREFIX + assignmentId);
      const a = get("assignments", assignmentId, "Schedule");
      a.import_folder = "";
      save();
    },
  };
  window.localDbFile = {
    async choose() {
      await ready;
      const handle = await window.showSaveFilePicker({ suggestedName: "qa-portal-database.json",
        types: [{ description: "QA portal database", accept: { "application/json": [".json"] } }] });
      const existing = await (await handle.getFile()).text();
      if (existing.trim()) {
        const backup = JSON.parse(existing);
        if (!validState(backup.state)) throw new Error(`${handle.name} is not a portal database file.`);
        if (!confirm(`${handle.name} already holds a portal database (saved ${backup.exported_at || "unknown"}). Load it and replace what is in this browser?`)) return null;
        S = backup.state;
      }
      await kvPut(DB_FILE_KEY, handle);
      save();
      await writeDbFile();
      return handle.name;
    },
    async reconnect() {
      const handle = await dbFileHandle();
      if (!handle) return "none";
      const permission = await handle.requestPermission({ mode: "readwrite" });
      if (permission === "granted") {
        const fromFile = await readDbFile();
        if (fromFile) { S = fromFile; save(); }
      }
      return permission;
    },
    async clear() { await kvDelete(DB_FILE_KEY); },
  };

  let requestQueue=Promise.resolve();
  window.localApi = function localApi(method,path,body,options={}) {
    const execute=async()=>{
      await ready;
      const [pathname,query='']=path.split('?'),q=Object.fromEntries(new URLSearchParams(query));
      const actual=currentUser(),role=options.actingRole;
      if(role&&(!actual||actual.role!=='admin'||!['admin','physicist','therapist','mpa'].includes(role)))throw Error('Only an Admin can switch operating roles.');
      const user=role?{...actual,role,authenticated_role:'admin'}:actual;
      actingContext=role||null;
      try{
        for(const r of routes){const m=r.pattern.exec(pathname);if(m&&r.method===method){
          if(!user&&!r.pub)throw Error('Please sign in.');
          const result=await r.handler(pathname==='/api/me'?actual:user,m,body||{},q);
          return JSON.parse(JSON.stringify(result));
        }}
        throw Error(`Not found: ${method} ${pathname}`);
      }finally{actingContext=null;}
    };
    const result=requestQueue.then(execute,execute);requestQueue=result.catch(()=>{});return result;
  };
})();
