'use client';

import { formatAddress } from '@/lib/parcel-format';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Clock3,
  LockKeyhole,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';

import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import { RunStatusCard } from '@/components/RunStatusCard';
import { ApiError, getDemoRun, getRun } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  hasPublishedArtifacts,
  presentRunState,
  runAddress,
  shortRunId,
} from '@/lib/run-presentation';
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
  const mode = forceDemo ? 'demo' : signedIn ? 'live' : 'gate';
  // Don't kick off the SWR fetch until auth has decided whether we're
  // signed in. Private deep links now stop at an account gate instead of
  // incorrectly probing the public demo API and surfacing a misleading 404.
  const swrKey = useMemo(
    () =>
      authResolved && mode !== 'gate'
        ? (['run', runId, mode] as const)
        : null,
    [authResolved, runId, mode],
  );

  const { data, error, isLoading, mutate } = useSWR<RunResponse>(
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

  if (!authResolved) {
    return <RunDetailSkeleton />;
  }

  if (mode === 'gate') {
    const next = encodeURIComponent(`/runs/${runId}`);
    return (
      <div className="flex flex-col gap-5" data-testid="private-run-access-gate">
        <Link
          href="/runs"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Runs
        </Link>
        <section className="relative overflow-hidden border-t border-rule bg-white p-6 text-ink sm:p-8">
          <div className="relative max-w-2xl">
            <LockKeyhole className="h-5 w-5" />
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Sign in to open this evidence package.
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-2">
              Private run history, status, and artifacts are available only to
              the account that created them.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/sign-in?next=${next}`}
                className="btn-primary gap-2"
              >
                Sign in to continue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/runs#public-evidence"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-control bg-white px-4 text-sm font-semibold text-ink hover:bg-white"
              >
                Explore public demos
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const address = runAddress(data);
  const state = presentRunState(data?.status);
  const artifactsPublished = hasPublishedArtifacts(data);
  const active = state.state === 'queued' || state.state === 'running';

  return (
    <div className="flex flex-col gap-5" data-testid="run-detail-shell">
      <Link
        href="/runs"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All runs
      </Link>

      <section className="relative overflow-hidden border-t border-rule bg-white px-5 py-6 text-ink sm:px-7">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="mt-3 text-balance break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {formatAddress(address) || (isLoading ? 'Loading run…' : 'Processing run')}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3 font-mono text-xs text-ink-3">
              {mode === 'demo' && <span>Public demo</span>}
              {address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Reconstruction request
                </span>
              )}
              <span className="font-mono" title={runId}>
                {shortRunId(runId)}
              </span>
            </div>
          </div>
          <div className="shrink-0 border-t border-rule bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {state.state === 'succeeded' ? (
                <Sparkles className="h-4 w-4 text-ink" />
              ) : (
                <Clock3 className="h-4 w-4 text-ink" />
              )}
              {isLoading ? 'Checking status' : state.label}
            </div>
            <p className="mt-1 max-w-64 text-xs text-ink-2">
              {isLoading ? 'Loading the latest processing receipt' : state.summary}
            </p>
          </div>
        </div>
      </section>

      {mode === 'demo' && (
        <div className="border-t border-rule bg-paper-2 px-4 py-3 text-sm text-ink">
          Completed public example. Outputs are read-only.
        </div>
      )}

      <RunStatusCard
        runId={runId}
        run={data}
        error={error}
        loading={isLoading}
        onRetry={() => void mutate()}
      />

      {artifactsPublished ? (
        <ArtifactsPanel run={data} />
      ) : active ? (
        <PendingArtifacts />
      ) : state.state === 'failed' ? (
        <UnavailableArtifacts />
      ) : !isLoading && !error ? (
        <UnavailableArtifacts />
      ) : null}
    </div>
  );
}

function RunDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading run">
      <div className="h-5 w-24 animate-pulse border-t border-rule" />
      <div className="h-44 animate-pulse rounded-sm bg-white" />
      <div className="h-72 animate-pulse border-t border-rule bg-white" />
    </div>
  );
}

function PendingArtifacts() {
  return (
    <section
      className="border-t border-rule bg-paper-2 p-5"
      data-testid="artifacts-pending"
    >
      <div className="flex items-start gap-3">
        <Boxes className="h-5 w-5" />
        <div>
          <h2 className="font-semibold text-ink">Outputs are being prepared</h2>
          <p className="mt-1 text-sm leading-6 text-ink">
            Preview, change geometry, mesh, and the QA receipt will appear here
            as soon as processing completes. This page refreshes automatically.
          </p>
        </div>
      </div>
    </section>
  );
}

function UnavailableArtifacts() {
  return (
    <section
      className="border-t border-rule bg-paper-2 p-5"
      data-testid="artifacts-unavailable"
    >
      <div className="flex items-start gap-3">
        <Boxes className="h-5 w-5" />
        <div>
          <h2 className="font-semibold text-ink">No outputs were published</h2>
          <p className="mt-1 text-sm leading-6 text-ink-2">
            Review the processing receipt above. Start a new run after
            correcting any address or source-data issue.
          </p>
        </div>
      </div>
    </section>
  );
}
