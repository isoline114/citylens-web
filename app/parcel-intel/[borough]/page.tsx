import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { fetchParcelIntelSweepOnServer } from '@/lib/api.server';
import { ParcelIntelTable } from './parcel-intel-table';

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
    description: `Top redevelopment candidates in ${name}, ranked by P(redevelopment) under temporal holdout.`,
  };
}

export default async function BoroughParcelIntelPage({
  params,
}: {
  params: Promise<{ borough: string }>;
}) {
  const { borough } = await params;
  if (!VALID_BOROUGHS.has(borough)) notFound();

  const sweep = await fetchParcelIntelSweepOnServer(borough, 100);
  const displayName = DISPLAY_NAMES[borough];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:py-12">
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
        <p className="mt-2 text-sm text-slate-600">
          {sweep && sweep.rows.length > 0
            ? `${sweep.rows.length} parcels ranked by calibrated probability of new-building permit issuance.`
            : 'No data published for this borough yet.'}
        </p>
      </header>

      {sweep && sweep.rows.length > 0 ? (
        <ParcelIntelTable rows={sweep.rows} borough={borough} />
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
