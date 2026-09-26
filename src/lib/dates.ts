// One place for the app's time zone, so "today" (dashboard stats, the day's
// opname session, Mutasi dates) means the same calendar day for everyone
// regardless of where the server runs. The database uses the same zone for
// stock_transaction.transaction_date's default (0006_mutasi.sql).
export const APP_TIME_ZONE = "Asia/Jakarta";

/** Today's date in the app time zone, as YYYY-MM-DD. */
export function todayInAppZone(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(date);
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

/** A plain calendar date (YYYY-MM-DD, e.g. transaction_date) as "26 Sep 2026". */
export function formatDate(ymd: string) {
  // Read and printed in UTC so the day can't shift with the time zone.
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${ymd}T00:00:00Z`),
  );
}
