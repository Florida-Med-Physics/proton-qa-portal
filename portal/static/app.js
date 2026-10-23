"use strict";

// ---------------------------------------------------------------------------
// Small helpers. Everything is built with DOM nodes (never innerHTML) so user
// text cannot inject markup.
// ---------------------------------------------------------------------------

const state = { user: null, cache: {} };
const app = document.getElementById("app");
// Nothing on the page may ever read "null" or "undefined": the main container drops empty children instead of
// turning them into text (native append/replaceChildren would), and flattens arrays of elements.
const present = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false);
for (const method of ["append", "prepend", "replaceChildren"]) {
  const native = app[method].bind(app);
  app[method] = (...kids) => native(...present(kids));
}
const ROLE_LABEL = { admin: "Admin", physicist: "Physicist", therapist: "Therapist" };
const STATE_LABEL = { overdue: "Overdue", due: "Due", done: "Done today", upcoming: "Upcoming" };
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", semiannual: "Semiannual", annual: "Annual", custom: "Custom interval",
  asneeded: "As needed (e.g. SRS days)" };
// A list can be started when it is due, overdue, or "as needed".
const startable = (state) => state === "due" || state === "overdue" || state === "ready";
// Hours left until the end of the due day (QA is due by the end of that day).
const DAILY_DUE_TIME = "06:00";                 // daily lists are due at 6:00 am on each weekday
function dueIn(iso, frequency) {
  const daily = frequency === "daily";
  const end = new Date(iso + (daily ? `T${DAILY_DUE_TIME}:00` : "T23:59:59"));
  const when = daily ? `${shortDate(iso)} 6:00 AM` : shortDate(iso);
  if (end <= Date.now()) return `Due now (${when})`;
  const hours = Math.max(1, Math.round((end - Date.now()) / 3600000));
  return `Due in ${hours} ${hours === 1 ? "hour" : "hours"} (${when})`;
}
function scheduleStatus(a) {
  if (!a.active) return "Paused";
  if (a.state === "overdue") return `Overdue since ${shortDate(a.next_due)}`;
  if (a.state === "due") return dueIn(a.next_due, a.frequency);
  if (a.state === "done") return "Done today";
  if (a.state === "ready") return a.last_done ? `As needed · last run ${shortDate(a.last_done)}` : "As needed";
  return `Next due ${shortDate(a.next_due)}`;
}
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_RANK = { pass: 0, recorded: 0, warn: 1, fail: 2 };

function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else if (key === "value") node.value = value;
    else if (key === "checked") node.checked = !!value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function svg(tag, attrs, ...kids) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
  for (const kid of kids.flat(Infinity)) if (kid) node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return node;
}

const STATUS_LABEL = { pass: "PASS", warn: "WARNING", fail: "ACTION", recorded: "Recorded" };
function chip(status, label) {
  return el("span", { class: `chip ${status || ""}` }, label || STATUS_LABEL[status] || capitalize(status || "-"));
}

const REVIEW_LABEL = { pending: "Awaiting review", approved: "Approved", rejected: "Rejected", imported: "Historical import" };

function reviewChip(status) {
  return chip(status === "imported" ? "" : status, REVIEW_LABEL[status] || capitalize(status));
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] || "" });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function testLabel(t) {
  return !t.category || t.name.startsWith(t.category) ? t.name : `${t.category} – ${t.name}`;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function decimalsOf(values, cap = 3) {
  let d = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) continue;
    const text = String(Math.round(Number(v) * 10000) / 10000);
    const i = text.indexOf(".");
    if (i >= 0) d = Math.max(d, Math.min(cap, text.length - i - 1));
  }
  return d;
}

function fmt(value, digits) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return digits === undefined ? String(Math.round(n * 10000) / 10000) : n.toFixed(digits);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function personName(name, username) {
  return name || username || "";
}

function can(permission) {
  const role = state.user && state.user.role;
  const rules = { perform: ["admin", "physicist", "therapist"], review: ["admin", "physicist"], configure: ["admin", "physicist"], manage_users: ["admin"] };
  return !!role && rules[permission].includes(role);
}

let toastTimer;
function toast(message, bad) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.className = `toast show${bad ? " bad" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.className = "toast"), bad ? 6000 : 2500);
}

async function api(method, path, body) {
  // The browser-only build (GitHub Pages) answers every request from local storage instead of a server.
  if (window.localApi) return window.localApi(method, path, body);
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Portal": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/login") {
    state.user = null;
    renderLogin();
    throw new Error(data.error || "Please sign in.");
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function formData(form) {
  const data = {};
  for (const node of form.elements) {
    if (!node.name) continue;
    if (node.type === "checkbox") data[node.name] = node.checked;
    else data[node.name] = node.value;
  }
  return data;
}

function field(label, input, cls) {
  return el("div", { class: `field ${cls || ""}` }, el("label", {}, label), input);
}

function select(name, options, value, props) {
  return el("select", { name, ...(props || {}) },
    options.map(([v, label]) => el("option", { value: v, selected: String(v) === String(value ?? "") }, label)));
}

function modal(title, body, onSave, saveLabel) {
  const error = el("p", { class: "error" });
  const form = el("form", { method: "dialog" }, el("h2", {}, title), body, error,
    el("div", { class: "buttons" },
      el("button", { type: "button", onclick: () => dialog.close() }, "Cancel"),
      el("button", { type: "submit", class: "primary" }, saveLabel || "Save")));
  const dialog = el("dialog", {}, form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    try {
      await onSave(formData(form), form);
      dialog.close();
    } catch (err) {
      error.textContent = err.message;
    }
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function page(title, subtitle, actions) {
  app.replaceChildren(el("div", { class: "page-head" },
    el("div", {}, el("h1", {}, title), subtitle ? el("div", { class: "muted" }, subtitle) : null),
    el("div", { class: "row" }, actions || [])));
}

function table(headers, rows, emptyText) {
  if (!rows.length) return el("div", { class: "card empty" }, emptyText || "Nothing here yet.");
  return el("div", { class: "table-wrap" }, sortable(el("table", {},
    el("thead", {}, el("tr", {}, headers.map((h) => el("th", { class: h.startsWith("#") ? "num" : "" }, h.replace(/^#/, ""))))),
    el("tbody", {}, rows))));
}

// Click a column header to sort its table by that column (numbers as numbers, text as text); click again to reverse.
// Rows under a group header (e.g. a machine) stay in their group; rows with hidden children (quick trends) move together.
function sortable(tableEl) {
  const heads = [...tableEl.querySelectorAll("thead > tr:first-child > th")];
  heads.forEach((th, index) => {
    if (!th.textContent.trim()) return;
    th.classList.add("sortable");
    th.append(el("span", { class: "sort-arrow", "aria-hidden": "true" }, "⇅"));
    th.addEventListener("click", () => {
      const dir = th.dataset.sort === "asc" ? "desc" : "asc";
      heads.forEach((h) => { delete h.dataset.sort; const a = h.querySelector(".sort-arrow"); if (a) a.textContent = "⇅"; });
      th.dataset.sort = dir;
      th.querySelector(".sort-arrow").textContent = dir === "asc" ? "↑" : "↓";
      const body = tableEl.tBodies[0];
      const groups = [];
      for (const row of [...body.rows]) {
        if (row.classList.contains("machine-row") || row.querySelector("td[colspan]") && row.cells.length === 1) groups.push({ head: row, rows: [] });
        else if (row.classList.contains("quick-trend") && groups.length && groups[groups.length - 1].rows.length) groups[groups.length - 1].rows[groups[groups.length - 1].rows.length - 1].push(row);
        else { if (!groups.length) groups.push({ head: null, rows: [] }); groups[groups.length - 1].rows.push([row]); }
      }
      const key = (row) => { const cell = row.cells[index]; return cell ? (cell.dataset.sortValue ?? cell.textContent).trim() : ""; };
      const cmp = (a, b) => {
        const ka = key(a[0]), kb = key(b[0]);
        const na = parseFloat(ka.replace(/[^\d.+-]/g, "")), nb = parseFloat(kb.replace(/[^\d.+-]/g, ""));
        const bothNum = ka !== "" && kb !== "" && !isNaN(na) && !isNaN(nb) && /^[-+±]?\d/.test(ka) && /^[-+±]?\d/.test(kb);
        const r = bothNum ? na - nb : ka.localeCompare(kb, undefined, { numeric: true, sensitivity: "base" });
        return dir === "asc" ? r : -r;
      };
      body.replaceChildren(...groups.flatMap((g) => [g.head, ...g.rows.sort(cmp).flat()]).filter(Boolean));
    });
  });
  return tableEl;
}

// A box that narrows a table to the rows containing what is typed; a group header stays while any of its rows show.
function filterBox(wrap, placeholder) {
  const input = el("input", { type: "search", class: "filter-box", placeholder: placeholder || "Filter…", "aria-label": placeholder || "Filter" });
  input.addEventListener("input", () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const body = wrap.querySelector("tbody");
    if (!body) return;
    let group = null;
    for (const row of body.rows) {
      if (row.classList.contains("machine-row")) { group = row; row.hidden = true; continue; }
      if (row.classList.contains("quick-trend")) continue;
      const text = row.textContent.toLowerCase();
      row.hidden = !words.every((w) => text.includes(w));
      if (!row.hidden && group) group.hidden = false;
    }
  });
  return el("div", { class: "filter-row" }, input);
}

function limitsText(limits, unit) {
  if (!limits || limits.expected === null || limits.expected === undefined) {
    return limits && (limits.warn !== null || limits.fail !== null) ? "Limits need an expected value" : "No limits";
  }
  const suffix = limits.tol_mode === "percent" ? "%" : unit ? ` ${unit}` : "";
  const parts = [`${fmt(limits.expected)}${unit ? " " + unit : ""}`];
  if (limits.warn !== null && limits.warn !== undefined) parts.push(`warning ±${fmt(limits.warn)}${suffix}`);
  if (limits.fail !== null && limits.fail !== undefined) parts.push(`action ±${fmt(limits.fail)}${suffix}`);
  return parts.join(" · ");
}

const TYPE_LABELS = { numeric: "Numeric", boolean: "Pass / fail", status: "Pass / warning / fail", text: "Text" };
const STATUS_WORDS = { pass: "PASS", warn: "WARNING", fail: "ACTION" };

// Mirrors portal/qa.py evaluate(); the server re-checks on submit.
// "Δ +0.30 mm" badge beside a numeric result, green / yellow / red by its status against the limits.
function deltaBadge(value, limits, unit, status) {
  if (!Number.isFinite(value) || !limits || limits.expected === null || limits.expected === undefined) return null;
  const d = value - limits.expected;
  const st = status || evaluate("numeric", value, limits);
  const pct = limits.tol_mode === "percent" && limits.expected ? ` (${signed((100 * d) / limits.expected, 2)} %)` : "";
  return el("span", { class: `delta st-${st}`, title: `Difference from the reference ${fmt(limits.expected)} ${unit || ""}`.trim() }, `Δ ${signed(d)} ${unit || ""}`.trim() + pct);
}

function evaluate(type, value, limits) {
  if (type === "boolean") return value === "pass" ? "pass" : "fail";
  if (type === "status") return ["pass", "warn", "fail"].includes(value) ? value : "fail";
  if (type === "text") return "recorded";
  if (limits.expected === null || limits.expected === undefined) return "recorded";
  let dev = value - limits.expected;
  if (limits.tol_mode === "percent") {
    if (limits.expected === 0) return "recorded";
    dev = (100 * dev) / limits.expected;
  }
  const size = Math.abs(dev);
  const eps = 1e-9;
  if (limits.fail !== null && limits.fail !== undefined && size > limits.fail + eps) return "fail";
  if (limits.warn !== null && limits.warn !== undefined && size > limits.warn + eps) return "warn";
  if ((limits.fail === null || limits.fail === undefined) && (limits.warn === null || limits.warn === undefined)) return "recorded";
  return "pass";
}

// ---------------------------------------------------------------------------
// Shell, login, routing
// ---------------------------------------------------------------------------

// Three places to go, as in myQA: Perform QA (the worklist, review and past results), QA Setup, QA Trends.
const NAV = [
  ["#/", "Dashboard", null, ["#/", "#"], "Dashboard"],
  ["#/perform-qa", "Perform QA", null, ["#/perform-qa", "#/perform"]],
  ["#/review", "Review QA", null, ["#/review", "#/runs"]],
  ["#/setup", "Setup QA", "configure", ["#/setup", "#/queues", "#/tests", "#/audit", "#/machines", "#/assignments"]],
  ["#/trends", "Machine Trends", null, ["#/trends"]],
  ["#/admin", "Data Administration", "configure", ["#/admin", "#/users"]],
];

function personIcon() {
  return svg("svg", { viewBox: "0 0 24 24", width: 16, height: 16, "aria-hidden": "true", class: "person-icon" },
    svg("circle", { cx: 12, cy: 8, r: 4, fill: "currentColor" }),
    svg("path", { d: "M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5", fill: "currentColor" }));
}

function trendIcon(size = 18) {
  const pts = [[14, 86], [32, 68], [50, 68], [68, 32], [86, 14]];                 // the rising spots, left to right
  const on = new Set(pts.map(([x, y]) => `${x},${y}`));
  const grid = [];
  for (const y of [14, 32, 50, 68, 86]) for (const x of [14, 32, 50, 68, 86]) if (!on.has(`${x},${y}`)) grid.push(svg("circle", { cx: x, cy: y, r: 7 }));
  return svg("svg", { viewBox: "0 0 100 100", width: size, height: size, "aria-hidden": "true", class: "trend-icon" },
    svg("g", { fill: "currentColor", opacity: 0.5 }, ...grid),
    svg("g", { fill: "#f37021" }, ...pts.map(([x, y]) => svg("circle", { cx: x, cy: y, r: 8 }))));
}

function homeIcon() {
  return svg("svg", { viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true", class: "home-icon" },
    svg("path", { d: "M3 11.5 12 4l9 7.5", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    svg("path", { d: "M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linejoin": "round" }));
}

// Dashboard: one look at every machine — today's QA, last result, and what is waiting for review.
const FREQ_ORDER = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, semiannual: 4, annual: 5, custom: 6, asneeded: 7 };

async function renderHome() {
  const data = await api("GET", "/api/dashboard");
  page("Dashboard", new Date(data.today + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  // Pass / warning / action counts of each machine's most recent run, for the ring beside its last result.
  const lastCounts = {};
  await Promise.all(data.machines.map(async (m) => {
    const lasts = m.queues.filter((q) => q.last_run).sort((a, b) => (b.last_run.qa_date || "").localeCompare(a.last_run.qa_date || ""));
    if (!lasts.length) return;
    try {
      const run = await api("GET", `/api/runs/${lasts[0].last_run.id}`);
      const c = { pass: 0, warn: 0, fail: 0 };
      for (const r of run.results || []) if (r.status in c) c[r.status]++;
      lastCounts[m.id] = c;
    } catch (err) { console.error(err); }
  }));
  const queues = data.machines.flatMap((m) => m.queues);
  const todo = queues.filter((q) => q.state === "due" || q.state === "overdue");
  const overdue = queues.filter((q) => q.state === "overdue").length;
  const failing = data.machines.filter((m) => m.queues.some((q) => q.last_run && q.last_run.overall === "fail"));
  const toReview = data.machines.reduce((n, m) => n + m.pending_review, 0);
  const stat = (label, value, cls, href) => el("a", { class: `home-stat ${cls || ""}`, href }, el("div", { class: "home-stat-value" }, String(value)), el("div", { class: "home-stat-label" }, label));
  app.append(el("div", { class: "home-stats" },
    stat("QA lists to do today", todo.length, todo.length ? "due" : "pass", "#/perform-qa"),
    stat("Overdue", overdue, overdue ? "fail" : "pass", "#/perform-qa"),
    stat("Machines whose last result reached Action", failing.length, failing.length ? "fail" : "pass", "#/trends"),
    can("review") ? stat("Waiting for review", toReview, toReview ? "due" : "pass", "#/runs?review_status=pending") : null));
  for (const modality of MODALITIES) {
    const machines = data.machines.filter((m) => modalityOf(m.kind) === modality).sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name));
    if (!machines.length) continue;
    const rows = machines.map((m) => {
      // The one list people start every day: the most frequent (Daily); other lists stay on Perform QA.
      const main = [...m.queues].sort((p, q) => (FREQ_ORDER[p.frequency] ?? 9) - (FREQ_ORDER[q.frequency] ?? 9) || p.queue_name.localeCompare(q.queue_name))[0];
      const worst = main ? (main.state === "overdue" ? "overdue" : main.state === "due" ? "due" : "done") : "done";
      const lasts = m.queues.filter((q) => q.last_run);
      const lastRun = lasts.sort((a, b) => (b.last_run.qa_date || "").localeCompare(a.last_run.qa_date || ""))[0];
      return el("tr", { class: "clickable", onclick: () => (location.hash = `#/trends?machine_id=${m.id}`) },
        el("td", {}, el("strong", {}, m.name)),
        el("td", {}, main ? el("div", { class: "small list-line" },
          can("perform") ? el("a", { class: "start-dot", href: `#/perform/${main.id}`, title: `Start ${main.queue_name}`, "aria-label": `Start ${main.queue_name}`, onclick: (e) => e.stopPropagation() }, "▶") : null,
          main.queue_name) : el("span", { class: "muted small" }, "None")),
        el("td", {}, main ? chip(worst === "done" ? "pass" : worst, worst === "overdue" ? "Overdue" : worst === "due" ? dueIn(main.next_due, main.frequency) : "Up to date") : el("span", { class: "muted small" }, "Nothing scheduled")),
        el("td", {}, lastRun ? el("div", { class: "last-result-row" }, lastCounts[m.id] ? miniRing(lastCounts[m.id]) : null, el("span", { class: "last-result-text" }, chip(lastRun.last_run.overall), " ", el("span", { class: "small" }, `${lastRun.queue_name} · ${shortDate(lastRun.last_run.qa_date)}`))) : el("span", { class: "muted small" }, "No runs yet")),
        el("td", { class: "num" }, m.pending_review ? el("a", { href: `#/runs?machine_id=${m.id}&review_status=pending` }, String(m.pending_review)) : el("span", { class: "muted" }, "0")),
        el("td", { class: "center" }, el("a", { class: "icon-link", href: `#/trends?machine_id=${m.id}`, title: `${m.name} trends`, "aria-label": `${m.name} trends`, onclick: (e) => e.stopPropagation() }, trendIcon(22))));
    });
    app.append(modalityHead(modality, `${machines.length} ${machines.length === 1 ? "machine" : "machines"}`),
      fixedTable([["Machine", "13%"], ["Daily QA", "22%"], ["Due Date", "22%"], ["Last result", "25%"], ["#To review", "9%"], ["Trends", "9%"]], rows));
  }
}

// Dark mode on/off, remembered on this computer (same control as the TrueBeam Service Log).
function themeToggle() {
  const dark = () => document.documentElement.dataset.theme === "dark";
  const button = el("button", { type: "button", class: "theme-toggle", "aria-pressed": String(dark()) }, `Dark mode: ${dark() ? "On" : "Off"}`);
  button.addEventListener("click", () => {
    const next = dark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("qa-portal-theme", next); } catch { /* private window: still switches for this visit */ }
    button.textContent = `Dark mode: ${next === "dark" ? "On" : "Off"}`;
    button.setAttribute("aria-pressed", String(next === "dark"));
  });
  return button;
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") { const box = document.querySelector(".topbar-search"); if (box) { e.preventDefault(); box.focus(); box.select(); } }
});

function renderShell() {
  const bar = document.getElementById("topbar");
  bar.hidden = !state.user;
  if (!state.user) return;
  const current = location.hash.split("?")[0].split("/").slice(0, 2).join("/") || "#/";
  document.getElementById("nav").replaceChildren(...NAV.filter(([, , p]) => !p || can(p)).map(([href, label, , owns, title]) =>
    el("a", { href, title: title || null, "aria-label": title || null, class: `${owns.includes(current) ? "active" : ""}${title ? " home-link" : ""}` },
      title ? homeIcon() : label)));   // the Dashboard tab is the house icon alone
  const search = el("input", { type: "search", class: "topbar-search", placeholder: "Search | Ctrl+Shift+F", "aria-label": "Search machines, QA lists and tests",
    value: location.hash.startsWith("#/search") ? queryParams().get("q") || "" : "" });
  search.addEventListener("keydown", (e) => { if (e.key === "Enter" && search.value.trim()) location.hash = `#/search?q=${encodeURIComponent(search.value.trim())}`; });
  document.getElementById("who").replaceChildren(
    search,
    el("a", { href: "#/account", title: ROLE_LABEL[state.user.role], class: "person" }, personIcon(), personName(state.user.full_name, state.user.username)),
    el("button", { class: "link", onclick: logout }, "Sign out"),
    themeToggle());
}

function shortDate(iso) {
  return new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function renderLogin() {
  renderShell();
  const error = el("p", { class: "error" });
  const form = el("form", {},
    el("img", { class: "brand-logo", src: "uf-proton-logo.png", alt: "UF Health Proton Therapy Institute" }),
    el("h1", { class: "login-title" }, el("img", { class: "login-mark", src: "gatorqa-logo.svg", alt: "" }), "GatorQA"),
    el("p", { class: "muted login-sub" }, "UFHPTI Machine QA"),
    window.localApi
      ? [el("p", { class: "muted" }, "Everything you record stays in this browser on this computer."),
        field("Your name", el("input", { name: "username", autocomplete: "name", required: true, autofocus: true })),
        field("Role", select("role", Object.entries(ROLE_LABEL), "physicist"))]
      : [el("p", { class: "muted" }, "Sign in with your portal account."),
        field("Username", el("input", { name: "username", autocomplete: "username", required: true, autofocus: true })),
        field("Password", el("input", { name: "password", type: "password", autocomplete: "current-password", required: true }))],
    error,
    el("button", { class: "primary", type: "submit" }, window.localApi ? "Continue" : "Sign in"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("POST", "/api/login", formData(form));
      state.user = result.user;
      route();
    } catch (err) {
      error.textContent = err.message;
    }
  });
  app.replaceChildren(el("div", { class: "card login" }, form));
}

async function logout() {
  await api("POST", "/api/logout").catch(() => {});
  state.user = null;
  location.hash = "#/";
  renderLogin();
}

