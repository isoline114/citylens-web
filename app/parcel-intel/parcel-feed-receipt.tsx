import {
  Activity,
  BadgeCheck,
  CircleAlert,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import type {
  ParcelProspectiveValidationHealth,
  ParcelProspectiveValidationStatus,
} from '@/lib/api';

type UnknownRecord = Record<string, unknown>;

export type ParcelFeedReceiptProps = {
  qualityGate?: UnknownRecord;
  dataSources?: UnknownRecord;
  modelMetadata?: UnknownRecord;
  prospectiveValidation?: ParcelProspectiveValidationStatus | null;
  prospectiveValidationHealth?: ParcelProspectiveValidationHealth | null;
  generatedLabel: string;
  evaluatedAt?: number;
};

type Receipt = {
  passed: boolean | null;
  evaluated: number | null;
  published: number | null;
  screenedOut: number | null;
  belowCutoff: number | null;
  blockingProjects: number | null;
  joinedProjects: number | null;
  projectLeakage: number | null;
  padAddresses: number | null;
  plutoAddresses: number | null;
  currentSources: number;
  staleSources: number;
  historicalPrecisionAt100: number | null;
  historicalPrecisionAt1000: number | null;
  historicalBaseRate: number | null;
  historicalEvidenceStatus: string | null;
  selectionPolicy: string | null;
  selectionMinimumPerBorough: number | null;
  selectionPureMeritOverlap: number | null;
  prospectiveStatus: ParcelProspectiveValidationStatus['measurement_status'] | null;
  prospectiveIssuedAt: string | null;
  prospectiveObservedThrough: string | null;
  prospectiveMaturesAt: string | null;
  prospectiveHealth: ParcelProspectiveValidationHealth['status'] | null;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
}

function ratio(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

function formatLift(value: number | null, baseRate: number | null): string {
  if (value === null || baseRate === null || baseRate <= 0) return '—';
  return `${Math.round(value / baseRate).toLocaleString('en-US')}×`;
}

function formatUtcDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function parcelFeedReceipt(
  qualityGate: UnknownRecord = {},
  dataSources: UnknownRecord = {},
  modelMetadata: UnknownRecord = {},
  prospectiveValidation: ParcelProspectiveValidationStatus | null = null,
  prospectiveValidationHealth: ParcelProspectiveValidationHealth | null = null,
): Receipt {
  const screening = record(qualityGate.screening_ledger);
  const landUse = record(qualityGate.land_use_reconciliation);
  const addresses = record(qualityGate.address_identity);
  const selection = record(qualityGate.selection_policy);
  const evaluationEvidence = record(modelMetadata.evaluation_evidence);
  const sources = Object.values(dataSources).filter(
    (value) => Object.keys(record(value)).length > 0,
  );

  return {
    passed:
      qualityGate.passed === true
        ? true
        : Object.keys(qualityGate).length > 0
          ? false
          : null,
    evaluated: count(screening.evaluated_candidate_count),
    published:
      count(screening.published_candidate_count) ??
      count(qualityGate.citywide_acquisition_eligible_count),
    screenedOut: count(screening.screened_out_count),
    belowCutoff: count(screening.eligible_below_cutoff_count),
    blockingProjects: count(landUse.blocking_project_count),
    joinedProjects: count(landUse.joined_blocking_project_count),
    projectLeakage: count(landUse.published_leakage_count),
    padAddresses: count(addresses.pad_enriched_count),
    plutoAddresses: count(addresses.pluto_address_count),
    currentSources: sources.filter((value) => record(value).stale !== true)
      .length,
    staleSources: sources.filter((value) => record(value).stale === true)
      .length,
    historicalPrecisionAt100: ratio(modelMetadata.precision_at_100),
    historicalPrecisionAt1000: ratio(modelMetadata.precision_at_1000),
    historicalBaseRate: ratio(modelMetadata.spatial_cv_base_rate),
    historicalEvidenceStatus:
      typeof evaluationEvidence.status === 'string'
        ? evaluationEvidence.status
        : null,
    selectionPolicy:
      typeof selection.policy_id === 'string' ? selection.policy_id : null,
    selectionMinimumPerBorough: count(selection.minimum_per_borough),
    selectionPureMeritOverlap: ratio(
      selection.pure_citywide_overlap_fraction,
    ),
    prospectiveStatus: prospectiveValidation?.measurement_status ?? null,
    prospectiveIssuedAt: prospectiveValidation?.issued_at ?? null,
    prospectiveObservedThrough:
      prospectiveValidation?.observed_through ?? null,
    prospectiveMaturesAt: prospectiveValidation?.matures_at ?? null,
    prospectiveHealth: prospectiveValidationHealth?.status ?? null,
  };
}

function HistoricalEvidence({ receipt }: { receipt: Receipt }) {
  const hasMetrics =
    receipt.historicalPrecisionAt100 !== null &&
    receipt.historicalPrecisionAt1000 !== null &&
    receipt.historicalBaseRate !== null;
  const exposed = receipt.historicalEvidenceStatus === 'development_exposed';

  return (
    <div
      className="border-t border-rule py-3"
      data-testid="historical-ranking-evidence"
    >
      <div className="font-cond text-[13px] font-semibold text-ink-3">
        Historical rank
      </div>
      {hasMetrics ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              ['Top 100', formatPercent(receipt.historicalPrecisionAt100)],
              ['Top 1,000', formatPercent(receipt.historicalPrecisionAt1000)],
              ['NYC base', formatPercent(receipt.historicalBaseRate)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-l border-rule px-2 py-1.5"
              >
                <div className="font-cond text-[13px] font-semibold text-ink-3">
                  {label}
                </div>
                <div className="mt-0.5 text-xs font-semibold tabular-nums text-ink">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-medium leading-4 text-ink">
            {formatLift(
              receipt.historicalPrecisionAt100,
              receipt.historicalBaseRate,
            )}{' '}
            top-100 enrichment ·{' '}
            {formatLift(
              receipt.historicalPrecisionAt1000,
              receipt.historicalBaseRate,
            )}{' '}
            top-1,000
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs font-semibold leading-5 text-ink">
          Historical forward-ranking evidence is unavailable.
        </p>
      )}
      <p className="mt-1 text-[11px] leading-4 text-ink-3">
        2024 features → 2025 DOB NB filings
        {exposed ? ' · development-exposed benchmark' : ''}. Historical
        enrichment is not current parcel accuracy, seller intent, or deal
        probability.
      </p>
    </div>
  );
}

function CurrentQualification({ receipt }: { receipt: Receipt }) {
  return (
    <div className="border-t border-rule py-3">
      <div className="font-cond text-[13px] font-semibold text-ink-3">
        Current qualification
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-ink">
        {formatCount(receipt.screenedOut)} candidates removed before{' '}
        {formatCount(receipt.published)} leads were surfaced.
      </p>
      <p className="mt-1 text-[11px] leading-4 text-ink-3">
        {formatCount(receipt.joinedProjects)} current DOB/ZAP projects
        reconciled · {formatCount(receipt.projectLeakage)} published project
        leaks.
        {receipt.selectionPolicy === 'borough_floor_250' &&
          receipt.selectionMinimumPerBorough !== null &&
          ` ${formatCount(
            receipt.selectionMinimumPerBorough,
          )}-lead borough floor${
            receipt.selectionPureMeritOverlap !== null
              ? ` · ${formatPercent(
                  receipt.selectionPureMeritOverlap,
                )} pure-merit overlap`
              : ''
          }.`}{' '}
        Membership gate only; it does not retrain the rank.
      </p>
    </div>
  );
}

function LiveOutcomeEvidence({ receipt }: { receipt: Receipt }) {
  const current = receipt.prospectiveHealth === 'current';
  const mature = receipt.prospectiveStatus === 'mature';
  const collecting = receipt.prospectiveStatus === 'collecting';
  const awaiting = receipt.prospectiveStatus === 'awaiting_post_issue_data';
  const headline = mature
    ? 'The 365-day production outcome window is complete.'
    : collecting
      ? `Official DOB outcomes observed through ${formatUtcDate(
          receipt.prospectiveObservedThrough,
        )}.`
      : awaiting
        ? 'The exact production cohort is awaiting post-issue DOB data.'
        : 'Production outcome evidence is unavailable.';

  return (
    <div className="border-t border-rule py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-cond text-[13px] font-semibold text-ink-3">
          Live outcomes
        </div>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${
            current
              ? 'bg-paper-2 text-ink'
              : 'bg-white text-ink'
          }`}
        >
          {current ? 'Monitor current' : 'Inspect monitor'}
        </span>
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-ink">
        {headline}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-ink-3">
        Cohort issued {formatUtcDate(receipt.prospectiveIssuedAt)} · final
        eligibility {formatUtcDate(receipt.prospectiveMaturesAt)}. Until then,
        current precision is intentionally not claimed.
      </p>
    </div>
  );
}

function ReceiptBody({
  receipt,
  generatedLabel,
}: {
  receipt: Receipt;
  generatedLabel: string;
}) {
  if (receipt.passed !== true) {
    return (
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
        <div>
          <p className="text-sm font-semibold text-ink">
            Qualification receipt unavailable
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-3">
            Treat this feed as unverified until its project-leakage, rank, and
            source-coverage checks publish successfully.
          </p>
        </div>
      </div>
    );
  }

  const projectCoverage =
    receipt.blockingProjects !== null &&
    receipt.joinedProjects !== null
      ? `${formatCount(receipt.joinedProjects)} / ${formatCount(
          receipt.blockingProjects,
        )}`
      : '—';

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-cond flex items-center gap-2 text-[13px] font-semibold text-ink-3">
            <BadgeCheck className="h-3.5 w-3.5" />
            Qualification receipt
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-ink">
            {formatCount(receipt.published)} leads surfaced after current-source
            screening.
          </p>
        </div>
        <span className="shrink-0 rounded-sm bg-paper-2 px-2 py-1 text-[11px] font-semibold text-ink ring-1 ring-inset ring-rule">
          Passed
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ['Evaluated', formatCount(receipt.evaluated)],
          ['Screened out', formatCount(receipt.screenedOut)],
          ['Project leaks', formatCount(receipt.projectLeakage)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-l border-rule px-2.5 py-2"
          >
            <div className="font-cond text-[13px] font-semibold text-ink-3">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="font-cond mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-3">
          <Activity className="h-3 w-3" />
          Intelligence evidence chain
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          <HistoricalEvidence receipt={receipt} />
          <CurrentQualification receipt={receipt} />
          <LiveOutcomeEvidence receipt={receipt} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-rule pt-2.5 text-[11px] leading-4 text-ink-3">
        <span>ZAP projects mapped {projectCoverage}</span>
        <span aria-hidden="true" className="text-ink-3">
          ·
        </span>
        <span>
          {formatCount(receipt.belowCutoff)} qualified below cutoff
        </span>
        {receipt.selectionPolicy && (
          <>
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
            <span>
              Selection {receipt.selectionPolicy.replaceAll('_', ' ')}
            </span>
          </>
        )}
        <span aria-hidden="true" className="text-ink-3">
          ·
        </span>
        <span>
          {receipt.currentSources} current source
          {receipt.currentSources === 1 ? '' : 's'}
          {receipt.staleSources > 0
            ? ` · ${receipt.staleSources} stale`
            : ''}
        </span>
        {(receipt.padAddresses !== null ||
          receipt.plutoAddresses !== null) && (
          <>
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
            <span>
              Address provenance {formatCount(receipt.padAddresses)} PAD /{' '}
              {formatCount(receipt.plutoAddresses)} PLUTO
            </span>
          </>
        )}
        {generatedLabel && (
          <>
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
            <span>Refreshed {generatedLabel}</span>
          </>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-ink-3">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
        This receipt validates feed eligibility and source reconciliation. It
        is not model accuracy, seller intent, transaction probability, or a
        substitute for diligence.
      </p>
    </>
  );
}

function ReceiptSummary({ receipt }: { receipt: Receipt }) {
  const verified = receipt.passed === true;
  const Icon = verified ? BadgeCheck : CircleAlert;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Icon className={`h-4 w-4 shrink-0 ${receipt.staleSources > 0 ? 'text-stale' : 'text-ink'}`} />
      <span className="font-medium">Sources · {receipt.staleSources > 0 ? `${receipt.staleSources} past limit` : 'Receipt'}</span>
      <span className="sr-only">Qualification receipt</span>
      <span className={verified ? 'sr-only' : 'font-semibold text-ink'}>
        {verified ? 'Passed' : 'Unverified feed'}
      </span>
      <ChevronDown className="ml-auto h-3.5 w-3.5 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
    </span>
  );
}

type SourceCurrency = { key: string; source: string; age: number | null; limit: number | null; pastLimit: boolean; unchecked: boolean; asOf: string | null };

function sourceCurrency(dataSources: UnknownRecord, now?: number): SourceCurrency[] {
  return Object.entries(dataSources).flatMap(([key, value]) => {
    const source = record(value);
    if (!Object.keys(source).length) return [];
    const retrieved = [source.retrieved_at, source.source_retrieved_at, source.as_of].find((value): value is string => typeof value === 'string');
    const timestamp = retrieved ? Date.parse(retrieved) : NaN;
    // Compare the exact age with the limit; round only for display. For sources
    // with a refresh limit, an explicit stale flag from the API always wins, and
    // a missing age means unchecked rather than current. Historical sources
    // without a limit never become operational warnings.
    const exactAge = now !== undefined && Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 86_400_000) : count(source.age_days);
    const age = exactAge === null ? null : Math.floor(exactAge);
    const limit = count(source.max_age_days);
    const limited = limit !== null && limit > 0;
    const pastLimit = limited && (source.stale === true || (exactAge !== null && exactAge > limit));
    return [{ key, source: typeof source.source === 'string' ? source.source : key.replaceAll('_', ' '), age, limit,
      pastLimit,
      unchecked: limited && !pastLimit && exactAge === null,
      asOf: retrieved ?? (typeof source.baseline_year === 'number' ? String(source.baseline_year) : null) }];
  });
}

export function ParcelFeedReceipt({
  qualityGate = {},
  dataSources = {},
  modelMetadata = {},
  prospectiveValidation = null,
  prospectiveValidationHealth = null,
  generatedLabel,
  evaluatedAt,
}: ParcelFeedReceiptProps) {
  const receipt = parcelFeedReceipt(
    qualityGate,
    dataSources,
    modelMetadata,
    prospectiveValidation,
    prospectiveValidationHealth,
  );

  const sources = sourceCurrency(dataSources, evaluatedAt);
  const overdue = sources.filter((source) => source.pastLimit);
  const unchecked = sources.filter((source) => source.unchecked);
  receipt.staleSources = overdue.length;
  receipt.currentSources = sources.length - overdue.length - unchecked.length;
  const warning = overdue.length > 0
    ? `Freshness warning: ${overdue.map((source) => `${source.source}${source.age === null ? '' : ` (${source.age} days old)`}`).join(', ')}. Verify the latest city records before acquisition diligence.`
    : '';

  return (
    <details
      className="group relative min-w-0 justify-self-end"
      aria-label="Current shortlist qualification receipt"
      data-testid="parcel-feed-receipt"
    >
      <summary aria-label={`Qualification receipt ${receipt.passed === true ? 'Passed' : 'Unverified feed'}${warning ? `. ${warning}` : ''}`} title={warning || 'Current shortlist qualification receipt'} className={`cursor-pointer list-none rounded-sm border px-3 py-2 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2 ${overdue.length > 0 ? 'border-stale bg-stale-wash text-stale' : 'border-control bg-white text-ink hover:bg-paper-2'}`}>
        <ReceiptSummary receipt={receipt} />
      </summary>
      <div
        role="region"
        aria-label="Qualification details"
        tabIndex={0}
        className="absolute right-0 top-full z-[700] mt-2 max-h-[70dvh] w-[min(60rem,calc(100vw-2rem))] overflow-y-auto rounded-sm border border-control bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
      >
        {warning && <p role="status" className="mb-3 border-b border-rule pb-3 text-xs text-stale">{warning}</p>}
        <ReceiptBody receipt={receipt} generatedLabel={generatedLabel} />
        {sources.length > 0 && (
          <section aria-label="Source currency" className="mt-3 border-t border-rule pt-3">
            <h3 className="text-sm font-semibold text-ink">Source currency</h3>
            <dl className="mt-2 divide-y divide-rule font-mono text-xs text-ink-3">
              {sources.map((source) => (
                <div key={source.key} className={`flex flex-wrap justify-between gap-2 py-2 ${source.pastLimit || source.unchecked ? 'text-stale' : ''}`}>
                  <dt>{source.source}{source.asOf ? ` · ${source.asOf}` : ''}</dt>
                  <dd>{source.age === null ? 'Age unchecked' : `${source.age} d old`}{source.limit !== null && source.limit > 0 ? `, limit ${source.limit} d` : ', historical / no refresh limit'}{source.pastLimit ? ' · past limit' : ''}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </details>
  );
}
