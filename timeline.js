/* ציר הזמן — בונה את הנקודות מתוך trip.js (טיסות, מלונות, לילות, תשלומים) + הקטלוג ב-data.js (HOTELS)
   מצבים: done = סגור ושולם · todo = ידוע מה צריך, רק להזמין · open = עוד לא הוחלט.
   נקודות מלון נפתחות כאקורדיון; נקודות טיסה פותחות כרטיס טיסה (דיאלוג) עם אנימציית מטוס. */
loadTrip().then(function (trip) {
  "use strict";

  const FLIGHTS = trip.flights.intl, DOMESTIC = trip.flights.domestic || [];
  const hotels = trip.hotels || {};
  const hotelChoice = { phuket: hotels.phuket && hotels.phuket.id, second: hotels.second && hotels.second.id };
  const paid = trip.payments || {};
  const dest2 = trip.secondDest || { decided: false };
  const dest2Name = dest2.decided && dest2.name ? dest2.name : "אאו נאנג או קאו לאק";

  /* ---------- תאריכים ---------- */
  const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const MON = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  const MONF = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const d = s => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
  const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const x = d(s); x.setDate(x.getDate() + n); return iso(x); };
  const dm = s => `${d(s).getDate()}.${d(s).getMonth() + 1}`;
  const dow = s => DAYS[d(s).getDay()];
  const longDate = s => `יום ${dow(s)}, ${d(s).getDate()} ב${MONF[d(s).getMonth()]} ${d(s).getFullYear()}`;
  const diffDays = (a, b) => Math.round((d(b) - d(a)) / 864e5);
  const subMin = (hm, m) => { const [h, mm] = hm.split(":").map(Number); const t = h * 60 + mm - m; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

  const out = FLIGHTS.legs[0], back = FLIGHTS.legs[1];
  const dom = DOMESTIC.find(f => f.from.code === "BKK") || DOMESTIC[0];          // בנגקוק → פוקט
  const domBack = DOMESTIC.find(f => f.to.code === "BKK" && f !== dom) || null;  // חזרה לבנגקוק (אם נסגרה)
  const landBKK = out.arrDate;              // 1.11
  const toPhuket = dom.depDate;             // 2.11
  const bkkNights = diffDays(landBKK, toPhuket);          // 1
  const total = diffDays(landBKK, back.depDate);          // 13 לילות מלון
  const rest = total - bkkNights;                          // 12
  const phuketNights = Math.min(rest - 1, Math.max(1, +trip.phuketNights || Math.ceil(rest / 2))); // 6
  const dest2Nights = rest - phuketNights;                  // 6
  const phuketEnd = addDays(toPhuket, phuketNights);      // 8.11
  const dest2End = back.depDate;                           // 14.11

  const phuketHotel = HOTELS.find(h => h.id === hotelChoice.phuket) || null;
  const phuketBooked = !!(hotels.phuket && hotels.phuket.booked);
  const bkkHotel = hotels.bangkok && hotels.bangkok.name ? hotels.bangkok : null;
  const secondHotel = hotels.second || {};
  const secondBooked = !!secondHotel.booked;

  /* ---------- עוזרים ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mono = s => `<span class="mono">${esc(s)}</span>`;
  const kv = rows => `<dl class="kv">${rows.filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
  const seg = (h, items) => `<div class="seg"><h4>${esc(h)}</h4><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></div>`;
  const note = t => `<p class="note">${t}</p>`;
  const actions = list => `<div class="actions">${list.map(a => `<a href="${a.u}" target="_blank" rel="noopener"${a.p ? ' class="primary"' : ""}>${esc(a.l)}</a>`).join("")}</div>`;
  const gmaps = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  const booking = (q, ci, co) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}&checkin=${ci}&checkout=${co}&group_adults=2&group_children=1&age=1&no_rooms=1`;
  const hasDigit = s => /\d/.test(String(s || ""));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- כרטיסי טיסה: נורמליזציה של הנתונים ---------- */
  const flightsPaid = paid.flightsIntl && paid.flightsIntl.amount ? `₪${paid.flightsIntl.amount.toLocaleString("he-IL")}` : "";
  const intlTicket = leg => ({
    kind: "intl", airline: FLIGHTS.airline, no: leg.no, ref: FLIGHTS.ref, status: FLIGHTS.status || "מאושר", dir: leg.dir,
    from: leg.from, to: leg.to, depDate: leg.depDate, depTime: leg.depTime, arrDate: leg.arrDate, arrTime: leg.arrTime, arrNote: leg.arrNote,
    dur: leg.dur, direct: leg.direct, cls: leg.cls, plane: leg.plane, meal: leg.meal, bags: leg.bags,
    paid: flightsPaid ? flightsPaid + " · הלוך + חזור" : "",
    seatsNote: hasDigit(leg.seats) ? "" : leg.seats,
    pax: FLIGHTS.pax.map(p => {
      const infant = !hasDigit(p.seat);
      return { name: p.name, ticket: p.ticket, seat: infant ? p.seat : (hasDigit(leg.seats) ? p.seat : leg.seats), bag: infant ? "עגלה + תיק" : leg.bags, infant };
    }),
    note: leg.dir === "הלוך"
      ? "יוצאים במוצ\"ש בלילה — ארבל תישן רוב הטיסה. נוחתים בצהריים ונשארים בבנגקוק ללילה אחד."
      : "טיסת לילה — נוחתים בשבת בבוקר. מגיעים לסוברנבומי מהטיסה הפנימית עם כ-5 שעות מרווח."
  });
  const domTicket = f => ({
    kind: "dom", airline: f.airline, no: f.no, ref: f.ref, status: f.status || "מאושר", dir: f.from.code === "BKK" ? "לדרום" : "לבנגקוק",
    from: f.from, to: f.to, depDate: f.depDate, depTime: f.depTime, arrDate: f.arrDate, arrTime: f.arrTime, arrNote: f.arrNote,
    dur: f.dur, direct: f.direct, cls: f.cls, fare: f.fare, plane: f.plane, meal: "", bags: "",
    paid: f.paid ? `₪${f.paid.toLocaleString("he-IL")}` : "",
    checkin: `נסגר 45 דק' לפני ההמראה — בשער עד ${subMin(f.depTime, 45)}`,
    pax: (f.pax || []).map(p => ({ name: p.name, seat: p.seat, bag: p.bag, extra: p.extra, status: p.status, infant: !hasDigit(p.seat) })),
    note: f.note || ""
  });

  const TICKETS = {
    "intl-out": intlTicket(out),
    "intl-back": intlTicket(back),
    "dom-out": domTicket(dom)
  };
  if (domBack) TICKETS["dom-back"] = domTicket(domBack);

  /* ---------- הנקודות ---------- */
  const NODES = [
    {
      id: "intl-out", status: "done", ticket: true,
      date: out.depDate, endDate: out.arrDate,
      title: "טיסה בינלאומית · תל אביב → בנגקוק",
      sum: `${esc(FLIGHTS.airline)} · ${mono(out.no)} · המראה ${mono(out.depTime)}, נחיתה ${mono(out.arrTime)} למחרת`
    },
    {
      id: "bkk-hotel", status: bkkHotel && bkkHotel.booked ? "done" : "todo",
      date: landBKK, endDate: toPhuket,
      title: `מלון בבנגקוק · ${bkkNights === 1 ? "לילה אחד" : bkkNights + " לילות"}`,
      need: bkkHotel && bkkHotel.booked ? "" : "לבחור מלון צמוד לשדה סוברנבומי ולהזמין",
      sum: bkkHotel
        ? `${esc(bkkHotel.name)}${bkkHotel.ref ? " · הזמנה " + mono(bkkHotel.ref) : ""} · ${mono(dm(landBKK))} → ${mono(dm(toPhuket))}`
        : `${mono(dm(landBKK))} → ${mono(dm(toPhuket))} · צ'ק-אאוט מוקדם בבוקר למחרת`,
      body: kv([
        bkkHotel ? ["המלון", `<b>${esc(bkkHotel.name)}</b>${bkkHotel.note ? " · " + esc(bkkHotel.note) : ""}`] : ["", ""],
        ["לילות", mono(String(bkkNights))],
        ["הגעה", `${esc(dow(landBKK))} ${mono(dm(landBKK))}, נחיתה ${mono(out.arrTime)} + עמידה בבידוק ~שעה`],
        ["יציאה", `${esc(dow(toPhuket))} ${mono(dm(toPhuket))}, צריך להיות בטרמינל D עד ${mono(subMin(dom.depTime, 75))}`]
      ]) + seg("מה חשוב במלון הזה", [
        `<b>קרוב לשדה</b> — הטיסה לפוקט ממריאה ב-${dom.depTime}, לא שווה לנסוע לעיר ובחזרה`,
        "<b>שאטל לשדה</b> או הליכה מקורה מהטרמינל",
        "<b>עריסה לתינוקת</b> — לבקש מראש",
        "ארוחת בוקר מוקדמת או ארוחה ארוזה — יוצאים לפני 06:00"
      ]) + seg("כיוונים לבדיקה", [
        "<b>Novotel Bangkok Suvarnabhumi Airport</b> — מחובר לטרמינל בגשר הליכה, הכי פשוט עם עגלה ומזוודות",
        "מלונות באזור לאט קראבאנג עם שאטל חינם — זולים יותר, 10–15 דק' נסיעה"
      ]) + note("זה הלילה הקל ביותר לסגור: מלון אחד, קריטריון אחד (קרבה לשדה). כדאי לסגור אותו יחד עם המלון בפוקט.")
        + actions([
          { l: "חיפוש ב-Booking", u: booking("Suvarnabhumi Airport Bangkok", landBKK, toPhuket), p: true },
          { l: "מפה — מלונות ליד השדה", u: gmaps("hotels near Suvarnabhumi Airport") }
        ])
    },
    {
      id: "dom-out", status: "done", ticket: true,
      date: dom.depDate,
      title: "טיסה פנימית · בנגקוק → פוקט",
      sum: `${esc(dom.airline)} · ${mono(dom.no)} · ${mono(dom.depTime)} → ${mono(dom.arrTime)}`
    },
    {
      id: "phuket-hotel", status: phuketBooked ? "done" : "todo",
      date: toPhuket, endDate: phuketEnd,
      title: `מלון בפוקט · ${phuketNights} לילות`,
      need: phuketBooked ? "" : phuketHotel ? `המלון נבחר (${esc(phuketHotel.name)}) — נשאר להזמין` : "לבחור מלון ולהזמין",
      sum: phuketHotel
        ? `${esc(phuketHotel.name)} · ${esc(phuketHotel.area)} · ${mono(dm(toPhuket))} → ${mono(dm(phuketEnd))}`
        : `${mono(dm(toPhuket))} → ${mono(dm(phuketEnd))} · עוד לא נבחר מלון`,
      body: kv([
        ["צ'ק-אין", `${esc(dow(toPhuket))} ${mono(dm(toPhuket))} — נוחתים ${mono(dom.arrTime)}, במלון בערך ב-${mono("10:30")} (חדר בד"כ מוכן מ-14:00, לבקש early check-in)`],
        ["צ'ק-אאוט", `${esc(dow(phuketEnd))} ${mono(dm(phuketEnd))} — וממשיכים ברכב ל${esc(dest2Name)} (~1.5 ש')`],
        ["לילות", mono(String(phuketNights))],
        phuketHotel ? ["המלון שנבחר", `<b>${esc(phuketHotel.name)}</b> · ${esc(phuketHotel.area)}`] : ["", ""],
        phuketBooked && hotels.phuket.ref ? ["מספר הזמנה", mono(hotels.phuket.ref)] : ["", ""],
        phuketHotel && phuketHotel.booking ? ["ציון Booking", mono(phuketHotel.booking)] : ["", ""],
        phuketHotel && phuketHotel.usd ? ["מחיר ללילה", mono(`$${phuketHotel.usd[0]}–${phuketHotel.usd[1]}`) + ` · לכל השהות ~${mono("$" + (phuketHotel.usd[0] * phuketNights) + "–" + (phuketHotel.usd[1] * phuketNights))}`] : ["", ""],
        phuketHotel && phuketHotel.phone ? ["טלפון", mono(phuketHotel.phone)] : ["", ""]
      ]) + (phuketHotel ? seg("למה דווקא הוא", phuketHotel.pros.map(esc)) : "")
        + (phuketHotel && phuketHotel.warns && phuketHotel.warns.length ? note("⚠ " + esc(phuketHotel.warns[0])) : "")
        + actions([
          { l: "להזמין ב-Booking", u: booking(phuketHotel ? phuketHotel.name : "Phuket", toPhuket, phuketEnd), p: true },
          phuketHotel && phuketHotel.site ? { l: "אתר המלון", u: phuketHotel.site } : null,
          { l: "מפה", u: gmaps(phuketHotel ? phuketHotel.name : "Phuket hotels") }
        ].filter(Boolean))
    },
    {
      id: "dest2-hotel", status: dest2.decided ? (secondBooked ? "done" : "todo") : "open",
      date: phuketEnd, endDate: dest2End,
      title: dest2.decided ? `מלון ב${esc(dest2Name)} · ${dest2Nights} לילות` : `יעד שני · ${esc(dest2Name)} · ${dest2Nights} לילות`,
      need: dest2.decided
        ? (secondBooked ? "" : `לבחור ריזורט ב${esc(dest2Name)} ולהזמין`)
        : "להחליט בין אאו נאנג לקאו לאק — ורק אז לחפש מלון",
      sum: secondHotel.name
        ? `${esc(secondHotel.name)}${secondHotel.ref ? " · הזמנה " + mono(secondHotel.ref) : ""} · ${mono(dm(phuketEnd))} → ${mono(dm(dest2End))}`
        : `${mono(dm(phuketEnd))} → ${mono(dm(dest2End))} · ${dest2.decided ? "היעד סגור, עוד לא נבחר מלון" : "ההחלטה נשארת לסוף"}`,
      body: kv([
        ["צ'ק-אין", `${esc(dow(phuketEnd))} ${mono(dm(phuketEnd))} — נסיעה מפוקט ברכב פרטי עם כיסא בטיחות, ~1.5 ש'`],
        ["צ'ק-אאוט", `${esc(dow(dest2End))} ${mono(dm(dest2End))} — ${domBack ? `לשדה פוקט (HKT) לטיסה ${mono(domBack.no)} ב-${mono(domBack.depTime)}; לצאת מהמלון עד ${mono(subMin(domBack.depTime, 210))}` : "חוזרים לשדה פוקט"}`],
        ["לילות", mono(String(dest2Nights))],
        secondHotel.name ? ["המלון", `<b>${esc(secondHotel.name)}</b>${secondHotel.ref ? " · " + mono(secondHotel.ref) : ""}`] : ["", ""],
        ["מה נשאר", secondBooked ? "הכול סגור" : "רק המלון — היעד והטיסות סגורים"]
      ]) + seg("מה חשוב במלון הזה", [
        "<b>ריזורט על החוף</b> — קאו לאק זה לא עיירה; כל השהות סביב המלון, החוף והבריכה",
        "<b>בריכת ילדים / מים רדודים</b> ומועדון תינוקות אם יש",
        "<b>מסעדות בהליכה</b> — רצועת באנג ניאנג או נאנג תונג, לא ריזורט מבודד",
        "<b>עריסה + הסעה מפוקט</b> — לרוב המלונות יש שירות רכב מהשדה/מפוקט"
      ]) + seg("כיוונים לבדיקה", [
        "<b>JW Marriott Khao Lak</b> — בריכה ענקית, מועדון ילדים, חוף ארוך",
        "<b>Le Méridien Khao Lak</b> — קרוב לרצועת המסעדות של קוק קאק",
        "<b>The Sarojin</b> / <b>Khao Lak Laguna</b> — שקטים יותר, ברמת בוטיק"
      ]) + note(`היעד סגור (${esc(dest2Name)}, ${dest2Nights} לילות) והטיסה חזרה לבנגקוק ${domBack ? "כבר קנויה" : "עדיין פתוחה"} — זה המלון האחרון שנשאר לסגור.`)
        + actions([
          { l: "חיפוש ב-Booking", u: booking("Khao Lak", phuketEnd, dest2End), p: true },
          { l: "מפה — קאו לאק", u: gmaps("Khao Lak beach resorts") }
        ])
    },
    domBack ? {
      id: "dom-back", status: "done", ticket: true,
      date: domBack.depDate,
      title: "טיסה פנימית · פוקט → בנגקוק",
      sum: `${esc(domBack.airline)} · ${mono(domBack.no)} · ${mono(domBack.depTime)} → ${mono(domBack.arrTime)} · המשך לאל על ב-${mono(back.depTime)}`
    } : {
      id: "dom-back", status: "todo",
      date: dest2End,
      title: "טיסה פנימית · חזרה לבנגקוק",
      need: "להזמין טיסה שנוחתת בסוברנבומי עד 19:30",
      sum: `${mono(dm(dest2End))} · חייבים לנחות בבנגקוק מספיק זמן לפני ${mono(back.depTime)}`,
      body: kv([
        ["תאריך", `${esc(dow(dest2End))} ${mono(dm(dest2End))}`],
        ["דדליין נחיתה", "לנחות בסוברנבומי (BKK) עד ~" + mono("19:30")]
      ]) + actions([{ l: "טיסות HKT → BKK", u: `https://www.google.com/travel/flights?q=Flights%20from%20HKT%20to%20BKK%20on%20${dest2End}`, p: true }])
    },
    {
      id: "intl-back", status: "done", ticket: true,
      date: back.depDate, endDate: back.arrDate,
      title: "טיסה בינלאומית · בנגקוק → תל אביב",
      sum: `${esc(FLIGHTS.airline)} · ${mono(back.no)} · המראה ${mono(back.depTime)}, נחיתה ${mono(back.arrTime)} למחרת`
    }
  ];

  /* ---------- שפת המצב: תג אחד בכל הדף ---------- */
  const LABEL = { done: "סגור", todo: "לפעולה", open: "פתוח" };
  const badge = st => `<span class="badge ${st}"><i></i>${LABEL[st]}</span>`;
  const count = s => NODES.filter(n => n.status === s).length;

  /* ---------- לוח מצב: התקדמות + סינון ---------- */
  document.getElementById("progNum").textContent = `${count("done")}/${NODES.length}`;
  document.getElementById("progress").innerHTML = NODES.map(n => `<i class="${n.status}"></i>`).join("");

  const FILTERS = [
    { k: "all", l: "הכול", n: NODES.length },
    { k: "todo", l: LABEL.todo, n: count("todo") },
    { k: "open", l: LABEL.open, n: count("open") },
    { k: "done", l: LABEL.done, n: count("done") }
  ];
  document.getElementById("filters").innerHTML = FILTERS.map((f, i) =>
    `<button type="button" role="tab" data-k="${f.k}" aria-selected="${i === 0}"><i class="${f.k}"></i>${f.l}<b>${f.n}</b></button>`
  ).join("");

  /* ---------- רצועת ימים ---------- */
  const today = iso(new Date());
  const days = [];
  for (let s = out.depDate; s <= back.arrDate; s = addDays(s, 1)) days.push(s);
  const where = s => {
    if (s === out.depDate || s === back.arrDate) return "air";
    if (s >= landBKK && s < toPhuket) return "bkk";
    if (s >= toPhuket && s < phuketEnd) return "hkt";
    if (s >= phuketEnd && s < dest2End) return "dest2";
    return "air";
  };
  const LBL = { air: "במטוס", bkk: "בנגקוק", hkt: "פוקט", dest2: dest2.decided ? dest2Name : "יעד שני (?)" };
  const fixed = dest2.decided ? " fixed" : "";
  document.getElementById("dayStrip").innerHTML = days.map(s =>
    `<div class="d ${where(s)}${s === today ? " today" : ""}${fixed}" title="${dm(s)} · ${LBL[where(s)]}"><small>${d(s).getDate()}</small><i></i></div>`
  ).join("");
  document.getElementById("stripLegend").innerHTML = `
    <span><i class="bkk"></i>בנגקוק · ${bkkNights}</span>
    <span><i class="hkt"></i>פוקט · ${phuketNights}</span>
    <span><i class="dest2${fixed}"></i>${esc(LBL.dest2)} · ${dest2Nights}</span>
    <span><i class="air"></i>לילה במטוס</span>`;

  /* ---------- ציר הזמן ---------- */
  const whenHtml = n => {
    const a = d(n.date);
    const range = n.endDate && n.endDate !== n.date ? `<em>→ ${dm(n.endDate)}</em>` : "";
    return `<span class="when"><b>${a.getDate()}</b><small>${MON[a.getMonth()]}</small>${range}</span>`;
  };
  const chevIcon = `<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;
  const tktIcon = `<svg viewBox="0 0 24 24"><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"/><path d="M9 5v14" stroke-dasharray="2 2"/></svg>`;
  let html = "";
  NODES.forEach((n, i) => {
    const t = n.ticket ? TICKETS[n.id] : null;
    html += `
      <article class="node ${n.status}${n.ticket ? " flight" : ""}" id="${n.id}" data-status="${n.status}">
        <span class="knob" aria-hidden="true"></span>
        <div class="card">
          <button class="head" ${n.ticket ? `data-ticket="${n.id}" aria-haspopup="dialog"` : `aria-expanded="false" aria-controls="${n.id}-body"`}>
            ${whenHtml(n)}
            <span class="ttl">
              <span class="row1"><span class="h">${n.title}</span>${badge(n.status)}</span>
              <span class="sum">${n.sum}</span>
              ${n.need ? `<span class="need">${n.need}</span>` : ""}
              ${t ? `<span class="mini-route" dir="ltr"><b>${esc(t.from.code)}</b><i></i><b>${esc(t.to.code)}</b><small>${esc(t.dur)}</small></span>` : ""}
            </span>
            <span class="chev${n.ticket ? " tkt-hint" : ""}">${n.ticket ? tktIcon + "<small>כרטיס</small>" : chevIcon}</span>
          </button>
          ${n.ticket ? "" : `<div class="body" id="${n.id}-body"><div><div class="body-in">${n.body}</div></div></div>`}
        </div>
      </article>`;
    const next = NODES[i + 1];
    if (next && n.endDate && next.date > n.endDate) {
      const g = diffDays(n.endDate, next.date);
      html += `<div class="gap">${g} ימים בלי תוכנית</div>`;
    }
  });
  document.getElementById("tlList").innerHTML = html;

  /* ---------- כרטיס טיסה (דיאלוג) ---------- */
  // צללית מטוס שפונה ימינה (+x); rotate="auto" מסובב אותה לפי כיוון הקשת
  const PLANE = "M23 0 L9 -3.2 L1.5 -12.5 H-3 L1 -3.6 H-9.5 L-13 -7 H-16 L-13.8 -1.2 V1.2 L-16 7 H-13 L-9.5 3.6 H1 L-3 12.5 H1.5 L9 3.2 Z";
  const ARC = "M14 70 C 70 -6, 230 -6, 286 70";
  const routeSvg = t => `
    <svg class="tkt-sky" viewBox="0 0 300 84" aria-hidden="true">
      <path class="rail" d="${ARC}" pathLength="1"/>
      <path class="trail" d="${ARC}" pathLength="1"/>
      <circle class="pin" cx="14" cy="70" r="4"/>
      <circle class="pin" cx="286" cy="70" r="4"/>
      <circle class="pulse" cx="286" cy="70" r="4"/>
      ${reduced()
        ? `<g class="plane" transform="translate(286 70) rotate(54)"><path d="${PLANE}"/></g>`
        : `<g class="plane"><path d="${PLANE}"/><animateMotion dur="3.4s" begin="indefinite" repeatCount="indefinite" rotate="auto" calcMode="spline" keyPoints="0;1;1" keyTimes="0;0.68;1" keySplines="0.42 0 0.18 1;0 0 1 1" path="${ARC}"/></g>`}
      <text class="dur" x="150" y="38" text-anchor="middle">${esc(t.dur)}${t.direct ? " · ישיר" : ""}</text>
    </svg>`;
  const ticketHtml = t => {
    const rows = [
      ["מחלקה", t.cls], ["בסיס תעריף", t.fare], ["מטוס", t.plane], ["ארוחות", t.meal],
      ["כבודה", t.bags], ["הזמנה", t.ref], ["שולם", t.paid], ["צ'ק-אין", t.checkin]
    ].filter(r => r[1]);
    return `
      <div class="tkt-top">
        <div class="tkt-air"><span class="tkt-air-name">${esc(t.airline)}</span><span class="tkt-dir">${esc(t.dir)} · ${t.kind === "intl" ? "טיסה בינלאומית" : "טיסה פנימית"}</span></div>
        <div class="tkt-no mono">${esc(t.no)}</div>
        <div class="tkt-status"><i></i>${esc(t.status)}</div>
      </div>
      <div class="tkt-route" dir="ltr">
        <div class="tkt-ap tkt-from">
          <span class="code">${esc(t.from.code)}</span>
          <span class="time">${esc(t.depTime)}</span>
          <span class="city">${esc(t.from.city)}</span>
          <span class="date">${esc(longDate(t.depDate))}</span>
          <span class="term">${esc(t.from.term || "")}</span>
        </div>
        ${routeSvg(t)}
        <div class="tkt-ap tkt-to">
          <span class="code">${esc(t.to.code)}</span>
          <span class="time">${esc(t.arrTime)}${t.arrNote ? `<sup>${esc(t.arrNote)}</sup>` : ""}</span>
          <span class="city">${esc(t.to.city)}</span>
          <span class="date">${esc(longDate(t.arrDate))}</span>
          <span class="term">${esc(t.to.term || "")}</span>
        </div>
      </div>
      <div class="tkt-tear" aria-hidden="true"></div>
      <dl class="tkt-grid">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      <div class="tkt-pax">
        <h4>נוסעים${t.seatsNote ? ` <span class="tkt-seatnote">· מושבים: ${esc(t.seatsNote)}</span>` : ""}</h4>
        ${t.pax.map(p => `
          <div class="tkt-p${p.infant ? " infant" : ""}">
            <span class="seat mono">${p.infant ? "INF" : esc(p.seat)}</span>
            <span class="who"><b>${esc(p.name)}</b>${p.ticket ? `<small class="mono">${esc(p.ticket)}</small>` : ""}${p.infant ? `<small>${esc(p.seat)}${p.status ? " · " + esc(p.status) : ""}</small>` : ""}</span>
            <span class="bag"><svg viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 7V4h6v3M9 11v6M15 11v6"/></svg>${esc(p.bag || "—")}</span>
            ${p.extra ? `<span class="ex">${esc(p.extra)}</span>` : ""}
          </div>`).join("")}
      </div>
      ${t.note ? `<p class="tkt-note">${esc(t.note)}</p>` : ""}
      <div class="tkt-code" aria-hidden="true"><i></i><span class="mono">${esc(t.ref || t.no)} · ${esc(t.depDate.replace(/-/g, ""))} · ${esc(t.from.code)}${esc(t.to.code)}</span></div>`;
  };

  const overlay = document.getElementById("tktOverlay");
  const dialog = overlay.querySelector(".tkt");
  const inner = overlay.querySelector(".tkt-in");
  let lastFocus = null;
  const openTicket = id => {
    const t = TICKETS[id]; if (!t) return;
    lastFocus = document.activeElement;
    inner.innerHTML = ticketHtml(t);
    dialog.setAttribute("aria-label", `כרטיס טיסה ${t.no} ${t.from.code} → ${t.to.code}`);
    overlay.hidden = false;
    document.body.classList.add("tkt-lock");
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("on")));
    // המטוס ממריא רגע אחרי שהכרטיס עלה (SMIL מתחיל מפורשות — לא תלוי בשעון המסמך)
    const fly = inner.querySelector("animateMotion");
    if (fly && fly.beginElement) setTimeout(() => { try { fly.beginElement(); } catch (e) { } }, 350);
    overlay.querySelector(".tkt-close").focus();
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  };
  const closeTicket = () => {
    if (overlay.hidden) return;
    overlay.classList.remove("on");
    document.body.classList.remove("tkt-lock");
    const done = () => { overlay.hidden = true; inner.innerHTML = ""; };
    if (reduced()) done(); else setTimeout(done, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  overlay.addEventListener("click", e => { if (e.target.closest(".tkt-close") || e.target.classList.contains("tkt-scrim")) closeTicket(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeTicket(); });

  /* ---------- אינטראקציה: לחיצה בלבד ---------- */
  const nodes = Array.from(document.querySelectorAll(".node"));
  const gaps = Array.from(document.querySelectorAll(".gap"));
  const setOpen = (node, on) => {
    if (node.classList.contains("flight")) return;
    node.classList.toggle("is-open", on);
    node.querySelector(".head").setAttribute("aria-expanded", String(on));
  };
  nodes.forEach(node => {
    const head = node.querySelector(".head");
    head.addEventListener("click", () => {
      if (head.dataset.ticket) openTicket(head.dataset.ticket);
      else setOpen(node, !node.classList.contains("is-open"));
    });
  });

  // פתח/סגור הכול (רק נקודות מלון — טיסות נפתחות ככרטיס)
  const toggleAll = document.getElementById("toggleAll");
  toggleAll.addEventListener("click", () => {
    const vis = nodes.filter(n => !n.hidden && !n.classList.contains("flight"));
    const on = !vis.every(n => n.classList.contains("is-open"));
    vis.forEach(n => setOpen(n, on));
    toggleAll.textContent = on ? "סגור הכול" : "פתח הכול";
  });

  // סינון לפי מצב
  const empty = document.getElementById("empty");
  document.getElementById("filters").addEventListener("click", e => {
    const btn = e.target.closest("button[data-k]");
    if (!btn) return;
    const k = btn.dataset.k;
    document.querySelectorAll("#filters button").forEach(b => b.setAttribute("aria-selected", String(b === btn)));
    nodes.forEach(n => { n.hidden = k !== "all" && n.dataset.status !== k; });
    gaps.forEach(g => { g.hidden = k !== "all"; });
    empty.hidden = nodes.some(n => !n.hidden);
  });

  // דיפ-לינק: #bkk-hotel פותח את הנקודה וגולל אליה · #dom-out פותח את כרטיס הטיסה
  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el && el.classList.contains("node")) {
      el.scrollIntoView({ block: "center" });
      if (el.classList.contains("flight")) openTicket(el.id); else setOpen(el, true);
    }
  }
}).catch(err => console.error("timeline:", err));
