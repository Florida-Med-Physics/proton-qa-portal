"use strict";

// ---------------------------------------------------------------------------
// Small helpers. Everything is built with DOM nodes (never innerHTML) so user
// text cannot inject markup.
// ---------------------------------------------------------------------------

// Number fields must never step when a wheel/trackpad gesture scrolls the page.
document.addEventListener('wheel', () => {
  const input = document.activeElement;
  if (input instanceof HTMLInputElement && input.type === 'number') input.blur();
}, { capture: true, passive: true });

const state = { user: null, cache: {}, actingRole:(()=>{try{return sessionStorage.getItem('qa_admin_acting_role')||null;}catch{return null;}})() };
const app = document.getElementById("app");
// Nothing on the page may ever read "null" or "undefined": the main container drops empty children instead of
// turning them into text (native append/replaceChildren would), and flattens arrays of elements.
const present = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false);
for (const method of ["append", "prepend", "replaceChildren"]) {
  const native = app[method].bind(app);
  app[method] = (...kids) => native(...present(kids));
}
const ROLE_LABEL = { admin: "Admin", physicist: "Physicist", therapist: "Therapist", mpa: "MPA" };
const STATE_LABEL = { overdue: "Overdue", due: "Due", done: "Done today", upcoming: "Upcoming" };
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", semiannual: "Semiannual", annual: "Annual", custom: "Custom interval",
  asneeded: "As needed (e.g. SRS days)" };
