'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';

import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import { RunStatusCard } from '@/components/RunStatusCard';
import { getRun } from '@/lib/api';
import type { RunResponse } from '@/lib/types';
import { rememberRecentRun, setRunStatusCache } from '@/lib/storage';

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

  const swrKey = useMemo(() => ['run', runId] as const, [runId]);

  const { data, error, isLoading } = useSWR<RunResponse>(
    swrKey,
    async () => {
      const run = await getRun(runId);
      rememberRecentRun(runId);
      if (run?.status) setRunStatusCache(runId, String(run.status));
      return run;
    },
    {
      refreshInterval: (latest) => {
        const status = String(latest?.status ?? '').toLowerCase();
        if (status === 'queued' || status === 'running') return 2500;
        return 0;
      },
      shouldRetryOnError: (err: any) => {
        const status = err?.status;
        if (status === 401) return false;
        if (status === 429) return false;
        return true;
      },
    },
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Run {runId}</h1>

      <RunStatusCard runId={runId} run={data} error={error} loading={isLoading} />

      <ArtifactsPanel run={data} />
    </div>
  );
}
