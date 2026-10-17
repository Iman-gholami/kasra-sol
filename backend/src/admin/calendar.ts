// Reporting periods follow the shop's own calendar: Asia/Tehran days and Solar Hijri (Persian) months.
const TZ = 'Asia/Tehran';
const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const persianDay = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { timeZone: TZ, day: 'numeric' });
const persianMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: TZ, month: 'long' });
const persianYear = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: TZ, year: 'numeric' });

/** Tehran calendar date of an instant, as YYYY-MM-DD (Gregorian, for SQL). */
export const tehranDate = (at: Date) => isoDay.format(at);

/** First day (Tehran date, YYYY-MM-DD) and Persian label of the Solar Hijri month containing `now`.
 * Iran has no daylight saving time since 2022, so whole-day steps never skip a local date. */
export function persianMonthStart(now = new Date()) {
  const day = Number(persianDay.format(now));
  return { start: tehranDate(new Date(now.getTime() - (day - 1) * 86_400_000)),
    label: persianMonth.format(now) + ' ' + persianYear.format(now) };
}
