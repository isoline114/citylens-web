import { BadgeCheck, CircleAlert, Database, ShieldCheck } from 'lucide-react';

type UnknownRecord = Record<string, unknown>;

export type ParcelFeedReceiptProps = {
  qualityGate?: UnknownRecord;
  dataSources?: UnknownRecord;
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

export function parcelFeedReceipt(
  qualityGate: UnknownRecord = {},
  dataSources: UnknownRecord = {},
): Receipt {
  const screening = record(qualityGate.screening_ledger);
  const landUse = record(qualityGate.land_use_reconciliation);
  const addresses = record(qualityGate.address_identity);
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
  };
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

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2.5 text-[10px] leading-4 text-slate-300">
        <span>ZAP projects mapped {projectCoverage}</span>
        <span aria-hidden="true" className="text-slate-600">
          ·
        </span>
        <span>
          {formatCount(receipt.belowCutoff)} qualified below cutoff
        </span>
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
  generatedLabel,
}: ParcelFeedReceiptProps) {
  const receipt = parcelFeedReceipt(qualityGate, dataSources);

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
