'use client';

import { useEffect, useState } from 'react';
import {
  BellRing,
  ExternalLink,
  FileClock,
  Flag,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
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
  if (Array.isArray(value)) {
    return value.length ? value.map(formatValue).join(', ') : 'None';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== '')
      .slice(0, 4);
    if (!entries.length) return 'Not recorded';
    return entries
      .map(
        ([key, item]) =>
          `${humanizeCode(key)}: ${formatValue(item)}`,
      )
      .join(' · ');
  }
  return String(value);
}

function humanizeCode(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatAsOf(value: string | null): string {
  if (!value) return 'date unavailable';
  const dateOnly = value.slice(0, 10);
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatReviewedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
}

function isSafeOfficialUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
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
      id="parcel-evidence-changes"
      className="border-b border-slate-200 bg-slate-950 px-4 py-5 text-white md:px-7"
      aria-label="Evidence and watched parcel changes"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
            <BellRing className="h-4 w-4" />
            Evidence change center
          </div>
          <h3 className="mt-1 text-xl font-semibold">
            What changed since your team last looked?
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Private comparisons for watched baselines and exact reviewed evidence
            versions. Alerts identify records that need another look; they do not
            assert cleared diligence, seller intent, or a completed transaction.
          </p>
        </div>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Close evidence changes"
          className="self-end rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:self-auto"
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
        <div
          className="mt-5 flex flex-col gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            Evidence changes are temporarily unavailable.
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
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="workflow-alerts-announcer"
          >
            {data.alert_count.toLocaleString()} evidence-change{' '}
            {data.alert_count === 1 ? 'alert' : 'alerts'} loaded across{' '}
            {data.watched_count.toLocaleString()} watched{' '}
            {data.watched_count === 1 ? 'lead' : 'leads'}.
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
            {[
              ['Watched leads', data.watched_count],
              ['Leads changed', data.changed_lead_count],
              ['Stale reviews', data.stale_review_count ?? 0],
              ['Open reports', data.open_issue_count ?? 0],
              ['Explained exits', data.resolved_exit_count ?? 0],
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

          {(data.resolved_exit_count ?? 0) > 0 && (
            <div
              className="mt-4 flex gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-50"
              data-testid="watchlist-exit-coverage"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p>
                <strong>
                  {data.resolved_exit_count?.toLocaleString()} feed{' '}
                  {data.resolved_exit_count === 1 ? 'exit has' : 'exits have'} a
                  current screening explanation.
                </strong>{' '}
                Review the cited official record before changing a lead&apos;s
                disposition.
              </p>
            </div>
          )}

          {(data.stale_review_count ?? 0) > 0 && (
            <div
              className="mt-4 flex gap-3 rounded-xl border border-sky-400/25 bg-sky-400/10 p-4 text-sm text-sky-50"
              data-testid="stale-evidence-review-summary"
            >
              <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <p>
                <strong>
                  {data.stale_review_count?.toLocaleString()} reviewed evidence{' '}
                  {data.stale_review_count === 1 ? 'version is' : 'versions are'} no
                  longer current.
                </strong>{' '}
                Re-open each parcel to review the new citation. A new marker records
                consideration of that version; it does not clear the underlying
                diligence question.
              </p>
            </div>
          )}

          {(data.open_issue_count ?? 0) > 0 && (
            <div
              className="mt-4 flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-50"
              data-testid="open-evidence-issue-summary"
            >
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p>
                <strong>
                  {data.open_issue_count?.toLocaleString()} private source{' '}
                  {data.open_issue_count === 1 ? 'report is' : 'reports are'} awaiting
                  CityLens review.
                </strong>{' '}
                Reported official values remain visible until a governed source
                update is resolved and published.
              </p>
            </div>
          )}

          {data.alerts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              No decision-relevant differences, stale reviewed evidence versions,
              or open source reports were found against the current eligible feed.
            </div>
          ) : (
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {data.alerts.map((alert, index) => (
                <article
                  key={`${alert.bbl}-${alert.code}-${index}`}
                  className={`rounded-xl border p-4 ${SEVERITY_STYLES[alert.severity]}`}
                  data-testid={`watchlist-alert-${alert.bbl}-${alert.code}`}
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
                    {alert.parcel_available !== false &&
                      alert.code !== 'removed_from_current_feed' && (
                      <button
                        type="button"
                        onClick={() => onSelectParcel(alert.bbl)}
                        className="shrink-0 rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                      >
                        {alert.code === 'reviewed_evidence_changed'
                          ? alert.review_recordable === false
                            ? 'Open evidence'
                            : 'Review evidence'
                          : alert.code === 'evidence_issue_submitted'
                            ? 'Inspect request'
                          : 'Open parcel'}
                      </button>
                      )}
                  </div>
                  <p className="mt-2 text-xs leading-5 opacity-90">{alert.detail}</p>
                  {alert.parcel_available !== false &&
                    alert.code !== 'removed_from_current_feed' &&
                    alert.code !== 'reviewed_evidence_changed' &&
                    alert.code !== 'evidence_issue_submitted' && (
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

                  {(alert.evidence_changes?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-2">
                      {alert.evidence_changes?.map((change) => (
                        <div
                          key={change.check_key}
                          className="rounded-lg border border-white/10 bg-black/20 p-3"
                          data-testid={`stale-evidence-review-${alert.bbl}-${change.check_key}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200">
                                Exact version comparison
                              </div>
                              <div className="mt-0.5 text-xs font-semibold text-white">
                                {change.label}
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-300">
                              Reviewed {formatReviewedAt(change.reviewed_at)}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-md border border-white/10 bg-white/5 p-2.5">
                              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                Reviewed version
                              </div>
                              <div className="mt-1 text-xs font-semibold text-white">
                                {humanizeCode(change.reviewed_status)}
                              </div>
                              <div className="mt-0.5 text-[11px] leading-4 text-slate-300">
                                {change.reviewed_source} · as of{' '}
                                {formatAsOf(change.reviewed_source_as_of)}
                              </div>
                            </div>
                            <div className="rounded-md border border-sky-300/20 bg-sky-300/10 p-2.5">
                              <div className="text-[10px] uppercase tracking-wide text-sky-200">
                                Current version
                              </div>
                              <div className="mt-1 text-xs font-semibold text-white">
                                {change.current_status
                                  ? humanizeCode(change.current_status)
                                  : 'Not currently available'}
                              </div>
                              <div className="mt-0.5 text-[11px] leading-4 text-slate-200">
                                {change.current_source
                                  ? `${change.current_source} · as of ${formatAsOf(
                                      change.current_source_as_of,
                                    )}`
                                  : 'The current published parcel evidence could not be matched.'}
                              </div>
                            </div>
                          </div>
                          <div
                            className="mt-2 flex flex-wrap gap-1.5"
                            aria-label={`${change.label} version changes`}
                          >
                            {change.change_reasons.map((reason) => (
                              <span
                                key={reason}
                                className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-[10px] font-medium text-sky-100"
                              >
                                {reason === 'feed_generation'
                                  ? 'New feed generation'
                                  : humanizeCode(reason)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {alert.evidence_issue && (
                    <div
                      className="mt-3 rounded-lg border border-amber-200/20 bg-amber-200/10 p-3"
                      data-testid={`open-evidence-issue-${alert.bbl}-${alert.evidence_issue.check_key}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                          Private governance request
                        </div>
                        <div className="text-[10px] text-amber-100/80">
                          Submitted{' '}
                          {formatReviewedAt(
                            alert.evidence_issue.submitted_at,
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {alert.evidence_issue.issue_type ===
                        'suppression_review'
                          ? 'Suppression review'
                          : 'Correction review'}{' '}
                        · {humanizeCode(alert.evidence_issue.reason_code)}
                      </div>
                      <p className="mt-1.5 text-[11px] leading-5 text-amber-50/90">
                        {alert.evidence_issue.note}
                      </p>
                      <div className="mt-2 rounded-md border border-white/10 bg-black/15 px-2.5 py-2 text-[10px] leading-4 text-slate-200">
                        Reported citation: {alert.evidence_issue.source} · as of{' '}
                        {formatAsOf(alert.evidence_issue.source_as_of)}. The
                        request does not edit or suppress this record while
                        review is pending.
                      </div>
                    </div>
                  )}

                  {(alert.reason_codes?.length ?? 0) > 0 && (
                    <div
                      className="mt-3 flex flex-wrap gap-1.5"
                      aria-label="Current screening reasons"
                    >
                      {alert.reason_codes?.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[10px] font-medium text-white"
                        >
                          {humanizeCode(reason)}
                        </span>
                      ))}
                    </div>
                  )}

                  {(alert.source_evidence?.length ?? 0) > 0 && (
                    <div
                      className="mt-3 rounded-lg border border-white/10 bg-black/15 p-3"
                      data-testid={`watchlist-sources-${alert.bbl}`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                        Current source evidence
                      </div>
                      <ul className="mt-2 space-y-2">
                        {alert.source_evidence?.map((evidence, evidenceIndex) => (
                          <li
                            key={`${evidence.source}-${evidence.supports}-${evidenceIndex}`}
                            className="flex flex-col gap-0.5 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                          >
                            <span>
                              <span className="font-semibold text-white">
                                {evidence.source}
                              </span>{' '}
                              <span className="text-slate-300">
                                · as of {formatAsOf(evidence.as_of)} ·{' '}
                                {humanizeCode(evidence.supports)}
                              </span>
                            </span>
                            {isSafeOfficialUrl(evidence.url) && (
                              <a
                                href={evidence.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex shrink-0 items-center gap-1 font-medium text-sky-200 underline decoration-sky-300/40 underline-offset-2 hover:text-white"
                              >
                                Official record
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {alert.recommended_action && (
                    <div
                      className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-100"
                      data-testid={`watchlist-next-action-${alert.bbl}`}
                    >
                      <span className="font-semibold text-white">Recommended next step:</span>{' '}
                      {alert.recommended_action}
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
            Rank alerts require a move of at least 100 citywide places. Evidence
            reviews are exact-version markers, never completed-diligence claims.
          </p>
        </>
      )}
    </section>
  );
}
