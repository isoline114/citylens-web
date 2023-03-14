import { BookOpen, Building2, Database, ShieldCheck, TriangleAlert } from 'lucide-react';
import { fetchParcelIntelIndexOnServer } from '@/lib/api.server';
import type {
  ParcelProspectiveValidationHealth,
  ParcelProspectiveValidationStatus,
} from '@/lib/api';
import {
  historicalBenchmarkCopy,
  normalizePerformanceScope,
  parseHistoricalBenchmarkReceipt,
} from '@/lib/parcel-intel-evidence';
import { ParcelFeedReceipt } from './parcel-feed-receipt';
import { ParcelIntelExplorer } from './parcel-intel-explorer';
import { ParcelProspectiveValidation } from './parcel-prospective-validation';

export const metadata = {
  title: 'Parcel Intelligence — CityLens',
  description:
    'Find and qualify NYC development-site leads with current parcel facts, ownership context, aerial evidence, and an acquisition pipeline.',
};

// SSR with 5-minute revalidation; sweep cadence is monthly so this is plenty.
export const revalidate = 300;

function formatGenerated(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default async function ParcelIntelIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ borough?: string; bbl?: string }>;
}) {
  const { borough, bbl } = await searchParams;
  const index = await fetchParcelIntelIndexOnServer();
  const generatedLabel = formatGenerated(index.generated_at);
  const modelType =
    typeof index.model_metadata?.model_type === 'string'
      ? (index.model_metadata.model_type as string).toUpperCase()
      : null;
  const featureYear = index.model_metadata?.feature_year as
    | string
    | number
    | undefined;
  const labelWindow = index.model_metadata?.label_window as string | undefined;
  // Older published feeds described the latest historical fold as
  // "untouched." That cohort has since been inspected during challenger
  // development, so the browser fails conservative even before the next feed
  // publication replaces the metadata.
  const performanceScope = normalizePerformanceScope(
    index.model_metadata?.performance_scope,
  );
  const evaluationEvidence =
    index.model_metadata?.evaluation_evidence &&
    typeof index.model_metadata.evaluation_evidence === 'object'
      ? (index.model_metadata.evaluation_evidence as Record<string, unknown>)
      : null;
  const evaluationEvidenceStatus =
    typeof evaluationEvidence?.status === 'string'
      ? evaluationEvidence.status
      : 'unclassified';
  const precisionAt100 =
    typeof index.model_metadata?.precision_at_100 === 'number'
      ? (index.model_metadata.precision_at_100 as number)
      : null;
  const precisionAt1000 =
    typeof index.model_metadata?.precision_at_1000 === 'number'
      ? (index.model_metadata.precision_at_1000 as number)
      : null;
  const evaluationBaseRate =
    typeof index.model_metadata?.spatial_cv_base_rate === 'number'
      ? (index.model_metadata.spatial_cv_base_rate as number)
      : null;
  const historicalBenchmarkReceipt = parseHistoricalBenchmarkReceipt(
    index.model_metadata?.historical_benchmark_receipt,
  );
  const staleSources = Object.values(index.data_sources ?? {}).flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const status = value as Record<string, unknown>;
    // A stale warning is meaningful only for a refreshable operational source
    // with an explicit SLA. Historical model/imagery provenance may carry a
    // baseline year without a retrieval timestamp; it must not masquerade as
    // an overdue current-record feed.
    if (
      status.stale !== true ||
      typeof status.max_age_days !== 'number' ||
      !Number.isFinite(status.max_age_days) ||
      status.max_age_days <= 0
    ) {
      return [];
    }
    const source = typeof status.source === 'string' ? status.source : 'A required source';
    const age = typeof status.age_days === 'number' ? ` (${status.age_days} days old)` : '';
    return [`${source}${age}`];
  });
  const qualityGatePassed = index.quality_gate?.passed === true;
  const qualityGateFailed =
    Object.keys(index.quality_gate ?? {}).length > 0 && !qualityGatePassed;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 md:py-6 xl:px-8">
      <header className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
            <Building2 className="h-3.5 w-3.5" />
            NYC parcel intelligence · v1
          </div>
          <h1 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">
            Find the sites worth pursuing this week.
          </h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6 md:text-base md:leading-7">
            <span className="sm:hidden">
              Rank NYC development-site leads from current city records. Open a
              parcel to verify evidence and underwrite. Rank is a screening
              order—not a transaction promise.
            </span>
            <span className="hidden sm:inline">
              Rank and qualify NYC development-site leads from current city records,
              then open the parcel to verify evidence, underwrite, and plan the next
              action. Priority is ordinal—not a promise that a site will transact or
              receive a permit.
            </span>
          </p>
        </div>
        <ParcelFeedReceipt
          qualityGate={index.quality_gate}
          dataSources={index.data_sources}
          modelMetadata={index.model_metadata}
          prospectiveValidation={index.prospective_validation ?? null}
          prospectiveValidationHealth={
            index.prospective_validation_health ?? null
          }
          generatedLabel={generatedLabel}
        />
      </header>

      {staleSources.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Freshness warning:</strong> {staleSources.join(', ')}. Verify the
          latest city records before acquisition diligence.
        </div>
      )}

      {qualityGateFailed && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <strong>Acquisition quality warning:</strong> the published feed did not
          pass its project-leakage, rank-integrity, or coverage checks. Do not use it
          for outreach until the feed is republished.
        </div>
      )}

      {index.boroughs.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            No parcel-intel data has been published yet. Run{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] ring-1 ring-inset ring-slate-200">
              scripts/publish_sweep.py
            </code>{' '}
            from the citylens-parcel-intel repo to populate this view.
          </p>
        </section>
      ) : (
        <>
          <ParcelIntelExplorer
            boroughs={index.boroughs}
            initialBorough={borough ?? null}
            initialBbl={bbl ?? null}
          />
          <MethodologyDisclosure
            modelType={modelType}
            featureYear={featureYear}
            labelWindow={labelWindow}
            performanceScope={performanceScope}
            precisionAt100={precisionAt100}
            precisionAt1000={precisionAt1000}
            evaluationBaseRate={evaluationBaseRate}
            evaluationEvidenceStatus={evaluationEvidenceStatus}
            prospectiveValidation={index.prospective_validation ?? null}
            prospectiveValidationHealth={
              index.prospective_validation_health ?? null
            }
            historicalBenchmarkReceipt={historicalBenchmarkReceipt}
          />
        </>
      )}
    </main>
  );
}

