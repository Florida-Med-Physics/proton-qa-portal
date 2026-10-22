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

function chip(status, label) {
  return el("span", { class: `chip ${status || ""}` }, label || capitalize(status || "-"));
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
  if (limits.warn !== null && limits.warn !== undefined) parts.push(`warn ±${fmt(limits.warn)}${suffix}`);
  if (limits.fail !== null && limits.fail !== undefined) parts.push(`fail ±${fmt(limits.fail)}${suffix}`);
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
  ["#/", "Perform QA", null, ["#/", "#", "#/perform", "#/runs"]],
  ["#/setup", "Setup QA", "configure", ["#/setup", "#/machines", "#/queues", "#/tests", "#/users", "#/audit", "#/assignments"]],
  ["#/trends", "Machine Trends", null, ["#/trends"]],
];

function renderShell() {
  const bar = document.getElementById("topbar");
  bar.hidden = !state.user;
  if (!state.user) return;
  const current = location.hash.split("?")[0].split("/").slice(0, 2).join("/") || "#/";
  document.getElementById("nav").replaceChildren(...NAV.filter(([, , p]) => !p || can(p)).map(([href, label, , owns]) =>
    el("a", { href, class: owns.includes(current) ? "active" : "" }, label)));
  document.getElementById("who").replaceChildren(
    el("a", { href: "#/account", title: ROLE_LABEL[state.user.role] }, personName(state.user.full_name, state.user.username)),
    el("button", { class: "link", onclick: logout }, "Sign out"));
}

function shortDate(iso) {
  return new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// "Daily QA – GTR1" reads as "Daily QA" on GTR1's own card.
function queueLabel(queueName, machineName) {
  return queueName.endsWith(` – ${machineName}`) ? queueName.slice(0, -(machineName.length + 3)) : queueName;
}

function renderLogin() {
  renderShell();
  const error = el("p", { class: "error" });
  const form = el("form", {},
    el("h1", {}, "Physics QA Portal"),
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
  [/^#?\/?$/, renderDashboard],
  [/^#\/setup$/, renderSetup],
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

async function renderDashboard() {
  const data = await api("GET", "/api/dashboard");
  const queues = data.machines.flatMap((m) => m.queues);
  const todo = queues.filter((q) => q.state === "due" || q.state === "overdue").length;
  const toReview = data.machines.reduce((n, m) => n + m.pending_review, 0);
  page("Perform QA", new Date(data.today + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
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
        el("td", {}, shortDate(r.qa_date)), el("td", {}, r.machine_name), el("td", {}, queueLabel(r.queue_name, r.machine_name)),
        el("td", {}, chip(r.overall)), el("td", { class: "muted" }, personName(r.performer_name, r.performer)),
        el("td", { class: "right" }, el("a", { class: "button small", href: `#/runs/${r.id}` }, "Review"))))));
  }
  // One compact table per machine type; each row is a QA list on a machine, with its status and last result.
  const KIND_ORDER = ["Proton gantry", "Linac", "CT simulator", "MRI simulator"];
  const groups = new Map();
  for (const machine of data.machines) {
    const kind = machine.kind || "Other";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(machine);
  }
  const rank = (k) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? KIND_ORDER.length : i; };
  for (const [kind, machines] of [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))) {
    const rows = machines.flatMap((machine) => {
      if (!machine.queues.length) return [el("tr", {}, el("td", {}, el("strong", {}, machine.name)), el("td", { class: "muted", colspan: 4 }, "Nothing scheduled."))];
      return machine.queues.map((q, i) => {
        const due = startable(q.state);
        const last = q.last_run;
        return el("tr", { class: q.state === "overdue" ? "row-overdue" : "" },
          el("td", {}, i === 0 ? el("strong", {}, machine.name) : ""),
          el("td", {}, queueLabel(q.queue_name, machine.name), el("div", { class: "muted small" }, q.schedule)),
          el("td", {}, chip(q.state, scheduleStatus({ ...q, active: 1 }))),
          el("td", {}, last ? [chip(last.overall), " ", el("a", { class: "small", href: `#/runs/${last.id}` }, shortDate(last.qa_date))] : el("span", { class: "muted small" }, "No runs yet")),
          el("td", { class: "right" }, due && can("perform") ? el("a", { class: q.state === "ready" ? "button small" : "button primary small", href: `#/perform/${q.id}` }, "Start")
            : last ? el("a", { class: "button small", href: `#/runs/${last.id}` }, "View") : null));
      });
    });
    app.append(el("h2", { class: "section-head" }, kind), table(["Machine", "QA list", "Status", "Last result", ""], rows));
  }
}

