import { notFound, redirect } from 'next/navigation';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ borough: string }>;
}) {
  const { borough } = await params;
  const name = DISPLAY_NAMES[borough] ?? 'Borough';
  return {
    title: `${name} parcel intelligence — CityLens`,
    description: `Explore ${name} parcels in the CityLens citywide opportunity map.`,
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
  const query = new URLSearchParams({ borough });
  if (bbl) query.set('bbl', bbl);
  redirect(`/parcel-intel?${query.toString()}`);
}