const ROUTES = [
  [/^#?\/?$/, renderHome],
  [/^#\/perform-qa$/, renderDashboard],
  [/^#\/setup$/, renderSetup],
  [/^#\/admin$/, renderAdmin],
  [/^#\/machines$/, renderMachines],
  [/^#\/machines\/(\d+)$/, renderMachine],
  [/^#\/assignments\/(\d+)\/limits$/, renderLimits],
  [/^#\/perform\/(\d+)$/, renderPerform],
  [/^#\/queues$/, renderQueues],
  [/^#\/queues\/(new|\d+)$/, renderQueueEditor],
  [/^#\/tests$/, renderTests],
  [/^#\/review$/, renderReview],
  [/^#\/runs$/, renderRuns],
  [/^#\/runs\/(\d+)$/, renderRun],
  [/^#\/trends$/, renderTrends],
  [/^#\/search$/, renderSearch],
  [/^#\/users$/, renderUsers],
  [/^#\/audit$/, renderAudit],
  [/^#\/account$/, renderAccount],
];

async function route() {
  if (!state.user) return renderLogin();
  renderShell();
  const hash = location.hash.split("?")[0] || "#/";
  for (const [pattern, handler] of ROUTES) {
    const match = hash.match(pattern);
    if (match) {
      try {
        await handler(...match.slice(1));
      } catch (err) {
        if (state.user) app.replaceChildren(el("div", { class: "card error" }, err.message));
      }
      return;
    }
  }
  app.replaceChildren(el("div", { class: "card empty" }, "Page not found."));
}

function queryParams() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

// Proton gantries, then Photon (TrueBeam, Synergy, Ethos), then Simulation (CT and MRI simulators).
const MODALITIES = ["Proton", "Photon", "Simulation"];
const modalityOf = (kind) => (/proton/i.test(kind || "") ? "Proton" : /simulat/i.test(kind || "") ? "Simulation" : "Photon");
const KIND_RANK = ["Proton gantry", "Linac", "Elekta Synergy", "Varian Ethos", "CT simulator", "MRI simulator"];
const kindRank = (k) => { const i = KIND_RANK.indexOf(k); return i < 0 ? KIND_RANK.length : i; };

// A table with fixed column widths, so the Proton and Photon tables line up at the same width.
function fixedTable(columns, rows, emptyText) {
  if (!rows.length) return el("div", { class: "card empty" }, emptyText || "Nothing here yet.");
  return el("div", { class: "table-wrap fixed-wrap" }, sortable(el("table", { class: "fixed-table" },
    el("colgroup", {}, columns.map(([, width]) => { const col = el("col"); if (width) col.style.width = width; return col; })),
    el("thead", {}, el("tr", {}, columns.map(([h]) => el("th", { class: h.startsWith("#") ? "num" : "" }, h.replace(/^#/, ""))))),
    el("tbody", {}, rows))));
}

function modalityHead(name, count) {
  return el("h2", { class: `section-head modality-head ${name.toLowerCase()}` }, name, el("span", { class: "modality-count" }, count));
}

async function renderDashboard() {
  const data = await api("GET", "/api/dashboard");
  const queues = data.machines.flatMap((m) => m.queues);
  const todo = queues.filter((q) => q.state === "due" || q.state === "overdue").length;
  const toReview = data.machines.reduce((n, m) => n + m.pending_review, 0);
  page("Perform QA", new Date(data.today + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  if (!data.machines.length) {
    app.append(el("div", { class: "card empty" }, "No machines yet. ",
      can("configure") ? el("a", { href: "#/machines" }, "Add your first machine.") : "Ask a physicist to add one."));
    return;
  }
  const banner = await databaseBanner();
  if (banner) app.append(banner);
  app.append(el("p", { class: "lead" },
    todo ? `${todo} QA ${todo === 1 ? "list" : "lists"} to do.` : "All QA is done for today.",
    can("review") && toReview ? ` ${toReview} ${toReview === 1 ? "run is" : "runs are"} waiting for review.` : "",
    " ", el("a", { class: "small", href: "#/runs" }, "All past results")));
  if (can("review") && toReview) {
    const pending = await api("GET", "/api/runs?review_status=pending&limit=50");
    app.append(el("h2", { class: "section-head" }, "Waiting for review"), table(["Date", "Machine", "QA list", "Result", "Performed by", ""], pending.map((r) =>
      el("tr", { class: "clickable", onclick: () => (location.hash = `#/runs/${r.id}`) },
        el("td", {}, shortDate(r.qa_date)), el("td", {}, r.machine_name), el("td", {}, r.queue_name),
        el("td", {}, chip(r.overall)), el("td", { class: "muted" }, personName(r.performer_name, r.performer)),
        el("td", { class: "right" }, el("a", { class: "button small", href: `#/runs/${r.id}` }, "Review"))))));
  }
  // Two tables, Proton then Photon, at the same width; each row is a QA list on a machine.
  for (const modality of MODALITIES) {
    const machines = data.machines.filter((m) => modalityOf(m.kind) === modality).sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name));
    if (!machines.length) continue;
    // Grouped by machine, as on Setup QA: a header row per machine, then its lists (daily first, then monthly, …).
    const rows = machines.flatMap((machine) => {
      const header = el("tr", { class: "machine-row" }, el("td", { colspan: 3 }, el("strong", {}, machine.name), machine.kind ? el("span", { class: "muted small" }, ` · ${machine.kind}`) : null));
      if (!machine.queues.length) return [header, el("tr", {}, el("td", { class: "muted indent", colspan: 3 }, "Nothing scheduled."))];
      const lists = [...machine.queues].sort((a, b) => (FREQ_ORDER[a.frequency] ?? 9) - (FREQ_ORDER[b.frequency] ?? 9) || a.queue_name.localeCompare(b.queue_name));
      return [header, ...lists.map((q) => {
        const last = q.last_run;
        // A small green start button in front of the list name opens the list.
        const go = can("perform") ? el("a", { class: "start-dot", href: `#/perform/${q.id}`, title: `Start ${q.queue_name}`, "aria-label": `Start ${q.queue_name}` }, "▶") : null;
        return el("tr", { class: q.state === "overdue" ? "row-overdue" : "" },
          el("td", { class: "list-cell indent" }, go, el("span", { class: "list-name" }, q.queue_name, el("div", { class: "muted small" }, q.schedule))),
          el("td", {}, chip(q.state, scheduleStatus({ ...q, active: 1 }))),
          el("td", {}, last ? [chip(last.overall), " ", el("a", { class: "small", href: `#/runs/${last.id}` }, shortDate(last.qa_date))] : el("span", { class: "muted small" }, "No runs yet")));
      })];
    });
    app.append(modalityHead(modality, `${machines.length} ${machines.length === 1 ? "machine" : "machines"}`),
      fixedTable([["QA list", "44%"], ["Status", "30%"], ["Last result", "26%"]], rows));
  }
}

// Click a list's name to rename it in place; Enter or clicking away saves, Escape cancels.
function editableName(q, editable) {
  const label = el("strong", { class: editable ? "rename-target" : "", title: editable ? "Click to rename" : null }, q.name);
  if (!editable) return label;
  label.addEventListener("click", () => {
    const input = el("input", { value: q.name, class: "rename-input", "aria-label": "QA list name" });
    const done = async (save) => {
      const name = input.value.trim();
      if (!save || !name || name === q.name) { input.replaceWith(label); return; }
      try {
        const r = await api("POST", `/api/queues/${q.id}/rename`, { name });
        q.name = r.name;
        label.textContent = r.name;
        toast("Renamed");
      } catch (err) {
        toast(err.message, true);
      }
      input.replaceWith(label);
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") done(false); });
    input.addEventListener("blur", () => done(true));
    label.replaceWith(input);
    input.focus();
    input.select();
  });
  return label;
}

async function archiveList(q, archived) {
  try {
    await api("POST", `/api/queues/${q.id}/archive`, { archived });
    toast(archived ? `${q.name} archived` : `${q.name} restored`);
    route();
  } catch (err) {
    toast(err.message, true);
  }
}

async function deleteList(q) {
  if (!confirm(`Permanently delete "${q.name}" and its tests?

This cannot be undone. Lists with recorded results cannot be deleted; archive them instead.`)) return;
  try {
    await api("POST", `/api/queues/${q.id}/delete`, {});
    toast(`${q.name} deleted`);
    route();
  } catch (err) {
    toast(err.message, true);
  }
}

// Setup QA: shared QA template lists and their machine schedules.
async function renderSetup() {
  const editable = can("configure");
  page("Setup QA", "The QA lists and the tests in them. Open a list to edit its tests, order and limits.",
    editable ? [el("a", { class: "button primary", href: "#/queues/new" }, "New QA list")] : []);
  const [queues, machines] = await Promise.all([api("GET", "/api/queues"), api("GET", "/api/machines")]);
  const schedules = (await Promise.all(machines.map((m) => api("GET", `/api/machines/${m.id}/assignments`)))).flat();
  const setActive = async (a, active) => {
    try {
      await api("PUT", `/api/assignments/${a.id}`, { frequency: a.frequency, interval_days: a.interval_days, weekdays: String(a.weekdays).split(",").map(Number),
        start_date: a.start_date, import_folder: a.import_folder || "", active });
      toast(active ? "Set active: it is now scheduled on the machine" : "Set inactive: it stays on the machine but is not scheduled");
      route();
    } catch (err) {
      toast(err.message, true);
    }
  };
  // Keep inactive lists visible here so they can be reactivated.
  const lists = queues.filter((q) => q.active);
  const schedulesOf = (q) => schedules.filter((a) => a.queue_id === q.id);
  const machineOf = (a) => machines.find((m) => m.id === a.machine_id) || {};
  app.append(el("p", { class: "lead" }, `${queues.length} QA Template ${queues.length === 1 ? "List" : "Lists"}. `,
    el("span", { class: "muted small" }, "Each list is one list, shared by every machine it is scheduled on. A value that differs on one machine is set on that machine's schedule.")));

  const iconBtn = (glyph, title, onclick, cls = "") => el("button", { type: "button", class: `icon-action ${cls}`, title, "aria-label": title, onclick }, glyph);
  const moreMenu = (items) => {
    const menu = el("div", { class: "more-menu", hidden: true }, ...items.filter(Boolean).map(([label, fn, title]) =>
      el("button", { type: "button", class: "more-item", title: title || null, onclick: () => { menu.hidden = true; fn(); } }, label)));
    const wrap = el("span", { class: "more-wrap" }, iconBtn("⋮", "More actions", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; }), menu);
    document.addEventListener("click", () => { menu.hidden = true; });
    return wrap;
  };
  const reevaluate = (q) => async () => {
    if (!confirm(`Re-evaluate every recorded result on "${q.name}" against the limits it has now (each machine's own values included)? Verdicts and stored limits are rewritten; this is logged.`)) return;
    try { const r = await api("POST", `/api/queues/${q.id}/reevaluate`, {}); toast(`Re-evaluated ${r.runs} runs; ${r.changed} verdicts changed.`); route(); }
    catch (err) { toast(err.message, true); }
  };
  const modified = (q) => el("td", { class: "small muted" }, q.modified_at ? el("span", {}, q.modified_at.slice(0, 16).replace("T", " "), el("br"), q.modified_by || "") : "—");

  app.append(el("h2", { class: "section-head" }, "QA Template Lists"));
  const editPencil = (q) => iconBtn("✎", editable ? "Edit tests" : "View tests", () => (location.hash = `#/queues/${q.id}`));
  const listRows = queues.slice().sort((x, y) => (schedulesOf(y).length > 0) - (schedulesOf(x).length > 0) || x.name.localeCompare(y.name)).map((q) => el("tr", {},
    el("td", {}, el("div", { class: "name-with-edit" }, editPencil(q), editable ? moreMenu([
      ["Edit", () => (location.hash = `#/queues/${q.id}`)],
      ["Schedule on machines", () => scheduleDialog(q, machines, schedules)],
      ["Duplicate", () => copyDialog(q), "Make a separate list under a new name"],
      ["Re-evaluate", reevaluate(q), "Re-judge every recorded result against the current limits (logged)"],
      ["Delete", () => deleteList(q), "Delete only if it has no results"],
    ]) : null, editableName(q, editable))),
    el("td", {}, schedulesOf(q).length
      ? el("div", { class: "sched-chips" }, schedulesOf(q).sort((a, b) => String(machineOf(a).name).localeCompare(String(machineOf(b).name))).map((a) =>
        el("a", { class: `sched-chip${a.active ? "" : " off"}`, href: `#/machines/${a.machine_id}`, title: `${a.schedule}${a.active ? "" : " · inactive"}` },
          machineOf(a).name, a.active ? null : " (Inactive)")))
      : el("span", { class: "muted small" }, "Not scheduled")),
    el("td", { class: "center" }, q.item_count),

    ));
  const listTable = fixedTable([["QA Template List", "52%"], ["Scheduled On", "38%"], ["Tests", "10%"]], listRows,
    "No QA lists yet. Make one with New QA list.");
  app.append(filterBox(listTable, "Search QA Template Lists"), listTable);

  // Each machine's schedules: which of the lists it runs, how often, and any values of its own.
  const KIND_ORDER = ["Proton gantry", "Proton eyeline", "Linac", "CT simulator", "MRI simulator"];
  const kindRankOf = (m) => { const i = KIND_ORDER.indexOf(m.kind); return i < 0 ? KIND_ORDER.length : i; };
  app.append(el("h2", { class: "section-head" }, "Machine Schedules"));
  const scheduleRows = machines.filter((m) => schedules.some((a) => a.machine_id === m.id && lists.some((q) => q.id === a.queue_id)))
    .sort((x, y) => kindRankOf(x) - kindRankOf(y) || x.name.localeCompare(y.name)).flatMap((m) => {
      const mine = schedules.filter((a) => a.machine_id === m.id).map((a) => ({ a, q: lists.find((q) => q.id === a.queue_id) })).filter((x) => x.q)
        .sort((x, y) => (y.a.active - x.a.active) || (FREQ_ORDER[x.a.frequency] ?? 9) - (FREQ_ORDER[y.a.frequency] ?? 9) || x.q.name.localeCompare(y.q.name));
      return [el("tr", { class: "machine-row" }, el("td", { colspan: 4 }, el("a", { class: "machine-link", href: `#/machines/${m.id}`, title: "Schedules, import folders and details for this machine" },
        el("strong", {}, m.name)), m.kind ? el("span", { class: "muted small" }, ` · ${m.kind}`) : null)),
      ...mine.map(({ a, q }) => el("tr", { class: a.active ? "" : "muted" },
        el("td", { class: "indent" }, el("div", { class: "name-with-edit" }, iconBtn("✎", editable ? "Edit tests (all machines)" : "View tests", () => (location.hash = `#/queues/${q.id}`)),
          editable ? moreMenu([
            ["Edit", () => (location.hash = `#/queues/${q.id}`), "Edit tests shared by all machines"],
            [a.active ? "Set Inactive" : "Set Active", () => setActive(a, !a.active)],
            ["Values for this machine", () => (location.hash = `#/assignments/${a.id}/limits`)],
            ["Schedule and import folder", () => (location.hash = `#/machines/${m.id}`)],
            ["Duplicate", () => copyDialog(q)],
            ["Re-evaluate", reevaluate(q)],
            ["Delete", () => deleteList(q), "Delete the shared list only if it has no results"],
          ]) : null,
          el("span", {}, el("a", { href: `#/queues/${q.id}` }, el("strong", {}, q.name)),
            a.active ? el("span", { class: "active-tag" }, " (Active)") : el("span", { class: "inactive-tag" }, " (Inactive)")))),
        el("td", { class: "small" }, a.schedule),
        el("td", {}, el("label", { class: "check" },
          el("input", { type: "checkbox", role: "switch", checked: !!a.active, disabled: !editable,
            "aria-label": `Active: ${q.name} on ${m.name}`,
            onchange: async (e) => { e.target.disabled = true; await setActive(a, e.target.checked); e.target.disabled = false; e.target.checked = !!a.active; },
          }))),
        el("td", { class: "center" }, a.override_count
          ? el("a", { href: `#/assignments/${a.id}/limits`, title: "Values that differ on this machine" }, `${a.override_count} ${a.override_count === 1 ? "test" : "tests"}`)
          : el("span", { class: "muted small" }, "Default")),
        ) )];
    });
  const scheduleTable = fixedTable([["QA List", "45%"], ["Schedule", "25%"], ["Active", "15%"], ["Machine Values", "15%"]], scheduleRows,
    "No lists scheduled yet. Use ＋ on a list above to schedule it on machines.");
  app.append(filterBox(scheduleTable, "Search machine schedules"), scheduleTable);


  app.append(el("h2", { class: "section-head" }, "More"), el("p", { class: "row" },
    el("a", { class: "button small", href: "#/tests" }, "All tests"),
    can("manage_users") ? el("a", { class: "button small", href: "#/users" }, "People") : null,
    el("a", { class: "button small", href: "#/audit" }, "Audit log")));


}

// Browser-only build: the whole database can live in a file the user picks (a shared drive, say).
function databaseLocationCard() {
  const body = el("div", {}, "…");
  const card = el("div", { class: "card" }, body);
  const refresh = async () => {
    const info = await api("GET", "/api/dbfile");
    const choose = el("button", { class: "primary", onclick: async () => {
      try {
        const name = await window.localDbFile.choose();
        if (name) { toast(`Database saved to ${name}`); route(); }
      } catch (err) {
        if (err.name !== "AbortError") toast(err.message, true);
      }
    } }, info.name ? "Choose a different file…" : "Choose where to save the database…");
    const rows = [];
    if (!info.supported) rows.push(el("p", { class: "muted" }, "Choosing a file needs Chrome or Edge. In this browser the data stays in browser storage; use Backup below."));
    else if (!info.name) rows.push(el("p", { class: "muted" }, "Data is stored only in this browser. Choose a file (for example on the shared drive) and every change is written there too; the page loads from that file when it opens."), el("div", { class: "row" }, choose));
    else {
      rows.push(el("p", {}, el("strong", {}, info.name), info.permission === "granted" ? el("span", { class: "muted" }, " · connected: every change is written to this file.")
        : el("span", { class: "error" }, " · not connected: changes stay in this browser until you reconnect.")));
      rows.push(el("div", { class: "row" },
        info.permission !== "granted" ? el("button", { class: "primary", onclick: async () => {
          const p = await window.localDbFile.reconnect();
          toast(p === "granted" ? "Database file reconnected" : "Access was not granted", p !== "granted");
          route();
        } }, "Reconnect") : null,
        choose,
        el("button", { class: "link", onclick: async () => { await window.localDbFile.clear(); toast("Using browser storage only"); route(); } }, "Stop using this file")));
    }
    body.replaceChildren(...rows);
  };
  refresh().catch((err) => body.replaceChildren(el("span", { class: "error" }, err.message)));
  return card;
}

// Admin (server build): switch the portal to another database file, e.g. one on the shared drive.
function dbSwitchForm(current) {
  const input = el("input", { placeholder: "e.g. U:\Physics\QA\portal.db", value: "" });
  const go = el("button", { class: "primary", onclick: async () => {
    const path = input.value.trim();
    if (!path) return toast("Enter the full path of a .db file.", true);
    if (!confirm(`Switch the portal from
${current}
to
${path}?

Everyone will need to sign in again. If the file does not exist yet, an empty database is created and your admin account is copied into it. The current database is not changed or deleted.`)) return;
    try {
      const r = await api("POST", "/api/dbswitch", { path });
      toast(`Now using ${r.path}. Please sign in again.`);
      state.user = null;
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      toast(err.message, true);
    }
  } }, "Switch database");
  return el("div", {}, el("label", {}, "Use a different database file"), el("div", { class: "row nowrap" }, input, go),
    el("p", { class: "muted small" }, "The choice is remembered when the portal restarts (unless it is started with --db or PROTON_QA_DB)."));
}

// Shown on Today when a database file is set but this page may not read it yet (after a restart, say).
async function databaseBanner() {
  if (!window.localApi) return null;
  const info = await api("GET", "/api/dbfile").catch(() => null);
  if (!info || !info.name || info.permission === "granted") return null;
  return el("div", { class: "card warn-card row" },
    el("span", {}, `The database file ${info.name} is not connected, so anything you record now stays only in this browser.`),
    el("button", { class: "primary", onclick: async () => {
      const p = await window.localDbFile.reconnect();
      toast(p === "granted" ? "Database file reconnected" : "Access was not granted", p !== "granted");
      route();
    } }, "Reconnect"));
}

// ---------------------------------------------------------------------------
// Machines and their scheduled queues
// ---------------------------------------------------------------------------

function machineForm(machine) {
  machine = machine || { active: 1 };
  return el("div", { class: "form-grid" },
    field("Name", el("input", { name: "name", value: machine.name || "", required: true, placeholder: "e.g. G1" })),
    field("Type", el("input", { name: "kind", value: machine.kind || "", placeholder: "e.g. Gantry, PBS" })),
    field("Location", el("input", { name: "location", value: machine.location || "" })),
    field("Notes", el("textarea", { name: "notes" }, machine.notes || ""), "wide"),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!machine.active }), "Active"));
}

// Machines: create machines and decide which QA lists each one runs, and how often. Same layout as Perform QA.
async function addListDialog(machine, assigned) {
  const all = await api("GET", "/api/queues");
  const offered = all.filter((q) => q.active && !assigned.some((a) => a.queue_id === q.id));
  if (!offered.length) return toast("Every QA list is already on this machine. Make a new one under Setup QA.", true);
  const sameKind = offered.find((t) => (t.name || "").toLowerCase().includes((machine.kind || "~").toLowerCase()));
  const pick = el("div", { class: "form-grid" },
    field("QA list", select("queue_id", offered.map((q) => [q.id, q.name]), (sameKind || offered[0]).id), "wide"),
    scheduleForm(null));
  modal(`Add a QA list to ${machine.name}`, pick, async (data, form) => {
    await api("POST", "/api/assignments", { ...scheduleData(data, form), machine_id: machine.id, queue_id: Number(data.queue_id) });
    toast("QA list added");
    route();
  }, "Add");
}

async function renderMachines() {
  const editable = can("configure");
  page("Machines", "Each machine and the QA lists it runs.", editable ? [el("button", {
    class: "primary",
    onclick: () => modal("Add machine", machineForm(), async (data) => {
      await api("POST", "/api/machines", data);
      toast("Machine added");
      route();
    }),
  }, "Add machine")] : []);
  const machines = await api("GET", "/api/machines");
  const assignments = Object.fromEntries(await Promise.all(machines.map(async (m) => [m.id, await api("GET", `/api/machines/${m.id}/assignments`)])));
  const queues = Object.fromEntries((await api("GET", "/api/queues")).map((q) => [q.id, q]));
  const active = machines.filter((m) => m.active);
  const scheduled = active.reduce((n, m) => n + assignments[m.id].filter((a) => a.active).length, 0);
  app.append(el("p", { class: "lead" }, `${active.length} machines · ${scheduled} scheduled QA ${scheduled === 1 ? "list" : "lists"}.`));
  if (!machines.length) return app.append(el("div", { class: "card empty" }, "No machines yet."));

  // Proton, then Photon (then any retired machines), all at the same width.
  for (const group of [...MODALITIES, "Retired"]) {
    const list = machines.filter((m) => (m.active ? modalityOf(m.kind) : "Retired") === group)
      .sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name));
    if (!list.length) continue;
    const rows = list.flatMap((machine) => {
      const mine = assignments[machine.id].filter((a) => (queues[a.queue_id] || {}).active !== 0);  // archived lists stay hidden
      const head = el("tr", { class: "machine-row" },
        el("td", { colspan: 4 }, el("strong", {}, machine.name), el("span", { class: "muted small" }, ` · ${[machine.kind, machine.location].filter(Boolean).join(" · ")}`),
          machine.active ? null : [" ", chip("", "Retired")]),
        el("td", { class: "right" }, editable ? el("div", { class: "row nowrap end" },
          el("button", { class: "small", onclick: () => addListDialog(machine, mine) }, "Add a QA list"),
          el("button", { class: "small", onclick: () => modal(`Edit ${machine.name}`, machineForm(machine), async (data) => {
            await api("PUT", `/api/machines/${machine.id}`, data);
            toast("Machine saved");
            route();
          }) }, "Edit machine")) : null));
      const lines = mine.length ? mine.map((a) => {
        const q = queues[a.queue_id] || {};
        return el("tr", { class: a.active ? "" : "muted" },
          el("td", { class: "indent" }, a.queue_name),
          el("td", {}, a.schedule),
          el("td", {}, chip(a.active ? a.state : "", scheduleStatus(a))),
          el("td", { class: "num" }, q.item_count ?? ""),
          el("td", { class: "right" }, el("div", { class: "row nowrap end" },
            el("a", { class: "button small", href: `#/queues/${a.queue_id}` }, editable ? "Edit tests" : "Tests"),
            editable ? el("a", { class: "button small", href: `#/assignments/${a.id}/limits` }, "Limits") : null,
            editable ? el("button", { class: "small", onclick: () => modal(`${a.queue_name}: schedule`, scheduleForm(a), async (d, form) => {
              await api("PUT", `/api/assignments/${a.id}`, scheduleData(d, form));
              toast("Schedule saved");
              route();
            }) }, "Schedule") : null,
            editable ? el("button", { class: "small", onclick: () => importSphinxDialog(a) }, "Import") : null)));
      }) : [el("tr", {}, el("td", { class: "indent muted", colspan: 5 }, "No QA lists yet."))];
      return [head, ...lines];
    });
    app.append(modalityHead(group, `${list.length} ${list.length === 1 ? "machine" : "machines"}`),
      fixedTable([["QA list", "28%"], ["Schedule", "17%"], ["Status", "14%"], ["#Tests", "7%"], ["", "34%"]], rows));
  }
}

function scheduleForm(assignment, queues) {
  const a = assignment || { frequency: "daily", weekdays: "0,1,2,3,4", start_date: today(), active: 1 };
  const chosen = new Set(String(a.weekdays || "").split(",").filter(Boolean).map(Number));
  const weekdayBox = field("Days", el("div", { class: "weekdays" }, WEEKDAYS.map((d, i) =>
    el("label", { class: "check" }, el("input", { type: "checkbox", "data-day": i, checked: chosen.has(i) }), d))), "wide");
  const intervalBox = field("Every (days)", el("input", { name: "interval_days", type: "number", min: 1, step: 1, value: a.interval_days || "" }));
  const freq = select("frequency", Object.entries(FREQ_LABEL), a.frequency);
  const sync = () => {
    weekdayBox.hidden = freq.value !== "daily";
    intervalBox.hidden = freq.value !== "custom";
  };
  freq.addEventListener("change", sync);
  sync();
  return el("div", { class: "form-grid" },
    queues ? field("QA queue", select("queue_id", [["", "Choose a queue"], ...queues.map((q) => [q.id, q.name])], "", { required: true }), "wide") : null,
    field("Frequency", freq),
    intervalBox,
    field("Start date", el("input", { type: "date", name: "start_date", value: a.start_date, required: true })),
    weekdayBox,
    importFolderField(a),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!a.active }), "Active"));
}

// Where this list's export files (Sphinx, DQA3, ...) appear, so the Perform page can offer them without a file dialog.
function importFolderField(a) {
  if (!window.localApi) {
    return field("Default import folder", el("input", { name: "import_folder", value: a.import_folder || "", placeholder: "e.g. G:\\My Drive\\ProtonDaily\\G1 Sphinx" }), "wide");
  }
  // Browser-only build: the folder is chosen with the browser's folder picker and remembered on this computer.
  const label = el("span", { class: "muted small" }, a.import_folder ? `Folder: ${a.import_folder}` : "No folder chosen.");
  if (!a.id) return field("Default import folder", el("div", {}, el("span", { class: "muted small" }, "Save this list first, then choose its folder under Change schedule.")), "wide");
  if (!("showDirectoryPicker" in window)) return field("Default import folder", el("div", {}, label, el("div", { class: "muted small" }, "Choosing a folder needs Chrome or Edge.")), "wide");
  const choose = el("button", { type: "button", onclick: async () => {
    try {
      const name = await window.localFolders.choose(a.id);
      label.textContent = `Folder: ${name}`;
      toast("Folder remembered for this list");
    } catch (err) {
      if (err.name !== "AbortError") toast(err.message, true);
    }
  } }, "Choose folder…");
  const clear = el("button", { type: "button", class: "link small", onclick: async () => {
    await window.localFolders.clear(a.id);
    label.textContent = "No folder chosen.";
  } }, "Clear");
  return field("Default import folder", el("div", { class: "row" }, choose, clear, label), "wide");
}

// The files waiting in a list's default folder, newest first, each with a button that loads it into the form.
// Perform: the newest export not yet recorded is read in from the list's folder on its own; this is the one line that says so.
function autoReadLine(assignmentId, onPick) {
  const line = el("div", { class: "muted small auto-read" }, "Checking the folder for a new export…");
  (async () => {
    try {
      const r = await api("GET", `/api/assignments/${assignmentId}/files`);
      if (r.permission && r.permission !== "granted") {
        line.replaceChildren(el("span", {}, `The folder "${r.folder}" needs permission again. `),
          el("button", { class: "link small", onclick: async () => { await window.localFolders.request(assignmentId); route(); } }, "Allow"));
        return;
      }
      const newest = r.files.find((f) => !f.run_id);
      if (!newest) {
        const last = r.files[0];
        line.replaceChildren(el("span", {}, "No new export in the folder.", last ? [` Newest, ${last.name}, is already recorded as `, el("a", { href: `#/runs/${last.run_id}` }, `run #${last.run_id}`), "."] : ""));
        return;
      }
      onPick(await api("GET", `/api/assignments/${assignmentId}/file?path=${encodeURIComponent(newest.path)}`));
      line.replaceChildren(el("span", { class: "chip pass" }, "Read in"), ` ${newest.name} (${newest.modified.replace("T", " ")}) from the folder. Choose a different file below if that is not today's.`);
    } catch (err) {
      line.replaceChildren(el("span", { class: "error" }, err.message));
    }
  })();
  return line;
}

function importFolderCard(assignmentId, onPick) {
  const body = el("div", { class: "small" }, "Looking in the folder…");
  const card = el("div", { class: "card step" }, el("strong", {}, "Files in the default folder"), body);
  const load = async () => {
    try {
      const r = await api("GET", `/api/assignments/${assignmentId}/files`);
      if (r.permission === "prompt" || r.permission === "denied") {
        body.replaceChildren(el("div", { class: "row" }, `Allow this page to read "${r.folder}" again.`,
          el("button", { onclick: async () => { await window.localFolders.request(assignmentId); load(); } }, "Allow access")));
        return;
      }
      if (r.permission === "none" && window.localApi) {
        body.replaceChildren(el("span", { class: "muted" }, `The folder "${r.folder}" was chosen on another computer. Choose it again under Change schedule.`));
        return;
      }
      if (!r.files.length) {
        body.replaceChildren(el("span", { class: "muted" }, `No export files in ${r.folder}.`));
        return;
      }
      const newest = r.files.find((f) => !f.run_id);
      if (newest && !card.dataset.autoRead) {
        card.dataset.autoRead = "1";
        api("GET", `/api/assignments/${assignmentId}/file?path=${encodeURIComponent(newest.path)}`)
          .then((file) => { onPick(file); toast(`Read in ${newest.name} automatically`); })
          .catch((err) => toast(err.message, true));
      }
      body.replaceChildren(
        el("div", { class: "muted small" }, `${r.folder} · newest first`),
        el("table", { class: "compact" }, el("tbody", {}, r.files.map((f) => el("tr", {},
          el("td", {}, f === newest ? el("strong", {}, f.path) : f.path),
          el("td", { class: "muted small" }, f.modified.replace("T", " ")),
          el("td", { class: "small" }, f.run_id ? el("span", { class: "muted" }, "Recorded as ", el("a", { href: `#/runs/${f.run_id}` }, `run #${f.run_id}`), ` (${f.qa_date})`) : ""),
          el("td", {}, el("button", { class: f === newest ? "primary small" : "small", onclick: async () => {
            try { onPick(await api("GET", `/api/assignments/${assignmentId}/file?path=${encodeURIComponent(f.path)}`)); }
            catch (err) { toast(err.message, true); }
          } }, f === newest ? "Use newest" : "Use")))))));
    } catch (err) {
      body.replaceChildren(el("span", { class: "error" }, err.message));
    }
  };
  load();
  return card;
}

function scheduleData(data, form) {
  data.weekdays = [...form.querySelectorAll("[data-day]")].filter((n) => n.checked).map((n) => Number(n.dataset.day));
  return data;
}

async function renderMachine(id) {
  const [machines, assignments] = await Promise.all([api("GET", "/api/machines"), api("GET", `/api/machines/${id}/assignments`)]);
  const machine = machines.find((m) => String(m.id) === id);
  if (!machine) throw new Error("Machine not found.");
  const actions = [];
  if (can("configure")) {
    actions.push(el("button", { onclick: () => modal(`Edit ${machine.name}`, machineForm(machine), async (data) => {
      await api("PUT", `/api/machines/${id}`, data);
      toast("Machine saved");
      route();
    }) }, "Edit"));
    actions.push(el("button", { class: "primary", onclick: async () => {
      const all = await api("GET", "/api/queues");
      const offered = all.filter((q) => q.active && !assignments.some((a) => a.queue_id === q.id));
      if (!offered.length) return toast("Every QA list is already on this machine. Make a new one under Setup QA.", true);
      const pick = el("div", { class: "form-grid" },
        field("QA list", select("queue_id", offered.map((q) => [q.id, q.name]), offered[0].id), "wide"),
        scheduleForm(null));
      modal(`Add a QA list to ${machine.name}`, pick, async (data, form) => {
        await api("POST", "/api/assignments", { ...scheduleData(data, form), machine_id: Number(id), queue_id: Number(data.queue_id) });
        toast("QA list added");
        route();
      }, "Add");
    } }, "Add a QA list"));
  }
  page(machine.name, [machine.kind, machine.location, machine.active ? null : "Retired"].filter(Boolean).join(" · "), actions);
  if (machine.notes) app.append(el("p", { class: "muted" }, machine.notes));
  if (!assignments.length) {
    app.append(el("div", { class: "card empty" }, "No QA lists scheduled on this machine yet."));
    return;
  }
  app.append(el("div", { class: "stack" }, assignments.map((a) => {
    const due = a.active && startable(a.state);
    const status = scheduleStatus(a);
    const more = can("configure") ? el("details", { class: "more" }, el("summary", { class: "button" }, "More"),
      el("div", { class: "menu" },
        el("button", { class: "link", onclick: () => modal(`${a.queue_name}: schedule`, scheduleForm(a), async (data, form) => {
          await api("PUT", `/api/assignments/${a.id}`, scheduleData(data, form));
          toast("Schedule saved");
          route();
        }) }, "Change schedule"),
        el("a", { href: `#/assignments/${a.id}/limits` }, "Adjust limits for this machine"),
        el("a", { href: `#/queues/${a.queue_id}` }, "Edit the tests in this list"),
        el("button", { class: "link", onclick: () => importSphinxDialog(a) }, "Import past Sphinx files"))) : null;
    return el("div", { class: "card list-row" },
      el("div", {}, el("strong", {}, a.queue_name), el("div", { class: "muted small" }, a.schedule)),
      chip(a.active ? a.state : "", status),
      el("div", { class: "row" },
        due && can("perform") ? el("a", { class: a.state === "ready" ? "button" : "button primary", href: `#/perform/${a.id}` }, "Start") : null,
        el("a", { class: "button", href: `#/runs?machine_id=${id}&queue_id=${a.queue_id}` }, "History"),
        more));
  })));
}

async function renderLimits(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  page(`Limits: ${t.queue.name}`,
    "Only fill in what is different on this machine. Blank fields use the list's value, shown in grey.");
  const numeric = t.items.filter((i) => i.type === "numeric");
  if (!numeric.length) {
    app.append(el("div", { class: "card empty" }, "This list has no measured values."));
    return;
  }
  const rows = numeric.map((item) => {
    const o = item.override || {};
    const q = item.queue_limits;
    return el("tr", { "data-test": item.test_id, class: "compact" },
      el("td", {}, el("strong", {}, item.name), item.unit ? el("div", { class: "muted small" }, item.unit) : null),
      el("td", {}, el("input", { name: "expected", type: "number", step: "any", value: o.expected ?? "", placeholder: fmt(q.expected) })),
      el("td", {}, el("input", { name: "warn", type: "number", step: "any", min: 0, value: o.warn ?? "", placeholder: fmt(q.warn) })),
      el("td", {}, el("input", { name: "fail", type: "number", step: "any", min: 0, value: o.fail ?? "", placeholder: fmt(q.fail) })),
      el("td", {}, select("tol_mode", [["absolute", "Absolute"], ["percent", "Percent"]], o.tol_mode || q.tol_mode || "absolute")));
  });
  app.append(table(["Test", "Expected", "Warning ±", "Action ±", "Limits are"], rows));
  const error = el("p", { class: "error" });
  app.append(error, el("div", { class: "row" },
    el("a", { class: "button", href: `#/machines/${t.machine.id}` }, "Back"),
    el("button", { class: "primary", onclick: async () => {
      error.textContent = "";
      const overrides = rows.map((row) => {
        const data = { test_id: Number(row.dataset.test) };
        row.querySelectorAll("[name]").forEach((n) => (data[n.name] = n.value));
        return data;
      });
      try {
        await api("PUT", `/api/assignments/${assignmentId}/overrides`, { overrides });
        toast("Limits saved");
        location.hash = `#/machines/${t.machine.id}`;
      } catch (err) {
        error.textContent = err.message;
      }
    } }, "Save limits")));
}

// ---------------------------------------------------------------------------
// Performing a QA list
// ---------------------------------------------------------------------------

function passFailInput(name, withWarning, yesNo) {
  // A hidden value plus big buttons: one tap instead of opening a dropdown.
  // Pass / Fail for boolean tests; Pass / Warning / Fail for status tests (as on a RadMachine checklist).
  const value = el("input", { type: "hidden" });
  const buttons = [];
  const pick = (v) => () => {
    value.value = value.value === v ? "" : v;
    for (const b of buttons) b.classList.toggle("on", value.value === b.dataset.value);
    value.dispatchEvent(new Event("input"));
  };
  // Checks copied from RadMachine read Yes / No (Yes = pass); their unit is set to "Yes/No".
  const choices = withWarning ? [["pass", "Pass"], ["warn", "Warning"], ["fail", "Fail"]] : yesNo ? [["pass", "Yes"], ["fail", "No"]] : [["pass", "Pass"], ["fail", "Fail"]];
  for (const [v, label] of choices) {
    buttons.push(el("button", { type: "button", class: `seg ${v}`, "data-value": v, "aria-label": `${name}: ${label.toLowerCase()}`, onclick: pick(v) }, label));
  }
  return { value, control: el("div", { class: "segmented" }, ...buttons, value) };
}

// Directions are shown with the test, numbered as in the template (1.01, 2.04, ...).
const TEMPLATE_NUMBER = /^Template (\d+)\.(\d+)\.\s*/;
// Lists copied from RadMachine keep its own section names: "Template 1.04. [Section: PBS DailyQA GTR5 - Sphinx] ...".
const SECTION_NAME = /\[Section: ([^\]]+)\]\s*/;
const MARKER = /\[(auto|calc): ((?:[^\[\]]|\[[^\]]*\])+)\]\s*/;
const DEFAULT_MARK = /\[default: ([^\]]+)\]\s*/;         // "[default: Therapist]": the value a text field starts with   // the rule may itself contain "[mm]"         // "[auto: user]" / "[calc: 3d-offset]": the Perform page does it
const sectionNameOf = (item) => { const m = SECTION_NAME.exec(item.description || ""); return m ? m[1] : null; };
function helpText(description, { inline = false } = {}) {
  if (!description || description.startsWith("Measured by Sphinx")) return null;
  const text = description.replace(TEMPLATE_NUMBER, "").replace(SECTION_NAME, "").replace(MARKER, "").replace(DEFAULT_MARK, "").trim();
  if (!text) return null;
  if (inline) {                                        // a quiet one-liner under the test name; the whole text on hover
    const one = text.replace(/\s+/g, " ");
    return el("span", { class: "qa-sub", title: text }, one.length > 150 ? `${one.slice(0, 148)}…` : one);
  }
  return el("div", { class: "directions pre" }, el("div", { class: "directions-label" }, "Directions"), text);
}

// Which numbered section a test belongs to: the template number in its directions ("Template 2.03.") when
// it has one, otherwise by category. Sphinx measurements have no number and all belong to the dosimetry section.
function sectionNumber(item) {
  const m = TEMPLATE_NUMBER.exec(item.description || "");
  if (m) return Number(m[1]);
  const c = (item.category || "").toLowerCase();
  if (c.startsWith("safety")) return 1;
  if (c.startsWith("mechanical") || c.includes("cbct") || c.includes("imaging")) return 2;
  if (["energy", "spot", "coincidence", "homogeneity", "output", "couch translation", "dosimetry"].includes(c) || c.includes("sphinx")) return 3;
  return 4;
}

// Heading for a section: its number plus the categories in it (or a generic name when there are many).
function sectionTitle(number, categories, named) {
  if (named) return `${number}.0 ${named}`;
  const names = [...new Set(categories.map((c) => c || "General"))];
  const generic = { 0: "Setup", 1: "Safety", 2: "Mechanical and imaging", 3: "Sphinx Measurements", 4: "Other" };
  const label = number === 0 ? generic[0] : names.length <= 2 ? names.join(" and ") : (generic[number] || "Other");
  return `${number}.0 ${label}`;
}

// How a category reads on screen; the data keeps the Sphinx sheet names ("Spot").
const CATEGORY_LABEL = { Spot: "Spot Characteristics" };
const categoryLabel = (c) => CATEGORY_LABEL[c] || c;

// Section label for a test on its own (Trends), e.g. "3.0 Sphinx Measurements".
function sectionOf(item) {
  const n = sectionNumber(item);
  return sectionTitle(n, n === 3 || n === 4 ? [] : [item.category]).replace(/^(\d)\.0 $/, (_, d) => `${d}.0 ${{ 3: "Sphinx Measurements", 4: "Other" }[d]}`);
}

// What a Sphinx-style test measures, independent of wording (mirrors sphinx.canonical_key / local-backend canonicalKey).
const MEASURE_RULES = [[/distal fall ?off|\bdfo\b/, "dfo"], [/distal depth/, "distal"], [/proximal depth/, "proximal"],
  [/\bpos(ition)? x\b/, "pos_x"], [/\bpos(ition)? y\b/, "pos_y"], [/sigma x/, "sigma_x"], [/sigma y/, "sigma_y"],
  [/skewness x/, "skew_x"], [/skewness y/, "skew_y"], [/intensity/, "intensity"], [/homogeneity|flatness/, "flatness"],
  [/absolute dose/, "output"], [/coincidence.*(x offset|distance x)/, "coin_x"], [/coincidence.*(y offset|distance y)/, "coin_y"], [/\bwidth\b/, "width"]];
function measureParts(name) {
  const n = String(name || "").toLowerCase().replace(/\s+/g, " ");
  const hit = MEASURE_RULES.find(([re]) => re.test(n));
  if (!hit) return null;
  const energy = /(\d+(?:\.\d+)?)\s*MeV/i.exec(name);
  const spot = /spot ?(\d+)/i.exec(name);
  if (!energy && !spot) return null;                       // one-off values (flatness, output) stay as single rows
  // "GTR5_Energy [100.00 MeV]: Distal Depth [mm]" -> "Distal Depth [mm]"; "Energy [100 MeV] – Distal Depth" -> "Distal Depth".
  const tail = name.includes(": ") ? name.slice(name.lastIndexOf(": ") + 2) : name.includes(" – ") ? name.slice(name.lastIndexOf(" – ") + 3) : name;
  const metricLabel = tail.replace(/^spot\s*\d+\s*/i, "").trim();
  const rowLabel = energy ? `${Number(energy[1])} MeV` : spot ? `Spot ${spot[1]}` : "";
  return { metric: hit[1], metricLabel, rowLabel, sortKey: (spot ? Number(spot[1]) : 0) * 10000 + (energy ? Number(energy[1]) : 0) };
}

function blockNumbers(items) {
  const out = new Map();
  const counter = {};
  const next = (item) => { const n = sectionNumber(item); counter[n] = (counter[n] || 0) + 1; return `${n}.${String(counter[n]).padStart(2, "0")}`; };
  const bySection = new Map();
  for (const it of items) { const n = sectionNumber(it); if (!bySection.has(n)) bySection.set(n, []); bySection.get(n).push(it); }
  for (const list of bySection.values()) {
    const families = new Map();
    for (const it of list) {
      const mp = it.type === "numeric" ? measureParts(it.name) : null;
      if (!mp) continue;
      const key = `${mp.metric}|${it.unit || ""}|${it.category || ""}`;
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(it);
    }
    const familyOf = new Map();
    for (const f of families.values()) if (f.length > 1) for (const it of f) familyOf.set(it.test_id, f);
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (out.has(it.test_id)) continue;
      const fam = familyOf.get(it.test_id);
      if (fam) { const n = next(it); for (const m of fam) out.set(m.test_id, n); continue; }
      const a = axisParts(it.name), b = axisParts((list[i + 1] || {}).name), c = axisParts((list[i + 2] || {}).name);
      if (a && b && c && a.axis === "X" && b.axis === "Y" && c.axis === "Z" && a.base === b.base && b.base === c.base) {
        const n = next(it);
        const group = [list[i], list[i + 1], list[i + 2]];
        const calc = list[i + 3];
        if (calc && /\[calc: 3d-offset\]/.test(calc.description || "")) group.push(calc);
        for (const m of group) out.set(m.test_id, n);
        i += group.length - 1;
        continue;
      }
      out.set(it.test_id, next(it));
    }
  }
  return out;
}

function checkNumber(description) {
  const m = /^Template (\d+\.\d+)\./.exec(description || "");
  return m ? m[1] : "";
}

// Fields marked [auto: …] or [calc: …] in their directions are filled here instead of typed:
// the signed-in user, a 3D offset from the X, Y, Z fields above it, kTP, a product, or the daily output dose.
function wireCalculations(entries) {
  const byName = (re) => entries.find((e) => re.test(e.item.name));
  const num = (e) => (e && e.input.value.trim() !== "" ? Number(e.input.value) : NaN);
  const lock = (e, title) => { e.input.readOnly = true; e.input.classList.add("from-file"); e.input.placeholder = "calculated"; e.input.title = title; };
  const set = (e, v, decimals) => { e.input.value = Number.isFinite(v) ? v.toFixed(decimals) : ""; e.input.dispatchEvent(new Event("input")); };
  entries.forEach((e, i) => {
    if (e.item.type === "text" && !e.input.value && !/\[auto: performer\]/.test(e.item.description || "")) {
      const d = DEFAULT_MARK.exec(e.item.description || "");
      const start = e.item.last_text || (d && d[1].trim());
      if (start) { e.input.value = start; e.input.title = e.item.last_text ? "As recorded last time; change it if different" : "Usual value; change it if different"; }
    }
    const m = MARKER.exec(e.item.description || "");
    if (!m) return;
    const kind = m[2].trim();
    if (m[1] === "auto" && kind === "sphinx-finished") {
      e.input.readOnly = true;
      e.input.placeholder = "from file";
      e.input.classList.add("from-file");
      e.input.title = "Acquisition date and time from the Sphinx export";
      return;
    }
    if (m[1] === "auto" && kind === "performer") {
      if (!e.input.value) e.input.value = state.user.full_name || state.user.username;   // the signed-in user, unless someone else did the QA
      e.input.title = "Starts as the signed-in user; change it if someone else performed the QA";
      return;
    }
    if (m[1] === "auto" && kind === "user") {
      e.input.value = state.user.full_name || state.user.username;
      e.input.readOnly = true;
      e.input.title = "Filled in with the signed-in user";
      return;
    }
    let sources = [], compute = null, decimals = 2;
    if (kind.startsWith("sum")) {                              // "[calc: sum:3]": the sum of the N numeric fields above
      const count = Number(kind.split(":")[1]) || 2;
      sources = entries.slice(0, i).filter((x) => x.item.type === "numeric").slice(-count);
      compute = (v) => v.reduce((a, b) => a + b, 0);
    } else if (kind === "3d-offset") {
      sources = entries.slice(Math.max(0, i - 3), i).filter((x) => x.item.type === "numeric");
      compute = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    } else if (kind === "ktp") {
      sources = [byName(/chamber temperature|air temperature|temperature \[/i), byName(/air pressure|pressure \[/i)].filter(Boolean);
      const hPa = sources[1] && /hpa/i.test(sources[1].item.unit || "");
      compute = ([t, pr]) => ((273.15 + t) / (273.15 + 22)) * ((hPa ? 1013.25 : 101.325) / pr);   // TG-51 reference conditions
      decimals = 4;
    } else if (kind === "dose-ndw") {
      // Monthly output: dose [cGy] = M [nC] × kTP × N_Dw [cGy/nC] × k_Q × k_s × k_pol, with M the charge entered just above.
      const charge = entries.slice(0, i).filter((x) => x.item.type === "numeric").slice(-1);
      sources = [...charge, byName(/temp\.? & press\.? correction|k_?tp/i), byName(/n_?dw/i), byName(/\bk_?q\b/i), byName(/\bk_?s\b/i), byName(/\bk_?pol\b/i)].filter(Boolean);
      compute = (v) => v.reduce((a, b) => a * b, 1);
    } else if (/^(max|range):/.test(kind)) {
      // "[calc: max:<text>:N]" / "[calc: range:<text>:N]": over the last N fields above whose name contains <text>.
      const [, op, text, count] = /^(max|range):(.*):(\d+)$/.exec(kind) || [];
      sources = entries.slice(0, i).filter((x) => x.item.type === "numeric" && x.item.name.includes(text)).slice(-Number(count || 0));
      compute = (v) => (op === "max" ? Math.max(...v.map(Math.abs)) : Math.max(...v) - Math.min(...v));
    } else if (kind === "product") {
      sources = [byName(/chamber cal\.? factor/i), byName(/electrometer calibration factor/i)].filter(Boolean);
      compute = ([a, b]) => a * b;
      decimals = 4;
    } else if (kind === "dose") {
      sources = [byName(/charge \[nC\]/i), byName(/overall calibration factor/i), byName(/temp\.? & press\.? correction/i)].filter(Boolean);
      compute = ([q, f, k]) => q * 1e-9 * f * k * 100;
    }
    if (!compute || !sources.length) return;
    lock(e, "Calculated from the fields it depends on");
    const update = () => { const v = sources.map(num); set(e, v.some((x) => !Number.isFinite(x)) ? NaN : compute(v), decimals); };
    sources.forEach((src) => src.input.addEventListener("input", update));
  });
}

async function renderPerform(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  const history = t.items.some((i) => i.type === "numeric") ? await api("GET", `/api/machines/${t.machine.id}/trends`).catch(() => ({})) : {};
  page(`${t.machine.name} · ${t.queue.name}`, t.assignment.schedule);
  app.querySelector(".page-head").classList.add("sticky-head");        // the machine and list stay in view while scrolling
  if (t.queue.description) {
    app.append(el("details", { class: "card instructions", open: true }, el("summary", {}, el("strong", {}, "Protocol")), el("div", { class: "pre" }, t.queue.description)));
  }
  const inputs = [];
  const sections = [];
  const progress = el("span");
  const overallChip = el("span");
  const refresh = () => {
    const statuses = inputs.map((i) => i.status());
    const worst = statuses.filter(Boolean).reduce((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), "pass");
    const required = inputs.filter((i) => i.required);
    const done = required.filter((i) => i.status()).length;
    progress.textContent = `${done} of ${required.length} done`;
    overallChip.replaceChildren(done && done === required.length ? chip(worst) : statuses.some((s) => s === "fail" || s === "warn") ? chip(worst, `${STATUS_LABEL[worst] || capitalize(worst)} so far`) : "");
    for (const s of sections) s.refresh();
  };
  const named = t.items.some((i) => sectionNameOf(i));
  const numbers = blockNumbers(t.items);
  const byCategory = new Map();
  for (const item of t.items) {
    const key = named ? `${sectionNumber(item)}|${sectionNameOf(item) || ""}` : `${sectionNumber(item)}|${item.category || "General"}`;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(item);
  }
  const sectionCategories = new Map();
  for (const key of byCategory.keys()) {
    const [n, category] = key.split("|");
    if (!sectionCategories.has(n)) sectionCategories.set(n, []);
    sectionCategories.get(n).push(category);
  }
  let lastSection = null;
  for (const [key, items] of [...byCategory].sort(([a], [b]) => Number(a.split("|")[0]) - Number(b.split("|")[0]))) {
    const [n, category] = key.split("|");
    const section = sectionTitle(Number(n), sectionCategories.get(n), named ? category : null);
    const heading = section !== lastSection ? el("h2", { class: "section-head" }, section) : null;
    lastSection = section;
    const rows = [];
    const entries = [];
    const buildEntry = (item) => {
      let input, control;
      if (item.type === "boolean" || item.type === "status") ({ value: input, control } = passFailInput(item.name, item.type === "status", item.unit === "Yes/No"));
      else if (item.type === "numeric") {
        // Sphinx measurements are read from the export file, never typed in.
        const fromFile = !!measureParts(item.name) || /^Measured by Sphinx/.test(item.description || "");
        control = input = el("input", { type: "number", step: "any", class: `result-input${fromFile ? " from-file" : ""}`, "aria-label": item.name,
          readonly: fromFile ? "" : null, placeholder: fromFile ? "from file" : null, title: fromFile ? "Filled from the Sphinx export file" : null });
      }
      else control = input = el("input", { type: "text", class: "text-input", "aria-label": item.name });
      const comment = el("input", { type: "text", placeholder: "Note", class: "note-input", hidden: true, "aria-label": `${item.name} note` });
      const noteToggle = el("button", { type: "button", class: "link small", onclick: () => { comment.hidden = false; noteToggle.hidden = true; comment.focus(); } }, "+ note");
      const note = el("div", { class: "muted small" });
      const statusCell = el("div", { class: "status-cell" });
      const entry = {
        item, input, comment, note, required: item.type !== "text",
        status() {
          const raw = input.value.trim();
          if (!raw) return null;
          if (item.type === "numeric") return Number.isFinite(Number(raw)) ? evaluate("numeric", Number(raw), item.limits) : null;
          return evaluate(item.type, raw, item.limits);
        },
      };
      const update = () => {
        const s = entry.status();
        statusCell.replaceChildren(s ? chip(s) : "");
        if (s === "warn" || s === "fail") { comment.hidden = false; noteToggle.hidden = true; }
        refresh();
      };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
      inputs.push(entry);
      entries.push(entry);
      return { entry, control, comment, noteToggle, note, statusCell };
    };
    // Measurements repeated per energy or spot (distal depth, sigma X, ...) are shown together as one table.
    const families = new Map();
    for (const item of items) {
      const mp = item.type === "numeric" ? measureParts(item.name) : null;
      if (!mp) continue;
      const key = `${mp.metric}|${item.unit || ""}`;
      if (!families.has(key)) families.set(key, []);
      families.get(key).push({ item, mp });
    }
    const grouped = new Set([...families.values()].filter((f) => f.length > 1).flatMap((f) => f.map((x) => x.item.test_id)));
    const drawn = new Set();
    const limitText = (v, limits, unit) => (v === null || v === undefined ? el("span", { class: "muted" }, "—") : `±${fmt(v)} ${limits.tol_mode === "percent" ? "%" : unit || ""}`.trim());
    const dateLabel = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    const dateSlot = (d) => { const dt = new Date(d + "T00:00"); return el("span", { class: "hist date", title: dateLabel(d) },
      el("div", {}, dt.toLocaleDateString(undefined, { day: "numeric", month: "short" })), el("div", { class: "yr" }, String(dt.getFullYear()))); };
    // Every measured (numeric) test is a row in a table: Measurement, Reference, Tolerance, Action, Status, Comment,
    // History (under its QA dates) and Trends. Repeated measurements (per energy or spot) share a titled table.
    const measureTable = (members, { firstHeader, title, directions, firstCell, label }) => {
      const tests = members.flatMap((m) => (m.axes ? [...m.axes, ...(m.calc ? [m.calc] : [])] : [m]));
      const dates = [...new Set(tests.flatMap((it) => (history[it.test_id] || []).map((h) => h.qa_date)))].sort().slice(-3).reverse();
      const dp = decimalsOf(tests.flatMap((it) => [...(history[it.test_id] || []).slice(-5).map((h) => h.value), (it.limits || {}).expected]));
      const histChips = (it, unit) => {
        const byDate = new Map((history[it.test_id] || []).map((h) => [h.qa_date, h]));
        return el("span", { class: "hist-row" }, dates.map((d) => byDate.get(d) || null).map((h) => h ? el("span", { class: `hist ${h.status}`, title: `${dateLabel(h.qa_date)}: ${fmt(h.value, dp)} ${unit}${h.expected !== null && h.expected !== undefined ? ` (Δ ${signed(h.value - h.expected)} ${unit})` : ""}`.trim() }, `${fmt(h.value, dp)}${unit ? ` ${unit}` : ""}`) : el("span", { class: "hist empty" }, "—")));
      };
      const refCell = (it, unit) => (it.limits.expected !== null && it.limits.expected !== undefined ? `${fmt(it.limits.expected, dp)} ${unit}`.trim() : el("span", { class: "muted" }, "—"));
      const limitsLine = (it, unit) => {
        if (it.type !== "numeric") return null;
        const l = it.limits || {};
        const suf = l.tol_mode === "percent" ? "%" : unit;
        const parts = [];
        if (l.warn !== null && l.warn !== undefined) parts.push(`WARNING ±${fmt(l.warn)} ${suf}`.trim());
        if (l.fail !== null && l.fail !== undefined) parts.push(`ACTION ±${fmt(l.fail)} ${suf}`.trim());
        return parts.length ? el("span", { class: "qa-limits" }, parts.join(" · ")) : null;
      };
      const numberCell = (it) => (firstHeader !== "Test"
        ? (it === members[0] ? el("td", { class: "qa-n qa-n-span", rowspan: members.length * 2 }, numbers.get(it.test_id) || "") : null)
        : el("td", { class: "qa-n" }, numbers.get(it.test_id) || ""));
      const trRows = members.map((it) => {
        drawn.add(it.test_id);
        const unit = it.unit && it.unit !== "unitless" ? it.unit : "";
        const { control, comment, noteToggle, note, statusCell } = buildEntry(it);
        noteToggle.textContent = "✎"; noteToggle.title = "Add a note"; noteToggle.className = "icon-btn note-btn";   // the note box appears on demand
        const chart = el("tr", { class: "quick-trend", hidden: true }, el("td", { colspan: 10 }));
        const trend = el("button", { type: "button", class: "icon-btn", title: "Show the trend here", onclick: () => {
          const pts = (history[it.test_id] || []).slice(-60);
          if (!pts.length) return toast("No results yet for this test.", true);
          if (chart.hidden) chart.firstChild.replaceChildren(
            el("div", { class: "row" }, el("strong", {}, label(it)), el("span", { class: "spacer" }),
              el("a", { class: "small", href: `#/trends?machine_id=${t.machine.id}&test_id=${it.test_id}&range=365` }, "Full trend")),
            seriesChart([{ label: it.name, points: pts }], unit, { small: true, yLabel: yAxisLabel([it.name]) }));
          chart.hidden = !chart.hidden;
        } }, trendIcon(16));
        const dlt = el("div", { class: "delta-slot" });
        const showDelta = () => { const v = Number(control.value); dlt.replaceChildren(...present([control.value.trim() !== "" ? deltaBadge(v, it.limits, unit) : null])); };
        control.addEventListener("input", showDelta);
        const row = el("tr", {},
          numberCell(it),
          el("td", { class: "qa-label" }, firstCell(it), firstHeader === "Test" ? limitsLine(it, unit) : null, note),
          el("td", { class: "qa-unit" }, it.type === "numeric" ? unit : it.type === "boolean" ? (it.unit === "Yes/No" ? "Yes / No" : "Pass / Fail") : ""),
          el("td", { class: "num" }, it.type === "numeric" ? refCell(it, unit) : el("span", { class: "muted" }, "—")),
          el("td", { class: "qa-measured" }, control),
          el("td", { class: "qa-dev" }, dlt),
          el("td", {}, statusCell),
          el("td", { class: "qa-comment" }, noteToggle, comment),
          el("td", { class: "history-cell" }, dates.length ? histChips(it, unit) : el("span", { class: "muted small" }, "—")),
          el("td", {}, trend));
        return [row, chart];
      });
      const widths = firstHeader !== "Test" ? ["3%", "19%", "5%", "9%", "12%", "9%", "8%", "6%", "25%", "4%"] : ["3%", "30%", "5%", "7%", "13%", "8%", "8%", "5%", "17%", "4%"];
      const tableEl = sortable(el("table", { class: `measure-table${firstHeader === "Axis" ? " axis-table" : ""}${firstHeader !== "Test" ? " energy-table" : ""}` },
          el("colgroup", {}, widths.map((w) => { const col = el("col"); col.style.width = w; return col; })),
          el("thead", {}, el("tr", {}, ["#", firstHeader, "Unit", "Baseline", "Measured", "Deviation", "Result", "Comment", "History", "Trends"].map((h) => el("th", {}, h))),
            dates.length ? el("tr", { class: "hist-dates" }, ...Array.from({ length: 8 }, () => el("th", {})),
              el("th", { class: "history-cell" }, el("span", { class: "hist-row" }, dates.map(dateSlot))), el("th", {})) : null),
          el("tbody", {}, trRows.flat())));
      // Only as many history dates as fit on one line of the History column (re-checked when the window is resized).
      const fitHistory = () => {
        const th = tableEl.querySelector("th.history-cell");
        if (!th || !th.clientWidth) return;
        const n = Math.max(1, Math.min(dates.length, Math.floor((th.clientWidth - 10) / 58)));
        tableEl.querySelectorAll(".hist-row").forEach((row) => [...row.children].forEach((c, i) => { c.hidden = i >= n; }));
      };
      requestAnimationFrame(fitHistory);
      window.addEventListener("resize", fitHistory);
      // Axis and energy tables carry the shared limits in their title rather than on every row.
      if (title && firstHeader !== "Test") {
        const withLimits = members.find((it) => it.type === "numeric" && it.limits && (it.limits.warn !== null || it.limits.fail !== null));
        const line = withLimits && limitsLine(withLimits, withLimits.unit && withLimits.unit !== "unitless" ? withLimits.unit : "");
        if (line) title.append(line);
      }
      return el("div", { class: "measure-block" }, title, directions, el("div", { class: "table-wrap measure-wrap" }, tableEl));
    };
    const shortName = (it) => it.name.startsWith(category + " – ") ? it.name.slice(category.length + 3) : it.name;
    // Single measurements that follow one another share one table; the row carries the number, name and directions.
    let pending = [];
    const foldAxes = (list) => {
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const a = axisParts(list[i].name), b = axisParts((list[i + 1] || {}).name), c = axisParts((list[i + 2] || {}).name);
        if (a && b && c && a.axis === "X" && b.axis === "Y" && c.axis === "Z" && a.base === b.base && b.base === c.base) {
          const next = list[i + 3];
          const calc = next && /\[calc: 3d-offset\]/.test(next.description || "") ? next : null;
          out.push({ axes: [list[i], list[i + 1], list[i + 2]].map((it, k) => ({ ...it, axis: "XYZ"[k] })), calc, base: a.base, unitTag: a.unitTag });
          i += calc ? 3 : 2;
        } else out.push(list[i]);
      }
      return out;
    };
    const flush = () => {
      if (!pending.length) return;
      let plain = [];
      const emitPlain = () => {
        if (plain.length) rows.push(measureTable(plain, { firstHeader: "Test", title: null, directions: null, label: shortName,
          firstCell: (it) => [el("strong", {}, shortName(it)), helpText(it.description, { inline: true })] }));
        plain = [];
      };
      for (const m of foldAxes(pending)) {
        if (!m.axes) { plain.push(m); continue; }
        emitPlain();
        // An X / Y / Z offset (and its 3D magnitude) as a titled table with one row per axis, like the Sphinx tables.
        const members = [...m.axes.map((it, k) => ({ ...it, axisLabel: "XYZ"[k] })), ...(m.calc ? [{ ...m.calc, axisLabel: "3D" }] : [])];
        rows.push(measureTable(members, {
          firstHeader: "Axis",
          title: el("div", { class: "measure-title" }, el("strong", {}, m.base, m.unitTag ? ` ${m.unitTag}` : ""),
            helpText((m.calc || m.axes[0]).description, { inline: true })),
          directions: null,
          label: (it) => `${m.base} ${it.axisLabel}`,
          firstCell: (it) => el("strong", {}, it.axisLabel),
        }));
      }
      emitPlain();
      pending = [];
    };
    for (const item of items) {
      if (drawn.has(item.test_id)) continue;
      if (!grouped.has(item.test_id)) { pending.push(item); continue; }
      flush();
      const mp0 = measureParts(item.name);
      const family = families.get(`${mp0.metric}|${item.unit || ""}`).slice().sort((a, b) => a.mp.sortKey - b.mp.sortKey);
      rows.push(measureTable(family.map((f) => f.item), {
        firstHeader: "Energy",
        title: el("div", { class: "measure-title" }, el("strong", {}, mp0.metricLabel), helpText(item.description, { inline: true })),
        directions: null,
        firstCell: (it) => el("strong", {}, measureParts(it.name).rowLabel),
        label: (it) => { const mp = measureParts(it.name); return `${mp.rowLabel} · ${mp.metricLabel}`; },
      }));
    }
    flush();
    const summary = el("span", { class: "section-summary" });
    const box = el("details", { class: "card section", open: true }, el("summary", {}, el("strong", {}, categoryLabel(category)), summary), rows);
    sections.push({
      box, heading, entries, section,
      refresh() {
        const s = entries.map((e) => e.status());
        const req = entries.filter((e) => e.required);
        const left = req.filter((e) => !e.status()).length;
        const bad = s.filter((x) => x === "fail").length;
        const warn = s.filter((x) => x === "warn").length;
        summary.replaceChildren(...present([left ? `${left} to do` : "All done",
          bad ? [" · ", chip("fail", `${bad} action`)] : null, warn ? [" · ", chip("warn", `${warn} warning`)] : null]));
      },
      settled() {
        return entries.every((e) => !e.required || e.status() === "pass" || e.status() === "recorded");
      },
    });
  }

  wireCalculations(inputs);
  const qaDate = el("input", { type: "date", value: today(), max: today(), "aria-label": "QA date" });
  const runComment = el("textarea", { placeholder: "Anything the reviewer should know" });
  let sourceRef = null;
  const sphinxInfo = el("div", { class: "small" });
  const applySphinx = async () => {
    const p = await api("POST", `/api/assignments/${assignmentId}/sphinx/preview`, { file: state.sphinxFile });
    sourceRef = p.source_ref;
    qaDate.value = p.qa_date;
    // Fields marked [auto: sphinx-finished] take the export's acquisition date and time.
    for (const e of inputs) {
      const mk = MARKER.exec(e.item.description || "");
      if (mk && mk[1] === "auto" && mk[2].trim() === "sphinx-finished") { e.input.value = String(p.finished || p.qa_date).replace("T", " "); e.input.dispatchEvent(new Event("input")); }
    }
    const byTest = Object.fromEntries(inputs.map((i) => [i.item.test_id, i]));
    for (const m of p.matched) {
      const entry = byTest[m.test_id];
      entry.input.value = m.value;
      entry.input.dispatchEvent(new Event("input"));
      entry.note.replaceChildren(m.limits_differ ? `Sphinx file limits: ${limitsText(m.file_limits, entry.item.unit)}` : "");
    }
    // Fold away sections where everything passed so only what needs attention stays open.
    for (const s of sections) s.box.open = !s.settled();
    sphinxInfo.replaceChildren(el("div", {},
      el("div", {}, `Filled ${p.matched.length} values from ${p.filename}.`),
      p.duplicate_run ? el("div", { class: "error" }, "This file is already recorded as ", el("a", { href: `#/runs/${p.duplicate_run}` }, `run #${p.duplicate_run}`), ".") : null,
      p.unmatched.length ? el("div", { class: "row" }, `${p.unmatched.length} values in the file are not in this list.`,
        can("configure") ? el("button", { onclick: async () => {
          try {
            const r = await api("POST", `/api/assignments/${assignmentId}/sphinx/tests`, { file: state.sphinxFile });
            toast(`Added ${r.added.length} tests to the list`);
            state.applySphinxOnLoad = true;
            route();
          } catch (err) {
            toast(err.message, true);
          }
        } }, "Add them") : "Ask a physicist to add them.") : null));
  };
  const sphinxFile = el("input", { type: "file", accept: ".xls", "aria-label": "Sphinx export file" });
  sphinxFile.addEventListener("change", async () => {
    if (!sphinxFile.files[0]) return;
    await useUpload(await readFileBase64(sphinxFile.files[0]));
  });
  const useUpload = async (upload) => {
    try {
      state.sphinxFile = upload;
      await applySphinx();
    } catch (err) {
      sphinxInfo.replaceChildren(el("span", { class: "error" }, err.message));
    }
  };
  const autoLine = t.assignment.import_folder ? autoReadLine(assignmentId, useUpload) : null;
  const fileCard = el("div", { class: "card step" }, el("strong", {}, "Measurement file"),
    el("span", { class: "muted small" }, " A Sphinx export fills in every measured value. (DQA3 and MPC exports for the TrueBeam: importer not built yet.)"),
    autoLine, el("div", {}, sphinxFile), sphinxInfo);
  if (!t.items.length) {
    app.append(fileCard, el("div", { class: "card empty" }, "This list has no tests yet. ",
      can("configure") ? [el("a", { href: `#/queues/${t.queue.id}` }, "Add tests"), ", or load a Sphinx file above."] : ""));
    return;
  }
  // The file goes first in the Sphinx Measurements section (or at the top of a list that has no such section).
  const sphinxSection = sections.find((x) => /sphinx measurements/i.test(x.section)) || null;
  if (!sphinxSection) app.append(fileCard);
  app.append(...sections.flatMap((x) => [x.heading, x === sphinxSection && x.heading ? fileCard : null, x.box]).filter(Boolean));   // a null would append as the text "null"
  const error = el("p", { class: "error" });
  const submit = el("button", { class: "primary", onclick: async () => {
    error.textContent = "";
    submit.disabled = true;
    try {
      const results = inputs.map((i) => ({ test_id: i.item.test_id, value: i.input.value.trim(), comment: i.comment.value }));
      const result = await api("POST", `/api/assignments/${assignmentId}/runs`, { qa_date: qaDate.value, comment: runComment.value, results, source_ref: sourceRef });
      api("POST", `/api/assignments/${assignmentId}/draft/clear`, {}).catch(() => {});
      toast(`Submitted. Overall: ${capitalize(result.overall)}`);
      location.hash = `#/runs/${result.id}`;
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  } }, "Submit for review");
  app.append(el("details", { class: "card" }, el("summary", {}, "Notes for the reviewer"), runComment), error);
  // Save keeps what has been entered so far (per user and list) without submitting; it is restored when the page is opened again.
  const draftNote = el("span", { class: "muted small" });
  const saveDraft = el("button", { type: "button", onclick: async () => {
    saveDraft.disabled = true;
    try {
      const results = inputs.map((i) => ({ test_id: i.item.test_id, value: i.input.value, comment: i.comment.value }));
      const r = await api("PUT", `/api/assignments/${assignmentId}/draft`, { qa_date: qaDate.value, comment: runComment.value, results });
      draftNote.textContent = `Saved ${r.saved_at.slice(0, 16).replace("T", " ")}`;
      toast("Saved. Nothing is submitted yet.");
    } catch (err) {
      toast(err.message, true);
    }
    saveDraft.disabled = false;
  } }, "Save");
  app.append(el("div", { class: "submit-bar" }, el("label", { class: "inline" }, "QA date ", qaDate), progress, overallChip,
    el("div", { class: "spacer" }), draftNote, el("a", { class: "button", href: "#/perform-qa" }, "Cancel"), saveDraft, submit));
  refresh();
  try {
    const draft = await api("GET", `/api/assignments/${assignmentId}/draft`);
    if (draft) {
      const byTest = Object.fromEntries(inputs.map((i) => [i.item.test_id, i]));
      for (const r of draft.results || []) {
        const e = byTest[r.test_id];
        if (!e) continue;
        if (r.value !== undefined && r.value !== null && r.value !== "") { e.input.value = r.value; e.input.dispatchEvent(new Event("input")); }
        if (r.comment) { e.comment.value = r.comment; e.comment.hidden = false; }
      }
      if (draft.qa_date) qaDate.value = draft.qa_date;
      if (draft.comment) runComment.value = draft.comment;
      draftNote.textContent = `Saved ${String(draft.saved_at).slice(0, 16).replace("T", " ")}`;
      refresh();
      toast("Restored what was saved earlier.");
    }
  } catch (err) {
    console.error(err);
  }
  if (state.applySphinxOnLoad && state.sphinxFile) {
    state.applySphinxOnLoad = false;
    await applySphinx();
  }
}

function importSphinxDialog(a) {
  const files = el("input", { type: "file", accept: ".xls", multiple: true });
  const progress = el("p", { class: "muted small" });
  modal(`Import Sphinx files: ${a.queue_name}`, el("div", {},
    el("p", { class: "muted" }, "Each file becomes a run with the values, limits and Sphinx verdicts recorded in that file. Files already imported are skipped, and tests not yet in the queue are added."),
    field("Sphinx .xls exports", files),
    el("br"),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "historical", checked: true }), "Historical records (no review needed)"),
    progress), async (data) => {
    const list = [...files.files];
    if (!list.length) throw new Error("Choose one or more files.");
    const summary = { imported: [], skipped: [] };
    for (let i = 0; i < list.length; i += 25) {
      progress.textContent = `Importing ${i + 1}–${Math.min(i + 25, list.length)} of ${list.length}…`;
      const batch = await Promise.all(list.slice(i, i + 25).map(readFileBase64));
      const r = await api("POST", `/api/assignments/${a.id}/sphinx/import`, { files: batch, historical: data.historical });
      summary.imported.push(...r.imported);
      summary.skipped.push(...r.skipped);
    }
    const failed = summary.imported.filter((r) => r.overall === "fail").length;
    modal("Import finished", el("div", {},
      el("p", {}, `${summary.imported.length} run(s) imported, ${failed} with a failing result. ${summary.skipped.length} file(s) skipped.`),
      summary.skipped.length ? el("ul", { class: "small" }, summary.skipped.map((s) => el("li", {}, `${s.file}: ${s.reason}`))) : null),
    async () => {}, "OK");
    route();
  }, "Import");
}

// ---------------------------------------------------------------------------
// Queues and test library
// ---------------------------------------------------------------------------

// Save a machine's list back as a template: a new master copy; the machine keeps its own list untouched.
// Schedule one list on machines: every ticked machine runs this same list (no copies).
async function scheduleDialog(list, machines, schedules) {
  if (!schedules) schedules = (await Promise.all(machines.map((m) => api("GET", `/api/machines/${m.id}/assignments`)))).flat();
  const existing = new Map(schedules.filter((a) => a.queue_id === list.id).map((a) => [a.machine_id, a]));
  const on = new Set([...existing.values()].filter((a) => a.active).map((a) => a.machine_id));
  const body = el("div", {},
    el("p", { class: "muted" }, `Tick machines to schedule "${list.name}". Untick a machine to pause its schedule; its results and settings are kept.`),
    el("div", { class: "form-grid" },
      field("Machines", el("div", { class: "machine-picks" }, machines.filter((m) => m.active).map((m) => el("label", { class: "check" },
        el("input", { type: "checkbox", name: "machines", value: String(m.id), checked: on.has(m.id) }), m.name,
        on.has(m.id) ? el("span", { class: "muted small" }, " (scheduled)") : null))), "wide")),
    el("div", { class: "schedule-part" }, scheduleForm(null)));
  modal(`Schedule ${list.name}`, body, async (data, form) => {
    const choices = [...body.querySelectorAll("[name=machines]")];
    const schedule = scheduleData(data, form);
    for (const control of choices) {
      const machineId = Number(control.value), previous = existing.get(machineId);
      if (previous) {
        if (!!previous.active === control.checked) continue;
        await api("PUT", `/api/assignments/${previous.id}`, {
          frequency: previous.frequency, interval_days: previous.interval_days,
          weekdays: String(previous.weekdays).split(",").filter(Boolean).map(Number),
          start_date: previous.start_date, import_folder: previous.import_folder || "", active: control.checked,
        });
      } else if (control.checked) {
        await api("POST", "/api/assignments", { ...schedule, active: true, machine_id: machineId, queue_id: list.id });
      }
    }
    toast("Machine schedules saved");
    route();
  }, "Save");
}

// A separate list under a new name (its tests are copied, so it can then be changed on its own).
function copyDialog(source) {
  const body = el("div", {},
    el("p", { class: "muted" }, `Every test in "${source.name}" is copied into a new, separate list. "${source.name}" is not changed.`),
    el("div", { class: "form-grid" }, field("Name of the new list", el("input", { name: "name", required: true, value: `${source.name} (copy)` }), "wide")));
  modal(`Duplicate ${source.name}`, body, async (data) => {
    const r = await api("POST", `/api/queues/${source.id}/duplicate`, { name: data.name });
    toast("QA list created");
    location.hash = `#/queues/${r.id}`;
  }, "Duplicate");
}

// The page title (and, below it, a table's header row) stays pinned while scrolling.
function stickyHead() {
  const head = app.querySelector(".page-head");
  if (!head) return;
  head.classList.add("sticky-head");
  const set = () => document.documentElement.style.setProperty("--sticky-top", `${head.offsetHeight}px`);
  set();
  if (window.ResizeObserver) new ResizeObserver(set).observe(head);
}

async function renderQueues() {
  const [queues, machines] = await Promise.all([api("GET", "/api/queues"), api("GET", "/api/machines")]);
  page("QA lists", "A template is the master copy. Instantiate it on each machine; each instance owns its tests and limits.",
    can("configure") ? [el("a", { class: "button primary", href: "#/queues/new" }, "New QA list")] : []);
  const templates = queues.filter((q) => q.is_template);
  const lists = queues.filter((q) => !q.is_template);
  const row = (q) => el("tr", { class: "clickable", onclick: () => (location.hash = `#/queues/${q.id}`) },
    el("td", {}, el("strong", {}, q.name)),
    el("td", { class: "num" }, q.item_count),
    el("td", {}, q.machines || el("span", { class: "muted" }, "not scheduled")),
    el("td", {}, q.active ? "" : chip("", "Inactive")),
    el("td", {}, can("configure") ? el("button", { onclick: (e) => { e.stopPropagation(); copyDialog(q); } }, "Duplicate") : null));
  app.append(el("h2", {}, "QA List Templates"));
  app.append(templates.length ? table(["QA List Template", "#Tests", "Machines", "", ""], templates.map(row))
    : el("div", { class: "card empty" }, "No templates yet. Open a list and tick \"Template\" to make it one."));
  app.append(el("h2", {}, "Machine lists"));
  app.append(table(["QA list", "#Tests", "Scheduled on", "", ""], lists.map(row), "No machine lists yet. Duplicate a template to make one."));
}

async function renderQueueEditor(id) {
  const isNew = id === "new";
  const [tests, queue, machines] = await Promise.all([api("GET", "/api/tests"), isNew ? null : api("GET", `/api/queues/${id}`), api("GET", "/api/machines")]);
  const q = queue || { name: "", description: "", active: 1, is_template: 0, items: [] };
  const editable = can("configure");
  const where = (q.schedules || []).map((s) => `${s.machine}${s.active ? "" : " (inactive)"}`).join(", ");
  page(isNew ? "New QA list" : q.name, isNew ? "" : where ? `Scheduled on ${where}. This is the list each of them performs and trends; an edit here applies to all of them.`
    : "Not scheduled on a machine yet.",
    !isNew && editable ? [el("button", { onclick: () => scheduleDialog(q, machines, null) }, "Schedule on machines"), el("button", { onclick: () => copyDialog(q) }, "Duplicate")] : []);
  stickyHead();
  const info = el("form", { class: "card" }, el("div", { class: "form-grid" },
    field("Name", el("input", { name: "name", value: q.name, required: true, disabled: !editable, placeholder: "e.g. Daily QA template" })),
    field("Setup instructions (shown when performing)", el("textarea", { name: "description", disabled: !editable }, q.description), "wide"),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!q.active, disabled: !editable }), "Active")));
  app.append(info);

  const byId = Object.fromEntries(tests.map((t) => [t.id, t]));
  let items = q.items.map((i) => ({ test_id: i.test_id, expected: i.expected, warn: i.warn, fail: i.fail, tol_mode: i.tol_mode }));
  // "Values for": the list's default baseline / Warning / Action (every machine), or one machine's own values,
  // which override the default on that machine only (blank = use the default, shown in grey).
  let valuesFor = "";
  let dirty = false;
  const markDirty = () => { dirty = true; unsaved.hidden = false; };
  let searchTerm = "";
  const searchCount = el("span", { class: "muted small", role: "status" });
  let saveBtn = null;
  const machineValues = {};
  const machineName = (aid) => ((q.schedules || []).find((x) => String(x.id) === String(aid)) || {}).machine || "";
  const valuesPick = (q.schedules || []).length ? el("div", { class: "row", role: "radiogroup", "aria-label": "Limits for" },
    [["", "Default limits"], ...q.schedules.map((x) => [String(x.id), x.machine])].map(([value, label]) =>
      el("label", { class: "check" }, el("input", { type: "radio", name: "values_for", value, checked: value === "",
        onchange: async (e) => {
          const controls = [...valuesPick.querySelectorAll("input")];
          if (dirty) {
            controls.forEach((control) => { control.checked = control.value === valuesFor; });
            toast("Save your changes before switching machines or defaults.", true);
            return;
          }
          controls.forEach((control) => { control.disabled = true; });
          try {
            if (value && !machineValues[value]) {
              const template = await api("GET", `/api/assignments/${value}/template`);
              machineValues[value] = Object.fromEntries(template.items.map((i) => [i.test_id, { ...(i.override || {}) }]));
            }
            valuesFor = value;
            draw();
          } catch (err) {
            controls.forEach((control) => { control.checked = control.value === valuesFor; });
            toast(err.message, true);
          } finally {
            controls.forEach((control) => { control.disabled = false; });
          }
        },
      }), label))) : null;
  const changed = Object.fromEntries(q.items.map((i) => [i.test_id, i]));
  const body = el("tbody");
  const holder = el("div");
  const draw = () => {
    // Laid out like the myQA sheet: a heading per section, then each numbered item with its directions.
    const sectionCats = new Map();
    for (const it of items) { const t = byId[it.test_id]; const n = sectionNumber(t); if (!sectionCats.has(n)) sectionCats.set(n, []); sectionCats.get(n).push(t.category); }
    let lastSection = null;
    const numbers = blockNumbers(items.map((i) => ({ ...byId[i.test_id], test_id: i.test_id })));
    const axisFamilies = new Map();
    items.forEach((item, index) => {
      const t = byId[item.test_id], axis = t.type === "numeric" ? axisParts(t.name) : null;
      if (!axis) return;
      const key = JSON.stringify([sectionNumber(t), t.category, t.unit, axis.base]);
      if (!axisFamilies.has(key)) axisFamilies.set(key, []);
      axisFamilies.get(key).push({ item, index, axis });
    });
    const familyOf = new Map();
    for (const family of axisFamilies.values()) {
      if (family.length < 2 || new Set(family.map((x) => x.axis.axis)).size !== family.length) continue;
      family.sort((a, b) => "XYZ".indexOf(a.axis.axis) - "XYZ".indexOf(b.axis.axis));
      for (const member of family) familyOf.set(member.item.test_id, family);
    }
    const displayed = [], seen = new Set();
    items.forEach((item, index) => {
      if (seen.has(item.test_id)) return;
      const family = familyOf.get(item.test_id);
      for (const member of family || [{ item, index }]) {
        displayed.push(member);
        seen.add(member.item.test_id);
      }
    });
    const matches = displayed.filter(({ item }) => {
      const family = familyOf.get(item.test_id);
      const text = (family || [{ item }]).map((member) => {
        const t = byId[member.item.test_id];
        return `${t.name} ${t.category || ""} ${t.description || ""}`;
      }).join(" ").toLowerCase();
      return searchTerm.split(/\s+/).every((word) => text.includes(word));
    });
    searchCount.textContent = `${matches.length} of ${items.length} tests`;
    body.replaceChildren(...matches.flatMap(({ item, index, axis }) => {
      const t = byId[item.test_id];
      const numeric = t.type === "numeric";
      const own = valuesFor ? (machineValues[valuesFor][item.test_id] = machineValues[valuesFor][item.test_id] || {}) : null;
      const target = own || item;            // what the inputs edit: this machine's own values, or the list's default
      const fallback = (name) => (own ? (item[name] ?? t[name]) : t[name]);
      const input = (name, props) => el("input", { type: "number", step: "any", value: target[name] ?? "", placeholder: fmt(fallback(name)), disabled: !editable || !numeric,
        class: own && target[name] !== undefined && target[name] !== null && target[name] !== "" ? "own-value" : null,
        title: own ? `${machineName(valuesFor)} only. Blank uses the default (${fmt(fallback(name))}).` : null,
        oninput: (e) => { target[name] = e.target.value; e.target.classList.toggle("own-value", !!own && e.target.value !== ""); }, ...(props || {}) });
      const m = changed[item.test_id] || {};
      const shortName = t.category && t.name.startsWith(t.category + " – ") ? t.name.slice(t.category.length + 3) : t.name;
      const tolUnit = ((own && own.tol_mode) || item.tol_mode || t.tol_mode) === "percent" ? "%" : t.unit;
      const n = sectionNumber(t);
      const head = n !== lastSection ? el("tr", { class: "section-row" }, el("td", { colspan: 5 }, sectionTitle(n, sectionCats.get(n), sectionNameOf(t)))) : null;
      const family = familyOf.get(item.test_id);
      const firstInFamily = family && family[0].item === item;
      const lastInFamily = family && family[family.length - 1].item === item;
      const groupHead = firstInFamily ? el("tr", { class: "group" }, el("td", { colspan: 5 }, el("strong", {}, `${numbers.get(item.test_id)}: ${axis.base}`))) : null;
      const directions = family
        ? (lastInFamily ? [...new Set(family.map((x) => (byId[x.item.test_id].description || "").replace(TEMPLATE_NUMBER, "").replace(SECTION_NAME, "").replace(MARKER, "").replace(DEFAULT_MARK, "").trim()).filter(Boolean))].map((text) => helpText(text)) : "")
        : helpText(t.description);
      const dirRow = directions ? el("tr", { class: "directions-row", ...dragProps(index) }, el("td", { colspan: 5 }, directions)) : null;
      lastSection = n;
      const number = numbers.get(item.test_id);
      return [head, groupHead, el("tr", { class: `compact${family ? " grouped-axis-row" : ""}${dirRow ? " before-directions" : ""}`, ...dragProps(index), draggable: editable ? "true" : null },
        el("td", { class: "item-cell" }, el("div", { class: "name-with-edit" },
          editable ? el("span", { class: "drag-handle", title: "Drag to reorder" }, "⠿") : null,
          editable ? el("button", { class: "icon-btn", title: "Edit test", onclick: () => modal(`Edit ${t.name}`, el("div", {}, testForm(t), m.modified_at ? el("p", { class: "small muted" }, `Last Modified: ${m.modified_at.slice(0, 16).replace("T", " ")}${m.modified_by ? " · " + m.modified_by : ""}`) : null), async (data) => {
            await api("PUT", `/api/tests/${t.id}`, { ...data, owner_queue_id: t.owner_queue_id });
            toast("Test saved");
            route();
          }) }, "✎") : null,
          el("strong", {}, family ? "" : number ? `${number}: ` : "", family ? axis.axis : shortName))),
        el("td", {}, categoryLabel(t.category) || el("span", { class: "muted" }, "—")),
        el("td", {}, numeric ? el("div", { class: "row nowrap" }, input("expected"), t.unit && t.unit !== "unitless" ? el("span", { class: "muted small" }, t.unit) : null)
          : el("span", { class: "muted" }, TYPE_LABELS[t.type])),
        el("td", {}, numeric ? el("div", { class: "tol-cell" },
          el("label", { class: "inline small" }, valuesFor ? "Warning ±" : "Default Warning ±", input("warn", { min: 0 }), tolUnit ? el("span", { class: "muted" }, tolUnit) : null),
          el("label", { class: "inline small" }, valuesFor ? "Action ±" : "Default Action ±", input("fail", { min: 0 }), tolUnit ? el("span", { class: "muted" }, tolUnit) : null),
          select("", [["absolute", "Absolute"], ["percent", "Percent"]], target.tol_mode || (own ? item.tol_mode : null) || t.tol_mode || "absolute",
            { disabled: !editable, onchange: (e) => { target.tol_mode = e.target.value; draw(); } })) : el("span", { class: "muted" }, "—")),
        el("td", {}, editable ? el("div", { class: "row nowrap" },
          el("button", { class: "icon-btn", title: "Move up", disabled: index === 0, onclick: () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; unsaved.hidden = false; draw(); } }, "↑"),
          el("button", { class: "icon-btn", title: "Move down", disabled: index === items.length - 1, onclick: () => { [items[index + 1], items[index]] = [items[index], items[index + 1]]; unsaved.hidden = false; draw(); } }, "↓"),
          el("button", { class: "icon-btn danger", title: "Remove", onclick: () => { items.splice(index, 1); draw(); } }, "✕")) : null)), dirRow];
    }).filter(Boolean));
    if (!matches.length && items.length) body.append(el("tr", {}, el("td", { colspan: 5, class: "muted" }, "No matching tests. Clear the search to see all tests.")));
    holder.replaceChildren(items.length ? el("div", { class: "table-wrap" }, el("table", { class: "list-editor" },
      el("thead", {}, el("tr", {}, ["Test Name", "Category", valuesFor ? `Baseline · ${machineName(valuesFor)}` : "Baseline",
        valuesFor ? `Warning / Action · ${machineName(valuesFor)}` : "Default Warning / Default Action", ""].map((h) => el("th", {}, h)))), body))
      : el("div", { class: "card empty" }, "No tests in this list yet."));
    if (saveBtn) saveBtn.textContent = valuesFor ? `Save ${machineName(valuesFor)} limits` : "Save defaults";
    holder.classList.toggle("machine-mode", !!valuesFor);
    // Only this list's own tests (or shared library tests) can be added here.
    picker.replaceChildren(el("option", { value: "" }, "Add an existing test…"),
      ...tests.filter((t) => t.active && (!t.owner_queue_id || String(t.owner_queue_id) === id) && !items.some((i) => i.test_id === t.id))
        .map((t) => el("option", { value: t.id }, testLabel(t))));
  };
  const picker = el("select", { onchange: (e) => { if (e.target.value) { items.push({ test_id: Number(e.target.value) }); draw(); } } });
  // Drag and drop: drag a test row (by its handle) onto another test to move it there; Save keeps the new order.
  let dragFrom = null;
  const unsaved = el("span", { class: "chip due", hidden: true, role: "status" }, "Unsaved changes");
  info.addEventListener("input", markDirty);
  holder.addEventListener("input", markDirty);
  holder.addEventListener("change", markDirty);
  holder.addEventListener("click", (e) => { if (e.target.closest("button")) markDirty(); });
  picker.addEventListener("change", markDirty);
  function dragProps(index) {
    if (!editable) return {};
    return {
      ondragstart: (e) => { dragFrom = index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); e.currentTarget.classList.add("dragging"); },
      ondragend: (e) => { e.currentTarget.classList.remove("dragging"); body.querySelectorAll(".drop-before, .drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after")); },
      ondragover: (e) => {
        if (dragFrom === null) return;
        e.preventDefault();
        const below = index > dragFrom;
        e.currentTarget.classList.toggle("drop-after", below);
        e.currentTarget.classList.toggle("drop-before", !below);
      },
      ondragleave: (e) => e.currentTarget.classList.remove("drop-before", "drop-after"),
      ondrop: (e) => {
        e.preventDefault();
        if (dragFrom === null || dragFrom === index) return;
        const [moved] = items.splice(dragFrom, 1);
        items.splice(index, 0, moved);
        dragFrom = null;
        markDirty();
        draw();
      },
    };
  }
  app.append(el("div", { class: "row values-for" }, el("h2", {}, "Tests"),
    valuesPick ? el("div", { title: "Default limits apply to all machines. Select a machine to specify its limits." }, valuesPick) : null), holder);
  const search = el("input", { type: "search", placeholder: "Find a test, category or instruction…", "aria-label": "Find tests", oninput: (e) => { searchTerm = e.target.value.trim().toLowerCase(); draw(); } });
  holder.before(el("div", { class: "row template-search" }, search, el("button", { type: "button", onclick: () => { search.value = ""; searchTerm = ""; draw(); search.focus(); } }, "Clear"), searchCount),
    el("p", { class: "muted small" }, "Default limits apply to all machines. Select a machine above to set its own limits; blank fields use the defaults."));
  if (editable) {
    const newCheck = el("button", { disabled: isNew, title: isNew ? "Save the list first" : "", onclick: () => modal("New test for this list", testForm(), async (data) => {
      const r = await api("POST", "/api/tests", { ...data, owner_queue_id: Number(id) });
      items.push({ test_id: r.id });
      await save();
    }) }, "New test");
    const error = el("p", { class: "error" });
    const save = async () => {
      error.textContent = "";
      if (valuesFor) {
        const overrides = Object.entries(machineValues[valuesFor]).map(([tid, o]) => ({ test_id: Number(tid), expected: o.expected ?? "", warn: o.warn ?? "",
          fail: o.fail ?? "", tol_mode: o.tol_mode || "" }));
        await api("PUT", `/api/assignments/${valuesFor}/overrides`, { overrides });
        toast(`${machineName(valuesFor)} values saved`);
        dirty = false;
        unsaved.hidden = true;
        return;
      }
      const payload = { ...formData(info), items };
      const result = isNew ? await api("POST", "/api/queues", payload) : await api("PUT", `/api/queues/${id}`, payload);
      dirty = false;
      unsaved.hidden = true;
      toast("QA list saved");
      location.hash = `#/queues/${result.id}`;
      if (!isNew) route();
    };
    app.append(el("div", { class: "row" }, newCheck, el("div", {}, picker)));
    app.append(error, el("div", { class: "row template-save-bar" }, el("a", { class: "button", href: "#/queues" }, "Back"),
      saveBtn = el("button", { class: "primary", onclick: () => save().catch((err) => (error.textContent = err.message)) }, "Save"), unsaved));
  }
  draw();
}

function testForm(test) {
  const t = test || { type: "numeric", tol_mode: "absolute", active: 1 };
  const type = select("type", Object.entries(TYPE_LABELS), t.type);
  const limits = el("div", { class: "form-grid wide" },
    field("Unit", el("input", { name: "unit", value: t.unit || "", placeholder: "mm, %, cGy, °" })),
    field("Expected value", el("input", { name: "expected", type: "number", step: "any", value: t.expected ?? "" })),
    field("Default Warning ±", el("input", { name: "warn", type: "number", step: "any", min: 0, value: t.warn ?? "" })),
    field("Default Action ±", el("input", { name: "fail", type: "number", step: "any", min: 0, value: t.fail ?? "" })),
    field("Limits are", select("tol_mode", [["absolute", "Absolute (same units)"], ["percent", "Percent of expected"]], t.tol_mode)));
  const sync = () => (limits.hidden = type.value !== "numeric");
  type.addEventListener("change", sync);
  sync();
  return el("div", { class: "form-grid" },
    t.id ? field("QA list", el("div", { class: "muted" }, t.owner_name || (t.owner_queue_id ? "This list" : "Shared library (used by any list)")), "wide") : null,
    field("Category", el("input", { name: "category", value: t.category || "", placeholder: "e.g. Energy, Spot, Safety" })),
    field("Test name", el("input", { name: "name", value: t.name || "", required: true })),
    field("Type", type),
    limits,
    field("Instructions", el("textarea", { name: "description" }, t.description || ""), "wide"),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!t.active }), "Active"));
}

async function renderTests() {
  const tests = await api("GET", "/api/tests");
  const editable = can("configure");
  page("Tests", "Every test, the QA list it belongs to, and its limits. To add a test, open its QA list.");
  const listNames = [...new Set(tests.map((t) => t.owner_name || "Shared"))].sort((a, b) => a.localeCompare(b));
  const search = el("input", { type: "search", placeholder: "Filter tests…", "aria-label": "Filter tests", class: "search" });
  const listPick = select("list", [["", "All QA lists"], ...listNames.map((n) => [n, n])], "", { "aria-label": "QA list" });
  const sortPick = select("sort", [["list", "QA list, then category"], ["name", "Name"], ["category", "Category"], ["type", "Type"]], "list", { "aria-label": "Sort by" });
  const holder = el("div", { class: "stack" });
  const shortName = (t) => t.name.startsWith(t.category + " – ") ? t.name.slice(t.category.length + 3) : t.name;
  const edit = (t) => editable ? () => modal(`Edit ${t.name}`, testForm(t), async (data) => {
    await api("PUT", `/api/tests/${t.id}`, { ...data, owner_queue_id: t.owner_queue_id });
    toast("Test saved");
    route();
  }) : null;
  const limitCells = (t) => [
    el("td", { class: "muted" }, t.type === "numeric" ? "Measured" : TYPE_LABELS[t.type]),
    el("td", { class: "num" }, t.type === "numeric" ? `${fmt(t.expected)} ${t.unit}`.trim() : ""),
    el("td", { class: "num" }, t.type === "numeric" ? `${fmt(t.warn)}${t.tol_mode === "percent" ? " %" : ""}` : ""),
    el("td", { class: "num" }, t.type === "numeric" ? `${fmt(t.fail)}${t.tol_mode === "percent" ? " %" : ""}` : ""),
    el("td", {}, t.active ? "" : chip("", "Inactive"))];
  const draw = () => {
    const needle = search.value.trim().toLowerCase();
    const shown = tests.filter((t) => {
      const owner = t.owner_name || "Shared";
      if (listPick.value && owner !== listPick.value) return false;
      return !needle || `${owner} ${t.category} ${t.name}`.toLowerCase().includes(needle);
    });
    if (!shown.length) {
      holder.replaceChildren(el("div", { class: "card empty" }, tests.length ? "No tests match." : "No tests yet."));
      return;
    }
    if (sortPick.value === "list") {
      // Grouped: one section per QA list and category, in the list's own order.
      const groups = new Map();
      for (const t of shown) {
        const key = `${t.owner_name || "Shared"} › ${t.category || "General"}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
      holder.replaceChildren(...[...groups].map(([heading, list]) => el("details", { class: "card section", open: !!needle || !!listPick.value || groups.size <= 3 },
        el("summary", {}, el("strong", {}, heading), el("span", { class: "section-summary" }, `${list.length}`)),
        table(["Test", "QA list", "Type", "#Expected", "#Warning ±", "#Action ±", ""], list.map((t) =>
          el("tr", { class: editable ? "clickable" : "", onclick: edit(t) }, el("td", {}, el("strong", {}, shortName(t))),
            el("td", { class: "muted" }, t.owner_name || "Shared"), ...limitCells(t)))))));
      return;
    }
    // Flat: one table sorted by the chosen column, with the QA list shown on every row.
    const keys = { name: (t) => shortName(t), category: (t) => t.category || "General", type: (t) => TYPE_LABELS[t.type] };
    const key = keys[sortPick.value];
    const sorted = shown.slice().sort((a, b) => key(a).localeCompare(key(b)) || (a.owner_name || "").localeCompare(b.owner_name || "") || shortName(a).localeCompare(shortName(b)));
    holder.replaceChildren(table(["Test", "QA list", "Category", "Type", "#Expected", "#Warning ±", "#Action ±", ""], sorted.map((t) =>
      el("tr", { class: editable ? "clickable" : "", onclick: edit(t) },
        el("td", {}, el("strong", {}, shortName(t))),
        el("td", { class: "muted" }, t.owner_name || "Shared"),
        el("td", { class: "muted" }, categoryLabel(t.category) || "General"),
        ...limitCells(t)))));
  };
  for (const control of [search, listPick, sortPick]) {
    control.addEventListener("input", draw);
    control.addEventListener("change", draw);
  }
  app.append(el("div", { class: "row toolbar" }, search, el("label", { class: "inline" }, "QA list ", listPick), el("label", { class: "inline" }, "Sort by ", sortPick)), holder);
  draw();
}

// ---------------------------------------------------------------------------
// History, review, trends
// ---------------------------------------------------------------------------

// Review QA: what is waiting for a physicist's sign-off, then what was reviewed recently.
async function renderReview() {
  const runs = await api("GET", "/api/runs?limit=400");
  page("Review QA", "Submitted QA waiting for review, then recent decisions.", [el("a", { class: "button", href: "#/runs" }, "All past results")]);
  const row = (r) => el("tr", { class: `clickable${r.review_status === "pending" ? "" : ""}`, onclick: () => (location.hash = `#/runs/${r.id}`) },
    el("td", {}, el("a", { href: `#/runs/${r.id}` }, `${shortDate(r.qa_date)} ${r.qa_date.slice(0, 4)}`)),
    el("td", {}, el("strong", {}, r.machine_name)),
    el("td", {}, r.queue_name),
    el("td", {}, r.performer_name || r.performer || el("span", { class: "muted" }, "—")),
    el("td", {}, chip(r.overall)),
    el("td", {}, r.review_status === "imported" ? el("span", { class: "muted small" }, "Historical") : reviewChip(r.review_status)),
    el("td", { class: "center" }, r.review_status === "pending" && can("review")
      ? el("a", { class: "button primary small", href: `#/runs/${r.id}`, onclick: (e) => e.stopPropagation() }, "Review")
      : el("a", { class: "button small", href: `#/runs/${r.id}`, onclick: (e) => e.stopPropagation() }, "Open")));
  const cols = [["Date", "12%"], ["Machine", "12%"], ["QA list", "28%"], ["Performed by", "16%"], ["Result", "9%"], ["Review", "13%"], ["", "10%"]];
  const pending = runs.filter((r) => r.review_status === "pending");
  const decided = runs.filter((r) => r.review_status === "approved" || r.review_status === "rejected").slice(0, 25);
  app.append(el("h2", { class: "section-head modality-head" }, "Awaiting review", el("span", { class: "modality-count" }, String(pending.length))),
    fixedTable(cols, pending.map(row), "Nothing is waiting for review."));
  app.append(el("h2", { class: "section-head" }, "Recently reviewed"),
    fixedTable(cols, decided.map(row), "No reviews yet."));
}

async function renderRuns() {
  const params = queryParams();
  const [machines, queues, runs] = await Promise.all([api("GET", "/api/machines"), api("GET", "/api/queues"), api("GET", `/api/runs?${params}`)]);
  page("Past results", "Every recorded QA run, newest first.");
  const filters = el("form", { class: "row" },
    select("machine_id", [["", "All machines"], ...machines.map((m) => [m.id, m.name])], params.get("machine_id")),
    select("queue_id", [["", "All QA lists"], ...queues.map((q) => [q.id, q.name])], params.get("queue_id")),
    select("review_status", [["", "Any review status"], ...Object.entries(REVIEW_LABEL)], params.get("review_status")));
  filters.addEventListener("change", () => {
    const next = new URLSearchParams(Object.entries(formData(filters)).filter(([, v]) => v));
    location.hash = `#/runs${next.toString() ? "?" + next : ""}`;
  });
  app.append(filters, el("br"));
  app.append(table(["Date", "Machine", "QA list", "Result", "Review"], runs.map((r) =>
    el("tr", { class: "clickable", onclick: () => (location.hash = `#/runs/${r.id}`) },
      el("td", {}, shortDate(r.qa_date), " ", el("span", { class: "muted small" }, r.qa_date.slice(0, 4))),
      el("td", {}, r.machine_name), el("td", {}, r.queue_name),
      el("td", {}, chip(r.overall)),
      el("td", {}, r.review_status === "imported" ? el("span", { class: "muted small" }, "Historical") : reviewChip(r.review_status)))), "No runs match."));
}

async function renderRun(id) {
  const run = await api("GET", `/api/runs/${id}`);
  page(run.queue_name, `${shortDate(run.qa_date)} ${run.qa_date.slice(0, 4)}`);
  const who = `${personName(run.performer_name, run.performer)}, ${run.performed_at.slice(11, 16)}`;
  const facts = el("dl", { class: "result-card card" },
    el("dt", {}, "Result"), el("dd", {}, chip(run.overall)),
    el("dt", {}, "Performed by"), el("dd", {}, who, run.source === "sphinx" ? el("span", { class: "muted small" }, " · from Sphinx file") : ""),
    el("dt", {}, "Review"), el("dd", {}, reviewChip(run.review_status),
      run.reviewed_by ? ` ${personName(run.reviewer_name, run.reviewer)}, ${run.reviewed_at.slice(0, 16).replace("T", " ")}` : ""),
    run.comment ? [el("dt", {}, "Notes"), el("dd", { class: "pre" }, run.comment)] : null,
    run.review_comment ? [el("dt", {}, "Review note"), el("dd", {}, run.review_comment)] : null);
  app.append(facts);

  if (run.review_status === "pending" && can("review")) {
    if (run.performed_by === state.user.id) {
      app.append(el("p", { class: "muted" }, "Someone else needs to review this run, because you performed it."));
    } else {
      const comment = el("textarea", { placeholder: "Note (required to reject)" });
      const error = el("p", { class: "error" });
      const decide = (decision) => async () => {
        error.textContent = "";
        try {
          await api("POST", `/api/runs/${id}/review`, { decision, comment: comment.value });
          toast(decision === "approved" ? "Approved" : "Rejected");
          route();
        } catch (err) {
          error.textContent = err.message;
        }
      };
      app.append(el("div", { class: "card review-box" }, el("strong", {}, "Your review"), comment, error, el("div", { class: "row" },
        el("button", { class: "primary", onclick: decide("approved") }, "Approve"),
        el("button", { class: "danger", onclick: decide("rejected") }, "Reject"))));
    }
  }

  // Problems first; passes are there but folded away.
  const problems = run.results.filter((r) => r.status === "fail" || r.status === "warn");
  const rest = run.results.filter((r) => !problems.includes(r));
  const valueText = (r) => r.type === "boolean" ? (r.value_num ? "Pass" : "Fail") : r.type === "status" ? STATUS_WORDS[r.value_text] || r.value_text
    : r.type === "text" ? r.value_text : `${fmt(r.value_num)} ${r.unit}`.trim();
  const rows = (list) => list.map((r) => el("tr", {},
    el("td", {}, el("strong", {}, r.name), r.comment ? el("div", { class: "muted small" }, r.comment) : null),
    el("td", { class: "num" }, valueText(r)),
    el("td", { class: "num" }, r.type === "numeric" ? deltaBadge(r.value_num, r, r.unit, r.status) : ""),
    el("td", { class: "small muted" }, r.type === "numeric" ? limitsText(r, r.unit) : ""),
    el("td", {}, chip(r.status))));
  const headers = ["Test", "#Result", "#Δ", "Expected / limits", "Status"];
  if (problems.length) {
    app.append(el("h2", {}, `${problems.length} to look at`), table(headers, rows(problems)));
  } else {
    app.append(el("p", { class: "lead" }, "Everything passed."));
  }
  if (rest.length) {
    app.append(el("details", { class: "card", open: !problems.length && rest.length <= 12 },
      el("summary", {}, `${rest.length} ${problems.length ? "other" : ""} ${rest.length === 1 ? "test" : "tests"}`),
      table(headers, rows(rest))));
  }
}

function bandValue(point, key, sign) {
  if (point.expected === null || point[key] === null) return null;
  const tol = point.tol_mode === "percent" ? (Math.abs(point.expected) * point[key]) / 100 : point[key];
  return point.expected + sign * tol;
}

function miniRing(counts) {
  const ring = passRing(counts, "", "");
  ring.classList.add("mini");
  return ring;
}

function passRing(counts, title, sub) {
  const total = (counts.pass || 0) + (counts.warn || 0) + (counts.fail || 0);
  const pct = total ? Math.round((100 * (counts.pass || 0)) / total) : null;
  const r = 33, c = 2 * Math.PI * r;
  const kids = [svg("circle", { class: "ring-track", cx: 44, cy: 44, r })];
  let offset = 0;
  const shares = { pass: total ? (counts.pass || 0) / total : 0, fail: total ? ((counts.warn || 0) + (counts.fail || 0)) / total : 0 };
  for (const [key, cls] of [["pass", "ring-pass"], ["fail", "ring-fail"]]) {
    const share = shares[key];
    if (share > 0) kids.push(svg("circle", { class: `ring-seg ${cls}`, cx: 44, cy: 44, r, "stroke-dasharray": `${share * c} ${c}`, "stroke-dashoffset": -offset * c, transform: "rotate(-90 44 44)" }));
    offset += share;
  }
  kids.push(svg("text", { class: "ring-pct", x: 44, y: 44, "text-anchor": "middle", "dominant-baseline": "central" }, pct === null ? "—" : `${pct}%`));
  return el("div", { class: "ring", title: total ? `${counts.pass || 0} pass · ${counts.warn || 0} warning · ${counts.fail || 0} action of ${total} results` : "No results in this period" },
    svg("svg", { viewBox: "0 0 88 88", class: "ring-svg", role: "img", "aria-label": `${title}: ${pct === null ? "no results" : pct + "% passed"}` }, kids),
    title ? el("div", { class: "ring-title" }, title) : null, sub ? el("div", { class: "ring-sub" }, sub) : null);
}

function filterRange(points, range) {
  if (range === "all" || !points.length) return points;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(range));
  const from = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  return points.filter((p) => p.qa_date >= from);
}

function stats(points) {
  const values = points.map((p) => p.value);
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const fails = points.filter((p) => p.status === "fail"), warns = points.filter((p) => p.status === "warn");
  const last = points[n - 1];
  const dev = last.expected !== null && last.expected !== undefined ? last.value - last.expected : null;
  return { n, mean, sd, min: Math.min(...values), max: Math.max(...values), fails, warns, last, dev,
    inTol: Math.round((100 * (n - fails.length)) / n) };
}

/// Tests that differ only by a final X, Y or Z ("Spot 140 MeV – Position X" / "… Y") share one chart.
const AXIS_NAME = /^(.*\S)\s+([XYZ])(\s*\[[^\]]*\])?$/;
// {base, axis, unitTag} for a test named for one axis of an X/Y/Z set, else null.
function axisParts(name) {
  const m = AXIS_NAME.exec(name || "");
  if (!m) return null;
  return { base: m[1].replace(/\s*[-–—]$/, "").trim(), axis: m[2], unitTag: (m[3] || "").trim() };
}
// Rotations of one thing (couch pitch, roll, rotation) also share a chart.
const ROTATION_NAME = /^(.*\S)\s+(Pitch|Roll|Rotation)$/;
const AXIS_ORDER = { X: 0, Y: 1, Z: 2, Pitch: 0, Roll: 1, Rotation: 2 };

// History column: the latest QA dates in the header, each row's value under its date, trimmed to what fits one line.
const histDateLabel = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
function histDateSlot(d) {
  const dt = new Date(d + "T00:00");
  return el("span", { class: "hist date", title: histDateLabel(d) },
    el("div", {}, dt.toLocaleDateString(undefined, { day: "numeric", month: "short" })), el("div", { class: "yr" }, String(dt.getFullYear())));
}
function histChips(points, dates, unit, dp) {
  const byDate = new Map((points || []).map((h) => [h.qa_date, h]));
  return el("span", { class: "hist-row" }, dates.map((d) => byDate.get(d) || null).map((h) => h
    ? el("span", { class: `hist ${h.status}`, title: `${histDateLabel(h.qa_date)}: ${fmt(h.value, dp)} ${unit}${h.expected !== null && h.expected !== undefined ? ` (Δ ${signed(h.value - h.expected)} ${unit})` : ""}`.trim() }, `${fmt(h.value, dp)}${unit ? ` ${unit}` : ""}`)
    : el("span", { class: "hist empty" }, "—")));
}
function latestDates(pointLists, count = 3) {
  return [...new Set(pointLists.flatMap((pts) => (pts || []).map((h) => h.qa_date)))].sort().slice(-count).reverse();
}
// Only as many date slots as fit on one line of the History column (re-checked when the window is resized).
function fitHistoryRows(tableEl, nDates) {
  const fit = () => {
    const th = tableEl.querySelector("th.history-cell");
    if (!th || !th.clientWidth) return;
    const n = Math.max(1, Math.min(nDates, Math.floor((th.clientWidth - 10) / 66)));
    tableEl.querySelectorAll(".hist-row").forEach((row) => [...row.children].forEach((c, i) => { c.hidden = i >= n; }));
  };
  requestAnimationFrame(fit);
  window.addEventListener("resize", fit);
}

function axisGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const r = ROTATION_NAME.exec(item.name);
    const m = AXIS_NAME.exec(item.name) || r;
    const prefix = m ? m[1].replace(/\s*[-–]$/, "") : "";
    const key = m ? `${item.category}|${prefix}|${r ? "rot" : "xyz"}` : `${item.category}|#${item.test_id}`;
    const base = !m ? item.name : r ? `${prefix} – Pitch, Roll and Rotation` : prefix;
    if (!groups.has(key)) groups.set(key, { base, category: item.category, members: [] });
    groups.get(key).members.push({ ...item, axis: m ? m[2] : "" });
  }
  // A lone "X" with no partner is just a single test.
  return [...groups.values()].map((g) => (g.members.length === 1 ? { ...g, base: g.members[0].name, members: [{ ...g.members[0], axis: "" }] } : g))
    .map((g) => ({ ...g, members: g.members.sort((a, b) => (AXIS_ORDER[a.axis] ?? 9) - (AXIS_ORDER[b.axis] ?? 9)) }));
}

