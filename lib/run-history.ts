import type { RecentRun } from '@/lib/storage';
import type { RunListItem } from '@/lib/types';

export type RunHistorySource = 'server' | 'local';

export type RunHistoryRow = {
  runId: string;
  status?: string;
  stage?: string;
  createdAt?: string;
  updatedAt?: string;
  source: RunHistorySource;
};

function normalizeRunId(run: RunListItem | RecentRun): string | null {
  const id = 'runId' in run ? run.runId : run.run_id ?? run.id;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

export function normalizeServerRuns(runs: RunListItem[]): RunHistoryRow[] {
  const rows: Array<RunHistoryRow | null> = runs.map((run) => {
    const runId = normalizeRunId(run);
    if (!runId) return null;
    return {
      runId,
      status: typeof run.status === 'string' ? run.status : undefined,
      stage: typeof run.stage === 'string' ? run.stage : undefined,
      createdAt: typeof run.created_at === 'string' ? run.created_at : undefined,
      updatedAt: typeof run.updated_at === 'string' ? run.updated_at : undefined,
      source: 'server' as const,
    };
  });
  return rows.filter((row): row is RunHistoryRow => row !== null);
}

export function normalizeLocalRuns(runs: RecentRun[]): RunHistoryRow[] {
  const rows: Array<RunHistoryRow | null> = runs.map((run) => {
    const runId = normalizeRunId(run);
    if (!runId) return null;
    return {
      runId,
      status: typeof run.lastKnownStatus === 'string' ? run.lastKnownStatus : undefined,
      stage: undefined,
      createdAt: new Date(run.createdAtMs).toISOString(),
      updatedAt: undefined,
      source: 'local' as const,
    };
  });
  return rows.filter((row): row is RunHistoryRow => row !== null);
}

export function mergeRunHistory(serverRuns: RunListItem[], localRuns: RecentRun[]): RunHistoryRow[] {
  const out: RunHistoryRow[] = [];
  const seen = new Set<string>();

  for (const row of normalizeServerRuns(serverRuns)) {
    if (seen.has(row.runId)) continue;
    seen.add(row.runId);
    out.push(row);
  }

  for (const row of normalizeLocalRuns(localRuns)) {
    if (seen.has(row.runId)) continue;
    seen.add(row.runId);
    out.push(row);
  }

  return out;
}
