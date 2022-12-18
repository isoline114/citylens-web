'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Plus,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getRuns } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { forgetRecentRuns, getRecentRuns } from '@/lib/storage';
import { normalizeServerRuns, type RunHistoryRow } from '@/lib/run-history';
import type { RunListItem } from '@/lib/types';

export default function RunsPage() {
  const auth = useAuth();
  const [serverRuns, setServerRuns] = useState<RunListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
        setServerRuns([]);
        setNextCursor(null);
        setServerError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

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

  // Signed-out: only sign-in CTAs. No localStorage fallback — the runs
  // tab is account-scoped by design.
  if (!signedIn) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Your runs</h1>
          <p className="text-sm text-slate-600">
            Sign in to view runs from your account. Public demo runs are available without sign-in.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="absolute inset-y-0 left-0 w-1 bg-sky-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Sign in to view your runs</h2>
          <p className="mt-2 text-sm text-slate-600">
            CityLens runs are tied to a free account. Free plan includes 5 runs per month.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-in"
              className="group inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Create a free account
            </Link>
            <Link
              href="/#featured-demos"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              View featured demos
            </Link>
          </div>
        </section>
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your runs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Account-scoped processing history, newest runs first.
          </p>
        </div>
        <Link
          href="/#create"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New run
        </Link>
      </header>

      {serverError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load your run history: {serverError}.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Total" value={rows.length} />
        <SummaryTile label="Succeeded" value={succeeded} tone="emerald" />
        <SummaryTile label="Active" value={active} tone="sky" />
        <SummaryTile label="Failed" value={failed} tone="rose" />
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Run history</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              {latestUpdated ? `Last updated ${formatDate(latestUpdated)}` : 'No completed history yet'}
            </div>
          </div>
          {loading && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="p-4">
          {isEmpty && !serverError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm text-slate-700">No runs yet — create your first run.</p>
              <Link
                href="/#create"
                className="group inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create a run
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.runId} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/runs/${encodeURIComponent(r.runId)}`}
                    className="group grid gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium text-slate-900 group-hover:underline">
                          {r.runId}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {r.address ?? 'Address unavailable'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        {r.stage && <span>Stage: {r.stage}</span>}
                        {typeof r.progress === 'number' && <span>Progress: {Math.round(r.progress)}%</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-slate-500 sm:min-w-36 sm:text-right">
                      <span>Created {formatDate(r.createdAt)}</span>
                      <span>Updated {formatDate(r.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
              <div>{nextCursor ? 'More runs are available.' : 'End of history.'}</div>
              {nextCursor && (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50"
                  onClick={loadMore}
                  disabled={loading}
                >
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
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'sky' | 'rose';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : tone === 'sky'
        ? 'bg-sky-50 text-sky-800 ring-sky-200'
        : tone === 'rose'
          ? 'bg-rose-50 text-rose-800 ring-rose-200'
          : 'bg-slate-50 text-slate-800 ring-slate-200';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 inline-flex min-w-12 justify-center rounded-md px-2 py-1 text-lg font-semibold ring-1 ring-inset ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const value = String(status ?? 'unknown');
  const normalized = value.toLowerCase();
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
  const cls =
    normalized === 'succeeded'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : normalized === 'failed'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : normalized === 'running'
          ? 'border-sky-200 bg-sky-50 text-sky-800'
          : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium ${cls}`}>
      <Icon className={`h-3.5 w-3.5 ${normalized === 'running' ? 'animate-spin' : ''}`} />
      {value}
    </span>
  );
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
