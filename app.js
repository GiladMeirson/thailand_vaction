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

/* ---------- נתוני הטיול: trip.js (לקריאה בלבד — עורכים את הקובץ ידנית) ---------- */
let trip = null, FLIGHTS = null, DOMESTIC = [];
let state = null; // תצוגה מנורמלת של trip.js לשימוש הרינדור

function deriveState(t) {
  const h = t.hotels || {};
  const idOf = x => x && x.id ? x.id : null;
  return {
    tasks: Object.fromEntries((t.tasksDone || []).map(id => [id, true])),
    custom: (t.myTasks || []).map((m, i) => typeof m === "string" ? { id: "c" + i, t: m, done: false } : { id: "c" + i, t: m.t, done: !!m.done }),
    hotels: h,
    hotelChoice: { phuket: idOf(h.phuket), aonang: idOf(h.second) }, // "aonang" = הבסיס השני בקטלוג
    phuketNights: +t.phuketNights || 0,
    secondDest: t.secondDest || { decided: false },
    payments: t.payments || {},
    saved: Object.fromEntries((t.savedAttractions || []).map(id => [id, true])),
    tripStart: t.dates && t.dates.start, tripEnd: t.dates && t.dates.end
  };
}

/* שם היעד השני — כל עוד לא הוחלט מציגים "טרם הוחלט" */
function dest2Name(short) {
  const d = state.secondDest;
  if (d && d.decided && d.name) return d.name;
  return short ? "יעד שני" : "יעד שני (טרם הוחלט)";
}
const fmtD = iso => { const d = new Date(iso + "T00:00:00"); return d.getDate() + "." + (d.getMonth() + 1); };

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
    case "bkPhuket": { const h = hotel("phuket"), a = hotelStart();
      return bk(h ? h.name + " Phuket" : "Kata Beach Phuket", a && addDays(a, n.bangkok), a && addDays(a, n.bangkok + n.phuket)); }
    case "bkAonang": { const h = hotel("aonang"), a = hotelStart();
      return bk(h ? h.name + " Ao Nang" : "Ao Nang Krabi", a && addDays(a, n.bangkok + n.phuket), a && addDays(a, n.bangkok + n.phuket + n.aonang)); }
    case "bkBkk": { const a = hotelStart(); return bk("Suvarnabhumi Airport Bangkok", a, a && addDays(a, Math.max(1, n.bangkok))); }
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
  const dueHtml = di ? `<span class="nn-due ${di.cls}">⏳ ${esc(di.txt)}</span>` : "";
  box.innerHTML = `
    <div class="nn-first">
      <span class="seq">${esc(first.seq)}</span>
      <span class="txt"><b>${esc(first.t)}</b>${first.n ? `<span class="n">${esc(first.n)}</span>` : ""}${dueHtml}${taskLinksHtml(first)}</span>
    </div>
    ${rest.length ? `<ul class="nn-rest">${rest.slice(0, 2).map(t =>
      `<li><span class="seq">${esc(t.seq)}</span><span>אחר כך: ${esc(t.t)}</span></li>`).join("")}</ul>` : ""}`;
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

  const taskRow = (t, seq, checked) => {
    if (onlyOpen && checked) return "";
    return `<div class="task ${checked ? "done" : ""}">
      <span class="chk ${checked ? "on" : ""}" aria-label="${checked ? "בוצע" : "פתוח"}"></span>
      <span class="seq">${esc(seq)}</span>
      <span><span class="t">${esc(t.t)}</span>${t.n ? `<div class="n">${esc(t.n)}</div>` : ""}${checked ? "" : taskLinksHtml(t)}</span>
    </div>`;
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
        ${s.tasks.map((t, ti) => taskRow(t, si + "." + (ti + 1), !!state.tasks[t.id])).join("")}
      </div>
    </details>`;
  }).join("");

  // המשימות שלי (myTasks ב-trip.js)
  if (state.custom.length) {
    const myDone = state.custom.filter(t => t.done).length;
    const myOpen = stageOpenMap["mine"] ?? true;
    html += `<details class="stage-acc" data-sid="mine" ${myOpen ? "open" : ""}>
      <summary>
        <span class="snum">★</span>
        <span class="stitle"><b>המשימות שלי</b><span class="when">מ-trip.js</span></span>
        <span class="sprog"><span class="cnt">${myDone}/${state.custom.length}</span></span>
        ${CHEV}
      </summary>
      <div class="stage-body">
        ${state.custom.map(t => taskRow({ ...t, custom: true }, "★", !!t.done)).join("")}
      </div>
    </details>`;
  }

  box.innerHTML = html;

  box.querySelectorAll("details.stage-acc").forEach(d =>
    d.addEventListener("toggle", () => { stageOpenMap[d.dataset.sid] = d.open; }));
  wireGoLinks(box);
}

function renderTasksArea() { renderNowNext(); renderStages(); }

$("#onlyOpen")?.addEventListener("change", e => { onlyOpen = e.target.checked; renderStages(); });

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

  /* הירו: תאריכים, מסלול ולילות — מ-trip.js */
  const n = nights();
  const d2 = dest2Name(true);
  $("#dateRange").innerHTML = state.tripStart && state.tripEnd
    ? `יציאה <b class="num">${fmtD(state.tripStart)}</b> · חזרה <b class="num">${fmtD(state.tripEnd)}</b>` : "תאריכים טרם נקבעו";
  const dn = $("#dateNights");
  dn.hidden = false;
  dn.innerHTML = `<b class="num">${n.total}</b> לילות מלון · ${n.bangkok ? `<span class="num">${n.bangkok}</span> בנגקוק + ` : ""}<span class="num">${n.phuket}</span> פוקט + <span class="num">${n.aonang}</span> ${esc(d2)}`;
  $("#heroRoute").textContent = `ת"א ✈ בנגקוק ✈ פוקט ${state.secondDest.decided ? "→ " + d2 : "→ ?"} ✈ הביתה`;
  $("#heroMeta").textContent = `2 מבוגרים + תינוקת בת שנה · ${n.total} לילות בתאילנד · אל על ישיר, הלוך ${fmtD(FLIGHTS.legs[0].depDate)} · חזור ${fmtD(FLIGHTS.legs[1].depDate)}`
    + (state.secondDest.decided ? "" : " · היעד השני אחרי פוקט עדיין פתוח");
  $("#brandSub").textContent = `‎${fmtD(state.tripStart)} – ${fmtD(state.tripEnd)}.${new Date(state.tripEnd).getFullYear()} · הטיסות סגורות ✈`;
  $("#dataStamp").textContent = trip.updated ? "עודכן " + fmtD(trip.updated) : "";
}

