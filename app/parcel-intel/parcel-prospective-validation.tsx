import { Activity, Clock3, ShieldCheck } from 'lucide-react';
import type {
  ParcelProspectiveValidationHealth,
  ParcelProspectiveValidationMetric,
  ParcelProspectiveValidationStatus,
} from '@/lib/api';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'an unavailable date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatPercent(value: number): string {
  const precision = value >= 0.1 ? 1 : 2;
  return `${(value * 100).toFixed(precision)}%`;
}

function observedMetric(
  metric: ParcelProspectiveValidationMetric,
): string {
  if (
    metric.observed_nb_filing_hits === null ||
    metric.observed_precision_lower_bound === null
  ) {
    return 'not yet observable';
  }
  return `${metric.observed_nb_filing_hits} filing${
    metric.observed_nb_filing_hits === 1 ? '' : 's'
  } · ${formatPercent(metric.observed_precision_lower_bound)} lower bound`;
}

function matureMetric(
  metric: ParcelProspectiveValidationMetric,
): string {
  if (
    metric.final_precision === null ||
    metric.final_precision_95ci === null
  ) {
    return 'final result unavailable';
  }
  return `${formatPercent(metric.final_precision)} (95% CI ${formatPercent(
    metric.final_precision_95ci[0],
  )}–${formatPercent(metric.final_precision_95ci[1])})`;
}

function FreshnessNote({
  health,
  className,
}: {
  health: ParcelProspectiveValidationHealth | null | undefined;
  className: string;
}) {
  if (
    health?.status !== 'current' ||
    health.observation_lag_days === null ||
    health.next_monitor_due_on === null ||
    health.oldest_official_source_updated_at === null
  ) {
    return null;
  }
  return (
    <p className={`mt-2 text-[11px] leading-4 ${className}`}>
      Weekly evidence monitor current · {health.observation_lag_days}-day
      observation lag · freshness deadline{' '}
      {formatDate(health.next_monitor_due_on)}. Oldest official source update{' '}
      {formatDate(health.oldest_official_source_updated_at)}.
    </p>
  );
}

export function ParcelProspectiveValidation({
  status,
  health,
}: {
  status: ParcelProspectiveValidationStatus | null;
  health?: ParcelProspectiveValidationHealth | null;
}) {
  if (
    !status ||
    health?.status === 'unavailable'
  ) {
    return (
      <section
        className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        data-testid="prospective-validation-status"
        data-status="unavailable"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <Clock3 className="h-4 w-4" />
          Live cohort status unavailable
        </h3>
        <p className="mt-2 text-xs leading-5 text-amber-900">
          The historical forward test remains available, but the live
          production cohort could not be matched to this feed. Do not infer
          current accuracy from the historical percentages.
        </p>
      </section>
    );
  }

  if (health?.status === 'stale') {
    return (
      <section
        className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        data-testid="prospective-validation-status"
        data-status="stale"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <Clock3 className="h-4 w-4" />
          Live cohort monitor overdue
        </h3>
        <p className="mt-2 text-xs leading-5 text-amber-900">
          Evidence has not advanced for{' '}
          {health.observation_lag_days?.toLocaleString() ?? 'an unknown number of'}{' '}
          days; the weekly freshness limit is{' '}
          {health.max_observation_lag_days} days. The last accepted observation
          date is {formatDate(status.observed_through)}.
        </p>
        <p className="mt-2 text-[11px] leading-4 text-amber-800">
          Historical validation remains available, but live cohort metrics are
          stale and must not be treated as current accuracy. Investigate the
          monitor or official DOB source before relying on them.
        </p>
      </section>
    );
  }

  if (status.measurement_status === 'awaiting_post_issue_data') {
    return (
      <section
        className="rounded-xl border border-sky-200 bg-sky-50 p-4"
        data-testid="prospective-validation-status"
        data-status={status.measurement_status}
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-950">
          <Clock3 className="h-4 w-4" />
          Live cohort · awaiting observations
        </h3>
        <p className="mt-2 text-xs leading-5 text-sky-900">
          The exact top 1,000 issued {formatDate(status.issued_at)} starts
          observation {formatDate(status.observation_starts_on)}. Official DOB
          data is currently observed through {formatDate(status.observed_through)}.
          Live precision is intentionally unavailable—not 0%.
        </p>
        <p className="mt-2 text-[11px] leading-4 text-sky-800">
          Final 365-day results become eligible after {formatDate(status.matures_at)}.
        </p>
        <FreshnessNote health={health} className="text-sky-800" />
      </section>
    );
  }

  if (status.measurement_status === 'collecting') {
    return (
      <section
        className="rounded-xl border border-sky-200 bg-sky-50 p-4"
        data-testid="prospective-validation-status"
        data-status={status.measurement_status}
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-950">
          <Activity className="h-4 w-4" />
          Live cohort · collecting
        </h3>
        <dl className="mt-2 space-y-1 text-xs leading-5 text-sky-900">
          <div className="flex justify-between gap-3">
            <dt>Top 100 so far</dt>
            <dd className="font-medium">{observedMetric(status.metrics.top_100)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Top 1,000 so far</dt>
            <dd className="font-medium">
              {observedMetric(status.metrics.top_1000)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-4 text-sky-800">
          Observed through {formatDate(status.observed_through)}. These are
          lower bounds, not final accuracy; unobserved parcels are not counted
          as negatives before {formatDate(status.matures_at)}.
        </p>
        <FreshnessNote health={health} className="text-sky-800" />
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
      data-testid="prospective-validation-status"
      data-status={status.measurement_status}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
        <ShieldCheck className="h-4 w-4" />
        Live cohort · complete
      </h3>
      <dl className="mt-2 space-y-1 text-xs leading-5 text-emerald-900">
        <div className="flex justify-between gap-3">
          <dt>Top 100</dt>
          <dd className="font-medium">{matureMetric(status.metrics.top_100)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Top 1,000</dt>
          <dd className="font-medium">
            {matureMetric(status.metrics.top_1000)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-4 text-emerald-800">
        Complete 365-day DOB New Building filing outcome window. This is not
        seller intent, acquisition, or closing probability.
      </p>
      <FreshnessNote health={health} className="text-emerald-800" />
    </section>
  );
}
