'use client';

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
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Runs
        </Link>
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sky-300">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Account-scoped run
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Sign in to open this evidence package.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Private run history, status, and artifacts are available only to
              the account that created them.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/sign-in?next=${next}`}
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-sky-50"
              >
                Sign in to continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/#featured-demos"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"
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
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        All runs
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)] sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
              <Boxes className="h-4 w-4" />
              Evidence package
              {mode === 'demo' && (
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] tracking-wide text-amber-200">
                  Public demo
                </span>
              )}
            </div>
            <h1 className="mt-3 text-balance break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {address ?? (isLoading ? 'Loading run…' : 'Processing run')}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
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
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {state.state === 'succeeded' ? (
                <Sparkles className="h-4 w-4 text-emerald-300" />
              ) : (
                <Clock3 className="h-4 w-4 text-sky-300" />
              )}
              {isLoading ? 'Checking status' : state.label}
            </div>
            <p className="mt-1 max-w-64 text-xs text-slate-300">
              {isLoading ? 'Loading the latest processing receipt' : state.summary}
            </p>
          </div>
        </div>
      </section>

      {mode === 'demo' && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
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
      <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
      <div className="h-44 animate-pulse rounded-3xl bg-slate-950" />
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function PendingArtifacts() {
  return (
    <section
      className="rounded-2xl border border-sky-200 bg-sky-50 p-5"
      data-testid="artifacts-pending"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 ring-1 ring-sky-200">
          <Boxes className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-sky-950">Outputs are being prepared</h2>
          <p className="mt-1 text-sm leading-6 text-sky-900">
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
      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
      data-testid="artifacts-unavailable"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
          <Boxes className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-slate-950">No outputs were published</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Review the processing receipt above. Start a new run after
            correcting any address or source-data issue.
          </p>
        </div>
      </div>
    </section>
  );
}