/* ---------- כרטיסי הטיסה ---------- */
function renderFlights() {
  const box = $("#flightsBox");
  if (!box || typeof FLIGHTS === "undefined") return;
  const ftD = iso => new Date(iso + "T00:00:00").toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
  const PLANE = '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';

  const leg = L => `
  <article class="fticket">
    <div class="ft-top">
      <span class="ft-dirtag">${esc(L.dir)}</span>
      <span class="ft-no num">${esc(L.no)}</span>
      <span class="ft-airline">${esc(FLIGHTS.airline)}</span>
    </div>
    <div class="ft-route">
      <div class="ft-ep">
        <div class="ft-code">${esc(L.from.code)}</div>
        <div class="ft-time num">${esc(L.depTime)}</div>
        <div class="ft-edate">${ftD(L.depDate)}</div>
        <div class="ft-city">${esc(L.from.city)} · ${esc(L.from.term)}</div>
      </div>
      <div class="ft-path" role="img" aria-label="טיסה ישירה, ${esc(L.dur)} שעות">
        <i class="ft-pin ft-pin-a"></i><i class="ft-pin ft-pin-b"></i>
        <span class="ft-fly">${PLANE}</span>
        <span class="ft-dur num">${esc(L.dur)}${L.direct ? " · ישירה" : ""}</span>
      </div>
      <div class="ft-ep ft-to">
        <div class="ft-code">${esc(L.to.code)}</div>
        <div class="ft-time num">${esc(L.arrTime)}</div>
        <div class="ft-edate">${ftD(L.arrDate)}${L.arrNote ? ` <b>${esc(L.arrNote)}</b>` : ""}</div>
        <div class="ft-city">${esc(L.to.city)} · ${esc(L.to.term)}</div>
      </div>
    </div>
    <div class="ft-tear" aria-hidden="true"></div>
    <div class="ft-stub">
      <div class="ft-fact"><span>מושבים</span><b class="num">${esc(L.seats)}</b></div>
      <div class="ft-fact"><span>מחלקה</span><b>${esc(L.cls)}</b></div>
      <div class="ft-fact"><span>מטוס</span><b>${esc(L.plane)}</b></div>
      <div class="ft-fact"><span>כבודה</span><b>${esc(L.bags)}</b></div>
      <div class="ft-fact"><span>ארוחות</span><b>${esc(L.meal)}</b></div>
      <span class="ft-barcode" aria-hidden="true"></span>
    </div>
  </article>`;

  box.innerHTML = `
    <div class="eyebrow ft-eyebrow">✈ הטיסות שלכם · הזמנה <b class="num">${esc(FLIGHTS.ref)}</b> · סטטוס: מאושר ✓</div>
    ${FLIGHTS.legs.map(leg).join("")}
    <div class="fticket ft-passcard">
      <div class="ft-pass">${FLIGHTS.pax.map(p => `<span class="ft-chip">${esc(p.name)}</span>`).join("")}</div>
      <details class="ft-tickets"><summary>מספרי כרטיסים ומושבים ${CHEV}</summary>
        <ul>${FLIGHTS.pax.map(p => `<li><span>${esc(p.name)} · מושב הלוך ${esc(p.seat)}</span><b class="num">${esc(p.ticket)}</b></li>`).join("")}</ul>
      </details>
      <p class="ft-note">צ'ק-אין אונליין נפתח 24 שעות לפני ההמראה. לא לשכוח: עריסת טיסה (Bassinet) לארבל + מושבים לטיסת החזור.</p>
    </div>
    ${domesticHtml()}`;

  /* כרטיסי הטיסות הפנימיות — עיצוב "כרטיס עלייה למטוס" קומפקטי, בצבעי ים, עם דגל תאילנד */
  function domesticHtml() {
    if (typeof DOMESTIC === "undefined" || !DOMESTIC.length) return "";
    const card = L => `
    <article class="fticket ft-dom">
      <div class="ft-top">
        <span class="ft-dirtag">🇹🇭 טיסה פנימית</span>
        <span class="ft-no num">${esc(L.no)}</span>
        <span class="ft-airline">${esc(L.airline)}</span>
      </div>
      <div class="ft-route">
        <div class="ft-ep">
          <div class="ft-code">${esc(L.from.code)}</div>
          <div class="ft-time num">${esc(L.depTime)}</div>
          <div class="ft-edate">${ftD(L.depDate)}</div>
          <div class="ft-city">${esc(L.from.city)} · ${esc(L.from.term)}</div>
        </div>
        <div class="ft-path" role="img" aria-label="טיסה פנימית, ${esc(L.dur)} שעות">
          <i class="ft-pin ft-pin-a"></i><i class="ft-pin ft-pin-b"></i>
          <span class="ft-fly">${PLANE}</span>
          <span class="ft-dur num">${esc(L.dur)}${L.direct ? " · ישירה" : ""}</span>
        </div>
        <div class="ft-ep ft-to">
          <div class="ft-code">${esc(L.to.code)}</div>
          <div class="ft-time num">${esc(L.arrTime)}</div>
          <div class="ft-edate">${ftD(L.arrDate)}</div>
          <div class="ft-city">${esc(L.to.city)} · ${esc(L.to.term)}</div>
        </div>
      </div>
      <div class="ft-tear" aria-hidden="true"></div>
      <div class="ft-stub ft-dom-stub">
        <ul class="ft-seats">
          ${L.pax.map(p => `<li>
            <span class="ft-seat num">${esc(p.seat)}</span>
            <span class="ft-seat-who"><b>${esc(p.name)}</b><small>כבודה ${esc(p.bag)} · ${esc(p.status)}${p.extra ? " · " + esc(p.extra) : ""}</small></span>
          </li>`).join("")}
        </ul>
        <div class="ft-dom-meta">
          <div class="ft-fact"><span>מחלקה</span><b class="num">${esc(L.cls)}</b></div>
          <span class="ft-barcode" aria-hidden="true"></span>
        </div>
      </div>
      ${L.note ? `<p class="ft-note ft-dom-note">${esc(L.note)}</p>` : ""}
    </article>`;
    return `
    <div class="eyebrow ft-eyebrow ft-dom-eyebrow">🛩 טיסות פנימיות בתאילנד · 3 כרטיסים · סטטוס: מאושר ✓</div>
    ${DOMESTIC.map(card).join("")}`;
  }
}

