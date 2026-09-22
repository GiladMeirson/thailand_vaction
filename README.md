# חמ"ל תאילנד

אפליקציית תכנון לטיול (31.10–15.11.2026). **לקריאה בלבד** — כל מה שסגור נכתב ידנית ב-`trip.js`, והאפליקציה רק מציגה.

## הקבצים

| קובץ | מה יש בו |
|---|---|
| `trip.js` | **מקור האמת** — תאריכים, טיסות, מלונות, לילות, משימות שבוצעו, תשלומים. עורכים ידנית — קובץ JS שמגדיר `window.TRIP = { ... }` (הסבר בהערה בראש הקובץ). JS ולא JSON כדי שהדפדפן יטען אותו ישירות גם מ-`file://`. |
| `data.js` | מחקר קבוע: שלבי משימות, קטלוג מלונות, אטרקציות, תקציב משוער, מזג אוויר. |
| `index.html` · `styles.css` · `app.js` | החמ"ל. `trip-loader.js` מגשר אל `window.TRIP`. |
| `timeline.html` · `timeline.css` · `timeline.js` | דף ציר הזמן (אותו `trip.js`). |
| `guide.html` · `guide.css` · `guide.js` | **דף "המסע"** — הדף לשיתוף (אשתי/משפחה): טיסות, איפה ישנים ומה עושים בכל יעד. **בלי מחירים בכלל** — גם לא בקוד המקור של הבאנדל (`build.mjs` מזריק גרסה מנוקה של `trip.js`). עיצוב נפרד ("ערב אנדמן", כהה). |
| `attractions.js` | **האטרקציות — הקובץ שעורכים ידנית.** לכל יעד (bangkok / phuket / khaolak) רשימה של מקומות: שם, קואורדינטות, משפט הסבר, קטגוריה, טיפ, ותמונה (`img` + `credit`). הסבר מלא בהערה בראש הקובץ. |
| `img/att-*.jpg` | תמונות האטרקציות (רוחב 800px, JPEG q72). מקורות: ויקישיתוף (ברישיון חופשי — הקרדיט בשדה `credit`) ואתרי המסעדות. |
| `routes.js` | **קובץ מחושב — לא לערוך.** מרחק, זמן נסיעה במונית והמסלול עצמו מהמלון של כל יעד לכל אטרקציה. נוצר על ידי `node tools/routes.mjs`. |
| `tools/routes.mjs` | מחשב את `routes.js` מול OSRM (OpenStreetMap, בחינם ובלי מפתח). מריצים אחרי כל שינוי ב-`attractions.js`. |
| `build.mjs` | מאגד הכול ל-`dist/artifact.html` + `dist/timeline.html` + `dist/guide.html` (מטמיע את `trip.js` בתוך ה-HTML). |
| `serve.mjs` | שרת מקומי לפיתוח (אופציונלי — לא נדרש יותר). |
| `assets/` | פוליסת הביטוח (`insurance-migdal.pdf` + תמונת JPG לכל עמוד, `insurance-migdal-p*.jpg`) וקבלות המלונות מ-flyall (`receipt-*.pdf`) + תמונת JPG של כל קבלה (`receipt-*.jpg`, נוצרת מה-PDF) — התמונה מוטמעת ב-`dist/timeline.html` כי ב-Artifact אי אפשר לפתוח PDF. הקישור מהמלון לקבלה מוגדר ב-`hotels.*.receipt` ב-`trip.js`. |

## עבודה יומיומית

1. סגרתם משהו (מלון, טיסה, תשלום, משימה)? עורכים את `trip.js` ומעדכנים `updated`.
2. בדיקה מקומית: פתיחה של `index.html` בדפדפן (גם ישירות מ-`file://`). אפשר גם `node serve.mjs` → http://localhost:8787.
3. פרסום: `node build.mjs` ואז פרסום `dist/artifact.html` מחדש לאותה כתובת Artifact.

## הוספת אטרקציה לדף "המסע"

1. מוסיפים אובייקט לרשימה של היעד ב-`attractions.js` (חובה: `id`, `name`, `en`, `lat`, `lng`, `blurb`).
   הכי קל להשיג קואורדינטות: גוגל מפות → לחיצה ימנית על המקום → מעתיקים `13.72832, 100.53781`.
2. `node tools/routes.mjs` — מחשב מרחק, זמן נסיעה ומסלול מהמלון של אותו יעד (מוסיף רק מה שחדש; `--force` מחשב הכול מחדש).
3. פותחים את `guide.html` בדפדפן. לפרסום: `node build.mjs` → `dist/guide.html`.

אפשר לדרוס את זמן הנסיעה ידנית עם `"travel": { "km": 12.4, "min": 25 }`, ולהוסיף `"peak": 1.8` כדי שתוצג גם הערכה לשעות עומס.

**תמונה לאטרקציה:** שומרים קובץ ב-`img/att-<id>.jpg` (רוחב 800px, איכות 72) ומוסיפים `"img": "img/att-<id>.jpg"` ו-`"credit"`. כשיש תמונה הכרטיס נפתח בתמונה, וכפתור קטן בפינה מחליף למפה עם המסלול (המפה נטענת רק בלחיצה). בלי תמונה — הכרטיס מציג את המפה ישירות.

## מזהים שימושיים ב-trip.js

- `tasksDone` — מזהי משימות מ-`STAGES` ב-`data.js` (t01…t46).
- `hotels.*.receipt` — הקבלה של המלון (`file` = PDF, `img` = JPG, מספר קבלה, תיק נסיעה, סכום). כשמוסיפים קבלה חדשה: לשים את ה-PDF ב-`assets/`, ליצור ממנו JPG (למשל עם pypdfium2), ולמלא את השדה.
- `insurance` — פוליסת הביטוח (מספר, תקופה, מבוטחים, מה מכוסה, מה לא נרכש, מספרי חירום). מוצגת כנקודה "ביטוח נסיעות" בציר הזמן עם דיאלוג שמציג את עמודי הפוליסה.
- `tasksDone` כולל `t46` = טופס ה-TDAC מולא — נקודת ה-TDAC בציר הזמן (3 ימים לפני הנחיתה) הופכת ל"סגור".
- `hotels.phuket.id` / `hotels.second.id` — מזהי מלונות מ-`HOTELS` ב-`data.js` (katathani, saii, centara-grand, angsana, dusit, kata-palm, centara-aonang, avani, holiday-inn). למלון שלא בקטלוג (למשל בנגקוק) כותבים `name`.
- `payments` — מזהי סעיפים מ-`BUDGET` (flightsIntl, flightsDom, hotelPhuket, hotelAonang, transfers, food, activities, insurance, esim, misc).
- `secondDest` — `decided:false` כל עוד היעד אחרי פוקט פתוח.
