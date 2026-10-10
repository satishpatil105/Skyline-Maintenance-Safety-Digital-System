import { withDbLock } from "./db";
import { getStore, type TabData } from "./store";
import { TABLE_LIST, resolveTabName } from "./tables";
import type { TableId } from "./types";

/**
 * Generic access to ANY tab in the spreadsheet (checklists, lookups, whatever
 * your sheet contains). The four app tables also appear here, but they are
 * edited through lib/adminData.ts, which knows their rules.
 */

export interface TabSummary {
  name: string;
  /** Set when this tab is one of the four app tables. */
  known: TableId | null;
  rowCount: number;
  columnCount: number;
}

export interface AdminResult {
  success: boolean;
  message: string;
  status?: number;
}

const MAX_CELL = 5000;
const clean = (v: unknown) => String(v ?? "").trim().slice(0, MAX_CELL);

function knownMap(tabs: TabData[]): Map<string, TableId> {
  const names = tabs.map((t) => t.name);
  const map = new Map<string, TableId>();
  for (const table of TABLE_LIST) {
    const name = resolveTabName(table, names);
    if (name) map.set(name, table.id);
  }
  return map;
}

export async function listTabs(fresh = false) {
  const store = getStore();
  const tabs = await store.readAll({ fresh });
  const known = knownMap(tabs);
  const summaries: TabSummary[] = tabs.map((t) => ({
    name: t.name,
    known: known.get(t.name) ?? null,
    rowCount: t.rows.length,
    columnCount: t.headers.filter(Boolean).length,
  }));
  return { store: store.describe(), tabs: summaries };
}

export async function getTab(
  name: string,
  fresh = false
): Promise<
  | { tab: { name: string; headers: string[]; rows: TabData["rows"] }; error?: undefined }
  | { tab?: undefined; error: AdminResult }
> {
  const tabs = await getStore().readAll({ fresh });
  const tab = tabs.find((t) => t.name === name);
  if (!tab) return { error: { success: false, message: `Tab "${name}" not found.`, status: 404 } };

  // The app tables have their own editors, which also keep password hashes
  // out of the browser. Never hand their raw cells to the generic viewer.
  if (knownMap(tabs).has(name)) {
    return { error: { success: false, message: "This tab has its own editor. Use its normal tab in the dashboard.", status: 400 } };
  }
  return { tab: { name: tab.name, headers: tab.headers, rows: tab.rows } };
}

async function guard(name: string): Promise<{ tab?: TabData; error?: AdminResult }> {
  const tabs = await getStore().readAll({ fresh: true });
  const tab = tabs.find((t) => t.name === name);
  if (!tab) return { error: { success: false, message: `Tab "${name}" not found.`, status: 404 } };
  if (knownMap(tabs).has(name)) {
    return { error: { success: false, message: "This tab has its own editor. Use its normal tab in the dashboard.", status: 400 } };
  }
  if (!tab.headers.some(Boolean)) {
    return { error: { success: false, message: "This tab has no header row (row 1), so rows can't be edited here.", status: 400 } };
  }
  return { tab };
}

/** Cells arrive keyed by position; pad/trim to the tab's header width. */
function shape(tab: TabData, cells: unknown): string[] | null {
  if (!Array.isArray(cells)) return null;
  return tab.headers.map((_, i) => clean(cells[i]));
}

export function createTabRow(name: string, cells: unknown): Promise<AdminResult> {
  return withDbLock(async () => {
    const g = await guard(name);
    if (g.error) return g.error;
    const row = shape(g.tab!, cells);
    if (!row) return { success: false, message: "No data received.", status: 400 };
    if (!row.some(Boolean)) return { success: false, message: "Fill in at least one field.", status: 400 };

    await getStore().apply([{ type: "append", tab: name, cells: row }]);
    return { success: true, message: "Row added.", status: 201 };
  });
}

export function updateTabRow(
  name: string,
  rowNumber: number,
  expected: unknown,
  cells: unknown
): Promise<AdminResult> {
  return withDbLock(async () => {
    const g = await guard(name);
    if (g.error) return g.error;
    const next = shape(g.tab!, cells);
    const before = shape(g.tab!, expected);
    if (!next || !before || !Number.isInteger(rowNumber) || rowNumber < 2) {
      return { success: false, message: "No data received.", status: 400 };
    }

    await getStore().apply([{ type: "update", tab: name, row: rowNumber, expected: before, cells: next }]);
    return { success: true, message: "Row updated.", status: 200 };
  });
}

export function deleteTabRow(name: string, rowNumber: number, expected: unknown): Promise<AdminResult> {
  return withDbLock(async () => {
    const g = await guard(name);
    if (g.error) return g.error;
    const before = shape(g.tab!, expected);
    if (!before || !Number.isInteger(rowNumber) || rowNumber < 2) {
      return { success: false, message: "No row selected.", status: 400 };
    }

    await getStore().apply([{ type: "delete", tab: name, row: rowNumber, expected: before }]);
    return { success: true, message: "Row deleted.", status: 200 };
  });
}
