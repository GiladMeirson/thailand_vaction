/* גשר אל trip.js — מקור האמת היחיד של הטיול (נערך ידנית).
   trip.js מגדיר window.TRIP ונטען כ-<script> רגיל, לכן הכול עובד גם מ-file:// בלי שרת. */
function loadTrip() {
  if (window.TRIP) return Promise.resolve(window.TRIP);
  const box = document.createElement("div");
  box.className = "trip-load-error";
  box.innerHTML = "<b>trip.js לא נטען.</b> ודאו שהקובץ <code>trip.js</code> קיים לצד ה-HTML, שהוא נטען לפני <code>trip-loader.js</code>, ושאין בו שגיאת תחביר (בדקו בקונסול).";
  document.body.prepend(box);
  return Promise.reject(new Error("window.TRIP is missing"));
}
