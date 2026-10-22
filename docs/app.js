"use strict";

// ---------------------------------------------------------------------------
// Small helpers. Everything is built with DOM nodes (never innerHTML) so user
// text cannot inject markup.
// ---------------------------------------------------------------------------

const state = { user: null, cache: {} };
const app = document.getElementById("app");
const ROLE_LABEL = { admin: "Admin", physicist: "Physicist", therapist: "Therapist" };
const STATE_LABEL = { overdue: "Overdue", due: "Due today", done: "Done today", upcoming: "Upcoming" };
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", semiannual: "Semiannual", annual: "Annual", custom: "Custom interval",
  asneeded: "As needed (e.g. SRS days)" };
// A list can be started when it is due, overdue, or "as needed".
const startable = (state) => state === "due" || state === "overdue" || state === "ready";
function scheduleStatus(a) {
  if (!a.active) return "Paused";
  if (a.state === "overdue") return `Overdue since ${shortDate(a.next_due)}`;
  if (a.state === "due") return "Due today";
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

const STATUS_LABEL = { warn: "Tolerance", fail: "Action" };
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
  return el("div", { class: "table-wrap" }, el("table", {},
    el("thead", {}, el("tr", {}, headers.map((h) => el("th", { class: h.startsWith("#") ? "num" : "" }, h.replace(/^#/, ""))))),
    el("tbody", {}, rows)));
}

function limitsText(limits, unit) {
  if (!limits || limits.expected === null || limits.expected === undefined) {
    return limits && (limits.warn !== null || limits.fail !== null) ? "Limits need an expected value" : "No limits";
  }
  const suffix = limits.tol_mode === "percent" ? "%" : unit ? ` ${unit}` : "";
  const parts = [`${fmt(limits.expected)}${unit ? " " + unit : ""}`];
  if (limits.warn !== null && limits.warn !== undefined) parts.push(`tolerance ±${fmt(limits.warn)}${suffix}`);
  if (limits.fail !== null && limits.fail !== undefined) parts.push(`action ±${fmt(limits.fail)}${suffix}`);
  return parts.join(" · ");
}

const TYPE_LABELS = { numeric: "Numeric", boolean: "Pass / fail", status: "Pass / warning / fail", text: "Text" };
const STATUS_WORDS = { pass: "Pass", warn: "Warning", fail: "Fail" };

// Mirrors portal/qa.py evaluate(); the server re-checks on submit.
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
  ["#/", "⌂", null, ["#/", "#"], "Home"],
  ["#/perform-qa", "Perform QA", null, ["#/perform-qa", "#/perform", "#/runs"]],
  ["#/setup", "Setup QA", "configure", ["#/setup", "#/queues", "#/tests", "#/audit"]],
  ["#/machines", "Machines", "configure", ["#/machines", "#/assignments"]],
  ["#/trends", "Machine Trends", null, ["#/trends"]],
  ["#/admin", "Data Administration", "configure", ["#/admin", "#/users"]],
];

function homeIcon() {
  return svg("svg", { viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true", class: "home-icon" },
    svg("path", { d: "M3 11.5 12 4l9 7.5", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    svg("path", { d: "M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linejoin": "round" }));
}

// Home: one look at every machine — today's QA, last result, and what is waiting for review.
async function renderHome() {
  const data = await api("GET", "/api/dashboard");
  page("Home", new Date(data.today + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
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
      const worst = m.queues.reduce((w, q) => (q.state === "overdue" ? "overdue" : w === "overdue" ? w : q.state === "due" ? "due" : w), "done");
      const lasts = m.queues.filter((q) => q.last_run);
      const lastRun = lasts.sort((a, b) => (b.last_run.qa_date || "").localeCompare(a.last_run.qa_date || ""))[0];
      return el("tr", { class: "clickable", onclick: () => (location.hash = `#/trends?machine_id=${m.id}`) },
        el("td", {}, el("strong", {}, m.name)),
        el("td", {}, m.queues.length ? m.queues.map((q) => el("div", { class: "small" }, q.queue_name)) : el("span", { class: "muted small" }, "None")),
        el("td", {}, m.queues.length ? chip(worst === "done" ? "pass" : worst, worst === "overdue" ? "Overdue" : worst === "due" ? "Due today" : "Up to date") : el("span", { class: "muted small" }, "Nothing scheduled")),
        el("td", {}, lastRun ? [chip(lastRun.last_run.overall), " ", el("span", { class: "small" }, `${lastRun.queue_name} · ${shortDate(lastRun.last_run.qa_date)}`)] : el("span", { class: "muted small" }, "No runs yet")),
        el("td", { class: "num" }, m.pending_review ? el("a", { href: `#/runs?machine_id=${m.id}&review_status=pending` }, String(m.pending_review)) : el("span", { class: "muted" }, "0")),
        el("td", { class: "right" }, el("a", { class: "button small", href: `#/trends?machine_id=${m.id}`, onclick: (e) => e.stopPropagation() }, "Trends")));
    });
    app.append(modalityHead(modality, `${machines.length} ${machines.length === 1 ? "machine" : "machines"}`),
      fixedTable([["Machine", "14%"], ["Active QA lists", "26%"], ["Today", "14%"], ["Last result", "26%"], ["#To review", "10%"], ["", "10%"]], rows));
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

function renderShell() {
  const bar = document.getElementById("topbar");
  bar.hidden = !state.user;
  if (!state.user) return;
  const current = location.hash.split("?")[0].split("/").slice(0, 2).join("/") || "#/";
  document.getElementById("nav").replaceChildren(...NAV.filter(([, , p]) => !p || can(p)).map(([href, label, , owns, title]) =>
    el("a", { href, title: title || null, "aria-label": title || null, class: `${owns.includes(current) ? "active" : ""}${title ? " home-link" : ""}` },
      title ? homeIcon() : label)));
  document.getElementById("who").replaceChildren(
    el("a", { href: "#/account", title: ROLE_LABEL[state.user.role] }, personName(state.user.full_name, state.user.username)),
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
    el("h1", {}, "UF Proton Machine QA Portal"),
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
  [/^#\/runs$/, renderRuns],
  [/^#\/runs\/(\d+)$/, renderRun],
  [/^#\/trends$/, renderTrends],
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
  return el("div", { class: "table-wrap fixed-wrap" }, el("table", { class: "fixed-table" },
    el("colgroup", {}, columns.map(([, width]) => { const col = el("col"); if (width) col.style.width = width; return col; })),
    el("thead", {}, el("tr", {}, columns.map(([h]) => el("th", { class: h.startsWith("#") ? "num" : "" }, h.replace(/^#/, ""))))),
    el("tbody", {}, rows)));
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
    const rows = machines.flatMap((machine) => {
      if (!machine.queues.length) return [el("tr", {}, el("td", {}, el("strong", {}, machine.name)), el("td", { class: "muted", colspan: 4 }, "Nothing scheduled."))];
      return machine.queues.map((q, i) => {
        const due = startable(q.state);
        const last = q.last_run;
        return el("tr", { class: `${q.state === "overdue" ? "row-overdue" : ""} ${i === 0 ? "first-of-machine" : ""}` },
          el("td", {}, el("strong", {}, machine.name)),
          el("td", {}, q.queue_name, el("div", { class: "muted small" }, q.schedule)),
          el("td", {}, chip(q.state, scheduleStatus({ ...q, active: 1 }))),
          el("td", {}, last ? [chip(last.overall), " ", el("a", { class: "small", href: `#/runs/${last.id}` }, shortDate(last.qa_date))] : el("span", { class: "muted small" }, "No runs yet")),
          el("td", { class: "right" }, due && can("perform") ? el("a", { class: q.state === "ready" ? "button small" : "button primary small", href: `#/perform/${q.id}` }, "Start")
            : last ? el("a", { class: "button small", href: `#/runs/${last.id}` }, "View") : null));
      });
    });
    app.append(modalityHead(modality, `${machines.length} ${machines.length === 1 ? "machine" : "machines"}`),
      fixedTable([["Machine", "20%"], ["QA list", "30%"], ["Status", "18%"], ["Last result", "20%"], ["", "12%"]], rows));
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

// Setup QA: the QA lists themselves (templates and each machine's copy), all editable. Same layout as Perform QA.
async function renderSetup() {
  const editable = can("configure");
  page("Setup QA", "The QA lists and the tests in them. Open a list to edit its tests, order and limits.",
    editable ? [el("a", { class: "button primary", href: "#/queues/new" }, "New QA list")] : []);
  const [queues, machines] = await Promise.all([api("GET", "/api/queues"), api("GET", "/api/machines")]);
  // Archived lists are hidden here and everywhere else; they come back from the Archived section below.
  const archivedLists = queues.filter((q) => !q.active);
  const templates = queues.filter((q) => q.is_template && q.active);
  const lists = queues.filter((q) => !q.is_template && q.active);
  app.append(el("p", { class: "lead" },
    `${templates.length} QA list ${templates.length === 1 ? "template" : "templates"} · ${lists.length} machine-specific QA ${lists.length === 1 ? "list" : "lists"}. `,
    el("span", { class: "muted small" }, "A template is the master copy; copying it to a machine gives that machine its own editable list.")));

  const actions = (q) => el("td", { class: "right" }, el("div", { class: "row nowrap end" },
    el("a", { class: "button small primary", href: `#/queues/${q.id}` }, editable ? "Edit tests" : "Tests"),
    editable ? el("button", { class: "small", onclick: () => duplicateDialog(q, machines) }, q.is_template ? "Copy to a machine" : "Duplicate") : null,
    editable ? el("button", { class: "small", title: "Hide this list (nothing is deleted)", onclick: () => archiveList(q, true) }, "Archive") : null,
    editable ? el("button", { class: "small danger", title: "Delete permanently (only if it has no results)", onclick: () => deleteList(q) }, "Delete") : null));

  app.append(el("h2", { class: "section-head" }, "QA List Templates"));
  const SETUP_COLS = (first, second) => [[first, "36%"], [second, "20%"], ["#Tests", "8%"], ["", "36%"]];
  app.append(templates.length ? fixedTable(SETUP_COLS("QA List Template", "Copies on"), templates.map((t) => el("tr", {},
    el("td", {}, editableName(t, editable)),
    el("td", { class: "muted" }, lists.filter((q) => q.template_id === t.id).map((q) => q.machines).filter(Boolean).join(", ") || "none yet"),
    el("td", { class: "num" }, t.item_count),
    actions(t))))
    : el("div", { class: "card empty" }, "No templates yet. Open a list and tick \"Template\" to make it one."));

  // Bottom table: every QA list instantiated on a machine (a copy of a template), one row each.
  const kindOf = Object.fromEntries(machines.map((m) => [m.name, m.kind || "Other"]));
  const KIND_ORDER = ["Proton gantry", "Linac", "CT simulator", "MRI simulator"];
  const rank = (q) => { const k = kindOf[(q.machines || "").split(", ")[0]]; const i = KIND_ORDER.indexOf(k); return q.machines ? (i < 0 ? KIND_ORDER.length : i) : 99; };
  const ordered = lists.slice().sort((x, y) => rank(x) - rank(y) || (x.machines || "").localeCompare(y.machines || "") || x.name.localeCompare(y.name));
  app.append(el("h2", { class: "section-head" }, "Machine-Assigned QA List Instances"),
    el("p", { class: "muted" }, "Each list here is that machine's own copy. Edits made here change only that machine's list; they do not affect the template it came from."));
  const byMachine = new Map();
  for (const q of ordered) {
    const key = (q.machines || "").split(", ")[0] || "Not on a machine";
    if (!byMachine.has(key)) byMachine.set(key, []);
    byMachine.get(key).push(q);
  }
  const machineRows = [...byMachine].flatMap(([name, qs]) => {
    const m = machines.find((x) => x.name === name);
    return [el("tr", { class: "machine-row" }, el("td", { colspan: 4 }, el("strong", {}, name), m && m.kind ? el("span", { class: "muted small" }, ` · ${m.kind}`) : null)),
      ...qs.map((q) => el("tr", { class: q.active ? "" : "muted" },
        el("td", { class: "indent" }, editableName(q, editable), q.template_name ? el("div", { class: "muted small" }, `from ${q.template_name}`) : null),
        el("td", {}, qs.length > 1 ? el("span", { class: "muted small" }, name) : name),
        el("td", { class: "num" }, q.item_count),
        actions(q)))];
  });
  app.append(fixedTable(SETUP_COLS("QA List", "Machine"), machineRows, "No QA lists on machines yet. Copy a template to a machine."));

  if (archivedLists.length) {
    app.append(el("details", { class: "archived" }, el("summary", {}, `Archived QA lists (${archivedLists.length})`),
      el("p", { class: "muted small" }, "Hidden from Perform QA, Machines and Trends. Their tests and results are kept."),
      table(["QA list", "Kind", "#Tests", ""], archivedLists.map((q) => el("tr", { class: "muted" },
        el("td", {}, el("strong", {}, q.name)), el("td", {}, q.is_template ? "Template" : "Machine list"), el("td", { class: "num" }, q.item_count),
        el("td", { class: "right" }, editable ? el("div", { class: "row nowrap end" },
          el("button", { class: "small primary", onclick: () => archiveList(q, false) }, "Restore"),
          el("button", { class: "small danger", onclick: () => deleteList(q) }, "Delete")) : null))))));
  }

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
  const templates = all.filter((q) => q.active && q.is_template);
  const free = all.filter((q) => q.active && !q.is_template && !assigned.some((a) => a.queue_id === q.id));
  if (!templates.length && !free.length) return toast("No QA lists to add. Make a template under Setup QA first.", true);
  const sameKind = templates.find((t) => (t.name || "").toLowerCase().includes((machine.kind || "~").toLowerCase()));
  const pick = el("div", { class: "form-grid" },
    field("Start from", select("source", [...templates.map((q) => [`t${q.id}`, `Template: ${q.name}`]), ...free.map((q) => [`q${q.id}`, `Existing list: ${q.name}`])],
      `t${(sameKind || templates[0] || {}).id}`), "wide"),
    field("Name for this machine's copy", el("input", { name: "name", placeholder: `Daily QA – ${machine.name}` }), "wide"),
    scheduleForm(null));
  const source = pick.querySelector("[name=source]");
  const nameField = pick.querySelector("[name=name]").closest(".field");
  const sync = () => (nameField.hidden = !source.value.startsWith("t"));
  source.addEventListener("change", sync);
  sync();
  modal(`Add a QA list to ${machine.name}`, pick, async (data, form) => {
    const schedule = { ...scheduleData(data, form), machine_id: machine.id };
    if (data.source.startsWith("t")) {
      await api("POST", `/api/queues/${data.source.slice(1)}/duplicate`, { ...schedule, name: data.name || `Daily QA – ${machine.name}` });
    } else {
      await api("POST", "/api/assignments", { ...schedule, queue_id: Number(data.source.slice(1)) });
    }
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
          el("td", { class: "indent" }, a.queue_name, q.template_name ? el("div", { class: "muted small" }, `from ${q.template_name}`) : null),
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
      const templates = all.filter((q) => q.active && q.is_template);
      const free = all.filter((q) => q.active && !q.is_template && !assignments.some((a) => a.queue_id === q.id));
      if (!templates.length && !free.length) return toast("No QA lists to add. Make a template first.", true);
      const pick = el("div", { class: "form-grid" },
        field("Start from", select("source", [...templates.map((q) => [`t${q.id}`, `Template: ${q.name}`]), ...free.map((q) => [`q${q.id}`, `Existing list: ${q.name}`])], templates[0] ? `t${templates[0].id}` : ""), "wide"),
        field("Name for this machine's copy", el("input", { name: "name", placeholder: `Daily QA – ${machine.name}` }), "wide"),
        scheduleForm(null));
      const source = pick.querySelector("[name=source]");
      const nameField = pick.querySelector("[name=name]").closest(".field");
      const sync = () => (nameField.hidden = !source.value.startsWith("t"));
      source.addEventListener("change", sync);
      sync();
      modal(`Add a QA list to ${machine.name}`, pick, async (data, form) => {
        const schedule = { ...scheduleData(data, form), machine_id: Number(id) };
        if (data.source.startsWith("t")) {
          await api("POST", `/api/queues/${data.source.slice(1)}/duplicate`, { ...schedule, name: data.name || `Daily QA – ${machine.name}` });
        } else {
          await api("POST", "/api/assignments", { ...schedule, queue_id: Number(data.source.slice(1)) });
        }
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
      el("td", {}, select("tol_mode", [["", `List (${q.tol_mode})`], ["absolute", "Absolute"], ["percent", "Percent"]], o.tol_mode || "")));
  });
  app.append(table(["Test", "Expected", "Tolerance ±", "Action ±", "Limits are"], rows));
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
  // Checks copied from RadMachine read No / Yes (Yes = pass); their unit is set to "Yes/No".
  const choices = withWarning ? [["pass", "Pass"], ["warn", "Warning"], ["fail", "Fail"]] : yesNo ? [["fail", "No"], ["pass", "Yes"]] : [["pass", "Pass"], ["fail", "Fail"]];
  for (const [v, label] of choices) {
    buttons.push(el("button", { type: "button", class: `seg ${v}`, "data-value": v, "aria-label": `${name}: ${label.toLowerCase()}`, onclick: pick(v) }, label));
  }
  return { value, control: el("div", { class: "segmented" }, ...buttons, value) };
}

// Directions are shown with the test, numbered as in the template (1.01, 2.04, ...).
const TEMPLATE_NUMBER = /^Template (\d+)\.(\d+)\.\s*/;
// Lists copied from RadMachine keep its own section names: "Template 1.04. [Section: PBS DailyQA GTR5 - Sphinx] ...".
const SECTION_NAME = /\[Section: ([^\]]+)\]\s*/;
const sectionNameOf = (item) => { const m = SECTION_NAME.exec(item.description || ""); return m ? m[1] : null; };
function helpText(description) {
  if (!description || description.startsWith("Measured by Sphinx")) return null;
  const text = description.replace(TEMPLATE_NUMBER, "").replace(SECTION_NAME, "").trim();
  return text ? el("div", { class: "directions pre" }, el("div", { class: "directions-label" }, "Directions"), text) : null;
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
  const generic = { 0: "Setup", 1: "Safety", 2: "Mechanical and imaging", 3: "Dosimetry", 4: "Other" };
  const label = number === 0 ? generic[0] : names.length <= 2 ? names.join(" and ") : (generic[number] || "Other");
  return `${number}.0 ${label}`;
}

// Section label for a test on its own (Trends), e.g. "3.0 Dosimetry".
function sectionOf(item) {
  const n = sectionNumber(item);
  return sectionTitle(n, n === 3 || n === 4 ? [] : [item.category]).replace(/^(\d)\.0 $/, (_, d) => `${d}.0 ${{ 3: "Dosimetry", 4: "Other" }[d]}`);
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
  const rowLabel = [spot ? `Spot ${spot[1]}` : null, energy ? `${Number(energy[1])} MeV` : null].filter(Boolean).join(" · ");
  return { metric: hit[1], metricLabel, rowLabel, sortKey: (spot ? Number(spot[1]) : 0) * 10000 + (energy ? Number(energy[1]) : 0) };
}

function checkNumber(description) {
  const m = /^Template (\d+\.\d+)\./.exec(description || "");
  return m ? m[1] : "";
}

async function renderPerform(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  const history = t.items.some((i) => i.type === "numeric") ? await api("GET", `/api/machines/${t.machine.id}/trends`).catch(() => ({})) : {};
  page(t.queue.name, t.assignment.schedule);
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
      else if (item.type === "numeric") control = input = el("input", { type: "number", step: "any", class: "result-input", "aria-label": item.name });
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
        statusCell.replaceChildren(s && item.type !== "boolean" && item.type !== "status" ? chip(s) : "");
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
    for (const item of items) {
      if (drawn.has(item.test_id)) continue;
      if (!grouped.has(item.test_id)) {
        const { entry, control, comment, noteToggle, note, statusCell } = buildEntry(item);
        // As in the myQA template: the numbered title, then its directions block, then the result.
        const directions = helpText(item.description);
        rows.push(el("div", { class: `check-row${directions ? " with-directions" : ""}` },
          el("div", { class: "check-name" }, named && item.category ? el("div", { class: "category-tag" }, item.category) : null,
            el("strong", {}, checkNumber(item.description) ? `${checkNumber(item.description)}: ` : "", item.name.startsWith(category + " – ") ? item.name.slice(category.length + 3) : item.name),
            item.type === "numeric" ? el("div", { class: "muted small" }, limitsText(item.limits, item.unit)) : null, note),
          el("div", { class: "check-input" }, control, item.type === "numeric" && item.unit ? el("span", { class: "muted small" }, item.unit) : null),
          statusCell,
          el("div", { class: "check-note" }, noteToggle, comment),
          directions));
        continue;
      }
      const mp0 = measureParts(item.name);
      const family = families.get(`${mp0.metric}|${item.unit || ""}`).slice().sort((a, b) => a.mp.sortKey - b.mp.sortKey);
      const unit = item.unit && item.unit !== "unitless" ? item.unit : "";
      const trRows = family.map(({ item: it, mp }) => {
        drawn.add(it.test_id);
        const { control, comment, noteToggle, note, statusCell } = buildEntry(it);
        comment.hidden = false; noteToggle.hidden = true;          // the table has its own comment column
        const past = (history[it.test_id] || []).slice(-5).reverse();
        const chart = el("tr", { class: "quick-trend", hidden: true }, el("td", { colspan: 9 }));
        const trend = el("button", { type: "button", class: "icon-btn", title: "Show the trend here", onclick: () => {
          const pts = (history[it.test_id] || []).slice(-60);
          if (!pts.length) return toast("No results yet for this test.", true);
          if (chart.hidden) chart.firstChild.replaceChildren(
            el("div", { class: "row" }, el("strong", {}, `${mp.rowLabel} · ${mp.metricLabel}`), el("span", { class: "spacer" }),
              el("a", { class: "small", href: `#/trends?machine_id=${t.machine.id}&test_id=${it.test_id}&range=365` }, "Full trend")),
            seriesChart([{ label: it.name, points: pts }], unit, { small: true }));
          chart.hidden = !chart.hidden;
        } }, "📈");
        const row = el("tr", {},
          el("td", {}, el("strong", {}, mp.rowLabel), note),
          el("td", {}, el("div", { class: "row nowrap" }, control, unit ? el("span", { class: "muted small" }, unit) : null)),
          el("td", { class: "num" }, it.limits.expected !== null && it.limits.expected !== undefined ? `${fmt(it.limits.expected)} ${unit}`.trim() : el("span", { class: "muted" }, "—")),
          el("td", { class: "num" }, limitText(it.limits.warn, it.limits, unit)),
          el("td", { class: "num" }, limitText(it.limits.fail, it.limits, unit)),
          el("td", {}, statusCell),
          el("td", {}, comment),
          el("td", { class: "history-cell" }, past.length ? past.map((h) => el("span", { class: `hist ${h.status}`, title: `${h.qa_date}: ${fmt(h.value)} ${unit}`.trim() }, fmt(h.value))) : el("span", { class: "muted small" }, "—")),
          el("td", {}, trend));
        return [row, chart];
      });
      const directions = helpText(item.description);
      rows.push(el("div", { class: "measure-block" },
        el("div", { class: "measure-title" }, el("strong", {}, mp0.metricLabel), el("span", { class: "muted small" }, ` · ${family.length} values`)),
        directions,
        el("div", { class: "table-wrap measure-wrap" }, el("table", { class: "measure-table" },
          el("thead", {}, el("tr", {}, ["Energy", "Measurement", "Reference", "Tolerance", "Action", "Status", "Comment", "History (newest first)", ""].map((h) => el("th", {}, h)))),
          el("tbody", {}, trRows.flat())))));
    }
    const summary = el("span", { class: "section-summary" });
    const box = el("details", { class: "card section", open: true }, el("summary", {}, el("strong", {}, category), summary), rows);
    sections.push({
      box, heading, entries,
      refresh() {
        const s = entries.map((e) => e.status());
        const req = entries.filter((e) => e.required);
        const left = req.filter((e) => !e.status()).length;
        const bad = s.filter((x) => x === "fail").length;
        const warn = s.filter((x) => x === "warn").length;
        summary.replaceChildren(left ? `${left} to do` : "All done",
          bad ? [" · ", chip("fail", `${bad} action`)] : "", warn ? [" · ", chip("warn", `${warn} tolerance`)] : "");
      },
      settled() {
        return entries.every((e) => !e.required || e.status() === "pass" || e.status() === "recorded");
      },
    });
  }

  const qaDate = el("input", { type: "date", value: today(), max: today(), "aria-label": "QA date" });
  const runComment = el("textarea", { placeholder: "Anything the reviewer should know" });
  let sourceRef = null;
  const sphinxInfo = el("div", { class: "small" });
  const applySphinx = async () => {
    const p = await api("POST", `/api/assignments/${assignmentId}/sphinx/preview`, { file: state.sphinxFile });
    sourceRef = p.source_ref;
    qaDate.value = p.qa_date;
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
  app.append(el("div", { class: "card step" }, el("strong", {}, "Measurement file"),
    el("span", { class: "muted small" }, " A Sphinx export fills in every measured value. (DQA3 and MPC exports for the TrueBeam: importer not built yet.)"),
    autoLine, el("div", {}, sphinxFile), sphinxInfo));
  if (!t.items.length) {
    app.append(el("div", { class: "card empty" }, "This list has no tests yet. ",
      can("configure") ? [el("a", { href: `#/queues/${t.queue.id}` }, "Add tests"), ", or load a Sphinx file above."] : ""));
    return;
  }
  app.append(...sections.flatMap((s) => [s.heading, s.box]));
  const error = el("p", { class: "error" });
  const submit = el("button", { class: "primary", onclick: async () => {
    error.textContent = "";
    submit.disabled = true;
    try {
      const results = inputs.map((i) => ({ test_id: i.item.test_id, value: i.input.value.trim(), comment: i.comment.value }));
      const result = await api("POST", `/api/assignments/${assignmentId}/runs`, { qa_date: qaDate.value, comment: runComment.value, results, source_ref: sourceRef });
      toast(`Saved. Overall: ${capitalize(result.overall)}`);
      location.hash = `#/runs/${result.id}`;
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  } }, "Submit for review");
  app.append(el("details", { class: "card" }, el("summary", {}, "Notes for the reviewer"), runComment), error);
  app.append(el("div", { class: "submit-bar" }, el("label", { class: "inline" }, "QA date ", qaDate), progress, overallChip,
    el("div", { class: "spacer" }), el("a", { class: "button", href: "#/perform-qa" }, "Cancel"), submit));
  refresh();
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

function duplicateDialog(source, machines) {
  // Name the copy, and optionally put it straight onto a machine.
  const body = el("div", {},
    el("p", { class: "muted" }, `Every test in "${source.name}" is copied, so the new list's limits can be adjusted on its own.`),
    el("div", { class: "form-grid" },
      field("Name for the copy", el("input", { name: "name", required: true, placeholder: `${source.name.replace(/ template$/i, "")} – GTR2` }), "wide"),
      field("Schedule on", select("machine_id", [["", "Not yet"], ...machines.filter((m) => m.active).map((m) => [m.id, m.name])], ""))),
    el("div", { class: "schedule-part", hidden: true }, scheduleForm(null)));
  const machinePick = body.querySelector("[name=machine_id]");
  const schedulePart = body.querySelector(".schedule-part");
  machinePick.addEventListener("change", () => (schedulePart.hidden = !machinePick.value));
  modal(`Duplicate ${source.name}`, body, async (data, form) => {
    const payload = { name: data.name, machine_id: data.machine_id || null, ...(data.machine_id ? scheduleData(data, form) : {}) };
    const r = await api("POST", `/api/queues/${source.id}/duplicate`, payload);
    toast("QA list created");
    location.hash = r.assignment_id ? `#/machines/${data.machine_id}` : `#/queues/${r.id}`;
  }, "Duplicate");
}

async function renderQueues() {
  const [queues, machines] = await Promise.all([api("GET", "/api/queues"), api("GET", "/api/machines")]);
  page("QA lists", "A template is the master copy. Duplicate it for each machine; each copy owns its tests and limits.",
    can("configure") ? [el("a", { class: "button primary", href: "#/queues/new" }, "New QA list")] : []);
  const templates = queues.filter((q) => q.is_template);
  const lists = queues.filter((q) => !q.is_template);
  const row = (q) => el("tr", { class: "clickable", onclick: () => (location.hash = `#/queues/${q.id}`) },
    el("td", {}, el("strong", {}, q.name), q.template_name ? el("div", { class: "muted small" }, `from ${q.template_name}`) : null),
    el("td", { class: "num" }, q.item_count),
    el("td", {}, q.is_template ? el("span", { class: "muted" }, "—") : q.machines || el("span", { class: "muted" }, "not scheduled")),
    el("td", {}, q.active ? "" : chip("", "Inactive")),
    el("td", {}, can("configure") ? el("button", { onclick: (e) => { e.stopPropagation(); duplicateDialog(q, machines); } }, "Duplicate") : null));
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
  page(isNew ? "New QA list" : q.name, q.is_template ? "Template. Duplicate it to put it on a machine." : "Blank limits use each test's default, shown in grey.",
    !isNew && editable ? [el("button", { onclick: () => duplicateDialog(q, machines) }, "Duplicate")] : []);
  const info = el("form", { class: "card" }, el("div", { class: "form-grid" },
    field("Name", el("input", { name: "name", value: q.name, required: true, disabled: !editable, placeholder: "e.g. Daily QA template" })),
    field("Setup instructions (shown when performing)", el("textarea", { name: "description", disabled: !editable }, q.description), "wide"),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "is_template", checked: !!q.is_template, disabled: !editable }), "Template (master copy; not scheduled directly)"),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!q.active, disabled: !editable }), "Active")));
  app.append(info);

  const byId = Object.fromEntries(tests.map((t) => [t.id, t]));
  let items = q.items.map((i) => ({ test_id: i.test_id, expected: i.expected, warn: i.warn, fail: i.fail, tol_mode: i.tol_mode }));
  const changed = Object.fromEntries(q.items.map((i) => [i.test_id, i]));
  const body = el("tbody");
  const holder = el("div");
  const draw = () => {
    // Laid out like the myQA sheet: a heading per section, then each numbered item with its directions.
    const sectionCats = new Map();
    for (const it of items) { const t = byId[it.test_id]; const n = sectionNumber(t); if (!sectionCats.has(n)) sectionCats.set(n, []); sectionCats.get(n).push(t.category); }
    let lastSection = null;
    body.replaceChildren(...items.flatMap((item, index) => {
      const t = byId[item.test_id];
      const numeric = t.type === "numeric";
      const input = (name, props) => el("input", { type: "number", step: "any", value: item[name] ?? "", placeholder: fmt(t[name]), disabled: !editable || !numeric,
        oninput: (e) => (item[name] = e.target.value), ...(props || {}) });
      const m = changed[item.test_id] || {};
      const shortName = t.category && t.name.startsWith(t.category + " – ") ? t.name.slice(t.category.length + 3) : t.name;
      const tolUnit = (item.tol_mode || t.tol_mode) === "percent" ? "%" : t.unit;
      const n = sectionNumber(t);
      const head = n !== lastSection ? el("tr", { class: "section-row" }, el("td", { colspan: 7 }, sectionTitle(n, sectionCats.get(n), sectionNameOf(t)))) : null;
      const directions = helpText(t.description);
      const dirRow = directions ? el("tr", { class: "directions-row", ...dragProps(index) }, el("td", { colspan: 7 }, directions)) : null;
      lastSection = n;
      const number = checkNumber(t.description);
      return [head, el("tr", { class: `compact${dirRow ? " before-directions" : ""}`, ...dragProps(index), draggable: editable ? "true" : null },
        el("td", { class: "item-cell" }, editable ? el("span", { class: "drag-handle", title: "Drag to reorder" }, "⠿") : null,
          el("strong", {}, number ? `${number}: ` : "", shortName)),
        el("td", {}, t.category || el("span", { class: "muted" }, "—")),
        el("td", {}, numeric ? el("div", { class: "row nowrap" }, input("expected"), t.unit ? el("span", { class: "muted small" }, t.unit) : chip("fail", "unit missing"))
          : el("span", { class: "muted" }, TYPE_LABELS[t.type])),
        el("td", {}, numeric ? el("div", { class: "tol-cell" },
          el("label", { class: "inline small" }, "Tolerance ±", input("warn", { min: 0 }), tolUnit ? el("span", { class: "muted" }, tolUnit) : null),
          el("label", { class: "inline small" }, "Action ±", input("fail", { min: 0 }), tolUnit ? el("span", { class: "muted" }, tolUnit) : null),
          select("", [["", `Default (${t.tol_mode})`], ["absolute", "Absolute"], ["percent", "Percent"]], item.tol_mode || "",
            { disabled: !editable, onchange: (e) => { item.tol_mode = e.target.value; draw(); } })) : el("span", { class: "muted" }, "—")),
        el("td", { class: "small" }, m.modified_at ? m.modified_at.slice(0, 16).replace("T", " ") : el("span", { class: "muted" }, "—")),
        el("td", { class: "small" }, m.modified_by || el("span", { class: "muted" }, "—")),
        el("td", {}, editable ? el("div", { class: "row nowrap" },
          el("button", { class: "icon-btn", title: "Move up", disabled: index === 0, onclick: () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; unsaved.hidden = false; draw(); } }, "↑"),
          el("button", { class: "icon-btn", title: "Move down", disabled: index === items.length - 1, onclick: () => { [items[index + 1], items[index]] = [items[index], items[index + 1]]; unsaved.hidden = false; draw(); } }, "↓"),
          el("button", { class: "icon-btn", title: "Edit test", onclick: () => modal(`Edit ${t.name}`, testForm(t), async (data) => {
            await api("PUT", `/api/tests/${t.id}`, { ...data, owner_queue_id: t.owner_queue_id });
            toast("Test saved");
            route();
          }) }, "✎"),
          el("button", { class: "icon-btn danger", title: "Remove", onclick: () => { items.splice(index, 1); draw(); } }, "✕")) : null)), dirRow];
    }).filter(Boolean));
    holder.replaceChildren(items.length ? el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ["Test Name", "Category", "Expected", "Tolerance / Action", "Modified Date", "Modified By", ""].map((h) => el("th", {}, h)))), body))
      : el("div", { class: "card empty" }, "No tests in this list yet."));
    // Only this list's own tests (or shared library tests) can be added here.
    picker.replaceChildren(el("option", { value: "" }, "Add an existing test…"),
      ...tests.filter((t) => t.active && (!t.owner_queue_id || String(t.owner_queue_id) === id) && !items.some((i) => i.test_id === t.id))
        .map((t) => el("option", { value: t.id }, testLabel(t))));
  };
  const picker = el("select", { onchange: (e) => { if (e.target.value) { items.push({ test_id: Number(e.target.value) }); draw(); } } });
  // Drag and drop: drag a test row (by its handle) onto another test to move it there; Save keeps the new order.
  let dragFrom = null;
  const unsaved = el("span", { class: "chip due", hidden: true }, "Order changed: Save to keep it");
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
        unsaved.hidden = false;
        draw();
      },
    };
  }
  app.append(el("h2", {}, "Tests"), holder);
  if (editable) {
    const newCheck = el("button", { disabled: isNew, title: isNew ? "Save the list first" : "", onclick: () => modal("New test for this list", testForm(), async (data) => {
      const r = await api("POST", "/api/tests", { ...data, owner_queue_id: Number(id) });
      items.push({ test_id: r.id });
      await save();
    }) }, "New test");
    const error = el("p", { class: "error" });
    const save = async () => {
      error.textContent = "";
      const payload = { ...formData(info), items };
      const result = isNew ? await api("POST", "/api/queues", payload) : await api("PUT", `/api/queues/${id}`, payload);
      toast("QA list saved");
      location.hash = `#/queues/${result.id}`;
      if (!isNew) route();
    };
    app.append(el("div", { class: "row" }, newCheck, el("div", {}, picker)));
    app.append(error, el("div", { class: "row" }, el("a", { class: "button", href: "#/queues" }, "Back"),
      el("button", { class: "primary", onclick: () => save().catch((err) => (error.textContent = err.message)) }, "Save"), unsaved));
  }
  draw();
}

function testForm(test) {
  const t = test || { type: "numeric", tol_mode: "absolute", active: 1 };
  const type = select("type", Object.entries(TYPE_LABELS), t.type);
  const limits = el("div", { class: "form-grid wide" },
    field("Unit", el("input", { name: "unit", value: t.unit || "", placeholder: "mm, %, cGy, °" })),
    field("Expected value", el("input", { name: "expected", type: "number", step: "any", value: t.expected ?? "" })),
    field("Tolerance ±", el("input", { name: "warn", type: "number", step: "any", min: 0, value: t.warn ?? "" })),
    field("Action ±", el("input", { name: "fail", type: "number", step: "any", min: 0, value: t.fail ?? "" })),
    field("Tolerance is", select("tol_mode", [["absolute", "Absolute (same units)"], ["percent", "Percent of expected"]], t.tol_mode)));
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
        table(["Test", "QA list", "Type", "#Expected", "#Tolerance ±", "#Action ±", ""], list.map((t) =>
          el("tr", { class: editable ? "clickable" : "", onclick: edit(t) }, el("td", {}, el("strong", {}, shortName(t))),
            el("td", { class: "muted" }, t.owner_name || "Shared"), ...limitCells(t)))))));
      return;
    }
    // Flat: one table sorted by the chosen column, with the QA list shown on every row.
    const keys = { name: (t) => shortName(t), category: (t) => t.category || "General", type: (t) => TYPE_LABELS[t.type] };
    const key = keys[sortPick.value];
    const sorted = shown.slice().sort((a, b) => key(a).localeCompare(key(b)) || (a.owner_name || "").localeCompare(b.owner_name || "") || shortName(a).localeCompare(shortName(b)));
    holder.replaceChildren(table(["Test", "QA list", "Category", "Type", "#Expected", "#Tolerance ±", "#Action ±", ""], sorted.map((t) =>
      el("tr", { class: editable ? "clickable" : "", onclick: edit(t) },
        el("td", {}, el("strong", {}, shortName(t))),
        el("td", { class: "muted" }, t.owner_name || "Shared"),
        el("td", { class: "muted" }, t.category || "General"),
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
    el("td", { class: "small muted" }, r.type === "numeric" ? limitsText(r, r.unit) : ""),
    el("td", {}, chip(r.status))));
  const headers = ["Test", "#Result", "Expected / limits", "Status"];
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
const AXIS_NAME = /^(.*\S)\s+([XYZ])$/;
// Rotations of one thing (couch pitch, roll, rotation) also share a chart.
const ROTATION_NAME = /^(.*\S)\s+(Pitch|Roll|Rotation)$/;
const AXIS_ORDER = { X: 0, Y: 1, Z: 2, Pitch: 0, Roll: 1, Rotation: 2 };

function axisGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const r = ROTATION_NAME.exec(item.name);
    const m = AXIS_NAME.exec(item.name) || r;
    const prefix = m ? m[1].replace(/\s*–$/, "") : "";
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
  return { n, mean, sd, min: Math.min(...values), max: Math.max(...values) };
}

// One chart for one or more series. Single series: actual values, with the expected line and limit bands.
// Several series (X/Y/Z, pitch/roll/rotation): deviation from each one's expected value, on one scale.
// The y axis is scaled to the data (limit bands are clipped to the plot), carries the unit, and the x axis is dated.
// Each chart carries its own statistics: n, mean ± SD and range per series.
function seriesChart(series, unit, { small = false } = {}) {
  const multi = series.length > 1;
  const W = small ? 560 : 900, H = small ? 120 : 360;
  const L = small ? 56 : 70, R = small ? 40 : 40, T = small ? 8 : 20, B = small ? 34 : 52;
  const lineH = small ? 13 : 16;
  const statH = lineH * series.length + 6;   // statistics block under the plot (two lines per series on small charts)
  const plotBottom = H - B;
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.qa_date)))].sort();
  const xi = Object.fromEntries(dates.map((d, i) => [d, i]));
  const x = (d) => L + (dates.length === 1 ? (W - L - R) / 2 : (xi[d] * (W - L - R)) / (dates.length - 1));
  const val = (p) => (multi ? asDeviation(p).dev : p.value);
  const ref = series[0].points.map((p) => {
    if (multi) { const d = asDeviation(p); return { d: p.qa_date, w: d.warnAbs, f: d.failAbs, c: 0 }; }
    return { d: p.qa_date, w: p.warn === null ? null : bandValue(p, "warn", 1) - p.expected, f: p.fail === null ? null : bandValue(p, "fail", 1) - p.expected, c: p.expected };
  }).filter((b) => b.c !== null && b.c !== undefined);

  // Auto-scale to the data only, with a little headroom.
  const values = series.flatMap((s) => s.points.map(val));
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
  const band = (key) => {
    const up = [], dn = [];
    for (const b of ref) if (b[key] !== null && b[key] !== undefined) { up.push(`${x(b.d)},${y(b.c + b[key])}`); dn.unshift(`${x(b.d)},${y(b.c - b[key])}`); }
    return up.length ? up.concat(dn).join(" ") : null;
  };
  const plot = [];
  const fail = band("f"), warn = band("w");
  if (fail) plot.push(svg("polygon", { class: "band-fail", points: fail }));
  if (warn) plot.push(svg("polygon", { class: "band-warn", points: warn }));
  if (ref.length) plot.push(svg("polyline", { class: "expected", points: ref.map((b) => `${x(b.d)},${y(b.c)}`).join(" ") }));

  // Y axis: gridlines, labels, and the unit as the axis title.
  const { ticks, decimals } = niceTicks(lo, hi, small ? 3 : 5);
  for (const v of ticks) {
    kids.push(svg("line", { class: "axis", x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      svg("text", { x: L - 5, y: y(v) + 4, "text-anchor": "end" }, (multi && v > 0 ? "+" : "") + fmt(v, decimals)));
  }
  const yTitle = multi ? `Δ from expected (${unit || "unitless"})` : `${unit || "unitless"}`;
  kids.push(svg("text", { class: "axis-title", x: 12, y: (T + plotBottom) / 2, "text-anchor": "middle", transform: `rotate(-90 12 ${(T + plotBottom) / 2})` }, yTitle));

  // X axis: dates, and the axis title.
  kids.push(svg("line", { class: "axis-base", x1: L, x2: W - R, y1: plotBottom, y2: plotBottom }));
  const labels = small ? 4 : 7;
  const every = Math.max(1, Math.ceil(dates.length / labels));
  const multiYear = dates[0].slice(0, 4) !== dates[dates.length - 1].slice(0, 4);
  const fmtDate = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  dates.forEach((d, i) => {
    if (i % every === 0 || i === dates.length - 1) {
      if (i === dates.length - 1 && i % every !== 0 && dates.length > 1 && x(d) - x(dates[i - (i % every)]) < 95) return;
      const anchor = i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle";
      kids.push(svg("text", { x: x(d), y: plotBottom + 14, "text-anchor": anchor }, fmtDate(d)));
    }
  });
  kids.push(svg("text", { class: "axis-title", x: (L + W - R) / 2, y: H - 4, "text-anchor": "middle" }, "Date QA performed"));

  series.forEach((s, k) => {
    const cls = multi ? `axis-${k}` : "";
    const r = small ? (dates.length > 120 ? 1.8 : 2.4) : (dates.length > 150 ? 2.6 : 3.6);
    for (const p of s.points) {
      plot.push(svg("circle", { class: `dot ${multi ? cls : "single"} st-${p.status}`, cx: x(p.qa_date), cy: y(val(p)), r },
        svg("title", {}, `${p.qa_date} ${s.label}: ${fmt(p.value)} ${unit || ""} (${STATUS_LABEL[p.status] || p.status})`)));
    }
  });
  kids.push(svg("g", { "clip-path": `url(#${clipId})` }, plot));

  // Statistics block under the plot, one line per series.
  const u = unit && unit !== "unitless" ? ` ${unit}` : "";
  const statLines = series.flatMap((s, k) => {
    const st = seriesStats(s.points.map(val));
    const name = multi ? `${s.label} (Δ): ` : "";
    const cls = `stats-line ${multi ? `axis-${k}` : ""}`;
    const a = `${name}n ${st.n} · mean ${fmt(st.mean, 2)}${u} · SD ${fmt(st.sd, 2)}${u}`;
    const b = `range ${fmt(st.min, 2)} to ${fmt(st.max, 2)}${u}`;
    return [svg("text", { class: cls, x: L, y: H + (k + 1) * lineH }, `${a} · ${b}`)];
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

async function renderTrendOverview(machines, machineId, range) {
  const machine = machines.find((m) => String(m.id) === String(machineId));
  const loading = el("div", { class: "card empty" }, `Loading ${machine.name} trends…`);
  app.append(loading);
  const assignments = await api("GET", `/api/machines/${machineId}/assignments`);
  const templates = await Promise.all(assignments.filter((a) => a.active).map((a) => api("GET", `/api/assignments/${a.id}/template`)));
  const numeric = templates.flatMap((t) => t.items.filter((i) => i.type === "numeric"));
  const all = numeric.length ? await api("GET", `/api/machines/${machineId}/trends`) : {};
  loading.remove();
  const withData = numeric.map((i) => ({ ...i, points: filterRange(all[i.test_id] || [], range) })).filter((i) => i.points.length);
  if (!withData.length) {
    app.append(el("div", { class: "card empty" }, numeric.length ? "No results in this period." : `${machine.name} has no measured tests scheduled.`));
    return;
  }
  const groups = axisGroups(withData);
  const worstOf = (g) => g.members.reduce((w, m) => (STATUS_RANK[latest(m.points).status] > STATUS_RANK[w] ? latest(m.points).status : w), "pass");
  const failing = groups.filter((g) => worstOf(g) === "fail").length, warning = groups.filter((g) => worstOf(g) === "warn").length;
  app.append(el("p", { class: "lead" }, `${withData.length} tests on ${groups.length} charts. `,
    failing ? el("span", { class: "chip fail" }, `${failing} at action level`) : "", " ", warning ? el("span", { class: "chip warn" }, `${warning} outside tolerance`) : "",
    !failing && !warning ? el("span", { class: "chip pass" }, "All passing") : ""));
  const bySection = new Map();
  for (const g of groups) {
    const key = `${sectionOf(g.members[0])}|${g.category}`;
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(g);
  }
  let lastSection = null;
  for (const [key, list] of [...bySection].sort(([a], [b]) => a.split("|")[0].localeCompare(b.split("|")[0]))) {
    const [section, category] = key.split("|");
    if (section !== lastSection) app.append(el("h2", { class: "section-head" }, section));
    lastSection = section;
    app.append(el("h3", { class: "muted" }, category));
    list.sort((a, b) => STATUS_RANK[worstOf(b)] - STATUS_RANK[worstOf(a)]);
    // One table per category, one row per chart (no card panels): name, latest values, status, then the chart.
    app.append(table(["Test", "Latest", "Status", "Trend"], list.map((g) => {
      const status = worstOf(g);
      const unit = g.members[0].unit;
      const short = g.base.startsWith(category + " – ") ? g.base.slice(category.length + 3) : g.base;
      const ids = g.members.map((m) => m.test_id).join(",");
      const href = `#/trends?machine_id=${machineId}&test_id=${ids}&range=${range}`;
      const latestCell = g.members.map((m, k) => {
        const p = latest(m.points), d = asDeviation(p);
        return el("div", { class: g.members.length > 1 ? `axis-val axis-${k}` : "" },
          `${g.members.length > 1 ? m.axis + " " : ""}${fmt(p.value)} ${unit}`.trim(),
          p.expected !== null ? el("span", { class: "muted small" }, ` (${signed(d.dev)} ${unit})`.replace(" )", ")")) : null);
      });
      return el("tr", { class: "clickable trend-row", onclick: () => (location.hash = href) },
        el("td", {}, el("a", { href }, el("strong", {}, short)), axisLegend(g), el("div", { class: "muted small" }, `${latest(g.members[0].points).qa_date}`)),
        el("td", { class: "small" }, latestCell),
        el("td", {}, chip(status)),
        el("td", { class: "trend-cell" }, seriesChart(g.members.map((m) => ({ label: m.axis || m.name, points: m.points })), unit, { small: true })));
    })));
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
    return p.warn !== null ? stat("Limits", `Tolerance ±${fmt(p.warn)}${u}`, `Action ±${fmt(p.fail)}${u}`) : null;
  })()));
  app.append(el("div", { class: "legend" },
    multi ? el("span", {}, "Lines: ", axisLegend(group), ` deviation from each axis's expected value${unit ? ` (${unit})` : ""}`) : el("span", {}, "Dashed line: expected value"),
    el("span", {}, el("span", { class: "swatch warn" }), "Within tolerance"),
    el("span", {}, el("span", { class: "swatch fail" }), "Within action level"),
    el("span", {}, "Dots: ", el("span", { class: "chip pass" }, "pass"), " ", el("span", { class: "chip warn" }, "warn"), " ", el("span", { class: "chip fail" }, "fail"))));
  app.append(seriesChart(group.members.map((m) => ({ label: m.axis || m.name, points: m.points })), unit));
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

async function renderTrends() {
  const params = queryParams();
  const machines = (await api("GET", "/api/machines")).filter((m) => m.active);
  const fallback = machines.find((m) => m.kind === "Proton gantry") || machines[0];
  const machineId = machines.some((m) => String(m.id) === params.get("machine_id")) ? params.get("machine_id") : (fallback && fallback.id);
  const range = params.get("range") || "90";
  const testIds = (params.get("test_id") || "").split(",").filter(Boolean);
  page("Machine Trends", testIds.length ? "Over time, against the limits in force when each value was recorded." : "Every measured test on this machine. X, Y and Z share a chart. Click one for detail.");
  const go = (next) => { location.hash = `#/trends?${new URLSearchParams(Object.entries(next).filter(([, v]) => v))}`; };
  const form = el("div", { class: "row" },
    select("machine_id", machines.map((m) => [m.id, m.name]), machineId, { onchange: (e) => go({ machine_id: e.target.value, range }) }),
    select("range", [["30", "Last 30 days"], ["90", "Last 3 months"], ["365", "Last year"], ["all", "All history"]], range, { onchange: (e) => go({ machine_id: machineId, test_id: testIds.join(","), range: e.target.value }) }),
    testIds.length ? el("a", { class: "button", href: `#/trends?machine_id=${machineId}&range=${range}` }, "← All tests") : null);
  app.append(form, el("br"));
  if (!machines.length) return app.append(el("div", { class: "card empty" }, "No machines yet."));
  if (!testIds.length) return renderTrendOverview(machines, machineId, range);
  const data = await Promise.all(testIds.map((id) => api("GET", `/api/trend?machine_id=${machineId}&test_id=${id}`)));
  const items = data.map((d) => ({ ...d.test, test_id: d.test.id, points: filterRange(d.points, range) })).filter((i) => i.points.length);
  const head = data[0].test;
  const group = axisGroups(items)[0];
  app.append(el("h2", {}, group ? group.base : head.name, group ? axisLegend(group) : null),
    el("p", { class: "muted small" }, [sectionOf(head), head.category].join(" · ")));
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
