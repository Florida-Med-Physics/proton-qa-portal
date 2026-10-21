"use strict";

// ---------------------------------------------------------------------------
// Small helpers. Everything is built with DOM nodes (never innerHTML) so user
// text cannot inject markup.
// ---------------------------------------------------------------------------

const state = { user: null, cache: {} };
const app = document.getElementById("app");
const ROLE_LABEL = { admin: "Admin", physicist: "Physicist", therapist: "Therapist" };
const STATE_LABEL = { overdue: "Overdue", due: "Due today", done: "Done today", upcoming: "Upcoming" };
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", semiannual: "Semiannual", annual: "Annual", custom: "Custom interval" };
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

// Mirrors portal/qa.py evaluate(); the server re-checks on submit.
function evaluate(type, value, limits) {
  if (type === "boolean") return value === "pass" ? "pass" : "fail";
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

const NAV = [
  ["#/", "Dashboard", null],
  ["#/machines", "Machines", null],
  ["#/queues", "QA queues", null],
  ["#/tests", "Test library", null],
  ["#/runs", "History", null],
  ["#/trends", "Trends", null],
  ["#/users", "Users", "manage_users"],
  ["#/audit", "Audit log", "review"],
];

function renderShell() {
  const bar = document.getElementById("topbar");
  bar.hidden = !state.user;
  if (!state.user) return;
  const current = location.hash.split("/").slice(0, 2).join("/") || "#/";
  document.getElementById("nav").replaceChildren(...NAV.filter(([, , p]) => !p || can(p)).map(([href, label]) =>
    el("a", { href, class: (current === href || (href === "#/" && current === "#")) ? "active" : "" }, label)));
  document.getElementById("who").replaceChildren(
    el("a", { href: "#/account" }, personName(state.user.full_name, state.user.username)),
    el("span", { class: "chip" }, ROLE_LABEL[state.user.role]),
    el("button", { class: "link", onclick: logout }, "Sign out"));
}

function renderLogin() {
  renderShell();
  const error = el("p", { class: "error" });
  const form = el("form", {},
    el("h1", {}, "Proton QA Portal"),
    el("p", { class: "muted" }, "Sign in with your portal account."),
    field("Username", el("input", { name: "username", autocomplete: "username", required: true, autofocus: true })),
    field("Password", el("input", { name: "password", type: "password", autocomplete: "current-password", required: true })),
    error,
    el("button", { class: "primary", type: "submit" }, "Sign in"));
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
  page("Today", new Date(data.today + "T00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    can("configure") ? [el("a", { class: "button", href: "#/machines" }, "Manage machines")] : []);
  if (!data.machines.length) {
    app.append(el("div", { class: "card empty" }, "No machines yet. ",
      can("configure") ? el("a", { href: "#/machines" }, "Add your first machine.") : "Ask a physicist to add one."));
    return;
  }
  app.append(el("div", { class: "grid" }, data.machines.map((machine) => el("div", { class: "card machine-card" },
    el("h3", {}, el("a", { href: `#/machines/${machine.id}` }, machine.name),
      machine.pending_review ? el("a", { href: `#/runs?machine_id=${machine.id}&review_status=pending`, class: "chip pending" }, `${machine.pending_review} to review`) : null),
    el("div", { class: "muted small" }, [machine.kind, machine.location].filter(Boolean).join(" · ") || " "),
    machine.queues.length ? machine.queues.map((q) => el("div", { class: "queue-row" },
      el("div", {}, el("strong", {}, q.queue_name), " ", el("span", { class: "muted small" }, q.schedule)),
      el("div", { class: "actions" }, can("perform") ? el("a", { class: `button ${q.state === "due" || q.state === "overdue" ? "primary" : ""}`, href: `#/perform/${q.id}` }, "Perform") : null),
      el("div", { class: "row small" },
        chip(q.state, STATE_LABEL[q.state]),
        el("span", { class: "muted" }, q.state === "done" ? `next ${q.next_due}` : `due ${q.next_due}`),
        q.last_run ? el("a", { href: `#/runs/${q.last_run.id}` }, chip(q.last_run.overall, `Last: ${capitalize(q.last_run.overall)}`)) : null)))
      : el("p", { class: "muted" }, "No QA queues scheduled.")))));
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
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "active", checked: !!a.active }), "Active"));
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
    }) }, "Edit machine"));
    actions.push(el("button", { class: "primary", onclick: async () => {
      const queues = (await api("GET", "/api/queues")).filter((q) => q.active && !assignments.some((a) => a.queue_id === q.id));
      if (!queues.length) return toast("Every active queue is already scheduled here. Create a queue first.", true);
      modal(`Schedule a queue on ${machine.name}`, scheduleForm(null, queues), async (data, form) => {
        await api("POST", "/api/assignments", { ...scheduleData(data, form), machine_id: Number(id) });
        toast("Queue scheduled");
        route();
      });
    } }, "Schedule a queue"));
  }
  page(machine.name, [machine.kind, machine.location, machine.active ? null : "Retired"].filter(Boolean).join(" · "), actions);
  if (machine.notes) app.append(el("p", { class: "muted" }, machine.notes));
  app.append(el("h2", {}, "Scheduled QA queues"));
  app.append(table(["Queue", "Schedule", "Starts", "Next due", "Status", ""], assignments.map((a) => el("tr", {},
    el("td", {}, el("strong", {}, a.queue_name)),
    el("td", {}, a.schedule),
    el("td", {}, a.start_date),
    el("td", {}, a.active ? a.next_due : "-"),
    el("td", {}, a.active ? chip(a.state, STATE_LABEL[a.state]) : chip("", "Paused")),
    el("td", {}, el("div", { class: "row" },
      can("perform") && a.active ? el("a", { class: "button", href: `#/perform/${a.id}` }, "Perform") : null,
      can("configure") ? el("button", { onclick: () => modal(`${a.queue_name} schedule`, scheduleForm(a), async (data, form) => {
        await api("PUT", `/api/assignments/${a.id}`, scheduleData(data, form));
        toast("Schedule saved");
        route();
      }) }, "Schedule") : null,
      can("configure") ? el("a", { class: "button", href: `#/assignments/${a.id}/limits` }, "Adjust limits") : null,
      can("configure") ? el("button", { onclick: () => importSphinxDialog(a) }, "Import Sphinx") : null,
      el("a", { class: "button", href: `#/runs?machine_id=${id}&queue_id=${a.queue_id}` }, "History"))))),
    "No QA queues scheduled on this machine yet."));
}

