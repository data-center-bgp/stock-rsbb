// One place for the app's time zone, so "today" (dashboard stats, the day's
// opname session) means the same calendar day for everyone regardless of
// where the server runs. Indonesia has no DST, so the offset is fixed.
export const APP_TIME_ZONE = "Asia/Jakarta";
const APP_UTC_OFFSET = "+07:00";

/** Today's date in the app time zone, as YYYY-MM-DD. */
export function todayInAppZone(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(date);
}

/** ISO timestamp for 00:00 today in the app time zone, for `created_at >=` filters. */
export function startOfTodayInAppZone() {
  return `${todayInAppZone()}T00:00:00${APP_UTC_OFFSET}`;
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
