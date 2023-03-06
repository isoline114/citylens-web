import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Layers, MapPin, Workflow } from 'lucide-react';
import { fetchParcelIntelSweepOnServer } from '@/lib/api.server';
import { neonAuth } from '@/lib/auth/server';
import { hasValidSession } from '@/lib/auth/session.server';
import {
  formatAuc,
  formatPrecisionAt100,
  resolveParcelIntelMetrics,
  type ParcelIntelMetrics,
} from '@/lib/parcel-intel-metrics';
import { ParcelIntelWorkspace, SignInGate } from './parcel-intel-workspace';

const VALID_BOROUGHS = new Set([
  'manhattan',
  'brooklyn',
  'queens',
  'bronx',
  'staten_island',
]);

const DISPLAY_NAMES: Record<string, string> = {
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  bronx: 'Bronx',
  staten_island: 'Staten Island',
};

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ borough: string }>;
}) {
  const { borough } = await params;
  const name = DISPLAY_NAMES[borough] ?? 'Borough';
  return {
    title: `${name} parcel intelligence — CityLens`,
    description: `Priority development-site leads in ${name}, with current parcel facts, ownership context, and acquisition workflow.`,
  };
}

export default async function BoroughParcelIntelPage({
  params,
  searchParams,
}: {
  params: Promise<{ borough: string }>;
  searchParams: Promise<{ bbl?: string }>;
}) {
  const [{ borough }, { bbl }] = await Promise.all([params, searchParams]);
  if (!VALID_BOROUGHS.has(borough)) notFound();
  const displayName = DISPLAY_NAMES[borough];

  // Server-side auth gate. When Neon Auth is configured (prod), verify the
  // session BEFORE fetching the sweep so parcel data never lands in the SSR
  // HTML for unauthenticated visitors. When `neonAuth` is null (dev/CI mock
  // provider, or Neon unconfigured) we fall through to the existing behavior —
  // the client-side gate in ParcelIntelWorkspace still applies, and the
  // CITYLENS_DISABLE_SSR_PARCEL_INTEL=1 e2e path is unaffected. We fail closed
  // (render the gate) if the session check itself errors.
  if (neonAuth && !(await hasValidSession())) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <Link
          href="/parcel-intel"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All boroughs
        </Link>
        <header className="mt-3 mb-6">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {displayName} — top redevelopment candidates
          </h1>
        </header>
        <SignInGate borough={borough} boroughDisplayName={displayName} />
      </main>
    );
  }

  const sweep = await fetchParcelIntelSweepOnServer(borough, 1000);
  const metrics = resolveParcelIntelMetrics(sweep?.model_metadata);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <Link
        href="/parcel-intel"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All boroughs
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          {displayName} — top redevelopment candidates
        </h1>
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          {sweep && sweep.rows.length > 0
            ? `${sweep.rows.length} parcel leads ranked into priority tiers. Open a site to review current facts, provenance, acquisition notes, and a quick land-basis screen.`
            : 'No data published for this borough yet.'}
        </p>
      </header>

      {sweep && sweep.rows.length > 0 ? (
        <>
          <ParcelIntelWorkspace
            rows={sweep.rows}
            borough={borough}
            boroughDisplayName={displayName}
            initialBbl={bbl ?? null}
          />
          <MethodologyPanel metrics={metrics} />
        </>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            The publisher script may not have run for this borough yet, or the
            engine cache hasn&apos;t refreshed. Check back in a few minutes.
          </p>
        </section>
      )}
    </main>
  );
}

// hasValidSession lives in lib/auth/session.server.ts (extracted so the
// fail-closed contract is unit-testable). It defaults to the shared
// `neonAuth` client and returns true when Neon is unconfigured — the
// `neonAuth &&` guard above keeps the prod-only semantics explicit.

function MethodologyPanel({ metrics }: { metrics: ParcelIntelMetrics }) {
  return (
    <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
        <BookOpen className="h-3.5 w-3.5" />
        Methodology
      </div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        How the ranking works
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        Every NYC tax lot (~858k parcels) receives a model ranking based on a frozen
        PLUTO 2018 feature snapshot and subsequent 2019–2024 New-Building activity.
        CityLens presents the output as an ordinal priority tier—not as a literal
        probability of a future acquisition or permit.
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Layers className="h-4 w-4 text-sky-600" />
            Data sources
          </dt>
          <dd className="mt-2 text-xs leading-5 text-slate-600">
            <strong>PLUTO</strong> for lot/zoning,{' '}
            <strong>DOB legacy + DOB NOW</strong> for prior permit activity (block
            rollups + recency),{' '}
            <strong>LPC gpmc-yuvp + ncre-qhxs</strong> for landmark / historic-district
            constraints,{' '}
            <strong>ACRIS</strong> for deed history (last sale price + years held).
            All datasets are official NYC OpenData; the audit log is in the parcel-intel
            repo.
          </dd>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Workflow className="h-4 w-4 text-emerald-600" />
            Honesty guardrails
          </dt>
          <dd className="mt-2 text-xs leading-5 text-slate-600">
            <strong>Forward-label design:</strong> features are frozen at PLUTO 2018 and
            labels come from 2019–2024 NB filings, preventing post-event attributes from
            entering the feature row. This is not a prospective 2026 cohort test.
            <strong> Year-built is bucketed</strong> at 2010 to prevent
            redevelopment leakage. <strong>Stratified hard-negative sampling</strong>{' '}
            (5× positives) so the 770k easy negatives don&apos;t swamp training.
            Headline metrics come from population-level held-out tax blocks; same-cohort
            historical-fit diagnostics are retained separately and are not promoted.
          </dd>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-amber-600" />
            What a high priority means
          </dt>
          <dd className="mt-2 text-xs leading-5 text-slate-600">
            The current artifact reports population held-out P@100 of{' '}
            <strong>{formatPrecisionAt100(metrics.precisionAt100)}</strong> and AUC{' '}
            <strong>{formatAuc(metrics.auc)}</strong>. These numbers measure ranking on the
            historical evaluation cohort and should not be read as independent prospective
            2026 performance. A high-priority parcel looks structurally similar to past
            redevelopments; it is not necessarily available, feasible, or acquirable.
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs leading-5 text-amber-900">
          <strong>Caveats.</strong> Some &quot;parcels&quot; in PLUTO are administrative entities
          (transit ROW, condo billing units, institutional campuses) and don&apos;t
          represent realistic redev sites. We filter these via lot-area bands and
          land-use exclusions and separate overbuilt/conversion sites from ground-up leads.
          The plain-language reasons are rule-based; the separate model-attribution section
          contains the published SHAP contributions. Always verify city records and zoning
          counsel before acting.
        </p>
      </div>
    </section>
  );
}
