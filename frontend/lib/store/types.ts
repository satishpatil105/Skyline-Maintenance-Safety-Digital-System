/**
 * A "store" is where the spreadsheet lives (today: the Excel workbook). It only
 * knows about tabs, header rows and cell text; all the business rules live
 * above it in lib/db.ts. Another store (a database, say) could implement the
 * same small interface.
 */

export interface StoreRow {
  /** Row number in the sheet (header is row 1, first data row is 2). */
  row: number;
  /** Cell text, one per header column. */
  cells: string[];
}

export interface TabData {
  name: string;
  /** Raw header cells (may contain "" for a blank header). */
  headers: string[];
  rows: StoreRow[];
}

export type StoreOp =
  /** Create the tab (with this header row) if it doesn't exist yet. */
  | { type: "ensureTab"; tab: string; headers: string[]; dropdowns?: Record<string, string[]> }
  /** Change the header row (the Excel store refuses: columns of a real workbook are never altered). */
  | { type: "setHeaders"; tab: string; headers: string[] }
  | { type: "append"; tab: string; cells: string[] }
  /** `expected` is what the row held when we read it; used to detect conflicts. */
  | { type: "update"; tab: string; row: number; expected: string[]; cells: string[] }
  | { type: "delete"; tab: string; row: number; expected: string[] };

export interface Store {
  kind: "mongodb";
  /** Human-readable description for the dashboard. */
  describe(): { kind: "mongodb"; label: string };
  readAll(opts?: { fresh?: boolean }): Promise<TabData[]>;
  /** Apply changes directly into MongoDB Atlas collections. */
  apply(ops: StoreOp[]): Promise<void>;
}

/** Someone else changed the row between our read and our write. */
export class ConflictError extends Error {
  constructor(message = "The sheet was changed by someone else while you were saving. Refresh and try again.") {
    super(message);
    this.name = "ConflictError";
  }
}

export const cellText = (value: unknown): string => String(value ?? "").trim();

/** Compare two rows of cells ignoring surrounding spaces and trailing blanks. */
export function sameCells(a: string[], b: string[]): boolean {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (cellText(a[i]) !== cellText(b[i])) return false;
  }
  return true;
}