// Deviation from expected, in the test's own units, with the tolerances in the same units.
function asDeviation(p) {
  if (p.expected === null || p.expected === undefined) return { ...p, dev: p.value, warnAbs: null, failAbs: null };
  const scale = p.tol_mode === "percent" ? Math.abs(p.expected) / 100 : 1;
  return { ...p, dev: p.value - p.expected, warnAbs: p.warn === null ? null : p.warn * scale, failAbs: p.fail === null ? null : p.fail * scale };
}

const latest = (points) => points[points.length - 1];

/// Nice tick step for a span, and how many decimals its labels need.
function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (step / mag === 2.5 ? 1 : 0));
  const ticks = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  return { ticks, decimals };
}

function seriesStats(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const half = n > 1 ? 1.96 * sd / Math.sqrt(n) : 0;             // 95 % confidence interval of the mean
  let outlier = 0;
  values.forEach((v, i) => { if (Math.abs(v - mean) > Math.abs(values[outlier] - mean)) outlier = i; });
  return { n, mean, sd, ciLow: mean - half, ciHigh: mean + half, min: Math.min(...values), max: Math.max(...values), outlier };
}

// One chart for one or more series. Single series: actual values, with the expected line and limit bands.
// Several series (X/Y/Z, pitch/roll/rotation): deviation from each one's expected value, on one scale.
// The y axis is scaled to the data (limit bands are clipped to the plot), carries the unit, and the x axis is dated.
// Each chart carries its own statistics: n, mean ± SD and range per series.
// The quantity a chart plots, for its Y axis: the test name without unit tags and list prefixes, in Title Case;
// for an X / Y / Z set the common part without the axis letter ("Offset").
function yAxisLabel(names) {
  const clean = (n) => String(n || "").replace(/\s*\[[^\]]*\]/g, "").replace(/^.*:\s*/, "").replace(/^.*\s[–-]\s/, "").trim();
  let parts = names.map(clean).filter(Boolean);
  if (parts.length > 1) parts = parts.map((t) => t.replace(/^(X|Y|Z|Pitch|Roll|Rotation)\s+/i, "").replace(/\s+(X|Y|Z|Pitch|Roll|Rotation)$/i, "")).filter(Boolean);
  const t = parts[0] || "Value";
  return t.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

