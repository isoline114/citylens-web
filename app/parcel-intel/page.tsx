import { BookOpen, Building2, Database, ShieldCheck, TriangleAlert } from 'lucide-react';
import { fetchParcelIntelIndexOnServer } from '@/lib/api.server';
import { ParcelIntelExplorer } from './parcel-intel-explorer';

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
  const performanceScope =
    typeof index.model_metadata?.performance_scope === 'string'
      ? (index.model_metadata.performance_scope as string)
      : null;
  const staleSources = Object.values(index.data_sources ?? {}).flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const status = value as Record<string, unknown>;
    if (status.stale !== true) return [];
    const source = typeof status.source === 'string' ? status.source : 'A required source';
    const age = typeof status.age_days === 'number' ? ` (${status.age_days} days old)` : '';
    return [`${source}${age}`];
  });
  const qualityGatePassed = index.quality_gate?.passed === true;
  const qualityGateFailed =
    Object.keys(index.quality_gate ?? {}).length > 0 && !qualityGatePassed;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 md:py-10 xl:px-8">
      <header className="mb-7 max-w-3xl md:mb-8">
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
          <Building2 className="h-3.5 w-3.5" />
          NYC parcel intelligence · v1
        </div>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-5xl">
          Find the sites worth pursuing this week.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 md:text-lg md:leading-8">
          CityLens ranks all NYC tax lots, refreshes the displayed parcel facts from
          current city records, and gives your team a place to qualify, watch, underwrite,
          and advance the best development-site leads. Priority is ordinal—not a promise
          that a parcel will transact or receive a permit.
        </p>
        {(modelType || featureYear || labelWindow || generatedLabel) && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {generatedLabel && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Refreshed {generatedLabel}
              </span>
            )}
            {modelType && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {modelType} ranking model
              </span>
            )}
            {performanceScope ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {performanceScope}
              </span>
            ) : featureYear !== undefined && featureYear !== null && labelWindow ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {String(featureYear)} features · {labelWindow} outcomes
              </span>
            ) : null}
            {qualityGatePassed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-inset ring-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Top 100 per borough eligibility-checked
              </span>
            )}
          </div>
        )}
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
}: {
  modelType: string | null;
  featureYear: string | number | undefined;
  labelWindow: string | undefined;
  performanceScope: string | null;
}) {
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
      <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 md:grid-cols-3 md:p-5">
        <MethodCard
          icon={Database}
          title="Source records"
          body="Current parcel facts combine NYC PLUTO, ACRIS ownership, DOB project activity, LPC constraints, and available CityLens aerial-change observations. Source dates remain visible on every parcel."
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
          icon={TriangleAlert}
          title="Required diligence"
          body="Administrative lots, active projects, stale ownership, zoning overlays, tenancy, and site conditions can invalidate a lead. Verify official records and professional advice before outreach or underwriting."
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
