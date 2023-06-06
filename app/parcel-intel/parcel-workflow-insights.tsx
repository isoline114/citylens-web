'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react';

import {
  getParcelWorkflowAnalytics,
  getParcelWorkflowOutcomeExport,
  type ParcelWorkflowAnalytics,
  type ParcelWorkflowConfidenceInterval,
  type ParcelWorkflowMaturityWindow,
} from '@/lib/api';

function formatWindowRate(window: ParcelWorkflowMaturityWindow): string {
  if (!window.sufficient_denominator || window.rate === null) return 'Collecting';
  return `${Math.round(window.rate * 100)}%`;
}

function formatCohortRate(
  rate: number | null,
  denominator: number,
  minimum: number,
): string {
  if (rate === null || denominator < minimum) return 'Collecting';
  return `${Math.round(rate * 100)}%`;
}

function formatConfidenceInterval(
  interval: ParcelWorkflowConfidenceInterval | null,
): string | null {
  if (!interval) return null;
  return `95% interval ${Math.round(interval.lower * 100)}–${Math.round(
    interval.upper * 100,
  )}%`;
}

export function ParcelWorkflowInsights({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ParcelWorkflowAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getParcelWorkflowAnalytics()
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

  const rankCohorts = useMemo(
    () => data?.cohorts.filter((cohort) => cohort.dimension === 'rank_band') ?? [],
    [data],
  );

  const exportEvidence = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const evidence = await getParcelWorkflowOutcomeExport();
      const blob = new Blob([JSON.stringify(evidence, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `citylens-outcome-evidence-${evidence.generated_at.slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage(
        `Exported ${evidence.exported_record_count.toLocaleString()} privacy-safe outcome record${
          evidence.exported_record_count === 1 ? '' : 's'
        }.`,
      );
    } catch {
      setExportMessage('Outcome evidence export failed. Please retry.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section
      id="parcel-outcome-insights"
      className="border-b border-rule bg-white px-4 py-5 text-ink md:px-7"
      aria-label="Prospective workflow outcomes"
      data-testid="workflow-insights-panel"
      data-state={
        loading
          ? 'loading'
          : error || !data
            ? 'error'
            : data.total_records === 0
              ? 'empty'
              : data.measurement_status
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="mt-1 text-xl font-semibold">
            Are saved leads becoming real opportunities?
          </h3>
          <p
            className="mt-1 max-w-3xl text-sm leading-6 text-ink-2"
            data-testid="workflow-insights-evidence-boundary"
          >
            Your private workflow outcomes, measured from the day a lead entered the
            pipeline. These rates are not the historical model&apos;s validation accuracy.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
          {data && (
            <button
              type="button"
              onClick={() => void exportEvidence()}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-sm border border-control px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-white disabled:cursor-wait disabled:opacity-60"
            >
              {exporting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exporting ? 'Preparing…' : 'Export evidence'}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close outcome insights"
            className="rounded-sm border border-control p-2 text-ink-2 hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {exportMessage && (
        <p
          className={`mt-3 text-xs ${
            exportMessage.includes('failed') ? 'text-red-700' : 'text-ink'
          }`}
          role="status"
        >
          {exportMessage}
        </p>
      )}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-2" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading prospective cohorts…
        </div>
      ) : error || !data ? (
        <div
          className="mt-5 flex flex-col gap-3 border-t border-rule bg-white p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            Outcome evidence is temporarily unavailable.
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-sm border border-control px-2.5 py-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="workflow-insights-announcer"
          >
            {data.measurement_label}. {data.total_records.toLocaleString()}{' '}
            saved {data.total_records === 1 ? 'lead' : 'leads'} in prospective
            outcome evidence.
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              data-testid="workflow-insights-measurement-label"
              className={`rounded-sm px-2.5 py-1 text-xs font-semibold ${
                data.measurement_status === 'usable'
                  ? 'bg-white text-ink'
                  : data.measurement_status === 'directional'
                    ? 'bg-white text-ink'
                    : 'bg-white text-stale'
              }`}
            >
              {data.measurement_label}
            </span>
            <span className="text-xs text-ink-3">
              {data.event_history_records} of {data.total_records} leads have immutable
              event history
            </span>
            <span className="text-xs text-ink-3">
              {data.valid_saved_at_records} have a valid save-time baseline
            </span>
            {data.oldest_followup_days !== null && (
              <span className="text-xs text-ink-3">
                Follow-up: median {data.median_followup_days ?? 0} days · oldest{' '}
                {data.oldest_followup_days} days
              </span>
            )}
          </div>

          {data.total_records === 0 ? (
            <div
              className="mt-4 border-t border-rule bg-white p-5"
              data-testid="workflow-evidence-empty"
            >
              <h4 className="text-base font-semibold text-ink">
                No outcome cohort yet
              </h4>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-2">
                CityLens has not observed any saved leads in this workspace, so it
                cannot estimate your acquisition funnel yet. Build the evidence from
                real decisions, never from demo or synthetic outcomes.
              </p>
              <ol className="mt-4 divide-y divide-rule">
                {[
                  [
                    '1',
                    'Save ranked leads',
                    'Add parcels to the pipeline from the citywide explorer.',
                  ],
                  [
                    '2',
                    'Work the queue',
                    'Assign an owner and a dated next action for each live lead.',
                  ],
                  [
                    '3',
                    'Record outcomes',
                    'Update milestones as outreach, qualification, and deals progress.',
                  ],
                ].map(([number, title, description]) => (
                  <li
                    key={number}
                    className="border-b border-rule py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-3">
                        {number}
                      </span>
                      <span className="text-sm font-semibold text-ink">{title}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-3">
                      {description}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs leading-5 text-ink">
                The first maturity-qualified rate appears after 10 leads complete its
                observation window. Overall evidence remains “Collecting” until at
                least {data.minimum_cohort_size} leads are saved.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <div className="border-t border-rule bg-white p-3">
                <div className="font-cond text-[13px] text-ink-3">
                  Saved leads
                </div>
                <div className="mt-1 tabular-nums text-xl font-semibold">
                  {data.funnel.saved.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-ink-3">
                  {data.active_records} active · {data.archived_records} archived
                </div>
              </div>
              {data.maturity_windows.map((window) => (
                <div
                  key={window.milestone}
                  className="border-t border-rule bg-white p-3"
                  data-testid={`maturity-window-${window.milestone}`}
                >
                  <div className="font-cond text-[13px] text-ink-3">
                    {window.label}
                  </div>
                  <div className="mt-1 tabular-nums text-xl font-semibold">
                    {formatWindowRate(window)}
                  </div>
                  {window.sufficient_denominator && window.confidence_interval && (
                    <div className="mt-0.5 text-[11px] text-ink">
                      {formatConfidenceInterval(window.confidence_interval)}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-ink-3">
                    {window.reached_within_horizon.toLocaleString()} of{' '}
                    {window.eligible_records.toLocaleString()} mature
                    {window.pending_records > 0
                      ? ` · ${window.pending_records.toLocaleString()} pending`
                      : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.total_records > 0 && rankCohorts.length > 0 && (
            <div className="mt-4">
              <div className="font-cond mb-2 text-[13px] font-semibold text-ink-3">
                Fixed-horizon outcomes by saved rank
              </div>
              <div
                className="overflow-x-auto border-t border-rule focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-select"
                role="region"
                aria-label="Scrollable fixed-horizon outcomes by saved rank"
                tabIndex={0}
              >
                <p className="px-3 pt-3 text-[11px] leading-4 text-ink-3 md:hidden">
                  Scroll horizontally to review every cohort outcome.
                </p>
                <table className="w-full min-w-[620px] text-left text-xs tabular-nums [&_th:not(:first-child)]:text-right [&_td:not(:first-child)]:text-right">
                <thead className="bg-white text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-medium">Saved rank</th>
                    <th className="px-3 py-2 font-medium">Leads</th>
                    <th className="px-3 py-2 font-medium">Contacted ≤30d</th>
                    <th className="px-3 py-2 font-medium">Qualified ≤90d</th>
                    <th className="px-3 py-2 font-medium">Closed ≤365d</th>
                  </tr>
                </thead>
                <tbody>
                  {rankCohorts.map((cohort) => (
                    <tr key={cohort.value} className="border-t border-control">
                      <td className="px-3 py-2.5 font-medium text-ink">{cohort.value}</td>
                      <td className="px-3 py-2.5 text-ink-2">{cohort.total}</td>
                      <td className="px-3 py-2.5 text-ink-2">
                        {formatCohortRate(
                          cohort.contacted_rate,
                          cohort.contacted_rate_denominator,
                          data.minimum_rate_denominator,
                        )}
                        <span className="ml-1 text-ink-3">
                          n={cohort.contacted_rate_denominator}
                        </span>
                        {cohort.contacted_rate_denominator >=
                          data.minimum_rate_denominator &&
                          cohort.contacted_confidence_interval && (
                            <div className="mt-0.5 text-[10px] text-ink-3">
                              {formatConfidenceInterval(
                                cohort.contacted_confidence_interval,
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-3 py-2.5 text-ink-2">
                        {formatCohortRate(
                          cohort.qualified_rate,
                          cohort.qualified_rate_denominator,
                          data.minimum_rate_denominator,
                        )}
                        <span className="ml-1 text-ink-3">
                          n={cohort.qualified_rate_denominator}
                        </span>
                        {cohort.qualified_rate_denominator >=
                          data.minimum_rate_denominator &&
                          cohort.qualified_confidence_interval && (
                            <div className="mt-0.5 text-[10px] text-ink-3">
                              {formatConfidenceInterval(
                                cohort.qualified_confidence_interval,
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-3 py-2.5 text-ink-2">
                        {formatCohortRate(
                          cohort.close_rate,
                          cohort.close_rate_denominator,
                          data.minimum_rate_denominator,
                        )}
                        <span className="ml-1 text-ink-3">
                          n={cohort.close_rate_denominator}
                        </span>
                        {cohort.close_rate_denominator >=
                          data.minimum_rate_denominator &&
                          cohort.close_confidence_interval && (
                            <div className="mt-0.5 text-[10px] text-ink-3">
                              {formatConfidenceInterval(
                                cohort.close_confidence_interval,
                              )}
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}

          <p
            className="mt-3 text-xs leading-5 text-ink-3"
            data-testid="workflow-insights-maturity-boundary"
          >
            A lead enters each denominator only after its full 30, 90, 180, 270, or
            365-day observation window. Rates remain hidden as “Collecting” until that
            mature denominator reaches {data.minimum_rate_denominator}. Milestones use
            their first recorded timestamp; late backfills do not count as on-time
            outcomes. Archived leads remain in denominators so unfavorable outcomes
            cannot disappear.
            When a rate is shown, its 95% Wilson interval communicates the uncertainty
            around that estimate.
          </p>
        </>
      )}
    </section>
  );
}
