'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

import type { RunResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';

/** "42s", "3m 07s", "1h 02m" — coarse enough for a run-progress readout. */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * Ticking "elapsed since created_at" readout, rendered only while the run
 * is queued/running. Its own component so the 1 Hz interval re-renders
 * this leaf, not the whole status card.
 */
function ElapsedSince({ createdAt }: { createdAt: string }) {
  const createdMs = Date.parse(createdAt);
  // Deterministic initial value keeps the server HTML and hydration pass in
  // sync; the effect replaces it with wall-clock time immediately.
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(createdMs)) return;
    const update = () => setElapsedMs(Math.max(0, Date.now() - createdMs));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [createdMs]);
  if (!Number.isFinite(createdMs)) return null;
  return (
    <span className="text-xs tabular-nums text-slate-500">
      {formatElapsed(elapsedMs)} elapsed
    </span>
  );
}

function formatRunError(error: RunResponse['error']): string | null {
  if (!error) return null;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const lines: string[] = [];
  if (typeof error.code === 'string' && error.code.trim().length > 0) {
    lines.push(`Code: ${error.code.trim()}`);
  }
  if (typeof error.stage === 'string' && error.stage.trim().length > 0) {
    lines.push(`Stage: ${error.stage.trim()}`);
  }
  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    lines.push(error.message.trim());
  }
  if (Array.isArray(error.traceback_summary)) {
    const joined = error.traceback_summary.filter((x): x is string => typeof x === 'string').join('\n');
    if (joined.trim().length > 0) lines.push(joined.trim());
  } else if (typeof error.traceback_summary === 'string' && error.traceback_summary.trim().length > 0) {
    lines.push(error.traceback_summary.trim());
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s === 'succeeded') return { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
  if (s === 'failed') return { cls: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle };
  if (s === 'running') return { cls: 'bg-blue-50 text-blue-800 border-blue-200', icon: Loader2 };
  if (s === 'queued') return { cls: 'bg-slate-50 text-slate-800 border-slate-200', icon: Clock };
  return { cls: 'bg-slate-50 text-slate-800 border-slate-200', icon: AlertTriangle };
}

export function RunStatusCard({
  runId,
  run,
  error,
  loading,
}: {
  runId: string;
  run?: RunResponse;
  error?: unknown;
  loading?: boolean;
}) {
  const errorMessage = (() => {
    if (!error) return null;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
      const msg = (error as Record<string, unknown>)['message'];
      if (typeof msg === 'string') return msg;
    }
    return String(error);
  })();

  const status = String(run?.status ?? (loading ? 'loading' : 'unknown'));
  const stage = run?.stage ? String(run.stage) : '—';
  const progressRaw = typeof run?.progress === 'number' ? run.progress : undefined;
  const progress =
    progressRaw === undefined
      ? undefined
      : progressRaw > 1 || progressRaw === 1
        ? Math.max(0, Math.min(100, progressRaw))
        : Math.max(0, Math.min(1, progressRaw)) * 100;

  const { cls, icon: Icon } = statusStyle(status);

  const createdAt = run?.created_at ? String(run.created_at) : undefined;
  const updatedAt = run?.updated_at ? String(run.updated_at) : undefined;

  const statusLower = status.toLowerCase();
  const isActive = statusLower === 'queued' || statusLower === 'running';

  const apiErr = error instanceof ApiError ? error : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-medium">Status</div>
        <div className="flex items-center gap-2">
          {isActive && createdAt && <ElapsedSince createdAt={createdAt} />}
          <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', cls)}>
            <Icon className={cn('h-4 w-4', status.toLowerCase() === 'running' ? 'animate-spin' : '')} />
            <span>{status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-500">Run ID</div>
          <div className="text-sm font-mono text-slate-900">{runId}</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-500">Stage</div>
          <div className="text-sm text-slate-900">{stage}</div>
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
          <div className="text-xs text-slate-500">Progress</div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
            <div
              className="h-2 bg-slate-900"
              style={{ width: `${Math.round(progress ?? 0)}%` }}
            />
          </div>
          <div className="text-xs text-slate-600">{progress === undefined ? '—' : `${Math.round(progress)}%`}</div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-500">Created</div>
          <div className="text-sm text-slate-900">{createdAt ?? '—'}</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-500">Updated</div>
          <div className="text-sm text-slate-900">{updatedAt ?? '—'}</div>
        </div>
      </div>

      {String(run?.status ?? '').toLowerCase() === 'failed' && (
        <div className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="font-medium">Run failed</div>
          <div className="mt-1 whitespace-pre-wrap">
            {formatRunError(run?.error) ?? 'No error message provided by API.'}
          </div>
        </div>
      )}

      {apiErr?.status === 401 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-medium">Sign in required</div>
          <div className="mt-1">
            Your session expired or you&apos;re not signed in.{' '}
            <a href="/sign-in" className="font-medium underline">Sign in</a> to view this run.
          </div>
        </div>
      )}

      {apiErr?.status === 429 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-medium">Quota exceeded (429)</div>
          <div className="mt-1">Please wait and refresh.</div>
        </div>
      )}

      {apiErr && apiErr.status !== 401 && apiErr.status !== 429 && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <div className="font-medium">Error loading run</div>
          <div className="mt-1 whitespace-pre-wrap">{errorMessage}</div>
        </div>
      )}

      {Boolean(error) && !apiErr && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <div className="font-medium">Error loading run</div>
          <div className="mt-1 whitespace-pre-wrap">{errorMessage}</div>
        </div>
      )}
    </div>
  );
}
