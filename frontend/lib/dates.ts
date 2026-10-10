/**
 * Small date helpers that work on plain "yyyy-mm-dd" strings (used by the
 * checklist feature). Everything is calendar-day arithmetic in UTC, so it is
 * not affected by the time of day or daylight-saving changes.
 *
 * (The alert system has its own Date-based helpers in ./alertDates.ts.)
 */

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string): [number, number, number] {
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [1970, 1, 1];
}

const fromDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const toUtc = (date: string) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Today's date (server's calendar day) as yyyy-mm-dd. */
export function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Any date-looking value ("2026-09-19", "2026-09-19T15:52:26.096Z", a Date,
 * "19-09-2026", "19/09/2026") as yyyy-mm-dd; "" when it isn't a date.
 */
export function toDateString(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : fromDate(value);

  const s = String(value ?? "").trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/); // day first, as used in India
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;

  return "";
}

/** yyyy-mm-dd plus (or minus) a number of days. */
export function addDays(date: string, days: number): string {
  return fromDate(new Date(toUtc(date).getTime() + days * DAY_MS));
}

/** yyyy-mm-dd plus a number of months; the day is kept (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

/** "Sun 27 Sep" */
export function niceDate(date: string): string {
  const d = toUtc(date);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Returns true if the given yyyy-mm-dd date is Sunday (weekly off). */
export function isSunday(date: string): boolean {
  if (!date) return false;
  return toUtc(date).getUTCDay() === 0;
}

/** If a date falls on Sunday, advance it to Monday (the next working day). */
export function skipSunday(date: string): string {
  if (!date) return date;
  return isSunday(date) ? addDays(date, 1) : date;
}
