/* ================= חמ"ל תאילנד — לוגיקה ================= */
"use strict";

/* ---------- כלים ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ils = n => "₪" + Math.round(n).toLocaleString("he-IL");
const gmapsUrl = p => p.placeId
  ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.placeId}`
  : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

function toast(msg, opts) {
  const t = $("#toast");
  t.innerHTML = esc(msg) + (opts && opts.action ? `<button id="toastAct">${esc(opts.action)}</button>` : "");
  if (opts && opts.action) $("#toastAct").addEventListener("click", () => {
    t.classList.remove("on");
    opts.onAction();
  });
  t.classList.add("on");
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove("on"), opts && opts.action ? 6000 : 2200);
}

/* ---------- מצב (state) ---------- */
const LS_KEY = "thailand-hamal-v1";

function defaultState() {
  return {
    v: 1, updatedAt: "",
    tasks: {},            // taskId -> true (בוצע)
    custom: [],           // [{id,t,done}]
    hotelChoice: { phuket: null, aonang: null },
    split: "8+5",
    payments: {},         // budgetId -> {amount, note}
    saved: {},            // attractionId -> true
    tripStart: "", tripEnd: "",
    hideHowto: false
  };
}

function migrate(o) {
  const d = defaultState();
  if (!o || typeof o !== "object") return d;
  return {
    ...d, ...o,
    tasks: o.tasks || {}, custom: Array.isArray(o.custom) ? o.custom : [],
    hotelChoice: { ...d.hotelChoice, ...(o.hotelChoice || {}) },
    payments: o.payments || {}, saved: o.saved || {}
  };
}

let state = defaultState();
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) state = migrate(JSON.parse(raw));
} catch (e) { /* אחסון לא זמין — ממשיכים בזיכרון */ }

/* ---------- סנכרון ענן (Artifact db) ---------- */
let dbDoc = null, cloudTimer = null;

function setSync(mode, label) {
  const b = $("#syncBadge");
  b.classList.remove("on", "local");
  b.classList.add(mode === "on" ? "on" : "local");
  $("#syncTxt").textContent = label || (mode === "on" ? "מסונכרן בענן" : "מקומי");
}

async function initCloud() {
  if (!(window.claude && window.claude.use)) { setSync("local"); return; }
  try {
    const db = await window.claude.use("db");
    if (!db) { setSync("local"); return; }
    dbDoc = db.doc("state/main");
    dbDoc.onSnapshot(snap => {
      setSync("on");
      if (snap.exists) {
        const r = snap.data();
        if (r && r.updatedAt && (!state.updatedAt || r.updatedAt > state.updatedAt)) {
          state = migrate(r);
          persistLocal();
          renderAll();
        }
      }
    }, () => setSync("local"));
  } catch (e) { setSync("local"); }
}

function persistLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { }
}

function save() {
  state.updatedAt = new Date().toISOString();
  persistLocal();
  if (dbDoc) {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => dbDoc.set(JSON.parse(JSON.stringify(state))).catch(() => { }), 700);
  }
  if (fsHandle) {
    clearTimeout(fsTimer);
    fsTimer = setTimeout(fsWrite, 900);
  }
}

/* ---------- ניווט ---------- */
function gotoView(name) {
  if (!document.getElementById("view-" + name)) return;
  $$("nav.tabs button").forEach(b => {
    const on = b.dataset.view === name;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  $$("section.view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  history.replaceState(null, "", "#" + name);
  window.scrollTo({ top: 0 });
}
$$("nav.tabs button").forEach(btn => btn.addEventListener("click", () => gotoView(btn.dataset.view)));
if (location.hash.length > 1) gotoView(location.hash.slice(1));

/* ---------- משימות: נתוני עזר ---------- */
function allTasksFlat() {
  const out = [];
  STAGES.forEach((s, si) => s.tasks.forEach((t, ti) =>
    out.push({ ...t, stage: si, seq: si + "." + (ti + 1), stageName: s.name })));
  state.custom.forEach(t =>
    out.push({ id: t.id, t: t.t, n: "", stage: 99, seq: "★", stageName: "המשימות שלי", custom: true, done: t.done }));
  return out;
}
const isDone = t => t.custom ? !!t.done : !!state.tasks[t.id];

function completeTask(t) {
  if (t.custom) {
    const c = state.custom.find(x => x.id === t.id);
    if (c) c.done = true;
  } else state.tasks[t.id] = true;
  save(); renderTasksArea(); renderOverview();
}

/* רינדור דחוי קלות אחרי סימון — נותן לאנימציית ה-✓ להסתיים לפני שהרשימה מתעדכנת */
function settleTasks() {
  clearTimeout(settleTasks._h);
  settleTasks._h = setTimeout(() => { renderTasksArea(); renderOverview(); }, 220);
}
function buzz() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } }

/* ---------- דדליינים לפי תאריך היציאה ---------- */
const STAGE_DUE = { s0: 45, s1: 35, s2: 25, s3: 14, s4: 2 }; // כמה ימים לפני היציאה השלב צריך להיסגר

function dueInfo(sid) {
  if (!state.tripStart || STAGE_DUE[sid] == null) return null;
  const d = new Date(state.tripStart + "T00:00:00");
  if (isNaN(d)) return null;
  d.setDate(d.getDate() - STAGE_DUE[sid]);
  const days = Math.round((d - new Date().setHours(0, 0, 0, 0)) / 864e5);
  const dateTxt = d.getDate() + "." + (d.getMonth() + 1);
  if (days < 0) return { cls: "overdue", days, txt: `עד ${dateTxt} · באיחור ${days === -1 ? "יום" : -days + " ימים"}` };
  if (days === 0) return { cls: "overdue", days, txt: "עד היום!" };
  if (days === 1) return { cls: "soon", days, txt: `עד מחר (${dateTxt})` };
  return { cls: days <= 7 ? "soon" : "", days, txt: `עד ${dateTxt} · בעוד ${days} ימים` };
}

/* ---------- כפתורי פעולה למשימות ---------- */
/* לא toISOString — הוא ממיר ל-UTC ומזיז את התאריך יום אחורה בישראל */
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* קישורים דינמיים — נבנים לפי התאריכים, חלוקת הלילות והמלונות שנבחרו */
function actUrl(act) {
  const s = state.tripStart, e = state.tripEnd, n = nights();
  const gf = q => "https://www.google.com/travel/flights?q=" + encodeURIComponent(q);
  const bk = (ss, ci, co) => "https://www.booking.com/searchresults.he.il.html?ss=" + encodeURIComponent(ss)
    + "&group_adults=2&no_rooms=1&group_children=1&age=1" + (ci && co ? `&checkin=${ci}&checkout=${co}` : "");
  const hotel = base => HOTELS.find(h => h.id === state.hotelChoice[base]);
  switch (act) {
    case "flIntl": return gf(s && e ? `flights from TLV to BKK on ${s} through ${e}` : "flights from TLV to BKK");
    case "flOut": return gf(s ? `flights from BKK to HKT on ${s}` : "flights from BKK to HKT");
    case "flBack": return gf(e ? `flights from KBV to BKK on ${e}` : "flights from KBV to BKK");
    case "bkPhuket": { const h = hotel("phuket");
      return bk(h ? h.name + " Phuket" : "Kata Beach Phuket", s, s && addDays(s, n.phuket)); }
    case "bkAonang": { const h = hotel("aonang");
      return bk(h ? h.name + " Ao Nang" : "Ao Nang Krabi", s && addDays(s, n.phuket), s && addDays(s, n.phuket + n.aonang)); }
    case "bkBkk": return bk("Suvarnabhumi Airport Bangkok", s, s && addDays(s, 1));
    default: return "#";
  }
}

function taskLinksHtml(t) {
  if (!t.links || !t.links.length) return "";
  return `<span class="task-links">` + t.links.map(li => li.go
    ? `<button type="button" class="tlink" data-go="${li.go}">${esc(li.l)}</button>`
    : `<a class="tlink" target="_blank" rel="noopener" href="${esc(li.act ? actUrl(li.act) : li.u)}">${esc(li.l)} ↗</a>`
  ).join("") + `</span>`;
}

function wireGoLinks(root) {
  root.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation(); gotoView(b.dataset.go);
  }));
}

