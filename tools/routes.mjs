/* tools/routes.mjs — מחשב מרחק, זמן נסיעה ומסלול מהמלון של כל יעד אל כל אטרקציה ב-attractions.js,
   וכותב את התוצאה ל-routes.js (קובץ מחושב — לא עורכים אותו ידנית).

   הרצה:   node tools/routes.mjs
           node tools/routes.mjs --force     (מחשב מחדש גם מה שכבר חושב)

   הנתונים מגיעים מ-OSRM הציבורי (router.project-osrm.org) על נתוני OpenStreetMap — בחינם, בלי מפתח.
   הזמן הוא זמן נסיעה בתנועה חופשית; בשעות עומס זה יותר (ראו השדה peak ב-attractions.js).
   המלון של כל יעד נלקח מ-trip.js: הרשומה ב-candidates עם base מתאים ו-booked=true.
*/
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORCE = process.argv.includes("--force");
const OSRM = "https://router.project-osrm.org/route/v1/driving";

/* טעינת קובץ שמגדיר window.X (trip.js / attractions.js / routes.js) בלי דפדפן */
const loadWindowFile = file => {
  if (!existsSync(join(ROOT, file))) return {};
  const w = {};
  new Function("window", readFileSync(join(ROOT, file), "utf8"))(w);
  return w;
};

const trip = loadWindowFile("trip.js").TRIP || {};
const ATT = loadWindowFile("attractions.js").ATTRACTIONS || {};
const prev = loadWindowFile("routes.js").ROUTES || {};

/* המלון שנסגר בכל יעד */
const cands = trip.candidates || [];
const hotelOf = base => cands.find(c => c.base === base && c.booked) || cands.find(c => c.base === base) || null;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const out = {};
let computed = 0, reused = 0, failed = 0;

for (const [base, list] of Object.entries(ATT)) {
  const hotel = hotelOf(base);
  if (!hotel) { console.error(`✗ אין מלון ליעד "${base}" ב-trip.js — מדלג על ${list.length} אטרקציות`); failed += list.length; continue; }
  console.log(`\n── ${base} · מהמלון ${hotel.short || hotel.name} (${hotel.lat}, ${hotel.lng})`);

  for (const a of list) {
    if (!a.id || a.lat == null || a.lng == null) { console.error(`  ✗ ${a.name || "?"} — חסר id/lat/lng`); failed++; continue; }
    const key = `${hotel.lat},${hotel.lng}>${a.lat},${a.lng}`;
    if (!FORCE && prev[a.id] && prev[a.id].key === key) { out[a.id] = prev[a.id]; reused++; console.log(`  = ${a.name} — ${prev[a.id].km} ק"מ · ${prev[a.id].min} דק' (מהקובץ)`); continue; }

    const url = `${OSRM}/${hotel.lng},${hotel.lat};${a.lng},${a.lat}?overview=simplified&geometries=polyline&alternatives=false&steps=false`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "thailand-trip-planner/1.0 (personal)" } });
      const j = await res.json();
      if (j.code !== "Ok" || !j.routes || !j.routes.length) throw new Error(j.message || j.code || "no route");
      const r = j.routes[0];
      out[a.id] = {
        base, hotel: hotel.id, key,
        km: round(r.distance / 1000, 1),
        min: Math.round(r.duration / 60),
        poly: r.geometry,
        on: new Date().toISOString().slice(0, 10)
      };
      computed++;
      console.log(`  ✓ ${a.name} — ${out[a.id].km} ק"מ · ${out[a.id].min} דק'`);
    } catch (e) {
      failed++;
      if (prev[a.id]) { out[a.id] = prev[a.id]; console.error(`  ✗ ${a.name} — ${e.message}; נשמר הערך הקודם`); }
      else console.error(`  ✗ ${a.name} — ${e.message}`);
    }
    await sleep(600);   // נימוס כלפי השרת הציבורי
  }
}

const body = Object.keys(out).sort().map(id => {
  const r = out[id];
  return `  ${JSON.stringify(id)}: { "base": ${JSON.stringify(r.base)}, "hotel": ${JSON.stringify(r.hotel)}, "km": ${r.km}, "min": ${r.min}, "on": ${JSON.stringify(r.on)},\n    "key": ${JSON.stringify(r.key)},\n    "poly": ${JSON.stringify(r.poly)} }`;
}).join(",\n");

writeFileSync(join(ROOT, "routes.js"),
`/* routes.js — קובץ מחושב. לא לערוך ידנית!
   נוצר על ידי:  node tools/routes.mjs
   מקור: OSRM על נתוני OpenStreetMap · זמן נסיעה ברכב בתנועה חופשית.
   km/min = מהמלון של היעד אל האטרקציה · poly = המסלול (Encoded Polyline, דיוק 5) לציור על המפה.
   key = הקואורדינטות ששימשו לחישוב — אם הן משתנות ב-attractions.js, ההרצה הבאה תחשב מחדש.
   עודכן: ${new Date().toISOString().slice(0, 10)} */

window.ROUTES = {
${body}
};
`, "utf8");

console.log(`\nroutes.js נכתב — ${Object.keys(out).length} מסלולים (${computed} חושבו, ${reused} מהקובץ${failed ? `, ${failed} נכשלו` : ""}).`);