async function renderLimits(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  page(`Adjust limits: ${t.queue.name} on ${t.machine.name}`,
    "Values here apply only to this machine. Leave a field blank to use the queue's value (shown as the placeholder).");
  const numeric = t.items.filter((i) => i.type === "numeric");
  if (!numeric.length) {
    app.append(el("div", { class: "card empty" }, "This queue has no numeric tests."));
    return;
  }
  const rows = numeric.map((item) => {
    const o = item.override || {};
    const q = item.queue_limits;
    return el("tr", { "data-test": item.test_id, class: "compact" },
      el("td", {}, el("strong", {}, item.name), el("div", { class: "muted small" }, [item.category, item.unit].filter(Boolean).join(" · "))),
      el("td", {}, el("input", { name: "expected", type: "number", step: "any", value: o.expected ?? "", placeholder: fmt(q.expected) })),
      el("td", {}, el("input", { name: "warn", type: "number", step: "any", min: 0, value: o.warn ?? "", placeholder: fmt(q.warn) })),
      el("td", {}, el("input", { name: "fail", type: "number", step: "any", min: 0, value: o.fail ?? "", placeholder: fmt(q.fail) })),
      el("td", {}, select("tol_mode", [["", `Queue (${q.tol_mode})`], ["absolute", "Absolute"], ["percent", "Percent"]], o.tol_mode || "")));
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
// Performing a queue
// ---------------------------------------------------------------------------

async function renderPerform(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  page(`${t.queue.name}`, `${t.machine.name} · ${t.assignment.schedule}`);
  if (t.queue.description) app.append(el("p", { class: "muted" }, t.queue.description));
  const overallChip = el("span");
  const inputs = [];
  const refresh = () => {
    const statuses = inputs.map((i) => i.status()).filter(Boolean);
    const worst = statuses.reduce((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), "pass");
    const missing = inputs.filter((i) => i.required && !i.status()).length;
    overallChip.replaceChildren(missing ? chip("", `${missing} remaining`) : chip(worst, `Overall: ${capitalize(worst)}`));
  };
  const rows = [];
  let lastCategory = null;
  for (const item of t.items) {
    if (item.category !== lastCategory) {
      rows.push(el("tr", { class: "group" }, el("td", { colspan: 5 }, item.category || "General")));
      lastCategory = item.category;
    }
    const statusCell = el("td", {});
    let input;
    if (item.type === "numeric") input = el("input", { type: "number", step: "any", class: "result-input", "aria-label": item.name });
    else if (item.type === "boolean") input = select("", [["", "Choose"], ["pass", "Pass"], ["fail", "Fail"]], "", { class: "result-input", "aria-label": item.name });
    else input = el("input", { type: "text", "aria-label": item.name });
    const comment = el("input", { type: "text", placeholder: "Comment", "aria-label": `${item.name} comment` });
    const note = el("div", { class: "muted small" });
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
      refresh();
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    inputs.push(entry);
    rows.push(el("tr", {},
      el("td", {}, el("strong", {}, item.name), item.description ? el("div", { class: "muted small" }, item.description) : null, note),
      el("td", { class: "small muted" }, item.type === "numeric" ? limitsText(item.limits, item.unit) : item.type === "boolean" ? "Pass / fail" : "Record"),
      el("td", {}, el("div", { class: "row" }, input, item.type === "numeric" && item.unit ? el("span", { class: "muted" }, item.unit) : null)),
      statusCell,
      el("td", {}, comment)));
  }
  if (!t.items.length) {
    app.append(el("div", { class: "card empty" }, "This queue has no tests yet. ",
      can("configure") ? [el("a", { href: `#/queues/${t.queue.id}` }, "Add tests to it"), ", or choose a Sphinx file below to add its measurements."] : ""), el("br"));
  }
  const qaDate = el("input", { type: "date", value: today(), max: today() });
  const runComment = el("textarea", { placeholder: "Notes for the reviewer (optional)" });
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
      entry.note.replaceChildren(`Sphinx: ${m.sphinx_status || "no status"}`,
        m.limits_differ ? ` · file limits ${limitsText(m.file_limits, entry.item.unit)}` : "");
    }
    sphinxInfo.replaceChildren(el("div", {},
      el("div", {}, `Filled ${p.matched.length} value(s) from ${p.filename}. Sphinx finished ${p.finished.replace("T", " ")}${p.sphinx_user ? " by " + p.sphinx_user : ""}.`),
      p.duplicate_run ? el("div", { class: "error" }, "This file is already recorded as ", el("a", { href: `#/runs/${p.duplicate_run}` }, `run #${p.duplicate_run}`), ".") : null,
      p.unmatched.length ? el("div", { class: "row" }, `${p.unmatched.length} measurement(s) in the file are not in this queue.`,
        can("configure") ? el("button", { onclick: async () => {
          try {
            const r = await api("POST", `/api/assignments/${assignmentId}/sphinx/tests`, { file: state.sphinxFile });
            toast(`Added ${r.added.length} test(s) to the queue`);
            state.applySphinxOnLoad = true;
            route();
          } catch (err) {
            toast(err.message, true);
          }
        } }, "Add them to this queue") : "Ask a physicist to add them.") : null));
  };
  const sphinxFile = el("input", { type: "file", accept: ".xls", "aria-label": "Sphinx export file" });
  sphinxFile.addEventListener("change", async () => {
    if (!sphinxFile.files[0]) return;
    try {
      state.sphinxFile = await readFileBase64(sphinxFile.files[0]);
      await applySphinx();
    } catch (err) {
      sphinxInfo.replaceChildren(el("span", { class: "error" }, err.message));
    }
  });
  app.append(el("div", { class: "card" }, el("h3", {}, "Fill from a Sphinx file"),
    el("p", { class: "muted small" }, "Choose today's Sphinx .xls export to fill in the measured values, then complete the remaining checks."),
    sphinxFile, sphinxInfo), el("br"));
  if (!t.items.length) return;
  app.append(el("div", { class: "row" }, field("QA date", qaDate), el("div", { class: "spacer" }), overallChip));
  app.append(el("br"), table(["Test", "Expected / limits", "Result", "Status", "Comment"], rows));
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
  app.append(el("h2", {}, "Notes"), runComment, error, el("div", { class: "row" }, el("a", { class: "button", href: "#/" }, "Cancel"), submit));
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

async function renderQueues() {
  const queues = await api("GET", "/api/queues");
  page("QA queues", "A queue is an ordered list of tests that you schedule on one or more machines.",
    can("configure") ? [el("a", { class: "button primary", href: "#/queues/new" }, "New queue")] : []);
  app.append(table(["Queue", "#Tests", "#Machines", "Status"], queues.map((q) =>
    el("tr", { class: "clickable", onclick: () => (location.hash = `#/queues/${q.id}`) },
      el("td", {}, el("strong", {}, q.name), q.description ? el("div", { class: "muted small" }, q.description) : null),
      el("td", { class: "num" }, q.item_count), el("td", { class: "num" }, q.machine_count),
      el("td", {}, q.active ? chip("pass", "Active") : chip("", "Inactive")))), "No queues yet."));
}

async function renderQueueEditor(id) {
  const isNew = id === "new";
  const [tests, queue] = await Promise.all([api("GET", "/api/tests"), isNew ? null : api("GET", `/api/queues/${id}`)]);
  const q = queue || { name: "", description: "", active: 1, items: [] };
  const editable = can("configure");
  page(isNew ? "New queue" : q.name, "Blank limits use the test library's defaults (shown as the placeholder).");
  const info = el("form", { class: "card" }, el("div", { class: "form-grid" },
    field("Queue name", el("input", { name: "name", value: q.name, required: true, disabled: !editable, placeholder: "e.g. Daily QA - TG-224" })),
    field("Description", el("textarea", { name: "description", disabled: !editable }, q.description), "wide"),
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
        el("td", {}, el("strong", {}, t.name), el("div", { class: "muted small" }, [t.category, t.type, t.unit].filter(Boolean).join(" · "))),
        el("td", {}, input("expected")),
        el("td", {}, input("warn", { min: 0 })),
        el("td", {}, input("fail", { min: 0 })),
        el("td", {}, select("", [["", `Default (${t.tol_mode})`], ["absolute", "Absolute"], ["percent", "Percent"]], item.tol_mode || "",
          { disabled: !editable || !numeric, onchange: (e) => (item.tol_mode = e.target.value) })),
        el("td", {}, editable ? el("div", { class: "row nowrap" },
          el("button", { class: "icon-btn", title: "Move up", disabled: index === 0, onclick: () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } }, "↑"),
          el("button", { class: "icon-btn", title: "Move down", disabled: index === items.length - 1, onclick: () => { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } }, "↓"),
          el("button", { class: "icon-btn danger", title: "Remove", onclick: () => { items.splice(index, 1); draw(); } }, "✕")) : null));
    }));
    holder.replaceChildren(items.length ? el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ["Test", "Expected", "Warning ±", "Fail ±", "Tolerance", ""].map((h) => el("th", {}, h)))), body))
      : el("div", { class: "card empty" }, "No tests in this queue yet."));
    picker.replaceChildren(el("option", { value: "" }, "Add a test from the library…"),
      ...tests.filter((t) => t.active && !items.some((i) => i.test_id === t.id)).map((t) => el("option", { value: t.id }, `${t.category ? t.category + " – " : ""}${t.name}`)));
  };
  const picker = el("select", { onchange: (e) => { if (e.target.value) { items.push({ test_id: Number(e.target.value) }); draw(); } } });
  app.append(el("h2", {}, "Tests"), holder);
  if (editable) {
    app.append(el("div", { class: "row" }, el("div", {}, picker), el("a", { href: "#/tests" }, "Manage the test library")));
    const error = el("p", { class: "error" });
    app.append(error, el("div", { class: "row" }, el("a", { class: "button", href: "#/queues" }, "Back"),
      el("button", { class: "primary", onclick: async () => {
        error.textContent = "";
        try {
          const payload = { ...formData(info), items };
          const result = isNew ? await api("POST", "/api/queues", payload) : await api("PUT", `/api/queues/${id}`, payload);
          toast("Queue saved");
          location.hash = `#/queues/${result.id}`;
          if (!isNew) route();
        } catch (err) {
          error.textContent = err.message;
        }
      } }, "Save queue")));
  }
  draw();
}

