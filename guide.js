/* guide.js — הדף "המסע": מה עושים בכל יעד. בלי מחירים, בלי משימות.
   מקורות: trip.js (תאריכים, טיסות, מלונות) · attractions.js (האטרקציות, נערך ידנית) · routes.js (מסלולי נסיעה מחושבים).
   כל אטרקציה מקבלת מפה קטנה עם המסלול מהמלון: קודם סכמטית (SVG), ואם אריחי המפה נטענים — משודרגת ל-Leaflet. */
loadTrip().then(function (trip) {
  "use strict";

  const ATT = window.ATTRACTIONS || {};
  const ROUTES = window.ROUTES || {};
  const FLIGHTS = trip.flights.intl, DOMESTIC = trip.flights.domestic || [];
  const hotels = trip.hotels || {};
  const CANDS = Array.isArray(trip.candidates) ? trip.candidates : [];
  const dest2 = trip.secondDest || {};

  /* ---------- תאריכים ---------- */
  const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const d = s => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
  const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const x = d(s); x.setDate(x.getDate() + n); return iso(x); };
  const dm = s => `${d(s).getDate()}.${d(s).getMonth() + 1}`;
  const dow = s => DAYS[d(s).getDay()];
  const diffDays = (a, b) => Math.round((d(b) - d(a)) / 864e5);
  const nightsWord = n => n === 1 ? "לילה אחד" : `${n} לילות`;

  const out = FLIGHTS.legs[0], back = FLIGHTS.legs[1];
  const dom = DOMESTIC.find(f => f.from.code === "BKK") || DOMESTIC[0];
  const domBack = DOMESTIC.find(f => f.to.code === "BKK" && f !== dom) || null;
  const landBKK = out.arrDate;
  const toPhuket = dom.depDate;
  const bkkNights = diffDays(landBKK, toPhuket);
  const totalNights = diffDays(landBKK, back.depDate);
  const phuketNights = Math.min(totalNights - bkkNights - 1, Math.max(1, +trip.phuketNights || 6));
  const phuketEnd = addDays(toPhuket, phuketNights);
  const dest2End = back.depDate;
  const dest2Nights = diffDays(phuketEnd, dest2End);

  /* ---------- עוזרים ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = id => document.getElementById(id);
  const candOf = key => { const h = hotels[key]; return (h && h.candId && CANDS.find(c => c.id === h.candId)) || null; };
  const navUrl = (from, to) => `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ""}&destination=${to.lat},${to.lng}&travelmode=driving`;
  const mapUrl = p => p.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.q || `${p.lat},${p.lng}`)}`;

  const ICON = {
    car: `<svg viewBox="0 0 24 24"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm2.5 3a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4m9 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4M6.6 10h10.8l-1-3H7.6z"/></svg>`,
    plane: `<svg viewBox="0 0 24 24"><path d="M21 15.5 13.5 11V4.8a1.5 1.5 0 0 0-3 0V11L3 15.5V17l7.5-2.2v4L8 20.3V21.5l4-1 4 1v-1.2l-2.5-1.5v-4L21 17z"/></svg>`,
    pin: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>`,
    ext: `<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`,
    expand: `<svg viewBox="0 0 24 24"><path d="M9 4H4v5"/><path d="M4 4l6 6"/><path d="M15 20h5v-5"/><path d="M20 20l-6-6"/></svg>`
  };

  /* ---------- הפרקים: יעד = מלון + אטרקציות ---------- */
  const CH = [
    { key: "bangkok", att: "bangkok", name: "בנגקוק", hotelKey: "bangkok", from: landBKK, to: toPhuket, nights: bkkNights,
      sub: "נוחתים, ישנים ליד השדה וממריאים דרומה בבוקר" },
    { key: "phuket", att: "phuket", name: "פוקט", hotelKey: "phuket", from: toPhuket, to: phuketEnd, nights: phuketNights,
      sub: "הבסיס הראשון — חוף פרטי, בריכות, והאי מסביב" },
    { key: "khaolak", att: dest2.id || "khaolak", name: dest2.name || "קאו לאק", hotelKey: "second", from: phuketEnd, to: dest2End, nights: dest2Nights,
      sub: "שקט, ג'ונגל וחוף ארוך — הסוף הרגוע של הטיול" }
  ];

  /* ---------- הירו ---------- */
  const firstNames = (trip.travelers || []).map(t => String(t.name).split(" ")[0]);
  const attCount = CH.reduce((n, c) => n + ((ATT[c.att] || []).length), 0);
  el("heroKick").textContent = `${dm(out.depDate)} – ${dm(back.arrDate)}.${d(back.arrDate).getFullYear()}`;
  el("heroLede").textContent = `${firstNames.join(", ")} — ${CH.length} יעדים, ${totalNights} לילות ואי אחד שלם באמצע.`;
  el("heroFacts").innerHTML = [
    [CH.length, "יעדים"], [totalNights, "לילות"], [DOMESTIC.length + 2, "טיסות"], [attCount, "מקומות לראות"]
  ].map(([n, l]) => `<li><b>${n}</b>${esc(l)}</li>`).join("");
  el("footUpdated").textContent = trip.updated ? `עודכן ${dm(trip.updated)}.${d(trip.updated).getFullYear()}` : "";

  /* ---------- ניווט דביק ---------- */
  el("chapNav").innerHTML = CH.map(c => `<a href="#ch-${c.key}" data-ch="${c.key}"><i></i>${esc(c.name)}</a>`).join("");

  /* ---------- רצועת הלילות ---------- */
  const where = s => {
    if (s < landBKK || s >= back.depDate) return "air";
    if (s < toPhuket) return "bangkok";
    if (s < phuketEnd) return "phuket";
    return "khaolak";
  };
  const days = [];
  for (let s = out.depDate; s <= back.arrDate; s = addDays(s, 1)) days.push(s);
  const today = iso(new Date());
  el("ribbon").innerHTML = days.map(s =>
    `<div class="d ${where(s)}${s === today ? " today" : ""}" title="${dm(s)} · ${esc(where(s) === "air" ? "במטוס" : CH.find(c => c.key === where(s)).name)}">${d(s).getDate()}</div>`
  ).join("");
  el("ribbonKey").innerHTML = CH.map(c => `<span class="${c.key}"><i></i><b>${esc(c.name)}</b> · ${nightsWord(c.nights)}</span>`).join("")
    + `<span class="air"><i></i><b>במטוס</b> · 2 לילות</span>`;

  /* ---------- טיסות / מעברים ---------- */
  const legCard = o => `
    <div class="leg rise">
      <div class="leg-top">
        <span class="leg-codes" dir="ltr">
          <b>${esc(o.a)}</b>
          <span class="arrow">${o.car ? ICON.car : ICON.plane}</span>
          <b>${esc(o.b)}</b>
        </span>
      </div>
      <p class="leg-when">${o.when}</p>
      ${o.tag ? `<p class="leg-tag">${esc(o.tag)}</p>` : ""}
      ${o.note ? `<p class="leg-note">${esc(o.note)}</p>` : ""}
    </div>`;

  const flightLeg = (f, label) => legCard({
    a: f.from.code, b: f.to.code,
    when: `<b>${esc(f.no)}</b> · יום ${esc(dow(f.depDate))} ${esc(dm(f.depDate))} · ${esc(f.depTime)} → ${esc(f.arrTime)}${f.arrNote ? " " + esc(f.arrNote) : ""}`,
    tag: `${esc(f.airline || FLIGHTS.airline)} · ${esc(f.dur)} ${f.direct ? "· ישיר" : ""} · ${esc(label)}`,
    note: f.guideNote || ""
  });

  /* ---------- מלון ---------- */
  const stayCard = (ch) => {
    const hb = hotels[ch.hotelKey] || {}, c = candOf(ch.hotelKey);
    const name = (c && c.name) || hb.name || "טרם נבחר מלון";
    const img = c && c.img && c.img[0];
    const rows = [
      ["חדר", c && c.room],
      ["הסעדה", (c && c.board) || hb.board],
      ["צ'ק-אין", `יום ${dow(ch.from)} ${dm(ch.from)}`],
      ["צ'ק-אאוט", `יום ${dow(ch.to)} ${dm(ch.to)}`],
      ["כתובת", c && c.address],
      ["הזמנה", hb.ref]
    ].filter(r => r[1]);
    return `
      <div class="stay rise">
        <div class="stay-img">
          <span class="label">איפה ישנים</span>
          ${img ? `<img src="${esc(img)}" alt="${esc(name)}" loading="lazy">` : ""}
          <h3>${esc(name)}</h3>
        </div>
        <div class="stay-body">
          ${c && c.area ? `<p class="stay-area">${esc(c.area)}</p>` : ""}
          <dl class="stay-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
          ${c && c.note ? `<p class="stay-note">${esc(c.note.replace(/^נסגר [\d.]+ · /, ""))}</p>` : ""}
          <div class="links">
            ${c ? `<a class="primary" href="${esc(navUrl(null, { lat: c.lat, lng: c.lng }))}" target="_blank" rel="noopener">${ICON.pin}ניווט למלון</a>` : ""}
            ${c && c.site ? `<a href="${esc(c.site)}" target="_blank" rel="noopener">${ICON.ext}אתר המלון</a>` : ""}
          </div>
        </div>
      </div>`;
  };

  /* ---------- אטרקציה ---------- */
  const rideOf = a => {
    if (a.travel && a.travel.min) return { km: a.travel.km, min: a.travel.min, poly: (ROUTES[a.id] || {}).poly };
    const r = ROUTES[a.id];
    return r ? { km: r.km, min: r.min, poly: r.poly } : null;
  };

  const attCard = (a, hotel) => {
    const ride = rideOf(a);
    const peak = a.peak > 1 && ride ? Math.round(ride.min * a.peak) : 0;
    const meta = [
      a.tip ? ["💡", a.tip] : null,
      a.hours ? ["🕘", a.hours] : null
    ].filter(Boolean);
    return `
      <article class="att rise">
        <div class="att-map" data-att="${esc(a.id)}">
          ${ride && ride.poly ? schemSvg(ride.poly) : `<svg class="schem" viewBox="0 0 320 160"></svg>`}
          ${ride ? `<span class="ride">${ICON.car}<b>${ride.min} דק'</b><span>במונית · ${ride.km} ק"מ</span></span>` : ""}
          ${hotel ? `<a class="zoom" href="${esc(navUrl(hotel, a))}" target="_blank" rel="noopener">${ICON.expand}מסלול</a>` : ""}
        </div>
        <div class="att-body">
          <div class="att-top">
            <h4>${esc(a.name)}</h4>
            ${a.cat ? `<span class="cat${a.baby ? " baby" : ""}">${esc(a.cat)}${a.baby ? " 👶" : ""}</span>` : ""}
          </div>
          <p class="att-en" dir="ltr">${esc(a.en || "")}</p>
          <p class="att-blurb">${esc(a.blurb || "")}</p>
          ${peak ? `<p class="att-peak">בשעות העומס הנסיעה יכולה להגיע ל-${peak} דק'.</p>` : ""}
          ${meta.length ? `<div class="att-meta">${meta.map(([i, t]) => `<p><i>${i}</i>${esc(t)}</p>`).join("")}</div>` : ""}
          <div class="links">
            <a href="${esc(mapUrl({ lat: a.lat, lng: a.lng, q: a.en || a.name }))}" target="_blank" rel="noopener">${ICON.pin}במפה</a>
            ${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${ICON.ext}אתר</a>` : ""}
          </div>
        </div>
      </article>`;
  };

  /* ---------- מפה סכמטית (תמיד עובדת, גם בלי אינטרנט) ---------- */
  function decodePoly(str) {
    const pts = []; let i = 0, lat = 0, lng = 0;
    while (i < str.length) {
      let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (res & 1) ? ~(res >> 1) : (res >> 1);
      shift = 0; res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (res & 1) ? ~(res >> 1) : (res >> 1);
      pts.push([lat / 1e5, lng / 1e5]);
    }
    return pts;
  }

  function schemSvg(poly) {
    const pts = decodePoly(poly);
    if (pts.length < 2) return `<svg class="schem" viewBox="0 0 320 160"></svg>`;
    const W = 320, H = 160, P = 22;
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
    const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lngs), lo1 = Math.max(...lngs);
    const midLat = (la0 + la1) / 2, kx = Math.cos(midLat * Math.PI / 180);
    const w = Math.max((lo1 - lo0) * kx, 1e-5), h = Math.max(la1 - la0, 1e-5);
    const s = Math.min((W - 2 * P) / w, (H - 2 * P) / h);
    const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
    const X = lng => ox + (lng - lo0) * kx * s;
    const Y = lat => oy + (la1 - lat) * s;
    const dPath = pts.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)} ${Y(p[0]).toFixed(1)}`).join("");
    const a = pts[0], b = pts[pts.length - 1];
    const grid = [40, 80, 120].map(y => `<line class="grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/>`).join("")
      + [80, 160, 240].map(x => `<line class="grid" x1="${x}" y1="0" x2="${x}" y2="${H}"/>`).join("");
    return `<svg class="schem" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      ${grid}
      <path class="route" d="${dPath}"/>
      <circle cx="${X(a[1]).toFixed(1)}" cy="${Y(a[0]).toFixed(1)}" r="5" fill="#55CFC0" stroke="#0B1618" stroke-width="2"/>
      <circle cx="${X(b[1]).toFixed(1)}" cy="${Y(b[0]).toFixed(1)}" r="6" fill="#F3B054" stroke="#0B1618" stroke-width="2"/>
    </svg>`;
  }

  /* ---------- בנייה ---------- */
  let html = "";
  out.guideNote = "טיסת לילה — ארבל אמורה לישון רוב הדרך. נוחתים בבנגקוק בצהריים.";
  html += flightLeg({ ...out, airline: FLIGHTS.airline }, "הטיסה לתאילנד");

  CH.forEach((ch, i) => {
    const list = ATT[ch.att] || [];
    const c = candOf(ch.hotelKey);
    const hotelPt = c ? { lat: c.lat, lng: c.lng } : null;
    html += `
      <section class="chapter" id="ch-${ch.key}" data-ch="${ch.key}">
        <div class="ch-head rise">
          <span class="ch-num">0${i + 1}</span>
          <div>
            <h2>${esc(ch.name)}</h2>
            <p class="ch-when">${nightsWord(ch.nights)} · ${dm(ch.from)} → ${dm(ch.to)}</p>
            <p class="ch-sub">${esc(ch.sub)}</p>
          </div>
        </div>
        ${stayCard(ch)}
        <div class="sec-head rise"><h3>מה עושים כאן</h3><span>${list.length ? list.length + " מקומות · זמני נסיעה מהמלון" : ""}</span></div>
        ${list.length
          ? `<div class="att-grid">${list.map(a => attCard(a, hotelPt)).join("")}</div>`
          : `<p class="empty-att rise">עוד לא הוספנו אטרקציות ליעד הזה. מוסיפים אותן בקובץ attractions.js.</p>`}
      </section>`;

    if (i === 0) html += flightLeg({ ...dom, guideNote: dom.note }, "טיסה פנימית");
    if (i === 1) html += legCard({
      a: "פוקט", b: CH[2].name, car: true,
      when: `<b>נסיעה ברכב</b> · יום ${esc(dow(phuketEnd))} ${esc(dm(phuketEnd))}`,
      tag: "כשעה וחצי נסיעה · רכב פרטי עם כיסא בטיחות",
      note: "צ'ק-אאוט בפוקט בבוקר, ונוסעים צפונה לאורך החוף."
    });
    if (i === 2 && domBack) html += flightLeg({ ...domBack, guideNote: domBack.note }, "טיסה פנימית");
  });

  back.guideNote = "טיסת לילה הביתה — נוחתים בתל אביב בשבת בבוקר.";
  html += flightLeg({ ...back, airline: FLIGHTS.airline }, "הטיסה הביתה");
  el("flow").innerHTML = html;

  /* ---------- שדרוג המפות ל-Leaflet (רק אם האריחים נטענים) ---------- */
  const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";   // אריחים חופשיים; הכהייה נעשית ב-CSS
  const attIndex = {};
  CH.forEach(ch => { const c = candOf(ch.hotelKey); (ATT[ch.att] || []).forEach(a => { attIndex[a.id] = { a, hotel: c }; }); });

  const upgradeMap = box => {
    const rec = attIndex[box.dataset.att];
    const ride = rec && rideOf(rec.a);
    if (!rec || !rec.hotel || !ride || !ride.poly || box.dataset.up) return;
    box.dataset.up = "1";
    try {
      const line = decodePoly(ride.poly);
      const holder = document.createElement("div");
      holder.style.cssText = "position:absolute;inset:0;";
      box.insertBefore(holder, box.firstChild);
      const map = L.map(holder, {
        zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false
      });
      L.tileLayer(TILES, { subdomains: "abc", maxZoom: 19 }).addTo(map);
      L.polyline(line, { color: "#0B1618", weight: 7, opacity: .55 }).addTo(map);
      L.polyline(line, { color: "#F3B054", weight: 3.4, opacity: .95 }).addTo(map);
      L.circleMarker([rec.hotel.lat, rec.hotel.lng], { radius: 6, color: "#0B1618", weight: 2, fillColor: "#55CFC0", fillOpacity: 1 })
        .bindTooltip("המלון", { direction: "top", opacity: .9 }).addTo(map);
      L.circleMarker([rec.a.lat, rec.a.lng], { radius: 7, color: "#0B1618", weight: 2, fillColor: "#F3B054", fillOpacity: 1 })
        .bindTooltip(rec.a.name, { direction: "top", opacity: .9 }).addTo(map);
      map.fitBounds(L.latLngBounds(line).pad(.12), { animate: false });
      const svg = box.querySelector("svg.schem");
      if (svg) svg.remove();
      setTimeout(() => map.invalidateSize(), 120);
    } catch (e) { /* נשארים עם הסכמטית */ }
  };

  let tilesOk = false;
  const pending = [];
  const probe = new Image();
  probe.onload = () => { tilesOk = true; pending.splice(0).forEach(upgradeMap); };
  probe.onerror = () => { pending.length = 0; };
  probe.src = "https://a.tile.openstreetmap.org/8/202/117.png";

  if ("IntersectionObserver" in window && typeof L !== "undefined") {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      if (tilesOk) upgradeMap(e.target); else pending.push(e.target);
    }), { rootMargin: "300px 0px" });
    document.querySelectorAll(".att-map").forEach(b => io.observe(b));
  }

  /* ---------- כניסה רכה + ניווט פעיל ---------- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reduce) {
    const rio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".rise").forEach(n => rio.observe(n));
  } else document.querySelectorAll(".rise").forEach(n => n.classList.add("in"));

  const navLinks = [...document.querySelectorAll(".chapnav a")];
  if ("IntersectionObserver" in window) {
    const sio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle("on", a.dataset.ch === e.target.dataset.ch));
    }), { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll(".chapter").forEach(s => sio.observe(s));
  }
  navLinks.forEach(a => a.addEventListener("click", ev => {
    const t = document.getElementById(a.getAttribute("href").slice(1));
    if (!t) return;
    ev.preventDefault();
    const top = t.getBoundingClientRect().top + scrollY - (document.querySelector(".chapnav").offsetHeight + 12);
    scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }));
});
