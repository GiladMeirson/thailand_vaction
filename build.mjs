// מאחד את index.html + styles.css + trip.js + data.js + trip-loader.js + app.js לקובץ יחיד לפרסום כ-Artifact.
// הרצה: node build.mjs  →  dist/artifact.html + dist/timeline.html
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";

const css = readFileSync("styles.css", "utf8");
const data = readFileSync("data.js", "utf8");
const loader = readFileSync("trip-loader.js", "utf8");
const app = readFileSync("app.js", "utf8");

// trip.js — מקור האמת (נערך ידנית) — מוטמע כמות שהוא; הוא מגדיר window.TRIP
const trip = `<script>\n${readFileSync("trip.js", "utf8").replace(/<\/script/gi, "<\\/script")}\n</script>\n`;

// חילוץ ראש (title + קישורי fonts/leaflet) וגוף מתוך קובץ HTML
const split = (html, cssName, scripts) => {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta[^>]*>\s*/g, "")                                   // ה-Artifact מוסיף meta בעצמו
    .replace(new RegExp(`<link rel="stylesheet" href="${cssName}">\\s*`), "")
    .trim();
  let body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  for (const s of scripts) body = body.replace(new RegExp(`<script src="${s}"></script>\\s*`), "");
  return { head, body: body.trim() };
};

// תמונות מקומיות (img/) מוטמעות כ-data URI כדי לעבור את ה-CSP של ה-Artifact
const inlineImages = html => {
  if (!existsSync("img")) return html;
  for (const f of readdirSync("img")) {
    const ref = "img/" + f;
    if (!html.includes(ref)) continue;
    const mime = f.endsWith(".webp") ? "image/webp" : f.endsWith(".png") ? "image/png" : "image/jpeg";
    html = html.split(ref).join(`data:${mime};base64,${readFileSync(ref).toString("base64")}`);
  }
  return html;
};

mkdirSync("dist", { recursive: true });

// ---- באנדל ראשי ----
{
  const { head, body } = split(readFileSync("index.html", "utf8"), "styles\\.css", ["trip\\.js", "data\\.js", "trip-loader\\.js", "app\\.js"]);
  let out = `${head}\n<style>\n${css}\n</style>\n${body}\n${trip}<script>\n${data}\n</script>\n<script>\n${loader}\n</script>\n<script>\n${app}\n</script>\n`;
  out = inlineImages(out);
  // כתובת ה-Artifact של דף ציר הזמן — בבאנדל הראשי הקישור המקומי timeline.html מוחלף בה
  const TIMELINE_URL = "https://claude.ai/code/artifact/bfcffcff-f852-4a78-92eb-38a517eb7a85";
  if (!TIMELINE_URL.startsWith("__")) out = out.replace('href="timeline.html"', `href="${TIMELINE_URL}"`);
  writeFileSync("dist/artifact.html", out);
  console.log("dist/artifact.html —", (out.length / 1024).toFixed(1), "KB");
}

// ---- באנדל שני: ציר הזמן ----
if (existsSync("timeline.html")) {
  const tcss = readFileSync("timeline.css", "utf8");
  const tjs = readFileSync("timeline.js", "utf8");
  const { head, body } = split(readFileSync("timeline.html", "utf8"), "timeline\\.css", ["trip\\.js", "data\\.js", "trip-loader\\.js", "timeline\\.js"]);
  const tbody = body.replace('href="index.html"', 'href="https://claude.ai/code/artifact/655d2aa2-95d2-4ef7-8ba4-0598ac61e874"');
  const out = `${head}\n<style>\n${tcss}\n</style>\n${tbody}\n${trip}<script>\n${data}\n</script>\n<script>\n${loader}\n</script>\n<script>\n${tjs}\n</script>\n`;
  writeFileSync("dist/timeline.html", out);
  console.log("dist/timeline.html —", (out.length / 1024).toFixed(1), "KB");
}