function testForm(test) {
  const t = test || { type: "numeric", tol_mode: "absolute", active: 1 };
  const type = select("type", [["numeric", "Numeric"], ["boolean", "Pass / fail"], ["text", "Text"]], t.type);
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
  page("Test library", "Default limits here can be adjusted per queue and per machine.", editable ? [el("button", {
    class: "primary",
    onclick: () => modal("New test", testForm(), async (data) => {
      await api("POST", "/api/tests", data);
      toast("Test added");
      route();
    }),
  }, "New test")] : []);
  app.append(table(["Category", "Test", "Type", "#Expected", "#Warning ±", "#Fail ±", "Tolerance", "Status"], tests.map((t) =>
    el("tr", { class: editable ? "clickable" : "", onclick: editable ? () => modal(`Edit ${t.name}`, testForm(t), async (data) => {
      await api("PUT", `/api/tests/${t.id}`, data);
      toast("Test saved");
      route();
    }) : null },
      el("td", {}, t.category), el("td", {}, el("strong", {}, t.name)), el("td", {}, t.type),
      el("td", { class: "num" }, t.type === "numeric" ? `${fmt(t.expected)} ${t.unit}` : ""),
      el("td", { class: "num" }, fmt(t.warn)), el("td", { class: "num" }, fmt(t.fail)),
      el("td", {}, t.type === "numeric" ? t.tol_mode : ""),
      el("td", {}, t.active ? chip("pass", "Active") : chip("", "Inactive")))), "No tests yet. Add the checks your queues will use."));
}

