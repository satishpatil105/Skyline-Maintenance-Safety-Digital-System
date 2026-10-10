/**
 * Keeps the alerts fresh without anyone pressing a button:
 *   - shortly after the server starts, and then every NOTIFY_INTERVAL_HOURS (default 6)
 *   - a couple of seconds after any change to the workbook (part replaced, document renewed...)
 * Set NOTIFY_AUTO=off to turn all of this off (alerts can still be checked by hand).
 *
 * This file must not import the database layer (it is imported by it), so the
 * real work is loaded lazily.
 */

interface BootState {
  started?: boolean;
  debounce?: ReturnType<typeof setTimeout>;
}

// Shared across hot reloads and route bundles, so timers are never doubled.
const holder = globalThis as unknown as { __skylineNotify?: BootState };
const state: BootState = (holder.__skylineNotify ??= {});

const enabled = () => (process.env.NOTIFY_AUTO ?? "on").toLowerCase() !== "off";

async function run(reason: string): Promise<void> {
  try {
    const { syncNotifications } = await import("./notifications");
    const r = await syncNotifications();
    if (r.created || r.updated || r.closed) {
      console.log(`[skyline] alerts checked (${reason}): ${r.created} new, ${r.updated} updated, ${r.closed} closed, ${r.open} open`);
    }
  } catch (error) {
    // e.g. the workbook is open in Excel right now; the next run will retry.
    console.warn("[skyline] alert check skipped:", error instanceof Error ? error.message : error);
  }
}

export function ensureNotificationScheduler(): void {
  if (!enabled() || state.started) return;
  state.started = true;

  const hours = Math.max(1, Number(process.env.NOTIFY_INTERVAL_HOURS) || 6);
  setTimeout(() => void run("startup"), 10_000).unref?.();
  setInterval(() => void run("schedule"), hours * 3_600_000).unref?.();
}

/** Called after the workbook is written. Ignores writes that only touched the alerts sheet. */
export function afterWorkbookChange(changedTabs: string[]): void {
  if (!enabled()) return;
  if (changedTabs.every((name) => /notification/i.test(name))) return;

  if (state.debounce) clearTimeout(state.debounce);
  state.debounce = setTimeout(() => void run("data changed"), 2_500);
  state.debounce.unref?.();
}