/* ---------- השוואת יעדים + בייביסיטר (מחקר ספטמבר 2026) ---------- */
function renderDests() {
  const box = $("#destsBox");
  if (!box || typeof DESTS === "undefined") return;
  const bar = v => `<span class="dbar"><i style="width:${v * 10}%"></i></span><b class="num dnum">${v}</b>`;
  box.innerHTML = DESTS.map(d => `
    <div class="dest ${d.good ? "pick" : ""}">
      <div class="d-head"><b>${esc(d.n)}</b><span class="d-call ${d.good ? "ok" : ""}">${esc(d.call)}</span></div>
      <div class="d-scores">
        <span class="d-lbl">משפחה</span>${bar(d.family)}
        <span class="d-lbl">זוגיות</span>${bar(d.couple)}
        <span class="d-lbl">מזג אוויר</span>${bar(d.wx)}
      </div>
      <p class="d-why">${esc(d.why)}</p>
    </div>`).join("") + `<p class="d-skip">${esc(DESTS_SKIP)}</p>`;

  const rr = $("#recRoute");
  if (rr) rr.innerHTML = `
    <div class="eyebrow">המבנה המומלץ · 13 לילות</div>
    <div class="rr-line">
      <span class="rr-stop"><b class="num">7</b> פוקט · באנג טאו</span><span class="rr-arrow">🚗 3 ש'</span>
      <span class="rr-stop"><b class="num">4</b> אאו נאנג</span><span class="rr-arrow">✈ 1:25</span>
      <span class="rr-stop"><b class="num">2</b> בנגקוק</span><span class="rr-arrow">✈ 23:55 הביתה</span>
    </div>
    <p class="rr-why">למה ככה: נחיתה 13:50 → פנימית לפוקט עוד באותו יום (במיטה ב-21:30 בערך). באנג טאו — 25 דק' מהשדה, חוף רדוד,
    בייביסיטריות ומועדוני חוף במרחק הליכה. מסיימים בבנגקוק כי הטיסה הביתה ממריאה 23:55 — בלי קונקשן צמוד עם תינוקת ביום
    האחרון, עם רפואה הכי טובה שיש, וערב גגות זוגי אחד גדול. <b>החלופה השמרנית:</b> להישאר 7+6 פוקט–אאו נאנג ולטוס
    KBV→BKK ב-14.11 בבוקר מוקדם (באפר של יום שלם עד 23:55).</p>`;
}

function renderNovTable() {
  const box = $("#novTable");
  if (!box || typeof NOV_WINDOW === "undefined") return;
  const heat = m => m <= 100 ? "h1" : m <= 140 ? "h2" : m <= 180 ? "h3" : "h4";
  box.innerHTML = `<div class="nov-scroll"><table class="nov">
    <thead><tr><th>יעד</th>${NOV_WINDOW.years.map(y => `<th class="num">${y}</th>`).join("")}<th>ממוצע</th></tr></thead>
    <tbody>${NOV_WINDOW.dests.map(d => `<tr>
      <th>${esc(d.n)}<small>${esc(d.days)}</small></th>
      ${d.mm.map(m => `<td class="num ${heat(m)}">${m}</td>`).join("")}
      <td class="num ${heat(d.mean)}"><b>${d.mean}</b></td></tr>`).join("")}</tbody></table></div>`;
}