/* ---------- עכשיו בתור ---------- */
function renderNowNext() {
  const open = allTasksFlat().filter(t => !isDone(t));
  const box = $("#nowNext");
  if (!open.length) {
    box.innerHTML = `<p style="font-size:14px;margin:8px 0 0">הכול בוצע — אתם מוכנים לתאילנד! 🎉</p>`;
    return;
  }
  const [first, ...rest] = open;
  const di = first.custom ? null : dueInfo(STAGES[first.stage] && STAGES[first.stage].id);
  const dueHtml = di
    ? `<span class="nn-due ${di.cls}">⏳ ${esc(di.txt)}</span>`
    : !state.tripStart
      ? `<span class="nn-due"><button type="button" class="tlink" data-go="overview">בחרו תאריכי טיול לקבלת דדליינים</button></span>`
      : "";
  box.innerHTML = `
    <div class="nn-first">
      <span class="seq">${esc(first.seq)}</span>
      <span class="txt"><b>${esc(first.t)}</b>${first.n ? `<span class="n">${esc(first.n)}</span>` : ""}${dueHtml}${taskLinksHtml(first)}</span>
      <button class="nn-done" id="nnDone">סיימתי ✓</button>
    </div>
    ${rest.length ? `<ul class="nn-rest">${rest.slice(0, 2).map(t =>
      `<li><span class="seq">${esc(t.seq)}</span><span>אחר כך: ${esc(t.t)}</span></li>`).join("")}</ul>` : ""}`;
  $("#nnDone").addEventListener("click", () => { completeTask(first); toast("יפה! הלאה 💪"); });
  wireGoLinks(box);
}

/* ---------- שלבים כאקורדיון ---------- */
let onlyOpen = false;
const stageOpenMap = {};

function stageState(si, currentIdx) {
  const s = STAGES[si];
  const open = s.tasks.filter(t => !state.tasks[t.id]).length;
  if (!open) return "done";
  return si === currentIdx ? "current" : (si < currentIdx ? "current" : "future");
}

function renderStages() {
  const box = $("#stagesBox");
  const currentIdx = STAGES.findIndex(s => s.tasks.some(t => !state.tasks[t.id]));
  const flat = allTasksFlat();
  const openCount = flat.filter(t => !isDone(t)).length;
  $("#tasksCount").textContent = `נותרו ${openCount} מתוך ${flat.length}`;

  const taskRow = (t, seq, checked, delBtn) => {
    if (onlyOpen && checked) return "";
    return `<label class="task ${checked ? "done" : ""}">
      <input type="checkbox" ${t.custom ? `data-custom="${t.id}"` : `data-task="${t.id}"`} ${checked ? "checked" : ""}>
      <span class="seq">${esc(seq)}</span>
      <span><span class="t">${esc(t.t)}</span>${t.n ? `<div class="n">${esc(t.n)}</div>` : ""}${checked ? "" : taskLinksHtml(t)}</span>
      ${delBtn ? `<button class="del" data-del="${t.id}" aria-label="מחיקה">✕</button>` : ""}
    </label>`;
  };

  let html = STAGES.map((s, si) => {
    const done = s.tasks.filter(t => state.tasks[t.id]).length;
    const st = stageState(si, currentIdx);
    const isOpen = stageOpenMap[s.id] ?? (st === "current");
    const di = dueInfo(s.id);
    const when = st === "done" ? "הושלם ✓" : di ? di.txt : (s.urgent ? "בשבועיים הקרובים" : si === 2 ? "אחרי סגירת טיסות" : si === 3 ? "חודש לפני" : si === 4 ? "שבוע לפני" : "");
    return `<details class="stage-acc" data-sid="${s.id}" data-state="${st}" ${isOpen ? "open" : ""}>
      <summary>
        <span class="snum num">${si}</span>
        <span class="stitle"><b>${esc(s.name.replace(/^שלב \d — /, ""))}</b><span class="when ${st !== "done" && di ? di.cls : ""}">${esc(when)}</span></span>
        ${s.urgent && st !== "done" ? '<span class="pill warm">דחוף</span>' : ""}
        <span class="sprog"><span class="cnt">${done}/${s.tasks.length}</span>
          <span class="sbar"><i style="width:${s.tasks.length ? Math.round(done / s.tasks.length * 100) : 0}%"></i></span></span>
        ${CHEV}
      </summary>
      <div class="stage-body">
        ${s.why ? `<div class="why">${esc(s.why)}</div>` : ""}
        ${s.tasks.map((t, ti) => taskRow(t, si + "." + (ti + 1), !!state.tasks[t.id], false)).join("")}
      </div>
    </details>`;
  }).join("");

  // המשימות שלי
  const myDone = state.custom.filter(t => t.done).length;
  const myOpen = stageOpenMap["mine"] ?? state.custom.length > 0;
  html += `<details class="stage-acc" data-sid="mine" ${myOpen ? "open" : ""}>
    <summary>
      <span class="snum">★</span>
      <span class="stitle"><b>המשימות שלי</b><span class="when">דברים שהוספתם</span></span>
      <span class="sprog"><span class="cnt">${myDone}/${state.custom.length}</span></span>
      ${CHEV}
    </summary>
    <div class="stage-body">
      ${state.custom.map(t => taskRow({ ...t, custom: true }, "★", !!t.done, true)).join("")}
      <div class="addtask">
        <input id="newTask" placeholder="משהו שחשבתם עליו? הוסיפו כאן" maxlength="140">
        <button id="addTaskBtn">הוספה</button>
      </div>
    </div>
  </details>`;

  box.innerHTML = html;

  box.querySelectorAll("details.stage-acc").forEach(d =>
    d.addEventListener("toggle", () => { stageOpenMap[d.dataset.sid] = d.open; }));
  box.querySelectorAll("input[data-task]").forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) { state.tasks[cb.dataset.task] = true; buzz(); }
    else delete state.tasks[cb.dataset.task];
    save(); settleTasks();
  }));
  box.querySelectorAll("input[data-custom]").forEach(cb => cb.addEventListener("change", () => {
    const t = state.custom.find(x => x.id === cb.dataset.custom);
    if (t) t.done = cb.checked;
    if (cb.checked) buzz();
    save(); settleTasks();
  }));
  box.querySelectorAll("button[data-del]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault();
    const removed = state.custom.find(x => x.id === b.dataset.del);
    state.custom = state.custom.filter(x => x.id !== b.dataset.del);
    save(); renderTasksArea(); renderOverview();
    if (removed) toast(`המשימה "${removed.t.length > 26 ? removed.t.slice(0, 26) + "…" : removed.t}" נמחקה`, {
      action: "ביטול",
      onAction: () => { state.custom.push(removed); save(); renderTasksArea(); renderOverview(); }
    });
  }));
  const add = () => {
    const inp = $("#newTask"), v = inp.value.trim();
    if (!v) return;
    state.custom.push({ id: "c" + Date.now(), t: v, done: false });
    stageOpenMap["mine"] = true;
    save(); renderTasksArea(); renderOverview();
  };
  $("#addTaskBtn").addEventListener("click", add);
  $("#newTask").addEventListener("keydown", e => { if (e.key === "Enter") add(); });
  wireGoLinks(box);
}

function renderTasksArea() { renderNowNext(); renderStages(); }

$("#onlyOpen").addEventListener("change", e => { onlyOpen = e.target.checked; renderStages(); });

