// מאחד את index.html + styles.css + data.js + app.js לקובץ יחיד לפרסום כ-Artifact.
// הרצה: node build.mjs  →  dist/artifact.html
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const data = readFileSync("data.js", "utf8");
const app = readFileSync("app.js", "utf8");

// חילוץ ראש (title + קישורי fonts/leaflet) וגוף מתוך index.html
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta[^>]*>\s*/g, "")                                   // ה-Artifact מוסיף meta בעצמו
  .replace(/<link rel="stylesheet" href="styles\.css">\s*/, "")
  .trim();
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/<script src="data\.js"><\/script>\s*/, "")
  .replace(/<script src="app\.js"><\/script>\s*/, "")
  .trim();

// קאש המצב מהריפו — מוטמע כ-SEED_STATE כדי שכל מחשב יפתח עם הנתונים האחרונים שנשמרו
let seed = "";
try {
  const j = JSON.parse(readFileSync("thailand-trip-data.json", "utf8"));
  seed = `<script>window.SEED_STATE=${JSON.stringify(j).replace(/</g, "\\u003c")}</script>\n`;
} catch (e) { /* אין קובץ עדיין — מדלגים */ }

const out = `${head}
<style>
${css}
</style>
${body}
${seed}<script>
${data}
</script>
<script>
${app}
</script>
`;

// תמונות מקומיות (img/) מוטמעות כ-data URI כדי לעבור את ה-CSP של ה-Artifact
let bundled = out;
if (existsSync("img")) {
  for (const f of readdirSync("img")) {
    const ref = "img/" + f;
    if (!bundled.includes(ref)) continue;
    const mime = f.endsWith(".webp") ? "image/webp" : f.endsWith(".png") ? "image/png" : "image/jpeg";
    const b64 = readFileSync(ref).toString("base64");
    bundled = bundled.split(ref).join(`data:${mime};base64,${b64}`);
  }
}

mkdirSync("dist", { recursive: true });
writeFileSync("dist/artifact.html", bundled);
console.log("dist/artifact.html —", (bundled.length / 1024).toFixed(1), "KB");