function renderSitters() {
  const box = $("#sittersBox");
  if (!box || typeof SITTERS === "undefined") return;
  box.innerHTML = SITTERS.map(s => `
    <div class="sit-area">
      <div class="sit-name">${esc(s.area)}</div>
      ${s.items.map(i => `<div class="sit-row">
        <b>${i.u ? `<a href="${esc(i.u)}" target="_blank" rel="noopener">${esc(i.n)} ↗</a>` : esc(i.n)}</b>
        <span>${esc(i.d)}</span></div>`).join("")}
      ${s.night ? `<div class="sit-night">🌙 ${esc(s.night)}</div>` : ""}
    </div>`).join("");
}

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
    box.innerHTML = `<p class="wxt-note">אין תאריכים ב-trip.js (dates.start / dates.end).</p>`;
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
/* סה"כ לילות מלון נגזר מהתאריכים; 13 כברירת מחדל עד שיש תאריכים */
function totalNights() {
  if (state.tripStart && state.tripEnd) {
    let s = state.tripStart, e = state.tripEnd;
    // כשהתאריכים הם תאריכי הטיסות: ההלוך ממריא בלילה (לנים במטוס) והחזור ממריא ב-23:55 —
    // לילות המלון נספרים מיום הנחיתה עד יום ההמראה חזרה
    if (typeof FLIGHTS !== "undefined") {
      if (s === FLIGHTS.legs[0].depDate) s = FLIGHTS.legs[0].arrDate;
      if (e === FLIGHTS.legs[1].arrDate) e = FLIGHTS.legs[1].depDate;
    }
    const n = Math.round((new Date(e) - new Date(s)) / 864e5);
    if (n >= 2 && n <= 40) return n;
  }
  return 13;
}
/* תאריך תחילת לילות המלון: יום הנחיתה בבנגקוק כשהיציאה היא תאריך הטיסה, אחרת תאריך היציאה שנבחר */
function hotelStart() {
  const s = state.tripStart;
  if (s && typeof FLIGHTS !== "undefined" && s === FLIGHTS.legs[0].depDate) return FLIGHTS.legs[0].arrDate;
  return s;
}
/* לילות בבנגקוק בתחילת הטיול — בין הנחיתה לטיסה הפנימית לפוקט (PG271 ב-2.11 בבוקר → לילה אחד) */
function bangkokNights() {
  const s = hotelStart();
  if (!s || typeof DOMESTIC === "undefined" || !DOMESTIC.length) return 0;
  const n = Math.round((new Date(DOMESTIC[0].depDate) - new Date(s)) / 864e5);
  return n >= 0 && n <= 3 ? n : 0;
}
/* לילות בנגקוק (הפתיחה) יורדים מהסה"כ; פוקט לפי phuketNights ב-trip.js; השאר ליעד השני ("aonang" בקוד) */
function nights() {
  const total = totalNights();
  const bangkok = Math.min(bangkokNights(), total - 2);
  const rest = total - bangkok;
  const phuket = Math.min(rest - 1, Math.max(1, state.phuketNights || Math.ceil(rest / 2)));
  return { phuket, aonang: rest - phuket, bangkok, total };
}

const IC = {
  plane: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M5 16l1.5-4.5a2 2 0 0 1 1.9-1.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><path d="M4 16h16v3h-2m-12 0H4z"/><circle cx="7.5" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/></svg>',
  bed: '<svg viewBox="0 0 24 24"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20"/><path d="M6 10V7h5v3"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/></svg>'
};

function renderLegs() {
  const n = nights();
  const H = state.hotels, d2 = state.secondDest;
  const out = FLIGHTS.legs[0], back = FLIGHTS.legs[1], dom = DOMESTIC[0];
  const dow = iso => new Date(iso + "T00:00:00").toLocaleDateString("he-IL", { weekday: "short" });
  const hotelName = base => { const h = HOTELS.find(x => x.id === state.hotelChoice[base]); return h ? h.name : ""; };
  const hotelTxt = (hb, fallbackName) => {
    const name = (hb && hb.name) || fallbackName;
    if (!name) return "עוד לא נבחר מלון";
    return `${hb && hb.booked ? "✓ הוזמן" : "נבחר, עוד לא הוזמן"} · ${name}${hb && hb.ref ? " · " + hb.ref : ""}`;
  };
  const legs = [
    { ic: "plane", t: `✓ אל על ${out.no} · ת"א → בנגקוק`, d: `${dow(out.depDate)} ${fmtD(out.depDate)} · המראה ${out.depTime}, נחיתה ${out.arrTime} למחרת · ישיר · הוזמן!`, dur: out.dur },
    n.bangkok ? { ic: "moon", t: "לילה בבנגקוק · ליד השדה", d: hotelTxt(H.bangkok, "") + " — נוחתים " + out.arrTime + ", בבוקר ממשיכים לפוקט", dur: n.bangkok + " לילה" } : null,
    dom ? { ic: "plane", t: `✓ ${dom.airline} ${dom.no} · בנגקוק → פוקט`, d: `${dow(dom.depDate)} ${fmtD(dom.depDate)} · המראה ${dom.depTime} מ${dom.from.term.replace("סוברנבומי · ", "")}, נחיתה ${dom.arrTime} · ישיר · הוזמן!`, dur: dom.dur } : null,
    { ic: "bed", t: "בסיס 1 · פוקט", d: hotelTxt(H.phuket, hotelName("phuket")), dur: n.phuket + " לילות", base: true },
    { ic: "car", t: `מעבר · פוקט → ${dest2Name(true)}`, d: d2.decided ? "רכב פרטי עם כיסא בטיחות" : "תלוי ביעד: אאו נאנג ~3 ש' ברכב · קאו לאק ~1.5 ש' · בנגקוק בטיסה", dur: "" },
    { ic: "bed", t: `בסיס 2 · ${dest2Name()}`, d: d2.decided ? hotelTxt(H.second, hotelName("aonang")) : "האפשרויות: " + (d2.options || []).join(" / ") + " — ההשוואה למטה", dur: n.aonang + " לילות", base: true },
    { ic: "plane", t: "טיסה פנימית · חזרה לבנגקוק", d: d2.decided ? "לסגור אחרי המלון — לנחות בסוברנבומי (BKK) עד ~19:30" : "נסגרת אחרי ההחלטה על היעד השני (KBV או HKT → BKK)", dur: "‎~1:25" },
    { ic: "plane", t: `✓ אל על ${back.no} · בנגקוק → ת"א`, d: `${dow(back.depDate)} ${fmtD(back.depDate)} · המראה ${back.depTime}, נחיתה ${back.arrTime} · ישיר · הוזמן!`, dur: back.dur }
  ].filter(Boolean);
  $("#legsBox").innerHTML = legs.map(l => `
    <li class="leg ${l.base ? "base" : ""}"><span class="ic">${IC[l.ic]}</span>
      <span class="bd"><b>${esc(l.t)}</b><div class="d">${esc(l.d)}</div></span>
      ${l.dur ? `<span class="dur">${esc(l.dur)}</span>` : ""}</li>`).join("");
  $("#legsSub").textContent = `${n.total} לילות · ${n.bangkok} בנגקוק + ${n.phuket} פוקט + ${n.aonang} ${dest2Name(true)}`;
}