/* ---------- סקירה ---------- */
function renderOverview() {
  const flat = allTasksFlat();
  const open = flat.filter(t => !isDone(t));
  const doneCount = flat.length - open.length;

  $("#cTasks").textContent = open.length;
  const paid = Object.values(state.payments).reduce((a, p) => a + (+p.amount || 0), 0);
  $("#cPaid").textContent = Math.round(paid).toLocaleString("he-IL");
  if (state.tripStart) {
    const days = Math.ceil((new Date(state.tripStart) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    $("#cDays").textContent = days >= 0 ? days : "יצאנו!";
  } else $("#cDays").textContent = "—";

  const pct = flat.length ? doneCount / flat.length : 0;
  const C = 2 * Math.PI * 30;
  $("#ringBox").innerHTML = `<svg viewBox="0 0 74 74" width="74" height="74" role="img" aria-label="התקדמות">
    <circle class="bgc" cx="37" cy="37" r="30"/>
    <circle class="fgc" cx="37" cy="37" r="30" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
    <text x="37" y="42" text-anchor="middle" class="num">${Math.round(pct * 100)}%</text></svg>`;

  const next = open.slice(0, 3);
  $("#nextTasks").innerHTML = next.length
    ? next.map(t => `<li style="cursor:pointer" data-go-tasks><span class="stage-tag">${esc(t.seq)}</span><span>${esc(t.t)}</span></li>`).join("")
    : `<li>הכול מסומן — כל הכבוד! 🎉</li>`;
  $$("#nextTasks [data-go-tasks]").forEach(li => li.addEventListener("click", () => gotoView("tasks")));

  const urgentOpen = flat.filter(t => (t.stage === 0 || t.stage === 1) && !isDone(t)).length;
  const badge = $("#taskBadge");
  badge.hidden = urgentOpen === 0;
  badge.textContent = urgentOpen;

  const tot = budgetTotals();
  $("#ovEst").textContent = ils(tot.typ);
  $("#ovPaid").textContent = ils(tot.paid);
  const w = Math.min(100, tot.typ ? tot.paid / tot.typ * 100 : 0);
  $("#ovBar").innerHTML = `<i style="width:${w}%"></i>`;
  $("#ovBarL").textContent = "שולם " + ils(tot.paid);
  $("#ovBarR").textContent = "מתוך ~" + ils(tot.typ);

  $("#tripStart").value = state.tripStart || "";
  $("#tripEnd").value = state.tripEnd || "";

  const dn = $("#dateNights");
  if (state.tripStart && state.tripEnd) {
    const diff = Math.round((new Date(state.tripEnd) - new Date(state.tripStart)) / 864e5);
    if (diff < 1) { dn.hidden = false; dn.innerHTML = `⚠️ תאריך החזרה לפני היציאה`; }
    else {
      const n = nights();
      dn.hidden = false;
      dn.innerHTML = `סה"כ <b class="num">${diff}</b> לילות · <span class="num">${n.phuket}</span> פוקט + <span class="num">${n.aonang}</span> אאו נאנג`;
    }
  } else dn.hidden = true;

  $("#howtoCard").hidden = !!state.hideHowto;
}

$("#howtoClose").addEventListener("click", () => { state.hideHowto = true; save(); renderOverview(); });
function onDatesChanged() {
  save(); renderOverview(); renderWxTrip(); renderTasksArea();
  renderLegs(); renderHotels(); renderBudget(); // הלילות והעלויות נגזרים מהתאריכים
}
$("#tripStart").addEventListener("change", e => { state.tripStart = e.target.value; onDatesChanged(); });
$("#tripEnd").addEventListener("change", e => { state.tripEnd = e.target.value; onDatesChanged(); });

function renderEmergency() {
  $("#emgList").innerHTML = EMERGENCY.map(e => `
    <div class="row"><span><b>${esc(e.l)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(e.s)}</div></span>
    ${e.tel ? `<a class="call" href="tel:${e.tel}">חיוג</a>` : ""}</div>`).join("");
}

/* ---------- מזג אוויר לתאריכי הטיול ---------- */
/* אומדן אקלימי: הסתברות יומית לממטר, לפי עוגנים מ-WMO/WeatherSpark (אוק' יורד, נוב' ממשיך לרדת) */
const RAIN_ANCHORS = {
  phuket: [[930, .70], [1001, .68], [1015, .65], [1025, .63], [1031, .61], [1107, .52], [1115, .45], [1122, .41], [1130, .38], [1215, .32], [1231, .30]],
  aonang: [[930, .72], [1001, .70], [1015, .67], [1025, .65], [1031, .63], [1107, .58], [1115, .53], [1122, .49], [1130, .45], [1215, .38], [1231, .35]]
};
const TEMPS = { phuket: { 10: [31.5, 25.1], 11: [32.1, 25.2], 12: [32.3, 24.8] }, aonang: { 10: [30.8, 24.6], 11: [30.8, 24.4], 12: [31.0, 24.2] } };

function rainP(city, date) {
  const key = (date.getMonth() + 1) * 100 + date.getDate();
  const A = RAIN_ANCHORS[city];
  if (key <= A[0][0]) return A[0][1];
  for (let i = 1; i < A.length; i++) {
    if (key <= A[i][0]) {
      const [k0, p0] = A[i - 1], [k1, p1] = A[i];
      return p0 + (p1 - p0) * (key - k0) / (k1 - k0);
    }
  }
  return A[A.length - 1][1];
}

/* אייקוני מזג אוויר */
const WX_ICONS = {
  sun: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="var(--warm)" stroke="none"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.9 1.9M17.1 17.1L19 19M19 5l-1.9 1.9M6.9 17.1L5 19"/></svg>',
  partly: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8.6" r="3.4" fill="var(--warm)"/><path d="M8.2 17.6h8.6a3.2 3.2 0 0 0 .4-6.4 4.6 4.6 0 0 0-9-.5 2.7 2.7 0 0 0 0 6.9z" fill="var(--muted)"/></svg>',
  cloud: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 16.5h9.5a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.8-.5 2.9 2.9 0 0 0-.1 7.3z" fill="var(--muted)"/></svg>',
  rain: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 14h9.5a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.8-.5A2.9 2.9 0 0 0 7 14z" fill="var(--muted)"/><path d="M8.8 16.6l-1 2.6M12.8 16.6l-1 2.6M16.8 16.6l-1 2.6" stroke="var(--sea-ink)" stroke-width="1.8" stroke-linecap="round"/></svg>',
  storm: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 13.5h9.5a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.8-.5 2.9 2.9 0 0 0-.1 7.3z" fill="var(--muted)"/><path d="M13.2 13l-2.7 4.2h2.4l-1.5 3.8 4.7-5.3h-2.5l1.7-2.7z" fill="var(--warn)"/></svg>'
};
const iconByP = p => p <= .45 ? WX_ICONS.sun : p <= .58 ? WX_ICONS.partly : p <= .72 ? WX_ICONS.rain : WX_ICONS.storm;
const iconByCode = c => c === 0 ? WX_ICONS.sun : c <= 2 ? WX_ICONS.partly : c === 3 ? WX_ICONS.cloud : c <= 82 ? WX_ICONS.rain : WX_ICONS.storm;

let wxForecast = null; // {phuket:{'YYYY-MM-DD':{p,hi,lo}}, aonang:{...}} — תחזית אמת כשקרובים

function tripDays() {
  if (!state.tripStart || !state.tripEnd) return [];
  const out = [];
  const d = new Date(state.tripStart), end = new Date(state.tripEnd);
  if (!(d <= end)) return [];
  while (d <= end && out.length < 40) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function renderWxTrip() {
  const box = $("#wxTrip");
  const days = tripDays();
  if (!days.length) {
    box.innerHTML = `<div class="wxt-set">
      <span>בחרו תאריכי יציאה וחזרה למעלה — או התחילו מהצעה:</span>
      <button id="wxSuggest">25.10 – 07.11 (14 יום)</button></div>
      <p class="wxt-note">התאריכים משפיעים גם על הספירה לאחור ועל חישוב הלילות.</p>`;
    $("#wxSuggest").addEventListener("click", () => {
      state.tripStart = "2026-10-25"; state.tripEnd = "2026-11-07";
      onDatesChanged(); toast("נקבע טווח לדוגמה — אפשר לשנות");
    });
    return;
  }

  const iso = d => d.toISOString().slice(0, 10);
  const month = days[Math.floor(days.length / 2)].getMonth() + 1;
  const t = city => (TEMPS[city][month] || TEMPS[city][11]);
  const pOf = (city, d) => {
    const f = wxForecast && wxForecast[city] && wxForecast[city][iso(d)];
    if (f) return { p: f.p, hi: f.hi, lo: f.lo, live: true };
    const [hi, lo] = TEMPS[city][(d.getMonth() + 1)] || t(city);
    return { p: rainP(city, d), hi, lo, live: false };
  };

  const sumCity = city => {
    const wet = days.reduce((a, d) => a + pOf(city, d).p, 0);
    return { wet: Math.round(wet), t: t(city) };
  };
  const p1 = sumCity("phuket"), p2 = sumCity("aonang");
  const liveDays = wxForecast ? days.filter(d => wxForecast.phuket[iso(d)]).length : 0;

  const strip = city => days.map(d => {
    const { p, hi, lo, live } = pOf(city, d);
    const cls = p <= .5 ? "g" : p <= .62 ? "w" : "h";
    return `<div class="wxt-day ${cls}" title="${live ? "תחזית אמת" : "אומדן אקלימי"}">
      <div class="dn">${d.toLocaleDateString("he-IL", { weekday: "short" })}</div>
      <div class="dt num">${d.getDate()}.${d.getMonth() + 1}</div>
      ${iconByP(p)}
      <div class="tmp num">${Math.round(hi)}°<small>/${Math.round(lo)}°</small></div>
      <div class="pp num">☂ ${Math.round(p * 100)}%</div></div>`;
  }).join("");

  const trendNote = days[0].getMonth() === 9
    ? "המגמה לטובתכם: הגשם יורד בהתמדה לאורך הטיול — החצי השני צפוי יבש משמעותית."
    : "נובמבר הוא תחילת העונה היבשה — ממטרים קצרים אחר הצהריים, לא ימים אבודים.";

  box.innerHTML = `
    <div class="wxt-sum">
      <div class="row"><span class="city">פוקט</span><span>${p1.t[0]}° / ${p1.t[1]}° · ים 29° · צפי <b>~${p1.wet}</b> ימים עם ממטר מתוך ${days.length}</span></div>
      <div class="row"><span class="city">אאו נאנג</span><span>${p2.t[0]}° / ${p2.t[1]}° · ים 29° · צפי <b>~${p2.wet}</b> ימים עם ממטר</span></div>
      ${liveDays ? `<div class="row"><span class="wxt-live">● תחזית אמת ל-${liveDays} הימים הראשונים (Open-Meteo)</span></div>` : ""}
    </div>
    <div class="wxt-strip-label">פוקט — סיכוי לממטר לפי יום</div>
    <div class="wxt-strip">${strip("phuket")}</div>
    <div class="wxt-strip-label">אאו נאנג</div>
    <div class="wxt-strip">${strip("aonang")}</div>
    <p class="wxt-note">${trendNote} האומדן לפי ממוצעים רב-שנתיים; תחזית אמיתית נטענת אוטומטית כשמתקרבים לתאריך.</p>`;
}

async function loadTripForecast() {
  const days = tripDays();
  if (!days.length) return;
  const daysAhead = (days[0] - new Date()) / 864e5;
  if (daysAhead > 15) return; // מחוץ לטווח תחזית
  const iso = d => d.toISOString().slice(0, 10);
  const end = days[Math.min(days.length - 1, 15)];
  const q = (lat, lon) =>
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok&start_date=${iso(days[0])}&end_date=${iso(end)}`)
      .then(r => { if (!r.ok) throw 0; return r.json(); });
  try {
    const [p, a] = await Promise.all([q(7.89, 98.30), q(8.03, 98.82)]);
    wxForecast = { phuket: {}, aonang: {} };
    const fill = (obj, d) => d.daily.time.forEach((t, i) => obj[t] = {
      p: d.daily.precipitation_probability_max[i] / 100,
      hi: d.daily.temperature_2m_max[i], lo: d.daily.temperature_2m_min[i]
    });
    fill(wxForecast.phuket, p); fill(wxForecast.aonang, a);
    renderWxTrip();
  } catch (e) { /* אין רשת/CSP — נשארים עם האומדן */ }
}

/* ---------- מסלול ---------- */
/* סה"כ לילות נגזר מהתאריכים שנבחרו; 13 כברירת מחדל עד שיש תאריכים */
function totalNights() {
  if (state.tripStart && state.tripEnd) {
    const n = Math.round((new Date(state.tripEnd) - new Date(state.tripStart)) / 864e5);
    if (n >= 2 && n <= 40) return n;
  }
  return 13;
}
/* "8+5" = יותר פוקט, "7+6" = חלוקה מאוזנת — הערכים נשמרים כמזהים גם כשהסה"כ שונה מ-13 */
function nights() {
  const total = totalNights();
  const half = Math.floor(total / 2);
  const aonang = state.split === "7+6" ? half : Math.max(1, half - 1);
  return { phuket: total - aonang, aonang, total };
}

const IC = {
  plane: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M5 16l1.5-4.5a2 2 0 0 1 1.9-1.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><path d="M4 16h16v3h-2m-12 0H4z"/><circle cx="7.5" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/></svg>',
  bed: '<svg viewBox="0 0 24 24"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20"/><path d="M6 10V7h5v3"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/></svg>'
};

function renderLegs() {
  const n = nights();
  const legs = [
    { ic: "plane", t: "טיסה בינלאומית · ת\"א → בנגקוק", d: "ישיר (אל על) או קונקשן: איסטנבול / דובאי / דוחא", dur: "11–16 ש'" },
    { ic: "moon", t: "אם הנחיתה בערב/לילה: לילה ליד השדה", d: "לא לגרור תינוקת בקונקשן לילי — ממשיכים בבוקר", dur: "לילה" },
    { ic: "plane", t: "טיסה פנימית · בנגקוק → פוקט (HKT)", d: "תדירות גבוהה: Thai / Bangkok Airways / AirAsia", dur: "‎~1:20" },
    { ic: "bed", t: `בסיס 1 · פוקט`, d: "חופים, שווקי לילה, קאטה נוי / באנג טאו", dur: n.phuket + " לילות", base: true },
    { ic: "car", t: "מעבר יבשתי · פוקט → אאו נאנג", d: "רכב פרטי עם כיסא בטיחות, כביש טוב, אפשר לעצור באמצע", dur: "‎~3 ש'" },
    { ic: "bed", t: `בסיס 2 · אאו נאנג (קראבי)`, d: "חוף, Walking Street, שוק לילה, נוף צוקים — הכול בהליכה", dur: n.aonang + " לילות", base: true },
    { ic: "plane", t: "טיסה פנימית · קראבי (KBV) → בנגקוק", d: "בלי לחזור לפוקט — חוסך 3 שעות", dur: "‎~1:20" },
    { ic: "plane", t: "טיסה בינלאומית · בנגקוק → ת\"א", d: "הביתה עם מלא תמונות", dur: "" }
  ];
  $("#legsBox").innerHTML = legs.map(l => `
    <li class="leg ${l.base ? "base" : ""}"><span class="ic">${IC[l.ic]}</span>
      <span class="bd"><b>${esc(l.t)}</b><div class="d">${esc(l.d)}</div></span>
      ${l.dur ? `<span class="dur">${esc(l.dur)}</span>` : ""}</li>`).join("");

  const half = Math.floor(n.total / 2);
  $$("#splitToggle button").forEach(b => {
    const ao = b.dataset.split === "7+6" ? half : Math.max(1, half - 1);
    b.textContent = `${n.total - ao} לילות פוקט + ${ao} אאו נאנג`;
    b.classList.toggle("active", b.dataset.split === state.split);
  });
}

$$("#splitToggle button").forEach(b => b.addEventListener("click", () => {
  state.split = b.dataset.split;
  save(); renderLegs(); renderHotels(); renderBudget(); renderOverview(); renderTasksArea();
}));

/* ---------- מפה ---------- */
const MAP_VIEWS = {
  overview: { lon0: 98.20, lon1: 99.34, lat0: 7.70, lat1: 8.21 },
  phuket: { lon0: 98.22, lon1: 98.47, lat0: 7.72, lat1: 8.12 },
  aonang: { lon0: 98.64, lon1: 98.98, lat0: 7.93, lat1: 8.15 }
};
let mapView = "overview", mapKind = "all", leafState = null;

/* קווי חוף מקורבים (lon,lat) */
const GEO = {
  phuketIsland: [[98.30, 8.20], [98.27, 8.14], [98.245, 8.05], [98.25, 7.93], [98.268, 7.82], [98.30, 7.748], [98.335, 7.78], [98.36, 7.79], [98.40, 7.80], [98.412, 7.82], [98.42, 7.90], [98.437, 7.99], [98.428, 8.06], [98.40, 8.10], [98.35, 8.16]],
  mainland: [[98.70, 8.21], [98.715, 8.115], [98.735, 8.062], [98.758, 8.047], [98.79, 8.05], [98.807, 8.038], [98.818, 8.030], [98.83, 8.016], [98.836, 8.002], [98.85, 8.0], [98.868, 8.012], [98.884, 8.024], [98.9, 8.038], [98.908, 8.052], [98.92, 8.09], [98.94, 8.06], [98.96, 8.02], [99.0, 7.95], [99.08, 7.88], [99.2, 7.82], [99.34, 7.78], [99.34, 8.21]],
  islands: [[98.686, 8.072, 0.014], [98.676, 8.050, 0.009], [98.82, 7.952, 0.008]]
};

const HOTEL_SHORT = {
  katathani: "Katathani", saii: "SAii", "centara-grand": "Centara", angsana: "Angsana",
  dusit: "Dusit", "kata-palm": "Kata Palm", "centara-aonang": "Centara", avani: "Avani", "holiday-inn": "Holiday Inn"
};

function mapPlaces() {
  const pl = [];
  HOTELS.forEach(h => pl.push({
    kind: "hotel", id: "h_" + h.id, name: h.name, short: HOTEL_SHORT[h.id] || "", desc: h.area + (h.rating ? " · דירוג " + h.rating : ""),
    lat: h.lat, lng: h.lng, placeId: h.placeId, phone: h.phone, site: h.site,
    chosen: state.hotelChoice[h.base] === h.id
  }));
  ATTS.forEach(a => pl.push({
    kind: "att", id: "a_" + a.id, name: a.name, desc: a.desc, extra: a.baby,
    cost: a.cost, time: a.time, lat: a.lat, lng: a.lng
  }));
  MEDICAL.forEach(m => pl.push({
    kind: "med", id: "m_" + m.id, name: m.name, short: "בי\"ח", desc: m.desc, lat: m.lat, lng: m.lng, phone: m.phone
  }));
  return pl;
}

function showPlaceSheet(p) {
  const sh = $("#placeSheet");
  sh.className = "place-sheet on";
  sh.innerHTML = `<button class="close" id="sheetClose" aria-label="סגירה">✕</button>
    <b>${esc(p.name)}</b><div class="d">${esc(p.desc || "")}</div>
    ${p.extra ? `<div class="d">👶 ${esc(p.extra)}</div>` : ""}
    ${p.cost || p.time ? `<div class="d">${esc([p.cost, p.time].filter(Boolean).join(" · "))}</div>` : ""}
    <div class="links">
      <a target="_blank" rel="noopener" href="${gmapsUrl(p)}">פתיחה ב-Google Maps</a>
      ${p.phone ? `<a href="tel:${p.phone.replace(/\s/g, "")}">חיוג</a>` : ""}
      ${p.site ? `<a target="_blank" rel="noopener" href="${esc(p.site)}">אתר</a>` : ""}
    </div>`;
  $("#sheetClose").addEventListener("click", () => { sh.className = "place-sheet"; sh.innerHTML = ""; });
}

function renderSchemap() {
  const V = MAP_VIEWS[mapView];
  const dlon = V.lon1 - V.lon0, dlat = V.lat1 - V.lat0;
  const W = 1000, H = Math.round(dlat / (dlon * 0.9903) * W);
  const px = (lon, lat) => ({ x: (lon - V.lon0) / dlon * W, y: (V.lat1 - lat) / dlat * H });
  const pxl = 1000 / dlon; // פיקסלים למעלת אורך

  const poly = pts => "M" + pts.map(p => { const q = px(p[0], p[1]); return q.x.toFixed(0) + "," + q.y.toFixed(0); }).join(" L") + " Z";

  // נקודות בתחום + פיזור חופפים
  const inView = p => p.lng >= V.lon0 - 0.01 && p.lng <= V.lon1 + 0.01 && p.lat >= V.lat0 - 0.01 && p.lat <= V.lat1 + 0.01;
  const places = mapPlaces().filter(p => inView(p) && (mapKind === "all" || p.kind === mapKind));
  const seen = {};
  places.forEach(p => {
    const { x, y } = px(p.lng, p.lat);
    const key = Math.round(x / 30) + "_" + Math.round(y / 30);
    const i = seen[key] = (seen[key] || 0) + 1;
    const ang = (i - 1) * 2.2;
    p.x = x + (i > 1 ? Math.cos(ang) * 24 * Math.ceil((i - 1) / 2) : 0);
    p.y = y + (i > 1 ? Math.sin(ang) * 24 * Math.ceil((i - 1) / 2) : 0);
  });

  const detail = mapView !== "overview";
  const dots = places.map(p => {
    const col = { hotel: "var(--map-hotel)", att: "var(--map-att)", med: "var(--map-med)" }[p.kind];
    const r = p.kind === "att" ? 14 : 19;
    const ring = p.chosen ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 11}" fill="none" stroke="var(--map-hotel)" stroke-width="5"/>` : "";
    const cross = p.kind === "med" ? `<path d="M${p.x - 7} ${p.y}h14M${p.x} ${p.y - 7}v14" stroke="#fff" stroke-width="4.5"/>` : "";
    const label = detail && p.short
      ? `<text class="mklabel" x="${p.x + r + 8}" y="${p.y + 8}" font-size="36">${esc(p.short)}</text>` : "";
    return `<g class="mk" data-place="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}">
      <circle cx="${p.x}" cy="${p.y}" r="${r + 18}" fill="transparent"/>
      ${ring}<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${col}" stroke="var(--surface)" stroke-width="4"/>${cross}${label}</g>`;
  }).join("");

  const islands = GEO.islands
    .filter(([lo, la]) => lo >= V.lon0 && lo <= V.lon1 && la >= V.lat0 && la <= V.lat1)
    .map(([lo, la, r]) => { const q = px(lo, la); return `<ellipse cx="${q.x}" cy="${q.y}" rx="${r * pxl}" ry="${r * pxl}" fill="var(--surface2)" stroke="var(--line)" stroke-width="3"/>`; }).join("");

  let labels = "";
  if (mapView === "overview") {
    const l1 = px(98.34, 7.92), l2 = px(98.99, 8.10), sea = px(98.52, 7.83);
    labels = `<text x="${l1.x}" y="${l1.y}" font-size="34" fill="var(--muted)">פוקט</text>
      <text x="${l2.x}" y="${l2.y}" font-size="34" fill="var(--muted)">קראבי</text>
      <text x="${sea.x}" y="${sea.y}" font-size="30" fill="var(--sea-ink)" opacity=".8">הים האנדמני</text>`;
  } else if (mapView === "aonang") {
    const s = px(98.70, 8.00);
    labels = `<text x="${s.x}" y="${s.y}" font-size="30" fill="var(--sea-ink)" opacity=".75">הים האנדמני</text>`;
  } else {
    const s = px(98.245, 7.77);
    labels = `<text x="${s.x}" y="${s.y}" font-size="30" fill="var(--sea-ink)" opacity=".75">הים האנדמני</text>`;
  }

  $("#schemap").innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-label="מפת המסלול">
    <rect x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}" fill="var(--sea)"/>
    <path d="${poly(GEO.phuketIsland)}" fill="var(--surface2)" stroke="var(--line)" stroke-width="3"/>
    <path d="${poly(GEO.mainland)}" fill="var(--surface2)" stroke="var(--line)" stroke-width="3"/>
    ${islands}${labels}${dots}</svg>
    <div class="map-zoom"><button id="mzIn" aria-label="זום פנימה">+</button><button id="mzOut" aria-label="זום החוצה">−</button></div>`;
  attachSchemapPanZoom(W, H);

  $("#mapLegend").innerHTML = `
    <span class="k"><i class="swatch" style="background:var(--map-hotel)"></i>מלונות</span>
    <span class="k"><i class="swatch" style="background:var(--map-att)"></i>אטרקציות</span>
    <span class="k"><i class="swatch" style="background:var(--map-med)"></i>בתי חולים</span>`;

  const open = id => { const p = places.find(q => q.id === id); if (p) showPlaceSheet(p); };
  $$("#schemap .mk").forEach(g => {
    g.addEventListener("click", () => open(g.dataset.place));
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(g.dataset.place); } });
  });
}

function setMapView(v) {
  mapView = v;
  $$("#mapViews button").forEach(b => b.classList.toggle("active", b.dataset.mv === v));
  if (leafState) {
    const V = MAP_VIEWS[v];
    leafState.map.flyToBounds([[V.lat0, V.lon0], [V.lat1, V.lon1]], { padding: [14, 14] });
  } else renderSchemap();
}
function setMapKind(k) {
  mapKind = k;
  $$("#mapKinds button").forEach(b => b.classList.toggle("active", b.dataset.mk === k));
  if (leafState) {
    Object.entries(leafState.groups).forEach(([kind, grp]) => {
      if (k === "all" || k === kind) grp.addTo(leafState.map); else grp.remove();
    });
  } else renderSchemap();
}
$$("#mapViews button").forEach(b => b.addEventListener("click", () => setMapView(b.dataset.mv)));
$$("#mapKinds button").forEach(b => b.addEventListener("click", () => setMapKind(b.dataset.mk)));

/* פאן וזום על המפה הסכמטית: גלגלת / גרירה בעכבר, שתי אצבעות בנייד, וכפתורי +/− */
let schemapMoved = false;
function attachSchemapPanZoom(W, H) {
  const svg = $("#schemap svg");
  if (!svg) return;
  svg.style.touchAction = "pan-y";
  let vb = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const clampVb = () => {
    vb.w = Math.min(Math.max(vb.w, W / 8), W);
    vb.h = vb.w * H / W;
    vb.x = Math.min(Math.max(vb.x, -W * .05), W - vb.w + W * .05);
    vb.y = Math.min(Math.max(vb.y, -H * .05), H - vb.h + H * .05);
  };
  const zoomAt = (cx, cy, f) => {
    const r = svg.getBoundingClientRect();
    const gx = vb.x + (cx - r.left) / r.width * vb.w;
    const gy = vb.y + (cy - r.top) / r.height * vb.h;
    vb.w *= f; vb.h = vb.w * H / W;
    vb.x = gx - (cx - r.left) / r.width * vb.w;
    vb.y = gy - (cy - r.top) / r.height * vb.h;
    clampVb(); apply();
  };
  const center = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  $("#mzIn").addEventListener("click", () => zoomAt(...center(), 0.65));
  $("#mzOut").addEventListener("click", () => zoomAt(...center(), 1.55));
  svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0016)); }, { passive: false });
  svg.addEventListener("dblclick", e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, 0.6); });

  const ptrs = new Map();
  let last = null, pinchD = 0, pinchMid = null;
  svg.addEventListener("pointerdown", e => {
    ptrs.set(e.pointerId, e);
    schemapMoved = false;
    if (ptrs.size === 1) last = { x: e.clientX, y: e.clientY };
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinchD = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchMid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    }
    if (e.pointerType === "mouse") svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, e);
    const r = svg.getBoundingClientRect();
    if (ptrs.size === 1 && e.pointerType === "mouse" && last) {
      if (Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 3) { schemapMoved = true; svg.classList.add("panning"); }
      vb.x -= (e.clientX - last.x) / r.width * vb.w;
      vb.y -= (e.clientY - last.y) / r.height * vb.h;
      last = { x: e.clientX, y: e.clientY };
      clampVb(); apply();
    } else if (ptrs.size === 2) {
      e.preventDefault();
      schemapMoved = true;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      if (pinchD > 0 && d > 0) zoomAt(mid.x, mid.y, pinchD / d);
      if (pinchMid) {
        vb.x -= (mid.x - pinchMid.x) / r.width * vb.w;
        vb.y -= (mid.y - pinchMid.y) / r.height * vb.h;
        clampVb(); apply();
      }
      pinchD = d; pinchMid = mid;
    }
  }, { passive: false });
  const up = e => { ptrs.delete(e.pointerId); if (!ptrs.size) { svg.classList.remove("panning"); last = null; } pinchD = 0; pinchMid = null; };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  // גרירה לא נחשבת הקשה על נקודה
  svg.addEventListener("click", e => { if (schemapMoved) { e.stopPropagation(); schemapMoved = false; } }, true);
  apply();
}

/* שדרוג למפה אמיתית (Leaflet) כשהאריחים נגישים — למשל בפתיחה מקומית */
function tryLeaflet() {
  if (typeof L === "undefined") return;
  const test = new Image();
  test.onload = () => initLeaflet();
  test.onerror = () => { };
  test.src = "https://a.tile.openstreetmap.org/8/202/117.png";
}

function initLeaflet() {
  try {
    const box = $("#leafmap");
    box.style.display = "block";
    $("#schemap").style.display = "none";
    $("#mapNote").textContent = "מפה מלאה (OpenStreetMap). הקשה על נקודה — פרטים; הכפתורים למעלה ממקדים ומסננים.";
    const map = L.map(box, { scrollWheelZoom: true }).setView([7.95, 98.55], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    const colors = { hotel: "#2E6650", att: "#C05B38", med: "#B3362B" };
    const groups = { hotel: L.layerGroup(), att: L.layerGroup(), med: L.layerGroup() };
    mapPlaces().forEach(p => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: p.kind === "att" ? 6 : 8, color: "#fff", weight: 1.5,
        fillColor: colors[p.kind], fillOpacity: p.chosen ? 1 : 0.9
      });
      m.bindTooltip(p.name, { direction: "top", opacity: 0.9 });
      m.on("click", () => showPlaceSheet(p));
      m.addTo(groups[p.kind]);
    });
    Object.values(groups).forEach(g => g.addTo(map));
    leafState = { map, groups };
    setMapKind(mapKind);
  } catch (e) { /* נשארים עם הסכמטית */ }
}

/* רענון סמני המפה (בחירת מלון וכו') */
function refreshMap() {
  if (leafState) {
    Object.values(leafState.groups).forEach(g => g.clearLayers());
    const colors = { hotel: "#2E6650", att: "#C05B38", med: "#B3362B" };
    mapPlaces().forEach(p => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: p.kind === "att" ? 6 : 8, color: "#fff", weight: 1.5,
        fillColor: colors[p.kind], fillOpacity: p.chosen ? 1 : 0.9
      });
      m.bindTooltip(p.name, { direction: "top", opacity: 0.9 });
      m.on("click", () => showPlaceSheet(p));
      m.addTo(leafState.groups[p.kind]);
    });
    setMapKind(mapKind);
  } else renderSchemap();
}

/* קפיצה מהמלון אל המפה */
function showHotelOnMap(hotelId, base) {
  gotoView("route");
  setMapKind("all");
  setMapView(base);
  const p = mapPlaces().find(q => q.id === "h_" + hotelId);
  if (p) showPlaceSheet(p);
  setTimeout(() => $("#mapbox").scrollIntoView({ behavior: "smooth", block: "center" }), 60);
}

/* ---------- אטרקציות ---------- */
let attFilter = "all";

function renderAttFilter() {
  const chips = [["all", "הכול"], ["phuket", "פוקט"], ["aonang", "אאו נאנג"], ["saved", "★ שסימנתם"]];
  $("#attFilter").innerHTML = chips.map(([k, l]) =>
    `<button data-f="${k}" class="${attFilter === k ? "active" : ""}">${l}</button>`).join("");
  $$("#attFilter button").forEach(b => b.addEventListener("click", () => {
    attFilter = b.dataset.f; renderAttFilter(); renderAtts();
  }));
}

function renderAtts() {
  const list = ATTS.filter(a =>
    attFilter === "all" ? true :
      attFilter === "saved" ? state.saved[a.id] : a.base === attFilter);
  $("#attBox").innerHTML = list.length ? list.map(a => `
    <details class="att-acc ${state.saved[a.id] ? "saved" : ""}">
      <summary>
        <button class="star" data-star="${a.id}" aria-label="סימון">${state.saved[a.id] ? "★" : "☆"}</button>
        <span class="atitle"><b>${esc(a.name)}</b>
          <span class="apills">
            <span class="pill warm">${esc(a.cost)}</span>
            <span class="pill acc">${esc(a.time)}</span>
            <span class="pill acc">${a.base === "phuket" ? "פוקט" : "אאו נאנג"}</span>
          </span></span>
        ${CHEV}
      </summary>
      <div class="att-body">
        <div>${esc(a.desc)}</div>
        <div>👶 ${esc(a.baby)}</div>
        <div class="links">
          <a class="linkbtn" target="_blank" rel="noopener" href="${gmapsUrl(a)}">Google Maps</a>
        </div>
      </div>
    </details>`).join("") : `<p style="font-size:13px;color:var(--muted);margin-top:10px">עוד לא סימנתם כלום — הקישו על הכוכב ליד אטרקציה כדי לבנות רשימה שלכם.</p>`;

  $$("#attBox [data-star]").forEach(b => b.addEventListener("click", e => {
    e.preventDefault(); e.stopPropagation();
    if (state.saved[b.dataset.star]) delete state.saved[b.dataset.star];
    else state.saved[b.dataset.star] = true;
    save(); renderAtts();
  }));
}

/* ---------- מלונות ---------- */
function bookingUrl(h) {
  const area = h.base === "phuket" ? "Phuket" : "Ao Nang Krabi";
  return "https://www.booking.com/searchresults.he.il.html?ss=" + encodeURIComponent(h.name + " " + area);
}

let hotelFilter = "all";

function hotelPicksHtml(n) {
  const typCost = (h, nn) => (h.usd[0] + h.usd[1]) / 2 * nn * RATES.usd;
  const pick = base => {
    const label = (base === "phuket" ? "פוקט" : "אאו נאנג") + ` · ${n[base]} לילות`;
    const h = HOTELS.find(x => x.id === state.hotelChoice[base]);
    if (!h) return `<div class="pick empty"><span class="b">${label}</span><span>עוד לא נבחר — גללו ולחצו "בחירה"</span></div>`;
    return `<div class="pick"><span class="b">${label}</span><b>${esc(h.name)}</b>
      <span class="est num">~${ils(typCost(h, n[base]))} לכל השהות</span></div>`;
  };
  const chosen = ["phuket", "aonang"].map(b => HOTELS.find(x => x.id === state.hotelChoice[b]));
  const total = chosen[0] && chosen[1]
    ? typCost(chosen[0], n.phuket) + typCost(chosen[1], n.aonang) : 0;
  return `<div class="card">
    <h2>הבחירות שלכם <span class="sub">מתעדכן אוטומטית בתקציב</span></h2>
    <div class="picks">${pick("phuket")}${pick("aonang")}</div>
    ${total ? `<div class="picks-total">סה"כ לינה משוער לשני הבסיסים: <b class="num">${ils(total)}</b></div>` : ""}
  </div>`;
}

function renderHotels() {
  const n = nights();
  const groups = [
    ["phuket", `בסיס 1 — פוקט · ${n.phuket} לילות`],
    ["aonang", `בסיס 2 — אאו נאנג · ${n.aonang} לילות`]
  ].filter(([base]) => hotelFilter === "all" || base === hotelFilter);
  $("#hotelsBox").innerHTML = hotelPicksHtml(n) + `
    <div class="hotels-toolbar"><div class="seg" id="hotelSeg">
      <button data-hb="all" class="${hotelFilter === "all" ? "active" : ""}">שני הבסיסים</button>
      <button data-hb="phuket" class="${hotelFilter === "phuket" ? "active" : ""}">פוקט</button>
      <button data-hb="aonang" class="${hotelFilter === "aonang" ? "active" : ""}">אאו נאנג</button>
    </div></div>` + groups.map(([base, title]) => `
    <h2 style="font-size:17px;margin-top:20px">${title}</h2>
    ${HOTELS.filter(h => h.base === base).map(h => {
    const chosen = state.hotelChoice[base] === h.id;
    const ilsRange = `₪${Math.round(h.usd[0] * RATES.usd)}–${Math.round(h.usd[1] * RATES.usd)}`;
    return `<div class="hotel ${chosen ? "chosen" : ""}">
      ${h.img ? `<img class="photo" src="${esc(h.img)}" alt="${esc(h.name)}" loading="lazy" onerror="this.remove()">` : ""}
      <div class="hd"><span><b>${esc(h.name)}</b> ${h.rec ? '<span class="pill good">מומלץ</span>' : ""}
        <div class="area">${esc(h.area)}</div></span>
        <span class="rate">$${h.usd[0]}–${h.usd[1]}<br><small>${ilsRange} ללילה</small></span></div>
      <div class="bd">
        <div class="score">
          ${h.rating ? `<b>${h.rating}</b> ★ גוגל (${h.count.toLocaleString("he-IL")})` : ""}
          ${h.booking ? ` · Booking <b>${esc(h.booking)}</b>` : ""}
        </div>
        <ul class="pros">${h.pros.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
        ${h.warns.length ? `<div class="warns">${h.warns.map(w => `<div class="w">⚠ ${esc(w)}</div>`).join("")}</div>` : ""}
      </div>
      <div class="actions">
        <a class="linkbtn" target="_blank" rel="noopener" href="${bookingUrl(h)}">Booking</a>
        <button class="linkbtn" data-onmap="${h.id}" data-base="${base}">במפה</button>
        ${h.phone ? `<a class="linkbtn" href="tel:${h.phone.replace(/\s/g, "")}">חיוג</a>` : ""}
        ${h.site ? `<a class="linkbtn" target="_blank" rel="noopener" href="${esc(h.site)}">אתר</a>` : ""}
        <button class="choose" data-choose="${h.id}" data-base="${base}">${chosen ? "✓ נבחר" : "בחירה"}</button>
      </div></div>`;
  }).join("")}`).join("") +
    `<p style="font-size:12px;color:var(--muted);margin-top:14px">
      ⛔ ירדו מהרשימה: <b>Novotel Kata Avista</b> (גבעה תלולה שקשה עם עגלה + עבודות בנייה ודיווחי עובש ב-2025–26) ·
      <b>Aonang Villa</b> (תלונות חוזרות על מדיניות תשלום וחדרים בסיסיים).<br>
      ✔ כל המלונות אומתו מחדש ב-30.8.2026 מול Booking/TripAdvisor ואתרי המלונות.</p>`;

  $$("#hotelSeg [data-hb]").forEach(b => b.addEventListener("click", () => {
    hotelFilter = b.dataset.hb;
    renderHotels();
  }));
  $$("#hotelsBox [data-choose]").forEach(b => b.addEventListener("click", () => {
    const base = b.dataset.base;
    state.hotelChoice[base] = state.hotelChoice[base] === b.dataset.choose ? null : b.dataset.choose;
    save(); renderHotels(); renderBudget(); renderOverview(); refreshMap(); renderTasksArea();
    if (state.hotelChoice[base]) { buzz(); toast("המלון נבחר — התקציב התעדכן לפי הלילות"); }
  }));
  $$("#hotelsBox [data-onmap]").forEach(b => b.addEventListener("click", () =>
    showHotelOnMap(b.dataset.onmap, b.dataset.base)));
}

/* ---------- תקציב ---------- */
function budgetRow(b) {
  const n = nights();
  if (b.dyn) {
    const chosen = HOTELS.find(h => h.id === state.hotelChoice[b.dyn]);
    const nn = n[b.dyn];
    if (chosen) {
      const low = chosen.usd[0] * nn * RATES.usd, high = chosen.usd[1] * nn * RATES.usd;
      return { ...b, low, typ: (low + high) / 2, high, note: `לפי ${chosen.name} · ${nn} לילות` };
    }
    return { ...b, note: `טרם נבחר מלון — טווח כללי ל-${nn} לילות` };
  }
  if (b.perDay) {
    const days = n.total + 1, f = days / b.perDay;
    return { ...b, low: b.low * f, typ: b.typ * f, high: b.high * f, note: `${b.note} · לפי ${days} ימים` };
  }
  return b;
}

function budgetTotals() {
  let low = 0, typ = 0, high = 0, paid = 0;
  BUDGET.forEach(b => {
    const r = budgetRow(b);
    low += r.low; typ += r.typ; high += r.high;
    paid += +(state.payments[b.id]?.amount) || 0;
  });
  return { low, typ, high, paid };
}

function renderBudget() {
  const box = $("#budgetRows");
  box.innerHTML = BUDGET.map(b => {
    const r = budgetRow(b);
    const p = state.payments[b.id] || {};
    return `<div class="bud-row">
      <div class="top"><b>${esc(r.name)}</b>
        <span class="est">${ils(r.low)} · <b>${ils(r.typ)}</b> · ${ils(r.high)}</span></div>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}
      <div class="pay">
        <input type="number" min="0" inputmode="numeric" placeholder="₪ שולם" data-pay="${b.id}" value="${p.amount ?? ""}">
        <input type="text" placeholder="הערה (למשל: אל על, שולם 15.9)" data-note="${b.id}" value="${esc(p.note ?? "")}">
        ${+p.amount ? `<span class="paidtag">✓</span>` : ""}
      </div></div>`;
  }).join("");

  box.querySelectorAll("[data-pay]").forEach(inp => inp.addEventListener("input", () => {
    const id = inp.dataset.pay;
    state.payments[id] = state.payments[id] || {};
    state.payments[id].amount = inp.value === "" ? "" : +inp.value;
    save(); renderBudgetTotals(); renderOverview();
  }));
  box.querySelectorAll("[data-note]").forEach(inp => inp.addEventListener("input", () => {
    const id = inp.dataset.note;
    state.payments[id] = state.payments[id] || {};
    state.payments[id].note = inp.value;
    save();
  }));
  renderBudgetTotals();
}

function renderBudgetTotals() {
  const t = budgetTotals();
  $("#bLow").textContent = ils(t.low);
  $("#bTyp").textContent = ils(t.typ);
  $("#bHigh").textContent = ils(t.high);
  const w = Math.min(100, t.typ ? t.paid / t.typ * 100 : 0);
  $("#bBar").innerHTML = `<i style="width:${w}%"></i>`;
  $("#bBarL").textContent = "שולם " + ils(t.paid);
  $("#bBarR").textContent = "מתוך ~" + ils(t.typ) + " (טיפוסי)";
  $("#bRateNote").textContent = RATES.note;
}

/* ---------- גרף הגשם ---------- */
function renderRainChart() {
  const W = 1000, H = 340, padL = 44, padR = 8, padT = 30, padB = 26, MAXV = 450;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const y = v => padT + (1 - v / MAXV) * plotH;
  const groupW = plotW / 12, barW = Math.min(26, groupW / 2 - 5), gap = 3;

  const roundTop = (x, yy, w, h, r) => h <= 0 ? "" :
    `M${x},${yy + h} L${x},${yy + Math.min(r, h)} Q${x},${yy} ${x + r},${yy} L${x + w - r},${yy} Q${x + w},${yy} ${x + w},${yy + Math.min(r, h)} L${x + w},${yy + h} Z`;

  let bars = "", nov = "";
  RAIN.months.forEach((m, i) => {
    const gx = padL + i * groupW + groupW / 2;
    const x1 = gx - barW - gap / 2, x2 = gx + gap / 2;
    const v1 = RAIN.phuket[i], v2 = RAIN.samui[i];
    if (i === 10) nov = `<rect x="${padL + i * groupW + 2}" y="${padT - 16}" width="${groupW - 4}" height="${plotH + 32}" rx="8" fill="var(--warm)" opacity="0.10"/>
      <text x="${x1 + barW / 2}" y="${y(v1) - 5}" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--ink)" class="num">${v1}</text>
      <text x="${x2 + barW / 2}" y="${y(v2) - 5}" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--ink)" class="num">${v2}</text>`;
    bars += `<path d="${roundTop(x1, y(v1), barW, plotH + padT - y(v1), 4)}" fill="var(--chart-a)" data-tip="פוקט · ${m} · ${v1} מ&quot;מ"/>
             <path d="${roundTop(x2, y(v2), barW, plotH + padT - y(v2), 4)}" fill="var(--chart-b)" data-tip="קוסמוי · ${m} · ${v2} מ&quot;מ"/>`;
  });

  const grid = [0, 150, 300, 450].map(v =>
    `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>
     <text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)" class="num">${v}</text>`).join("");

  const labels = RAIN.months.map((m, i) =>
    `<text x="${padL + i * groupW + groupW / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${i === 10 ? "var(--warm)" : "var(--muted)"}" ${i === 10 ? 'font-weight="700"' : ""}>${m}</text>`).join("");

  $("#rainchart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="השוואת משקעים חודשיים — פוקט מול קוסמוי">
    ${nov}${grid}${bars}${labels}
    <text x="${padL - 6}" y="${padT - 14}" text-anchor="end" font-size="10.5" fill="var(--muted)">מ"מ</text></svg>`;

  const tip = $("#charttip");
  $("#rainchart").addEventListener("pointermove", e => {
    const t = e.target.closest("[data-tip]");
    if (!t) { tip.style.display = "none"; return; }
    tip.textContent = t.dataset.tip;
    tip.style.display = "block";
    tip.style.left = Math.min(window.innerWidth - 150, e.clientX + 10) + "px";
    tip.style.top = (e.clientY - 34) + "px";
  });
  $("#rainchart").addEventListener("pointerleave", () => tip.style.display = "none");
  // במסך צר הגרף נגלל — מתחילים מהצד של נובמבר
  $("#rainchart").scrollLeft = $("#rainchart").scrollWidth;
}

