# חמ"ל תאילנד

אפליקציית תכנון לטיול (31.10–15.11.2026). **לקריאה בלבד** — כל מה שסגור נכתב ידנית ב-`trip.js`, והאפליקציה רק מציגה.

## הקבצים

| קובץ | מה יש בו |
|---|---|
| `trip.js` | **מקור האמת** — תאריכים, טיסות, מלונות, לילות, משימות שבוצעו, תשלומים. עורכים ידנית — קובץ JS שמגדיר `window.TRIP = { ... }` (הסבר בהערה בראש הקובץ). JS ולא JSON כדי שהדפדפן יטען אותו ישירות גם מ-`file://`. |
| `data.js` | מחקר קבוע: שלבי משימות, קטלוג מלונות, אטרקציות, תקציב משוער, מזג אוויר. |
| `index.html` · `styles.css` · `app.js` | החמ"ל. `trip-loader.js` מגשר אל `window.TRIP`. |
| `timeline.html` · `timeline.css` · `timeline.js` | דף ציר הזמן (אותו `trip.js`). |
| `build.mjs` | מאגד הכול ל-`dist/artifact.html` + `dist/timeline.html` (מטמיע את `trip.js` בתוך ה-HTML). |
| `serve.mjs` | שרת מקומי לפיתוח (אופציונלי — לא נדרש יותר). |
| `assets/` | פוליסת הביטוח (`insurance-migdal.pdf` + תמונת JPG לכל עמוד, `insurance-migdal-p*.jpg`) וקבלות המלונות מ-flyall (`receipt-*.pdf`) + תמונת JPG של כל קבלה (`receipt-*.jpg`, נוצרת מה-PDF) — התמונה מוטמעת ב-`dist/timeline.html` כי ב-Artifact אי אפשר לפתוח PDF. הקישור מהמלון לקבלה מוגדר ב-`hotels.*.receipt` ב-`trip.js`. |

## עבודה יומיומית

1. סגרתם משהו (מלון, טיסה, תשלום, משימה)? עורכים את `trip.js` ומעדכנים `updated`.
2. בדיקה מקומית: פתיחה של `index.html` בדפדפן (גם ישירות מ-`file://`). אפשר גם `node serve.mjs` → http://localhost:8787.
3. פרסום: `node build.mjs` ואז פרסום `dist/artifact.html` מחדש לאותה כתובת Artifact.

## מזהים שימושיים ב-trip.js

- `tasksDone` — מזהי משימות מ-`STAGES` ב-`data.js` (t01…t46).
- `hotels.*.receipt` — הקבלה של המלון (`file` = PDF, `img` = JPG, מספר קבלה, תיק נסיעה, סכום). כשמוסיפים קבלה חדשה: לשים את ה-PDF ב-`assets/`, ליצור ממנו JPG (למשל עם pypdfium2), ולמלא את השדה.
- `insurance` — פוליסת הביטוח (מספר, תקופה, מבוטחים, מה מכוסה, מה לא נרכש, מספרי חירום). מוצגת כנקודה "ביטוח נסיעות" בציר הזמן עם דיאלוג שמציג את עמודי הפוליסה.
- `tasksDone` כולל `t46` = טופס ה-TDAC מולא — נקודת ה-TDAC בציר הזמן (3 ימים לפני הנחיתה) הופכת ל"סגור".
- `hotels.phuket.id` / `hotels.second.id` — מזהי מלונות מ-`HOTELS` ב-`data.js` (katathani, saii, centara-grand, angsana, dusit, kata-palm, centara-aonang, avani, holiday-inn). למלון שלא בקטלוג (למשל בנגקוק) כותבים `name`.
- `payments` — מזהי סעיפים מ-`BUDGET` (flightsIntl, flightsDom, hotelPhuket, hotelAonang, transfers, food, activities, insurance, esim, misc).
- `secondDest` — `decided:false` כל עוד היעד אחרי פוקט פתוח.