// Setup QA reads like Perform QA: one table per machine type, one row per QA list, actions on the right.
async function renderSetup() {
  page("Setup QA", "What each machine is checked against, and how often.");
  const [data, queues] = await Promise.all([api("GET", "/api/dashboard"), api("GET", "/api/queues")]);
  const byId = Object.fromEntries(queues.map((q) => [q.id, q]));
  const templates = queues.filter((q) => q.is_template);
  const scheduled = data.machines.reduce((n, m) => n + m.queues.length, 0);
  const editable = can("configure");
  app.append(el("p", { class: "lead" },
    `${data.machines.length} machines · ${scheduled} scheduled QA ${scheduled === 1 ? "list" : "lists"} · ${templates.length} ${templates.length === 1 ? "template" : "templates"}.`,
    editable ? [" ", el("a", { class: "small", href: "#/machines" }, "Add a machine")] : ""));

  const KIND_ORDER = ["Proton gantry", "Linac", "CT simulator", "MRI simulator"];
  const groups = new Map();
  for (const machine of data.machines) {
    const kind = machine.kind || "Other";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(machine);
  }
  const rank = (k) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? KIND_ORDER.length : i; };
  for (const [kind, machines] of [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))) {
    const rows = machines.flatMap((machine) => {
      if (!machine.queues.length) {
        return [el("tr", {}, el("td", {}, el("strong", {}, machine.name)), el("td", { class: "muted", colspan: 3 }, "Nothing scheduled."),
          el("td", { class: "right" }, editable ? el("a", { class: "button small", href: `#/machines/${machine.id}` }, "Add a QA list") : null))];
      }
      return machine.queues.map((a, i) => {
        const q = byId[a.queue_id] || {};
        return el("tr", {},
          el("td", {}, i === 0 ? el("a", { href: `#/machines/${machine.id}` }, el("strong", {}, machine.name)) : ""),
          el("td", {}, queueLabel(a.queue_name, machine.name), q.template_name ? el("div", { class: "muted small" }, `from ${q.template_name}`) : null),
          el("td", {}, a.schedule),
          el("td", { class: "num" }, q.item_count ?? ""),
          el("td", { class: "right" }, el("div", { class: "row nowrap end" },
            el("a", { class: "button small", href: `#/queues/${a.queue_id}` }, "Tests"),
            editable ? el("a", { class: "button small", href: `#/assignments/${a.id}/limits` }, "Limits") : null,
            editable ? el("button", { class: "small", onclick: () => modal(`${a.queue_name}: schedule`, scheduleForm(a), async (d, form) => {
              await api("PUT", `/api/assignments/${a.id}`, scheduleData(d, form));
              toast("Schedule saved");
              route();
            }) }, "Schedule") : null)));
      });
    });
    app.append(el("h2", { class: "section-head" }, kind), table(["Machine", "QA list", "Schedule", "#Tests", ""], rows));
  }

  app.append(el("h2", { class: "section-head" }, "Templates"));
  app.append(templates.length ? table(["Template", "#Tests", "Copies on", ""], templates.map((t) => el("tr", {},
    el("td", {}, el("strong", {}, t.name)),
    el("td", { class: "num" }, t.item_count),
    el("td", { class: "muted" }, queues.filter((q) => q.template_id === t.id).map((q) => q.machines).filter(Boolean).join(", ") || "none yet"),
    el("td", { class: "right" }, el("div", { class: "row nowrap end" },
      el("a", { class: "button small", href: `#/queues/${t.id}` }, "Tests"),
      editable ? el("button", { class: "small", onclick: () => duplicateDialog(t, data.machines) }, "Copy to a machine") : null)))))
    : el("div", { class: "card empty" }, "No templates yet."));

  app.append(el("h2", { class: "section-head" }, "More"), el("p", { class: "row" },
    el("a", { class: "button small", href: "#/tests" }, "All tests"),
    el("a", { class: "button small", href: "#/queues" }, "All QA lists"),
    can("manage_users") ? el("a", { class: "button small", href: "#/users" }, "People") : null,
    el("a", { class: "button small", href: "#/audit" }, "Audit log")));

  if (window.localApi && editable) {
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
    app.append(el("h2", { class: "section-head" }, "Data"), databaseLocationCard(),
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

async function renderMachines() {
  const machines = await api("GET", "/api/machines");
  page("Machines", "Each machine gets its own scheduled QA queues.", can("configure") ? [el("button", {
    class: "primary",
    onclick: () => modal("Add machine", machineForm(), async (data) => {
      const result = await api("POST", "/api/machines", data);
      location.hash = `#/machines/${result.id}`;
    }),
  }, "Add machine")] : []);
  app.append(table(["Name", "Type", "Location", "Status"], machines.map((m) =>
    el("tr", { class: "clickable", onclick: () => (location.hash = `#/machines/${m.id}`) },
      el("td", {}, el("strong", {}, m.name)), el("td", {}, m.kind), el("td", {}, m.location),
      el("td", {}, m.active ? chip("pass", "Active") : chip("", "Retired")))), "No machines yet."));
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
      el("div", {}, el("strong", {}, queueLabel(a.queue_name, machine.name)), el("div", { class: "muted small" }, a.schedule)),
      chip(a.active ? a.state : "", status),
      el("div", { class: "row" },
        due && can("perform") ? el("a", { class: a.state === "ready" ? "button" : "button primary", href: `#/perform/${a.id}` }, "Start") : null,
        el("a", { class: "button", href: `#/runs?machine_id=${id}&queue_id=${a.queue_id}` }, "History"),
        more));
  })));
}