/* ---------- מפה ---------- */
const MAP_VIEWS = {
  overview: { lon0: 98.16, lon1: 99.34, lat0: 7.70, lat1: 8.78 },
  phuket: { lon0: 98.22, lon1: 98.47, lat0: 7.72, lat1: 8.17 },
  aonang: { lon0: 98.64, lon1: 98.98, lat0: 7.93, lat1: 8.15 },
  khaolak: { lon0: 98.15, lon1: 98.37, lat0: 8.50, lat1: 8.76 },
  bangkok: { lon0: 100.68, lon1: 100.86, lat0: 13.63, lat1: 13.79 }
};
let mapView = "overview", mapKind = "all", leafState = null;

/* קווי חוף מקורבים (lon,lat) */
const GEO = {
  phuketIsland: [[98.30, 8.20], [98.27, 8.14], [98.245, 8.05], [98.25, 7.93], [98.268, 7.82], [98.30, 7.748], [98.335, 7.78], [98.36, 7.79], [98.40, 7.80], [98.412, 7.82], [98.42, 7.90], [98.437, 7.99], [98.428, 8.06], [98.40, 8.10], [98.35, 8.16]],
  mainland: [[98.22, 8.95], [98.235, 8.78], [98.238, 8.66], [98.230, 8.56], [98.255, 8.45], [98.275, 8.33], [98.30, 8.205],
    [98.36, 8.20], [98.42, 8.22], [98.47, 8.26], [98.51, 8.33], [98.545, 8.44], [98.575, 8.37], [98.61, 8.30], [98.66, 8.24],
    [98.70, 8.21], [98.715, 8.115], [98.735, 8.062], [98.758, 8.047], [98.79, 8.05], [98.807, 8.038], [98.818, 8.030], [98.83, 8.016], [98.836, 8.002], [98.85, 8.0], [98.868, 8.012], [98.884, 8.024], [98.9, 8.038], [98.908, 8.052], [98.92, 8.09], [98.94, 8.06], [98.96, 8.02], [99.0, 7.95], [99.08, 7.88], [99.2, 7.82], [99.34, 7.78], [99.34, 8.95]],
  islands: [[98.686, 8.072, 0.014], [98.676, 8.050, 0.009], [98.82, 7.952, 0.008]]
};

const HOTEL_SHORT = {
  katathani: "Katathani", saii: "SAii", "centara-grand": "Centara", angsana: "Angsana",
  dusit: "Dusit", "kata-palm": "Kata Palm", "centara-aonang": "Centara", avani: "Avani", "holiday-inn": "Holiday Inn"
};

const candidates = () => (trip && Array.isArray(trip.candidates)) ? trip.candidates : [];
const candNights = c => Math.max(1, Math.round((new Date(c.to + "T00:00:00") - new Date(c.from + "T00:00:00")) / 864e5));

function mapPlaces() {
  const pl = [];
  candidates().forEach(c => pl.push({
    kind: "cand", id: "c_" + c.id, name: c.name, short: c.short || "", cand: c,
    desc: `מועמד · ${c.room} · $${(+c.usd).toLocaleString("en-US")} ל-${candNights(c)} לילות (${c.src || ""})`,
    extra: c.area, lat: c.lat, lng: c.lng, placeId: c.placeId, site: c.site, img: c.img && c.img[0], address: c.address
  }));
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
  AIRPORTS.forEach(a => pl.push({
    kind: "air", id: "p_" + a.id, name: a.name, short: a.short, desc: a.desc,
    lat: a.lat, lng: a.lng, placeId: a.placeId, site: a.site
  }));
  KHAOLAK.forEach(k => pl.push({
    kind: k.kind, id: "k_" + k.id, name: k.name, short: k.short, desc: k.desc + (k.area ? " · " + k.area : ""),
    extra: k.extra, cost: k.cost, time: k.time, lat: k.lat, lng: k.lng, placeId: k.placeId, site: k.site
  }));
  return pl;
}

