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

export const TIMEZONE_IST = "Asia/Kolkata";

/** Today's date (business calendar day in Asia/Kolkata IST) as yyyy-mm-dd. */
export function todayString(date?: Date): string {
  const d = date || new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Check if a yyyy-mm-dd date string equals today in IST. */
export function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  return toDateString(dateStr) === todayString();
}

/** Check if a yyyy-mm-dd date string is strictly before today in IST. */
export function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = toDateString(dateStr);
  return Boolean(d && d < todayString());
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

// ----------------------------------------------------------------- Factory Shift & Weekly Off
export const GENERAL_SHIFT_START_HOUR = 9;  // 09:00 AM
export const GENERAL_SHIFT_END_HOUR = 20;   // 08:00 PM (20:00)
export const SHIFT_NAME = "General Shift";
export const SHIFT_HOURS_LABEL = "9:00 AM – 8:00 PM";
export const WEEKLY_OFF_DAY = "Sunday";

export interface FactoryShiftInfo {
  name: string;
  hours: string;
  startHour: number;
  endHour: number;
  weeklyOff: string;
  isSunday: boolean;
  isWithinShiftHours: boolean;
  statusLabel: string;
}

/**
 * Returns factory operating shift and Sunday weekly off schedule.
 * General Shift: 9:00 AM to 8:00 PM (Monday – Saturday).
 * Weekly Off: Sunday (Checklist submissions are closed).
 */
export function getFactoryShiftInfo(nowDate: Date = new Date()): FactoryShiftInfo {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_IST,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(nowDate);

  let hours = 0;
  let weekday = "";
  for (const p of parts) {
    if (p.type === "hour") hours = parseInt(p.value, 10);
    if (p.type === "weekday") weekday = p.value;
  }
  const isSun = weekday === "Sun";
  const isWithinHours = !isSun && hours >= GENERAL_SHIFT_START_HOUR && hours < GENERAL_SHIFT_END_HOUR;

  let statusLabel = "";
  if (isSun) {
    statusLabel = "Sunday (Weekly Off) — Checklist Filling Closed";
  } else if (isWithinHours) {
    statusLabel = "General Shift Active (9:00 AM – 8:00 PM)";
  } else if (hours < GENERAL_SHIFT_START_HOUR) {
    statusLabel = "Before General Shift (Starts at 9:00 AM)";
  } else {
    statusLabel = "After General Shift (Ended at 8:00 PM)";
  }

  return {
    name: SHIFT_NAME,
    hours: SHIFT_HOURS_LABEL,
    startHour: GENERAL_SHIFT_START_HOUR,
    endHour: GENERAL_SHIFT_END_HOUR,
    weeklyOff: WEEKLY_OFF_DAY,
    isSunday: isSun,
    isWithinShiftHours: isWithinHours,
    statusLabel,
  };
}
