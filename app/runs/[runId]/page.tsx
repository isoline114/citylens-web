'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';

import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import { RunStatusCard } from '@/components/RunStatusCard';
import { ApiError, getDemoRun, getRun } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { setRunStatusCache } from '@/lib/storage';
import type { RunResponse } from '@/lib/types';

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const runId = params.runId;

  const forceDemo = useMemo(() => {
    const v = searchParams.get('demo');
    return v === '1' || v === 'true' || v === 'yes';
  }, [searchParams]);

  const authResolved = auth.status !== 'loading';
  const signedIn = auth.status === 'authenticated';
  const mode = forceDemo || !signedIn ? 'demo' : 'live';
  // Don't kick off the SWR fetch until auth has decided whether we're
  // signed in. Otherwise the first fetch hits the demo URL during the
  // brief loading window and the cached error blocks the live retry.
  const swrKey = useMemo(
    () => (authResolved ? (['run', runId, mode] as const) : null),
    [authResolved, runId, mode],
  );

  const { data, error, isLoading } = useSWR<RunResponse>(
    swrKey,
    async () => {
      const run = mode === 'demo' ? await getDemoRun(runId) : await getRun(runId);
      if (run?.status) setRunStatusCache(runId, String(run.status));
      return run;
    },
    {
      refreshInterval: (latest) => {
        const status = String(latest?.status ?? '').toLowerCase();
        if (status === 'queued' || status === 'running') return 2500;
        return 0;
      },
      errorRetryCount: 3,
      shouldRetryOnError: (err: unknown) => {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 401 || status === 403 || status === 404 || status === 429) return false;
        return true;
      },
    },
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Run {runId}</h1>

      {mode === 'demo' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">Demo run</div>
          <div className="mt-1">This is a precomputed demo. Artifacts may not have download links available.</div>
        </div>
      )}

      <RunStatusCard runId={runId} run={data} error={error} loading={isLoading} />

      <ArtifactsPanel run={data} />
    </div>
  );
}