async function renderLimits(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  page(`Limits for ${t.machine.name}: ${queueLabel(t.queue.name, t.machine.name)}`,
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
  app.append(table(["Test", "Expected", "Warning ±", "Fail ±", "Tolerance"], rows));
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

function passFailInput(name, withWarning) {
  // A hidden value plus big buttons: one tap instead of opening a dropdown.
  // Pass / Fail for boolean tests; Pass / Warning / Fail for status tests (as on a RadMachine checklist).
  const value = el("input", { type: "hidden" });
  const buttons = [];
  const pick = (v) => () => {
    value.value = value.value === v ? "" : v;
    for (const b of buttons) b.classList.toggle("on", value.value === b.dataset.value);
    value.dispatchEvent(new Event("input"));
  };
  const choices = withWarning ? [["pass", "Pass"], ["warn", "Warning"], ["fail", "Fail"]] : [["pass", "Pass"], ["fail", "Fail"]];
  for (const [v, label] of choices) {
    buttons.push(el("button", { type: "button", class: `seg ${v}`, "data-value": v, "aria-label": `${name}: ${label.toLowerCase()}`, onclick: pick(v) }, label));
  }
  return { value, control: el("div", { class: "segmented" }, ...buttons, value) };
}

// Directions are shown with the test, numbered as in the template (1.01, 2.04, ...).
const TEMPLATE_NUMBER = /^Template (\d+)\.(\d+)\.\s*/;
function helpText(description) {
  if (!description || description.startsWith("Measured by Sphinx")) return null;
  const m = TEMPLATE_NUMBER.exec(description);
  const text = description.replace(TEMPLATE_NUMBER, "");
  return text ? el("div", { class: "directions pre" }, m ? el("span", { class: "muted" }, `${m[1]}.${m[2]} · `) : null, text) : null;
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
function sectionTitle(number, categories) {
  const names = [...new Set(categories.map((c) => c || "General"))];
  const generic = { 1: "Safety", 2: "Mechanical and imaging", 3: "Dosimetry", 4: "Other" };
  const label = names.length <= 2 ? names.join(" and ") : (generic[number] || "Other");
  return `${number}.0 ${label}`;
}

// Section label for a test on its own (Trends), e.g. "3.0 Dosimetry".
function sectionOf(item) {
  const n = sectionNumber(item);
  return sectionTitle(n, n === 3 || n === 4 ? [] : [item.category]).replace(/^(\d)\.0 $/, (_, d) => `${d}.0 ${{ 3: "Dosimetry", 4: "Other" }[d]}`);
}

function checkNumber(description) {
  const m = /^Template (\d+\.\d+)\./.exec(description || "");
  return m ? m[1] : "";
}

async function renderPerform(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  page(`${queueLabel(t.queue.name, t.machine.name)} · ${t.machine.name}`, t.assignment.schedule);
  if (t.queue.description) {
    app.append(el("details", { class: "card instructions", open: true }, el("summary", {}, el("strong", {}, "0.0 Setup")), el("div", { class: "pre" }, t.queue.description)));
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
    overallChip.replaceChildren(done && done === required.length ? chip(worst, capitalize(worst)) : statuses.some((s) => s === "fail" || s === "warn") ? chip(worst, `${capitalize(worst)} so far`) : "");
    for (const s of sections) s.refresh();
  };
  const byCategory = new Map();
  for (const item of t.items) {
    const key = `${sectionNumber(item)}|${item.category || "General"}`;
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
    const section = sectionTitle(Number(n), sectionCategories.get(n));
    const heading = section !== lastSection ? el("h2", { class: "section-head" }, section) : null;
    lastSection = section;
    const rows = [];
    const entries = [];
    for (const item of items) {
      let input, control;
      if (item.type === "boolean" || item.type === "status") ({ value: input, control } = passFailInput(item.name, item.type === "status"));
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
      rows.push(el("div", { class: "check-row" },
        el("div", { class: "check-name" }, el("strong", {}, checkNumber(item.description) ? `${checkNumber(item.description)} ` : "", item.name.startsWith(category + " – ") ? item.name.slice(category.length + 3) : item.name),
          item.type === "numeric" ? el("div", { class: "muted small" }, limitsText(item.limits, item.unit)) : null, note, helpText(item.description)),
        el("div", { class: "check-input" }, control, item.type === "numeric" && item.unit ? el("span", { class: "muted small" }, item.unit) : null),
        statusCell,
        el("div", { class: "check-note" }, noteToggle, comment)));
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
          bad ? [" · ", chip("fail", `${bad} fail`)] : "", warn ? [" · ", chip("warn", `${warn} warn`)] : "");
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
  if (t.assignment.import_folder) app.append(importFolderCard(assignmentId, useUpload));
  app.append(el("div", { class: "card step" }, el("strong", {}, "Measurement file"),
    el("span", { class: "muted small" }, " Optional. A Sphinx export fills in every measured value. (DQA3 and MPC exports for the TrueBeam: importer not built yet.)"),
    el("div", {}, sphinxFile), sphinxInfo));
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
    el("div", { class: "spacer" }), el("a", { class: "button", href: "#/" }, "Cancel"), submit));
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
  app.append(el("h2", {}, "Templates"));
  app.append(templates.length ? table(["Template", "#Tests", "Machines", "", ""], templates.map(row))
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
  const body = el("tbody");
  const holder = el("div");
  const draw = () => {
    body.replaceChildren(...items.map((item, index) => {
      const t = byId[item.test_id];
      const numeric = t.type === "numeric";
      const input = (name, props) => el("input", { type: "number", step: "any", value: item[name] ?? "", placeholder: fmt(t[name]), disabled: !editable || !numeric,
        oninput: (e) => (item[name] = e.target.value), ...(props || {}) });
      return el("tr", { class: "compact" },
        el("td", {}, el("strong", {}, t.name), el("div", { class: "muted small" }, [t.category, t.type === "numeric" ? t.unit : TYPE_LABELS[t.type].toLowerCase()].filter(Boolean).join(" · "))),
        el("td", {}, input("expected")),
        el("td", {}, input("warn", { min: 0 })),
        el("td", {}, input("fail", { min: 0 })),
        el("td", {}, select("", [["", `Default (${t.tol_mode})`], ["absolute", "Absolute"], ["percent", "Percent"]], item.tol_mode || "",
          { disabled: !editable || !numeric, onchange: (e) => (item.tol_mode = e.target.value) })),
        el("td", {}, editable ? el("div", { class: "row nowrap" },
          el("button", { class: "icon-btn", title: "Move up", disabled: index === 0, onclick: () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } }, "↑"),
          el("button", { class: "icon-btn", title: "Move down", disabled: index === items.length - 1, onclick: () => { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } }, "↓"),
          el("button", { class: "icon-btn", title: "Edit test", onclick: () => modal(`Edit ${t.name}`, testForm(t), async (data) => {
            await api("PUT", `/api/tests/${t.id}`, { ...data, owner_queue_id: t.owner_queue_id });
            toast("Test saved");
            route();
          }) }, "✎"),
          el("button", { class: "icon-btn danger", title: "Remove", onclick: () => { items.splice(index, 1); draw(); } }, "✕")) : null));
    }));
    holder.replaceChildren(items.length ? el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ["Test", "Expected", "Warning ±", "Fail ±", "Tolerance", ""].map((h) => el("th", {}, h)))), body))
      : el("div", { class: "card empty" }, "No tests in this list yet."));
    // Only this list's own tests (or shared library tests) can be added here.
    picker.replaceChildren(el("option", { value: "" }, "Add an existing test…"),
      ...tests.filter((t) => t.active && (!t.owner_queue_id || String(t.owner_queue_id) === id) && !items.some((i) => i.test_id === t.id))
        .map((t) => el("option", { value: t.id }, testLabel(t))));
  };
  const picker = el("select", { onchange: (e) => { if (e.target.value) { items.push({ test_id: Number(e.target.value) }); draw(); } } });
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
      el("button", { class: "primary", onclick: () => save().catch((err) => (error.textContent = err.message)) }, "Save")));
  }
  draw();
}