const trendKey = (show, multi = false) => (show ? [
  el("span", { class: "key-item" }, el("span", { class: `key-swatch fit${multi ? " multi" : ""}` }), multi ? "Trend (Straight-Line Fit, Each Series)" : "Trend (Straight-Line Fit)"),
  el("span", { class: "key-item" }, el("span", { class: `key-swatch fit forecast${multi ? " multi" : ""}` }), `Projected (Next ${FORECAST_DAYS / 7} Weeks)`)] : []);

function seriesChart(series, unit, { small = false, delta = null, yLabel = null } = {}) {
  yLabel = yLabel || yAxisLabel(series.map((x) => x.label));
  // Absolute values by default for one series; several series (X/Y/Z) start on Δ from reference so they share one scale.
  let mode = delta === null ? (series.length > 1 ? "delta" : "absolute") : (delta ? "delta" : "absolute");
  const hasRef = series.some((x) => x.points.some((pt) => pt.expected !== null && pt.expected !== undefined));
  const box = el("div", { class: `chart-box${small ? " small" : ""}${series.length > 1 ? " multi" : ""}` });
  const draw = () => {
    const buttons = hasRef ? el("div", { class: "chart-mode" }, ["absolute", "delta"].map((m) =>
      el("button", { type: "button", class: `link small${mode === m ? " on" : ""}`, "aria-pressed": String(mode === m),
        onclick: (e) => { e.stopPropagation(); mode = m; draw(); } }, m === "absolute" ? `Absolute${unit ? ` ${unit}` : ""}` : "Δ from Reference"))) : null;
    const delta = mode === "delta";
    const multi = series.length > 1;
    const pts = series.flatMap((x) => x.points);
    // Absolute view of several series (X and Y sit around different references): one subplot per series, stacked,
    // each on its own scale with its own reference line and bands.
    if (multi && !delta) {
      box.replaceChildren(buttons, ...series.map((x) => el("div", { class: "subplot" },
        el("div", { class: "subplot-title" }, x.label),
        drawSeries([x], unit, { small, delta: false, yLabel }),
        el("div", { class: "chart-key" },
          el("span", { class: "key-item" }, el("span", { class: "key-swatch line single" }), x.label),
          x.points.some((pt) => pt.expected !== null && pt.expected !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch ref" }), "Reference") : null,
          x.points.some((pt) => pt.warn !== null && pt.warn !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch band-warn" }), "Within Warning") : null,
          x.points.some((pt) => pt.fail !== null && pt.fail !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch band-fail" }), "Warning to Action") : null,
          ...trendKey(x.points.length >= 3)))));
      return;
    }
    const drawRef = hasRef && !(multi && !delta);
    const key = el("div", { class: "chart-key" },
      series.map((x, k) => el("span", { class: "key-item" }, el("span", { class: `key-swatch line ${multi ? `axis-${k}` : "single"}` }), `${x.label}${delta ? " (Δ)" : ""}`)),
      drawRef ? el("span", { class: "key-item" }, el("span", { class: "key-swatch ref" }), delta ? "Reference (0)" : "Reference") : null,
      drawRef && pts.some((pt) => pt.warn !== null && pt.warn !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch band-warn" }), "Within Warning") : null,
      drawRef && pts.some((pt) => pt.fail !== null && pt.fail !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch band-fail" }), "Warning to Action") : null,
      ...trendKey(series.some((x) => x.points.length >= 3), series.length > 1));
    box.replaceChildren(buttons, drawSeries(series, unit, { small, delta, yLabel }), key);
  };
  draw();
  return box;
}

const FORECAST_DAYS = 28;                                   // the straight-line trend is projected this far past the last result

function drawSeries(series, unit, { small = false, delta = false, yLabel = "Value" } = {}) {
  const multi = series.length > 1;
  const W = 900, H = small ? 200 : 360;
  const L = small ? 78 : 70, R = 40, T = small ? 10 : 20, B = small ? 40 : 52;
  const lineH = small ? 17 : 16;
  const keyH = 0;                                            // the key is HTML under the chart (see seriesChart)
  const statH = keyH + lineH * series.length * (small ? 2 : 1) + 6;   // small charts: statistics on one line, the trend on the next
  const plotBottom = H - B;
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.qa_date)))].sort();
  const timeOf = (d) => new Date(d + "T00:00").getTime();
  const t0 = timeOf(dates[0]), t1 = timeOf(dates[dates.length - 1]);
  const tEnd = t1 + FORECAST_DAYS * 86400000;                 // room on the right for the projection
  const xt = (t) => L + ((t - t0) * (W - L - R)) / (tEnd - t0);
  const x = (d) => xt(timeOf(d));
  const val = (p) => (delta ? asDeviation(p).dev : p.value);
  // Straight-line fit (least squares on days since the first result) per series, projected FORECAST_DAYS ahead.
  const fits = series.map((s) => {
    const n = s.points.length;
    if (n < 3) return null;
    const xs = s.points.map((p) => (timeOf(p.qa_date) - t0) / 86400000), ys = s.points.map(val);
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
    if (!sxx) return null;
    const slope = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / sxx;
    const at = (t) => my + slope * ((t - t0) / 86400000 - mx);
    return { slope, at, end: at(tEnd) };
  });
  // Reference line and bands: around 0 on a Δ chart, around the reference on an absolute chart (one series only).
  const ref = (multi && !delta ? [] : series[0].points).map((p) => {
    if (delta) { const d = asDeviation(p); return { d: p.qa_date, w: d.warnAbs, f: d.failAbs, c: 0 }; }
    return { d: p.qa_date, w: p.warn === null ? null : bandValue(p, "warn", 1) - p.expected, f: p.fail === null ? null : bandValue(p, "fail", 1) - p.expected, c: p.expected };
  }).filter((b) => b.c !== null && b.c !== undefined);

  // Auto-scale to the data only, with a little headroom.
  const values = series.flatMap((s) => s.points.map(val));
  for (const f of fits) if (f) values.push(f.end);
  for (const b of ref) if (b.w !== null && b.w !== undefined) values.push(b.c + b.w, b.c - b.w);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || (ref[0] && ref[0].w) || 1;
    lo -= pad; hi += pad;
  } else {
    const pad = (hi - lo) * 0.1;
    lo -= pad; hi += pad;
  }
  const y = (v) => T + ((hi - v) * (plotBottom - T)) / (hi - lo);
  const clipId = `clip-${Math.random().toString(36).slice(2)}`;
  const kids = [svg("defs", {}, svg("clipPath", { id: clipId }, svg("rect", { x: L, y: T, width: W - L - R, height: plotBottom - T })))];
  const refX = ref.flatMap((b, i) => (i === ref.length - 1 ? [b, { ...b, d: null }] : [b]));   // the last limits carry on to the right edge
  const bx = (b) => (b.d === null ? xt(tEnd) : x(b.d));
  const band = (key) => {
    const up = [], dn = [];
    for (const b of refX) if (b[key] !== null && b[key] !== undefined) { up.push(`${bx(b)},${y(b.c + b[key])}`); dn.unshift(`${bx(b)},${y(b.c - b[key])}`); }
    return up.length ? up.concat(dn).join(" ") : null;
  };
  // A strip from the warning limit out to the action limit, on one side of the reference.
  const strip = (sign) => {
    const outer = [], inner = [];
    for (const b of refX) if (b.f !== null && b.f !== undefined && b.w !== null && b.w !== undefined) { outer.push(`${bx(b)},${y(b.c + sign * b.f)}`); inner.unshift(`${bx(b)},${y(b.c + sign * b.w)}`); }
    return outer.length ? outer.concat(inner).join(" ") : null;
  };
  const plot = [];
  const fail = band("f"), warn = band("w");
  if (fail && warn) { for (const sign of [1, -1]) { const pts = strip(sign); if (pts) plot.push(svg("polygon", { class: "band-fail", points: pts })); } }
  else if (fail) plot.push(svg("polygon", { class: "band-fail", points: fail }));
  if (warn) plot.push(svg("polygon", { class: "band-warn", points: warn }));
  if (ref.length) plot.push(svg("polyline", { class: "expected", points: refX.map((b) => `${bx(b)},${y(b.c)}`).join(" ") }));

  // Y axis: gridlines, labels, and the unit as the axis title.
  const { ticks, decimals } = niceTicks(lo, hi, small ? 3 : 5);
  for (const v of ticks) {
    kids.push(svg("line", { class: "axis", x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      svg("text", { x: L - 5, y: y(v) + 4, "text-anchor": "end" }, (delta && v > 0 ? "+" : "") + fmt(v, decimals)));
  }
  const shortLabel = small && yLabel.length > 30 ? `${yLabel.slice(0, 29)}…` : yLabel;
  const yTitle = `${delta ? "Δ " : ""}${shortLabel}${unit ? ` (${unit})` : ""}`;   // "Y Offset (mm)" / "Δ Y Offset (mm)": the unit never changes between the two views
  kids.push(svg("text", { class: "axis-title", x: 14, y: (T + plotBottom) / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${(T + plotBottom) / 2})` }, yTitle));

  // X axis: dates, and the axis title.
  kids.push(svg("line", { class: "axis-base", x1: L, x2: W - R, y1: plotBottom, y2: plotBottom }));
  // A vertical line at the start of every month; a label on every n-th so they never collide.
  const first = new Date(dates[0] + "T00:00"), last = new Date(tEnd);
  const months = [];
  for (let m = new Date(first.getFullYear(), first.getMonth() + 1, 1); m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push(m);
  const maxLabels = small ? 6 : 8;
  const step = Math.max(1, Math.ceil((months.length + 1) / maxLabels));
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const monthLabel = (dt) => dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  months.forEach((m, i) => {
    const xm = x(iso(m));
    kids.push(svg("line", { class: "month-line", x1: xm, x2: xm, y1: T, y2: plotBottom }));
    if (i % step === 0) kids.push(svg("text", { class: "month-label", x: xm, y: plotBottom + 14, "text-anchor": "middle" }, monthLabel(m)));
  });
  if (!months.length) kids.push(svg("text", { x: (L + W - R) / 2, y: plotBottom + 14, "text-anchor": "middle" }, monthLabel(first)));
  kids.push(svg("text", { class: "axis-title", x: (L + W - R) / 2, y: H - 4, "text-anchor": "middle" }, "Date QA performed"));

  plot.push(svg("line", { class: "forecast-line", x1: xt(t1), x2: xt(t1), y1: T, y2: plotBottom }));
  series.forEach((s, k) => {
    const cls = multi ? `axis-${k}` : "";
    const r = small ? (dates.length > 120 ? 2.2 : 3) : (dates.length > 150 ? 2.6 : 3.6);
    // A line from each result to the next, then the dots on top.
    if (s.points.length > 1) plot.push(svg("polyline", { class: `series ${multi ? cls : "single"}`, points: s.points.map((p) => `${x(p.qa_date)},${y(val(p))}`).join(" ") }));
    for (const p of s.points) {
      const dot = svg("circle", { class: `dot ${multi ? cls : "single"} st-${p.status}`, cx: x(p.qa_date), cy: y(val(p)), r },
        svg("title", {}, `${p.qa_date} ${s.label}: ${fmt(p.value)} ${unit || ""} (${STATUS_LABEL[p.status] || p.status})`));
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const svgEl = dot.ownerSVGElement;
        const was = dot.classList.contains("selected");
        svgEl.querySelectorAll(".dot.selected").forEach((d) => d.classList.remove("selected"));
        svgEl.querySelectorAll(".dot-label").forEach((g) => g.remove());
        if (was) return;
        dot.classList.add("selected");
        const when = new Date(p.qa_date + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        const d = asDeviation(p);
        const lines = [`${when}${multi ? ` · ${s.label}` : ""}`, `${fmt(p.value)}${u}`, p.expected !== null && p.expected !== undefined ? `Δ ${signed(d.dev)}${u}` : ""].filter(Boolean);
        const cx = x(p.qa_date), cy = y(val(p));
        const lineH2 = small ? 12 : 14, pad = 6, width = Math.max(...lines.map((t) => t.length)) * (small ? 6.2 : 7.2) + pad * 2, height = lines.length * lineH2 + pad * 2;
        const bx = Math.min(Math.max(L, cx - width / 2), W - R - width), by = cy - height - 12 < T ? cy + 12 : cy - height - 12;
        svgEl.append(svg("g", { class: "dot-label" }, svg("rect", { x: bx, y: by, width, height, rx: 4 }),
          ...lines.map((t, i) => svg("text", { x: bx + pad, y: by + pad + (i + 1) * lineH2 - 3 }, t))));
      });
      plot.push(dot);
    }
  });
  series.forEach((s, k) => {
    const f = fits[k];
    if (!f) return;
    const cls = multi ? `axis-${k}` : "single";
    plot.push(svg("line", { class: `fit ${cls}`, x1: xt(t0), y1: y(f.at(t0)), x2: xt(t1), y2: y(f.at(t1)) }),
      svg("line", { class: `fit forecast ${cls}`, x1: xt(t1), y1: y(f.at(t1)), x2: xt(tEnd), y2: y(f.end) },
        svg("title", {}, `Projected ${sig(f.end)}${unit ? ` ${unit}` : ""} in ${FORECAST_DAYS / 7} weeks (straight-line fit)`)));
  });
  const plotGroup = svg("g", { "clip-path": `url(#${clipId})` }, plot);
  kids.push(plotGroup);

  // Statistics block under the key, one line per series.
  const u = unit && unit !== "unitless" ? ` ${unit}` : "";
  const statLines = series.flatMap((s, k) => {
    const st = seriesStats(s.points.map(val));
    const name = multi ? `${s.label}${delta ? " (Δ)" : ""}: ` : delta ? "Δ: " : "";
    const cls = `stats-line ${multi ? `axis-${k}` : ""}`;
    const o = s.points[st.outlier];
    const oDate = o ? new Date(o.qa_date + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    // The biggest outlier gets a ring on the chart.
    if (o && st.n > 2) plotGroup.append(svg("circle", { class: `outlier ${multi ? `axis-${k}` : "single"}`, cx: x(o.qa_date), cy: y(val(o)), r: small ? 6 : 9 },
      svg("title", {}, `Biggest outlier: ${sig(val(o))}${u} on ${oDate}`)));
    const f = fits[k];
    const trend = f ? ` · Trend ${sigSigned(f.slope * 7)}${u}/Week · In ${FORECAST_DAYS / 7} Weeks ${sig(f.end)}${u}` : "";
    if (small) return [
      svg("text", { class: cls, x: L, y: H + keyH + (2 * k + 1) * lineH }, `${name}Mean ${sig(st.mean)} ± ${sig(st.sd)}${u} · 95% CI ${sig(st.ciLow)} to ${sig(st.ciHigh)}${u} · N ${st.n} · Outlier ${sig(val(o))}${u} (${oDate})`),
      svg("text", { class: cls, x: L, y: H + keyH + (2 * k + 2) * lineH }, trend.replace(/^ · /, ""))];
    const text = `${name}Mean ${sig(st.mean)} ± ${sig(st.sd)}${u} · 95% CI ${sig(st.ciLow)} to ${sig(st.ciHigh)}${u} · N ${st.n} · Range ${sig(st.min)} to ${sig(st.max)}${u} · Biggest Outlier ${sig(val(o))}${u} on ${oDate}${trend}`;
    return [svg("text", { class: cls, x: L, y: H + keyH + (k + 1) * lineH }, text)];
  });
  kids.push(...statLines);
  return svg("svg", { class: small ? "spark" : "chart", viewBox: `0 0 ${W} ${H + statH}`, role: "img", "aria-label": series.map((s) => s.label).join(", ") }, kids);
}

function axisLegend(group) {
  return group.members.length > 1
    ? el("span", { class: "axis-legend" }, group.members.map((m, k) => el("span", { class: `axis-key axis-${k}` }, m.axis)))
    : null;
}

const signed = (v, d = 2) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v), d)}`;
// Three significant figures for chart statistics (77.7, 0.06, 157), trailing zeros dropped.
const sig = (v, n = 3) => (v === null || v === undefined || Number.isNaN(v) ? "—" : v === 0 ? "0" : String(Number(Number(v).toPrecision(n))));
const sigSigned = (v, n = 3) => `${v >= 0 ? "+" : "−"}${sig(Math.abs(v), n)}`;

// Trend points judged by the QA list's current limits (the same reference / warning / action the Perform page shows),
// not by whatever limits were stored with each result. Points keep their recorded verdict in `recorded_status`.
function judgedByList(item, points) {
  const L = item.limits || {};
  if (L.expected === null || L.expected === undefined) return points;
  return points.map((p) => ({ ...p, expected: L.expected, warn: L.warn ?? null, fail: L.fail ?? null, tol_mode: L.tol_mode || "absolute",
    recorded_status: p.status, status: evaluate("numeric", p.value, L) }));
}

async function renderTrendOverview(machines, machineId, range, listId = "") {
  const machine = machines.find((m) => String(m.id) === String(machineId));
  const loading = el("div", { class: "card empty" }, `Loading ${machine.name} trends…`);
  app.append(loading);
  const assignments = await api("GET", `/api/machines/${machineId}/assignments`);
  const templates = await Promise.all(assignments.filter((a) => a.active && (!listId || String(a.id) === String(listId))).map((a) => api("GET", `/api/assignments/${a.id}/template`)));
  const numeric = templates.flatMap((t) => t.items.filter((i) => i.type === "numeric"));
  const all = numeric.length ? await api("GET", `/api/machines/${machineId}/trends`) : {};
  loading.remove();
  const withData = numeric.map((i) => ({ ...i, points: judgedByList(i, filterRange(all[i.test_id] || [], range)) })).filter((i) => i.points.length);
  if (!withData.length) {
    app.append(el("div", { class: "card empty" }, numeric.length ? "No results in this period." : `${machine.name} has no measured tests scheduled.`));
    return;
  }
  const tally30 = (it) => { const c = { pass: 0, warn: 0, fail: 0 }; for (const pt of judgedByList(it, filterRange(all[it.test_id] || [], "30"))) if (pt.status in c) c[pt.status]++; return c; };
  const avg30 = (it) => { const v = filterRange(all[it.test_id] || [], "30").map((pt) => pt.value); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const groups = axisGroups(withData);
  const worstOf = (g) => g.members.reduce((w, m) => (STATUS_RANK[latest(m.points).status] > STATUS_RANK[w] ? latest(m.points).status : w), "pass");
  const failing = groups.filter((g) => worstOf(g) === "fail").length, warning = groups.filter((g) => worstOf(g) === "warn").length;
  let onlyStatus = null;                                     // "fail" / "warn" when a chip is active
  const statusChip = (status, label) => el("button", { type: "button", class: `chip ${status} chip-filter`, title: `Show only the tests ${status === "fail" ? "at action level" : "outside tolerance"}`,
    onclick: () => { onlyStatus = onlyStatus === status ? null : status; app.querySelectorAll(".chip-filter").forEach((c) => c.classList.toggle("on", c.dataset.status === onlyStatus)); applyFilters(); },
    "data-status": status }, label);
  app.append(el("p", { class: "lead" }, `${withData.length} tests on ${groups.length} charts. `,
    failing ? statusChip("fail", `${failing} at action level`) : "", " ", warning ? statusChip("warn", `${warning} outside tolerance`) : "",
    !failing && !warning ? el("span", { class: "chip pass" }, "All passing") : ""));
  const search = el("input", { type: "search", class: "filter-box", placeholder: "Search tests (e.g. spot 3 sigma)", "aria-label": "Search tests" });
  const applyFilters = () => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const block of app.querySelectorAll(".trend-group")) {
      let shown = 0;
      for (const table of block.querySelectorAll(".measure-block")) {
        let inTable = 0;
        const title = (table.querySelector(".measure-title") || {}).textContent || "";
        for (const row of table.querySelectorAll("tr.trend-row")) {
          const text = `${title} ${row.querySelector(".qa-label").textContent}`.toLowerCase();
          row.hidden = !words.every((w) => text.includes(w)) || (onlyStatus !== null && row.dataset.status !== onlyStatus);
          if (row.hidden && row.nextElementSibling && row.nextElementSibling.classList.contains("quick-trend")) row.nextElementSibling.hidden = true;
          if (!row.hidden) inTable++;
        }
        table.hidden = !inTable;
        shown += inTable;
      }
      block.hidden = !shown;
    }
    for (const head of app.querySelectorAll("h2.section-head")) {
      let sib = head.nextElementSibling, any = false;
      while (sib && !sib.classList.contains("section-head")) { if (sib.classList.contains("trend-group") && !sib.hidden) any = true; sib = sib.nextElementSibling; }
      head.hidden = !any;
    }
  };
  search.addEventListener("input", applyFilters);
  app.append(el("div", { class: "filter-row" }, search));

  // The same shape as Perform QA: a heading per section, a box per category, and inside it the single tests as one
  // table, each repeated measurement (per energy / spot) as a titled table, and each X / Y / Z offset as an axis table.
  const named = withData.some((i) => sectionNameOf(i));
  const numbers = new Map();
  for (const tpl of templates) for (const [id, n] of blockNumbers(tpl.items)) numbers.set(id, n);
  const boxes = new Map();
  for (const item of withData) {
    const key = `${sectionNumber(item)}|${named ? sectionNameOf(item) || "" : item.category || "General"}`;
    if (!boxes.has(key)) boxes.set(key, []);
    boxes.get(key).push(item);
  }
  const sectionCats = new Map();
  for (const key of boxes.keys()) { const [n, c] = key.split("|"); if (!sectionCats.has(n)) sectionCats.set(n, []); sectionCats.get(n).push(c); }
  const hrefFor = (ids) => `#/trends?machine_id=${machineId}${listId ? `&list=${listId}` : ""}&test_id=${ids.join(",")}&range=${range}`;
  const limitsLine = (it, unit) => {
    const l = it.limits || {};
    const suf = l.tol_mode === "percent" ? "%" : unit;
    const parts = [];
    if (l.warn !== null && l.warn !== undefined) parts.push(`WARNING ±${fmt(l.warn)} ${suf}`.trim());
    if (l.fail !== null && l.fail !== undefined) parts.push(`ACTION ±${fmt(l.fail)} ${suf}`.trim());
    return parts.length ? el("span", { class: "qa-limits" }, parts.join(" · ")) : null;
  };
  // One read-only table: # · Test · Unit · Baseline · Latest · Deviation · Result · History · Trends.
  const trendTable = (members, { firstHeader, title, firstCell, chartTogether, familyChart }) => {
    const dates = latestDates(members.map((it) => it.points));
    const unitOf = (it) => (it.unit && it.unit !== "unitless" ? it.unit : "");
    const dp = decimalsOf(members.flatMap((it) => [...it.points.slice(-5).map((h) => h.value), latest(it.points).expected ?? (it.limits || {}).expected]));
    const rows = members.flatMap((it, k) => {
      const unit = unitOf(it), p = latest(it.points);
      const baseline = p.expected ?? (it.limits || {}).expected;
      const href = hrefFor(chartTogether ? members.map((m) => m.test_id) : [it.test_id]);
      // Trends: the dot icon opens the chart under the row (the whole X / Y / Z set at once for an axis table).
      const chart = el("tr", { class: "quick-trend", hidden: true }, el("td", { colspan: 11 }));
      const series = chartTogether ? members.map((m) => ({ label: m.axisLabel || m.name, points: m.points })) : [{ label: (measureParts(it.name) || {}).rowLabel || yAxisLabel([it.name]), points: it.points }];
      const trend = el("button", { type: "button", class: "icon-btn", title: "Show the trend here", onclick: (e) => {
        e.stopPropagation();
        if (chart.hidden) chart.firstChild.replaceChildren(el("div", { class: "row" }, el("span", { class: "spacer" }), el("a", { class: "small", href }, "Full trend")), seriesChart(series, unit, { small: true, yLabel: yAxisLabel(chartTogether ? members.map((m) => m.name) : [it.name]) }));
        chart.hidden = !chart.hidden;
      } }, trendIcon(16));
      const cells = [
        firstHeader !== "Test" ? (k === 0 ? el("td", { class: "qa-n qa-n-span", rowspan: members.length * 2 }, numbers.get(it.test_id) || "") : null) : el("td", { class: "qa-n" }, numbers.get(it.test_id) || ""),
        el("td", { class: "qa-label" }, firstCell(it), firstHeader === "Test" ? limitsLine({ limits: { warn: p.warn, fail: p.fail, tol_mode: p.tol_mode } }, unit) : null),
        el("td", { class: "qa-unit" }, unit),
        el("td", { class: "num" }, baseline === null || baseline === undefined ? el("span", { class: "muted" }, "—") : `${fmt(baseline, dp)} ${unit}`.trim()),
        el("td", { class: "num" }, `${fmt(p.value, dp)} ${unit}`.trim()),
        el("td", { class: "qa-dev" }, deltaBadge(p.value, p, unit, p.status)),
        el("td", {}, chip(p.status)),
        el("td", { class: "history-cell" }, dates.length ? histChips(it.points, dates, unit, dp) : el("span", { class: "muted small" }, "—")),
        el("td", { class: "num avg-cell" }, avg30(it) === null ? el("span", { class: "muted" }, "—")
          : el("span", {}, `${fmt(avg30(it), dp)} ${unit}`.trim(), el("br"), deltaBadge(avg30(it), it.limits, unit))),
        el("td", { class: "ring-cell" }, miniRing(tally30(it))),
        chartTogether ? (k === 0 ? el("td", { rowspan: members.length * 2 }, trend) : null) : el("td", {}, trend),
      ];
      return [el("tr", { class: "clickable trend-row", "data-status": p.status, onclick: () => (location.hash = href) }, ...present(cells)), chart];
    });
    const widths = firstHeader === "Test" ? ["3%", "24%", "4%", "8%", "9%", "9%", "8%", "16%", "8%", "6%", "5%"] : ["3%", "17%", "4%", "8%", "9%", "9%", "8%", "23%", "8%", "6%", "5%"];
    const tableEl = sortable(el("table", { class: `measure-table trend-table${firstHeader === "Axis" ? " axis-table" : ""}${firstHeader !== "Test" ? " energy-table" : ""}` },
      el("colgroup", {}, widths.map((w) => { const col = el("col"); col.style.width = w; return col; })),
      el("thead", {}, el("tr", {}, ["#", firstHeader, "Unit", "Baseline", "Latest", "Deviation", "Result", "History", "30-Day Avg", "30 days", "Trends"].map((h) => el("th", { class: h === "History" ? "history-cell" : h === "30 days" ? "ring-cell" : "" }, h))),
        dates.length ? el("tr", { class: "hist-dates" }, ...Array.from({ length: 7 }, () => el("th", {})), el("th", { class: "history-cell" }, el("span", { class: "hist-row" }, dates.map(histDateSlot))), el("th", {}), el("th", {}), el("th", {})) : null),
      el("tbody", {}, rows)));
    if (title && firstHeader !== "Test") {
      const p0 = latest(members[0].points);
      const line = limitsLine({ limits: { warn: p0.warn, fail: p0.fail, tol_mode: p0.tol_mode } }, unitOf(members[0]));
      if (line) title.append(line);
    }
    fitHistoryRows(tableEl, dates.length);
    // Energy / spot tables: every row on one chart below the table (Δ from Reference puts them on one scale).
    const together = familyChart && members.length > 1
      ? el("details", { class: "family-chart", open: true }, el("summary", {}, "Chart"),
        seriesChart(members.map((m) => ({ label: (measureParts(m.name) || {}).rowLabel || m.name, points: m.points })), unitOf(members[0]),
          { delta: true, yLabel: yAxisLabel(members.map((m) => m.name)) }))
      : null;
    return el("div", { class: "measure-block" }, title, el("div", { class: "table-wrap measure-wrap" }, tableEl), together);
  };
  const foldAxes = (list) => {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const a = axisParts(list[i].name), b = axisParts((list[i + 1] || {}).name), c = axisParts((list[i + 2] || {}).name);
      if (a && b && c && a.axis === "X" && b.axis === "Y" && c.axis === "Z" && a.base === b.base && b.base === c.base) {
        const next = list[i + 3];
        const calc = next && /\[calc: 3d-offset\]/.test(next.description || "") ? next : null;
        out.push({ axes: [list[i], list[i + 1], list[i + 2]].map((it, k) => ({ ...it, axisLabel: "XYZ"[k] })), calc: calc ? { ...calc, axisLabel: "3D" } : null, base: a.base, unitTag: a.unitTag });
        i += calc ? 3 : 2;
      } else out.push(list[i]);
    }
    return out;
  };
  let lastSection = null;
  for (const [key, items] of [...boxes].sort(([a], [b]) => Number(a.split("|")[0]) - Number(b.split("|")[0]))) {
    const [n, category] = key.split("|");
    const section = sectionTitle(Number(n), sectionCats.get(n), named ? category : null);
    if (section !== lastSection) app.append(el("h2", { class: "section-head" }, section));
    lastSection = section;
    const blocks = [];
    const families = new Map();
    for (const it of items) { const mp = measureParts(it.name); if (!mp) continue; const k = `${mp.metric}|${it.unit || ""}`; if (!families.has(k)) families.set(k, []); families.get(k).push(it); }
    const grouped = new Set([...families.values()].filter((f) => f.length > 1).flatMap((f) => f.map((x) => x.test_id)));
    const drawn = new Set();
    const shortName = (it) => (it.name.startsWith(category + " – ") ? it.name.slice(category.length + 3) : it.name);
    let pending = [];
    const flush = () => {
      if (!pending.length) return;
      let plain = [];
      const emitPlain = () => {
        if (plain.length) blocks.push(trendTable(plain, { firstHeader: "Test", title: null, firstCell: (it) => el("strong", {}, shortName(it)) }));
        plain = [];
      };
      for (const m of foldAxes(pending)) {
        if (!m.axes) { plain.push(m); continue; }
        emitPlain();
        blocks.push(trendTable([...m.axes, ...(m.calc ? [m.calc] : [])], { firstHeader: "Axis", chartTogether: true,
          title: el("div", { class: "measure-title" }, el("strong", {}, m.base, m.unitTag ? ` ${m.unitTag}` : "")),
          firstCell: (it) => el("strong", {}, it.axisLabel) }));
      }
      emitPlain();
      pending = [];
    };
    for (const it of items) {
      if (drawn.has(it.test_id)) continue;
      if (!grouped.has(it.test_id)) { pending.push(it); continue; }
      flush();
      const mp0 = measureParts(it.name);
      const family = families.get(`${mp0.metric}|${it.unit || ""}`).slice().sort((a, b) => measureParts(a.name).sortKey - measureParts(b.name).sortKey);
      family.forEach((f) => drawn.add(f.test_id));
      blocks.push(trendTable(family, { firstHeader: "Energy", familyChart: true, title: el("div", { class: "measure-title" }, el("strong", {}, mp0.metricLabel)),
        firstCell: (f) => el("strong", {}, measureParts(f.name).rowLabel) }));
    }
    flush();
    app.append(el("details", { class: "card section trend-group", open: true }, el("summary", {}, el("strong", {}, categoryLabel(named ? category : category))), ...blocks));
  }
}

function renderTrendDetail(group, range) {
  const unit = group.members[0].unit;
  const multi = group.members.length > 1;
  app.append(el("div", { class: "card stat-row" }, group.members.map((m) => {
    const s = stats(m.points), d = asDeviation(s.last);
    return stat(multi ? `${m.axis} latest` : "Latest", `${fmt(s.last.value)} ${unit}`.trim(),
      [chip(s.last.status), " ", s.last.expected !== null ? `${signed(d.dev)} ${unit} from ${fmt(s.last.expected)} ${unit}`.replace(/ +/g, " ") : "", el("br"),
        `${s.inTol}% within action level · mean ${fmt(s.mean, 2)} ± ${fmt(s.sd, 2)} ${unit}`.trim()]);
  }), (() => {
    const p = latest(group.members[0].points);
    const u = p.tol_mode === "percent" ? " %" : unit ? ` ${unit}` : "";
    return p.warn !== null ? stat("Limits", `Warning ±${fmt(p.warn)}${u}`, `Action ±${fmt(p.fail)}${u}`) : null;
  })()));

  app.append(seriesChart(group.members.map((m) => ({ label: m.axis || m.name, points: m.points })), unit, { yLabel: yAxisLabel(group.members.map((m) => m.name)) }));
  // One row per date, one column per axis.
  const byDate = new Map();
  group.members.forEach((m, k) => m.points.forEach((p) => {
    if (!byDate.has(p.qa_date)) byDate.set(p.qa_date, { run_id: p.run_id, cells: [] });
    byDate.get(p.qa_date).cells[k] = p;
  }));
  const dates = [...byDate.keys()].sort().reverse().slice(0, 100);
  app.append(el("details", { class: "card", open: dates.length <= 20 }, el("summary", {}, byDate.size > 100 ? "Latest 100 days" : "Values"),
    table(["QA date", ...group.members.map((m) => `#${m.axis || "Value"}`)], dates.map((d) => {
      const row = byDate.get(d);
      return el("tr", { class: "clickable", onclick: () => (location.hash = `#/runs/${row.run_id}`) },
        el("td", {}, d), group.members.map((m, k) => {
          const p = row.cells[k];
          return el("td", { class: "num" }, p ? [`${fmt(p.value)} ${unit}`.trim(), " ", chip(p.status)] : "");
        }));
    }))));
}

function stat(label, value, note) {
  return el("div", { class: "stat" }, el("div", { class: "muted small" }, label), el("div", { class: "stat-value" }, value), el("div", { class: "small muted" }, note));
}

// Search: machines, QA lists and tests whose names contain the words typed; each result links to where it lives.
async function renderSearch() {
  const q = (queryParams().get("q") || "").trim();
  page("Search", q ? `Results for "${q}"` : "Type in the box at the top right and press Enter.");
  if (!q) return;
  const words = q.toLowerCase().split(/\s+/);
  const hit = (text) => words.every((w) => String(text || "").toLowerCase().includes(w));
  const [machines, queues, tests] = await Promise.all([api("GET", "/api/machines"), api("GET", "/api/queues"), can("configure") ? api("GET", "/api/tests") : []]);
  const section = (title, rows, cols) => {
    if (!rows.length) return;
    app.append(el("h2", { class: "section-head" }, `${title} (${rows.length})`), fixedTable(cols, rows));
  };
  section("Machines", machines.filter((m) => hit(`${m.name} ${m.kind}`)).map((m) => el("tr", {},
    el("td", {}, el("a", { href: `#/machines/${m.id}` }, el("strong", {}, m.name))), el("td", { class: "muted" }, m.kind || "—"),
    el("td", {}, el("a", { class: "button small", href: `#/trends?machine_id=${m.id}` }, "Trends")))),
    [["Machine", "40%"], ["Kind", "40%"], ["", "20%"]]);
  section("QA lists", queues.filter((x) => hit(`${x.name} ${x.machines || ""}`)).map((x) => el("tr", {},
    el("td", {}, el("a", { href: `#/queues/${x.id}` }, el("strong", {}, x.name))), el("td", { class: "muted" }, x.machines || "Not scheduled"),
    el("td", { class: "center" }, x.item_count))),
    [["QA list", "50%"], ["Where", "40%"], ["Tests", "10%"]]);
  const byQueue = new Map(queues.map((x) => [x.id, x]));
  section("Tests", tests.filter((t) => hit(`${t.name} ${t.category || ""} ${t.owner_name || ""}`)).slice(0, 200).map((t) => {
    const owner = byQueue.get(t.owner_queue_id);
    return el("tr", {},
      el("td", {}, owner ? el("a", { href: `#/queues/${owner.id}` }, t.name) : t.name), el("td", { class: "muted" }, categoryLabel(t.category) || "—"),
      el("td", { class: "muted" }, t.owner_name || "Shared"), el("td", { class: "muted" }, t.unit || ""));
  }), [["Test", "45%"], ["Category", "20%"], ["QA list", "25%"], ["Unit", "10%"]]);
  if (!app.querySelector("h2")) app.append(el("p", { class: "muted" }, "Nothing matches."));
}

async function renderTrends() {
  const params = queryParams();
  const machines = (await api("GET", "/api/machines")).filter((m) => m.active);
  const fallback = machines.find((m) => m.kind === "Proton gantry") || machines[0];
  const machineId = machines.some((m) => String(m.id) === params.get("machine_id")) ? params.get("machine_id") : (fallback && fallback.id);
  const range = params.get("range") || "90";
  const testIds = (params.get("test_id") || "").split(",").filter(Boolean);
  // The machine, QA list and range stay frozen at the top while the tests scroll under them (as on Perform QA).
  const lists = machineId ? (await api("GET", `/api/machines/${machineId}/assignments`)).filter((a) => a.active) : [];
  const listId = lists.some((a) => String(a.id) === params.get("list")) ? params.get("list") : "";
  const go = (next) => { location.hash = `#/trends?${new URLSearchParams(Object.entries(next).filter(([, v]) => v))}`; };
  page("Machine Trends", null, [
    select("machine_id", machines.map((m) => [m.id, m.name]), machineId, { "aria-label": "Machine", onchange: (e) => go({ machine_id: e.target.value, range }) }),
    select("list", [["", "All QA lists"], ...lists.map((a) => [a.id, a.queue_name])], listId, { "aria-label": "QA list", onchange: (e) => go({ machine_id: machineId, list: e.target.value, range }) }),
    select("range", [["30", "Last 30 days"], ["90", "Last 3 months"], ["365", "Last year"], ["all", "All history"]], range, { "aria-label": "Period", onchange: (e) => go({ machine_id: machineId, list: listId, test_id: testIds.join(","), range: e.target.value }) }),
    testIds.length ? el("a", { class: "button", href: `#/trends?${new URLSearchParams(Object.entries({ machine_id: machineId, list: listId, range }).filter(([, v]) => v))}` }, "← All tests") : null]);
  app.querySelector(".page-head").classList.add("sticky-head", "trends-head");
  if (!machines.length) return app.append(el("div", { class: "card empty" }, "No machines yet."));
  if (!testIds.length) return renderTrendOverview(machines, machineId, range, listId);
  const data = await Promise.all(testIds.map((id) => api("GET", `/api/trend?machine_id=${machineId}&test_id=${id}`)));
  const assignments = await api("GET", `/api/machines/${machineId}/assignments`);
  const templates = await Promise.all(assignments.filter((a) => a.active).map((a) => api("GET", `/api/assignments/${a.id}/template`)));
  const listItems = new Map(templates.flatMap((t) => t.items).map((i) => [String(i.test_id), i]));
  const items = data.map((d) => {
    const li = listItems.get(String(d.test.id));
    const limits = li ? li.limits : { expected: d.test.expected, warn: d.test.warn, fail: d.test.fail, tol_mode: d.test.tol_mode };
    return { ...d.test, test_id: d.test.id, limits, points: judgedByList({ limits }, filterRange(d.points, range)) };
  }).filter((i) => i.points.length);
  const head = data[0].test;
  const group = axisGroups(items)[0];
  app.append(el("h2", {}, group ? group.base : head.name, group ? axisLegend(group) : null),
    el("p", { class: "muted small" }, [sectionOf(head), categoryLabel(head.category)].join(" · ")));
  if (!group) return app.append(el("div", { class: "card empty" }, "No results for this test in this period."));
  renderTrendDetail(group, range);
}

// ---------------------------------------------------------------------------
// Users, audit, account
// ---------------------------------------------------------------------------

function userForm(user) {
  const u = user || { role: "therapist", active: 1 };
  return el("div", { class: "form-grid" },
    user ? null : field("Username", el("input", { name: "username", required: true, autocomplete: "off" })),
    field("Full name", el("input", { name: "full_name", value: u.full_name || "" })),
    field("Role", select("role", Object.entries(ROLE_LABEL), u.role)),
    field(user ? "New password (leave blank to keep)" : "Temporary password", el("input", { name: "password", type: "password", autocomplete: "new-password", minlength: 10, required: !user })),
    user ? el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!u.active }), "Active") : null,
    el("p", { class: "muted small wide" }, "Admins manage users. Physicists configure machines, queues and limits, and review runs. Therapists perform QA."));
}

