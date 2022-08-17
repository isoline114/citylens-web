'use client';

import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

import type { RunResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';

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
  const status = String(run?.status ?? (loading ? 'loading' : 'unknown'));
  const stage = run?.stage ? String(run.stage) : '—';
  const progressRaw = typeof run?.progress === 'number' ? run.progress : undefined;
  const progress = progressRaw === undefined ? undefined : Math.max(0, Math.min(1, progressRaw));

  const { cls, icon: Icon } = statusStyle(status);

  const createdAt = run?.created_at ? String(run.created_at) : undefined;
  const updatedAt = run?.updated_at ? String(run.updated_at) : undefined;

  const apiErr = error instanceof ApiError ? error : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-medium">Status</div>
        <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', cls)}>
          <Icon className={cn('h-4 w-4', status.toLowerCase() === 'running' ? 'animate-spin' : '')} />
          <span>{status}</span>
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
              style={{ width: `${Math.round(((progress ?? 0) * 100) * 100) / 100}%` }}
            />
          </div>
          <div className="text-xs text-slate-600">{progress === undefined ? '—' : `${Math.round(progress * 100)}%`}</div>
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
          <div className="mt-1 whitespace-pre-wrap">{run?.error ? String(run.error) : 'No error message provided by API.'}</div>
        </div>
      )}

      {apiErr?.status === 401 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-medium">Unauthorized (401)</div>
          <div className="mt-1">Click “API key” in the header to set or replace your key.</div>
        </div>
      )}

      {apiErr?.status === 429 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-medium">Quota exceeded (429)</div>
          <div className="mt-1">Please wait and refresh.</div>
        </div>
      )}

      {Boolean(error) && !apiErr && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <div className="font-medium">Error loading run</div>
          <div className="mt-1 whitespace-pre-wrap">{String((error as any)?.message ?? error)}</div>
        </div>
      )}
    </div>
  );
}
