'use client';

import { formatAddress } from '@/lib/parcel-format';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ProductPageHeader } from '@/components/ProductPageHeader';
import { PublicDemoGallery } from '@/components/PublicDemoGallery';
import { getRuns } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { forgetRecentRuns, getRecentRuns } from '@/lib/storage';
import { normalizeServerRuns, type RunHistoryRow } from '@/lib/run-history';
import {
  formatRunDateTime,
  humanizeRunValue,
  presentRunState,
  shortRunId,
} from '@/lib/run-presentation';
import type { RunListItem } from '@/lib/types';

export default function RunsPage() {
  const auth = useAuth();
  const [serverRuns, setServerRuns] = useState<RunListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const signedIn = auth.status === 'authenticated';

  // One-time backfill cleanup: earlier builds wrote arbitrary run ids to
  // localStorage on every detail-page view (signed-out demo views,
  // direct-URL visits, etc). Those orphans used to be merged into this
  // page as `source: local` rows. The /runs view now only shows
  // server-side runs — the cache has no remaining purpose, so drop it.
  useEffect(() => {
    const cached = getRecentRuns();
    if (cached.length > 0) {
      forgetRecentRuns(cached.map((r) => r.runId));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!signedIn) {
        setServerRuns([]);
        setNextCursor(null);
        setServerError(null);
        return;
      }

      setLoading(true);
      try {
        const page = await getRuns({ limit: 20 });
        if (cancelled) return;
        setServerRuns(page.items);
        setNextCursor(page.nextCursor);
        setServerError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setServerError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [signedIn, reloadKey]);

  const rows: RunHistoryRow[] = useMemo(() => normalizeServerRuns(serverRuns), [serverRuns]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await getRuns({ limit: 20, cursor: nextCursor });
      setServerRuns((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setServerError(null);
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (auth.status === 'loading') {
    return <RunsPageSkeleton />;
  }

  // Signed-out: only sign-in CTAs. No localStorage fallback — the runs
  // tab is account-scoped by design.
  if (!signedIn) {
    return (
      <div className="flex flex-col gap-5">
        <ProductPageHeader
          title="Runs"
          icon={Database}
          description="Track each imagery-to-evidence job from request through review."
        />

        <section className="relative overflow-hidden border-t border-rule bg-white p-6 text-ink sm:p-8">
          <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)] md:items-end">
            <div>
              <Database className="h-5 w-5" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Your processing history stays with your account.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">
                Sign in to follow active jobs, inspect failures, and reopen
                completed evidence packages.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/sign-in?next=%2Fruns"
                className="btn-primary gap-2"
              >
                Sign in to continue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink-2">
                <Link
                  href="/sign-up?next=%2Fruns"
                  className="underline-offset-4 hover:text-ink hover:underline"
                >
                  Create account
                </Link>
                <Link href="#public-evidence" className="underline-offset-4 hover:text-ink hover:underline">
                  See real evidence
                </Link>
              </div>
            </div>
          </div>
        </section>

        <PublicDemoGallery />
      </div>
    );
  }

  // Signed-in: server history is the only source of truth.
  const isEmpty = serverRuns.length === 0 && !loading;
  const succeeded = rows.filter((r) => String(r.status ?? '').toLowerCase() === 'succeeded').length;
  const active = rows.filter((r) => ['queued', 'running'].includes(String(r.status ?? '').toLowerCase())).length;
  const failed = rows.filter((r) => String(r.status ?? '').toLowerCase() === 'failed').length;
  const latestUpdated = rows
    .map((r) => r.updatedAt ?? r.createdAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <div className="flex flex-col gap-5">
      <ProductPageHeader
        title="Runs"
        icon={Database}
        description="Monitor active work and reopen completed evidence packages."
        actions={
          <Link
            href="/runs/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-ink bg-ink px-4 text-sm font-semibold text-white transition hover:border-ink hover:bg-ink"
          >
            <Plus className="h-4 w-4" />
            New run
          </Link>
        }
      />

      {serverError && (
        <div
          className="flex flex-col gap-3 border-t border-rule bg-white px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>
            <strong>Run history is temporarily unavailable.</strong>{' '}
            Your existing data has not been changed.
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold hover:bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile testId="run-summary-loaded" label="Loaded" value={rows.length} icon={Database} />
        <SummaryTile testId="run-summary-ready" label="Ready" value={succeeded} icon={CheckCircle2} />
        <SummaryTile testId="run-summary-processing" label="Processing" value={active} icon={Loader2} />
        <SummaryTile testId="run-summary-attention" label="Needs attention" value={failed} icon={AlertTriangle} />
      </section>

      <div className="overflow-hidden border-t border-rule bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-white px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-ink">Recent processing</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-ink-3">
              <CalendarClock className="h-3.5 w-3.5" />
              {latestUpdated
                ? `Latest activity ${formatRunDateTime(latestUpdated)}`
                : 'No processing history yet'}
            </div>
          </div>
          {loading && (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing
            </div>
          )}
        </div>
        <div className="p-3 sm:p-4">
          {isEmpty && !serverError ? (
            <div
              className="flex flex-col items-center gap-3 py-12 text-center"
              data-testid="run-history-empty"
            >
              <Sparkles className="h-6 w-6" />
              <div>
                <p className="font-semibold text-ink">Create your first evidence package</p>
                <p className="mt-1 text-sm text-ink-2">
                  Submit an address and CityLens will track the work here.
                </p>
              </div>
              <Link
                href="/runs/new"
                className="group inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-ink px-4 text-sm font-semibold text-white hover:bg-ink"
              >
                Create a run
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {rows.map((r) => (
                <li key={r.runId} className="py-1 first:pt-0 last:pb-0">
                  <Link
                    href={`/runs/${encodeURIComponent(r.runId)}`}
                    className="group grid gap-3 rounded-sm px-3 py-3 transition-colors hover:bg-paper-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    data-testid="run-history-row"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="truncate text-sm font-semibold text-ink group-hover:text-ink">
                          {formatAddress(r.address) || 'Untitled processing run'}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                        <span className="font-mono" title={r.runId}>
                          {shortRunId(r.runId)}
                        </span>
                        {r.stage && <span>{humanizeRunValue(r.stage)}</span>}
                        {typeof r.progress === 'number' &&
                          presentRunState(r.status).state === 'running' && (
                            <span>{Math.round(r.progress)}% complete</span>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-ink-3 sm:min-w-48 sm:justify-end">
                      <time className="font-mono" dateTime={r.updatedAt ?? r.createdAt}>
                        {formatRunDateTime(r.updatedAt ?? r.createdAt)}
                      </time>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink-2" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-3">
              <div>
                {nextCursor
                  ? `${rows.length} loaded · more available`
                  : `${rows.length} run${rows.length === 1 ? '' : 's'} loaded`}
              </div>
              {nextCursor && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  testId,
  label,
  value,
  icon: Icon,
}: {
  testId: string;
  label: string;
  value: number;
  icon: typeof Database;
}) {
  return (
    <div
      className="border-t border-rule bg-white p-4"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-cond text-[13px] font-semibold text-ink-3">
          {label}
        </div>
        <Icon className="h-4 w-4 text-ink-3" />
      </div>
      <div
        className="mt-3 text-2xl font-semibold tabular-nums text-ink"
        data-testid={`${testId}-value`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const presentation = presentRunState(status);
  const normalized = presentation.state;
  const Icon =
    normalized === 'succeeded'
      ? CheckCircle2
      : normalized === 'failed'
        ? XCircle
        : normalized === 'running'
          ? Loader2
          : normalized === 'queued'
            ? Clock
            : AlertTriangle;
  const cls = normalized === 'failed' ? 'text-red-700' : 'text-ink-2';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cls}`}>
      <Icon className={`h-3.5 w-3.5 ${normalized === 'running' ? 'animate-spin' : ''}`} />
      {presentation.label}
    </span>
  );
}

function RunsPageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading runs">
      <ProductPageHeader
        title="Runs"
        icon={Database}
        description="Track each imagery-to-evidence job from request through review."
        receipt={
          <div className="inline-flex items-center gap-2 text-xs font-medium text-ink-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ink" />
            Checking workspace access
          </div>
        }
      />
      <section className="relative overflow-hidden border-t border-rule bg-white p-6 text-ink sm:p-8">
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)] md:items-end">
          <div>
            <Database className="h-5 w-5" />
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">
              Your processing history stays with your account.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">
              Follow active jobs, inspect failures, and reopen completed
              evidence packages from one private workspace.
            </p>
          </div>
          <div className="flex min-h-11 items-center justify-center gap-2 border-t border-rule bg-white px-4 text-sm font-medium text-ink-2">
            <Loader2 className="h-4 w-4 animate-spin text-ink" />
            Resolving your session
          </div>
        </div>
      </section>
    </div>
  );
}