function showPlaceSheet(p) {
  const sh = $("#placeSheet");
  sh.className = "place-sheet on";
  sh.innerHTML = `<button class="close" id="sheetClose" aria-label="סגירה">✕</button>
    <b>${esc(p.name)}</b><div class="d">${esc(p.desc || "")}</div>
    ${p.kind === "cand" ? (p.extra ? `<div class="d">${esc(p.extra)}</div>` : "") : (p.extra ? `<div class="d">👶 ${esc(p.extra)}</div>` : "")}
    ${p.address ? `<div class="d">📍 ${esc(p.address)}</div>` : ""}
    ${p.img ? `<img class="sheet-img" src="${esc(p.img)}" alt="">` : ""}
    ${p.cost || p.time ? `<div class="d">${esc([p.cost, p.time].filter(Boolean).join(" · "))}</div>` : ""}
    <div class="links">
      <a target="_blank" rel="noopener" href="${gmapsUrl(p)}">פתיחה ב-Google Maps</a>
      ${p.phone ? `<a href="tel:${p.phone.replace(/\s/g, "")}">חיוג</a>` : ""}
      ${p.site ? `<a target="_blank" rel="noopener" href="${esc(p.site)}">אתר</a>` : ""}
      ${p.kind === "cand" ? `<a href="#cand-${esc(p.cand.id)}" class="cand-open" data-id="${esc(p.cand.id)}">כל הפרטים</a>` : ""}
    </div>`;
  const co = sh.querySelector(".cand-open");
  if (co) co.addEventListener("click", e => { e.preventDefault(); openCandidate(co.dataset.id); });
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
    const col = { hotel: "var(--map-hotel)", att: "var(--map-att)", med: "var(--map-med)", air: "var(--map-air)", cand: "var(--map-cand)" }[p.kind];
    const r = p.kind === "att" ? 14 : p.kind === "cand" ? 21 : 19;
    const ring = p.chosen ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 11}" fill="none" stroke="var(--map-hotel)" stroke-width="5"/>` : "";
    const cross = p.kind === "med" ? `<path d="M${p.x - 7} ${p.y}h14M${p.x} ${p.y - 7}v14" stroke="#fff" stroke-width="4.5"/>` : "";
    const plane = p.kind === "air" ? `<text x="${p.x}" y="${p.y + 7}" font-size="21" text-anchor="middle" fill="#fff">✈</text>`
      : p.kind === "cand" ? `<text x="${p.x}" y="${p.y + 8}" font-size="24" text-anchor="middle" fill="#fff">★</text>` : "";
    const label = (detail || p.kind === "air" || p.kind === "cand") && p.short
      ? `<text class="mklabel" x="${p.x + r + 8}" y="${p.y + 8}" font-size="36">${esc(p.short)}</text>` : "";
    return `<g class="mk" data-place="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}">
      <circle cx="${p.x}" cy="${p.y}" r="${r + 18}" fill="transparent"/>
      ${ring}<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${col}" stroke="var(--surface)" stroke-width="4"/>${cross}${plane}${label}</g>`;
  }).join("");

  const islands = GEO.islands
    .filter(([lo, la]) => lo >= V.lon0 && lo <= V.lon1 && la >= V.lat0 && la <= V.lat1)
    .map(([lo, la, r]) => { const q = px(lo, la); return `<ellipse cx="${q.x}" cy="${q.y}" rx="${r * pxl}" ry="${r * pxl}" fill="var(--surface2)" stroke="var(--line)" stroke-width="3"/>`; }).join("");

  let labels = "";
  if (mapView === "overview") {
    const l1 = px(98.34, 7.92), l2 = px(98.99, 8.10), l3 = px(98.30, 8.60), sea = px(98.52, 7.83);
    labels = `<text x="${l1.x}" y="${l1.y}" font-size="34" fill="var(--muted)">פוקט</text>
      <text x="${l2.x}" y="${l2.y}" font-size="34" fill="var(--muted)">קראבי</text>
      <text x="${l3.x}" y="${l3.y}" font-size="34" fill="var(--muted)">קאו לאק</text>
      <text x="${sea.x}" y="${sea.y}" font-size="30" fill="var(--sea-ink)" opacity=".8">הים האנדמני</text>`;
  } else if (mapView === "aonang") {
    const s = px(98.70, 8.00);
    labels = `<text x="${s.x}" y="${s.y}" font-size="30" fill="var(--sea-ink)" opacity=".75">הים האנדמני</text>`;
  } else if (mapView === "khaolak") {
    const s = px(98.165, 8.62);
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
    <span class="k"><i class="swatch" style="background:var(--map-cand)"></i>מועמדים ★</span>
    <span class="k"><i class="swatch" style="background:var(--map-hotel)"></i>מלונות</span>
    <span class="k"><i class="swatch" style="background:var(--map-att)"></i>אטרקציות</span>
    <span class="k"><i class="swatch" style="background:var(--map-med)"></i>בתי חולים</span>
    <span class="k"><i class="swatch" style="background:var(--map-air)"></i>שדה תעופה</span>`;

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
/* ---------- מועמדים למלונות (trip.js → candidates) ---------- */
const BASE_LABEL = { bangkok: "בנגקוק", phuket: "פוקט", khaolak: "קאו לאק", aonang: "אאו נאנג" };
const usd = n => "$" + Math.round(n).toLocaleString("en-US");

function candHtml(c) {
  const nn = candNights(c), total = +c.usd || 0;
  const imgs = (c.img || []).map((src, i) => `<figure><img src="${esc(src)}" alt="" loading="lazy"><figcaption>${i === 0 ? "המלון" : "החדר / הבריכה"}</figcaption></figure>`).join("");
  return `<details class="cand" id="cand-${esc(c.id)}">
    <summary>
      ${c.img && c.img[0] ? `<img src="${esc(c.img[0])}" alt="" loading="lazy">` : `<span class="noimg">🏨</span>`}
      <span class="t"><b>${esc(c.name)}</b><small>${esc(c.area)}${c.room ? " · " + esc(c.room) : ""}</small></span>
      <span class="p"><b>${usd(total)}</b><small>≈ ${ils(total * RATES.usd)}</small></span>
      ${CHEV}
    </summary>
    <div class="cand-body">
      <dl>
        <dt>חדר</dt><dd>${esc(c.room || "—")}</dd>
        <dt>תאריכים</dt><dd>${fmtD(c.from)} ← ${fmtD(c.to)} · ${nn} לילות</dd>
        ${c.board ? `<dt>הסעדה</dt><dd>${esc(c.board)}</dd>` : ""}
        <dt>מחיר</dt><dd><b>${usd(total)}</b> לכל הלילות, לכולם${c.src ? ` (${esc(c.src)})` : ""} · ≈ ${ils(total * RATES.usd)} · ${usd(total / nn)} ללילה</dd>
        <dt>כתובת</dt><dd>${esc(c.address || "")}</dd>
      </dl>
      ${c.note ? `<p class="cand-note">${esc(c.note)}</p>` : ""}
      ${imgs ? `<div class="cand-imgs">${imgs}</div>` : ""}
      <div class="links">
        <a class="linkbtn" target="_blank" rel="noopener" href="${gmapsUrl(c)}">📍 Google Maps</a>
        <a class="linkbtn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}">ניווט</a>
        ${c.site ? `<a class="linkbtn" target="_blank" rel="noopener" href="${esc(c.site)}">אתר המלון</a>` : ""}
        <button type="button" class="linkbtn cand-map" data-id="${esc(c.id)}">★ הצג במפה</button>
      </div>
    </div>
  </details>`;
}

function renderCandidates() {
  const box = $("#candList");
  if (!box) return;
  const list = candidates();
  const bases = [...new Set(list.map(c => c.base))];
  box.innerHTML = list.length ? bases.map(b => {
    const items = list.filter(c => c.base === b);
    const c0 = items[0];
    return `<div class="cand-group">
      <div class="cand-head"><b>${esc(BASE_LABEL[b] || b)}</b><span>${fmtD(c0.from)}–${fmtD(c0.to)} · ${candNights(c0)} לילות · ${items.length === 1 ? "מועמד אחד" : items.length + " מועמדים"}</span></div>
      ${items.map(candHtml).join("")}
    </div>`;
  }).join("") : `<p class="cost-empty">אין עדיין מועמדים — מוסיפים ב-trip.js תחת candidates.</p>`;
  $$("#candList .cand-map").forEach(b => b.addEventListener("click", () => showCandOnMap(b.dataset.id)));
  $("#candSub").textContent = list.length ? `${list.length} מלונות · ${bases.length} יעדים` : "";
}

/* פתיחת הכרטיס של מועמד וגלילה אליו */
function openCandidate(id) {
  const d = $("#cand-" + CSS.escape(id));
  if (!d) return;
  d.open = true;
  setTimeout(() => d.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

/* קפיצה מהמועמד אל המפה */
function showCandOnMap(id) {
  const c = candidates().find(x => x.id === id);
  if (!c) return;
  setMapKind("all");
  setMapView(MAP_VIEWS[c.base] ? c.base : "overview");
  const p = mapPlaces().find(q => q.id === "c_" + id);
  if (p) showPlaceSheet(p);
  if (leafState) setTimeout(() => leafState.map.setView([c.lat, c.lng], 14, { animate: true }), 30);
  setTimeout(() => $("#mapbox").scrollIntoView({ behavior: "smooth", block: "center" }), 80);
}

/* ---------- עלויות (trip.js → costs) ---------- */
const fmtDate = iso => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? "" : d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear(); };
function renderCosts() {
  const box = $("#costRows");
  if (!box) return;
  const costs = Array.isArray(trip.costs) ? trip.costs : [];
  const paid = costs.filter(c => c.paid);
  const paidSum = paid.reduce((s, c) => s + (+c.amount || 0), 0);
  const openSum = costs.filter(c => !c.paid).reduce((s, c) => s + (+c.amount || 0), 0);
  box.innerHTML = costs.length ? costs.map(c => `<div class="cost-row${c.paid ? " paid" : " open"}">
      <span class="tag">${c.paid ? "✓ שולם" : "טרם שולם"}</span>
      <div class="body"><b>${esc(c.what)}</b>
        ${c.note || c.date ? `<small>${[c.note, c.date && fmtDate(c.date)].filter(Boolean).map(esc).join(" · ")}</small>` : ""}</div>
      <b class="amt">${ils(+c.amount || 0)}</b>
    </div>`).join("") : `<p class="cost-empty">אין עדיין עלויות — מוסיפים ב-trip.js תחת costs.</p>`;
  $("#costPaid").textContent = ils(paidSum);
  $("#costsSub").textContent = paid.length === costs.length
    ? `${costs.length} תשלומים · הכול שולם`
    : `${paid.length} מתוך ${costs.length} שולמו · פתוח ${ils(openSum)}`;
}

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
    const OV = MAP_VIEWS.overview;
    const map = L.map(box, { scrollWheelZoom: true }).fitBounds([[OV.lat0, OV.lon0], [OV.lat1, OV.lon1]], { padding: [14, 14] });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    const colors = { hotel: "#2E6650", att: "#C05B38", med: "#B3362B", air: "#8A6A17", cand: "#9F7420" };
    const groups = { hotel: L.layerGroup(), att: L.layerGroup(), med: L.layerGroup(), air: L.layerGroup(), cand: L.layerGroup() };
    mapPlaces().forEach(p => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: p.kind === "att" ? 6 : p.kind === "cand" ? 10 : 8, color: "#fff", weight: 1.5,
        fillColor: colors[p.kind], fillOpacity: p.chosen ? 1 : 0.9
      });
      m.bindTooltip(p.kind === "air" ? "✈ " + (p.short || p.name) : p.kind === "cand" ? "★ " + (p.short || p.name) : p.name,
        { direction: "top", opacity: 0.9, permanent: p.kind === "air" || p.kind === "cand", className: p.kind === "air" ? "tt-air" : p.kind === "cand" ? "tt-cand" : "" });
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
    const colors = { hotel: "#2E6650", att: "#C05B38", med: "#B3362B", air: "#8A6A17", cand: "#9F7420" };
    mapPlaces().forEach(p => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: p.kind === "att" ? 6 : p.kind === "cand" ? 10 : 8, color: "#fff", weight: 1.5,
        fillColor: colors[p.kind], fillOpacity: p.chosen ? 1 : 0.9
      });
      m.bindTooltip(p.kind === "air" ? "✈ " + (p.short || p.name) : p.kind === "cand" ? "★ " + (p.short || p.name) : p.name,
        { direction: "top", opacity: 0.9, permanent: p.kind === "air" || p.kind === "cand", className: p.kind === "air" ? "tt-air" : p.kind === "cand" ? "tt-cand" : "" });
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
        <span class="star" aria-label="${state.saved[a.id] ? "מסומן" : ""}">${state.saved[a.id] ? "★" : "☆"}</span>
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
    </details>`).join("") : `<p style="font-size:13px;color:var(--muted);margin-top:10px">עוד לא סימנתם כלום — מוסיפים מזהי אטרקציות ל-savedAttractions ב-trip.js.</p>`;
}