// Admin: who can sign in and what they may do, and the folders each QA list reads its export files from.
const RIGHTS = [
  ["perform", "Perform QA"],
  ["review", "Review and approve"],
  ["configure", "Set up QA lists, machines, limits and folders"],
  ["manage_users", "Manage users"],
];
const ROLE_RIGHTS = { admin: ["perform", "review", "configure", "manage_users"], physicist: ["perform", "review", "configure"], therapist: ["perform"] };

async function renderAdmin() {
  page("Data Administration", "Users and their rights, the folders export files are read from, and the database.");
  const [users, machines] = await Promise.all([can("manage_users") ? api("GET", "/api/users") : null, api("GET", "/api/machines")]);

  // 1. Users and rights (admins only; others see what each role may do).
  app.append(el("h2", { class: "section-head" }, "Machines"),
    el("p", { class: "muted" }, "Add or edit machines and their schedules on the ", el("a", { href: "#/machines" }, "machines page"), ". Machine names in Setup QA open the same page."));
  app.append(el("h2", { class: "section-head" }, "Users and rights"));
  if (!users) {
    app.append(el("p", { class: "muted" }, "Only an admin can add users or change roles. What each role may do:"),
      table(["Role", ...RIGHTS.map(([, label]) => label)], Object.entries(ROLE_RIGHTS).map(([role, rights]) => el("tr", {},
        el("td", {}, el("strong", {}, ROLE_LABEL[role])), RIGHTS.map(([key]) => el("td", { class: "center" }, rights.includes(key) ? el("span", { class: "tick" }, "✓") : el("span", { class: "muted" }, "—")))))));
  }
  if (users) app.append(
    el("p", { class: "row" }, el("span", { class: "muted" }, "Rights come from each person's role."), el("span", { class: "spacer" }),
      el("button", { class: "primary", onclick: () => modal("Add user", userForm(), async (data) => {
        await api("POST", "/api/users", data);
        toast("User added");
        route();
      }) }, "Add user")));
  const tick = (on) => el("td", { class: "center" }, on ? el("span", { class: "tick" }, "✓") : el("span", { class: "muted" }, "—"));
  if (users) app.append(table(["Username", "Name", "Role", ...RIGHTS.map(([, label]) => label), "Status", ""], users.map((u) => el("tr", {},
    el("td", {}, el("strong", {}, u.username)),
    el("td", {}, u.full_name),
    el("td", {}, ROLE_LABEL[u.role]),
    RIGHTS.map(([key]) => tick(ROLE_RIGHTS[u.role].includes(key))),
    el("td", {}, u.active ? chip("pass", "Active") : chip("", "Disabled")),
    el("td", { class: "right" }, el("button", { class: "small", onclick: () => modal(`Edit ${u.username}`, userForm(u), async (data) => {
      await api("PUT", `/api/users/${u.id}`, data);
      toast("User saved");
      route();
    }) }, "Edit"))))));

  // 2. Import folders: one per scheduled QA list. When a list has a folder, its newest unrecorded export
  // is read automatically when someone starts that list's QA (no file dialog).
  app.append(el("h2", { class: "section-head" }, "Import folders (auto-read)"),
    el("p", { class: "muted" }, window.localApi
      ? "Choose the folder each list's export files (Sphinx .xls) are saved to. When QA is started, the newest file not yet recorded is read in automatically. Folders are remembered in this browser on this computer (Chrome or Edge)."
      : "The folder (on this PC or a network share it can read) each list's export files (Sphinx .xls) are saved to. When QA is started, the newest file not yet recorded is read in automatically."));
  const rows = [];
  for (const m of machines.filter((x) => x.active)) {
    for (const a of await api("GET", `/api/machines/${m.id}/assignments`)) {
      const status = el("span", { class: "muted small" }, a.import_folder ? "Checking…" : "No folder");
      const check = async () => {
        if (!a.import_folder && !window.localApi) { status.textContent = "No folder"; return; }
        try {
          const r = await api("GET", `/api/assignments/${a.id}/files`);
          if (r.permission === "none" && window.localApi) { status.textContent = "No folder chosen on this computer"; return; }
          if (r.permission && r.permission !== "granted" && r.permission !== "none") { status.textContent = "Needs permission again (open the list's Perform page)"; return; }
          const waiting = r.files.filter((f) => !f.run_id).length;
          status.replaceChildren(chip(waiting ? "due" : "pass", `${r.files.length} files · ${waiting} not yet recorded`));
        } catch (err) {
          status.replaceChildren(el("span", { class: "error small" }, err.message));
        }
      };
      let pathCell;
      if (window.localApi) {
        pathCell = importFolderField(a);
      } else {
        const input = el("input", { value: a.import_folder || "", placeholder: "e.g. G:\\My Drive\\…\\ProtonDaily\\G1 Sphinx" });
        const save = el("button", { class: "small primary", onclick: async () => {
          try {
            await api("PUT", `/api/assignments/${a.id}`, { frequency: a.frequency, interval_days: a.interval_days, weekdays: String(a.weekdays).split(",").map(Number),
              start_date: a.start_date, active: !!a.active, import_folder: input.value.trim() });
            a.import_folder = input.value.trim();
            toast("Folder saved");
            check();
          } catch (err) {
            toast(err.message, true);
          }
        } }, "Save");
        pathCell = el("div", { class: "row nowrap" }, input, save);
      }
      rows.push(el("tr", {}, el("td", {}, el("strong", {}, m.name)), el("td", {}, a.queue_name), el("td", { class: "folder-cell" }, pathCell), el("td", {}, status)));
      check();
    }
  }
  app.append(table(["Machine", "QA list", "Folder", "Status"], rows, "No QA lists are scheduled yet."));

  // 3. Database location. Server build: one SQLite file on the host PC (set with --db or PROTON_QA_DB when starting).
  if (!window.localApi) {
    const info = await api("GET", "/api/dbinfo").catch(() => null);
    if (info) {
      app.append(el("h2", { class: "section-head" }, "Database"), el("div", { class: "card" },
        el("p", {}, el("strong", {}, info.path), el("span", { class: "muted small" }, ` · ${(info.size / 1048576).toFixed(1)} MB`)),
        el("p", { class: "muted small" }, "All results are in this one file on the host PC. Back it up by copying it while the portal is stopped."),
        can("manage_users") ? dbSwitchForm(info.path) : null));
    }
  }
  // Browser build: where this browser keeps the database, and backups.
  if (window.localApi && can("configure")) {
    const restore = el("input", { type: "file", accept: ".json", hidden: true });
    restore.addEventListener("change", async () => {
      const file = restore.files[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        if (!confirm(`Replace everything in this browser with the backup from ${backup.exported_at || "unknown date"}?`)) return;
        await api("POST", "/api/restore", backup);
        toast("Backup restored");
        route();
      } catch (err) {
        toast(err.message, true);
      }
    });
    app.append(el("h2", { class: "section-head" }, "Database and backup"), databaseLocationCard(),
      el("div", { class: "card" }, el("p", { class: "muted" }, "Save a backup file regularly, and restore it on another computer to move the data."),
        el("div", { class: "row" },
          el("button", { onclick: async () => {
            const backup = await api("GET", "/api/backup");
            const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
            const link = el("a", { href: URL.createObjectURL(blob), download: `qa-portal-backup-${today()}.json` });
            document.body.append(link); link.click(); link.remove();
          } }, "Save backup"),
          el("button", { onclick: () => restore.click() }, "Restore from backup"), restore)));
  }
}

