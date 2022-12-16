'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { getRuns } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getRecentRuns, type RecentRun } from '@/lib/storage';
import { mergeRunHistory, type RunHistoryRow } from '@/lib/run-history';
import type { RunListItem } from '@/lib/types';

export default function RunsPage() {
  const auth = useAuth();
  const [serverRuns, setServerRuns] = useState<RunListItem[]>([]);
  const [localRuns, setLocalRuns] = useState<RecentRun[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [source, setSource] = useState<'server' | 'local'>('local');

  const signedIn = auth.status === 'authenticated';

  useEffect(() => {
    setLocalRuns(getRecentRuns());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!signedIn) {
        setSource('local');
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
        setSource('server');
      } catch (e: unknown) {
        if (cancelled) return;
        setServerRuns([]);
        setNextCursor(null);
        setServerError(e instanceof Error ? e.message : String(e));
        setSource('local');
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
    () => mergeRunHistory(serverRuns, localRuns),
    [serverRuns, localRuns],
  );

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await getRuns({ limit: 20, cursor: nextCursor });
      setServerRuns((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setServerError(null);
      setSource('server');
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      <p className="text-sm text-slate-600">
        {source === 'server'
          ? 'Showing server-backed run history. Local browser history is appended if it is not already on the server.'
          : 'Showing browser-local run history. Sign in to load your full server history.'}
      </p>
      {serverError && signedIn && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Falling back to local browser history because the server list could not be loaded: {serverError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-sm font-medium">
          <div>Recent run IDs</div>
          {loading && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="p-4">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-600">No runs yet. Create one from Home.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.runId} className="flex items-center justify-between py-3">
                  <Link href={`/runs/${encodeURIComponent(r.runId)}`} className="text-sm font-medium text-slate-900 hover:underline">
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

          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
            <div>{nextCursor ? 'More runs are available from the server.' : 'No more server pages.'}</div>
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
        </div>
      </div>
    </div>
  );
}