// ---------------------------------------------------------------------------
// History, review, trends
// ---------------------------------------------------------------------------

async function renderRuns() {
  const params = queryParams();
  const [machines, queues, runs] = await Promise.all([api("GET", "/api/machines"), api("GET", "/api/queues"), api("GET", `/api/runs?${params}`)]);
  page("History", "Every submitted QA run, newest first.");
  const filters = el("form", { class: "row" },
    select("machine_id", [["", "All machines"], ...machines.map((m) => [m.id, m.name])], params.get("machine_id")),
    select("queue_id", [["", "All queues"], ...queues.map((q) => [q.id, q.name])], params.get("queue_id")),
    select("review_status", [["", "Any review status"], ...Object.entries(REVIEW_LABEL)], params.get("review_status")));
  filters.addEventListener("change", () => {
    const next = new URLSearchParams(Object.entries(formData(filters)).filter(([, v]) => v));
    location.hash = `#/runs${next.toString() ? "?" + next : ""}`;
  });
  app.append(filters, el("br"));
  app.append(table(["QA date", "Machine", "Queue", "Result", "Performed by", "Review"], runs.map((r) =>
    el("tr", { class: "clickable", onclick: () => (location.hash = `#/runs/${r.id}`) },
      el("td", {}, r.qa_date), el("td", {}, r.machine_name), el("td", {}, r.queue_name),
      el("td", {}, chip(r.overall)), el("td", {}, personName(r.performer_name, r.performer)),
      el("td", {}, reviewChip(r.review_status)))), "No runs match."));
}