async function renderUsers() {
  const users = await api("GET", "/api/users");
  page("Users", null, [el("button", { class: "primary", onclick: () => modal("Add user", userForm(), async (data) => {
    await api("POST", "/api/users", data);
    toast("User added");
    route();
  }) }, "Add user")]);
  app.append(table(["Username", "Name", "Role", "Status", "Created"], users.map((u) =>
    el("tr", { class: "clickable", onclick: () => modal(`Edit ${u.username}`, userForm(u), async (data) => {
      await api("PUT", `/api/users/${u.id}`, data);
      toast("User saved");
      route();
    }) },
      el("td", {}, el("strong", {}, u.username)), el("td", {}, u.full_name), el("td", {}, ROLE_LABEL[u.role]),
      el("td", {}, u.active ? chip("pass", "Active") : chip("", "Disabled")), el("td", {}, u.created_at.slice(0, 10))))));
}

async function renderAudit() {
  const rows = await api("GET", "/api/audit");
  page("Audit log", "Who changed what, newest first.");
  app.append(table(["When", "User", "Action", "Item", "Details"], rows.map((a) => el("tr", {},
    el("td", {}, a.at.replace("T", " ")), el("td", {}, a.username || ""), el("td", {}, a.action),
    el("td", {}, `${a.entity}${a.entity_id ? " #" + a.entity_id : ""}`),
    el("td", { class: "small muted" }, a.detail === "{}" ? "" : a.detail)))));
}

async function renderAccount() {
  page("My account", `${personName(state.user.full_name, state.user.username)} · ${ROLE_LABEL[state.user.role]}`);
  const error = el("p", { class: "error" });
  const form = el("form", { class: "card" }, el("h2", {}, "Change password"), el("div", { class: "form-grid" },
    field("Current password", el("input", { name: "current", type: "password", autocomplete: "current-password", required: true })),
    field("New password (10+ characters)", el("input", { name: "new", type: "password", autocomplete: "new-password", minlength: 10, required: true }))),
    error, el("br"), el("button", { class: "primary", type: "submit" }, "Change password"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    try {
      await api("POST", "/api/password", formData(form));
      form.reset();
      toast("Password changed");
    } catch (err) {
      error.textContent = err.message;
    }
  });
  app.append(form);
}

// ---------------------------------------------------------------------------

window.addEventListener("hashchange", route);
api("GET", "/api/me").then((data) => {
  state.user = data.user;
  route();
}).catch(() => renderLogin());