/* ---------- מזג אוויר חי (עובד כשנפתח מקומית; בענן מוצגים הממוצעים) ---------- */
const WX_CODE = c =>
  c === 0 ? "בהיר" : c <= 2 ? "בהיר חלקית" : c === 3 ? "מעונן" :
  c <= 48 ? "אביך" : c <= 67 ? "גשם קל" : c <= 82 ? "ממטרים" : "סופות";

async function loadWeather() {
  const q = (lat, lon) =>
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=7`)
      .then(r => { if (!r.ok) throw 0; return r.json(); });
  try {
    const [p, a] = await Promise.all([q(7.89, 98.30), q(8.03, 98.82)]);
    const cell = (name, d) => `<div class="wx-cell"><div class="city">${name}</div>
      <div class="t num">${Math.round(d.current.temperature_2m)}°${iconByCode(d.current.weather_code)}</div>
      <div class="d">${WX_CODE(d.current.weather_code)}</div></div>`;
    $("#wxNow").innerHTML = cell("פוקט", p) + cell("אאו נאנג", a);
    const days = d => d.daily.time.map((t, i) => `<div class="wx-day">
      <div class="dn">${new Date(t).toLocaleDateString("he-IL", { weekday: "short" })}</div>
      ${iconByP(d.daily.precipitation_probability_max[i] / 100)}
      <div class="tt num">${Math.round(d.daily.temperature_2m_max[i])}°/${Math.round(d.daily.temperature_2m_min[i])}°</div>
      <div class="pp num">☂ ${d.daily.precipitation_probability_max[i]}%</div></div>`).join("");
    $("#wxDaysPhuket").innerHTML = days(p);
    $("#wxDaysAonang").innerHTML = days(a);
    $("#wxLiveCard").hidden = false;
  } catch (e) { /* אין רשת/CSP — נשארים עם הממוצעים */ }
}

/* ---------- קובץ שמירה אוטומטית (File System Access) ---------- */
let fsHandle = null, fsTimer = null;
const idb = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("hamal-fs", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async set(k, v) {
    const db = this.db || (this.db = await this.open());
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(v, k);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  },
  async get(k) {
    const db = this.db || (this.db = await this.open());
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readonly");
      const q = tx.objectStore("kv").get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
};

function fsStatusUI(html) { const el = $("#fsStatus"); if (el) el.innerHTML = html; }

async function fsWrite() {
  if (!fsHandle) return;
  try {
    const w = await fsHandle.createWritable();
    await w.write(JSON.stringify(state, null, 2));
    await w.close();
    fsStatusUI(`<span class="ok">✓ נשמר אוטומטית אל ${esc(fsHandle.name)}</span>
      <span>(${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })})</span>`);
  } catch (e) {
    fsStatusUI(`<span>השמירה לקובץ נכשלה — <button class="linkbtn" id="fsReconnect">חיבור מחדש</button></span>`);
    const b = $("#fsReconnect"); if (b) b.addEventListener("click", fsConnect);
  }
}

async function fsAdoptNewer() {
  try {
    const f = await fsHandle.getFile();
    if (!f.size) return;
    const r = migrate(JSON.parse(await f.text()));
    if (r.updatedAt && (!state.updatedAt || r.updatedAt > state.updatedAt)) {
      state = r; persistLocal(); renderAll();
      toast("נטענו נתונים עדכניים יותר מהקובץ");
    }
  } catch (e) { /* קובץ ריק/לא תקין — מתעלמים */ }
}

async function fsConnect() {
  if (!window.showSaveFilePicker) {
    toast("שמירה לקובץ נתמכת בכרום/אדג' במחשב. בנייד הסנכרון בענן פעיל דרך הקישור");
    return;
  }
  try {
    fsHandle = await showSaveFilePicker({
      suggestedName: "thailand-trip-data.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    try { await idb.set("handle", fsHandle); } catch (e) { }
    await fsAdoptNewer();
    await fsWrite();
    toast("מחובר! כל שינוי נשמר לקובץ");
  } catch (e) { /* המשתמש ביטל */ }
}

async function fsRestore() {
  if (!window.showSaveFilePicker) return;
  let h;
  try { h = await idb.get("handle"); } catch (e) { return; }
  if (!h) return;
  try {
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      fsHandle = h;
      await fsAdoptNewer();
      fsWrite();
    } else {
      fsStatusUI(`<span>הקובץ <b>${esc(h.name)}</b> חובר בעבר.</span>
        <button class="linkbtn" id="fsReauth">חידוש החיבור</button>`);
      $("#fsReauth").addEventListener("click", async () => {
        if (await h.requestPermission({ mode: "readwrite" }) === "granted") {
          fsHandle = h;
          await fsAdoptNewer();
          fsWrite();
        }
      });
    }
  } catch (e) { /* דפדפן בלי תמיכה מלאה */ }
}

/* ---------- ייצוא / ייבוא ---------- */
$("#btnConnectFile").addEventListener("click", fsConnect);
$("#btnExport").addEventListener("click", async () => {
  const data = JSON.stringify(state, null, 2);
  const filename = "thailand-trip-data.json";
  try {
    if (window.claude && window.claude.use) {
      const dl = await window.claude.use("downloads");
      if (dl) { await dl.save({ filename, data }); toast("הקובץ נשמר"); return; }
    }
  } catch (e) { if (e && e.code === "cancelled") return; }
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = filename; a.click();
    toast("הקובץ ירד");
  } catch (e) { toast("הייצוא נכשל — נסו העתקה ללוח"); }
});

$("#btnCopy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(JSON.stringify(state, null, 2)); toast("הועתק ללוח"); }
  catch (e) { toast("ההעתקה נכשלה"); }
});

$("#fileImport").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      state = migrate(JSON.parse(rd.result));
      save(); renderAll(); toast("הנתונים נטענו");
    } catch (err) { toast("קובץ לא תקין"); }
  };
  rd.readAsText(f);
  e.target.value = "";
});

/* ---------- הפעלה ---------- */
function renderAll() {
  renderTasksArea(); renderLegs(); refreshMap(); renderAttFilter(); renderAtts();
  renderHotels(); renderBudget(); renderOverview(); renderWxTrip();
}

renderEmergency();
renderRainChart();
renderAll();
initCloud();
fsRestore();
loadWeather();
loadTripForecast();
tryLeaflet();
