const API_KEY_STORAGE = 'citylens_api_key';
const RECENT_RUNS_STORAGE = 'citylens_recent_runs';
const RUN_STATUS_CACHE_STORAGE = 'citylens_run_status_cache';

// @deprecated Dashboard auth no longer uses a manually-pasted API key. Use lib/auth instead.
// These helpers are kept for any internal admin tooling that still relies on local-storage keys.
export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(API_KEY_STORAGE);
  return v && v.trim().length > 0 ? v : null;
}

export function setApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(API_KEY_STORAGE, apiKey);
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(API_KEY_STORAGE);
}

export type RecentRun = { runId: string; createdAtMs: number; lastKnownStatus?: string };

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/**
 * @deprecated The /runs page no longer merges localStorage entries with
 * the server-side run history; account-scoped runs are the only source
 * of truth. Kept as an exported symbol because removed callers may exist
 * in older test scaffolds; new code should not call this.
 */
export function rememberRecentRun(runId: string): void {
  const list = readJson<RecentRun[]>(RECENT_RUNS_STORAGE, []);
  const now = Date.now();
  const existing = list.find((r) => r.runId === runId);
  const next: RecentRun[] = existing
    ? [{ ...existing }, ...list.filter((r) => r.runId !== runId)]
    : [{ runId, createdAtMs: now }, ...list];

  // cap to avoid unbounded growth
  writeJson(RECENT_RUNS_STORAGE, next.slice(0, 50));
}

export function getRecentRuns(): RecentRun[] {
  const list = readJson<RecentRun[]>(RECENT_RUNS_STORAGE, []);
  const cache = readJson<Record<string, string>>(RUN_STATUS_CACHE_STORAGE, {});
  return list.map((r) => ({ ...r, lastKnownStatus: cache[r.runId] ?? r.lastKnownStatus }));
}

/**
 * Drop any cached recent-run entries whose runId is in `idsToForget`.
 * Used to backfill cleanup of demo run ids that earlier builds
 * incorrectly cached when users opened a demo detail page.
 *
 * Returns the number of entries removed (0 if no-op).
 */
export function forgetRecentRuns(idsToForget: Iterable<string>): number {
  if (typeof window === 'undefined') return 0;
  const drop = new Set<string>();
  for (const id of idsToForget) {
    if (typeof id === 'string' && id.trim().length > 0) drop.add(id.trim());
  }
  if (drop.size === 0) return 0;

  const list = readJson<RecentRun[]>(RECENT_RUNS_STORAGE, []);
  const next = list.filter((r) => !drop.has(r.runId));
  if (next.length === list.length) return 0;
  writeJson(RECENT_RUNS_STORAGE, next);
  return list.length - next.length;
}

export function setRunStatusCache(runId: string, status: string): void {
  const cache = readJson<Record<string, string>>(RUN_STATUS_CACHE_STORAGE, {});
  cache[runId] = status;
  writeJson(RUN_STATUS_CACHE_STORAGE, cache);
}