/* ---------- מלונות ---------- */
function bookingUrl(h) {
  const area = h.base === "phuket" ? "Phuket" : "Ao Nang Krabi";
  return "https://www.booking.com/searchresults.he.il.html?ss=" + encodeURIComponent(h.name + " " + area);
}

let hotelFilter = "all";

function hotelPicksHtml(n) {
  const typCost = (h, nn) => (h.usd[0] + h.usd[1]) / 2 * nn * RATES.usd;
  const H = state.hotels;
  const pick = (base, label, hb) => {
    const h = HOTELS.find(x => x.id === state.hotelChoice[base]);
    const name = h ? h.name : (hb && hb.name);
    if (!name) return `<div class="pick empty"><span class="b">${label}</span><span>עוד לא נבחר</span></div>`;
    const status = hb && hb.booked ? `<span class="pill good">הוזמן ✓${hb.ref ? " · " + esc(hb.ref) : ""}</span>` : `<span class="pill warm">נבחר · עוד לא הוזמן</span>`;
    return `<div class="pick"><span class="b">${label}</span><b>${esc(name)}</b> ${status}
      ${h ? `<span class="est num">~${ils(typCost(h, n[base]))} לכל השהות</span>` : ""}</div>`;
  };
  const bkk = n.bangkok ? `<div class="pick ${H.bangkok && H.bangkok.name ? "" : "empty"}"><span class="b">בנגקוק · ${n.bangkok} לילה</span>
      ${H.bangkok && H.bangkok.name ? `<b>${esc(H.bangkok.name)}</b> ${H.bangkok.booked ? '<span class="pill good">הוזמן ✓</span>' : '<span class="pill warm">עוד לא הוזמן</span>'}` : `<span>עוד לא נבחר — ליד סוברנבומי</span>`}</div>` : "";
  return `<div class="card">
    <h2>המלונות שלכם <span class="sub">מ-trip.js · נכנס לתקציב</span></h2>
    <div class="picks">${bkk}${pick("phuket", `פוקט · ${n.phuket} לילות`, H.phuket)}${pick("aonang", `${esc(dest2Name())} · ${n.aonang} לילות`, H.second)}</div>
  </div>`;
}

