'use client';

import { formatBbl } from '@/lib/parcel-format';
import { useEffect, useState } from 'react';
import {
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
  urgent: 'border-rule bg-white text-ink',
  high: 'border-rule bg-white text-ink',
  medium: 'border-rule bg-white text-ink',
  low: 'border-rule bg-white text-ink-3',
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
      className="border-b border-rule bg-white px-4 py-5 text-ink md:px-7"
      aria-label="Evidence and watched parcel changes"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="mt-1 text-xl font-semibold">
            What changed since your team last looked?
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-3">
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
          className="self-end rounded-sm border border-control p-2 text-ink-3 hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:self-auto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-3" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Comparing watched leads with the current feed…
        </div>
      ) : error || !data ? (
        <div
          className="mt-5 flex flex-col gap-3 border-b border-rule bg-white p-4 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            Evidence changes are temporarily unavailable.
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-sm border border-rule px-2.5 py-1.5 text-xs"
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
                className="border-b border-rule py-3"
              >
                <div className="font-cond text-[13px] text-ink-3">
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
              className="mt-4 flex gap-3 border-b border-rule bg-white p-4 text-sm text-ink"
              data-testid="watchlist-exit-coverage"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
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
              className="mt-4 flex gap-3 border-b border-rule py-4 text-sm text-stale"
              data-testid="stale-evidence-review-summary"
            >
              <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
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
              className="mt-4 flex gap-3 border-b border-rule bg-white p-4 text-sm text-ink"
              data-testid="open-evidence-issue-summary"
            >
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
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
            <div className="mt-4 border-b border-rule bg-white p-4 text-sm text-ink">
              No decision-relevant differences, stale reviewed evidence versions,
              or open source reports were found against the current eligible feed.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-rule">
              {data.alerts.map((alert, index) => (
                <article
                  key={`${alert.bbl}-${alert.code}-${index}`}
                  className={`py-4 ${SEVERITY_STYLES[alert.severity]}`}
                  data-testid={`watchlist-alert-${alert.bbl}-${alert.code}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-ink-3">
                        {alert.severity} · BBL {formatBbl(alert.bbl)}
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-ink">
                        {alert.title}
                      </h4>
                    </div>
                    {alert.parcel_available !== false &&
                      alert.code !== 'removed_from_current_feed' && (
                      <button
                        type="button"
                        onClick={() => onSelectParcel(alert.bbl)}
                        className="shrink-0 rounded-sm border border-rule px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-white"
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
                  <p className="mt-2 text-xs leading-5">{alert.detail}</p>
                  {alert.parcel_available !== false &&
                    alert.code !== 'removed_from_current_feed' &&
                    alert.code !== 'reviewed_evidence_changed' &&
                    alert.code !== 'evidence_issue_submitted' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1">
                        Saved: {formatValue(alert.before)}
                      </span>
                      <span aria-hidden="true">→</span>
                      <span className="px-2 py-1">
                        Current: {formatValue(alert.after)}
                      </span>
                    </div>
                  )}

                  {(alert.evidence_changes?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-2">
                      {alert.evidence_changes?.map((change) => (
                        <div
                          key={change.check_key}
                          className="border-b border-rule py-3"
                          data-testid={`stale-evidence-review-${alert.bbl}-${change.check_key}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="mt-0.5 text-xs font-semibold text-ink">
                                {change.label}
                              </div>
                            </div>
                            <div className="text-xs text-ink-3">
                              Reviewed {formatReviewedAt(change.reviewed_at)}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="border-b border-rule bg-white p-2.5">
                              <div className="font-cond text-[13px] text-ink-3">
                                Reviewed version
                              </div>
                              <div className="mt-1 text-xs font-semibold text-ink">
                                {humanizeCode(change.reviewed_status)}
                              </div>
                              <div className="mt-0.5 font-mono text-xs leading-4 text-ink-3">
                                {change.reviewed_source} · as of{' '}
                                {formatAsOf(change.reviewed_source_as_of)}
                              </div>
                            </div>
                            <div className="border-b border-rule bg-white p-2.5">
                              <div className="font-cond text-[13px] text-ink">
                                Current version
                              </div>
                              <div className="mt-1 text-xs font-semibold text-ink">
                                {change.current_status
                                  ? humanizeCode(change.current_status)
                                  : 'Not currently available'}
                              </div>
                              <div className="mt-0.5 font-mono text-xs leading-4 text-ink-3">
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
                                className="px-2 py-1 text-xs font-medium text-ink"
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
                      className="mt-3 border-b border-rule bg-white p-3"
                      data-testid={`open-evidence-issue-${alert.bbl}-${alert.evidence_issue.check_key}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-cond text-[13px] font-semibold text-ink">
                          Private governance request
                        </div>
                        <div className="text-xs text-ink">
                          Submitted{' '}
                          {formatReviewedAt(
                            alert.evidence_issue.submitted_at,
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-ink">
                        {alert.evidence_issue.issue_type ===
                        'suppression_review'
                          ? 'Suppression review'
                          : 'Correction review'}{' '}
                        · {humanizeCode(alert.evidence_issue.reason_code)}
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-ink">
                        {alert.evidence_issue.note}
                      </p>
                      <div className="mt-2 border-b border-rule bg-white px-2.5 py-2 text-xs leading-4 text-ink-3">
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
                          className="px-2 py-1 text-xs font-medium text-ink"
                        >
                          {humanizeCode(reason)}
                        </span>
                      ))}
                    </div>
                  )}

                  {(alert.source_evidence?.length ?? 0) > 0 && (
                    <div
                      className="mt-3 border-b border-rule bg-white p-3"
                      data-testid={`watchlist-sources-${alert.bbl}`}
                    >
                      <div className="font-cond text-[13px] font-semibold text-ink-3">
                        Current source evidence
                      </div>
                      <ul className="mt-2 space-y-2">
                        {alert.source_evidence?.map((evidence, evidenceIndex) => (
                          <li
                            key={`${evidence.source}-${evidence.supports}-${evidenceIndex}`}
                            className="flex flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                          >
                            <span>
                              <span className="font-semibold text-ink">
                                {evidence.source}
                              </span>{' '}
                              <span className="text-ink-3">
                                · as of {formatAsOf(evidence.as_of)} ·{' '}
                                {humanizeCode(evidence.supports)}
                              </span>
                            </span>
                            {isSafeOfficialUrl(evidence.url) && (
                              <a
                                href={evidence.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex shrink-0 items-center gap-1 font-medium text-ink underline decoration-rule underline-offset-2 hover:text-ink"
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
                      className="mt-3 border-b border-rule bg-white p-3 text-xs leading-5 text-ink-3"
                      data-testid={`watchlist-next-action-${alert.bbl}`}
                    >
                      <span className="font-semibold text-ink">Recommended next step:</span>{' '}
                      {alert.recommended_action}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {data.warnings.map((warning) => (
            <p key={warning} className="mt-3 text-xs leading-5 text-ink">
              {warning}
            </p>
          ))}
          <p className="mt-3 font-mono text-xs text-ink-3">Private watchlist as of {data.generated_at}</p>
          <p className="mt-3 font-mono text-xs text-ink-3">
            Current feed: {data.feed_generated_at ?? 'date unavailable'}.
            Rank alerts require a move of at least 100 citywide places. Evidence
            reviews are exact-version markers, never completed-diligence claims.
          </p>
        </>
      )}
    </section>
  );
}
