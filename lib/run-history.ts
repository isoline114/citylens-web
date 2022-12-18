import type { RunListItem } from '@/lib/types';

export type RunHistoryRow = {
  runId: string;
  status?: string;
  stage?: string;
  progress?: number;
  address?: string;
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
      progress: normalizeProgress(run.progress),
      address: normalizeAddress(run.request),
      createdAt: typeof run.created_at === 'string' ? run.created_at : undefined,
      updatedAt: typeof run.updated_at === 'string' ? run.updated_at : undefined,
    };
  });
  return rows.filter((row): row is RunHistoryRow => row !== null);
}

function normalizeProgress(progress: unknown): number | undefined {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return undefined;
  const pct = progress > 1 || progress === 1 ? progress : progress * 100;
  return Math.max(0, Math.min(100, pct));
}

function normalizeAddress(request: unknown): string | undefined {
  if (!request || typeof request !== 'object') return undefined;
  const address = (request as { address?: unknown }).address;
  return typeof address === 'string' && address.trim().length > 0 ? address.trim() : undefined;
}
