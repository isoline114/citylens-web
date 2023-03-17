import {
  Activity,
  BadgeCheck,
  CircleAlert,
  Database,
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
      className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10"
      data-testid="historical-ranking-evidence"
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-300">
        1 · Historical rank
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
                className="rounded-md bg-slate-950/40 px-2 py-1.5 ring-1 ring-inset ring-white/10"
              >
                <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {label}
                </div>
                <div className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-medium leading-4 text-sky-100">
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
        <p className="mt-1.5 text-xs font-semibold leading-5 text-white">
          Historical forward-ranking evidence is unavailable.
        </p>
      )}
      <p className="mt-1 text-[10px] leading-4 text-slate-400">
        2024 features → 2025 DOB NB filings
        {exposed ? ' · development-exposed benchmark' : ''}. Historical
        enrichment—not current parcel accuracy, seller intent, or deal
        probability.
      </p>
    </div>
  );
}

function CurrentQualification({ receipt }: { receipt: Receipt }) {
  return (
    <div className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
        2 · Current qualification
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-white">
        {formatCount(receipt.screenedOut)} candidates removed before{' '}
        {formatCount(receipt.published)} leads were surfaced.
      </p>
      <p className="mt-1 text-[10px] leading-4 text-slate-400">
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
        Membership gate only—it does not retrain the rank.
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
    <div className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-300">
          3 · Live outcomes
        </div>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
            current
              ? 'bg-emerald-400/10 text-emerald-200'
              : 'bg-amber-400/10 text-amber-200'
          }`}
        >
          {current ? 'Monitor current' : 'Inspect monitor'}
        </span>
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-white">
        {headline}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-slate-400">
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
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-white">
            Qualification receipt unavailable
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
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
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <BadgeCheck className="h-3.5 w-3.5" />
            Qualification receipt
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-white">
            {formatCount(receipt.published)} leads surfaced after current-source
            screening.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
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
            className="rounded-lg bg-white/[0.06] px-2.5 py-2 ring-1 ring-inset ring-white/10"
          >
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <Activity className="h-3 w-3" />
          Intelligence evidence chain
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          <HistoricalEvidence receipt={receipt} />
          <CurrentQualification receipt={receipt} />
          <LiveOutcomeEvidence receipt={receipt} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2.5 text-[10px] leading-4 text-slate-300">
        <span>ZAP projects mapped {projectCoverage}</span>
        <span aria-hidden="true" className="text-slate-600">
          ·
        </span>
        <span>
          {formatCount(receipt.belowCutoff)} qualified below cutoff
        </span>
        {receipt.selectionPolicy && (
          <>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              Selection {receipt.selectionPolicy.replaceAll('_', ' ')}
            </span>
          </>
        )}
        <span aria-hidden="true" className="text-slate-600">
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
            <span aria-hidden="true" className="text-slate-600">
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
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>Refreshed {generatedLabel}</span>
          </>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-slate-400">
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

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2.5">
        {verified ? (
          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300" />
        ) : (
          <CircleAlert className="h-4 w-4 shrink-0 text-amber-300" />
        )}
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Qualification receipt
          </span>
          <span className="block truncate text-xs font-semibold text-white">
            {verified
              ? `${formatCount(receipt.published)} leads · ${formatCount(
                  receipt.evaluated,
                )} evaluated · ${formatCount(receipt.projectLeakage)} leaks`
              : 'Feed verification unavailable'}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${
            verified
              ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-300/20'
              : 'bg-amber-400/10 text-amber-200 ring-amber-300/20'
          }`}
        >
          {verified ? 'Passed' : 'Inspect'}
        </span>
        <span className="text-[10px] font-medium text-sky-300 group-open:hidden">
          Details
        </span>
        <span className="hidden text-[10px] font-medium text-sky-300 group-open:inline">
          Close
        </span>
      </span>
    </div>
  );
}

export function ParcelFeedReceipt({
  qualityGate = {},
  dataSources = {},
  modelMetadata = {},
  prospectiveValidation = null,
  prospectiveValidationHealth = null,
  generatedLabel,
}: ParcelFeedReceiptProps) {
  const receipt = parcelFeedReceipt(
    qualityGate,
    dataSources,
    modelMetadata,
    prospectiveValidation,
    prospectiveValidationHealth,
  );

  return (
    <>
      <details className="group overflow-hidden rounded-xl bg-slate-950 px-3 py-2.5 shadow-lg ring-1 ring-inset ring-white/10 sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-white">
            <Database className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            {receipt.passed === true
              ? `${formatCount(receipt.published)} qualified leads`
              : 'Qualification receipt'}
          </span>
          <span className="shrink-0 text-[10px] font-medium text-sky-300 group-open:hidden">
            Inspect
          </span>
          <span className="hidden shrink-0 text-[10px] font-medium text-sky-300 group-open:inline">
            Hide
          </span>
        </summary>
        <div className="mt-3 border-t border-white/10 pt-3">
          <ReceiptBody receipt={receipt} generatedLabel={generatedLabel} />
        </div>
      </details>

      <details
        className="group hidden overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_44%),linear-gradient(135deg,#020617,#0f172a)] shadow-xl ring-1 ring-inset ring-white/10 sm:block"
        aria-label="Current shortlist qualification receipt"
        data-testid="parcel-feed-receipt"
      >
        <summary className="cursor-pointer list-none px-4 py-3 marker:hidden">
          <ReceiptSummary receipt={receipt} />
        </summary>
        <div className="border-t border-white/10 px-4 py-3">
          <ReceiptBody receipt={receipt} generatedLabel={generatedLabel} />
        </div>
      </details>
    </>
  );
}
