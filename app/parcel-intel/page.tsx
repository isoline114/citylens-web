import Link from 'next/link';
import { ArrowRight, Building2, MapPin } from 'lucide-react';
import { fetchParcelIntelIndexOnServer } from '@/lib/api.server';
import {
  formatAuc,
  formatPrecisionAt100,
  resolveParcelIntelMetrics,
} from '@/lib/parcel-intel-metrics';
import { BoroughCardPrefetch } from './borough-card-prefetch';

export const metadata = {
  title: 'Parcel Intelligence — CityLens',
  description:
    'Top redevelopment candidates per NYC borough, ranked by a calibrated model trained on PLUTO + DOB + LPC + ACRIS.',
};

// SSR with 5-minute revalidation; sweep cadence is monthly so this is plenty.
export const revalidate = 300;

const BOROUGH_ACCENTS: Record<string, string> = {
  manhattan: 'bg-sky-500',
  brooklyn: 'bg-emerald-500',
  queens: 'bg-amber-500',
  bronx: 'bg-rose-500',
  staten_island: 'bg-violet-500',
};

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

export default async function ParcelIntelIndexPage() {
  const index = await fetchParcelIntelIndexOnServer();
  const generatedLabel = formatGenerated(index.generated_at);
  const metrics = resolveParcelIntelMetrics(index.model_metadata);
  const modelType =
    typeof index.model_metadata?.model_type === 'string'
      ? (index.model_metadata.model_type as string).toUpperCase()
      : null;
  const featureYear = index.model_metadata?.feature_year as
    | string
    | number
    | undefined;
  const labelWindow = index.model_metadata?.label_window as string | undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-10">
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
          <Building2 className="h-3.5 w-3.5" />
          NYC parcel intelligence · v1
        </div>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          Top redevelopment candidates per borough.
        </h1>
        <p className="mt-3 max-w-prose text-base leading-7 text-slate-600">
          A calibrated gradient-boosted classifier scores every NYC tax lot using PLUTO
          + DOB permits + LPC landmarks + ACRIS deed history. Ranked under temporal
          holdout (PLUTO {metrics.featureYear} features → {metrics.labelWindow} NB filings)
          at AUC {formatAuc(metrics.auc)} / P@100 = {formatPrecisionAt100(metrics.precisionAt100)}.
        </p>
        {(modelType || featureYear || labelWindow || generatedLabel) && (
          <p className="mt-2 text-xs text-slate-500">
            {modelType && <span>model: {modelType}</span>}
            {featureYear !== undefined && featureYear !== null && (
              <span> · feature_year: {String(featureYear)}</span>
            )}
            {labelWindow && <span> · labels: {labelWindow}</span>}
            {generatedLabel && <span> · refreshed {generatedLabel}</span>}
          </p>
        )}
      </header>

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
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {index.boroughs.map((b) => {
            const accent = BOROUGH_ACCENTS[b.slug] ?? 'bg-slate-500';
            const topPct =
              typeof b.top_score === 'number'
                ? `${Math.round(b.top_score * 100)}%`
                : null;
            return (
              <BoroughCardPrefetch key={b.slug}>
                <Link
                  href={`/parcel-intel/${b.slug}`}
                  className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${accent}`}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        Borough
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {b.display_name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {b.count} ranked candidates
                        {topPct ? `, top score ${topPct}` : ''}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
                  </div>
                </Link>
              </BoroughCardPrefetch>
            );
          })}
        </section>
      )}
    </main>
  );
}