function renderHotels() {
  const n = nights();
  const groups = [
    ["phuket", `בסיס 1 — פוקט · ${n.phuket} לילות`],
    ["aonang", `בסיס 2 — ${esc(dest2Name())} · ${n.aonang} לילות · הקטלוג: אאו נאנג`]
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
    const hb = base === "phuket" ? state.hotels.phuket : state.hotels.second;
    const ilsRange = `₪${Math.round(h.usd[0] * RATES.usd)}–${Math.round(h.usd[1] * RATES.usd)}`;
    return `<div class="hotel ${chosen ? "chosen" : ""}">
      ${h.img ? `<img class="photo" src="${esc(h.img)}" alt="${esc(h.name)}" loading="lazy" onerror="this.remove()">` : ""}
      <div class="hd"><span><b>${esc(h.name)}</b> ${chosen ? `<span class="pill good">${hb && hb.booked ? "✓ הוזמן" : "✓ נבחר"}</span>` : h.rec ? '<span class="pill good">מומלץ</span>' : ""}
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
      ${+p.amount
        ? `<div class="pay paid"><span class="paidtag">✓ שולם</span><b class="num">${ils(+p.amount)}</b>${p.note ? `<span class="pnote">${esc(p.note)}</span>` : ""}</div>`
        : `<div class="pay open"><span class="pnote">טרם שולם</span></div>`}
    </div>`;
  }).join("");
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

/* ---------- הפעלה ----------
   הדף הראשי כולל כרגע רק את המפה, לכן מרנדרים רק אותה.
   שאר פונקציות הרינדור (משימות, מסלול, מלונות, תקציב, מזג אוויר) עדיין בקובץ
   ומחכות למרקאפ שיחזור — כל אחת מהן דורשת את האלמנטים שלה ב-index.html. */
loadTrip().then(t => {
  trip = t;
  FLIGHTS = t.flights.intl;
  DOMESTIC = t.flights.domestic || [];
  state = deriveState(t);
  renderCandidates();
  renderCosts();
  refreshMap();
  tryLeaflet();
}).catch(err => console.error("trip.js:", err));
