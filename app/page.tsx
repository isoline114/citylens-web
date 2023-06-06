import type { Metadata } from 'next';
import Link from 'next/link';
import { demoId, previewDemo } from '@/components/FeaturedDemoCards';
import { CaseFile } from '@/components/home/CaseFile';
import { HomeEvidence } from '@/components/home/Evidence';
import { Sources } from '@/components/home/Sources';
import { dateLabel, finite, receipts } from '@/components/home/data';
import { fetchFeaturedDemosOnServer, fetchHomeParcelDataOnServer, fetchHomeRunSummaryOnServer } from '@/lib/api.server';

export const metadata: Metadata = { alternates: { canonical: '/' } };
// Regenerate at most once a minute (as before the redesign). Source ages are in
// days, so a page up to 60 seconds old still reports them correctly.
export const revalidate = 60;

export default async function HomePage() {
  const featuredPromise = fetchFeaturedDemosOnServer();
  const summaryPromise = featuredPromise.then(featured => {
    const demo = previewDemo(featured);
    return demo ? fetchHomeRunSummaryOnServer(demoId(demo)!) : null;
  });
  const [featured, parcel, summary] = await Promise.all([featuredPromise, fetchHomeParcelDataOnServer(), summaryPromise]);
  const checkedAt = new Date().toISOString();
  const sources = receipts(parcel.index, Date.parse(checkedAt));
  const checked = sources.filter(source => source.status !== 'Not applicable');
  const past = checked.filter(source => source.status === 'Past limit');
  const unchecked = checked.filter(source => source.status === 'Unchecked');
  const gateCount = parcel.index?.quality_gate?.citywide_acquisition_eligible_count;
  const boroughCount = parcel.index?.boroughs?.length ? parcel.index.boroughs.reduce((sum, borough) => sum + borough.count, 0) : null;
  const total = finite(gateCount) ? gateCount : boroughCount;
  const inventory = parcel.inventory;
  const count = (n: number) => n.toLocaleString('en-US');
  return <div className="bg-paper text-ink">
    <div aria-label="Feed dateline" data-testid="home-feed-dateline" className="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule bg-paper-2 px-4 py-2 text-xs text-ink-2">
      <span>Feed published <b className="font-semibold text-ink">{dateLabel(parcel.index?.generated_at)}</b></span>
      <span className="ws-tabular">{total !== null ? `${count(total)} ranked parcels` : 'Ranked-parcel count unavailable'}</span>
      <span className="ws-tabular">{checked.length ? `${checked.length} public sources checked` : 'Source receipt unavailable'}</span>
      {!!past.length && <span className="text-stale">Past freshness limit: {past.map(source => source.source).join(', ')}</span>}
      {!!unchecked.length && <span className="text-stale">Unchecked: {unchecked.map(source => source.source).join(', ')}</span>}
      {!!checked.length && <span className="font-mono">Ages as of {dateLabel(checkedAt)}</span>}
    </div>
    <section className="grid items-end gap-5 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-10">
      <h1 className="max-w-[21ch] text-[32px] font-extrabold leading-[1.04] tracking-[-0.028em] text-balance sm:text-[44px]">Every tax lot in New York City, ranked for redevelopment.</h1>
      <div><p className="max-w-[52ch] text-base leading-7 text-ink-2">CityLens ranks the city&apos;s lots on zoning headroom, ownership, sales and permit history, and shows the public records behind each rank.{parcel.lots.length ? ' Here is the current number one.' : ''}</p><div className="mt-5 flex flex-wrap items-center gap-4"><Link href="/parcel-intel" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-ink px-5 py-3 text-sm font-semibold text-white">Open the parcel map</Link><p className="max-w-[32ch] text-xs leading-5 text-ink-3">{inventory && finite(inventory.returned_count) && finite(inventory.available_count) ? `Public preview: ${count(inventory.returned_count)} of ${count(inventory.available_count)} ranked parcels, no account needed.` : 'Public preview available without an account. Live inventory counts are temporarily unavailable.'}</p></div></div>
    </section>
    <CaseFile lots={parcel.lots} total={total ?? inventory?.available_count ?? null} sources={sources} />
    <HomeEvidence initialDemos={featured} initialSummary={summary}><Sources sources={sources} checkedAt={checkedAt} /></HomeEvidence>

  </div>;
}
