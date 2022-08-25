'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';

import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import { RunStatusCard } from '@/components/RunStatusCard';
import { ApiError, getDemoRun, getRun } from '@/lib/api';
import type { RunResponse } from '@/lib/types';
import { getApiKey, rememberRecentRun, setRunStatusCache } from '@/lib/storage';

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  const runId = params.runId;

  const forceDemo = useMemo(() => {
    const v = searchParams.get('demo');
    return v === '1' || v === 'true' || v === 'yes';
  }, [searchParams]);

  const [apiKeyPresent, setApiKeyPresent] = useState<boolean>(() => Boolean(getApiKey()));

  useEffect(() => {
    const sync = () => setApiKeyPresent(Boolean(getApiKey()));
    sync();
    window.addEventListener('citylens_api_key_changed', sync);
    return () => window.removeEventListener('citylens_api_key_changed', sync);
  }, []);

  const mode = forceDemo || !apiKeyPresent ? 'demo' : 'live';
  const swrKey = useMemo(() => ['run', runId, mode] as const, [runId, mode]);

  const { data, error, isLoading } = useSWR<RunResponse>(
    swrKey,
    async () => {
      const run = mode === 'demo' ? await getDemoRun(runId) : await getRun(runId);
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
      shouldRetryOnError: (err: unknown) => {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 401) return false;
        if (status === 429) return false;
        if (status === 404 && mode === 'demo' && apiKeyPresent) {
          // If demo endpoint 404s but we have an API key, retry once in live mode on next key change.
          setApiKeyPresent(Boolean(getApiKey()));
        }
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
