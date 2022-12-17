'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { getFeaturedDemos, getRuns } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { forgetRecentRuns, getRecentRuns, type RecentRun } from '@/lib/storage';
import { mergeRunHistory, type RunHistoryRow } from '@/lib/run-history';
import type { RunListItem } from '@/lib/types';

export default function RunsPage() {
  const auth = useAuth();
  const [serverRuns, setServerRuns] = useState<RunListItem[]>([]);
  const [localRuns, setLocalRuns] = useState<RecentRun[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [demoRunIds, setDemoRunIds] = useState<Set<string>>(() => new Set());

  const signedIn = auth.status === 'authenticated';

  useEffect(() => {
    setLocalRuns(getRecentRuns());
  }, []);

  // Backfill cleanup: earlier builds incorrectly cached demo run ids
  // into localStorage on every demo detail-page view. Filter them out
  // both from the in-memory list and from the persisted store so the
  // runs tab stops showing demo orphans as `source: local`.
  useEffect(() => {
    let cancelled = false;
    async function pruneDemoRunsFromLocal() {
      try {
        const demos = await getFeaturedDemos();
        if (cancelled) return;
        const ids = new Set<string>();
        for (const d of demos) {
          const id = (typeof d.run_id === 'string' && d.run_id) || (typeof d.id === 'string' ? d.id : undefined);
          if (id) ids.add(id);
        }
        if (ids.size === 0) return;
        setDemoRunIds(ids);
        const removed = forgetRecentRuns(ids);
        if (removed > 0) setLocalRuns(getRecentRuns());
      } catch {
        // Best-effort cleanup; failure here is non-fatal.
      }
    }
    pruneDemoRunsFromLocal();
    return () => {
      cancelled = true;
    };
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

  const rows: RunHistoryRow[] = useMemo(
    () => mergeRunHistory(serverRuns, localRuns, { demoRunIds }),
    [serverRuns, localRuns, demoRunIds],
  );

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

  // Signed-out: lead with the product story (sign in / featured demos),
  // not with browser-local history. Local history stays as a quiet
  // fallback below for dev/test convenience.
  if (!signedIn) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Your runs</h1>
          <p className="text-sm text-slate-600">
            Sign in to view runs from your account. Public demo runs are available without sign-in.
            Account runs are private to you.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Sign in to view your runs</h2>
          <p className="mt-2 text-sm text-slate-600">
            CityLens runs are tied to a free account. Free plan includes 5 runs per month.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign in
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

        {localRuns.length > 0 && (
          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-900">
              Browser-local run history ({localRuns.length})
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Cached run IDs from this browser. Useful for re-opening a run by ID. Sign in to see
              your full server-side history.
            </p>
            <ul className="mt-3 divide-y divide-slate-200">
              {localRuns.map((r) => (
                <li key={r.runId} className="flex items-center justify-between py-2">
                  <Link
                    href={`/runs/${encodeURIComponent(r.runId)}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {r.runId}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {r.lastKnownStatus ? `status: ${r.lastKnownStatus}` : 'status: unknown'}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  // Signed-in: server history is the primary product surface.
  const isEmpty = serverRuns.length === 0 && !loading;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Your runs</h1>

      {serverError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load your run history: {serverError}. Showing browser-local fallback below.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-sm font-medium">
          <div>Run history</div>
          {loading && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="p-4">
          {isEmpty && !serverError ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-slate-600">No runs yet — create your first run.</p>
              <Link
                href="/#create"
                className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create a run
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.runId} className="flex items-center justify-between py-3">
                  <Link
                    href={`/runs/${encodeURIComponent(r.runId)}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {r.runId}
                  </Link>
                  <div className="text-right text-xs text-slate-600">
                    <div>{r.status ? `status: ${r.status}` : 'status: (unknown)'}</div>
                    <div>{r.stage ? `stage: ${r.stage}` : `source: ${r.source}`}</div>
                  </div>
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
