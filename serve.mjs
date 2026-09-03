// שרת סטטי מינימלי לפיתוח מקומי: node serve.mjs  →  http://localhost:8787
// (אופציונלי — האפליקציה עובדת גם ישירות מ-file:// מאז שהנתונים ב-trip.js)
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join, normalize } from "path";

const PORT = 8787;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = join(process.cwd(), normalize(p).replace(/^(\.\.[/\\])+/, ""));
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (index.html · timeline.html)`));