function testForm(test) {
  const t = test || { type: "numeric", tol_mode: "absolute", active: 1 };
  const type = select("type", Object.entries(TYPE_LABELS), t.type);
  const limits = el("div", { class: "form-grid wide" },
    field("Unit", el("input", { name: "unit", value: t.unit || "", placeholder: "mm, %, cGy, °" })),
    field("Expected value", el("input", { name: "expected", type: "number", step: "any", value: t.expected ?? "" })),
    field("Warning ±", el("input", { name: "warn", type: "number", step: "any", min: 0, value: t.warn ?? "" })),
    field("Fail ±", el("input", { name: "fail", type: "number", step: "any", min: 0, value: t.fail ?? "" })),
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
        table(["Test", "QA list", "Type", "#Expected", "#Warn ±", "#Fail ±", ""], list.map((t) =>
          el("tr", { class: editable ? "clickable" : "", onclick: edit(t) }, el("td", {}, el("strong", {}, shortName(t))),
            el("td", { class: "muted" }, t.owner_name || "Shared"), ...limitCells(t)))))));
      return;
    }
    // Flat: one table sorted by the chosen column, with the QA list shown on every row.
    const keys = { name: (t) => shortName(t), category: (t) => t.category || "General", type: (t) => TYPE_LABELS[t.type] };
    const key = keys[sortPick.value];
    const sorted = shown.slice().sort((a, b) => key(a).localeCompare(key(b)) || (a.owner_name || "").localeCompare(b.owner_name || "") || shortName(a).localeCompare(shortName(b)));
    holder.replaceChildren(table(["Test", "QA list", "Category", "Type", "#Expected", "#Warn ±", "#Fail ±", ""], sorted.map((t) =>
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
      el("td", {}, r.machine_name), el("td", {}, queueLabel(r.queue_name, r.machine_name)),
      el("td", {}, chip(r.overall)),
      el("td", {}, r.review_status === "imported" ? el("span", { class: "muted small" }, "Historical") : reviewChip(r.review_status)))), "No runs match."));
}

