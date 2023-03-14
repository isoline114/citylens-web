'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import type { RunResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import {
  formatRunDateTime,
  humanizeRunValue,
  presentRunState,
  shortRunId,
} from '@/lib/run-presentation';

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
  return lines.length > 0 ? lines.join('\n') : null;
}

function technicalRunError(error: RunResponse['error']): string | null {
  if (!error || typeof error === 'string') return null;
  if (Array.isArray(error.traceback_summary)) {
    const joined = error.traceback_summary
      .filter((line): line is string => typeof line === 'string')
      .join('\n')
      .trim();
    return joined || null;
  }
  return typeof error.traceback_summary === 'string' &&
    error.traceback_summary.trim().length > 0
    ? error.traceback_summary.trim()
    : null;
}

function statusStyle(status: string) {
  const s = presentRunState(status).state;
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
  onRetry,
}: {
  runId: string;
  run?: RunResponse;
  error?: unknown;
  loading?: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
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
  const stage = humanizeRunValue(run?.stage);
  const progressRaw = typeof run?.progress === 'number' ? run.progress : undefined;
  const progress =
    progressRaw === undefined
      ? undefined
      : Math.max(0, Math.min(100, progressRaw));

  const { cls, icon: Icon } = statusStyle(status);

  const createdAt = run?.created_at ? String(run.created_at) : undefined;
  const updatedAt = run?.updated_at ? String(run.updated_at) : undefined;

  const statusLower = status.toLowerCase();
  const isActive = statusLower === 'queued' || statusLower === 'running';
  const presentation = presentRunState(status);
  const technicalError = technicalRunError(run?.error);

  const apiErr = error instanceof ApiError ? error : null;

  async function copyRunId() {
    try {
      await navigator.clipboard.writeText(runId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="run-status-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-950">Processing receipt</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Current state, timing, and support reference
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && createdAt && <ElapsedSince createdAt={createdAt} />}
          <div className={cn('inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold', cls)}>
            <Icon className={cn('h-4 w-4', status.toLowerCase() === 'running' ? 'animate-spin' : '')} />
            <span>{loading ? 'Checking' : presentation.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run ID</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-sm font-medium text-slate-900" title={runId}>
              {shortRunId(runId)}
            </span>
            <button
              type="button"
              onClick={() => void copyRunId()}
              aria-label={copied ? 'Run ID copied' : 'Copy run ID'}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-950"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current stage</div>
          <div className="mt-2 text-sm font-medium text-slate-900">{stage}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</div>
          <time className="mt-2 block text-sm font-medium text-slate-900" dateTime={createdAt}>
            {formatRunDateTime(createdAt)}
          </time>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last activity</div>
          <time className="mt-2 block text-sm font-medium text-slate-900" dateTime={updatedAt}>
            {formatRunDateTime(updatedAt)}
          </time>
        </div>
      </div>

      {isActive && (
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-700">
              {presentation.summary}
            </span>
            <span className="text-xs tabular-nums text-slate-500">
              {progress === undefined ? 'Awaiting progress' : `${Math.round(progress)}%`}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Run progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress ?? 0)}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                presentation.state === 'succeeded'
                  ? 'bg-emerald-500'
                  : presentation.state === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-sky-600',
              )}
              style={{ width: `${Math.round(progress ?? 0)}%` }}
            />
          </div>
        </div>
      )}

      {String(run?.status ?? '').toLowerCase() === 'failed' && (
        <div className="border-t border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          <div className="font-semibold">Processing stopped</div>
          <div className="mt-1 whitespace-pre-wrap leading-6">
            {formatRunError(run?.error) ?? 'No error message provided by API.'}
          </div>
          {technicalError && (
            <details className="mt-3 rounded-lg border border-rose-200 bg-white/70 px-3 py-2 text-xs">
              <summary className="cursor-pointer font-semibold">
                Technical details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-rose-950">
                {technicalError}
              </pre>
            </details>
          )}
        </div>
      )}

      {apiErr?.status === 401 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-medium">Sign in required</div>
          <div className="mt-1">
            Your session expired or you&apos;re not signed in.{' '}
            <a href={`/sign-in?next=${encodeURIComponent(`/runs/${runId}`)}`} className="font-medium underline">Sign in</a> to view this run.
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
          <div className="font-medium">Could not load this run</div>
          <div className="mt-1 whitespace-pre-wrap">{errorMessage}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      )}

      {Boolean(error) && !apiErr && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <div className="font-medium">Could not load this run</div>
          <div className="mt-1 whitespace-pre-wrap">{errorMessage}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
