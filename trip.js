/* trip.js — קובץ הנתונים של הטיול · מקור האמת היחיד. עורכים כאן ידנית, האפליקציה רק קוראת ומציגה.
   זהו קובץ JS (ולא JSON) כדי שהדפדפן יטען אותו ישירות עם <script src="trip.js"> — גם בפתיחה מ-file:// בלי שרת.
   העריכה זהה לעריכת JSON: אובייקט אחד, מפתחות במרכאות, בלי פסיק אחרי האיבר האחרון.

   updated: תאריך העדכון האחרון (מוצג בכותרת האפליקציה).
   tasksDone: מזהי משימות שבוצעו (t01, t12 ...) — המזהים בקובץ data.js תחת STAGES.
   myTasks: משימות משלכם [{ "t": "טקסט", "done": false }].
   hotels: לכל בסיס — id מהקטלוג ב-data.js (HOTELS) או name חופשי, booked=true אחרי הזמנה, ref=מספר הזמנה.
   secondDest: היעד השני אחרי פוקט — decided=false כל עוד לא הוחלט; כשמחליטים: decided=true + id (aonang / khaolak / bangkok) + name.
   phuketNights: כמה לילות בפוקט. השאר (אחרי לילות בנגקוק שנגזרים מהטיסה הפנימית) הולך ליעד השני.
   payments: לפי מזהי BUDGET ב-data.js — { "amount": ₪, "note": "..." }.
   costs: רשימת העלויות שמוצגת בדף הראשי — [{ "what": "תיאור", "amount": ₪, "paid": true/false, "date": "YYYY-MM-DD", "note": "..." }].
          מוסיפים שורה לכל הוצאה (טיסה, מלון, ביטוח...). paid=true אחרי ששולם בפועל.
   candidates: מועמדים למלונות שמוצגים בדף הראשי (רשימה נפתחת + נקודות זהב על המפה) —
          [{ "id", "base": bangkok/phuket/khaolak, "name", "area", "room", "from", "to", "board", "usd": מחיר כולל לכל הלילות, "src": מקור המחיר,
             "address", "lat", "lng", "placeId" (אופציונלי), "site", "flyall": קישור לדף המלון באתר flyall, "rec": true = תג "מומלץ", "img": ["img/..."], "note" }]. מוסיפים/מוחקים מועמדים כאן.
   savedAttractions: מזהי אטרקציות מסומנות בכוכב (ATTS ב-data.js). */