async function renderRun(id) {
  const run = await api("GET", `/api/runs/${id}`);
  page(`${queueLabel(run.queue_name, run.machine_name)} · ${run.machine_name}`, `${shortDate(run.qa_date)} ${run.qa_date.slice(0, 4)}`);
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

function trendChart(points, unit) {
  const W = 900, H = 320, L = 60, R = 16, T = 16, B = 40;
  const values = [];
  for (const p of points) {
    values.push(p.value);
    for (const key of ["warn", "fail"]) for (const s of [1, -1]) { const v = bandValue(p, key, s); if (v !== null) values.push(v); }
    if (p.expected !== null) values.push(p.expected);
  }
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const band = (key) => {
    const upper = [], lower = [];
    points.forEach((p, i) => {
      const u = bandValue(p, key, 1), l = bandValue(p, key, -1);
      if (u !== null) { upper.push(`${x(i)},${y(u)}`); lower.unshift(`${x(i)},${y(l)}`); }
    });
    return upper.length ? upper.concat(lower).join(" ") : null;
  };
  const outer = band("fail"), inner = band("warn");
  const raw = (hi - lo) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (step / magnitude === 2.5 ? 1 : 0));
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const multiYear = points[0].qa_date.slice(0, 4) !== points[points.length - 1].qa_date.slice(0, 4);
  return svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Trend chart" },
    outer ? svg("polygon", { class: "band-fail", points: outer }) : null,
    inner ? svg("polygon", { class: "band-warn", points: inner }) : null,
    ticks.map((v) => [svg("line", { class: "axis", x1: L, x2: W - R, y1: y(v), y2: y(v) }), svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }, fmt(v, decimals))]),
    svg("polyline", { class: "expected", points: points.filter((p) => p.expected !== null).map((p) => `${x(points.indexOf(p))},${y(p.expected)}`).join(" ") }),
    svg("polyline", { class: "series", points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ") }),
    points.map((p, i) => svg("circle", { class: p.status, cx: x(i), cy: y(p.value), r: points.length > 150 ? 2.5 : 4 }, svg("title", {}, `${p.qa_date}: ${fmt(p.value)} ${unit || ""} (${p.status})`))),
    points.map((p, i) => (i % labelEvery === 0 ? svg("text", { x: x(i), y: H - B + 18, "text-anchor": "middle" }, multiYear ? p.qa_date.slice(0, 7) : p.qa_date.slice(5)) : null)));
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

// A tiny chart for the overview grid: the series against its warning band, last value emphasised.
function sparkline(points, unit) {
  const W = 220, H = 56, P = 4;
  const vals = [];
  for (const p of points) { vals.push(p.value); for (const s of [1, -1]) { const v = bandValue(p, "warn", s); if (v !== null) vals.push(v); } }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const x = (i) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1));
  const y = (v) => P + ((hi - v) * (H - 2 * P)) / (hi - lo);
  const upper = [], lower = [];
  points.forEach((p, i) => { const u = bandValue(p, "warn", 1), l = bandValue(p, "warn", -1); if (u !== null) { upper.push(`${x(i)},${y(u)}`); lower.unshift(`${x(i)},${y(l)}`); } });
  const last = points[points.length - 1];
  return svg("svg", { class: "spark", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${points.length} values` },
    upper.length ? svg("polygon", { class: "band-warn", points: upper.concat(lower).join(" ") }) : null,
    svg("polyline", { class: "series", points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ") }),
    points.map((p, i) => (p.status === "fail" || p.status === "warn" ? svg("circle", { class: p.status, cx: x(i), cy: y(p.value), r: 2.5 }) : null)),
    svg("circle", { class: last.status, cx: x(points.length - 1), cy: y(last.value), r: 3.5 }));
}

async function renderTrendOverview(machines, machineId, range) {
  const machine = machines.find((m) => String(m.id) === String(machineId));
  const loading = el("div", { class: "card empty" }, `Loading ${machine.name} trends…`);
  app.append(loading);
  const assignments = await api("GET", `/api/machines/${machineId}/assignments`);
  const templates = await Promise.all(assignments.filter((a) => a.active).map((a) => api("GET", `/api/assignments/${a.id}/template`)));
  const numeric = templates.flatMap((t) => t.items.filter((i) => i.type === "numeric").map((i) => ({ ...i, queue: t.queue.name })));
  if (!numeric.length) {
    loading.remove();
    app.append(el("div", { class: "card empty" }, `${machine.name} has no measured tests scheduled.`));
    return;
  }
  const all = await api("GET", `/api/machines/${machineId}/trends`);
  const trends = numeric.map((i) => ({ points: all[i.test_id] || [] }));
  loading.remove();
  const cards = numeric.map((item, k) => ({ item, points: filterRange(trends[k].points, range) })).filter((c) => c.points.length);
  if (!cards.length) {
    app.append(el("div", { class: "card empty" }, "No results in this period."));
    return;
  }
  const worst = cards.filter((c) => c.points[c.points.length - 1].status === "fail").length;
  const warn = cards.filter((c) => c.points[c.points.length - 1].status === "warn").length;
  app.append(el("p", { class: "lead" }, `${cards.length} tests. `,
    worst ? el("span", { class: "chip fail" }, `${worst} failing now`) : "", " ", warn ? el("span", { class: "chip warn" }, `${warn} in warning`) : "",
    !worst && !warn ? el("span", { class: "chip pass" }, "All passing") : ""));
  const bySection = new Map();
  for (const c of cards) {
    const key = `${sectionOf(c.item)}|${c.item.category}`;
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(c);
  }
  let lastSection = null;
  for (const [key, list] of [...bySection].sort(([a], [b]) => a.split("|")[0].localeCompare(b.split("|")[0]))) {
    const [section, category] = key.split("|");
    if (section !== lastSection) app.append(el("h2", { class: "section-head" }, section));
    lastSection = section;
    app.append(el("h3", { class: "muted" }, category));
    // Problems first within each category.
    list.sort((a, b) => STATUS_RANK[b.points[b.points.length - 1].status] - STATUS_RANK[a.points[a.points.length - 1].status]);
    app.append(el("div", { class: "spark-grid" }, list.map(({ item, points }) => {
      const s = stats(points);
      const short = item.name.startsWith(category + " – ") ? item.name.slice(category.length + 3) : item.name.replace(category + " ", "");
      return el("a", { class: `card spark-card ${s.last.status}`, href: `#/trends?machine_id=${machineId}&test_id=${item.test_id}&range=${range}` },
        el("div", { class: "spark-head" }, el("strong", {}, short), chip(s.last.status)),
        sparkline(points, item.unit),
        el("div", { class: "spark-foot muted small" },
          el("span", {}, `Last ${fmt(s.last.value)} ${item.unit}`.trim(), s.dev !== null ? ` (${s.dev >= 0 ? "+" : ""}${fmt(s.dev, 2)})` : ""),
          el("span", {}, s.fails.length ? `${s.fails.length} fail` : s.warns.length ? `${s.warns.length} warn` : `${s.n} ok`)));
    })));
  }
}

