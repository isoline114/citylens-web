import type { RunListItem } from '@/lib/types';

export type RunHistoryRow = {
  runId: string;
  status?: string;
  stage?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeRunId(run: RunListItem): string | null {
  const id = run.run_id ?? run.id;
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
    };
  });
  return rows.filter((row): row is RunHistoryRow => row !== null);
}
