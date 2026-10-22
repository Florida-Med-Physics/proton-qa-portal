"use strict";

// Browser-only backend for the Physics QA Portal (GitHub Pages build).
// Answers the same /api/... requests as portal/server.py, but keeps everything in this
// browser's IndexedDB. Nothing is sent anywhere. Rules mirror portal/qa.py and
// portal/service.py; keep them in step.

(() => {
  const DB_NAME = "proton-qa-portal";
  const STORE = "kv";
  const TABLES = ["users", "machines", "tests", "queues", "queue_items", "assignments", "overrides", "runs", "results", "audit"];
  const ROLES = ["admin", "physicist", "therapist"];
  const PERMISSIONS = {
    perform: ["admin", "physicist", "therapist"], review: ["admin", "physicist"], configure: ["admin", "physicist"], manage_users: ["admin"],
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
  const IMPORT_EXTENSIONS = [".xls"];
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
  async function listImportFiles(assignmentId, limit = 40) {
    const a = get("assignments", assignmentId, "Schedule");
    const handle = await folderHandle(a.id);
    if (!handle) return { folder: a.import_folder || "", files: [], permission: "none" };
    const permission = await folderPermission(handle);
    if (permission !== "granted") return { folder: handle.name, files: [], permission };
    const found = [];
    await walkFolder(handle, "", 3, found);
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
  function audit(userId, action, entity, entityId, detail) {
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
    return out;
  }
  function evaluate(type, value, limits) {
    if (type === "boolean") return value ? "pass" : "fail";
    if (type === "status") return ["pass", "warn", "fail"].includes(value) ? value : "fail";
    if (type === "text") return "recorded";
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
    if (!lastDone) return start;
    if (a.frequency === "weekly") return maxDate(start, addDays(lastDone, 7));
    if (MONTH_STEPS[a.frequency]) return maxDate(start, addMonths(lastDone, MONTH_STEPS[a.frequency]));
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
    return a.frequency[0].toUpperCase() + a.frequency.slice(1);
  }

  // ---- Sphinx export reader (sphinx.py) ---------------------------------------

  const CATEGORIES = ["Energy", "Spot", "Coincidence", "Homogeneity", "Output", "Couch Translation"];
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
  function standardName(category, item, metric) {
    metric = metric.replace(/\s+/g, " ").trim();
    const e = nominalEnergy(item);
    return e !== null ? `${category} ${e} MeV – ${metric}` : `${category} – ${metric}`;
  }
  function cellText(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    return String(v).trim();
  }
  function readRows(bytes) {
    if (!bytes.length) throw new Error("The file is empty.");
    if (!window.XLSX) throw new Error("The spreadsheet reader did not load. Check the internet connection and reload.");
    let wb;
    try {
      wb = XLSX.read(bytes, { type: "array" });
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
        if (category === null) return;
        if (setupText && !SETUP_LABELS.has(setupText) && !SETUP_VALUE.test(setupText)) item = cleanItem(setupText);
        const [first, second] = tolerances;
        if (first === 0) throw new Error(`Row ${index + 1}: tolerance without a metric name.`);
        const after = texts.slice(second + 1);
        const numbers = after.map(quantity).filter(Boolean);
        if (numbers.length < 2) throw new Error(`Row ${index + 1}: expected an expected value and a result.`);
        const warn = quantity(texts[first]), fail = quantity(texts[second]);
        const [expected, unit] = numbers[0], [result] = numbers[1];
        measurements.push({
          category, item: item || category, metric: texts[first - 1].trim(), unit, expected, result,
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
    const seen = new Map();
    for (const m of measurements) {
      m.sphinx_label = m.item === m.category ? m.metric : `${m.item} – ${m.metric}`;
      m.name = standardName(m.category, m.item, m.metric);
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
      parsed = parseRows(readRows(bytes), name);
    } catch (err) {
      throw new Error(`${name}: ${err.message}`);
    }
    parsed.filename = name;
    parsed.sha256 = await sha256(bytes);
    return parsed;
  }
  const fileLimits = (m) => ({ expected: m.expected, warn: m.warn, fail: m.fail, tol_mode: m.tol_mode });

  // ---- users / session --------------------------------------------------------

  const publicUser = (u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role });
  function currentUser() {
    const id = Number(localStorage.getItem("qa_portal_user") || 0);
    const u = id && byId("users", id);
    return u && u.active ? publicUser(u) : null;
  }

  // ---- queues / tests ---------------------------------------------------------

  function saveTest(user, data, testId) {
    require(user, "configure");
    const type = data.type || "numeric";
    if (!["numeric", "boolean", "status", "text"].includes(type)) throw new Error("Test type must be numeric, boolean, status, or text.");
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
    return { ...q, items: queueItems(q.id) };
  }
  function listQueues() {
    return S.queues.map((q) => ({
      ...q,
      item_count: S.queue_items.filter((i) => i.queue_id === q.id).length,
      machine_count: S.assignments.filter((a) => a.queue_id === q.id && a.active).length,
      template_name: q.template_id ? (byId("queues", q.template_id) || {}).name || null : null,
      machines: S.assignments.filter((a) => a.queue_id === q.id && a.active).map((a) => byId("machines", a.machine_id).name).join(", ") || null,
    })).sort((a, b) => (b.is_template - a.is_template) || (b.active - a.active) || a.name.localeCompare(b.name));
  }
  function saveQueue(user, data, queueId) {
    require(user, "configure");
    const name = required(data, "name");
    if (S.queues.some((q) => q.name.toLowerCase() === name.toLowerCase() && q.id !== (queueId || 0))) throw new Error(`A QA list named '${name}' already exists.`);
    const items = (data.items || []).map((item, position) => {
      const test = get("tests", item.test_id, "Check");
      if (test.owner_queue_id && test.owner_queue_id !== queueId) throw new Error(`'${test.name}' belongs to another QA list. Duplicate that list, or add a new check here.`);
      const limits = test.type === "numeric" ? limitsOf(item, true) : { expected: null, warn: null, fail: null, tol_mode: null };
      return { test_id: test.id, position, ...limits };
    });
    if (new Set(items.map((i) => i.test_id)).size !== items.length) throw new Error("A check can only appear once in a QA list.");
    const existing = queueId ? get("queues", queueId, "QA list") : null;
    const isTemplate = flag(data, "is_template", existing ? !!existing.is_template : false);
    if (isTemplate && existing && S.assignments.some((a) => a.queue_id === existing.id)) throw new Error("This list is scheduled on a machine, so it cannot become a template. Duplicate it instead.");
    const fields = { name, description: text(data, "description"), active: flag(data, "active"), is_template: isTemplate };
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
  function duplicateQueue(user, sourceId, data) {
    require(user, "configure");
    const source = getQueue(sourceId);
    const name = required(data, "name");
    if (S.queues.some((q) => q.name.toLowerCase() === name.toLowerCase())) throw new Error(`A QA list named '${name}' already exists.`);
    const id = insert("queues", { name, description: source.description, active: 1, is_template: 0, template_id: source.id });
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
    const dates = S.runs.filter((r) => r.assignment_id === assignmentId).map((r) => r.qa_date).sort();
    return dates.length ? fromIso(dates[dates.length - 1]) : null;
  };
  function listAssignments(machineId, today) {
    today = today || new Date();
    return S.assignments.filter((a) => a.machine_id === Number(machineId)).map((a) => ({
      ...a, queue_name: byId("queues", a.queue_id).name, schedule: describeSchedule(a), ...dueState(a, lastDone(a.id), today),
    })).sort((a, b) => (b.active - a.active) || a.queue_name.localeCompare(b.queue_name));
  }
  function saveAssignment(user, data, assignmentId) {
    require(user, "configure");
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
      if (queue.is_template) throw new Error(`'${queue.name}' is a template. Duplicate it, then schedule the copy.`);
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
  function runTemplate(assignmentId) {
    const a = get("assignments", assignmentId, "Schedule");
    const machine = get("machines", a.machine_id);
    const queue = getQueue(a.queue_id);
    const overrides = Object.fromEntries(S.overrides.filter((o) => o.assignment_id === a.id).map((o) => [o.test_id, o]));
    const items = queue.items.map((item) => {
      const test = byId("tests", item.test_id);
      const o = overrides[test.id];
      return { test_id: test.id, name: test.name, category: test.category, type: test.type, unit: test.unit, description: test.description,
        limits: resolveLimits(test, item, o), queue_limits: resolveLimits(test, item),
        override: o ? { expected: o.expected, warn: o.warn, fail: o.fail, tol_mode: o.tol_mode } : null };
    });
    return { assignment: { ...a, schedule: describeSchedule(a) }, machine, queue: { id: queue.id, name: queue.name, description: queue.description }, items };
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
        const runs = S.runs.filter((r) => r.assignment_id === a.id).sort((x, y) => (y.qa_date.localeCompare(x.qa_date)) || (y.id - x.id));
        return { ...a, last_run: runs[0] ? { id: runs[0].id, overall: runs[0].overall, review_status: runs[0].review_status, qa_date: runs[0].qa_date } : null };
      });
      return { ...m, queues, pending_review: S.runs.filter((r) => r.machine_id === m.id && r.review_status === "pending").length };
    });
    return { today: localIso(today), machines };
  }

  // ---- runs -------------------------------------------------------------------

  function insertRun(user, t, qaDate, rows, comment, source, sourceRef, reviewStatus) {
    const result = overall(rows.map((r) => r.status));
    const id = insert("runs", { assignment_id: t.assignment.id, machine_id: t.machine.id, queue_id: t.queue.id, performed_by: user.id,
      performed_at: now(), qa_date: qaDate, overall: result, comment, source, source_ref: sourceRef, review_status: reviewStatus,
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
    if (!t.assignment.active || !t.machine.active) throw new Error("This queue is not active on this machine.");
    const qaDate = data.qa_date || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(qaDate)) throw new Error("QA date must be YYYY-MM-DD.");
    if (qaDate > todayIso()) throw new Error("QA date cannot be in the future.");
    const entered = Object.fromEntries((data.results || []).map((r) => [Number(r.test_id), r]));
    const rows = [], missing = [];
    for (const item of t.items) {
      const raw = entered[item.test_id] || {};
      let value = raw.value;
      if (value === null || value === undefined || String(value).trim() === "") { if (item.type !== "text") missing.push(item.name); continue; }
      if (item.type === "numeric") { value = Number(value); if (!Number.isFinite(value)) throw new Error(`${item.name}: enter a number.`); }
      else if (item.type === "boolean") value = [true, 1, "1", "true", "pass", "yes"].includes(value);
      else if (item.type === "status") {
        value = STATUS_WORDS[String(value).trim().toLowerCase()];
        if (!value) throw new Error(`${item.name}: choose Pass, Warning, or Fail.`);
      }
      else value = String(value);
      let status;
      try { status = evaluate(item.type, value, item.limits); } catch (err) { throw new Error(`${item.name}: ${err.message}`); }
      const textual = item.type === "text" || item.type === "status";
      rows.push({ test_id: item.test_id, value_num: textual ? null : Number(value), value_text: textual ? value : null,
        limits: item.limits, status, comment: text(raw, "comment") });
    }
    if (missing.length) throw new Error("Missing results for: " + missing.join(", "));
    if (!rows.length) throw new Error("This queue has no tests.");
    const ref = text(data, "source_ref") || null;
    checkNotImported(ref);
    return insertRun(user, t, qaDate, rows, text(data, "comment"), ref ? "sphinx" : "manual", ref, "pending");
  }
  function runRow(r) {
    const m = byId("machines", r.machine_id), q = byId("queues", r.queue_id), p = byId("users", r.performed_by) || {}, rv = r.reviewed_by ? byId("users", r.reviewed_by) : null;
    return { ...r, machine_name: m.name, queue_name: q.name, performer_name: p.full_name, performer: p.username,
      reviewer_name: rv ? rv.full_name : null, reviewer: rv ? rv.username : null };
  }
  function listRuns(q) {
    let runs = S.runs;
    if (q.machine_id) runs = runs.filter((r) => r.machine_id === Number(q.machine_id));
    if (q.queue_id) runs = runs.filter((r) => r.queue_id === Number(q.queue_id));
    if (q.review_status) runs = runs.filter((r) => r.review_status === q.review_status);
    const limit = Math.min(Number(q.limit || 200), 1000);
    return runs.slice().sort((a, b) => b.qa_date.localeCompare(a.qa_date) || b.id - a.id).slice(0, limit).map(runRow);
  }
  function getRun(id) {
    const r = get("runs", id);
    const results = S.results.filter((x) => x.run_id === r.id).map((x) => { const t = byId("tests", x.test_id); return { ...x, name: t.name, category: t.category, type: t.type, unit: t.unit }; });
    return { ...runRow(r), results };
  }
  function reviewRun(user, id, data) {
    require(user, "review");
    const r = get("runs", id);
    if (!["approved", "rejected"].includes(data.decision)) throw new Error("Decision must be approve or reject.");
    if (r.review_status !== "pending") throw new Error("This run has already been reviewed.");
    if (r.performed_by === user.id) throw new Error("Runs must be reviewed by someone other than the person who performed them.");
    const comment = text(data, "comment");
    if (data.decision === "rejected" && !comment) throw new Error("Add a comment explaining the rejection.");
    Object.assign(r, { review_status: data.decision, reviewed_by: user.id, reviewed_at: now(), review_comment: comment });
    save();
    audit(user.id, data.decision, "run", r.id, { comment });
    return { ok: true };
  }
  function trend(machineId, testId) {
    const test = get("tests", testId, "Check");
    const runs = Object.fromEntries(S.runs.filter((r) => r.machine_id === Number(machineId)).map((r) => [r.id, r]));
    const points = S.results.filter((x) => x.test_id === test.id && runs[x.run_id] && x.value_num !== null)
      .map((x) => ({ run_id: x.run_id, qa_date: runs[x.run_id].qa_date, value: x.value_num, expected: x.expected, warn: x.warn, fail: x.fail, tol_mode: x.tol_mode, status: x.status }))
      .sort((a, b) => a.qa_date.localeCompare(b.qa_date) || a.run_id - b.run_id);
    return { test, points };
  }

  function machineTrends(machineId) {
    const runs = Object.fromEntries(S.runs.filter((r) => r.machine_id === Number(machineId)).map((r) => [r.id, r]));
    const out = {};
    for (const x of S.results) {
      if (!runs[x.run_id] || x.value_num === null) continue;
      (out[x.test_id] = out[x.test_id] || []).push({ run_id: x.run_id, qa_date: runs[x.run_id].qa_date, value: x.value_num, expected: x.expected,
        warn: x.warn, fail: x.fail, tol_mode: x.tol_mode, status: x.status });
    }
    for (const k in out) out[k].sort((a, b) => a.qa_date.localeCompare(b.qa_date) || a.run_id - b.run_id);
    return out;
  }

  // ---- Sphinx into lists --------------------------------------------------------

  function sphinxTestIds(user, t, measurements, create) {
    const inQueue = Object.fromEntries(t.items.map((i) => [`${i.category}|${i.name}`, i.test_id]));
    const ids = {}, added = [];
    for (const m of measurements) {
      const key = `${m.category}|${m.name}`;
      if (inQueue[key]) { ids[key] = inQueue[key]; continue; }
      if (!create) continue;
      require(user, "configure");
      const queueId = t.queue.id;
      const existing = S.tests.find((x) => x.owner_queue_id === queueId && x.category === m.category && x.name === m.name);
      const testId = existing ? existing.id : saveTest(user, { category: m.category, name: m.name, unit: m.unit, ...fileLimits(m), owner_queue_id: queueId,
        description: `Measured by Sphinx. Export label: ${m.sphinx_label}.` }).id;
      const position = S.queue_items.filter((i) => i.queue_id === queueId).reduce((p, i) => Math.max(p, i.position), -1) + 1;
      insert("queue_items", { queue_id: queueId, test_id: testId, position, expected: null, warn: null, fail: null, tol_mode: null });
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
    const items = Object.fromEntries(t.items.map((i) => [`${i.category}|${i.name}`, i]));
    const matched = [], unmatched = [];
    for (const m of parsed.measurements) {
      const item = items[`${m.category}|${m.name}`];
      if (!item) { unmatched.push({ category: m.category, name: m.name, unit: m.unit }); continue; }
      const fl = fileLimits(m);
      matched.push({ test_id: item.test_id, value: m.result, sphinx_status: m.sphinx_status, file_limits: fl,
        limits_differ: Object.keys(fl).some((k) => item.limits[k] !== fl[k]) });
    }
    const dup = S.runs.find((r) => r.source_ref === parsed.sha256);
    return { filename: parsed.filename, qa_date: parsed.qa_date, finished: parsed.finished, sphinx_user: parsed.sphinx_user,
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
        [ids, added] = sphinxTestIds(user, t, parsed.measurements, true);
      } catch (err) {
        skipped.push({ file: u.name, reason: err.message.replace(`${u.name}: `, "") });
        continue;
      }
      if (added.length) t = runTemplate(assignmentId);
      const rows = parsed.measurements.map((m) => {
        const limits = fileLimits(m);
        let ours;
        try { ours = evaluate("numeric", m.result, limits); } catch { ours = "recorded"; }
        const status = SPHINX_STATUS[m.sphinx_status] || ours;
        return { test_id: ids[`${m.category}|${m.name}`], value_num: m.result, value_text: null, limits, status,
          comment: status !== ours ? `Sphinx: ${m.sphinx_status}; portal rule on the rounded values gives ${ours}.` : "" };
      });
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
          duplicateQueue({ ...sys, role: "admin" }, tpl.id, { name: `${tpl.list || "Daily QA"} – ${m.name}`, machine_id: machineId,
            frequency: tpl.frequency || "daily", weekdays: m.weekdays || [0, 1, 2, 3, 4] });
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
    upgradeCtList();
  })();

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
  route("POST", "/api/login", (u, m, body) => {
    const name = required(body, "username");
    const role = ROLES.includes(body.role) ? body.role : "physicist";
    let user = S.users.find((x) => x.username.toLowerCase() === name.toLowerCase());
    if (!user) { const id = insert("users", { username: name, full_name: name, role, password_hash: "", active: 1, created_at: now() }); user = byId("users", id); }
    else if (user.role !== role) { user.role = role; save(); }
    localStorage.setItem("qa_portal_user", String(user.id));
    audit(user.id, "login", "user", user.id, {});
    return { user: publicUser(user) };
  }, true);
  route("POST", "/api/logout", () => { localStorage.removeItem("qa_portal_user"); return { ok: true }; }, true);
  route("POST", "/api/password", () => { throw new Error("This build has no passwords: everyone on this computer shares it."); });
  route("GET", "/api/dashboard", () => dashboard());
  route("GET", "/api/users", (u) => { require(u, "manage_users"); return S.users.map((x) => ({ ...publicUser(x), active: x.active, created_at: x.created_at })); });
  route("POST", "/api/users", (u, m, body) => {
    require(u, "manage_users");
    const name = required(body, "username");
    if (!ROLES.includes(body.role)) throw new Error("Choose a role.");
    if (S.users.some((x) => x.username.toLowerCase() === name.toLowerCase())) throw new Error(`User '${name}' already exists.`);
    const id = insert("users", { username: name, full_name: text(body, "full_name"), role: body.role, password_hash: "", active: 1, created_at: now() });
    audit(u.id, "create", "user", id, { username: name, role: body.role });
    return { id };
  });
  route("PUT", "/api/users/(\\d+)", (u, m, body) => {
    require(u, "manage_users");
    const target = get("users", m[1]);
    const role = body.role || target.role;
    if (!ROLES.includes(role)) throw new Error("Unknown role.");
    const active = flag(body, "active", !!target.active);
    if (target.id === u.id && (role !== "admin" || !active)) throw new Error("You cannot remove your own admin access.");
    Object.assign(target, { full_name: text(body, "full_name", target.full_name), role, active });
    save();
    audit(u.id, "update", "user", target.id, { role, active });
    return { ok: true };
  });
  route("GET", "/api/machines", () => S.machines.slice().sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name)));
  route("POST", "/api/machines", (u, m, body) => saveMachine(u, body));
  route("PUT", "/api/machines/(\\d+)", (u, m, body) => saveMachine(u, body, Number(m[1])));
  route("GET", "/api/machines/(\\d+)/assignments", (u, m) => listAssignments(Number(m[1])));
  route("GET", "/api/tests", () => S.tests.map((t) => ({ ...t, owner_name: t.owner_queue_id ? (byId("queues", t.owner_queue_id) || {}).name || null : null,
      position: (S.queue_items.find((i) => i.test_id === t.id && i.queue_id === t.owner_queue_id) || {}).position ?? null }))
    .sort((a, b) => (b.active - a.active) || String(a.owner_name).localeCompare(String(b.owner_name)) || ((a.position ?? 1e9) - (b.position ?? 1e9))
      || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
  route("POST", "/api/tests", (u, m, body) => saveTest(u, body));
  route("PUT", "/api/tests/(\\d+)", (u, m, body) => saveTest(u, body, Number(m[1])));
  route("GET", "/api/queues", () => listQueues());
  route("GET", "/api/queues/(\\d+)", (u, m) => getQueue(Number(m[1])));
  route("POST", "/api/queues", (u, m, body) => saveQueue(u, body));
  route("PUT", "/api/queues/(\\d+)", (u, m, body) => saveQueue(u, body, Number(m[1])));
  route("POST", "/api/queues/(\\d+)/duplicate", (u, m, body) => duplicateQueue(u, Number(m[1]), body));
  route("POST", "/api/assignments", (u, m, body) => saveAssignment(u, body));
  route("PUT", "/api/assignments/(\\d+)", (u, m, body) => saveAssignment(u, body, Number(m[1])));
  route("GET", "/api/assignments/(\\d+)/template", (u, m) => runTemplate(Number(m[1])));
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

  window.localApi = async function localApi(method, path, body) {
    await ready;
    const [pathname, query = ""] = path.split("?");
    const q = Object.fromEntries(new URLSearchParams(query));
    for (const r of routes) {
      const m = r.pattern.exec(pathname);
      if (m && r.method === method) {
        const user = currentUser();
        if (!user && !r.pub) throw new Error("Please sign in.");
        const result = await r.handler(user, m, body || {}, q);
        return JSON.parse(JSON.stringify(result));
      }
    }
    throw new Error(`Not found: ${method} ${pathname}`);
  };
})();