function renderTrendDetail(data, points, unit, range, machineId) {
  const s = stats(points);
  const limitsNow = s.last;
  app.append(el("div", { class: "card stat-row" },
    stat("Latest", `${fmt(s.last.value)} ${unit}`.trim(), chip(s.last.status)),
    stat("Expected", limitsNow.expected !== null ? `${fmt(limitsNow.expected)} ${unit}`.trim() : "—",
      limitsNow.warn !== null ? `warn ±${fmt(limitsNow.warn)}${limitsNow.tol_mode === "percent" ? "%" : ""} · fail ±${fmt(limitsNow.fail)}${limitsNow.tol_mode === "percent" ? "%" : ""}` : ""),
    stat("Mean ± SD", `${fmt(s.mean, 2)} ± ${fmt(s.sd, 2)}`, `${s.n} values`),
    stat("Range", `${fmt(s.min)} to ${fmt(s.max)}`, ""),
    stat("Within limits", `${s.inTol}%`, s.fails.length ? `${s.fails.length} fail, last ${shortDate(s.fails[s.fails.length - 1].qa_date)}` : s.warns.length ? `${s.warns.length} warn` : "no fails")));
  app.append(el("div", { class: "legend" },
    el("span", {}, el("span", { class: "swatch warn" }), "Within warning"),
    el("span", {}, el("span", { class: "swatch fail" }), "Within fail limit"),
    el("span", {}, "Dashed line: expected value"),
    el("span", {}, "Dots: ", el("span", { class: "chip pass" }, "pass"), " ", el("span", { class: "chip warn" }, "warn"), " ", el("span", { class: "chip fail" }, "fail"))));
  app.append(trendChart(points, unit));
  app.append(el("details", { class: "card", open: points.length <= 20 }, el("summary", {}, points.length > 100 ? "Latest 100 values" : "Values"),
    table(["QA date", "#Value", "#Expected", "Status"], points.slice(-100).reverse().map((p) => el("tr", { class: "clickable", onclick: () => (location.hash = `#/runs/${p.run_id}`) },
      el("td", {}, p.qa_date), el("td", { class: "num" }, `${fmt(p.value)} ${unit}`.trim()), el("td", { class: "num" }, fmt(p.expected)), el("td", {}, chip(p.status)))))));
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
  const testId = params.get("test_id");
  page("Machine Trends", testId ? "One test over time, against the limits in force when each value was recorded." : "Every measured test on this machine. Click one for detail.");
  const go = (next) => { location.hash = `#/trends?${new URLSearchParams(Object.entries(next).filter(([, v]) => v))}`; };
  const form = el("div", { class: "row" },
    select("machine_id", machines.map((m) => [m.id, m.name]), machineId, { onchange: (e) => go({ machine_id: e.target.value, range }) }),
    select("range", [["30", "Last 30 days"], ["90", "Last 3 months"], ["365", "Last year"], ["all", "All history"]], range, { onchange: (e) => go({ machine_id: machineId, test_id: testId, range: e.target.value }) }),
    testId ? el("a", { class: "button", href: `#/trends?machine_id=${machineId}&range=${range}` }, "← All tests") : null);
  app.append(form, el("br"));
  if (!machines.length) return app.append(el("div", { class: "card empty" }, "No machines yet."));
  if (!testId) return renderTrendOverview(machines, machineId, range);
  const data = await api("GET", `/api/trend?machine_id=${machineId}&test_id=${testId}`);
  const points = filterRange(data.points, range);
  app.append(el("h2", {}, data.test.name), el("p", { class: "muted small" }, [sectionOf(data.test), data.test.category].join(" · ")));
  if (!points.length) return app.append(el("div", { class: "card empty" }, "No results for this test in this period."));
  renderTrendDetail(data, points, data.test.unit, range, machineId);
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
