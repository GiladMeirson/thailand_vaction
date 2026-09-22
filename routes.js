/* routes.js — קובץ מחושב. לא לערוך ידנית!
   נוצר על ידי:  node tools/routes.mjs
   מקור: OSRM על נתוני OpenStreetMap · זמן נסיעה ברכב בתנועה חופשית.
   km/min = מהמלון של היעד אל האטרקציה · poly = המסלול (Encoded Polyline, דיוק 5) לציור על המפה.
   key = הקואורדינטות ששימשו לחישוב — אם הן משתנות ב-attractions.js, ההרצה הבאה תחשב מחדש.
   עודכן: 2026-09-22 */

window.ROUTES = {
  "bkk-central-park": { "base": "bangkok", "hotel": "canalis", "km": 32.1, "min": 29, "on": "2026-09-22",
    "key": "13.72238,100.77491>13.72832,100.53781",
    "poly": "{cwrAmqafR`CiI_D|yDof@nDcDrqBoo@bgLi_@btCxKbfAcE~z@wb@~x@uh@j}BkBnb@nMv{@m[doCxHnD`[uVzkDyRya@jzA" },
  "bkk-iconsiam": { "base": "bangkok", "hotel": "canalis", "km": 38, "min": 36, "on": "2026-09-22",
    "key": "13.72238,100.77491>13.72682,100.51029",
    "poly": "{cwrAmqafR`CiI_D|yDof@nDcDrqBoo@bgLi_@btCxKbfAsEp}@gb@lv@uh@j}BkBnb@nMv{@eVloBenAbwAsPdc@tMhRxfCho@`lBxTfm@}AbV_KlC~QyMb_AjDlB~ByKau@yCpB{G" },
  "bkk-lumphini": { "base": "bangkok", "hotel": "canalis", "km": 32.4, "min": 29, "on": "2026-09-22",
    "key": "13.72238,100.77491>13.7306,100.54154",
    "poly": "{cwrAmqafR`CiI_D|yDof@nDcDrqBoo@bgLi_@btCxKbfAcE~z@wb@~x@uh@j}BkBnb@nMv{@m[doCxHnD`[uVzkDyRud@r{AxDsN" },
  "bkk-sealife": { "base": "bangkok", "hotel": "canalis", "km": 30.1, "min": 29, "on": "2026-09-22",
    "key": "13.72238,100.77491>13.74697,100.5352",
    "poly": "{cwrAmqafR`CiI_D|yDof@nDcDrqBoo@bgLi_@btCxKbfAcE~z@wb@~x@il@|qCvMtjAk[dqCnJtAhY{Uxo@uEcMfpAwOeAtDfL" },
  "hkt-bigbuddha": { "base": "phuket", "hotel": "merlin", "km": 24.7, "min": 34, "on": "2026-09-22",
    "key": "7.88349,98.27245>7.82752,98.31244",
    "poly": "gxbo@czxvQaBaOzIgIcMkNbCgAvLjCRgDqNsJdM{QyIoAyHgI}DwRmFaHfd@aRzPbLzE`JxEDzf@n[po@tKjFsBxCgJfCg]{ByGb[zCfLmEj@aG`KqEjFxLzCu@lGoLfCuR|NaDvIcStLVhInLzc@nItTcOx]yApIgFxTsX|B{O_EcOh@gSwFaRZkNyDsMv@mJwEZaNiOpQqrAmm@vAyMfFaAlTvCfMkBnOfChHwB~JfHzY_BhBnXhWiAjCyP\\}TxJsEfFBpLfDlHxGyHpA|KlKlDhFk@rD}MlD|A}@gB" },
  "hkt-floresta": { "base": "phuket", "hotel": "merlin", "km": 16.4, "min": 24, "on": "2026-09-22",
    "key": "7.88349,98.27245>7.88984,98.36639",
    "poly": "gxbo@czxvQaBaOzIgIcMkNbCgAvLjCRgDqNsJdM{QyIoAyHgIgHsWeKgJgk@mWq`AwFlFwYrFkJQaIxGsXmG{LdBsAoAyDtEur@cEeGoIqAuB{FtHG}@aJqd@ap@hSoO`VrBrE}AbDqFAoMfJ_I~DeLyCy`@~D_RcFqHbGuTsHcPx@mH|f@a[pBbFzU~C`DyH{DoB" },
  "hkt-jungceylon": { "base": "phuket", "hotel": "merlin", "km": 5.3, "min": 11, "on": "2026-09-22",
    "key": "7.88349,98.27245>7.89036,98.29982",
    "poly": "gxbo@czxvQ_AVp@{EsA}HzIgI}@}AsBBqGqKrAgAn@?vLjCRgDeJeEkCmDlEmIfEkCn@aCk@gAmHG_E_IyBG}DwRmFaHpTeJ`HwArEkCuTaGsAwBoEcQeQsHSv@" },
  "hkt-kata": { "base": "phuket", "hotel": "merlin", "km": 13.2, "min": 19, "on": "2026-09-22",
    "key": "7.88349,98.27245>7.81631,98.30011",
    "poly": "gxbo@czxvQaBaOzIgIcMkNbCgAvLjCRgDqNsJdM{QyIoAyHgI}DwRmFaHjd@cRvPdLzE`JxEDzf@n[ln@vKnGuBnC_IpCo^eBgHlZhDfLmEj@aG`KqEzF|L~EqC|v@oHt_AW`_A_]pSuC@nB" },
  "hkt-oldtown": { "base": "phuket", "hotel": "merlin", "km": 19.4, "min": 26, "on": "2026-09-22",
    "key": "7.88349,98.27245>7.88456,98.39207",
    "poly": "gxbo@czxvQaBaOzIgIcMkNbCgAvLjCRgDqNsJdM{QyIoAyHgIgHsWeKgJgk@mWq`AwFlFwYrFkJQaIxGsXmG{LdBsAoAyDtEur@cEeGoIqAuB{FtHG}@aJqd@ap@hSoOn[t@~DoFFqNrLgMxCcL_Eu]~D}PaFgIbGgRiHcXrdAmn@`Mwa@{Hoy@kK_i@jc@iDR{F" },
  "kl-bangniang-market": { "base": "khaolak", "hotel": "jw-khaolak", "km": 8.9, "min": 12, "on": "2026-09-22",
    "key": "8.70151,98.24046>8.664,98.251",
    "poly": "gqbt@qxrvQK_BxF]eBw[{CaFs@_GJkNgHiJwAWcDu[eJDd`@oAznA~b@fcEqCan@dAv@zG" },
  "kl-boat813": { "base": "khaolak", "hotel": "jw-khaolak", "km": 7.2, "min": 10, "on": "2026-09-22",
    "key": "8.70151,98.24046>8.665,98.2543",
    "poly": "gqbt@qxrvQK_BxF]eBw[{CaFs@_GJkNgHiJwAWcDu[eJDd`@oAznA~b@fiCaB?qD`GE" },
  "kl-nangthong": { "base": "khaolak", "hotel": "jw-khaolak", "km": 10.2, "min": 15, "on": "2026-09-22",
    "key": "8.70151,98.24046>8.64899,98.24629",
    "poly": "gqbt@qxrvQK_BxF]eBw[oEaNJkN_KaKcDu[eJDd`@oAznA~b@xsEyCvz@xJ{McAmAr]}CY" },
  "kl-pakarang": { "base": "khaolak", "hotel": "jw-khaolak", "km": 8.2, "min": 17, "on": "2026-09-22",
    "key": "8.70151,98.24046>8.72903,98.22228",
    "poly": "gqbt@qxrvQK_BxF]eBw[{CaFq@oFH{NgHiJwAWcDu[ssBfKCbIuD~UrEpKRtNmEzQuMfTsMh`@rIju@wCpKoFzE" },
  "kl-tonchongfa": { "base": "khaolak", "hotel": "jw-khaolak", "km": 11.5, "min": 30, "on": "2026-09-22",
    "key": "8.70151,98.24046>8.65516,98.28419",
    "poly": "gqbt@qxrvQK_BxF]eBw[{CaFs@_GJkNgHiJwAWcDu[eJDd`@oAznA~b@rbBaAxBiUSqO}FwGkRs_@_QgIeAyEnKmFq@kFjAeRpCaHdD_Dl@eItSU~Ax@ZtDtHxFpK_FtGpA|RyRvIcF" }
};