async function renderRun(id) {
  const run = await api("GET", `/api/runs/${id}`);
  page(`${run.queue_name} · ${run.machine_name}`, `QA date ${run.qa_date}`);
  app.append(el("div", { class: "card summary" },
    el("div", {}, el("span", { class: "muted small" }, "Overall"), chip(run.overall)),
    el("div", {}, el("span", { class: "muted small" }, "Performed by"), `${personName(run.performer_name, run.performer)} · ${run.performed_at.replace("T", " ")}`),
    el("div", {}, el("span", { class: "muted small" }, "Source"), run.source === "sphinx" ? "Sphinx export" : "Manual entry"),
    el("div", {}, el("span", { class: "muted small" }, "Review"), reviewChip(run.review_status),
      run.reviewed_by ? ` ${personName(run.reviewer_name, run.reviewer)} · ${run.reviewed_at.replace("T", " ")}` : ""),
    run.comment ? el("div", {}, el("span", { class: "muted small" }, "Notes"), run.comment) : null,
    run.review_comment ? el("div", {}, el("span", { class: "muted small" }, "Review comment"), run.review_comment) : null));
  app.append(el("br"), table(["Test", "Result", "Expected / limits at the time", "Status", "Comment"], run.results.map((r) => el("tr", {},
    el("td", {}, el("strong", {}, r.name), el("div", { class: "muted small" }, r.category)),
    el("td", {}, r.type === "boolean" ? (r.value_num ? "Pass" : "Fail") : r.type === "text" ? r.value_text : `${fmt(r.value_num)} ${r.unit}`),
    el("td", { class: "small muted" }, r.type === "numeric" ? limitsText(r, r.unit) : ""),
    el("td", {}, chip(r.status)),
    el("td", {}, r.comment)))));
  if (run.review_status === "pending" && can("review")) {
    if (run.performed_by === state.user.id) {
      app.append(el("p", { class: "muted" }, "Someone else needs to review this run, because you performed it."));
      return;
    }
    const comment = el("textarea", { placeholder: "Review comment (required to reject)" });
    const error = el("p", { class: "error" });
    const decide = (decision) => async () => {
      error.textContent = "";
      try {
        await api("POST", `/api/runs/${id}/review`, { decision, comment: comment.value });
        toast(decision === "approved" ? "Run approved" : "Run rejected");
        route();
      } catch (err) {
        error.textContent = err.message;
      }
    };
    app.append(el("h2", {}, "Review"), comment, error, el("div", { class: "row" },
      el("button", { class: "primary", onclick: decide("approved") }, "Approve"),
      el("button", { class: "danger", onclick: decide("rejected") }, "Reject")));
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

async function renderTrends() {
  const params = queryParams();
  const [machines, tests] = await Promise.all([api("GET", "/api/machines"), api("GET", "/api/tests")]);
  page("Trends", "Each result plotted against the limits that applied when it was recorded.");
  const numeric = tests.filter((t) => t.type === "numeric");
  const form = el("form", { class: "row" },
    select("machine_id", [["", "Choose a machine"], ...machines.map((m) => [m.id, m.name])], params.get("machine_id")),
    select("test_id", [["", "Choose a test"], ...numeric.map((t) => [t.id, `${t.category ? t.category + " – " : ""}${t.name}`])], params.get("test_id")),
    select("range", [["90", "Last 3 months"], ["365", "Last year"], ["all", "All history"]], params.get("range") || "365"));
  form.addEventListener("change", () => {
    const data = formData(form);
    location.hash = `#/trends?${new URLSearchParams(Object.entries(data).filter(([, v]) => v))}`;
  });
  app.append(form, el("br"));
  if (!params.get("machine_id") || !params.get("test_id")) {
    app.append(el("div", { class: "card empty" }, "Choose a machine and a test."));
    return;
  }
  const data = await api("GET", `/api/trend?machine_id=${params.get("machine_id")}&test_id=${params.get("test_id")}`);
  const range = params.get("range") || "365";
  if (range !== "all" && data.points.length) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range));
    const from = cutoff.toISOString().slice(0, 10);
    data.points = data.points.filter((p) => p.qa_date >= from);
  }
  if (!data.points.length) {
    app.append(el("div", { class: "card empty" }, "No results recorded for this test on this machine in this period."));
    return;
  }
  app.append(el("div", { class: "legend" },
    data.test.unit ? el("span", {}, `Units: ${data.test.unit}`) : null,
    el("span", {}, el("span", { class: "swatch warn" }), "Within warning"),
    el("span", {}, el("span", { class: "swatch fail" }), "Within fail limit"),
    el("span", {}, "Dashed line: expected value")));
  app.append(trendChart(data.points, data.test.unit));
  app.append(el("h2", {}, data.points.length > 100 ? "Latest 100 values" : "Values"), table(["QA date", "#Value", "#Expected", "Status"], data.points.slice(-100).reverse().map((p) => el("tr", { class: "clickable", onclick: () => (location.hash = `#/runs/${p.run_id}`) },
    el("td", {}, p.qa_date), el("td", { class: "num" }, `${fmt(p.value)} ${data.test.unit}`), el("td", { class: "num" }, fmt(p.expected)), el("td", {}, chip(p.status))))));
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
