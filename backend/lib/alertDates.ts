/**
 * Date helpers for the notification system. Everything works on whole days
 * (UTC midnight), so "today" and a due date compare cleanly regardless of the
 * time of day or the server's timezone.
 */

export const DAY_MS = 86_400_000;

function utc(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject things like 31 Feb, which Date would silently roll over.
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/**
 * Read a date out of cell text. Understands 2026-09-25 (also with a time),
 * 25-09-2026, 25/09/2026 and 25.09.2026 (day first, as used in India).
 */
export function parseDate(text: string | undefined | null): Date | null {
  const s = String(text ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/);
  if (m) return utc(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?![\d])/);
  if (m) return utc(Number(m[3]), Number(m[2]), Number(m[1]));

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,3})(?![\d])/);
  if (m) {
    const yr = Number(m[3]);
    const fullYear = yr === 26 || yr === 226 ? 2026 : yr < 50 ? 2000 + yr : 1900 + yr;
    return utc(fullYear, Number(m[2]), Number(m[1]));
  }

  return null;
}

/** Today as a whole day. NOTIFY_TODAY=YYYY-MM-DD pins it (used for testing). */
export function today(override?: string): Date {
  const forced = parseDate(override ?? process.env.NOTIFY_TODAY);
  if (forced) return forced;
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-09-25 */
export const formatIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
/** 25-09-2026 */
export const formatDisplay = (d: Date) => `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
/** 20260925, for building stable IDs. */
export const formatCompact = (d: Date) => formatIso(d).replace(/-/g, "");

/** Whole days from b to a (positive when a is later). */
export const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY_MS);

export interface Interval {
  months?: number;
  days?: number;
}

/** Add a repeat interval; month steps keep the day (31 Jan + 1 month = 28/29 Feb). */
export function addInterval(date: Date, interval: Interval): Date {
  if (interval.months) {
    const total = date.getUTCMonth() + interval.months;
    const year = date.getUTCFullYear() + Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
  }
  return new Date(date.getTime() + (interval.days ?? 0) * DAY_MS);
}

/** Roughly how long the interval is, in days (for choosing an alert window). */
export const intervalDays = (i: Interval) => (i.months ? i.months * 30 : i.days ?? 0);

const WORDS: [RegExp, Interval][] = [
  [/half[\s-]?year|semi[\s-]?annual|six[\s-]?month/, { months: 6 }],
  [/quarter/, { months: 3 }],
  [/bi[\s-]?month/, { months: 2 }],
  [/fort[\s-]?night|bi[\s-]?week/, { days: 14 }],
  [/year|annual/, { months: 12 }],
  [/month/, { months: 1 }],
  [/week/, { days: 7 }],
  [/dai?ly|every ?day/, { days: 1 }],
];

/**
 * Turn a Frequency cell into an interval: "Monthly", "Half-Yearly", "6 Month",
 * "Every 3 months", "1 Year", "90 days". "As Required" (or nothing) gives null.
 */
export function parseInterval(text: string | undefined | null): Interval | null {
  const s = String(text ?? "").trim().toLowerCase();
  if (!s || /as required|on demand|n\/?a|not applicable/.test(s)) return null;

  const num = s.match(/(\d+(?:\.\d+)?)\s*[- ]?\s*(day|d\b|week|wk|month|mth|mo\b|year|yr)/);
  if (num) {
    const n = Number(num[1]);
    const unit = num[2];
    if (n > 0) {
      if (unit.startsWith("d")) return { days: n };
      if (unit.startsWith("w")) return { days: n * 7 };
      if (unit.startsWith("m")) return { months: n };
      return { months: n * 12 };
    }
  }

  for (const [pattern, interval] of WORDS) if (pattern.test(s)) return interval;
  return null;
}
