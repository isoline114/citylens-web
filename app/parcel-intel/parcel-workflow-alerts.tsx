'use client';

import { useEffect, useState } from 'react';
import {
  BellRing,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react';

import {
  getParcelWorkflowAlerts,
  type ParcelWorkflowAlert,
  type ParcelWorkflowAlerts,
} from '@/lib/api';

const SEVERITY_STYLES: Record<ParcelWorkflowAlert['severity'], string> = {
  urgent: 'border-rose-400/35 bg-rose-400/10 text-rose-100',
  high: 'border-amber-400/35 bg-amber-400/10 text-amber-100',
  medium: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  low: 'border-white/10 bg-white/5 text-slate-200',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

export function ParcelWorkflowAlertsPanel({
  onClose,
  onSelectParcel,
}: {
  onClose: () => void;
  onSelectParcel: (bbl: string) => void;
}) {
  const [data, setData] = useState<ParcelWorkflowAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getParcelWorkflowAlerts()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <section
      className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:px-7"
      aria-label="Watched parcel changes"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
            <BellRing className="h-4 w-4" />
            Watchlist change center
          </div>
          <h3 className="mt-1 text-xl font-semibold">
            What changed since each lead was saved?
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Private, current-feed comparisons for watched parcels. Alerts point to
            records that need review; they do not assert seller intent or a completed
            transaction.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close watchlist changes"
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-300" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Comparing watched leads with the current feed…
        </div>
      ) : error || !data ? (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            Watchlist changes are temporarily unavailable.
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Watched leads', data.watched_count],
              ['Leads changed', data.changed_lead_count],
              ['Urgent review', data.severity_counts.urgent],
              ['Total alerts', data.alert_count],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className="mt-1 text-xl font-semibold">
                  {Number(value).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {data.alerts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              No decision-relevant differences were found between saved baselines and
              the current eligible feed.
            </div>
          ) : (
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {data.alerts.map((alert, index) => (
                <article
                  key={`${alert.bbl}-${alert.code}-${index}`}
                  className={`rounded-xl border p-4 ${SEVERITY_STYLES[alert.severity]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">
                        {alert.severity} · BBL {alert.bbl}
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-white">
                        {alert.title}
                      </h4>
                    </div>
                    {alert.code !== 'removed_from_current_feed' && (
                      <button
                        type="button"
                        onClick={() => onSelectParcel(alert.bbl)}
                        className="shrink-0 rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                      >
                        Open parcel
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 opacity-90">{alert.detail}</p>
                  {alert.code !== 'removed_from_current_feed' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded bg-black/15 px-2 py-1">
                        Saved: {formatValue(alert.before)}
                      </span>
                      <span aria-hidden="true">→</span>
                      <span className="rounded bg-black/15 px-2 py-1">
                        Current: {formatValue(alert.after)}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {data.warnings.map((warning) => (
            <p key={warning} className="mt-3 text-xs leading-5 text-amber-200">
              {warning}
            </p>
          ))}
          <p className="mt-3 text-xs text-slate-400">
            Current feed: {data.feed_generated_at ?? 'date unavailable'}.
            Rank alerts require a move of at least 100 citywide places.
          </p>
        </>
      )}
    </section>
  );
}