// A list can be started when it is due, overdue, or "as needed".
const startable = (state) => state === "due" || state === "overdue" || state === "ready";
// Daily QA is due at 6 AM; other lists are due at the end of the scheduled day.
const DAILY_DUE_TIME = "06:00";
function dueIn(iso, frequency, now = Date.now()) {
  if (!iso) return "As needed";
  const end = new Date(iso + (frequency === "daily" ? `T${DAILY_DUE_TIME}:00` : "T23:59:59"));
  if (!Number.isFinite(end.getTime())) return "Not scheduled";
  const hours = (end - now) / 3600000;
  if (hours <= 0) return "Due now";
  if (hours < 24) return `Due in ${Math.ceil(hours)} Hours`;
  return `Due in ${Math.ceil(hours / 24)} Days`;
}
function scheduleStatus(a) {
  if (!a.active) return "Paused";
  if (a.state === "overdue") return `Overdue since ${shortDate(a.next_due)}`;
  if (a.state === "due") return dueIn(a.next_due, a.frequency);
  if (a.state === "done") return "Done today";
  if (a.state === "ready") return a.last_done ? `As needed · last run ${shortDate(a.last_done)}` : "As needed";
  return dueIn(a.next_due, a.frequency);
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

const REVIEW_LABEL = { pending: "Awaiting Physics Review", approved: "Approved", rejected: "Rejected", imported: "Historical import" };

function reviewStatusText(run) {
  if(run.review_status==='pending') return run.therapist_approval_required&&(!run.therapist_approved_by||run.review_ready===false)?'Awaiting Therapy Review':'Awaiting Physics Review';
  return REVIEW_LABEL[run.review_status]||capitalize(run.review_status);
}
function reviewChip(runOrStatus) {
  const run=typeof runOrStatus==='object'?runOrStatus:{review_status:runOrStatus};
  return chip(run.review_status==='imported'?'':run.review_status,reviewStatusText(run));
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

function activeRole() { return state.user?.role === "admin" && state.actingRole ? state.actingRole : state.user?.role; }

function can(permission) {
  const role = activeRole();
  const rules = { perform: ["admin", "physicist", "therapist", "mpa"], therapist_approve: ["therapist"], review: ["admin", "physicist"], configure: ["admin", "physicist"], manage_users: ["admin"] };
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
  if (window.localApi) return window.localApi(method,path,body,{actingRole:state.user?.role==='admin'?state.actingRole:null});
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Portal": "1", ...(state.user?.role==='admin'&&state.actingRole?{'X-Act-As-Role':state.actingRole}:{}) },
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
  app.dataset.page = location.hash.split("?")[0].replace(/^#\//, "") || "home";
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
  if (limits?.criterion === "wl-max-delta") return "Pass: Maximum delta < 1 mm";
  if (!limits || limits.expected === null || limits.expected === undefined) {
    return limits && (limits.warn !== null || limits.fail !== null) ? "Limits need an expected value" : "No limits";
  }
  const suffix = limits.tol_mode === "percent" ? "%" : unit ? ` ${unit}` : "";
  const parts = [`${fmt(limits.expected)}${unit ? " " + unit : ""}`];
  if (limits.warn !== null && limits.warn !== undefined) parts.push(`warning ±${fmt(limits.warn)}${suffix}`);
  if (limits.fail !== null && limits.fail !== undefined) parts.push(`action ±${fmt(limits.fail)}${suffix}`);
  return parts.join(" · ");
}

const TYPE_LABELS = { numeric: "Numeric", boolean: "Pass / fail", status: "Pass / warning / fail", text: "Text", choice: "Multiple choice", derived: "Derived" };
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
  if (limits.criterion === "wl-max-delta") return Number(value) >= 0 && Number(value) < 1 ? "pass" : "fail";
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

function frequentQaAssignments(data,runs,userId) {
  const schedules=data.machines.flatMap(m=>m.queues.filter(q=>q.active!==0).map(q=>({...q,machine_name:m.name})));
  return schedules.map(q=>{const history=runs.filter(r=>r.performed_by===userId&&r.assignment_id===q.id&&!r.trashed_at);return {...q,use_count:history.length,last_used:history.map(r=>r.qa_date).sort().at(-1)||''};})
    .filter(q=>q.use_count).sort((a,b)=>b.use_count-a.use_count||b.last_used.localeCompare(a.last_used)||a.queue_name.localeCompare(b.queue_name)).slice(0,4);
}

async function renderHome() {
  const data = await api('GET', '/api/dashboard');
  page('Dashboard', new Date(data.today + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  const runs=await api('GET','/api/runs?limit=400');
  const due = data.machines.flatMap((m)=>m.queues).filter((q)=>['due','overdue'].includes(q.state)).length;
  const pendingTherapy=runs.filter(r=>r.review_status==='pending'&&r.therapist_approval_required&&(!r.therapist_approved_by||r.review_ready===false)).length;
  const pendingPhysics=runs.filter(r=>r.review_status==='pending'&&r.review_ready!==false).length;
  app.append(el('div',{class:'dashboard-counts'},...[
    ['Machine QA Due',due,'#/perform-qa'],
    ['QA Awaiting Therapy Review',pendingTherapy,'#/review?stage=therapy'],
    ['QA Awaiting Physics Review',pendingPhysics,'#/review?stage=physics']
  ].map(([label,count,href])=>el('a',{href,class:'card dashboard-count','aria-label':`${label}: ${count}`},el('strong',{class:'dashboard-count-number'},String(count)),el('span',{},label)))));

  const frequent=frequentQaAssignments(data,runs,state.user.id);
  if(can('perform')&&frequent.length){
    const cards=frequent.map(q=>el('div',{class:'frequent-qa-item'},el('strong',{},q.machine_name),el('span',{},q.queue_name),el('span',{class:'small muted'},q.state==='overdue'?'Overdue':q.state==='done'?'Done today':q.state==='ready'?'As needed':dueIn(q.next_due,q.frequency)),el('a',{class:'button primary',href:`#/perform/${q.id}`},'Start QA')));
    app.append(el('section',{class:'card frequent-qa'},el('h2',{},'Frequently used QA'),el('p',{class:'muted small'},'Based on your recent QA submissions.'),el('div',{class:'frequent-qa-grid'},cards)));
  }

  const grid=el('div',{class:'home-modality-grid'});
  for(const modality of MODALITIES){
    const machines=data.machines.filter((m)=>modalityOf(m.kind)===modality).sort((a,b)=>kindRank(a.kind)-kindRank(b.kind)||a.name.localeCompare(b.name));
    const title=modality==='Brachytherapy'?'Brachy':modality;
    const body=el('div',{class:'home-card-machines'});
    for(const m of machines){
      const schedules=[...m.queues].sort((a,b)=>(FREQ_ORDER[a.frequency]??9)-(FREQ_ORDER[b.frequency]??9)||a.queue_name.localeCompare(b.queue_name));
      const last=m.queues.filter((q)=>q.last_run).sort((a,b)=>b.last_run.qa_date.localeCompare(a.last_run.qa_date))[0]?.last_run;
      const scheduleRows=schedules.map((a)=>{
        const status=a.state==='overdue'?'Overdue':a.state==='ready'?'As needed':a.state==='done'?'Done today':dueIn(a.next_due,a.frequency);
        const label=a.frequency==='daily'?'Daily QA':a.frequency==='monthly'?'Monthly QA':a.frequency==='asneeded'?a.queue_name.replace(/\s*[–-]\s*HDR Flexitron$/i,''):(FREQ_LABEL[a.frequency]||a.queue_name);
        return el('div',{class:'home-qa-line'},
          can('perform')?el('a',{class:'start-dot home-go',href:`#/perform/${a.id}`,title:`Start ${label} for ${m.name}`,'aria-label':`Start ${label} for ${m.name}`},'▶'):null,
          el('div',{class:'home-qa-info'},el('span',{class:'home-qa-label',title:a.queue_name},label),el('span',{class:`small ${status==='Overdue'?'home-overdue':'muted'}`},status)),historyRing(a.history_counts,`#/trends?machine_id=${m.id}&list=${a.id}`,`${m.name} · ${a.queue_name}`));
      });
      body.append(el('div',{class:'home-machine-block'},
        el('div',{class:'home-machine-row'},el('a',{href:`#/machines/${m.id}`,class:'home-machine-name'},m.name),
          el('div',{class:'home-machine-actions'},last?el('span',{class:'home-last-result',title:`Last QA: ${last.qa_date}`},chip(last.overall)):null,
            el('a',{class:'icon-link',href:`#/trends?machine_id=${m.id}`,title:`${m.name} trends`,'aria-label':`${m.name} trends`},trendIcon(20)))),
        scheduleRows.length?el('div',{class:'home-machine-schedules'},scheduleRows):el('p',{class:'muted small'},'No QA assigned')));
    }
    if(!machines.length)body.append(el('p',{class:'muted small'},'No active machines.'));
    grid.append(el('section',{class:`card home-modality-card ${modality.toLowerCase()}`,'aria-label':`${title} machines`},
      el('div',{class:'home-card-heading'},el('h2',{},title),el('span',{class:'muted small'},`${machines.length} ${machines.length===1?'machine':'machines'}`)),body));
  }
  app.append(grid);
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

// Move the original controls into phone drawers, then restore their exact desktop slots.
// No duplicate inputs: calculations, notes and autosave keep the same DOM nodes.
function phoneDrawer(container, nodes, title) {
  const details = el('details', {class:'phone-details'}, el('summary', {}, title));
  const body = el('div', {class:'phone-details-body'});
  details.append(body);
  const slots = nodes.map(node => {
    const slot = document.createComment('desktop control slot');
    node.parentNode.insertBefore(slot, node);
    return {node, slot};
  });
  container.append(details);
  const media = matchMedia('(max-width: 760px)');
  const update = () => {
    if (!container.isConnected && slots.some(x=>!x.slot.isConnected)) return;
    for (const {node,slot} of slots) {
      if (media.matches) body.append(node);
      else slot.parentNode.insertBefore(node,slot.nextSibling);
    }
  };
  // The container is attached after construction; the initial move can run immediately.
  for (const {node} of slots) if (media.matches) body.append(node);
  media.addEventListener('change', update);
  return details;
}

function viewAsControl() {
  if(state.user?.role!=='admin') { state.actingRole=null; return null; }
  const pick=el('select',{'aria-label':'View As role'},...['admin','physicist','therapist','mpa'].map(role=>el('option',{value:role},ROLE_LABEL[role])));
  pick.value=state.actingRole||'admin';
  pick.addEventListener('change',()=>{state.actingRole=pick.value==='admin'?null:pick.value;if(state.actingRole)sessionStorage.setItem('qa_admin_acting_role',state.actingRole);else sessionStorage.removeItem('qa_admin_acting_role');location.hash='#/';renderShell();route();});
  return el('label',{class:'inline view-as-control',title:'Operate with the selected role. Your Admin identity remains in the audit trail.'},svg('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.8,'aria-hidden':'true'},svg('path',{d:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z'}),svg('circle',{cx:12,cy:12,r:3})),'View As ',pick,state.actingRole?el('span',{class:'small'},'Active'):null);
}

function renderShell() {
  const bar = document.getElementById("topbar");
  bar.hidden = !state.user;
  document.getElementById('acting-role-notice')?.remove();
  if (!state.user) return;
  bar.classList.remove('phone-menu-open');
  let menu = bar.querySelector('.phone-menu-toggle');
  if (!menu) {
    menu = el('button', {type:'button', class:'phone-menu-toggle', 'aria-controls':'nav who', onclick: () => {
      const open = bar.classList.toggle('phone-menu-open');
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? 'Close menu' : 'Menu ☰';
    }}, 'Menu ☰');
    bar.insertBefore(menu, document.getElementById('nav'));
  }
  menu.setAttribute('aria-expanded','false');
  menu.textContent = 'Menu ☰';
  const current = location.hash.split("?")[0].split("/").slice(0, 2).join("/") || "#/";
  document.getElementById("nav").replaceChildren(...NAV.filter(([, , p]) => !p || can(p)).map(([href, label, , owns, title]) =>
    el("a", { href, title: title || null, "aria-label": title || null, class: `${owns.includes(current) ? "active" : ""}${title ? " home-link" : ""}` },
      title ? homeIcon() : label)));   // the Dashboard tab is the house icon alone
  const search = el("input", { type: "search", class: "topbar-search", placeholder: "Search | Ctrl+Shift+F", "aria-label": "Search machines, QA lists and tests",
    value: location.hash.startsWith("#/search") ? queryParams().get("q") || "" : "" });
  search.addEventListener("keydown", (e) => { if (e.key === "Enter" && search.value.trim()) location.hash = `#/search?q=${encodeURIComponent(search.value.trim())}`; });
  document.getElementById("who").replaceChildren(
    search,
    ...[viewAsControl()].filter(Boolean),
    el("a", { href: "#/account", title: ROLE_LABEL[state.user.role], class: "person" }, personIcon(), personName(state.user.full_name, state.user.username)),
    el("button", { class: "link", onclick: logout }, "Sign out"),
    el('a',{href:'#/account',class:'button small password-link'},'Change password'),
    themeToggle());
  document.getElementById('acting-role-notice')?.remove();
  if(state.user.role==='admin'&&state.actingRole)bar.after(el('div',{id:'acting-role-notice',class:'acting-role-notice',role:'status'},`Operating as ${ROLE_LABEL[state.actingRole]} · Actions are saved as ${personName(state.user.full_name,state.user.username)} (Admin).`));
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
    el("p", { class: "muted" }, window.localApi ? "Temporary demo sign-in. Data stays in this browser. Shared-server deployment provides real access protection." : "Sign in with your portal account."),
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
  state.actingRole=null;sessionStorage.removeItem('qa_admin_acting_role');
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
const MODALITIES = ["Proton", "Photon", "Brachytherapy", "Simulation"];
const modalityOf = (kind) => (/hdr|brachy/i.test(kind || "") ? "Brachytherapy" : /proton/i.test(kind || "") ? "Proton" : /simulat/i.test(kind || "") ? "Simulation" : "Photon");
const KIND_RANK = ["Proton gantry", "Linac", "Elekta Synergy", "Varian Ethos", "CT simulator", "MRI simulator", "HDR brachytherapy"];
const kindRank = (k) => { const i = KIND_RANK.indexOf(k); return i < 0 ? KIND_RANK.length : i; };

// A table with fixed column widths, so the Proton and Photon tables line up at the same width.
function fixedTable(columns, rows, emptyText) {
  for (const row of rows) {
    if (row.children.length === columns.length) [...row.children].forEach((cell, i) => { cell.dataset.label = columns[i][0].replace(/^#/, ""); });
  }
  if (!rows.length) return el("div", { class: "card empty" }, emptyText || "Nothing here yet.");
  return el("div", { class: "table-wrap fixed-wrap" }, sortable(el("table", { class: "fixed-table" },
    el("colgroup", {}, columns.map(([, width]) => { const col = el("col"); if (width) col.style.width = width; return col; })),
    el("thead", {}, el("tr", {}, columns.map(([h]) => el("th", { class: h.startsWith("#") ? "num" : "" }, h.replace(/^#/, ""))))),
    el("tbody", {}, rows))));
}

function modalityHead(name, count) {
  return el("h2", { class: `section-head modality-head ${name.toLowerCase()}` }, name, el("span", { class: "modality-count" }, count));
}

function historyRing(counts={}, href, label="") {
  const pass=counts.pass||0,warn=counts.warn||0,fail=counts.fail||0,total=pass+warn+fail;
  const p=total?pass/total*100:0,w=total?(pass+warn)/total*100:0;
  const percent=total&&pass===total?100:Math.min(99,Number(p.toPrecision(2)));
  const description=`${label?label+" · ":""}History, all dates: ${pass} pass, ${warn} warning, ${fail} fail. ${counts.recorded||0} unanswered or unjudged results excluded.`;
  return el('a',{href,class:'history-rate',title:description,'aria-label':description},
    el('span',{class:'trend-pass-donut',style:total?`background:conic-gradient(var(--pass) 0% ${p}%,var(--warn) ${p}% ${w}%,var(--fail) ${w}% 100%)`:'background:var(--border)'},el('span',{class:'trend-pass-value'},total?`${percent}%`:'—')));
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
      const header = el("tr", { class: "machine-row" }, el("td", { colspan: 4 }, el("strong", {}, machine.name), machine.kind ? el("span", { class: "muted small" }, ` · ${machine.kind}`) : null));
      if (!machine.queues.length) return [header, el("tr", {}, el("td", { class: "muted indent", colspan: 4 }, "Nothing scheduled."))];
      const lists = [...machine.queues].sort((a, b) => (FREQ_ORDER[a.frequency] ?? 9) - (FREQ_ORDER[b.frequency] ?? 9) || a.queue_name.localeCompare(b.queue_name));
      return [header, ...lists.map((q) => {
        const last = q.last_run;
        // A small green start button in front of the list name opens the list.
        const go = can("perform") ? el("a", { class: "start-dot", href: `#/perform/${q.id}`, title: `Start ${q.queue_name}`, "aria-label": `Start ${q.queue_name}` }, "▶") : null;
        return el("tr", { class: q.state === "overdue" ? "row-overdue" : "" },
          el("td", { class: "list-cell indent" }, go, el("span", { class: "list-name" }, q.queue_name, el("div", { class: "muted small" }, q.schedule))),
          el("td", {class:"qa-schedule-status"}, chip(q.state, scheduleStatus({ ...q, active: 1 }))),
          el("td", {}, last ? [chip(last.overall), " ", el("a", { class: "small", href: `#/runs/${last.id}` }, shortDate(last.qa_date))] : el("span", { class: "muted small" }, "No runs yet")),
          el('td',{class:'center'},historyRing(q.history_counts,`#/trends?machine_id=${machine.id}&list=${q.id}`)));
      })];
    });
    app.append(modalityHead(modality, `${machines.length} ${machines.length === 1 ? "machine" : "machines"}`),
      fixedTable([["QA list", "40%"], ["Status", "24%"], ["Last result", "24%"], ["History", "12%"]], rows));
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
    editable ? [el("a", { class: "button primary", href: "#/queues/new" }, "New QA Template List"),
      el("button", { onclick: () => modal("Add machine", machineForm(), async (data) => {
        const machine = await api("POST", "/api/machines", data);
        toast("Machine added. Choose the QA lists it runs.");
        location.hash = `#/machines/${machine.id}`;
      }, "Add machine") }, "Add machine")] : []);
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
  // Archived templates are kept in their own restorable section.
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
  const scheduleAction = async (a, action, data = {}) => {
    try {
      const result = await api("POST", `/api/assignments/${a.id}/${action}`, data);
      toast(action === "reevaluate" ? `Re-evaluated ${result.runs} runs; ${result.changed} results changed.` : "Machine schedule updated");
      route();
    } catch (err) { toast(err.message, true); }
  };
  const duplicateSchedule = (a, q, m) => modal(`Duplicate ${q.name} for ${m.name}`,
    el("div", {}, el("p", { class: "muted" }, "Creates a separate list with this machine's included tests and tolerances. The copy starts inactive."),
      field("New list name", el("input", { name: "name", required: true, value: `${q.name} – ${m.name} (copy)` }))),
    async (data) => {
      await api("POST", `/api/assignments/${a.id}/duplicate`, data);
      toast("Copy created and set inactive"); route();
    }, "Duplicate");

  app.append(el("h2", { class: "section-head" }, "QA Template Lists"),
    el("p", { class: "muted small" }, "Edit shared tests here. Each machine keeps its own exceptions and tolerances."));
  const editPencil = (q) => iconBtn("✎", editable ? "Edit tests" : "View tests", () => (location.hash = `#/queues/${q.id}`));
  const templateRow = (q) => el("tr", {},
    el("td", {}, el("div", { class: "name-with-edit" }, editPencil(q), editable ? moreMenu([
      ["Edit", () => (location.hash = `#/queues/${q.id}`)],
      ["Schedule on machines", () => scheduleDialog(q, machines, schedules)],
      ["Duplicate", () => copyDialog(q), "Make a separate list under a new name"],
      ["Re-evaluate", reevaluate(q), "Re-judge every recorded result against the current limits (logged)"],
      ["Archive", () => archiveList(q, true), "Hide this template and its scheduled lists; keep results and machine settings"],
      ["Delete", () => deleteList(q), "Delete only if it has no results"],
    ]) : null, editableName(q, editable))),
    el("td", {}, schedulesOf(q).length
      ? el("div", { class: "sched-chips" }, schedulesOf(q).sort((a, b) => String(machineOf(a).name).localeCompare(String(machineOf(b).name))).map((a) =>
        el("a", { class: `sched-chip${a.active ? "" : " off"}`, href: `#/machines/${a.machine_id}`, title: `${a.schedule}${a.active ? "" : " · inactive"}` },
          machineOf(a).name, a.active ? null : " (Inactive)")))
      : el("span", { class: "muted small" }, "Not scheduled")),
    el("td", { class: "center" }, q.item_count),

    );
  const templateModalities = (q) => {
    const assigned = [...new Set(schedulesOf(q).map((a) => machines.find((m) => m.id === a.machine_id)).filter(Boolean).map((m) => modalityOf(m.kind)))];
    if (assigned.length) return assigned;
    // Unscheduled departmental templates still belong with their modality.
    const name = q.name.toLowerCase();
    if (/proton|sphinx|eyeline|tg.?224/.test(name)) return ["Proton"];
    if (/hdr|flexitron|brachy/.test(name)) return ["Brachytherapy"];
    if (/simulator|\bct\b|big.?bore|\bmri\b|tg.?66/.test(name)) return ["Simulation"];
    if (/truebeam|linac|ethos|synergy|tg.?142|tg.?198/.test(name)) return ["Photon"];
    return ["Unassigned"];
  };
  const templateSections = el("div");
  const sortedTemplates = lists.slice().sort((a, b) => String(b.modified_at || '').localeCompare(String(a.modified_at || '')) || (b.modified_order || 0) - (a.modified_order || 0) || a.name.localeCompare(b.name));
  for (const modality of [...MODALITIES, "Unassigned"]) {
    const group = sortedTemplates.filter((q) => templateModalities(q).includes(modality));
    if (!group.length) continue;
    const listTable = fixedTable([["QA Template List", "52%"], ["Scheduled On", "38%"], ["Tests", "10%"]], group.map(templateRow), "No QA template lists.");
    templateSections.append(el("section", { class: "template-modality", "aria-label": `${modality} QA Template Lists` },
      el("h3", { class: "section-head" }, modality), listTable));
  }
  const templateSearch = el("input", { type: "search", class: "filter-box", placeholder: "Search QA Template Lists", "aria-label": "Search QA Template Lists", oninput: (e) => {
    const words = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const section of templateSections.children) {
      let visible = 0;
      for (const row of section.querySelectorAll("tbody tr")) {
        row.hidden = !words.every((word) => `${section.getAttribute("aria-label")} ${row.textContent}`.toLowerCase().includes(word));
        if (!row.hidden) visible++;
      }
      section.hidden = !visible;
    }
  } });
  app.append(el("div", { class: "filter-row" }, templateSearch), templateSections);
  if (!queues.length) templateSections.append(el("p", { class: "muted" }, "No QA template lists yet. Make one with New QA list."));

  const archivedTemplates = queues.filter((q) => !q.active);
  if (archivedTemplates.length) app.append(el("details", { class: "archived" },
    el("summary", {}, `Archived templates (${archivedTemplates.length})`),
    el("p", { class: "muted small" }, "Archived templates are hidden from active QA. Results and each machine's settings are kept."),
    table(["QA Template List", "Tests", ""], archivedTemplates.sort((a, b) => a.name.localeCompare(b.name)).map((q) => el("tr", {},
      el("td", {}, el("a", { href: `#/queues/${q.id}` }, q.name)), el("td", { class: "num" }, q.item_count),
      el("td", {}, editable ? el("button", { type: "button", onclick: () => archiveList(q, false) }, "Restore") : null))))));

  // Each machine's schedules: which of the lists it runs, how often, and any values of its own.
  const KIND_ORDER = ["Proton gantry", "Proton eyeline", "Linac", "CT simulator", "MRI simulator", "HDR brachytherapy"];
  const kindRankOf = (m) => { const i = KIND_ORDER.indexOf(m.kind); return i < 0 ? KIND_ORDER.length : i; };
  app.append(el("h2", { class: "section-head" }, "Machine Schedules"),
    el("p", { class: "muted small" }, "Manage each machine's QA here. Use the three-dot menu for machine-specific actions."));
  const scheduleRows = machines.filter((m) => schedules.some((a) => a.machine_id === m.id && !a.archived && lists.some((q) => q.id === a.queue_id)))
    .sort((x, y) => kindRankOf(x) - kindRankOf(y) || x.name.localeCompare(y.name)).flatMap((m) => {
      const mine = schedules.filter((a) => a.machine_id === m.id && !a.archived).map((a) => ({ a, q: lists.find((q) => q.id === a.queue_id) })).filter((x) => x.q)
        .sort((x, y) => (y.a.active - x.a.active) || (FREQ_ORDER[x.a.frequency] ?? 9) - (FREQ_ORDER[y.a.frequency] ?? 9) || x.q.name.localeCompare(y.q.name));
      return [el("tr", { class: "machine-row" }, el("td", { colspan: 4 }, el("a", { class: "machine-link", href: `#/machines/${m.id}`, title: "Schedules, import folders and details for this machine" },
        el("strong", {}, m.name)), m.kind ? el("span", { class: "muted small" }, ` · ${m.kind}`) : null)),
      ...mine.map(({ a, q }) => el("tr", { class: a.active ? "" : "muted" },
        el("td", { class: "indent" }, el("div", { class: "name-with-edit" },
          editable ? iconBtn("✎", `Edit schedule for ${q.name} on ${m.name}`, () => modal(`${m.name}: ${q.name} schedule`, scheduleForm(a), async (data, form) => {
            await api("PUT", `/api/assignments/${a.id}`, scheduleData(data, form));
            toast("Machine schedule saved"); route();
          }, "Save schedule")) : null,
          editable ? moreMenu([
            [a.active ? "Set Inactive" : "Set Active", () => setActive(a, !a.active)],
            ["Set tolerances for this machine", () => (location.hash = `#/assignments/${a.id}/limits`)],
            ["Duplicate", () => duplicateSchedule(a, q, m)],
            ["Re-evaluate", () => { if (confirm(`Re-evaluate recorded results for "${q.name}" on ${m.name} using its current tolerances? This updates stored results and is logged.`)) scheduleAction(a, "reevaluate"); }],
            ["Archive", () => scheduleAction(a, "archive", { archived: true }), "Archive only this machine's schedule"],
            ["Delete", () => { if (confirm(`Delete "${q.name}" from ${m.name}? The shared template stays. Schedules with recorded results must be archived instead.`)) scheduleAction(a, "delete"); }, "Remove only this machine's schedule; available only without results"],
          ]) : null,
          el("span", {}, el("strong", { title: "Shared tests are edited under QA Template Lists" }, q.name),
            a.active ? el("span", { class: "active-tag" }, " (Active)") : el("span", { class: "inactive-tag" }, " (Inactive)")))),
        el("td", { class: "small" }, el("span", {}, a.schedule)),
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
    "No lists scheduled yet. Use Schedule on machines in a template's three-dot menu.");
  scheduleTable.classList.add("machine-schedules-table");
  app.append(filterBox(scheduleTable, "Search machine schedules"), scheduleTable);
  const archivedSchedules = schedules.filter((a) => a.archived);
  if (archivedSchedules.length) app.append(el("details", { class: "archived" },
    el("summary", {}, `Archived machine schedules (${archivedSchedules.length})`),
    table(["Machine", "QA List", ""], archivedSchedules.map((a) => el("tr", {},
      el("td", {}, machineOf(a).name), el("td", {}, a.queue_name),
      el("td", {}, editable ? el("button", { onclick: () => scheduleAction(a, "archive", { archived: false }) }, "Restore") : null))))));


  app.append(el("h2", { class: "section-head" }, "More"), el("p", { class: "row" },
    el("a", { class: "button small", href: "#/machines" }, "Manage machines"),
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

async function deleteMachine(machine) {
  if (!confirm(`Delete ${machine.name} and its schedules? Shared QA templates stay. Machines with recorded results must be retired instead.`)) return;
  try { await api("POST", `/api/machines/${machine.id}/delete`, {}); toast("Machine deleted"); location.hash = "#/machines"; route(); }
  catch (err) { toast(err.message, true); }
}
async function retireMachine(machine) {
  try { await api("PUT", `/api/machines/${machine.id}`, { ...machine, active: !machine.active }); toast(machine.active ? "Machine retired; history preserved" : "Machine restored"); route(); }
  catch (err) { toast(err.message, true); }
}

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
          }) }, "Edit machine"),
          el("button", { class: "small", onclick: () => retireMachine(machine) }, machine.active ? "Retire" : "Restore"),
          el("button", { class: "small danger", onclick: () => deleteMachine(machine) }, "Delete")) : null));
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
      window.dispatchEvent(new CustomEvent("import-folder-changed", { detail: a.id }));
      toast("Folder remembered. Scanning new files…");
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
function autoReadLine(assignmentId, onPick, dateInput, previewBuilder=null) {
  const line=el('div',{class:'muted small auto-read'},'Checking the import folder…');
  const loaded=new Set(), previews=new Map();let busy=false;
  const scan=async()=>{
    if(busy || !line.isConnected)return;busy=true;
    const selectedDate=dateInput.value;
    try {
      const r=await api('GET',`/api/assignments/${assignmentId}/files`);
      if(r.permission && r.permission!=='granted') {
        line.replaceChildren(el('span',{},r.permission==='none'?'Choose an import folder in the schedule.':'Folder access needs permission. '),r.permission==='none'?null:el('button',{onclick:async()=>{await window.localFolders.request(assignmentId);scan();}},'Allow access'));return;
      }
      let problems=[];
      for(const file of r.files.filter(f=>!f.run_id)) {
        const key=selectedDate+'|'+file.path+'|'+file.modified+'|'+file.size;
        if(loaded.has(key))return;
        try {
          const cacheKey=file.path+'|'+file.modified+'|'+file.size;
          let cached=previews.get(cacheKey);
          if(!cached){const upload=await api('GET',`/api/assignments/${assignmentId}/file?path=${encodeURIComponent(file.path)}`);const preview=previewBuilder?await previewBuilder(upload):await api('POST',`/api/assignments/${assignmentId}/sphinx/preview`,{file:upload});cached={upload,preview};if(previews.size>=200)previews.clear();previews.set(cacheKey,cached);}
          const {upload,preview}=cached;
          if(dateInput.value!==selectedDate || !line.isConnected)return;
          if(preview.qa_date!==selectedDate || !preview.matched.length || preview.duplicate_run)continue;
          const applied=await onPick(upload,preview,true);
          loaded.add(key);
          line.textContent=applied ? `Filled from ${file.name} for ${selectedDate}. No upload needed.` : `Report ready: ${file.name}. Existing measurements were kept.`;
          return;
        } catch(err){problems.push(file.name+': '+err.message);}
      }
      line.textContent=`No matching unrecorded report for ${selectedDate}. This folder is checked automatically.`;
      if(problems.length)line.append(el('details',{},el('summary',{},'Files that could not be read'),problems.map(t=>el('div',{},t))));
    }catch(err){line.textContent=err.message;}finally{busy=false;}
  };
  dateInput.addEventListener('change',()=>{loaded.clear();scan();});
  const timer=setInterval(()=>{if(!line.isConnected)clearInterval(timer);else scan();},30000);
  setTimeout(scan,0);
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
    actions.push(el("button", { onclick: () => retireMachine(machine) }, machine.active ? "Retire machine" : "Restore machine"),
      el("button", { class: "danger", onclick: () => deleteMachine(machine) }, "Delete machine"));
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
function infoDisclosure(content,label='Test information',open=false) {
  return el('details',{class:'qa-info',open},el('summary',{title:label,'aria-label':label},el('span',{'aria-hidden':'true'},'i')),el('div',{class:'qa-info-content'},content));
}

function infoPopup(content,label='Calculation details') {
  return el('button',{type:'button',class:'qa-calculation-info',title:label,'aria-label':label,onclick:()=>{
    const dialog=el('dialog',{class:'calculation-dialog'},el('h2',{},label),content,el('button',{type:'button',onclick:()=>dialog.close()},'Close'));
    dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  }},'ⓘ');
}
function performDirections(item){return QADerived.read(item.description)||/\[calc:/.test(item.description||'')?null:helpText(item.description,{inline:true});}

function helpText(description, { inline = false } = {}) {
  description=(description||'').replace(/(?:^|\n)\s*Source:[^\n]*/g,'');
  if (!description || description.startsWith("Measured by Sphinx")) return null;
  const text = description.replace(TEMPLATE_NUMBER, "").replace(SECTION_NAME, "").replace(MARKER, "").replace(DEFAULT_MARK, "").replace(/\[(?:choices|excel|rule|derived): [^\]]+\]\s*/g, "").trim();
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
function derivedExplanation(item,items,numbers) {
  const rule=QADerived.read(item.description);
  if(rule){
    const refs=rule.inputs.map((source,i)=>{const input=items.find(t=>t.name===source.name&&(t.category||'')===source.category);const n=input&&(numbers.get(input.test_id)||checkNumber(input.description));return {letter:String.fromCharCode(65+i),number:n||'?',name:source.name};});
    const equation=rule.formula.replace(/\b[A-Z]\b/g,letter=>`[${refs.find(r=>r.letter===letter)?.number||'?'}]`);
    return el('div',{class:'derived-explanation'},el('div',{},el('strong',{},'Calculated: '),equation),el('div',{class:'derived-input-reference'},refs.map(r=>`${r.letter} = Test ${r.number} · ${r.name}`).join('; ')));
  }
  if(/\[calc: workbook\]/.test(item.description||'')&&window.QAExcel){
    const key=QAExcel.keyOf(item),split=key?.lastIndexOf('!');if(!key||split<0)return null;
    const sheet=key.slice(0,split),cell=key.slice(split+1),formula=QAExcel.data().model[sheet]?.[cell]?.f;
    if(!formula)return null;
    const refs=items.filter(t=>{const k=QAExcel.keyOf(t);return k&&k.startsWith(sheet+'!')&&new RegExp('\\b'+k.slice(sheet.length+1)+'\\b').test(formula);});
    return el('div',{class:'derived-explanation'},el('div',{},el('strong',{},'Excel equation: '),formula),el('div',{class:'derived-input-reference'},refs.map(t=>`Test ${numbers.get(t.test_id)||checkNumber(t.description)||'?'} · ${t.name}`).join('; ')));
  }
  return null;
}

function wireCalculations(entries) {
  const byName = (re) => entries.find((e) => re.test(e.item.name));
  const num = (e) => (e && e.input.value.trim() !== "" ? Number(QADerived.value(e.input)) : NaN);
  const lock = (e, title) => { e.input.readOnly = true; e.input.classList.add("from-file"); e.input.placeholder = "calculated"; e.input.title = title; };
  const set = (e, v, decimals) => { QADerived.setInput(e.input,Number.isFinite(v)?v:null); e.input.dispatchEvent(new Event("input")); };
  entries.forEach((e, i) => {
    if (e.item.type === "text" && !e.input.value && !/\[auto: performer\]/.test(e.item.description || "")) {
      const d = DEFAULT_MARK.exec(e.item.description || "");
      const start = e.item.last_text || (d && d[1].trim());
      if (start) { e.input.value = start; e.input.title = e.item.last_text ? "As recorded last time; change it if different" : "Usual value; change it if different"; }
    }
    const derivedRule=QADerived.read(e.item.description);
    if(derivedRule){
      let sources;
      try{sources=QADerived.resolve(derivedRule,entries.slice(0,i).map(x=>x.item)).map(item=>entries.find(x=>x.item===item));}
      catch(err){lock(e,err.message);e.input.value='';e.input.setCustomValidity(err.message);return;}
      lock(e,derivedRule.inputs.map((x,n)=>`${String.fromCharCode(65+n)} = ${x.name}`).join('; ')+'; '+derivedRule.formula);
      const update=()=>{try{const value=QADerived.calculate(derivedRule,entries.slice(0,i).map(x=>x.item),item=>QADerived.value(entries.find(x=>x.item===item).input));QADerived.setInput(e.input,value);e.input.setCustomValidity('');e.input.dispatchEvent(new Event('input'));}catch(err){QADerived.setInput(e.input,null);e.input.setCustomValidity(err.message);}};
      sources.forEach(src=>src.input.addEventListener('input',update));update();return;
    }
    const hdrKinds = {
      'Dwell time — difference':'hdr-dwell-difference',
      'Source air kerma strength — difference':'hdr-strength-difference',
      'Position verification — console minus ruler':'hdr-position-difference'
    };
    const hdrKind = e.item.category === 'HDR treatment-day QA' ? hdrKinds[e.item.name] : null;
    const m = MARKER.exec(e.item.description || "") || (hdrKind ? [null,'calc',hdrKind] : null);
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
    if (kind.startsWith('hdr-')) {
      const names=kind==='hdr-dwell-difference'?['Dwell time — set time','Dwell time — measured time']:kind==='hdr-strength-difference'?['Source air kerma strength — TCS Sk','Source air kerma strength — decay table Sk']:kind==='hdr-position-difference'?['Position verification — console distance','Position verification — ruler reading']:[];
      sources=names.map(name=>entries.find(x=>x.item.name===name&&x.item.category===e.item.category));
      if(sources.length!==2||sources.some(x=>!x))return;
      compute=([a,b])=>kind==='hdr-position-difference'?a-b:kind==='hdr-dwell-difference'?(a===0?NaN:100*(a-b)/a):(b===0?NaN:100*(a-b)/b);
      e.input.title=kind==='hdr-position-difference'?'Console distance − ruler reading (mm)':kind==='hdr-dwell-difference'?'100 × (set time − measured time) / set time':'100 × (TCS Sk − decay table Sk) / decay table Sk';
    } else if (kind.startsWith("sum")) {                              // "[calc: sum:3]": the sum of the N numeric fields above
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
    lock(e, e.input.title || "Calculated from the fields it depends on");
    const update = () => { const v = sources.map(num); set(e, v.some((x) => !Number.isFinite(x)) ? NaN : compute(v), decimals); };
    sources.forEach((src) => src.input.addEventListener("input", update));
    if(kind.startsWith('hdr-')) update();
  });
}

async function renderPerform(assignmentId) {
  const t = await api("GET", `/api/assignments/${assignmentId}/template`);
  if (t.queue.active === 0) {
    page(t.queue.name, "This template is archived.", [el("a", { class: "button", href: "#/setup" }, "Back to Setup QA")]);
    return;
  }
  const history = t.items.some((i) => i.type === "numeric") ? await api("GET", `/api/machines/${t.machine.id}/trends`).catch(() => ({})) : {};
  page(`${t.machine.name} · ${t.queue.name}`, t.assignment.schedule);
  app.querySelector(".page-head").classList.add("sticky-head");        // the machine and list stay in view while scrolling
  if (t.queue.description) {
    app.append(el("details", { class: "card instructions", open: !matchMedia("(max-width: 760px)").matches }, el("summary", {}, el("strong", {}, "Protocol")), el("div", { class: "pre" }, t.queue.description)));
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
      else if (item.type==='choice') control=input=select('', [['','Choose an answer…'],...choiceOptions(item.description).map(c=>[c,c])], '', {'aria-label':item.name,class:'result-input'});
      else control = input = el("input", { type: "text", class: "text-input", "aria-label": item.name });
      const comment = el("input", { type: "text", placeholder: "Note", class: "note-input", hidden: true, "aria-label": `${item.name} note` });
      const noteToggle = el("button", { type: "button", class: "link small", onclick: () => { comment.hidden = false; noteToggle.hidden = true; comment.focus(); } }, "+ note");
      const note = el("div", { class: "muted small" });
      const statusCell = el("div", { class: "status-cell" });
      const entry = {
        item, input, comment, note, required: item.type !== "text",
        status() {
          const raw = QADerived.value(input).trim();
          if (!raw) return null;
          if (item.type === "numeric") return Number.isFinite(Number(raw)) ? evaluate("numeric", Number(raw), item.limits) : null;
          return evaluate(item.type, raw, item.limits);
        },
      };
      const update = () => {
        if(input.readOnly&&input.dataset.derivedValue!==undefined) QADerived.setInput(input,input.dataset.derivedValue===''?null:Number(input.dataset.derivedValue));
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
        if (l.criterion === "wl-max-delta") return el("div", {class:"small"}, "PASS < 1 mm · FAIL ≥ 1 mm");
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
        noteToggle.textContent = "+"; noteToggle.title = "Add comment"; noteToggle.setAttribute("aria-label", `Add comment for ${it.name}`); noteToggle.className = "icon-btn note-btn";   // the note box appears on demand
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
        const showDelta = () => { const v = Number(QADerived.value(control)); dlt.replaceChildren(...present([control.value.trim() !== "" ? deltaBadge(v, it.limits, unit) : null])); };
        control.addEventListener("input", showDelta);
        const row = el("tr", {},
          numberCell(it),
          el("td", { class: "qa-label" }, firstCell(it), firstHeader === "Test" ? limitsLine(it, unit) : null, derivedExplanation(it,t.items,numbers)?infoPopup(derivedExplanation(it,t.items,numbers),'Calculation details'):null, note),
          el("td", { class: "qa-unit", "data-label":"Unit" }, it.type === "numeric" ? unit : it.type === "boolean" ? (it.unit === "Yes/No" ? "Yes / No" : "Pass / Fail") : ""),
          el("td", { class: "num qa-baseline", "data-label":"Baseline" }, it.type === "numeric" ? refCell(it, unit) : it.type === "boolean" ? "Pass" : el("span", { class: "muted" }, "—")),
          el("td", { class: "qa-measured" }, control),
          el("td", { class: "qa-dev" }, dlt),
          el("td", {class:"qa-result", "data-label":"Result"}, statusCell),
          el("td", { class: "qa-comment" }, noteToggle, comment),
          el("td", { class: "history-cell" }, dates.length ? histChips(it, unit) : el("span", { class: "muted small" }, "—")),
          el("td", {}, trend));
        const extras = el('td', {class:'qa-phone-extras', colspan:10});
        row.append(extras);
        const secondary = [row.children[5], row.children[7], row.children[8], row.children[9]];
        secondary.forEach((cell,index) => {
          cell.classList.add('qa-secondary');
          const field = el('div', {class:'qa-phone-field'}, el('strong', {class:'small muted'}, ['Deviation','Comment','History','Trends'][index]));
          const content = el('div', {class:'qa-phone-field-content'});
          while (cell.firstChild) content.append(cell.firstChild);
          field.append(content);
          cell.append(field);
        });
        phoneDrawer(extras, secondary.map(cell=>cell.firstChild), 'Comment, history & trends');
        return [row, chart];
      });
      const widths = ["100px", "auto", "100px", "150px", "190px", "150px", "130px", "130px", "160px", "100px"];
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
          firstCell: (it) => [el("strong", {}, shortName(it)), performDirections(it)] }));
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
            performDirections(m.calc || m.axes[0])),
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
        title: el("div", { class: "measure-title" }, el("strong", {}, mp0.metricLabel), performDirections(item)),
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
  window.QAExcel?.wire(inputs);
  const qaDate = el("input", { type: "date", value: today(), max: today(), "aria-label": "QA date" });
  const runComment = el("textarea", { placeholder: "Anything the reviewer should know" });
  let sourceRef = null;
  const sphinxInfo = el("div", { class: "small" });
  const applySphinx = async (preview = null, automatic = false) => {
    const p = preview || await api("POST", `/api/assignments/${assignmentId}/sphinx/preview`, { file: state.sphinxFile });
    if (automatic && p.matched.some(m=>inputs.find(e=>e.item.test_id===m.test_id)?.input.value.trim())) return false;
    sourceRef = p.source_ref;
    if (!automatic) qaDate.value = p.qa_date;
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
      entry.note.replaceChildren(m.limits_differ ? `File limits: ${limitsText(m.file_limits, entry.item.unit)}` : "");
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
    return true;
  };
  const sphinxFile = el("input", { type: "file", accept: ".xls,.csv,.pdf", "aria-label": "Measurement file" });
  sphinxFile.addEventListener("change", async () => {
    if (!sphinxFile.files[0]) return;
    await useUpload(await readFileBase64(sphinxFile.files[0]));
  });
  const hdrPreview=async upload=>{
    if(!/\.pdf$/i.test(upload.name))throw Error('Choose an HDR Daily QA PDF.');
    const bytes=Uint8Array.from(atob(upload.data),c=>c.charCodeAt(0));
    const parsed=await QAHdrDaily.parse(bytes,upload.name,message=>sphinxInfo.textContent=message);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const ref='hdrpdf:'+digest;
    const matched=t.items.filter(i=>Object.hasOwn(parsed.values,i.name)&&!QADerived.read(i.description)).map(i=>({test_id:i.test_id,name:i.name,type:i.type,value:parsed.values[i.name],unit:i.unit}));
    if(!matched.length)throw Error('No readable measurements match this HDR list.');
    const runs=await api('GET','/api/runs?limit=400');
    return {...parsed,hdr:true,matched,source_ref:ref,duplicate_run:runs.find(r=>r.source_ref===ref)?.id||null};
  };
  const reviewHdr=async(upload,preview,automatic)=>{
    const p=preview?.hdr?preview:await hdrPreview(upload);
    if(p.duplicate_run)throw Error('This HDR PDF was already submitted.');
    const date=el('input',{type:'date',value:p.qa_date,max:today(),'aria-label':'HDR report QA date',required:true});
    const warnings=p.unread_checkboxes?el('p',{class:'muted'},`${p.unread_checkboxes} checkbox(es) could not be identified clearly and will stay unanswered.`):null;
    const show=()=>modal('Review HDR Daily QA PDF',el('div',{},el('p',{},'Review these recognized values before filling the form.'),field('QA date',date),warnings,table(['Test','Recognized value'],p.matched.map(m=>el('tr',{},el('td',{},m.name),el('td',{},m.type==='boolean'?(m.value?'Pass':'Fail'):`${m.value} ${m.unit||''}`))))),async()=>{
      if(!date.value||date.value>today())throw Error('Choose a valid QA date.');
      for(const m of p.matched){const e=inputs.find(x=>x.item.test_id===m.test_id);if(automatic&&e.input.value.trim())continue;e.input.value=m.type==='boolean'?(m.value?'pass':'fail'):String(m.value);e.input.dispatchEvent(new Event('input'));}
      qaDate.value=date.value;qaDate.dispatchEvent(new Event('change'));sourceRef=p.source_ref;
      sphinxInfo.textContent=`Filled ${p.matched.length} values from ${upload.name}. Review the results, then submit.`;
      toast('HDR Daily QA values filled');
    },'Fill recognized values');
    if(automatic){sphinxInfo.replaceChildren(el('span',{},`HDR report ready: ${upload.name}. `),el('button',{type:'button',onclick:show},'Review PDF values'));return false;}
    show();return true;
  };
  const useUpload = async (upload, preview = null, automatic = false) => {
    try {
      if(QAHdrDaily.supported(t))return await reviewHdr(upload,preview,automatic);
      if(/\.pdf$/i.test(upload.name)&&!t.items.some(i=>(i.description||'').includes('[rule: wl-max-delta]')))throw Error('This QA list does not use a Winston–Lutz PDF. Choose a file supported by this list.');
      state.sphinxFile = upload;
      return await applySphinx(preview, automatic);
    } catch (err) {
      sphinxInfo.replaceChildren(el("span", { class: "error" }, err.message));
    }
  };
  const autoLine = t.assignment.import_folder ? el("div") : null;
  if (window.QAExcel?.supported(t)) app.append(monthlyWorkbookTools(t, inputs, qaDate));
  const fileCard = el("div", { class: "card step" }, el("strong", {}, "Measurement file"),
    el("span", { class: "muted small" }, QAHdrDaily.supported(t)?" Import the HDR Daily QA PDF and review its values.":" Import a supported measurement file to fill in matching results."),
    autoLine, el("div", {}, sphinxFile), sphinxInfo);
  if (!t.items.length) {
    app.append(el("div", { class: "card empty" }, "This QA list contains 0 tests. You can submit it for review.",
      can("configure") ? el("a", { href: `#/queues/${t.queue.id}` }, " Add tests") : null));
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
      const results = inputs.map((i) => ({ test_id: i.item.test_id, value: QADerived.value(i.input).trim(), comment: i.comment.value }));
      autosaveStopped = true;
      clearTimeout(autosaveTimer);
      await draftWrites;
      const result = await api("POST", `/api/assignments/${assignmentId}/runs`, { qa_date: qaDate.value, comment: runComment.value, results, source_ref: sourceRef });
      await api("POST", `/api/assignments/${assignmentId}/draft/clear`, {}).catch(() => {});
      try { await downloadQaReport(result.id); }
      catch (err) { toast("QA completed. PDF could not download; use Download PDF report on the saved run.", true); }
      toast(`Submitted. Overall: ${capitalize(result.overall)}`);
      location.hash = `#/runs/${result.id}`;
    } catch (err) {
      autosaveStopped = false;
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  } }, "Submit for review");
  app.append(el("details", { class: "card" }, el("summary", {}, "Notes for the reviewer"), runComment), error);
  // Save keeps what has been entered so far (per user and list) without submitting; it is restored when the page is opened again.
  const draftNote = el("span", { class: "muted small" });
  let autosaveTimer, autosaveStopped = false;
  let draftWrites = Promise.resolve();
  const persistDraft = () => {
    if (autosaveStopped) return draftWrites;
    const data = { qa_date: qaDate.value, comment: runComment.value,
      results: inputs.map((i) => ({ test_id: i.item.test_id, value: QADerived.value(i.input), comment: i.comment.value })) };
    draftNote.textContent = "Saving…";
    draftWrites = draftWrites.catch(() => {}).then(async () => {
      const saved = await api("PUT", `/api/assignments/${assignmentId}/draft`, data);
      draftNote.textContent = `Saved ${saved.saved_at.slice(11, 19)}`;
    }).catch((err) => { draftNote.textContent = "Not saved - use Save draft"; toast(err.message, true); });
    return draftWrites;
  };
  const queueAutosave = () => {
    if (autosaveStopped) return;
    clearTimeout(autosaveTimer);
    draftNote.textContent = "Unsaved changes";
    autosaveTimer = setTimeout(persistDraft, 600);
  };
  const saveDraft = el("button", { type: "button", onclick: async () => {
    clearTimeout(autosaveTimer);
    saveDraft.disabled = true;
    await persistDraft();
    saveDraft.disabled = false;
  } }, "Save draft");
  const footer = el("div", { class: "submit-bar" }, el("label", { class: "inline" }, "QA date ", qaDate), progress, overallChip,
    el("div", { class: "spacer" }), draftNote, el("a", { class: "button", href: "#/perform-qa" }, "Cancel"), saveDraft, submit);
  app.append(footer);
  phoneDrawer(footer, [footer.children[0], draftNote, footer.children[5], saveDraft], 'Date & draft options');
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
  for (const control of [...inputs.flatMap((i) => [i.input, i.comment]), qaDate, runComment]) {
    control.addEventListener("input", queueAutosave);
    control.addEventListener("change", queueAutosave);
  }
  if (autoLine) autoLine.append(autoReadLine(assignmentId,useUpload,qaDate,QAHdrDaily.supported(t)?hdrPreview:null));
  // Programmatic imports also persist their filled measurements.
  if (state.applySphinxOnLoad && state.sphinxFile) {
    state.applySphinxOnLoad = false;
    await applySphinx();
  }
}

function importSphinxDialog(a) {
  const files = el("input", { type: "file", accept: ".xls,.csv", multiple: true });
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
        el("input", { type: "checkbox", name: "machines", value: String(m.id), checked: on.has(m.id), disabled: !!existing.get(m.id)?.archived }), m.name,
        existing.get(m.id)?.archived ? el("span", { class: "muted small" }, " (archived — restore in Setup QA)") : on.has(m.id) ? el("span", { class: "muted small" }, " (scheduled)") : null))), "wide")),
    el("div", { class: "schedule-part" }, scheduleForm(null)));
  modal(`Schedule ${list.name}`, body, async (data, form) => {
    const choices = [...body.querySelectorAll("[name=machines]")];
    const schedule = scheduleData(data, form);
    for (const control of choices) {
      if (control.disabled) continue;
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
    can("configure") ? [el("a", { class: "button primary", href: "#/queues/new" }, "New QA Template List")] : []);
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

const TEMPLATE_IMPORT_COLUMNS = {
  name: ['test', 'test name', 'qa test', 'qa check', 'check', 'parameter', 'name', 'metric'],
  category: ['category', 'section', 'group'], unit: ['unit', 'units'],
  expected: ['baseline', 'expected', 'expected/ref', 'reference', 'reference value', 'nominal'],
  warn: ['warning', 'warn', 'warning limit', 'default warning'],
  fail: ['action', 'fail', 'error', 'action limit', 'default action'],
  description: ['instructions', 'directions', 'description', 'procedure'],
  type: ['type', 'test type', 'result type'], tol_mode: ['mode', 'limit mode', 'limits are'],
};
function templateImportNumber(value) {
  if (value === '' || value == null) return null;
  const text = String(value).trim().replace(/^(?:±|\+\/-)\s*/, '').replace(/%$/, '').trim();
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}
function templateImportMapping(rows) {
  let best = { row: 0, map: {}, score: -1 };
  rows.slice(0, 50).forEach((row, index) => {
    const map = {};
    row.forEach((cell, col) => {
      const text = String(cell || '').toLowerCase().replace(/\s+/g, ' ').trim();
      for (const [key, names] of Object.entries(TEMPLATE_IMPORT_COLUMNS)) if (names.includes(text) && map[key] === undefined) map[key] = col;
    });
    const score = (map.name !== undefined ? 10 : 0) + Object.keys(map).length;
    if (score > best.score) best = { row: index, map, score };
  });
  return best;
}
function templateTestsFromRows(rows, headerRow, map) {
  if (map.name === undefined || map.name === '') return [];
  const tests = [];
  for (const row of rows.slice(headerRow + 1)) {
    const get = (key) => map[key] === undefined || map[key] === '' ? '' : String(row[Number(map[key])] ?? '').trim();
    const name = get('name'); if (!name) continue;
    const limits = { expected: templateImportNumber(get('expected')), warn: templateImportNumber(get('warn')), fail: templateImportNumber(get('fail')) };
    const rawType = get('type').toLowerCase();
    const types = { numeric: 'numeric', number: 'numeric', boolean: 'boolean', 'pass/fail': 'boolean', 'yes/no': 'boolean', status: 'status', 'pass/warning/action': 'status', text: 'text' };
    const type = types[rawType] || (Object.values(limits).some((n) => n !== null) ? 'numeric' : 'text');
    let description = get('description');
    for (const key of ['expected','warn','fail']) if (get(key) && limits[key] === null) description += `\nSource ${key}: ${get(key)}`;
    const unit = get('unit'), mode = get('tol_mode').toLowerCase();
    const tol_mode = mode === 'percent' || mode === '%' || (!mode && unit !== '%' && /%/.test(get('warn') + get('fail'))) ? 'percent' : 'absolute';
    tests.push({ name, category: get('category'), type, unit, description: description.trim(), ...limits, tol_mode, included: true });
  }
  return tests;
}
function templateTestsFromNumberedRows(rows) {
  const out = []; let current = null, header = null;
  const finish = () => {
    if (!current || current.section === 0) return;
    if (!current.tests.length) out.push({ name: current.name, category: current.category, type: current.functional ? 'boolean' : 'text', description: current.notes.join('\n'), included: true });
    else out.push(...current.tests);
  };
  for (const row of rows) {
    const first = String(row[0] || '').trim(), title = /^(\d+)\.(\d{2})[:.]?\s+(.+)$/.exec(first);
    if (title) { finish(); current = { section: Number(title[1]), name: title[3], category: '', notes: [`Template ${title[1]}.${title[2]}.`], tests: [], functional: false }; header = null; continue; }
    if (!current || !first) continue;
    const found = templateImportMapping([row]);
    if (found.map.name !== undefined && (found.map.expected !== undefined || found.map.warn !== undefined || found.map.fail !== undefined)) { header = found.map; continue; }
    if (header) {
      const parsed = templateTestsFromRows([[], row], 0, header)[0];
      if (parsed) current.tests.push({ ...parsed, name: `${current.name} – ${parsed.name}`, category: current.category, description: current.notes.join('\n') });
    } else if (/^(functional|pass\s*\/\s*fail|yes\s*\/\s*no)$/i.test(first)) current.functional = true;
    else if (/acceptance criteria/i.test(first)) continue;
    else if (!current.category) current.category = first;
    else current.notes.push(first);
  }
  finish(); return out;
}
async function renderNewTemplate() {
  if (!can('configure')) throw new Error('Only a physicist or admin can create templates.');
  const starters = await api('GET', '/api/template-starters');
  page('New QA Template List', 'Start with a departmental template, import a checklist, or build your own.');
  let checks = [], workbook = null, fileName = '', mapping = {}, headerRow = 0, busy = false;
  const name = el('input', { name: 'template_name', required: true, placeholder: 'e.g. Monthly QA – Proton gantry', 'aria-label': 'Template name' });
  const error = el('p', { class: 'error', role: 'alert' });
  const preview = el('div'), importedControls = el('div'), sourceInfo = el('p', { class: 'muted small' });
  const createButton = el('button', { class: 'primary', type: 'button', disabled: true, onclick: async () => {
    if (busy) return;
    busy = true; createButton.disabled = true; error.textContent = '';
    try {
      if (!name.value.trim()) throw new Error('Give the template a name.');
      const selected = checks.filter((t) => t.included);
      if (source.value === 'import' && !selected.length) throw new Error('Choose a workbook and include at least one test.');
      const data = { name: name.value.trim(), source: fileName || 'blank', tests: selected.map(({ included, ...test }) => test) };
      if (source.value.startsWith('starter:')) data.starter = starters[Number(source.value.slice(8))].name;
      const result = await api('POST', '/api/templates', data);
      toast(`Template created with ${result.tests} tests`); location.hash = `#/queues/${result.id}`;
    } catch (err) { error.textContent = err.message; }
    finally { busy = false; createButton.disabled = !source.value; }
  } }, 'Create template');
  const drawPreview = () => {
    if (!checks.length) { preview.replaceChildren(el('p', { class: 'muted small' }, source.value === 'blank' ? 'Create the template, then add your tests.' : 'No tests detected. Choose another sheet or adjust the Test column.')); return; }
    const count = el('p', { class: 'muted small', role: 'status' }, `${checks.filter((t) => t.included).length} of ${checks.length} tests included. Review before creating; limits are never filled by guesswork.`);
    const rows = checks.map((t) => el('tr', {},
      el('td', {}, el('input', { type: 'checkbox', checked: t.included, disabled: source.value !== 'import', 'aria-label': `Include ${t.name}`, onchange: (e) => { t.included = e.target.checked; count.textContent = `${checks.filter((x) => x.included).length} of ${checks.length} tests included.`; } })),
      el('td', {}, t.name, t.category ? el('div', { class: 'muted small' }, t.category) : null),
      el('td', {}, source.value === 'import' ? select('', [['numeric','Numeric'],['boolean','Yes / No'],['status','Pass / Warning / Action'],['text','Text']], t.type, { 'aria-label': `Type for ${t.name}`, onchange: (e) => { t.type = e.target.value; } }) : QADerived.read(t.description)?'Derived':/\[calc: workbook\]/.test(t.description||'')?'Derived (Excel)':TYPE_LABELS[t.type]),
      el('td', {}, t.unit || '—'), el('td', {}, t.expected ?? '—'), el('td', {}, t.warn ?? '—'), el('td', {}, t.fail ?? '—')));
    preview.replaceChildren(count, table(['Include', 'Test', 'Type', 'Unit', 'Baseline', 'Default Warning', 'Default Action'], rows));
  };
  let sheetRows = [];
  const refreshImport = () => { checks = templateTestsFromRows(sheetRows, headerRow, mapping).slice(0, 500); drawPreview(); };
  const sheet = el('select', { 'aria-label': 'Worksheet', onchange: () => loadSheet() });
  const loadSheet = () => {
    sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet.value], { header: 1, raw: false, defval: '' });
    const detected = templateImportMapping(sheetRows);
    headerRow = detected.row; mapping = detected.map;
    const numbered = sheetRows.some((r) => /^\d+\.\d{2}[:.]?\s+/.test(String(r[0] || ''))) ? templateTestsFromNumberedRows(sheetRows) : [];
    const columns = Math.max(0, ...sheetRows.slice(0, 50).map((r) => r.length));
    const mapArea = el('details', {}, el('summary', {}, 'Adjust columns'));
    const updateMapping = () => {
      const labels = sheetRows[headerRow] || [];
      const fields = Object.keys(TEMPLATE_IMPORT_COLUMNS).map((key) => field(key === 'name' ? 'Test column' : key === 'fail' ? 'Action column' : key === 'warn' ? 'Warning column' : key,
        select('', [['','Not used'], ...Array.from({ length: columns }, (_, i) => [String(i), String(labels[i] || XLSX.utils.encode_col(i))])], mapping[key] === undefined ? '' : String(mapping[key]), { 'aria-label': `Import ${key} column`, onchange: (e) => { if (e.target.value === '') delete mapping[key]; else mapping[key] = Number(e.target.value); refreshImport(); } })));
      mapArea.replaceChildren(el('summary', {}, 'Adjust columns'), field('Header row', el('input', { type: 'number', min: 1, max: sheetRows.length, value: headerRow + 1, 'aria-label': 'Header row', onchange: (e) => { headerRow = Math.max(0, Number(e.target.value) - 1); mapping = templateImportMapping([sheetRows[headerRow] || []]).map; updateMapping(); refreshImport(); } })), el('div', { class: 'form-grid' }, fields));
    };
    updateMapping(); importedControls.replaceChildren(field('Worksheet', sheet), mapArea);
    checks = numbered.length ? numbered.slice(0, 500) : templateTestsFromRows(sheetRows, headerRow, mapping).slice(0, 500);
    sourceInfo.textContent = 'Review detected tests below. Text criteria are kept as instructions; a number is used as a limit only when its column explicitly identifies it.';
    drawPreview();
  };
  const file = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', 'aria-label': 'Excel or MyQA checklist', onchange: async () => {
    if (!file.files.length) return;
    error.textContent = '';
    try {
      if (file.files[0].size > 15 * 1024 * 1024) throw new Error('Choose a workbook smaller than 15 MB.');
      if (!window.XLSX) throw new Error('Spreadsheet reader is unavailable. Reload the page.');
      fileName = file.files[0].name; workbook = XLSX.read(await file.files[0].arrayBuffer(), { type: 'array' });
      sheet.replaceChildren(...workbook.SheetNames.map((s) => el('option', { value: s }, s)));
      sheet.value = workbook.SheetNames.includes('WithFullDetails') ? 'WithFullDetails' : workbook.SheetNames[0];
      if (!name.value.trim()) name.value = fileName.replace(/\.[^.]+$/, '');
      loadSheet();
    } catch (err) { workbook = null; checks = []; preview.replaceChildren(); error.textContent = `Could not read this checklist: ${err.message}`; }
  } });
  const upload = el('div', { hidden: true }, field('Excel / MyQA checklist', file), el('p', { class: 'muted small' }, 'Supports .xlsx, .xls and .csv. For MyQA PLD templates, use an Excel checklist export.'), importedControls);
  const source = select('template_source', [['','Choose a starting point…'],['blank','Blank template'], ...starters.map((t,i) => [`starter:${i}`, /big.?bore|ct sim/i.test(t.name) ? `CT simulation / TG-66 — ${t.name}` : t.name]), ['import','Import Excel / MyQA checklist…']], '', { 'aria-label': 'Template starting point', onchange: () => {
    error.textContent = ''; checks = []; upload.hidden = source.value !== 'import'; createButton.disabled = !source.value;
    if (source.value.startsWith('starter:')) {
      const starter = starters[Number(source.value.slice(8))];
      checks = starter.checks.map((t) => ({ ...t, included: true }));
      if (!name.value.trim()) name.value = `${starter.name} (new)`;
      sourceInfo.textContent = 'Existing departmental starter: review its tests and limits for your procedure before use.';
    } else sourceInfo.textContent = source.value === 'blank' ? 'A blank shared template. Add tests after creating it.' : '';
    preview.replaceChildren(); if (source.value !== 'import') drawPreview(); else if (workbook) loadSheet();
  } });
  app.append(el('div', { class: 'card form-grid' }, field('Template name', name, 'wide'), field('Start from', source, 'wide')), upload, sourceInfo, preview, error,
    el('div', { class: 'row template-save-bar' }, el('a', { class: 'button', href: '#/setup' }, 'Cancel'), createButton));
}

