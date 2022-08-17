const API_KEY_STORAGE = 'citylens_api_key';
const RECENT_RUNS_STORAGE = 'citylens_recent_runs';
const RUN_STATUS_CACHE_STORAGE = 'citylens_run_status_cache';

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

export function setRunStatusCache(runId: string, status: string): void {
  const cache = readJson<Record<string, string>>(RUN_STATUS_CACHE_STORAGE, {});
  cache[runId] = status;
  writeJson(RUN_STATUS_CACHE_STORAGE, cache);
}
