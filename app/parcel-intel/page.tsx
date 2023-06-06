import { BookOpen, Database, TriangleAlert } from 'lucide-react';
import { fetchParcelIntelIndexOnServer } from '@/lib/api.server';
import type {
  ParcelProspectiveValidationHealth,
  ParcelProspectiveValidationStatus,
} from '@/lib/api';
import {
  historicalBenchmarkCopy,
  parseHistoricalBenchmarkReceipt,
} from '@/lib/parcel-intel-evidence';
import { ParcelFeedReceipt } from './parcel-feed-receipt';
import { ParcelIntelExplorer } from './parcel-intel-explorer';
import { ParcelModelLineage } from './parcel-model-lineage';
import { ParcelProspectiveValidation } from './parcel-prospective-validation';

export const metadata = {
  title: 'Parcel Intelligence — CityLens',
  description:
    'Find and qualify NYC development-site leads with current parcel facts, ownership context, aerial evidence, and an acquisition pipeline.',
  alternates: {
    canonical: '/parcel-intel',
  },
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

// Resolve time with the server request, then pass a stable value into the receipt.
async function receiptRequestTime(): Promise<number> {
  return Date.now();
}

export default async function ParcelIntelIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ borough?: string; bbl?: string }>;
}) {
  const { borough, bbl } = await searchParams;
  const index = await fetchParcelIntelIndexOnServer();
  const receiptEvaluatedAt = await receiptRequestTime();
  const generatedLabel = formatGenerated(index.generated_at);
  const labelWindow = index.model_metadata?.label_window as string | undefined;
  const trainingOrigins = Array.isArray(
    index.model_metadata?.training_origins,
  )
    ? index.model_metadata.training_origins.filter(
        (value): value is number =>
          typeof value === 'number' && Number.isInteger(value),
      )
    : [];
  const calibrationOrigin =
    typeof index.model_metadata?.calibration_origin === 'number' &&
    Number.isInteger(index.model_metadata.calibration_origin)
      ? index.model_metadata.calibration_origin
      : null;
  const inferenceSnapshot =
    typeof index.model_metadata?.inference_feature_snapshot === 'string'
      ? index.model_metadata.inference_feature_snapshot
      : null;
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
  const qualityGatePassed = index.quality_gate?.passed === true;
  const qualityGateFailed =
    Object.keys(index.quality_gate ?? {}).length > 0 && !qualityGatePassed;
  const selectionPolicy =
    index.quality_gate?.selection_policy &&
    typeof index.quality_gate.selection_policy === 'object'
      ? (index.quality_gate.selection_policy as Record<string, unknown>)
      : null;
  const selectionPolicySummary =
    selectionPolicy?.policy_id === 'borough_floor_250' &&
    typeof selectionPolicy.minimum_per_borough === 'number'
      ? ` The current list reserves ${selectionPolicy.minimum_per_borough.toLocaleString(
          'en-US',
        )} qualified leads per borough before merit-fill.`
      : '';

  return (
    <div className="min-w-0">
      <h1 className="sr-only">Parcel workspace</h1>

      {qualityGateFailed && (
        <div role="alert" className="mb-2 rounded-sm border border-rule bg-white px-3 py-2 text-xs leading-5 text-red-700">
          <strong>Acquisition quality warning:</strong> the published feed did not
          pass its project-leakage, rank-integrity, or coverage checks. Do not use it
          for outreach until the feed is republished.
        </div>
      )}

      {index.boroughs.length === 0 ? (
        <section className="panel p-8 text-center">
          <p className="text-sm text-ink-3">
            Parcel data is currently unavailable. Please try again shortly.
          </p>
        </section>
      ) : (
        <>
          <ParcelIntelExplorer
            sourceReceipt={
              <ParcelFeedReceipt
                evaluatedAt={receiptEvaluatedAt}
                qualityGate={index.quality_gate}
                dataSources={index.data_sources}
                modelMetadata={index.model_metadata}
                prospectiveValidation={index.prospective_validation ?? null}
                prospectiveValidationHealth={
                  index.prospective_validation_health ?? null
                }
                generatedLabel={generatedLabel}
              />
            }
            boroughs={index.boroughs}
            initialBorough={borough ?? null}
            initialBbl={bbl ?? null}
          />
          <MethodologyDisclosure
            labelWindow={labelWindow}
            trainingOrigins={trainingOrigins}
            calibrationOrigin={calibrationOrigin}
            inferenceSnapshot={inferenceSnapshot}
            precisionAt100={precisionAt100}
            precisionAt1000={precisionAt1000}
            evaluationBaseRate={evaluationBaseRate}
            evaluationEvidenceStatus={evaluationEvidenceStatus}
            selectionPolicySummary={selectionPolicySummary}
            prospectiveValidation={index.prospective_validation ?? null}
            prospectiveValidationHealth={
              index.prospective_validation_health ?? null
            }
            historicalBenchmarkReceipt={historicalBenchmarkReceipt}
          />
        </>
      )}
    </div>
  );
}

function MethodologyDisclosure({
  labelWindow,
  trainingOrigins,
  calibrationOrigin,
  inferenceSnapshot,
  precisionAt100,
  precisionAt1000,
  evaluationBaseRate,
  evaluationEvidenceStatus,
  selectionPolicySummary,
  prospectiveValidation,
  prospectiveValidationHealth,
  historicalBenchmarkReceipt,
}: {
  labelWindow: string | undefined;
  trainingOrigins: number[];
  calibrationOrigin: number | null;
  inferenceSnapshot: string | null;
  precisionAt100: number | null;
  precisionAt1000: number | null;
  evaluationBaseRate: number | null;
  evaluationEvidenceStatus: string;
  selectionPolicySummary: string;
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
    <details className="group mt-3 overflow-hidden border-t border-rule">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 marker:hidden hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select">
        <span className="flex items-center gap-2 text-xs font-medium text-ink">
          <BookOpen className="h-3.5 w-3.5 text-ink-3" />
          How CityLens ranks and qualifies parcels
        </span>
        <span className="text-xs text-ink-3 group-open:hidden">
          View methodology and limitations
        </span>
        <span className="hidden text-xs text-ink-3 group-open:inline">
          Hide methodology
        </span>
      </summary>
      <div className="grid gap-3 border-t border-rule py-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MethodCard
          icon={Database}
          title="Source records"
          body="Current parcel facts combine NYC PLUTO (including E-designations and restrictive declarations), ACRIS ownership, DOB project activity, LPC constraints, and available CityLens aerial-change observations. Source dates remain visible on every parcel."
        />
        <ParcelModelLineage
          trainingOrigins={trainingOrigins}
          calibrationOrigin={calibrationOrigin}
          benchmarkOutcomeWindow={labelWindow ?? null}
          inferenceSnapshot={inferenceSnapshot}
          selectionPolicySummary={selectionPolicySummary}
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
    <section className="panel p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-ink-3" />
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-ink-3">{body}</p>
    </section>
  );
}