function machineTestDifferences(test,item,override={},selection={},base=true) {
  const differences=[];
  if((selection.excluded||[]).includes(item.test_id))differences.push({label:'Test inclusion',default:'Included',machine:'Excluded'});
  if(!base||(selection.added||[]).includes(item.test_id))differences.push({label:'Test inclusion',default:'Not in template',machine:'Machine-only test'});
  const blank=v=>v===null||v===undefined||v==='';
  for(const [key,label] of [['expected','Baseline'],['warn','Warning'],['fail','Action'],['tol_mode','Tolerance mode']]){
    const own=override[key];if(blank(own))continue;
    const original=!blank(item[key])?item[key]:test[key]??(key==='tol_mode'?'absolute':null);
    if(key==='tol_mode'?own===(original||'absolute'):!blank(original)&&Number(own)===Number(original))continue;
    differences.push({label,default:blank(original)?'Not set':String(original),machine:String(own)});
  }
  return differences;
}

async function renderQueueEditor(id) {
  const isNew = id === "new";
  if (isNew) return renderNewTemplate();
  const [tests, queue, machines] = await Promise.all([api("GET", "/api/tests"), isNew ? null : api("GET", `/api/queues/${id}`), api("GET", "/api/machines")]);
  const q = queue || { name: "", description: "", active: 1, is_template: 0, items: [] };
  const editable = can("configure");
  const where = (q.schedules || []).map((s) => `${s.machine}${s.active ? "" : " (inactive)"}`).join(", ");
  page(isNew ? "New QA Template List" : q.name, isNew ? "" : where ? `Scheduled on ${where}. This is the list each of them performs and trends; an edit here applies to all of them.`
    : "Not scheduled on a machine yet.",
    !isNew && editable ? [el("button", { onclick: () => scheduleDialog(q, machines, null) }, "Schedule on machines"), el("button", { onclick: () => copyDialog(q) }, "Duplicate")] : []);
  stickyHead();
  const info = el("form", { class: "card" }, el("div", { class: "form-grid" },
    field("Name", el("input", { name: "name", value: q.name, required: true, disabled: !editable, placeholder: "e.g. Daily QA template" })),
    field("Setup instructions (shown when performing)", el("textarea", { name: "description", disabled: !editable }, q.description), "wide"),
    el("input", { type: "hidden", name: "active", value: q.active ? "1" : "0" })));
  app.append(info);

  const testUpdates = new Map();
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
  const machineSelections = {};
  await Promise.all((q.schedules||[]).map(async schedule=>{
    const template=await api('GET',`/api/assignments/${schedule.id}/template`);
    machineValues[schedule.id]=Object.fromEntries((template.all_items||template.items).map(i=>[i.test_id,{...(i.override||{})}]));
    machineSelections[schedule.id]=template.test_selection||{};
  }));
  const machineName = (aid) => ((q.schedules || []).find((x) => String(x.id) === String(aid)) || {}).machine || "";
  const valuesPick = (q.schedules || []).length ? el("div", { class: "row", role: "radiogroup", "aria-label": "Tests and limits for" },
    [["", "Default template"], ...q.schedules.map((x) => [String(x.id), x.machine])].map(([value, label]) =>
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
              machineValues[value] = Object.fromEntries((template.all_items || template.items).map((i) => [i.test_id, { ...(i.override || {}) }]));
              machineSelections[value] = template.test_selection || {};
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
  const customizationNote = el("p", { class: "muted small", role: "status" });
  const reloadMachine = async () => {
    const template = await api("GET", `/api/assignments/${valuesFor}/template`);
    machineSelections[valuesFor] = template.test_selection || {};
    machineValues[valuesFor] = Object.fromEntries((template.all_items || template.items).map((i) => [i.test_id, { ...(i.override || {}) }]));
    draw();
  };
  const customizeButton = el("button", { type: "button", hidden: true, onclick: () => {
    if (dirty) { toast("Save your changes before customizing tests.", true); return; }
    const selection = machineSelections[valuesFor] || {};
    const baseIds = new Set(items.map((i) => i.test_id));
    const checked = new Set([...baseIds].filter((tid) => !(selection.excluded || []).includes(tid)).concat(selection.added || []));
    const candidates = tests.filter((t) => t.active && (!t.owner_queue_id || String(t.owner_queue_id) === String(id)));
    const rows = candidates.filter((t) => baseIds.has(t.id) || checked.has(t.id)).map((t) =>
      el("label", { class: "check" }, el("input", { type: "checkbox", value: String(t.id), checked: checked.has(t.id), onchange: (e) => {
        if (e.target.checked) checked.add(t.id); else checked.delete(t.id);
      } }), t.name, el("span", { class: "muted small" }, baseIds.has(t.id) ? "Template" : `${machineName(valuesFor)} only`)));
    const rowsBox = el("div", { class: "machine-test-choices" }, rows);
    const add = select("extra_test", [["", "Add an existing test…"], ...candidates.filter((t) => !baseIds.has(t.id) && !checked.has(t.id)).map((t) => [t.id, t.name])], "", {
      onchange: (e) => {
        if (!e.target.value) return;
        const tid = Number(e.target.value), t = byId[tid]; checked.add(tid);
        rowsBox.append(el("label", { class: "check" }, el("input", { type: "checkbox", value: String(tid), checked: true, onchange: (e) => { if (e.target.checked) checked.add(tid); else checked.delete(tid); } }), t.name, el("span", { class: "muted small" }, `${machineName(valuesFor)} only`)));
        e.target.selectedOptions[0].disabled = true; e.target.value = "";
      },
    });
    modal(`Tests for ${machineName(valuesFor)}`, el("div", {},
      el("p", { class: "muted" }, "Checked tests are included for this machine. Unchecking a template test affects only this machine."),
      el("input", { type: "search", placeholder: "Find a test…", "aria-label": "Find tests to include", oninput: (e) => {
        const query = e.target.value.toLowerCase();
        [...rowsBox.children].forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
      } }), rowsBox, add,
      el("button", { type: "button", onclick: () => { checked.clear(); baseIds.forEach((tid) => checked.add(tid)); rowsBox.querySelectorAll("input").forEach((control) => { control.checked = baseIds.has(Number(control.value)); }); } }, "Reset to template")), async () => {
      await api("PUT", `/api/assignments/${valuesFor}/tests`, { excluded: [...baseIds].filter((tid) => !checked.has(tid)), added: [...checked].filter((tid) => !baseIds.has(tid)) });
      await reloadMachine(); toast("Machine tests saved");
    }, "Save machine tests");
  } }, "Customize tests");
  const differenceFlags=(test,item,base=true)=>{
    const schedules=(q.schedules||[]).filter(x=>!valuesFor||String(x.id)===String(valuesFor));
    return schedules.flatMap(schedule=>{
      const differences=machineTestDifferences(test,item,machineValues[schedule.id]?.[item.test_id]||{},machineSelections[schedule.id]||{},base);
      if(!differences.length)return [];
      return [el('details',{class:'test-machine-difference'},el('summary',{'aria-label':`${schedule.machine}: differs from default`},`${schedule.machine} · differs`),el('div',{class:'test-difference-content'},...differences.map(d=>el('div',{},el('strong',{},`${d.label}: `),`Default ${d.default} → ${schedule.machine} ${d.machine}`))))];
    });
  };
  const draw = () => {
    const selection = machineSelections[valuesFor] || {};
    const baseIds = new Set(items.map((i) => i.test_id));
    const extras = valuesFor ? (selection.added || []).filter((tid) => !baseIds.has(tid) && byId[tid]).map((test_id) => ({ test_id })) : [];
    const scopedItems = valuesFor ? [...items.filter((i) => !(selection.excluded || []).includes(i.test_id)), ...extras] : items;
    customizationNote.textContent = valuesFor ? `${machineName(valuesFor)}: ${(selection.excluded || []).filter((tid) => baseIds.has(tid)).length} excluded · ${extras.length} machine-only tests. Other tests stay synced.` : "Highlighted gantry labels show tests that differ from the default. Open a label to see each change.";
    customizeButton.hidden = !valuesFor || !editable;
    // Laid out like the myQA sheet: a heading per section, then each numbered item with its directions.
    const sectionCats = new Map();
    for (const it of scopedItems) { const t = byId[it.test_id]; const n = sectionNumber(t); if (!sectionCats.has(n)) sectionCats.set(n, []); sectionCats.get(n).push(t.category); }
    let lastSection = null;
    const numbers = blockNumbers(scopedItems.map((i) => ({ ...byId[i.test_id], test_id: i.test_id })));
    const axisFamilies = new Map();
    scopedItems.forEach((item, index) => {
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
    scopedItems.forEach((item, index) => {
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
    searchCount.textContent = `${matches.length} of ${scopedItems.length} tests`;
    body.replaceChildren(...matches.flatMap(({ item, index, axis }) => {
      if (!valuesFor) index = items.indexOf(item);
      const t = byId[item.test_id];
      const numeric = t.type === "numeric" || t.type === "derived";
      const editDefinition = (field, value) => {
        t[field] = value;
        testUpdates.set(t.id, { ...(testUpdates.get(t.id) || {}), [field]: value });
        markDirty();
      };
      const own = valuesFor ? (machineValues[valuesFor][item.test_id] = machineValues[valuesFor][item.test_id] || {}) : null;
      const target = own || item;            // what the inputs edit: this machine's own values, or the list's default
      const fallback = (name) => (own ? (item[name] ?? t[name]) : t[name]);
      const input = (name, props) => el("input", { type: "number", step: "any", value: target[name] ?? "", placeholder: fmt(fallback(name)), disabled: !editable || !numeric,
        class: own && target[name] !== undefined && target[name] !== null && target[name] !== "" ? "own-value" : null,
        title: own ? `${machineName(valuesFor)} only. Blank uses the default (${fmt(fallback(name))}).` : null,
        onchange:()=>draw(), oninput: (e) => { target[name] = e.target.value; e.target.classList.toggle("own-value", !!own && e.target.value !== ""); }, ...(props || {}) });
      const m = changed[item.test_id] || {};
      const shortName = t.category && t.name.startsWith(t.category + " – ") ? t.name.slice(t.category.length + 3) : t.name;
      const tolUnit = ((own && own.tol_mode) || item.tol_mode || t.tol_mode) === "percent" ? "%" : t.unit;
      const n = sectionNumber(t);
      const head = n !== lastSection ? el("tr", { class: "section-row" }, el("td", { colspan: 6 }, sectionTitle(n, sectionCats.get(n), sectionNameOf(t)))) : null;
      const family = familyOf.get(item.test_id);
      const firstInFamily = family && family[0].item === item;
      const lastInFamily = family && family[family.length - 1].item === item;
      const groupHead = firstInFamily ? el("tr", { class: "group" }, el("td", { colspan: 6 }, el("strong", {}, `${numbers.get(item.test_id)}: ${axis.base}`))) : null;
      const directions = family
        ? (lastInFamily ? [...new Set(family.map((x) => (byId[x.item.test_id].description || "").replace(TEMPLATE_NUMBER, "").replace(SECTION_NAME, "").replace(MARKER, "").replace(DEFAULT_MARK, "").replace(/\[(?:choices|excel|rule|derived): [^\]]+\]\s*/g, "").trim()).filter(Boolean))].map((text) => helpText(text)) : "")
        : helpText(t.description);
      const dirRow = directions ? el("tr", { class: "directions-row", ...dragProps(index) }, el("td", { colspan: 6 }, directions)) : null;
      lastSection = n;
      const number = numbers.get(item.test_id);
      const derivedRow=editable&&!valuesFor&&QADerived.read(t.description)?el('tr',{class:'derived-definition-row'},el('td',{colspan:6},QADerived.read(t.description)?derivedEditor(QADerived.read(t.description),items.slice(0,index).map(x=>byId[x.test_id]),rule=>{t.description=(t.description||'').replace(/\s*\[derived: [^\]]+\]/g,'')+' [derived: '+encodeURIComponent(JSON.stringify(rule))+']';testUpdates.set(t.id,{...(testUpdates.get(t.id)||{}),type:'derived',derived:rule});markDirty();}):null)):null;
      return [head, groupHead, el("tr", { class: `compact${family ? " grouped-axis-row" : ""}${dirRow ? " before-directions" : ""}`, ...dragProps(index), draggable: editable && !valuesFor ? "true" : null },
        el("td", { class: "item-cell" }, el("div", { class: "name-with-edit" },
          editable ? el("span", { class: "drag-handle", title: "Drag to reorder" }, "⠿") : null,
          editable ? el("button", { class: "icon-btn", title: "Edit test", onclick: () => modal(`Edit ${t.name}`, el("div", {}, testForm(t,items.slice(0,index).map(x=>byId[x.test_id])), m.modified_at ? el("p", { class: "small muted" }, `Last Modified: ${m.modified_at.slice(0, 16).replace("T", " ")}${m.modified_by ? " · " + m.modified_by : ""}`) : null), async (data) => {
            await api("PUT", `/api/tests/${t.id}`, { ...data, owner_queue_id: t.owner_queue_id });
            toast("Test saved");
            route();
          }) }, "✎") : null,
          editable && !valuesFor ? el("div", { class: "inline-test-name" }, number ? el("strong", {}, `${number}:`) : null,
            el("textarea", { rows: 2, value: t.name, "aria-label": `Test name: ${t.id}`, oninput: e => editDefinition('name', e.target.value) }))
            : el("strong", {}, family ? "" : number ? `${number}: ` : "", family ? axis.axis : shortName), valuesFor && !baseIds.has(item.test_id) ? el("span", { class: "muted small" }, `${machineName(valuesFor)} only`) : null, differenceFlags(t,item,baseIds.has(item.test_id)))),
        el("td", {}, editable && !valuesFor ? el("input", { value: t.category || '', "aria-label": `Category: ${t.id}`, list: 'template-category-options', oninput: e => editDefinition('category', e.target.value) }) : categoryLabel(t.category) || el("span", { class: "muted" }, "—")),
        el("td", {}, editable && !valuesFor ? el('div', {}, select('', [...Object.entries(TYPE_LABELS),...(/\[calc: workbook\]/.test(t.description||'')?[["workbook","Derived (Excel)"]]:[])], QADerived.read(t.description)?'derived':/\[calc: workbook\]/.test(t.description||'')?'workbook':t.type, { "aria-label": `Result type: ${t.id}`, onchange: e => { if(e.target.value==='workbook')return; if(e.target.value==='derived'){t.type='numeric';const rule=defaultDerivedRule(items.slice(0,index).map(x=>byId[x.test_id]));t.description=QADerived.encode(t.description,null)+' [derived: '+encodeURIComponent(JSON.stringify(rule))+']';testUpdates.set(t.id,{...(testUpdates.get(t.id)||{}),type:'derived',derived:rule});markDirty();}else{t.description=QADerived.encode(t.description,null);editDefinition('type',e.target.value);testUpdates.set(t.id,{...(testUpdates.get(t.id)||{}),derived:null});}draw(); } }), t.type==='choice'?el('textarea',{rows:4,'aria-label':`Answer options: ${t.id}`,placeholder:'One answer per line',oninput:e=>editDefinition('choices',e.target.value)},(testUpdates.get(t.id)?.choices ?? choiceOptions(t.description).join('\n'))):null) : TYPE_LABELS[t.type]),
        el("td", {}, numeric ? el("div", { class: "row nowrap" }, input("expected"), t.unit && t.unit !== "unitless" ? el("span", { class: "muted small" }, t.unit) : null)
          : el("span", { class: "muted" }, t.type === "boolean" ? "Pass" : TYPE_LABELS[t.type])),
        el("td", {}, numeric ? el("div", { class: "tol-cell" },
          el("label", { class: "inline small" }, valuesFor ? "Warning ±" : "Default Warning ±", input("warn", { min: 0 }), tolUnit ? el("span", { class: "muted" }, tolUnit) : null),
          el("label", { class: "inline small" }, valuesFor ? "Action ±" : "Default Action ±", input("fail", { min: 0 }), tolUnit ? el("span", { class: "muted" }, tolUnit) : null),
          select("", [["absolute", "Absolute"], ["percent", "Percent"]], target.tol_mode || (own ? item.tol_mode : null) || t.tol_mode || "absolute",
            { disabled: !editable, onchange: (e) => { target.tol_mode = e.target.value; draw(); } })) : el("span", { class: "muted" }, "—")),
        el("td", {}, editable && !valuesFor ? el("div", { class: "row nowrap" },
          el("button", { class: "icon-btn", title: "Move up", disabled: index === 0, onclick: () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; unsaved.hidden = false; draw(); } }, "↑"),
          el("button", { class: "icon-btn", title: "Move down", disabled: index === items.length - 1, onclick: () => { [items[index + 1], items[index]] = [items[index], items[index + 1]]; unsaved.hidden = false; draw(); } }, "↓"),
          el("button", { class: "icon-btn danger", title: "Remove", onclick: () => { items.splice(index, 1); draw(); } }, "✕")) : null)), derivedRow, dirRow];
    }).filter(Boolean));
    if(valuesFor){
      for(const tid of selection.excluded||[]){const test=byId[tid],item=items.find(x=>x.test_id===tid);if(!test||!item)continue;if(searchTerm&&!`${test.name} ${test.category||''}`.toLowerCase().includes(searchTerm))continue;
        body.append(el('tr',{class:'machine-only-difference-row'},el('td',{colspan:6},el('strong',{},test.name),' ',el('span',{class:'test-machine-only-label'},`${machineName(valuesFor)} · excluded`),el('span',{class:'muted small'},' · Included in the default template. Use Customize tests to include it.'))));
      }
    }
    if(!valuesFor){
      const extraIds=[...new Set(Object.values(machineSelections).flatMap(x=>x.added||[]))].filter(tid=>!baseIds.has(tid)&&byId[tid]);
      for(const tid of extraIds){const test=byId[tid];if(searchTerm&&!`${test.name} ${test.category||''}`.toLowerCase().includes(searchTerm))continue;
        const flags=(q.schedules||[]).filter(a=>(machineSelections[a.id]?.added||[]).includes(tid)).map(a=>el('span',{class:'test-machine-only-label'},`${a.machine} only`));
        body.append(el('tr',{class:'machine-only-difference-row'},el('td',{colspan:6},el('strong',{},test.name),' ',flags,el('span',{class:'muted small'},' · Not in the default template'))));
      }
    }
    if (!matches.length && items.length) body.append(el("tr", {}, el("td", { colspan: 6, class: "muted" }, "No matching tests. Clear the search to see all tests.")));
    holder.replaceChildren(scopedItems.length ? el("div", { class: "table-wrap" }, el("table", { class: "list-editor" },
      el("thead", {}, el("tr", {}, ["Test Name", "Category", "Result Type", valuesFor ? `Baseline · ${machineName(valuesFor)}` : "Baseline",
        valuesFor ? `Warning / Action · ${machineName(valuesFor)}` : "Default Warning / Default Action", ""].map((h) => el("th", {}, h)))), body))
      : el("div", { class: "card empty" }, valuesFor ? "No tests included for this machine. Use Customize tests to include tests." : "No tests in this list yet."));
    if (saveBtn) saveBtn.textContent = valuesFor ? `Save ${machineName(valuesFor)} limits` : "Save template";
    holder.classList.toggle("machine-mode", !!valuesFor);
    // Only this list's own tests (or shared library tests) can be added here.
    picker.replaceChildren(el("option", { value: "" }, "Add an existing test…"),
      ...tests.filter((t) => t.active && (!t.owner_queue_id || String(t.owner_queue_id) === id) && !scopedItems.some((i) => i.test_id === t.id))
        .map((t) => el("option", { value: t.id }, testLabel(t))));
  };
  const picker = el("select", { onchange: async (e) => {
    if (!e.target.value) return;
    const tid = Number(e.target.value);
    if (valuesFor) {
      if (dirty) { toast("Save your changes before adding a machine test.", true); return; }
      try {
        const selection = machineSelections[valuesFor] || {};
        await api("PUT", `/api/assignments/${valuesFor}/tests`, { excluded: selection.excluded || [], added: [...(selection.added || []), tid] });
        await reloadMachine();
      } catch (err) { toast(err.message, true); }
    } else { items.push({ test_id: tid }); markDirty(); draw(); }
  } });
  // Drag and drop: drag a test row (by its handle) onto another test to move it there; Save keeps the new order.
  let dragFrom = null;
  const unsaved = el("span", { class: "chip due", hidden: true, role: "status" }, "Unsaved changes");
  info.addEventListener("input", markDirty);
  holder.addEventListener("input", markDirty);
  holder.addEventListener("change", markDirty);
  holder.addEventListener("click", (e) => { if (e.target.closest("button")) markDirty(); });

  function dragProps(index) {
    if (!editable || valuesFor) return {};
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
    valuesPick ? el("div", { title: "Default limits apply to all machines. Select a machine to specify its limits." }, valuesPick) : null, customizeButton), customizationNote, holder);
  const search = el("input", { type: "search", placeholder: "Find a test, category or instruction…", "aria-label": "Find tests", oninput: (e) => { searchTerm = e.target.value.trim().toLowerCase(); draw(); } });
  holder.before(el("div", { class: "row template-search" }, search, el("button", { type: "button", onclick: () => { search.value = ""; searchTerm = ""; draw(); search.focus(); } }, "Clear"), searchCount),
    el("p", { class: "muted small" }, "Default limits apply to all machines. Select a machine above to set its own limits; blank fields use the defaults."));
  if (editable) {
    const newCheck = el("button", { disabled: isNew, title: isNew ? "Save the list first" : "", onclick: () => { if (valuesFor && dirty) { toast("Save your limits before adding a test.", true); return; } modal("New test for this list", testForm(null,items.map(x=>byId[x.test_id])), async (data) => {
      const r = await api("POST", "/api/tests", { ...data, owner_queue_id: Number(id) });
      if (valuesFor) {
        const refreshed = await api("GET", "/api/tests");
        const created = refreshed.find((t) => t.id === r.id); tests.push(created); byId[r.id] = created;
        const selection = machineSelections[valuesFor] || {};
        await api("PUT", `/api/assignments/${valuesFor}/tests`, { excluded: selection.excluded || [], added: [...(selection.added || []), r.id] });
        await reloadMachine();
        toast(`${machineName(valuesFor)}-only test added`);
      } else {
        items.push({ test_id: r.id });
        await save();
      }
    }); } }, "New test");
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
      const payload = { ...formData(info), items, test_updates: [...testUpdates].map(([test_id, fields]) => ({ test_id, ...fields })) };
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
  app.append(el('datalist', { id: 'template-category-options' }, [...new Set(tests.map(t => t.category).filter(Boolean))].sort().map(category => el('option', { value: category }))));
  draw();
}

function choiceOptions(description) {
  const m=/\[choices: ([^\]]+)\]/.exec(description||'');
  try{return m?JSON.parse(decodeURIComponent(m[1])):[];}catch{return [];}
}
function defaultDerivedRule(prior=[]) {
  const temperature=prior.find(t=>t.type==='numeric'&&/chamber temperature|air temperature|temperature \[/i.test(t.name));
  const pressure=prior.find(t=>t.type==='numeric'&&/air pressure|pressure \[/i.test(t.name));
  const inputs=temperature&&pressure?[temperature,pressure].map(t=>({name:t.name,category:t.category||''})):[];
  return {inputs,formula:`(273.15 + A) / 295.15 * ${pressure&&/hpa/i.test(pressure.unit||'')?'1013.25':'101.325'} / B`};
}

function derivedPresetFormula(preset,count,pressureUnit='kPa') {
  const letters=Array.from({length:count},(_,i)=>String.fromCharCode(65+i));
  if(preset==='ptp')return `(273.15 + A) / 295.15 * ${/hpa/i.test(pressureUnit)?'1013.25':'101.325'} / B`;
  if(!letters.length)throw Error('Add at least one input.');
  const squares=letters.map(x=>`${x} * ${x}`).join(' + ');
  if(preset==='rms')return `sqrt((${squares}) / ${letters.length})`;
  if(preset==='rss')return `sqrt(${squares})`;
  if(preset==='mean')return `mean(${letters.join(', ')})`;
  throw Error('Choose an equation preset.');
}

function derivedEditor(rule,prior,onChange,formMode=false) {
  rule=rule||defaultDerivedRule(prior);
  const numeric=prior.length?prior.filter(t=>t.type==='numeric'):rule.inputs.map(x=>({...x,type:'numeric'}));
  const inputNumbers=blockNumbers(prior.map(t=>({...t,test_id:t.test_id||t.id})));
  const inputLabel=t=>{const n=inputNumbers.get(t.test_id||t.id)||checkNumber(t.description);return n?`Test ${n} · ${t.name}`:t.name;};
  const key=t=>JSON.stringify([t.name,t.category||'']);
  const selected=rule.inputs.map(x=>key(x));
  if(!selected.length)selected.push('','');
  const hidden=el('input',{type:'hidden',name:formMode?'derived':null,value:JSON.stringify(rule)});
  const formula=el('textarea',{'aria-label':'Derived formula',rows:4,value:rule.formula,spellcheck:false,wrap:'soft',placeholder:'Enter an equation using A, B, C…'});
  const rows=el('div',{class:'derived-variable-rows'}),status=el('p',{class:'small derived-formula-status','aria-live':'polite'});
  const update=()=>{
    rule={inputs:selected.map(k=>{const t=numeric.find(x=>key(x)===k);return {name:t?.name||'',category:t?.category||''};}),formula:formula.value};
    hidden.value=JSON.stringify(rule);
    try{if(selected.some(x=>!x))throw Error('Choose a prior test for each variable.');if(formula.value.includes('?'))throw Error('Replace ? in the equation after removing a variable.');QADerived.validate(rule);status.textContent='';}
    catch(err){status.textContent=err.message;}
    if(onChange)onChange(rule);
  };
  const draw=()=>{
    rows.replaceChildren(...selected.map((k,i)=>{
      const letter=String.fromCharCode(65+i);
      const pick=select('',[['','Choose a prior test…'],...numeric.map(t=>[key(t),inputLabel(t)])],k,{'aria-label':`Prior test for ${letter}`,onchange:e=>{selected[i]=e.target.value;update();}});
      const remove=el('button',{type:'button',class:'derived-remove',title:`Remove variable ${letter}`,'aria-label':`Remove variable ${letter}`,onclick:()=>{
        selected.splice(i,1);
        formula.value=formula.value.replace(/\b[A-Z]\b/g,l=>{const n=l.charCodeAt(0)-65;return n===i?'?':n>i?String.fromCharCode(64+n):l;});
        draw();update();
      }},'×');
      return el('div',{class:'derived-variable-row'},el('strong',{class:'derived-variable-letter'},letter),pick,remove);

    }));
    add.disabled=selected.length>=26||!numeric.length;
  };
  const add=el('button',{type:'button',class:'small',onclick:()=>{selected.push('');draw();update();rows.lastElementChild?.querySelector('select')?.focus();}},'+ Add input');
  const preset=select('',[['custom','Custom equation'],['ptp','PTP — temperature / pressure correction'],['rms','RMS — root mean square'],['rss','RSS — distance / magnitude'],['mean','Average — arithmetic mean']],rule.formula.replace(/\s/g,'')===defaultDerivedRule(prior).formula.replace(/\s/g,'')?'ptp':'custom',{'aria-label':'Equation preset'});
  const presetNote=el('p',{class:'muted small'});
  const describePreset=()=>{presetNote.textContent=({ptp:'A: temperature in °C · B: pressure. Reference: 22 °C and 101.325 kPa.',rms:'Square each selected input, average the squares, then take the square root.',rss:'Square each selected input, add the squares, then take the square root. Use this for a 3D offset.',mean:'Average all selected inputs.',custom:''})[preset.value];applyPreset.disabled=preset.value==='custom';};
  const applyPreset=el('button',{type:'button',class:'small',onclick:()=>{
    try{
      if(preset.value==='ptp'){
        const defaults=defaultDerivedRule(prior);selected.splice(0,selected.length,...(defaults.inputs.length?defaults.inputs.map(key):selected.slice(0,2)));
        while(selected.length<2)selected.push('');
      }
      const pressure=numeric.find(x=>key(x)===selected[1]);
      formula.value=derivedPresetFormula(preset.value,selected.length,pressure?.unit||'kPa');
      draw();update();formula.style.height='auto';formula.style.height=Math.max(120,formula.scrollHeight)+'px';
    }catch(err){status.textContent=err.message;}
  }},'Apply equation');
  preset.addEventListener('change',describePreset);describePreset();
  formula.addEventListener('input',()=>{preset.value='custom';describePreset();formula.style.height='auto';formula.style.height=Math.max(120,formula.scrollHeight)+'px';update();});draw();
  requestAnimationFrame(()=>{if(formula.clientWidth)formula.style.height=Math.max(120,formula.scrollHeight)+'px';});
  return el('div',{class:'derived-editor wide'},hidden,el('strong',{},'Calculation inputs'),rows,add,
    el('div',{class:'derived-formula-heading'},el('strong',{},'Equation'),infoDisclosure(el('div',{},el('p',{},'Each letter represents the prior test selected beside it. Type that letter in the equation. + Add input creates another variable; × removes it. Replace any ? left by a removed variable before saving.'),el('p',{},'Use numbers, + − * /, parentheses, sqrt(), abs(), min(), max(), or mean(). Example: 100 * (A - B) / A. Missing inputs leave the result blank.')),'Equation help')),
    el('div',{class:'derived-preset-bar'},field('Equation preset',preset),applyPreset),presetNote,formula,status);
}

function testForm(test,prior=[]) {
  const t = test || { type: "numeric", tol_mode: "absolute", active: 1 };
  const type = select("type", Object.entries(TYPE_LABELS), QADerived.read(t.description)?'derived':t.type);
  const limits = el("div", { class: "form-grid wide" },
    field("Unit", el("input", { name: "unit", value: t.unit || "", placeholder: "mm, %, cGy, °" })),
    field("Expected value", el("input", { name: "expected", type: "number", step: "any", value: t.expected ?? "" })),
    field("Default Warning ±", el("input", { name: "warn", type: "number", step: "any", min: 0, value: t.warn ?? "" })),
    field("Default Action ±", el("input", { name: "fail", type: "number", step: "any", min: 0, value: t.fail ?? "" })),
    field("Limits are", select("tol_mode", [["absolute", "Absolute (same units)"], ["percent", "Percent of expected"]], t.tol_mode)));
  const choices=field('Answer options (one per line)',el('textarea',{name:'choices',rows:5},choiceOptions(t.description).join('\n')),'wide');
  const derivedBox=derivedEditor(QADerived.read(t.description),prior,null,true);
  const sync = () => {limits.hidden=!['numeric','derived'].includes(type.value);choices.hidden=type.value!=='choice';derivedBox.hidden=type.value!=='derived';};
  type.addEventListener("change", sync);
  sync();
  return el("div", { class: "form-grid" },
    t.id ? field("QA list", el("div", { class: "muted" }, t.owner_name || (t.owner_queue_id ? "This list" : "Shared library (used by any list)")), "wide") : null,
    field("Category", el("input", { name: "category", value: t.category || "", placeholder: "e.g. Energy, Spot, Safety" })),
    field("Test name", el("input", { name: "name", value: t.name || "", required: true })),
    field("Type", type),
    choices, derivedBox, limits,
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
function canTrashQa(run) {return can('review') || can('therapist_approve') || can('perform') && run.performed_by===state.user.id && run.review_status==='pending';}
function qaTrashButton(run) {
  if(!canTrashQa(run))return null;
  return el('button',{type:'button',class:run.trashed_at?'button small':'button danger small qa-trash-icon',title:run.trashed_at?'Restore QA':'Move QA to trash','aria-label':run.trashed_at?'Restore QA':'Move QA to trash',onclick:e=>{
    e.stopPropagation();
    if(run.trashed_at){api('POST',`/api/runs/${run.id}/trash`,{trashed:false}).then(()=>{toast('QA restored');route();}).catch(err=>toast(err.message,true));return;}
    modal('Move QA to trash',el('div',{},el('p',{},`${run.machine_name} · ${run.queue_name} · ${run.qa_date}`),el('p',{class:'muted small'},'Removes this submission from review, history charts and completion counts. You can restore it from Trash.')),async()=>{await api('POST',`/api/runs/${run.id}/trash`,{trashed:true});toast('QA moved to trash');if(location.hash.startsWith('#/runs/'))location.hash='#/review';else route();},'Move to trash');
  }},run.trashed_at?'Restore':svg('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'},svg('path',{d:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'})));
}
function reviewRowActions(run) {return el('div',{class:'row qa-review-actions'},el('a',{class:'button small',href:`#/runs/${run.id}`,onclick:e=>e.stopPropagation()},run.trashed_at||can('therapist_approve')&&!can('review')?'Open':run.review_ready===false?'Open':'Review'),qaTrashButton(run));}

async function renderReview() {
  const runs = await api("GET", "/api/runs?limit=400");
  page("Review QA", can("therapist_approve")&&!can("review")?"Check submitted QA and sign your therapist review.":"Submitted QA waiting for review, then recent decisions.", [el("a", { class: "button", href: "#/runs" }, "All past results")]);
  const row = (r) => el("tr", { class: `clickable${r.review_status === "pending" ? "" : ""}`, onclick: () => (location.hash = `#/runs/${r.id}`) },
    el("td", {}, el("a", { href: `#/runs/${r.id}` }, shortDate(r.qa_date))),
    el("td", {}, el("strong", {}, r.machine_name)),
    el("td", {}, r.queue_name),
    el("td", {}, r.performer_name || r.performer || el("span", { class: "muted" }, "—")),
    el("td", {}, chip(r.overall)),
    el("td", {}, reviewChip(r)),
    el('td',{class:'center'},reviewRowActions(r)));
  const cols = [["Date", "12%"], ["Machine", "12%"], ["QA list", "28%"], ["Performed by", "16%"], ["Result", "9%"], ["Review", "13%"], ["", "10%"]];
  const pending = runs.filter((r) => r.review_status === "pending" && r.review_ready !== false);
  const therapyMode=can('therapist_approve')&&!can('review');
  const waitingTherapist=runs.filter(r=>r.review_status==='pending'&&r.therapist_approval_required&&(!r.therapist_approved_by||r.review_ready===false));
  app.append(el('h2',{class:'section-head',id:'therapy-review-queue'},`Awaiting Therapy Review (${waitingTherapist.length})`),fixedTable(cols,waitingTherapist.map(row),'You are caught up. No QA is waiting for your review.'));
  const trashed=await api('GET','/api/runs?trashed=1&limit=200');
  if(trashed.length)app.append(el('details',{class:'card qa-trash-list'},el('summary',{},`Trash (${trashed.length})`),fixedTable(cols,trashed.map(row),'Trash is empty.')));
  const decided = runs.filter((r) => r.review_status === "approved" || r.review_status === "rejected").slice(0, 25);
  app.append(el("h2", { class: "section-head modality-head", id: "physics-review-queue" }, "Awaiting Physics Review", el("span", { class: "modality-count" }, String(pending.length))),
    fixedTable(cols, pending.map(row), "Nothing is waiting for review."));
  app.append(el("h2", { class: "section-head" }, "Recently reviewed"),
    fixedTable(cols, decided.map(row), "No reviews yet."));
  const stage=queryParams().get('stage');
  if(stage==='therapy'||stage==='physics') requestAnimationFrame(()=>document.getElementById(`${stage}-review-queue`)?.scrollIntoView({block:'start'}));
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
      el("td", {}, reviewChip(r)))), "No runs match."));
}

// A self-contained PDF exporter shared by the server and browser builds.
function qaReportPdf(run) {
  const clean = (value) => String(value ?? "").replace(/Δ/g, 'Deviation').replace(/±/g, '+/-').replace(/[–—]/g, '-').replace(/°/g, ' deg').replace(/[^\x20-\x7e\n]/g, '?');
  const wrap = (value, width = 92) => clean(value).split('\n').flatMap((line) => {
    const out = [];
    while (line.length > width) { let at = line.lastIndexOf(' ', width); if (at < 1) at = width; out.push(line.slice(0, at)); line = line.slice(at).trimStart(); }
    out.push(line); return out;
  });
  const verdict = (v) => ({ pass: 'PASS', warn: 'WARNING', fail: 'ACTION' }[v] || clean(v || 'Recorded').toUpperCase());
  const lines = [run.queue_name, `Machine: ${run.machine_name} | QA date: ${run.qa_date} | Run: ${run.id}`,
    `Performed by: ${run.performer_name || run.performer || ''} | Recorded: ${run.performed_at || ''}`,
    `Overall: ${verdict(run.overall)} | Review: ${reviewStatusText(run)}`];
  if (run.therapist_approval_required) lines.push(`Therapist approval: ${run.therapist_approved_by ? `${run.therapist_approver_name || run.therapist_approved_by} | ${run.therapist_approved_at}` : 'Awaiting therapist sign-off'}`);
  if (run.reviewed_at) lines.push(`Reviewed by: ${run.reviewer_name || run.reviewer || ''} | ${run.reviewed_at}`);
  if (run.comment) lines.push(`Notes: ${run.comment}`);
  if (run.review_comment) lines.push(`Review note: ${run.review_comment}`);
  lines.push('');
  const blocks = [lines.flatMap((x) => wrap(x))];
  for (const [index, r] of (run.results || []).entries()) {
    const unit = r.unit && r.unit !== 'unitless' ? r.unit : '';
    const value = r.value_num == null && r.value_text == null ? 'Unanswered' : r.type === 'boolean' ? (r.value_num ? 'Yes' : 'No') : r.type === 'numeric' ? `${r.value_num ?? ''} ${unit}` : r.value_text || '';
    const block = [`${index + 1}. ${r.name}`, `Result: ${value} | ${verdict(r.status)}`];
    if (r.type === 'numeric') {
      const suffix = r.tol_mode === 'percent' ? '%' : unit;
      block.push(`Baseline: ${r.expected ?? 'Not set'} ${unit} | Warning: +/- ${r.warn ?? 'Not set'} ${suffix} | Action: +/- ${r.fail ?? 'Not set'} ${suffix}`);
      if (r.expected != null && r.value_num != null) block.push(`Deviation: ${Number((r.value_num - r.expected).toPrecision(7))} ${unit}`);
    }
    if (r.comment) block.push(`Comment: ${r.comment}`);
    blocks.push([...block.flatMap((x) => wrap(x)), '']);
  }
  const pages = [[]];
  for (const block of blocks) {
    if (pages.at(-1).length && pages.at(-1).length + block.length > 44) pages.push([]);
    for (const line of block) { if (pages.at(-1).length >= 44) pages.push([]); pages.at(-1).push(line); }
  }
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageIds = [];
  const escape = (s) => clean(s).replace(/([\\()])/g, '\\$1');
  pages.forEach((page, index) => {
    const pageId = objects.length, streamId = pageId + 1; pageIds.push(pageId);
    const stream = `BT /F1 15 Tf 48 750 Td (${escape('GatorQA - QA Completion Report')}) Tj ET\n` +
      page.map((line, row) => `BT /F1 10 Tf 48 ${720 - row * 14} Td (${escape(line)}) Tj ET`).join('\n') +
      `\nBT /F1 8 Tf 48 40 Td (Run ${escape(run.id)} | Page ${index + 1} of ${pages.length} | Review status: ${escape(run.review_status || 'pending')}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n', offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets.push(pdf.length); pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
function downloadWorkbookBlob(blob, date) {
  const url=URL.createObjectURL(blob), a=el('a',{href:url,download:`TrueBeam-Monthly-QA-${date}.xlsx`});a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function monthlyWorkbookTools(template, entries=null, qaDate=null) {
  const dateInput=qaDate || el('input',{type:'date',value:localIso(new Date())});
  const picker=el('input',{type:'file',accept:'.xlsx',hidden:true,'aria-label':'Upload completed monthly Excel workbook'});
  picker.addEventListener('change',async()=>{
    const file=picker.files[0];if(!file)return;
    try {
      const parsed=await QAExcel.readFile(file);
      const matched=template.items.filter(t=>Object.hasOwn(parsed.values,QAExcel.keyOf(t)));
      if(!matched.length)throw Error('No matching completed results were found in this workbook.');
      const date=el('input',{type:'date',value:dateInput.value||localIso(new Date()),required:true});
      const preview=el('div',{},el('p',{},`${matched.length} matching values in ${file.name}. Original baselines and portal limits stay unchanged.`),field('QA date',date),
        el('details',{},el('summary',{},'Preview results'),table(['Test','Value'],matched.map(t=>el('tr',{},el('td',{},t.name),el('td',{},String(parsed.values[QAExcel.keyOf(t)])))))));
      modal(entries?'Fill QA from Excel':'Import monthly QA for review',preview,async()=>{
        if(entries){for(const e of entries){const key=QAExcel.keyOf(e.item);if(!Object.hasOwn(parsed.values,key))continue;const value=parsed.values[key];e.input.value=e.item.type==='boolean'?(value==='PASS'?'pass':'fail'):String(value);e.input.dispatchEvent(new Event('input'));}qaDate.value=date.value;qaDate.dispatchEvent(new Event('change'));toast('Excel values filled. Review, then submit.');}
        else {const result=await api('POST',`/api/assignments/${template.assignment.id}/runs`,{qa_date:date.value,comment:`Imported from ${file.name}`,results:matched.map(t=>({test_id:t.test_id,value:t.type==='boolean'?parsed.values[QAExcel.keyOf(t)]==='PASS':parsed.values[QAExcel.keyOf(t)]}))});toast('Monthly Excel imported for review');location.hash=`#/runs/${result.id}`;}
      },entries?'Fill results':'Import for review');
    } catch(err){toast(err.message,true);}finally{picker.value='';}
  });
  return el('div',{class:'card row monthly-workbook-tools'},el('strong',{},'Monthly Excel'),picker,
    el('button',{type:'button',onclick:()=>picker.click()},'Upload Excel'),
    entries?el('button',{type:'button',onclick:async()=>{try{downloadWorkbookBlob(await QAExcel.exportFile(QAExcel.valuesFromEntries(entries),dateInput.value,state.user.full_name||state.user.username),dateInput.value);}catch(err){toast(err.message,true);}}},'Download Excel'):null,
    el('span',{class:'small muted'},'Keeps the original workbook layout, sheets, formulas and images.'));
}

async function downloadQaReport(id) {
  const run = await api('GET', `/api/runs/${id}`);
  const url = URL.createObjectURL(qaReportPdf(run));
  const link = document.createElement('a');
  link.href = url;
  link.download = `QA-${run.machine_name}-${run.qa_date}-run-${id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function therapistReviewCheck(test) {
  return /^qa reviewed by therapist\?$/i.test((test.name||'').trim()) || /Template 4\.06\./.test(test.description||'');
}
async function renderReviewMeasurements(run) {
  const [history,template]=await Promise.all([
    api('GET',`/api/machines/${run.machine_id}/trends`).catch(()=>({})),
    api('GET',`/api/assignments/${run.assignment_id}/template`).catch(()=>null)
  ]);
  const numbers=blockNumbers(template?.items||run.results), fallback=blockNumbers(run.results);
  const numberFor=r=>numbers.get(r.test_id)||checkNumber(r.description)||fallback.get(r.test_id)||'';
  const groups=new Map();
  for(const r of run.results){const n=sectionNumber(r),named=sectionNameOf(r);const key=`${n}|${named||r.category||'General'}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  let last=null;
  for(const[key,results]of [...groups].sort(([a],[b])=>Number(a.split('|')[0])-Number(b.split('|')[0]))){
    const [n,category]=key.split('|');
    if(n!==last){app.append(el('h2',{class:'section-head'},sectionTitle(Number(n),[...groups.keys()].filter(k=>k.startsWith(n+'|')).map(k=>k.split('|')[1]),sectionNameOf(results[0]))));last=n;}
    const tbody=el('tbody');
    for(const r of results){
      const unit=r.unit&&r.unit!=='unitless'?r.unit:'';
      const prior=(history[r.test_id]||[]).filter(h=>h.run_id!==run.id&&h.qa_date<=run.qa_date);
      const recent=[...prior].reverse().slice(0,3);
      const hist=recent.length?el('span',{class:'hist-row'},recent.map(h=>el('span',{class:`hist ${h.status}`,title:`${h.qa_date}: ${r.type==='boolean'?(h.value?'Pass':'Fail'):fmt(h.value)+' '+unit}`},el('span',{class:'small'},new Date(h.qa_date+'T00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})),el('span',{},r.type==='boolean'?(h.value?'Pass':'Fail'):fmt(h.value)+(unit?' '+unit:''))))):el('span',{class:'muted small'},'—');
      const missing=r.value_num==null&&r.value_text==null;
      const value=missing?'Unanswered':r.type==='boolean'?(r.value_num?'Pass':'Fail'):r.type==='status'?STATUS_WORDS[r.value_text]||r.value_text:['text','choice'].includes(r.type)?r.value_text:`${QADerived.read(r.description)||/\[calc:/.test(r.description||'')?Number(r.value_num).toPrecision(3):fmt(r.value_num)} ${unit}`.trim();
      const measured=el('div',{class:'review-measured'},value);
      if(therapistReviewCheck(r)&&run.therapist_approval_required&&!run.trashed_at&&can('therapist_approve')){
        const {value:input,control}=passFailInput(r.name,false,false);
        const original=r.value_num==null?'':r.value_num?'pass':'fail';input.value=original;
        const sync=()=>control.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.value===input.value));sync();
        input.addEventListener('input',async()=>{
          const decision=input.value||'clear',scroll={x:scrollX,y:scrollY};control.querySelectorAll('button').forEach(b=>b.disabled=true);control.setAttribute('aria-busy','true');
          try{
            if(decision==='clear'&&run.therapist_approved_by)await api('POST',`/api/runs/${run.id}/therapist-unapprove`,{});
            else await api('POST',`/api/runs/${run.id}/therapist-review`,{decision});
            await route();requestAnimationFrame(()=>scrollTo(scroll.x,scroll.y));toast(decision==='pass'?'Saved. Awaiting Physics Review.':'Saved. Awaiting Therapy Review.');
          }catch(err){input.value=original;sync();control.querySelectorAll('button').forEach(b=>b.disabled=false);control.removeAttribute('aria-busy');toast(err.message,true);}
        });
        measured.replaceChildren(control);
      }
      const chart=el('tr',{class:'quick-trend',hidden:true},el('td',{colspan:10}));
      const trend=el('button',{class:'icon-btn',type:'button',title:'Show the trend here','aria-label':`Show trend for ${r.name}`,onclick:()=>{
        const pts=(history[r.test_id]||[]).slice(-60);
        if(!pts.length)return toast('No numeric results yet for this test.',true);
        if(chart.hidden)chart.firstChild.replaceChildren(el('div',{class:'row'},el('strong',{},r.name),el('span',{class:'spacer'}),el('a',{href:`#/trends?machine_id=${run.machine_id}&test_id=${r.test_id}&range=365`},'Full trend')),seriesChart([{label:r.name,points:pts}],unit,{small:true,yLabel:yAxisLabel([r.name])}));
        chart.hidden=!chart.hidden;
      }},trendIcon(16));
      const limits={expected:r.expected,warn:r.warn,fail:r.fail,tol_mode:r.tol_mode,...((r.description||'').includes('[rule: wl-max-delta]')?{criterion:'wl-max-delta'}:{})};
      const row=el('tr',{'data-test-id':r.test_id},
        el('td',{class:'qa-n'},numberFor(r)),
        el('td',{class:'qa-label'},el('strong',{},r.name),r.type==='numeric'?el('div',{class:'qa-limits'},limitsText(limits,unit)):null,helpText(r.description,{inline:true}),derivedExplanation(r,run.results,numbers)),
        el('td',{class:'qa-unit','data-label':'Unit'},r.type==='boolean'?'Pass / Fail':unit),
        el('td',{class:'qa-baseline num','data-label':'Baseline'},r.type==='boolean'?'Pass':r.expected==null?'—':`${fmt(r.expected)} ${unit}`.trim()),
        el('td',{class:'qa-measured','data-label':'Measured'},measured),
        el('td',{class:'qa-dev','data-label':'Deviation'},r.type==='numeric'&&!missing?deltaBadge(r.value_num,limits,unit,r.status):'—'),
        el('td',{class:'qa-result','data-label':'Result'},el('div',{class:'status-cell'},chip(r.status))),
        el('td',{class:'qa-comment','data-label':'Comment'},r.comment||'—'),
        el('td',{class:'history-cell','data-label':'History'},hist),
        el('td',{'data-label':'Trends'},r.type==='numeric'?trend:'—'));
      tbody.append(row,chart);
    }
    const headers=['#','Test','Unit','Baseline','Measured','Deviation','Result','Comment','History','Trends'];
    app.append(el('section',{class:'card section review-section'},el('div',{class:'review-section-title'},categoryLabel(category)),el('div',{class:'measure-wrap'},el('table',{class:'measure-table review-measure-table'},el('thead',{},el('tr',{},headers.map(h=>el('th',{},h)))),tbody))));
  }
}

async function renderRun(id) {
  const run = await api("GET", `/api/runs/${id}`);
  page(run.queue_name, shortDate(run.qa_date), [el("a",{class:"button",href:"#/review"},"Back to Review QA"),el("button", { onclick: () => downloadQaReport(id).catch((err) => toast(err.message, true)) }, "Download PDF report"),
    window.QAExcel?.supported(run)?el('button',{onclick:async()=>{try{const values={};for(const r of run.results){const key=QAExcel.keyOf(r),m=QAExcel.data().mapping.find(x=>x.key===key);if(!key||m?.formula)continue;values[key]=r.type==='boolean'?(r.value_num==null?null:r.value_num?'PASS':'FAIL'):r.type==='numeric'?r.value_num:r.value_text;}downloadWorkbookBlob(await QAExcel.exportFile(values,run.qa_date,run.performer_name||run.performer),run.qa_date);}catch(err){toast(err.message,true);}}},'Download Excel'):null,qaTrashButton(run)]);
  const who = `${personName(run.performer_name, run.performer)}, ${run.performed_at.slice(11, 16)}`;
  const facts = el("dl", { class: "result-card card" },
    el("dt", {}, "Result"), el("dd", {}, chip(run.overall)),
    el("dt", {}, "Performed by"), el("dd", {}, who, run.source === "sphinx" ? el("span", { class: "muted small" }, " · imported measurement file") : ""),
    el("dt", {}, "Review"), el("dd", {}, reviewChip(run),
      run.reviewed_by ? ` ${personName(run.reviewer_name, run.reviewer)}, ${run.reviewed_at.slice(0, 16).replace("T", " ")}` : ""),
    run.comment ? [el("dt", {}, "Notes"), el("dd", { class: "pre" }, run.comment)] : null,
    run.review_comment ? [el("dt", {}, "Review note"), el("dd", {}, run.review_comment)] : null);
  app.append(facts);

  if (run.trashed_at) app.append(el("p",{class:"card"},"This QA is in Trash. ",run.trash_reason||"Created in error"));
  if (!run.trashed_at && run.therapist_approval_required) {
    app.append(el('section',{class:'card review-workflow'},
      el('div',{},el('strong',{},'Therapist review'),el('span',{class:'small'},run.therapist_approved_by?`Signed by ${run.therapist_approver_name||'therapist'} · ${run.therapist_approved_at.replace('T',' ')}`:'Mark the therapist-review test below.')),
      el('span',{class:'workflow-arrow','aria-hidden':'true'},'→'),
      el('div',{},el('strong',{},'Physicist approval'),el('span',{class:'small'},run.review_status==='approved'?'Approved':run.review_status==='rejected'?'Rejected':run.therapist_approved_by&&run.review_ready!==false?'Awaiting Physics Review':'Awaiting Therapy Review'))));
    if(!run.results.some(therapistReviewCheck)&&!run.therapist_approved_by&&run.review_status==='pending'&&can('therapist_approve'))app.append(el('button',{class:'primary',onclick:async()=>{try{await api('POST',`/api/runs/${id}/therapist-approve`,{});route();}catch(err){toast(err.message,true);}}},'Sign therapist review'));
  }
  if (!run.trashed_at && run.review_status === "pending" && run.review_ready !== false && can("review") && (!run.therapist_approval_required || (run.therapist_approved_by && activeRole() === 'physicist'))) {
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

  const unanswered = run.results.filter(r => r.value_num == null && r.value_text == null);
  if (unanswered.length) app.append(el('p', {class:'lead'}, `${unanswered.length} of ${run.results.length} tests unanswered. Submitted for review; missing results are not passes.`));
  await renderReviewMeasurements(run);
  const therapistMode=can('therapist_approve')&&!can('review');
  if(!run.trashed_at&&activeRole()==='physicist'&&run.review_status==='approved') app.append(el('div',{class:'card row'},el('strong',{},'Physics Review: Approved'),el('span',{class:'spacer'}),el('button',{type:'button',onclick:async()=>{try{await api('POST',`/api/runs/${run.id}/physics-unapprove`,{});toast('Awaiting Physics Review');route();}catch(err){toast(err.message,true);}}},'Unapprove')));

  app.append(el('div',{class:'submit-bar review-close-bar'},el('span',{class:'review-close-message',role:'status'},therapistMode&&run.review_status==='pending'?(run.therapist_approved_by&&run.review_ready!==false?'Your review is saved. Awaiting Physics Review.':run.results.some(r=>therapistReviewCheck(r)&&r.status==='fail')?'Saved as Fail. Awaiting Therapy Review.':'Awaiting Therapy Review.'):'Review results'),el('span',{class:'spacer'}),el('a',{class:'button primary',href:'#/review'},therapistMode&&run.therapist_approved_by&&run.review_ready!==false?'Done — back to Review QA':'Back to Review QA')));

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

const trendKey = (show, multi = false, prediction = true) => (show ? [
  el("span", { class: "key-item" }, el("span", { class: `key-swatch fit${multi ? " multi" : ""}` }), multi ? "Trend (Least-Squares Fit, Each Series)" : "Trend (Least-Squares Fit)"),
  el("span", { class: "key-item" }, el("span", { class: `key-swatch fit forecast${multi ? " multi" : ""}` }), `Projected (Next ${FORECAST_DAYS / 7} Weeks)`)].filter((_, i) => prediction || i === 0) : []);

// Compare each value with the other results so a gross error cannot inflate its own SD cutoff.
function trendPlotPoints(points, delta = false) {
  const value = p => delta ? asDeviation(p).dev : p.value;
  const finite = points.filter(p => Number.isFinite(value(p)));
  if (finite.length < 5) return finite;
  return finite.filter((point, index) => {
    const other = finite.filter((_, i) => i !== index).map(value);
    const mean = other.reduce((sum, v) => sum + v, 0) / other.length;
    const sd = Math.sqrt(other.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (other.length - 1));
    return Math.abs(value(point) - mean) <= Math.max(5 * sd, 1e-12);
  });
}

function trendExclusionNote(series, delta) {
  const count = series.reduce((n, item) => n + item.points.length - trendPlotPoints(item.points, delta).length, 0);
  return count ? el('details', { class: 'small trend-exclusion-note' }, el('summary', {}, `${count} extreme ${count === 1 ? 'value' : 'values'} outside plot/fit`),
    'Values more than 5 standard deviations from the other results in the same energy/axis are excluded from plotted lines, Y-axis bounds and least-squares fits. At least 5 results are required. Statistics and saved values retain all results; open Values and details to inspect them.') : null;
}

function trendPassCounts(points) {
  const counts = { pass: 0, warn: 0, fail: 0, other: 0, total: points.length };
  for (const point of points) counts[['pass','warn','fail'].includes(point.status) ? point.status : 'other']++;
  const raw = counts.total ? counts.pass / counts.total * 100 : 0;
  const percent = counts.total && counts.pass === counts.total ? 100 : Math.min(99, Number(raw.toPrecision(2)));
  return { ...counts, percent };
}

function trendPassRing(points, label = 'Selected period') {
  const c = trendPassCounts(points), scale = c.total ? 100 / c.total : 0;
  const passEnd = c.pass * scale, warningEnd = passEnd + c.warn * scale, actionEnd = warningEnd + c.fail * scale;
  const description = `${label}: ${c.percent}% passed. ${c.pass} pass, ${c.warn} warning, ${c.fail} action${c.other ? `, ${c.other} unclassified` : ''}; ${c.total} measurements in selected period. Uses current limits; includes extreme values.`;
  return el('span', { class: 'trend-pass-rate', title: description, role: 'img', 'aria-label': description },
    el('span', { class: 'trend-pass-donut', style: `background: conic-gradient(var(--pass) 0% ${passEnd}%, var(--warn) ${passEnd}% ${warningEnd}%, var(--fail) ${warningEnd}% ${actionEnd}%, var(--border) ${actionEnd}% 100%)` },
      el('span', { class: 'trend-pass-value' }, c.total ? `${c.percent}%` : '—')),
    el('span', { class: 'trend-pass-label' }, 'passed'));
}

function trendPassBreakdown(series) {
  return el('div', { class: 'trend-pass-breakdown', 'aria-label': 'Pass rate by energy' }, series.map(item => el('div', { class: 'trend-energy-rate' }, el('strong', {}, item.label), trendPassRing(item.points, item.label))));
}

function trendStatistics(series, unit, delta = false, colorIndex = null) {
  return el('div', { class: 'trend-statistics' }, series.map((item, index) => {
    const values = item.points.map(p => delta ? asDeviation(p).dev : p.value);
    const st = seriesStats(values), outlier = item.points[st.outlier];
    const color = item.colorIndex !== undefined ? `axis-${item.colorIndex}` : colorIndex !== null ? `axis-${colorIndex}` : series.length > 1 ? `axis-${index}` : 'single';
    return el('div', { class: 'trend-statistics-line' }, el('span', { class: `key-swatch line ${color}`, 'aria-hidden': 'true' }),
      ` ${item.label}: Ref: ${sig(item.points.at(-1)?.expected)}: Trend Avg: ${sig(st.mean)} ± ${sig(st.sd)}${unit ? ` ${unit}` : ''}, Max Outlier: ${sig(values[st.outlier])} on ${shortDate(outlier.qa_date)}`);
  }));
}

function seriesChart(series, unit, { small = false, delta = null, yLabel = null, axisPanels = false } = {}) {
  yLabel = yLabel || yAxisLabel(series.map((x) => x.label));
  // Open every trend in Absolute mode; prediction is opt-in.
  let mode = "absolute";
  const hasRef = series.some((x) => x.points.some((pt) => pt.expected !== null && pt.expected !== undefined));
  let prediction = false;
  const box = el("div", { class: `chart-box${small ? " small" : ""}${series.length > 1 ? " multi" : ""}` });
  const draw = () => {
    const buttons = hasRef ? el("div", { class: "chart-mode" }, ["absolute", "delta"].map((m) =>
      el("button", { type: "button", class: `link small${mode === m ? " on" : ""}`, "aria-pressed": String(mode === m),
        onclick: (e) => { e.stopPropagation(); mode = m; draw(); } }, m === "absolute" ? `Absolute${unit ? ` ${unit}` : ""}` : "Δ from Reference"))) : null;
    const predictionControl = el('label', { class: 'check prediction-toggle' }, el('input', { type: 'checkbox', checked: prediction, 'aria-label': 'Show 4-week prediction', onchange: e => { prediction = e.target.checked; draw(); } }), '4-week prediction');
    const controls = el('div', { class: 'chart-controls' }, buttons, predictionControl);
    const delta = mode === "delta";
    const multi = series.length > 1;
    const pts = series.flatMap((x) => x.points);
    if (axisPanels) {
      const energies = new Map();
      for (const item of series) {
        const energy = item.label.replace(/\s*·\s*[XYZ]$/, '');
        if (!energies.has(energy)) energies.set(energy, energies.size);
      }
      const panels = ['X', 'Y'].map(axis => {
        const members = series.filter(item => item.label.endsWith(`· ${axis}`)).map(item => {
          const label = item.label.replace(/\s*·\s*[XYZ]$/, '');
          return { ...item, label, colorIndex: energies.get(label) };
        });
        if (!members.length) return null;
        return el('section', { class: 'subplot skewness-axis-panel' }, el('div', { class: 'subplot-title' }, `${yLabel} ${axis}`, trendPassRing(members.flatMap(item => item.points), `${yLabel} ${axis}`)),
          drawSeries(members, unit, { compact: true, delta, yLabel: `${yLabel} ${axis}`, prediction }),
          ...(trendExclusionNote(members, delta) ? [trendExclusionNote(members, delta)] : []),
          trendStatistics(members, unit, delta),
          el('details', { class: 'small' }, el('summary', {}, 'Pass rate by energy'), trendPassBreakdown(members)));
      }).filter(Boolean);
      box.replaceChildren(controls, el('div', { class: 'energy-plot-grid plots-2 skewness-axis-grid' }, ...panels),
        el('div', { class: 'chart-key' }, ...trendKey(true, true, prediction)));
      return;
    }
    // Absolute view of several series (X and Y sit around different references): one subplot per series, stacked,
    // each on its own scale with its own reference line and bands.
    if (multi && !delta) {
      box.replaceChildren(controls, el('div', { class: `energy-plot-grid plots-${series.length}` }, ...series.map((x, k) => el('div', { class: 'subplot' },
        el('div', { class: 'subplot-title' }, el('span', {}, x.label), trendPassRing(x.points, x.label)),
        drawSeries([x], unit, { compact: true, delta: false, yLabel, prediction, colorIndex: k }),
        ...(trendExclusionNote([x], false) ? [trendExclusionNote([x], false)] : []),
        trendStatistics([x], unit, false, k)
      ))), el('div', { class: 'chart-key energy-shared-key' },
        el('span', { class: 'key-item' }, el('span', { class: 'key-swatch ref' }), 'Reference'),
        el('span', { class: 'key-item' }, el('span', { class: 'key-swatch band-warn' }), 'Within Warning'),
        el('span', { class: 'key-item' }, el('span', { class: 'key-swatch band-fail' }), 'Warning to Action'), ...trendKey(true, false, prediction)));
      return;
    }
    const drawRef = hasRef && !(multi && !delta);
    const key = el("div", { class: "chart-key" },
      drawRef ? el("span", { class: "key-item" }, el("span", { class: "key-swatch ref" }), delta ? "Reference (0)" : "Reference") : null,
      drawRef && pts.some((pt) => pt.warn !== null && pt.warn !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch band-warn" }), "Within Warning") : null,
      drawRef && pts.some((pt) => pt.fail !== null && pt.fail !== undefined) ? el("span", { class: "key-item" }, el("span", { class: "key-swatch band-fail" }), "Warning to Action") : null,
      ...trendKey(series.some((x) => x.points.length >= 3), series.length > 1, prediction));
    box.replaceChildren(controls, ...(multi ? [trendPassBreakdown(series)] : []), drawSeries(series, unit, { small, delta, yLabel, prediction }), ...(trendExclusionNote(series, delta) ? [trendExclusionNote(series, delta)] : []), trendStatistics(series, unit, delta), key);
  };
  draw();
  return box;
}

const FORECAST_DAYS = 28;                                   // the straight-line trend is projected this far past the last result

let activePointTooltip=null;
function pointTooltip(dot,point,label,unit,event) {
  let tip=document.getElementById('qa-point-tooltip');
  if(!tip){tip=el('div',{id:'qa-point-tooltip',class:'point-tooltip',role:'tooltip',hidden:true});document.body.append(tip);window.addEventListener('hashchange',hidePointTooltip);document.addEventListener('scroll',hidePointTooltip,true);document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('.dot'))hidePointTooltip();});}
  const ref=point.expected,change=ref==null?null:point.value-ref;
  const deltaText=change==null?'Δ: — (no reference)':`Δ: ${sigSigned(change)}${unit?' '+unit:''}`;
  tip.replaceChildren(el('strong',{},label),el('span',{},`Date: ${shortDate(point.qa_date)}`),el('span',{},`Measured: ${sig(point.value)}${unit?' '+unit:''}`),el('span',{},deltaText));
  tip.hidden=false;activePointTooltip=dot;dot.setAttribute('aria-describedby',tip.id);
  const rect=dot.getBoundingClientRect(),cx=event?.clientX||rect.left+rect.width/2,cy=event?.clientY||rect.top;
  tip.style.left=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,cx+14))+'px';
  tip.style.top=Math.max(8,Math.min(innerHeight-tip.offsetHeight-8,cy+14))+'px';
}
function hidePointTooltip(){const tip=document.getElementById('qa-point-tooltip');if(tip)tip.hidden=true;if(activePointTooltip)activePointTooltip.removeAttribute('aria-describedby');activePointTooltip=null;}

function drawSeries(series, unit, { small = false, compact = false, delta = false, prediction = true, colorIndex = null, yLabel = "Value" } = {}) {
  const multi = series.length > 1;
  const W = compact ? 480 : 900, H = compact ? 185 : small ? 200 : 360;
  const L = small ? 78 : 70, R = 40, T = small ? 10 : 20, B = small ? 40 : 52;
  const lineH = small ? 17 : 16;
  const keyH = 0;                                            // the key is HTML under the chart (see seriesChart)
  const statH = compact ? 0 : keyH + lineH * series.length * (small ? 2 : 1) + 6;   // small charts: statistics on one line, the trend on the next
  const plotBottom = H - B;
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.qa_date)))].sort();
  const timeOf = (d) => new Date(d + "T00:00").getTime();
  const t0 = timeOf(dates[0]), t1 = timeOf(dates[dates.length - 1]);
  const tEnd = prediction ? t1 + FORECAST_DAYS * 86400000 : Math.max(t1, t0 + 86400000);                 // room on the right for the projection
  const xt = (t) => L + ((t - t0) * (W - L - R)) / (tEnd - t0);
  const x = (d) => xt(timeOf(d));
  const val = (p) => (delta ? asDeviation(p).dev : p.value);
  series = series.map(item => ({ ...item, points: trendPlotPoints(item.points, delta) }));
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
  for (const f of fits) if (f && prediction) values.push(f.end);
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
  const kids = [svg("defs", {}, svg("clipPath", { id: clipId }, svg("rect", { x: L-6, y: T-6, width: W-L-R+12, height: plotBottom-T+12 })))];
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
  const seenTickLabels = new Set();
  for (const v of ticks) {
    const tickLabel = (delta && v > 0 ? "+" : "") + sig(v);
    if (seenTickLabels.has(tickLabel)) continue;
    seenTickLabels.add(tickLabel);
    kids.push(svg("line", { class: "axis", x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      svg("text", { x: L - 5, y: y(v) + 4, "text-anchor": "end" }, (delta && v > 0 ? "+" : "") + sig(v)));
  }
  const shortLabel = small && yLabel.length > 30 ? `${yLabel.slice(0, 29)}…` : yLabel;
  const yTitle = `${delta ? "Δ " : ""}${shortLabel}${unit ? ` (${unit})` : ""}`;   // "Y Offset (mm)" / "Δ Y Offset (mm)": the unit never changes between the two views
  kids.push(svg("text", { class: "axis-title", x: 14, y: (T + plotBottom) / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${(T + plotBottom) / 2})` }, yTitle));

  // X axis: dates, and the axis title.
  kids.push(svg("line", { class: "axis-base", x1: L, x2: W - R, y1: plotBottom, y2: plotBottom }));
  // Label the whole displayed date range, even when all measurements are within one month.
  const tickCount = compact ? 4 : small ? 5 : 7;
  for (let i = 0; i < tickCount; i++) {
    const time = t0 + (tEnd - t0) * i / (tickCount - 1);
    const label = new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...((tEnd-t0)>365*86400000 ? { year: '2-digit' } : {}) });
    const tx = xt(time);
    kids.push(svg('line', { class: 'month-line', x1: tx, x2: tx, y1: T, y2: plotBottom }),
      svg('text', { class: 'date-tick', x: tx, y: plotBottom + 19, 'text-anchor': i === 0 ? 'start' : i === tickCount-1 ? 'end' : 'middle' }, label));
  }
  kids.push(svg("text", { class: "axis-title", x: (L + W - R) / 2, y: H - 4, "text-anchor": "middle" }, "Date QA performed"));

  if (prediction) plot.push(svg("line", { class: "forecast-line", x1: xt(t1), x2: xt(t1), y1: T, y2: plotBottom }));
  series.forEach((s, k) => {
    const cls = s.colorIndex !== undefined ? `axis-${s.colorIndex}` : colorIndex !== null ? `axis-${colorIndex}` : multi ? `axis-${k}` : "";
    const r = small ? (dates.length > 120 ? 2.2 : 3) : (dates.length > 150 ? 2.6 : 3.6);
    // A line from each result to the next, then the dots on top.
    if (s.points.length > 1) plot.push(svg("polyline", { class: `series ${cls || "single"}`, points: s.points.map((p) => `${x(p.qa_date)},${y(val(p))}`).join(" ") }));
    for (const p of s.points) {
      const change=p.expected==null?null:p.value-p.expected;
      const description=`${s.label} · Date: ${shortDate(p.qa_date)} · Measured: ${sig(p.value)}${unit?' '+unit:''} · Δ: ${change==null?'— (no reference)':sigSigned(change)+(unit?' '+unit:'')}`;
      const dot=svg('circle',{class:`dot ${cls||'single'} st-${p.status}`,cx:x(p.qa_date),cy:y(val(p)),r,tabindex:0,'aria-label':description},svg('title',{},description));
      dot.addEventListener('pointerenter',e=>pointTooltip(dot,p,s.label,unit,e));
      dot.addEventListener('pointermove',e=>pointTooltip(dot,p,s.label,unit,e));
      dot.addEventListener('pointerleave',hidePointTooltip);
      dot.addEventListener('focus',()=>pointTooltip(dot,p,s.label,unit));
      dot.addEventListener('blur',hidePointTooltip);
      dot.addEventListener('keydown',e=>{if(e.key==='Escape')hidePointTooltip();});
      dot.addEventListener('click',e=>{e.stopPropagation();pointTooltip(dot,p,s.label,unit,e);});
      plot.push(dot);
    }
  });
  series.forEach((s, k) => {
    const f = fits[k];
    if (!f) return;
    const cls = s.colorIndex !== undefined ? `axis-${s.colorIndex}` : colorIndex !== null ? `axis-${colorIndex}` : multi ? `axis-${k}` : "single";
    plot.push(svg("line", { class: `fit ${cls}`, x1: xt(t0), y1: y(f.at(t0)), x2: xt(t1), y2: y(f.at(t1)) }));
    if (prediction) plot.push(svg("line", { class: `fit forecast ${cls}`, x1: xt(t1), y1: y(f.at(t1)), x2: xt(tEnd), y2: y(f.end) },
      svg("title", {}, `Projected ${sig(f.end)}${unit ? ` ${unit}` : ""} in ${FORECAST_DAYS / 7} weeks (least-squares fit)`)));

  });
  const plotGroup = svg("g", { "clip-path": `url(#${clipId})` }, plot);
  kids.push(plotGroup);


  return svg("svg", { class: small ? "spark" : "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": series.map((s) => s.label).join(", ") }, kids);
}

function axisLegend(group) {
  return group.members.length > 1
    ? el("span", { class: "axis-legend" }, group.members.map((m, k) => el("span", { class: `axis-key axis-${k}` }, m.axis)))
    : null;
}

const signed = (v, d = 2) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v), d)}`;
// Two significant figures for displayed trend measurements and statistics (77.7, 0.06, 157), trailing zeros dropped.
const sig = (v, n = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : v === 0 ? "0" : String(Number(Number(v).toPrecision(n))));
const sigSigned = (v, n = 2) => `${v >= 0 ? "+" : "−"}${sig(Math.abs(v), n)}`;

// Trend points judged by the QA list's current limits (the same reference / warning / action the Perform page shows),
// not by whatever limits were stored with each result. Points keep their recorded verdict in `recorded_status`.
function judgedByList(item, points) {
  const L = item.limits || {};
  if (L.expected === null || L.expected === undefined) return points;
  return points.map((p) => ({ ...p, expected: L.expected, warn: L.warn ?? null, fail: L.fail ?? null, tol_mode: L.tol_mode || "absolute",
    recorded_status: p.status, status: evaluate("numeric", p.value, L) }));
}

function trendDisplayName(name) {
  return String(name || '').replace(/\bSpot\s+\d+(?:\s*(?=\[)|\s+(?=\d+(?:\.\d+)?\s*MeV))/gi, '').trim();
}

function trendGroups(items) {
  const families = new Map(), plain = [];
  for (const item of items) {
    const coincidence = /isocent(?:er|re).*coincidence|coincidence.*isocent(?:er|re)/i.test(item.name);
    const coincidenceAxis = /\b([XYZ])\s+(?:offset|position|residual)\b|\b(?:offset|position|residual)\s*[-:–]?\s*([XYZ])\b|(?:[-:–]\s*|\s)([XYZ])(?:\s*\[[^\]]*\])?$/i.exec(item.name);
    if (coincidence && coincidenceAxis) {
      const axis = (coincidenceAxis[1] || coincidenceAxis[2] || coincidenceAxis[3]).toUpperCase();
      const key = `isocenter-coincidence|${item.category || ''}|${item.unit || ''}`;
      if (!families.has(key)) families.set(key, { base: 'Isocenter Coincidence', category: item.category, members: [] });
      families.get(key).members.push({ ...item, axis });
      continue;
    }
    const energy = /(\d+(?:\.\d+)?)\s*MeV/i.exec(item.name);
    if (!energy) { plain.push(item); continue; }
    let metric = item.name.replace(/\[\s*\d+(?:\.\d+)?\s*MeV\s*\]|\d+(?:\.\d+)?\s*MeV/ig, '').replace(/^.*?:\s*/, '').replace(/^\s*(?:Energy|Spot)\s*[-–—:]?\s*/i, '').replace(/^\s*[-–—:]\s*/, '').trim();
    const axis = axisParts(metric);
    const splitPosition = axis && /position/i.test(axis.base);
    if (axis) metric = `${axis.base}${splitPosition ? ` ${axis.axis}` : ''}`;
    const labels = { 'dfo': 'Distal Fall Off', 'distal falloff': 'Distal Fall Off', 'distal fall off': 'Distal Fall Off', 'distal depth': 'Distal Depths' };
    metric = labels[metric.toLowerCase()] || metric;
    const key = `${item.category || ''}|${metric.toLowerCase()}|${item.unit || ''}`;
    if (!families.has(key)) families.set(key, { base: metric, category: item.category, members: [] });
    families.get(key).members.push({ ...item, axis: `${Number(energy[1])} MeV${axis && !splitPosition ? ` · ${axis.axis}` : ''}` });
  }
  const order = new Map(items.map((item, index) => [item.test_id, index]));
  return [...axisGroups(plain), ...families.values()].sort((a,b) => Math.min(...a.members.map(m => order.get(m.test_id))) - Math.min(...b.members.map(m => order.get(m.test_id))));
}

async function renderTrendOverview(machines, machineId, range, listId = "") {
  const assignments = (await api('GET', `/api/machines/${machineId}/assignments`)).filter(a => a.active && !a.archived && (!listId || String(a.id) === String(listId)));
  const [templates, histories] = await Promise.all([Promise.all(assignments.map(a => api('GET', `/api/assignments/${a.id}/template`))), api('GET', `/api/machines/${machineId}/trends`)]);
  const sections = [], insights = [];
  for (const template of templates) {
    const items = template.items.filter(i => i.type === 'numeric').map(i => ({ ...i, name: trendDisplayName(i.name), points: judgedByList(i, filterRange(histories[i.test_id] || [], range)) })).filter(i => i.points.length);
    // Result insertion order preserves the CSV analysis order, including for existing templates.
    const imported = Object.entries(histories).flatMap(([testId, points]) => points.filter(p => p.source === 'sphinx' && String(p.assignment_id) === String(template.assignment.id)).map(p => ({ ...p, testId })));
    const newest = imported.reduce((id, p) => Math.max(id, p.run_id), 0);
    const order = new Map(imported.filter(p => p.run_id === newest).map(p => [String(p.testId), p.source_order]));
    if (order.size) items.sort((a,b) => (order.get(String(a.test_id)) ?? Infinity) - (order.get(String(b.test_id)) ?? Infinity));
    const groups = trendGroups(items);
    const categories = new Map();
    for (const group of groups) {
      const category = categoryLabel(group.category) || 'Other measurements';
      if (!categories.has(category)) categories.set(category, []);
      const href = `#/trends?machine_id=${machineId}&list=${template.assignment.id}&test_id=${group.members.map(m => m.test_id).join(',')}&range=${range}`;
      insights.push(...group.members.map(m => ({ ...m, href })));
      const body = el('div', { class: 'trend-chart-body' });
      const chart = el('details', { class: 'trend-chart-row' }, el('summary', {}, el('strong', {}, group.base), trendPassRing(group.members.flatMap(m => m.points), group.base)), body);
      chart.dataset.search = `${group.base} ${category} ${template.queue.name}`.toLowerCase();
      let drawn = false;
      chart.addEventListener('toggle', () => {
        if (!chart.open || drawn) return;
        drawn = true;
        body.append(el('p', { class: 'trend-pass-explainer' }, 'Pass rate for the selected period · ', el('span', { class: 'pass' }, 'Green: pass'), ' · ', el('span', { class: 'warn' }, 'Amber: warning'), ' · ', el('span', { class: 'fail' }, 'Red: action'), '. All measurements count, including values excluded from plotting.'), seriesChart(group.members.map(m => ({ label: m.axis || m.name, points: m.points })), group.members[0].unit, { yLabel: yAxisLabel(group.members.map(m => m.name)), axisPanels: /skewness/i.test(group.base) && group.members.some(m => /· [XY]$/.test(m.axis)) }), el('a', { href, class: 'button small' }, 'View values and details'));
      });
      categories.get(category).push(chart);
    }
    if (groups.length) {
      const section = el('section', { class: 'trend-organized-list' }, el('h2', { class: 'section-head' }, template.queue.name));
      for (const [category, charts] of categories) section.append(el('h3', {}, category), ...charts);
      sections.push(section);
    }
  }
  app.append(trendInsightsCard(insights));
  if (!sections.length) return app.append(el('div', { class: 'card empty' }, 'No measurements in this period. Import reports or choose a longer period.'));
  const search = el('input', { type: 'search', class: 'filter-box', placeholder: 'Find an energy or measurement…', 'aria-label': 'Find measurements', oninput: e => {
    const words = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const section of sections) {
      const rows = [...section.querySelectorAll('.trend-chart-row')];
      rows.forEach(row => row.hidden = !words.every(w => row.dataset.search.includes(w)));
      section.hidden = rows.every(row => row.hidden);
    }
  }});
  app.append(el('h2', { class: 'section-head' }, 'Measurements'), el('p', { class: 'muted small' }, 'Organized by QA list and measurement type. Select a row to open its graph. Matching X and Y measurements share a graph.'), search, ...sections);
}