window.TRIP = {

  "updated": "2026-09-03",

  "dates": { "start": "2026-10-31", "end": "2026-11-15" },

  "travelers": [
    { "name": "גלעד מאירסון", "role": "מבוגר" },
    { "name": "שיר מאירסון", "role": "מבוגר" },
    { "name": "ארבל מרים מאירסון", "role": "תינוקת · שנה" }
  ],

  "flights": {
    "intl": {
      "ref": "923R6Y",
      "airline": "EL AL · אל על",
      "status": "מאושר",
      "paid": 10090,
      "pax": [
        { "name": "גלעד מאירסון", "ticket": "114-5237866339", "seat": "45G" },
        { "name": "שיר מאירסון", "ticket": "114-5237866340", "seat": "45F" },
        { "name": "ארבל מרים מאירסון", "ticket": "114-5237866341", "seat": "על הברכיים 👶" }
      ],
      "legs": [
        {
          "no": "LY 083", "dir": "הלוך",
          "from": { "code": "TLV", "city": "תל אביב", "term": "טרמינל 3" },
          "to": { "code": "BKK", "city": "בנגקוק", "term": "סוברנבומי" },
          "depDate": "2026-10-31", "depTime": "21:40",
          "arrDate": "2026-11-01", "arrTime": "13:50", "arrNote": "+1",
          "dur": "11:10", "direct": true, "cls": "תיירים (S)",
          "plane": "בואינג 777-200/300", "meal": "ארוחה חמה + ארוחת בוקר",
          "bags": "מזוודה אחת לכל נוסע", "seats": "45G · 45F"
        },
        {
          "no": "LY 082", "dir": "חזור",
          "from": { "code": "BKK", "city": "בנגקוק", "term": "סוברנבומי" },
          "to": { "code": "TLV", "city": "תל אביב", "term": "טרמינל 3" },
          "depDate": "2026-11-14", "depTime": "23:55",
          "arrDate": "2026-11-15", "arrTime": "06:20", "arrNote": "+1",
          "dur": "11:25", "direct": true, "cls": "תיירים (L)",
          "plane": "בואינג 777-200/300", "meal": "ארוחה חמה + ארוחת בוקר",
          "bags": "מזוודה אחת לכל נוסע", "seats": "טרם נבחרו"
        }
      ]
    },
    "domestic": [
      {
        "no": "PG 271", "airline": "Bangkok Airways", "dir": "פנימית",
        "status": "מאושר",
        "ref": "",
        "paid": 550,
        "from": { "code": "BKK", "city": "בנגקוק", "term": "סוברנבומי · טרמינל D" },
        "to": { "code": "HKT", "city": "פוקט", "term": "שדה בינלאומי" },
        "depDate": "2026-11-02", "depTime": "08:00",
        "arrDate": "2026-11-02", "arrTime": "09:35",
        "dur": "01:35", "direct": true, "cls": "PGPROMO (V)", "fare": "VNWW",
        "note": "צ'ק-אין נסגר 45 דק' לפני ההמראה — להיות בטרמינל D עד 06:45. ל-Bangkok Airways יש לאונג' חינם לכל הנוסעים (קפה, מאפים, פינת ילדים).",
        "pax": [
          { "name": "גלעד מאירסון", "seat": "28F", "bag": "20 ק\"ג", "status": "מאושר", "extra": "ארבל על הברכיים (INFT)" },
          { "name": "שיר מאירסון", "seat": "28E", "bag": "20 ק\"ג", "status": "מאושר" },
          { "name": "ארבל מרים מאירסון", "seat": "על הברכיים 👶", "bag": "10 ק\"ג", "status": "מאושר · ללא מושב" }
        ]
      },
      {
        "no": "PG 284", "airline": "Bangkok Airways", "dir": "פנימית",
        "status": "מאושר",
        "ref": "",
        "paid": 650,
        "from": { "code": "HKT", "city": "פוקט", "term": "שדה בינלאומי · טרמינל D" },
        "to": { "code": "BKK", "city": "בנגקוק", "term": "סוברנבומי" },
        "depDate": "2026-11-14", "depTime": "17:20",
        "arrDate": "2026-11-14", "arrTime": "18:55",
        "dur": "01:35", "direct": true, "cls": "PGPROMO (Q)", "fare": "QNWW",
        "note": "נוחתים בסוברנבומי ב-18:55 — 5 שעות לפני אל על (23:55). נשארים באותו שדה: מוציאים מזוודות, עולים לקומת ההמראות ועושים צ'ק-אין לאל על. יש זמן לארוחת ערב רגועה.",
        "pax": [
          { "name": "גלעד מאירסון", "seat": "24F", "bag": "20 ק\"ג", "status": "מאושר", "extra": "ארבל על הברכיים (INFT)" },
          { "name": "שיר מאירסון", "seat": "24E", "bag": "20 ק\"ג", "status": "מאושר" },
          { "name": "ארבל מרים מאירסון", "seat": "על הברכיים 👶", "bag": "10 ק\"ג", "status": "מאושר · ללא מושב (NS)" }
        ]
      }
    ]
  },

  "phuketNights": 6,

  "secondDest": {
    "decided": true,
    "id": "khaolak",
    "name": "קאו לאק",
    "options": ["אאו נאנג (קראבי)", "קאו לאק", "בנגקוק"]
  },

  "hotels": {
    "bangkok": { "name": "", "booked": false, "ref": "", "note": "לילה אחד 1.11→2.11, חייב להיות ליד סוברנבומי" },
    "phuket":  { "id": null, "name": "", "booked": false, "ref": "", "note": "6 לילות 2.11→8.11 — לבחור מבין המועמדים (Marriott Merlin / Centara Grand / Kalima). SAii Laguna ירד מהאופציות 3.9." },
    "second":  { "id": null, "name": "", "booked": false, "ref": "", "note": "קאו לאק · 6 לילות 8.11→14.11 — לבחור ריזורט על החוף ולהזמין" }
  },

  "tasksDone": ["t01", "t02", "t03", "t04", "t05", "t06", "t11", "t12"],

  "myTasks": [],

  "payments": {
    "flightsIntl": { "amount": 10090, "note": "אל על 923R6Y — הלוך חזור לבנגקוק, שולם 1.9.2026" },
    "flightsDom":  { "amount": 1200,  "note": "Bangkok Airways — PG 271 בנגקוק→פוקט ₪550 + PG 284 פוקט→בנגקוק ₪650" }
  },

  "costs": [
    { "what": "טיסה הלוך-חזור תל אביב ↔ בנגקוק", "amount": 10090, "paid": true, "date": "2026-09-01", "note": "אל על · 923R6Y · 2 מבוגרים + תינוקת" },
    { "what": "טיסה פנימית בנגקוק → פוקט",        "amount": 550,   "paid": true, "date": "2026-09-03", "note": "Bangkok Airways · PG 271" },
    { "what": "טיסה פנימית פוקט → בנגקוק",        "amount": 650,   "paid": true, "date": "2026-09-03", "note": "Bangkok Airways · PG 284" }
  ],

  "candidates": [
    {
      "id": "canalis", "base": "bangkok", "short": "Canalis",
      "name": "Canalis Suvarnabhumi Airport Hotel", "area": "לאט קראבאנג · שאטל חינם לסוברנבומי",
      "room": "Suite", "from": "2026-11-01", "to": "2026-11-02", "board": "ארוחת בוקר (בלי ארוחת בוקר: $116)",
      "usd": 129, "src": "flyall",
      "address": "1599/1 Lat Krabang Soi 13, Lat Krabang Road, Lat Krabang, Bangkok 10520",
      "lat": 13.72238, "lng": 100.77491,
      "site": "https://www.canalissuvarnabhumi.com/",
      "flyall": "https://flyall.club/hotels/h12591086?name=canalis-suvarnabhumi-airport-hotel-free-shuttle-from-hotel-to-suvarnabhumi-airport&hc=12591086&dcode=BKK&fdate=01/11/26&tdate=02/11/26&isdomestic=false&dport=587136&rooms=1&adt1=2&chd1=1&chdr1a1=1&code=BKK",
      "img": ["img/cand-canalis.jpg", "img/cand-canalis-room.jpg"],
      "note": "לילה אחד בין הנחיתה (13:50) לטיסה ל-PG271 ב-08:00 למחרת — לבדוק שעות השאטל ללילה/בוקר מוקדם."
    },
    {
      "id": "kalima", "base": "phuket", "short": "Kalima",
      "name": "Kalima Resort and Spa", "area": "קאטו · גבעת קאלים מעל פאטונג, נוף לים",
      "room": "Double Pool Access with Ocean View", "from": "2026-11-02", "to": "2026-11-08", "board": "ארוחת בוקר",
      "usd": 2609, "src": "flyall",
      "address": "338/1 Phabaramee Road, Patong Beach, Kathu, Phuket 83150",
      "lat": 7.91732, "lng": 98.28400,
      "site": "https://www.kalimaresort.com/",
      "flyall": "https://flyall.club/hotels/h4163682/hotel-.aspx?fdate=02/11/26&tdate=08/11/26&isdomestic=false&dport=587950&dcode=HKT&rooms=1&adt1=2&chd1=1&chdr1a1=1",
      "img": ["img/cand-kalima.jpg", "img/cand-kalima-room.jpg"],
      "note": "ריזורט על צלע הגבעה — הרבה מדרגות/מעליות בין הרמות; לבקש חדר קרוב ללובי. אין חוף צמוד (שאטל לפאטונג)."
    },
    {
      "id": "centara-grand", "base": "phuket", "short": "Centara",
      "name": "Centara Grand Beach Resort Phuket", "area": "חוף קארון · על החוף",
      "room": "Deluxe Suite with Private Pool", "from": "2026-11-02", "to": "2026-11-08", "board": "ארוחת בוקר",
      "usd": 1738, "src": "flyall",
      "address": "683 Patak Road, Karon Beach, Phuket 83100",
      "lat": 7.857859, "lng": 98.290401, "placeId": "ChIJ_fm1oEElUDAR38X4EWQfkI0",
      "site": "https://www.centarahotelsresorts.com/",
      "flyall": "https://flyall.club/hotels/h4310879?name=centara-grand-beach-resort-phuket&hc=4310879&dcode=HKT&fdate=02/11/26&tdate=08/11/26&isdomestic=false&dport=587950&rooms=1&adt1=2&chd1=1&chdr1a1=1&code=HKT",
      "img": ["img/centara-grand.jpg"],
      "note": "נהר עצל ומגלשות — נהדר לפעוטות. ביקורות 2025–26 על חדרים מיושנים והרבה מדרגות; אם בוחרים — חדר צמוד למעלית."
    },
    {
      "id": "merlin", "base": "phuket", "short": "Marriott", "rec": true,
      "name": "Phuket Marriott Resort & Spa, Merlin Beach", "area": "חוף טרי טראנג · 3 ק\"מ מפאטונג, מפרץ שקט",
      "room": "1 King Bed Guest Room with Pool Access", "from": "2026-11-02", "to": "2026-11-08", "board": "ארוחת בוקר",
      "usd": 2627, "src": "flyall",
      "address": "99 Muen-Ngoen Road, Tri-Trang Beach, Patong, Kathu, Phuket 83150",
      "lat": 7.88349, "lng": 98.27245,
      "site": "https://www.marriott.com/en-us/hotels/hktmb-phuket-marriott-resort-and-spa-merlin-beach/overview/",
      "flyall": "https://flyall.club/hotels/h4163568/hotel-.aspx?fdate=02/11/26&tdate=08/11/26&isdomestic=false&dport=587950&dcode=HKT&rooms=1&adt1=2&chd1=1&chdr1a1=1",
      "img": ["img/cand-merlin.jpg", "img/cand-merlin-pool.jpg"],
      "note": "3 בריכות + בריכת ילדים עם מגלשות, חוף פרטי עם שונית. מבודד — לפאטונג בשאטל/מונית."
    },
    {
      "id": "jw-khaolak", "base": "khaolak", "short": "JW Marriott",
      "name": "JW Marriott Khao Lak Resort & Spa", "area": "קוק קאק, פאנג נגה · על החוף",
      "room": "Deluxe Room · 1 King Bed · Pool Access · Sofa Bed", "from": "2026-11-08", "to": "2026-11-14", "board": "חצי פנסיון",
      "usd": 2210, "src": "flyall",
      "address": "41/12 Moo 3, Khuk Khak, Takua Pa, Khao Lak, Phang Nga 82220",
      "lat": 8.70151, "lng": 98.24046, "placeId": "ChIJ5dIlcHXpUDAR1vOwPuNM2Jk",
      "site": "https://www.marriott.com/en-us/hotels/hktkl-jw-marriott-khao-lak-resort-and-spa/overview/",
      "flyall": "https://flyall.club/hotels/h4858194/hotel-.aspx?fdate=08/11/26&tdate=14/11/26&isdomestic=false&dport=587271&dcode=0&rooms=1&adt1=2&chd1=1&chdr1a1=1",
      "img": ["img/cand-jw.jpg", "img/cand-jw-room.jpg"],
      "note": "הבריכה הארוכה בדרום-מזרח אסיה (‎~2.5 ק\"מ) עוברת ליד הטרסה של חדרי ה-Pool Access. אזור ילדים (Aqua Play) ומועדון ילדים."
    }
  ],

  "savedAttractions": []
};