function MethodologyDisclosure({
  modelType,
  featureYear,
  labelWindow,
  performanceScope,
  precisionAt100,
  precisionAt1000,
  evaluationBaseRate,
  evaluationEvidenceStatus,
  prospectiveValidation,
  prospectiveValidationHealth,
  historicalBenchmarkReceipt,
}: {
  modelType: string | null;
  featureYear: string | number | undefined;
  labelWindow: string | undefined;
  performanceScope: string | null;
  precisionAt100: number | null;
  precisionAt1000: number | null;
  evaluationBaseRate: number | null;
  evaluationEvidenceStatus: string;
  prospectiveValidation: ParcelProspectiveValidationStatus | null;
  prospectiveValidationHealth: ParcelProspectiveValidationHealth | null;
  historicalBenchmarkReceipt: ReturnType<
    typeof parseHistoricalBenchmarkReceipt
  >;
}) {
  const forwardTestBody = historicalBenchmarkCopy({
    precisionAt100,
    precisionAt1000,
    baseRate: evaluationBaseRate,
    evidenceStatus: evaluationEvidenceStatus,
    receipt: historicalBenchmarkReceipt,
  });

  return (
    <details className="group mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden hover:bg-slate-50">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BookOpen className="h-4 w-4 text-sky-600" />
          How CityLens ranks and qualifies parcels
        </span>
        <span className="text-xs font-medium text-slate-500 group-open:hidden">
          View methodology and limitations
        </span>
        <span className="hidden text-xs font-medium text-slate-500 group-open:inline">
          Hide methodology
        </span>
      </summary>
      <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 md:grid-cols-2 md:p-5 lg:grid-cols-3 xl:grid-cols-5">
        <MethodCard
          icon={Database}
          title="Source records"
          body="Current parcel facts combine NYC PLUTO (including E-designations and restrictive declarations), ACRIS ownership, DOB project activity, LPC constraints, and available CityLens aerial-change observations. Source dates remain visible on every parcel."
        />
        <MethodCard
          icon={ShieldCheck}
          title="What rank means"
          body={`${modelType ?? 'The'} model evidence covers ${
            performanceScope ??
            `${featureYear ?? 'historical'} features and ${labelWindow ?? 'later'} outcomes`
          }. Current DOB projects and constrained or incomplete parcels are removed before acquisition rank is assigned. Rank remains an ordinal screening signal—not a probability that a site will transact.`}
        />
        <MethodCard
          icon={Database}
          title="Historical benchmark hit rate"
          body={forwardTestBody}
        />
        <ParcelProspectiveValidation
          status={prospectiveValidation}
          health={prospectiveValidationHealth}
        />
        <MethodCard
          icon={TriangleAlert}
          title="Required diligence"
          body="Administrative lots, active projects, stale ownership, zoning overlays, environmental-designation requirements, tenancy, and site conditions can invalidate a lead. Verify official records and professional advice before outreach or underwriting."
        />
      </div>
    </details>
  );
}

function MethodCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Database;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-sky-600" />
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-600">{body}</p>
    </section>
  );
}