function renderTrendDetail(group, range) {
  const unit = group.members[0].unit;
  const multi = group.members.length > 1;
  app.append(seriesChart(group.members.map((m) => ({ label: m.axis || m.name, points: m.points })), unit, { yLabel: yAxisLabel(group.members.map((m) => m.name)), axisPanels: /skewness/i.test(group.base) && group.members.some(m => /· [XY]$/.test(m.axis)) }));
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
          return el("td", { class: "num" }, p ? [`${sig(p.value)} ${unit}`.trim(), " ", chip(p.status)] : "");
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

// Folder handles stay in this browser; they are never put in shared QA backups.
const trendExportFolders = {
  async database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('qa-trend-export-folders', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('folders');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  key(machineId) { return `${state.user.id}:${machineId}`; },
  async get(machineId) {
    const db = await this.database();
    try { return await new Promise((resolve, reject) => { const request = db.transaction('folders').objectStore('folders').get(this.key(machineId)); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  },
  async set(machineId, handle) {
    const db = await this.database();
    try { await new Promise((resolve, reject) => { const tx = db.transaction('folders', 'readwrite'); const store = tx.objectStore('folders'); if (handle) store.put(handle, this.key(machineId)); else store.delete(this.key(machineId)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Folder could not be remembered')); }); }
    finally { db.close(); }
  },
  async choose(machineId) {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'qa-trends-export' });
    await this.set(machineId, handle); return handle;
  },
};
function trendCsvCell(value) {
  let text = String(value ?? '');
  // Spreadsheet formula protection for names, comments and units in downloaded CSVs.
  if (/^[=+@\t\r]/.test(text) || /^-(?!\d)/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function trendCsvRows(machine, templates, histories, range, testIds = []) {
  const rows = [['Machine', 'QA list', 'Test', 'Unit', 'QA date', 'Run ID', 'Value', 'Recorded baseline', 'Recorded warning', 'Recorded action', 'Recorded mode', 'Recorded result', 'Current baseline', 'Current warning', 'Current action', 'Current mode', 'Current result']];
  const seen = new Set();
  for (const t of templates) for (const item of t.items) {
    if (item.type !== 'numeric' || (testIds.length && !testIds.includes(String(item.test_id)))) continue;
    const points = filterRange(histories[item.test_id] || [], range);
    const judged = judgedByList(item, points);
    points.forEach((point, i) => {
      const key = `${point.run_id}:${point.source_order??item.test_id}`; if (seen.has(key)) return; seen.add(key);
      const l = item.limits;
      const word = (s) => ({ pass: 'PASS', warn: 'WARNING', fail: 'ACTION' }[s] || s || 'Recorded');
      rows.push([machine.name, t.queue.name, item.name, item.unit === 'unitless' ? '' : item.unit, point.qa_date, point.run_id, point.value,
        point.expected, point.warn, point.fail, point.tol_mode, word(point.status), l.expected, l.warn, l.fail, l.tol_mode, word(judged[i].status)]);
    });
  }
  return rows;
}
async function saveTrendCsv(machineId, filename, text, handle) {
  const blob = new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8' });
  if (handle) {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Allow the export folder or choose Browser downloads in Folder settings.');
    const file = await handle.getFileHandle(filename, { create: true });
    const writer = await file.createWritable();
    try { await writer.write(blob); await writer.close(); } catch (err) { await writer.abort().catch(() => {}); throw err; }
    return handle.name;
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'Downloads';
}
function trendFileTools(machine, lists, listId, range, testIds) {
  const storageKey = `qa-trends-import:${state.user.id}:${machine.id}`;
  const preferred = localStorage.getItem(storageKey);
  let selectedId = String(listId || (lists.find((a) => String(a.id) === preferred) || lists.find((a) => a.import_folder) || lists[0] || {}).id || '');
  let exportHandle = null;
  const status = el('span', { class: 'muted small', role: 'status' });
  const selected = () => lists.find((a) => String(a.id) === selectedId);
  const remember = () => { if (selectedId) localStorage.setItem(storageKey, selectedId); };
  const refreshStatus = () => { const a = selected(); status.textContent = `Import: ${a?.import_folder || 'Choose a folder'} · Export: ${exportHandle?.name || 'Downloads'}`; };
  trendExportFolders.get(machine.id).then((handle) => { exportHandle = handle; refreshStatus(); }).catch(() => { refreshStatus(); });
  const folderSettings = () => {
    const importStatus = el('span', { class: 'muted small' });
    const exportStatus = el('span', { class: 'muted small' }, exportHandle?.name || 'Browser downloads');
    const path = el('input', { placeholder: 'Folder on the portal host', 'aria-label': 'Default import folder' });
    const updateImport = () => { importStatus.textContent = selected()?.import_folder || 'No import folder chosen'; path.value = selected()?.import_folder || ''; };
    const picker = select('import_list', lists.map((a) => [a.id, a.queue_name]), selectedId, { 'aria-label': 'Default import QA list', onchange: (e) => { selectedId = e.target.value; remember(); updateImport(); refreshStatus(); } });
    const chooseImport = el('button', { type: 'button', onclick: async () => {
      try { const name = await window.localFolders.choose(selectedId); selected().import_folder = name; remember(); updateImport(); refreshStatus(); }
      catch (err) { if (err.name !== 'AbortError') toast(err.message, true); }
    } }, 'Choose import folder');
    const clearImport = el('button', { type: 'button', class: 'small link', onclick: async () => {
      try { await window.localFolders.clear(selectedId); selected().import_folder = ''; updateImport(); refreshStatus(); }
      catch (err) { toast(err.message, true); }
    } }, 'Clear');
    const chooseExport = el('button', { type: 'button', onclick: async () => {
      try { exportHandle = await trendExportFolders.choose(machine.id); exportStatus.textContent = exportHandle.name; refreshStatus(); }
      catch (err) { if (err.name !== 'AbortError') toast(err.message, true); }
    } }, 'Choose export folder');
    const clearExport = el('button', { type: 'button', class: 'small link', onclick: async () => {
      try { await trendExportFolders.set(machine.id, null); exportHandle = null; exportStatus.textContent = 'Browser downloads'; refreshStatus(); }
      catch (err) { toast(err.message, true); }
    } }, 'Use Downloads');
    updateImport();
    modal(`${machine.name} folders`, el('div', { class: 'trend-folder-settings' },
      can('configure') && lists.length ? el('div', {}, el('h3', {}, 'Default import'), picker,
        window.localApi ? el('div', { class: 'row' }, 'showDirectoryPicker' in window ? chooseImport : el('span', { class: 'muted small' }, 'Choose a saved Sphinx file with Import.'), clearImport, importStatus) : path) : null,
      el('div', {}, el('h3', {}, 'Default export'), el('div', { class: 'row' }, 'showDirectoryPicker' in window ? chooseExport : null, clearExport, exportStatus)),
      el('p', { class: 'muted small' }, 'Import folders belong to the selected QA list. Export folders are remembered for this machine on this browser and computer.')),
    async () => {
      if (!window.localApi && can('configure') && selected()) {
        const a = selected();
        await api('PUT', `/api/assignments/${a.id}`, { frequency: a.frequency, interval_days: a.interval_days, weekdays: String(a.weekdays).split(',').filter(Boolean).map(Number), start_date: a.start_date, active: !!a.active, import_folder: path.value.trim() });
        a.import_folder = path.value.trim();
      }
      remember(); refreshStatus();
    }, 'Done');
  };
  const importFromFolder = async (initialFiles = []) => {
    const a = selected();
    if (!a) return toast('Schedule a QA list on this machine first.', true);
    const summary = {imported:[], skipped:[]};
    let duplicates = 0;
    status.textContent = 'Scanning folder and subfolders…';
    try {
      let pending = initialFiles;
      if (!pending.length) {
        const found = await api('GET', `/api/assignments/${a.id}/files`);
        if (found.permission && found.permission !== 'granted') throw new Error('Allow access to the selected folder.');
        duplicates = found.files.filter(f=>f.run_id).length;
        pending = found.files.filter(f=>!f.run_id);
      }
      for (let i=0; i<pending.length; i+=25) {
        status.textContent = `Importing ${i+1}–${Math.min(i+25,pending.length)} of ${pending.length}…`;
        const files=[];
        for (const file of pending.slice(i,i+25)) {
          try { files.push(initialFiles.length ? await readFileBase64(file) : await api('GET', `/api/assignments/${a.id}/file?path=${encodeURIComponent(file.path)}`)); }
          catch (err) { summary.skipped.push({file:file.path || file.name,reason:err.message}); }
        }
        if (!files.length) continue;
        if(can('configure')) {
          const result=await api('POST',`/api/assignments/${a.id}/sphinx/import`,{files,historical:true});summary.imported.push(...result.imported);summary.skipped.push(...result.skipped);
        } else for(const file of files) {
          try {const preview=await api('POST',`/api/assignments/${a.id}/sphinx/preview`,{file});if(preview.duplicate_run){duplicates++;continue;}if(!preview.matched.length)throw Error('No measurements match this QA list.');const run=await api('POST',`/api/assignments/${a.id}/runs`,{qa_date:preview.qa_date,source_ref:preview.source_ref,comment:`Imported from ${file.name}`,results:preview.matched.map(m=>({test_id:m.test_id,value:m.value}))});summary.imported.push({run_id:run.id});}catch(err){summary.skipped.push({file:file.name,reason:err.message});}
        }
      }
      if (summary.imported.length) await route();
      modal('Folder import complete', el('div', {},
        el('p', {}, `${summary.imported.length} imported · ${duplicates} already recorded · ${summary.skipped.length} skipped`),
        el('p', {class:'muted small'}, `${machine.name} · ${a.queue_name}. Subfolders were included.`),
        summary.skipped.length ? el('details', {}, el('summary', {}, 'Skipped files'), el('ul', {class:'small'}, summary.skipped.map(x=>el('li',{},`${x.file}: ${x.reason}`)))) : null), async()=>{}, 'Done');
    } finally { refreshStatus(); }
  };
  const exportButton = el('button', { type: 'button', onclick: async () => {
    exportButton.disabled = true;
    try {
      // Read permissions while the export button still has browser user activation.
      if (exportHandle && await exportHandle.queryPermission({ mode: 'readwrite' }) !== 'granted' && await exportHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Allow the export folder or select Use Downloads in Folder settings.');
      const targets = lists.filter((a) => !listId || String(a.id) === String(listId));
      const [templates, histories] = await Promise.all([Promise.all(targets.map((a) => api('GET', `/api/assignments/${a.id}/template`))), api('GET', `/api/machines/${machine.id}/trends`)]);
      const rows = trendCsvRows(machine, templates, histories, range, testIds);
      if (rows.length < 2) return toast('No numeric results in the selected list and period.');
      const csv = rows.map((row) => row.map(trendCsvCell).join(',')).join('\r\n');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${machine.name}-trends-${range}-${stamp}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const where = await saveTrendCsv(machine.id, filename, csv, exportHandle);
      toast(`Exported ${rows.length - 1} results to ${where}`);
    } catch (err) { if (err.name !== 'AbortError') toast(err.message, true); }
    finally { exportButton.disabled = false; }
  } }, 'Export CSV');
  refreshStatus();
  return el('div', { class: 'row trend-file-tools' },
    can('perform') ? el('button', { type: 'button', disabled: !lists.length, onclick: async () => {
      try {
        if (window.localApi && 'showDirectoryPicker' in window) {
          const a = selected();
          a.import_folder = await window.localFolders.choose(a.id);
          remember(); refreshStatus(); await importFromFolder();
        } else {
          const picker = el('input', { type: 'file', multiple: true, webkitdirectory: '', accept: '.csv,.xls' });
          picker.addEventListener('change', () => { const files = [...picker.files].filter(file => /\.(csv|xls)$/i.test(file.name)); if (files.length) importFromFolder(files).catch(err => toast(err.message, true)); else toast('No CSV or XLS files found in that folder.', true); });
          picker.click();
        }
      } catch (err) { if (err.name !== 'AbortError') toast(err.message, true); }
    } }, 'Import Folder') : null,
    exportButton);
}

function trendPattern(points) {
  const data = points.slice(-20).filter((p) => Number.isFinite(p.value));
  if (data.length < 5 || new Set(data.map((p) => p.qa_date)).size < 5) return null;
  const start = new Date(data[0].qa_date + 'T12:00:00').getTime();
  const x = data.map((p) => (new Date(p.qa_date + 'T12:00:00').getTime() - start) / 86400000);
  const y = data.map((p) => p.value - (p.expected ?? 0));
  const meanX = x.reduce((a,b) => a+b,0) / x.length, meanY = y.reduce((a,b) => a+b,0) / y.length;
  const xx = x.reduce((s,v) => s + (v-meanX)**2,0), yy = y.reduce((s,v) => s + (v-meanY)**2,0);
  if (!xx || !yy) return null;
  const xy = x.reduce((s,v,i) => s + (v-meanX)*(y[i]-meanY),0), slope = xy/xx;
  const r2 = Math.min(1, Math.max(0, xy*xy/(xx*yy))), change = slope*(x.at(-1)-x[0]);
  const last = data.at(-1), warning = last.warn == null ? null : last.tol_mode === 'percent' ? Math.abs(last.expected || 0)*last.warn/100 : last.warn;
  if (r2 < 0.6 || Math.abs(change) < 1e-10 || (warning && Math.abs(change) < warning/2)) return null;
  return { direction: slope > 0 ? 'Rising' : 'Falling', change, slope, r2, n: data.length };
}
function trendInsightsCard(series) {
  const messages = [];
  for (const item of series) {
    const last = item.points.at(-1); if (!last) continue;
    const who = item.machine_name ? `${item.machine_name} · ` : '';
    if (last.status === 'fail' || last.status === 'warn') messages.push({ priority: last.status === 'fail' ? 3 : 2,
      href: item.href, text: `${who}${item.name}: latest result is at ${last.status === 'fail' ? 'action' : 'warning'} level (${shortDate(last.qa_date)}).` });
    const pattern = trendPattern(item.points);
    if (pattern) messages.push({ priority: 1, href: item.href, text: `${who}${item.name}: ${pattern.direction.toLowerCase()} pattern, ${sig(pattern.change)} ${item.unit || ''} fitted change across ${pattern.n} results (R² ${sig(pattern.r2)}).` });
  }
  messages.sort((a,b) => b.priority-a.priority);
  const populated=series.filter(s=>s.points.length);
  const enough=populated.some(s=>new Set(s.points.map(p=>p.qa_date)).size>=5);
  const emptyText=!populated.length?'No measurements in this period. Choose another period or use Import Folder.':!enough?'More history is needed to check for a trend: at least 5 different QA dates per measurement.':'No warning, action, or steady drift found in the selected period.';
  return el('section', { class: 'card trend-insights', 'aria-label': 'Automatic trend insights' },
    el('h3', {}, 'Trend summary'),
    messages.length ? el('ul', {}, messages.slice(0,6).map((m) => el('li', {}, m.href ? el('a', { href: m.href, class: 'trend-insight-link' }, m.text, ' → View graph') : m.text))) : el('p', { class: 'muted small' }, emptyText),
    el('details', {}, el('summary', { class: 'small' }, 'How trends are checked'),
      el('p', { class: 'muted small' }, 'Each measurement is checked separately against its current baseline and limits. A least-squares line checks for steady change using up to 20 results across at least 5 QA dates. Suggested patterns are prompts to inspect the graph.')));
}
async function renderTrends() {
  const params = queryParams();
  const machines = (await api("GET", "/api/machines")).filter((m) => m.active);
  const requested = (params.get('machine_id') || params.get('machine_ids') || '').split(',')[0];
  const fallback = machines.find(m => m.name === 'GTR1') || machines[0];
  const machineId = machines.some(m => String(m.id) === requested) ? requested : fallback?.id;
  const range = params.get("range") || "90";
  const testIds = (params.get("test_id") || "").split(",").filter(Boolean);
  // The machine, QA list and range stay frozen at the top while the tests scroll under them (as on Perform QA).
  const lists = machineId ? (await api("GET", `/api/machines/${machineId}/assignments`)).filter((a) => a.active) : [];
  const listId = lists.some((a) => String(a.id) === params.get("list")) ? params.get("list") : "";
  const go = (next) => { location.hash = `#/trends?${new URLSearchParams(Object.entries(next).filter(([, v]) => v))}`; };
  page("Machine Trends", null, [
    select('machine_id', machines.map(m => [m.id, m.name]), machineId, { 'aria-label': 'Machine', onchange: e => go({ machine_id: e.target.value, range }) }),
    select("list", [["", "All QA lists"], ...lists.map((a) => [a.id, a.queue_name])], listId, { "aria-label": "QA list", onchange: (e) => go({ machine_id: machineId, list: e.target.value, range }) }),
    select("range", [["30", "Last 30 days"], ["90", "Last 3 months"], ["365", "Last year"], ["all", "All history"]], range, { "aria-label": "Period", onchange: (e) => go({ machine_id: machineId, list: listId, test_id: testIds.join(","), range: e.target.value }) }),
    testIds.length ? el("a", { class: "button", href: `#/trends?${new URLSearchParams(Object.entries({ machine_id: machineId, list: listId, range }).filter(([, v]) => v))}` }, "← All tests") : null]);
  app.querySelector(".page-head").classList.add("sticky-head", "trends-head");
  if (!machines.length) return app.append(el("div", { class: "card empty" }, "No machines yet."));
  app.append(trendFileTools(machines.find((m) => String(m.id) === String(machineId)), lists, listId, range, testIds));
  if (!testIds.length) return renderTrendOverview(machines, machineId, range, listId);
  const data = await Promise.all(testIds.map((id) => api("GET", `/api/trend?machine_id=${machineId}&test_id=${id}`)));
  const assignments = await api("GET", `/api/machines/${machineId}/assignments`);
  const templates = await Promise.all(assignments.filter((a) => a.active).map((a) => api("GET", `/api/assignments/${a.id}/template`)));
  const listItems = new Map(templates.flatMap((t) => t.items).map((i) => [String(i.test_id), i]));
  const items = data.map((d) => {
    const li = listItems.get(String(d.test.id));
    const limits = li ? li.limits : { expected: d.test.expected, warn: d.test.warn, fail: d.test.fail, tol_mode: d.test.tol_mode };
    return { ...d.test, name: trendDisplayName(d.test.name), test_id: d.test.id, limits, points: judgedByList({ limits }, filterRange(d.points, range)) };
  }).filter((i) => i.points.length);
  const head = data[0].test;
  const group = trendGroups(items)[0];
  app.append(el("h2", {}, group ? group.base : trendDisplayName(head.name), group ? axisLegend(group) : null),
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
    el("p", { class: "muted small wide" }, "Admins manage users. Physicists configure machines, queues and limits, and review runs. Therapists perform QA and sign required therapist approvals. MPA users perform QA; approval and setup access are restricted."));
}

// Admin: who can sign in and what they may do, and the folders each QA list reads its export files from.
const RIGHTS = [
  ["perform", "Perform QA"],
  ["review", "Review and approve"],
  ["therapist_approve", "Therapist sign-off"],
  ["configure", "Set up QA lists, machines, limits and folders"],
  ["manage_users", "Manage users"],
];
const ROLE_RIGHTS = { admin: ["perform", "review", "configure", "manage_users"], physicist: ["perform", "review", "configure"], therapist: ["perform", "therapist_approve"], mpa: ["perform"] };

function importUserSpreadsheet() {
  const picker=el('input',{type:'file',accept:'.xlsx,.xls,.csv','aria-label':'User spreadsheet'}), preview=el('div'),error=el('p',{class:'error'});
  let users=[];
  picker.addEventListener('change',async()=>{users=[];preview.replaceChildren();error.textContent='';try{
    const file=picker.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('Choose a spreadsheet smaller than 5 MB.');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false});
    const aliases={username:'username',user:'username',login:'username',name:'full_name',fullname:'full_name',password:'password',pw:'password',temporarypassword:'password',role:'role'};
    users=rows.map(row=>{const user={};for(const [key,v]of Object.entries(row)){const field=aliases[key.toLowerCase().replace(/[^a-z]/g,'')];if(field)user[field]=String(v);}const roles={admin:'admin',physicist:'physicist',therapy:'therapist',therapist:'therapist',mpa:'mpa'};user.role=roles[(user.role||'').trim().toLowerCase()]||'';return user;});
    if(!users.length||users.length>500)throw Error('Include 1–500 users with Username, Password (or PW), Role, and optional Name columns.');
    const names=new Set();users.forEach((u,i)=>{u.username=(u.username||'').trim();if(!u.username||names.has(u.username.toLowerCase()))throw Error(`Row ${i+2}: username is missing or duplicated.`);names.add(u.username.toLowerCase());if(!u.role)throw Error(`Row ${i+2}: role must be Admin, Physicist, Therapist or MPA.`);if((u.password||'').length<10)throw Error(`Row ${i+2}: temporary password must have at least 10 characters.`);});
    preview.replaceChildren(el('p',{},`${users.length} users ready. Passwords are hidden in this preview.`),table(['Username','Name','Role'],users.map(u=>el('tr',{},el('td',{},u.username),el('td',{},u.full_name||''),el('td',{},ROLE_LABEL[u.role])))));
  }catch(err){users=[];error.textContent=err.message;}});
  modal('Import users',el('div',{},el('p',{},'Upload Excel or CSV with Username, Password (or PW), Role, and optional Name columns. Existing usernames are preserved. Temporary passwords need 10+ characters.'),picker,preview,error),async()=>{if(!users.length)throw Error('Choose a valid user spreadsheet first.');try{const result=await api('POST','/api/users/import',{users});users=[];picker.value='';toast(`${result.created} users added`);route();}finally{users=[];}},'Add users');
}

async function renderAdmin() {
  const addUser = () => modal('Add user', userForm(), async data => {
    await api('POST','/api/users',data);toast('User added');route();
  });
  page("Data Administration", "Users and their rights, the folders export files are read from, and the database.", [
    el('button', { class: 'primary', disabled: !can('manage_users'), onclick: addUser }, 'Add user'),
    can('manage_users')?el('button',{onclick:importUserSpreadsheet},'Import users'):null]);
  app.append(el('p', { class: 'admin-role-notice' }, `Signed in as ${ROLE_LABEL[state.user.role]}. `,
    can('manage_users') ? 'Use Add user above to create Admin, Physicist, Therapist or MPA accounts.'
      : ['Adding users requires an Admin account. ', el('button', { class: 'small', onclick: logout }, 'Sign in as Admin'),
        window.localApi ? ' This browser demo requires the Admin test account and password. The shared server requires an existing Admin account and password.' : ' Ask the portal administrator if you need Admin access.']));
  const [users, machines] = await Promise.all([can("manage_users") ? api("GET", "/api/users") : null, api("GET", "/api/machines")]);

  // 1. Users and rights (admins only; others see what each role may do).
  app.append(el("h2", { class: "section-head" }, "Users and rights"));
  if (!users) {
    app.append(el("p", { class: "muted" }, "Only an admin can add users or change roles. What each role may do:"),
      table(["Role", ...RIGHTS.map(([, label]) => label)], Object.entries(ROLE_RIGHTS).map(([role, rights]) => el("tr", {},
        el("td", {}, el("strong", {}, ROLE_LABEL[role])), RIGHTS.map(([key]) => el("td", { class: "center" }, rights.includes(key) ? el("span", { class: "tick" }, "✓") : el("span", { class: "muted" }, "—")))))));
  }
  if (users) app.append(el('p', { class: 'muted' }, 'Rights come from each person’s role. Use Add user at the top to create an account.'));
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
      ? "Choose the folder each list's Sphinx exports (.xls or .csv) are saved to. All new files are scanned and imported when you open this page or choose a folder, then every minute while this page is open. Imported results await review. Folders are remembered in this browser on this computer (Chrome or Edge)."
      : "The folder (on this PC or a network share it can read) each list's Sphinx exports (.xls or .csv) are saved to. All new files are scanned and imported when you open this page or choose a folder, then every minute while this page is open. Imported results await review."));
  const rows = [];
  for (const m of machines.filter((x) => x.active)) {
    for (const a of await api("GET", `/api/machines/${m.id}/assignments`)) {
      const status = el("span", { class: "muted small" }, a.import_folder ? "Checking…" : "No folder");
      let scanning = false;
      const rejected = new Map();
      const check = async () => {
        if (scanning) return;
        scanning = true;
        if (!a.import_folder && !window.localApi) { status.textContent = "No folder"; scanning = false; return; }
        try {
          const r = await api("GET", `/api/assignments/${a.id}/files`);
          if (r.permission === "none" && window.localApi) { status.textContent = "No folder chosen on this computer"; return; }
          if (r.permission && r.permission !== "granted" && r.permission !== "none") { status.textContent = "Needs permission again (open the list's Perform page)"; return; }
          const waiting = r.files.filter((f) => !f.run_id && !rejected.has(`${f.path}|${f.modified}|${f.size}`));
          let imported = 0;
          for (const file of waiting) {
            status.textContent = `Scanning ${file.name}… (${++imported}/${waiting.length})`;
            try {
              const upload = await api("GET", `/api/assignments/${a.id}/file?path=${encodeURIComponent(file.path)}`);
              const result = await api("POST", `/api/assignments/${a.id}/sphinx/import`, { files: [upload], historical: false });
              for (const skip of result.skipped) rejected.set(`${file.path}|${file.modified}|${file.size}`, `${file.name}: ${skip.reason}`);
            } catch (err) { rejected.set(`${file.path}|${file.modified}|${file.size}`, `${file.name}: ${err.message}`); }
          }
          status.replaceChildren(chip(rejected.size ? "due" : "pass", `${r.files.length} files scanned${rejected.size ? ` · ${rejected.size} need attention` : " · Up to date"}`));
          if (rejected.size) status.append(el("details", {}, el("summary", {}, "File details"), ...[...rejected.values()].map((reason) => el("div", { class: "small" }, reason))));
        } catch (err) {
          status.replaceChildren(el("span", { class: "error small" }, err.message));
        } finally { scanning = false; }
      };
      const onFolderChange = (event) => { if (Number(event.detail) === Number(a.id)) check(); };
      window.addEventListener("import-folder-changed", onFolderChange);
      const timer = setInterval(() => {
        if (!status.isConnected) { clearInterval(timer); window.removeEventListener("import-folder-changed", onFolderChange); return; }
        if (!document.hidden) check();
      }, 60000);
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
        can("manage_users") && !info.managed ? dbSwitchForm(info.path) : null));
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
