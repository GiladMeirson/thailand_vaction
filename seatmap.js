/* שרטוט מושבים — "איפה אנחנו יושבים" בתוך כרטיס הטיסה (timeline.js).
   window.seatMapHtml(ticket) מחזיר HTML: תיאור מילולי + SVG של תא התיירים (חרטום משמאל) + השורה שלנו בהגדלה.
   התצורות משוערות (aeroLOPA, ספט' 2026) — סוג המטוס המדויק נקבע סופית ביום הטיסה. */
(function () {
  "use strict";
  const CABINS = {
    "ly-772": {
      name: "בואינג 777-200ER · אל על", blocks: [["A", "B", "C"], ["D", "E", "F", "G"], ["H", "J", "K"]], from: 21, to: 48,
      link: "https://www.aerolopa.com/ly-772-1", linkLabel: "התרשים המלא ב-aeroLOPA",
      note: "מוצג תא התיירים בלבד (שורות 21–48, סידור 3-4-3). לאל על שתי תצורות 777-200ER — המיקום משוער עד יום הטיסה."
    },
    "pg-320": {
      name: "איירבוס A320 · Bangkok Airways", blocks: [["A", "B", "C"], ["D", "E", "F"]], from: 1, to: 28,
      link: "https://www.aerolopa.com/pg-320", linkLabel: "התרשים המלא ב-aeroLOPA",
      note: "תא יחיד, סידור 3-3, שורות 1–28. בקו הזה טס לפעמים גם A319 (24 שורות) — סוג המטוס נקבע סופית ביום הטיסה."
    }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parseSeat = s => { const m = /^(\d{1,2})([A-K])$/.exec(String(s || "").trim().toUpperCase()); return m ? { row: +m[1], col: m[2] } : null; };

  // תיאור המושב: חלון / ליד המעבר / אמצע, לפי מיקומו בבלוק
  const where = (cab, col) => {
    for (let b = 0; b < cab.blocks.length; b++) {
      const blk = cab.blocks[b], i = blk.indexOf(col);
      if (i < 0) continue;
      const first = b === 0, last = b === cab.blocks.length - 1;
      if ((first && i === 0) || (last && i === blk.length - 1)) return "חלון";
      if ((!first && i === 0) || (!last && i === blk.length - 1)) return "ליד המעבר";
      return "אמצע";
    }
    return "";
  };
  const blockName = (cab, col) => {
    const b = cab.blocks.findIndex(x => x.includes(col));
    if (cab.blocks.length === 2) return b === 0 ? "צד שמאל" : "צד ימין";
    return ["צד שמאל", "בלוק אמצעי", "צד ימין"][b] || "";
  };

  const svgMap = (cab, mine) => {
    const C = 13, G = 7, left = 30, top = 18;
    const nRows = cab.to - cab.from + 1, nSeats = cab.blocks.reduce((a, b) => a + b.length, 0);
    const seatsH = nSeats * C + (cab.blocks.length - 1) * G;
    const W = left + nRows * C + 22, H = top + seatsH + 8;
    const midY = top + seatsH / 2;
    const rows = new Set(mine.map(m => m.row));
    let s = `<svg class="sm-svg" viewBox="0 0 ${W + 4} ${H + 16}" dir="ltr" role="img" aria-label="מפת תא: ${esc(cab.name)}">`;
    s += `<path class="hull" d="M${left - 26} ${midY} C${left - 26} ${top - 8} ${left - 10} ${top - 8} ${left} ${top - 8} H${W - 12} C${W + 2} ${top - 8} ${W + 2} ${H} ${W - 12} ${H} H${left} C${left - 10} ${H} ${left - 26} ${H} ${left - 26} ${midY} Z"/>`;
    // עמודת השורה שלנו
    rows.forEach(r => { const x = left + (r - cab.from) * C; s += `<rect class="col" x="${x}" y="${top - 6}" width="${C}" height="${seatsH + 10}" rx="3"/>`; });
    // אותיות המושבים משמאל
    let y = top;
    cab.blocks.forEach((blk, b) => {
      blk.forEach(l => { s += `<text class="ltr" x="${left - 5}" y="${y + C - 4}" text-anchor="end">${l}</text>`; y += C; });
      if (b < cab.blocks.length - 1) y += G;
    });
    // המושבים
    for (let r = cab.from; r <= cab.to; r++) {
      const x = left + (r - cab.from) * C + 1.5;
      let yy = top;
      cab.blocks.forEach((blk, b) => {
        blk.forEach(l => {
          const me = mine.some(m => m.row === r && m.col === l);
          s += `<rect class="seat${me ? " me" : ""}" x="${x}" y="${yy + 1.5}" width="${C - 3}" height="${C - 3}" rx="2"/>`;
          yy += C;
        });
        if (b < cab.blocks.length - 1) yy += G;
      });
      const label = r % 5 === 0 || r === cab.from || r === cab.to || rows.has(r);
      if (label) s += `<text class="rown${rows.has(r) ? " me" : ""}" x="${x + (C - 3) / 2}" y="${H + 11}" text-anchor="middle">${r}</text>`;
    }
    s += `<text class="fwd" x="${left - 24}" y="${top - 12}">◀ קדימה</text>`;
    s += `</svg>`;
    return s;
  };

  const rowDetail = (cab, row, mine) => {
    const win = `<span class="win">חלון</span>`;
    const blocks = cab.blocks.map(blk => `<span class="blk" style="flex:${blk.length}">${blk.map(l => {
      const m = mine.find(x => x.row === row && x.col === l);
      return `<span class="s${m ? " me" : ""}">${l}${m ? `<small>${esc(m.who)}${m.infant ? " 👶" : ""}</small>` : ""}</span>`;
    }).join("")}</span>`).join(`<span class="aisle">מעבר</span>`);
    return `<div class="sm-rowh">שורה ${row}</div><div class="sm-row">${win}${blocks}${win}</div>`;
  };

  window.seatMapHtml = function (t) {
    const cab = CABINS[t.kind === "intl" ? "ly-772" : "pg-320"];
    if (!cab) return "";
    const mine = (t.pax || []).filter(p => !p.infant).map(p => {
      const ps = parseSeat(p.seat); if (!ps) return null;
      return { row: ps.row, col: ps.col, who: (p.name || "").split(" ")[0], infant: /ארבל|INF/i.test(p.extra || "") };
    }).filter(Boolean);
    let whereTxt;
    if (!mine.length) {
      whereTxt = `המושבים בטיסה זו טרם נבחרו — כך נראה תא התיירים. בחירת מושבים דרך "ניהול הזמנה" באתר חברת התעופה.`;
    } else {
      const row = mine[0].row, fromFront = row - cab.from, toBack = cab.to - row;
      const pos = mine.map(m => `<b class="mono">${m.col}</b> ${where(cab, m.col)}`).join(" · ");
      whereTxt = `שורה <b class="mono">${row}</b> מתוך ${cab.from}–${cab.to} · ${blockName(cab, mine[0].col)} · ${pos}<br><small>${fromFront === 0 ? "השורה הראשונה בתא" : `${fromFront} שורות מקדמת התא`}, ${toBack === 0 ? "השורה האחרונה" : `${toBack} שורות אחרינו`}</small>`;
    }
    const rows = [...new Set(mine.map(m => m.row))];
    return `
      <div class="sm-title">${esc(cab.name)}</div>
      <p class="sm-where">${whereTxt}</p>
      ${svgMap(cab, mine)}
      ${rows.map(r => rowDetail(cab, r, mine)).join("")}
      <p class="sm-note">${esc(cab.note)}${t.plane && t.kind === "intl" ? ` בכרטיס רשום: ${esc(t.plane)}.` : ""}</p>
      <a class="sm-link" href="${esc(cab.link)}" target="_blank" rel="noopener">${esc(cab.linkLabel)} ↗</a>`;
  };
})();
