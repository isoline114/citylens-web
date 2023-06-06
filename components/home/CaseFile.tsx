import Link from 'next/link';
import { OrthoImage } from './OrthoImage';
import type { ParcelIntelRow } from '@/lib/api';
import { formatAddress, formatBbl } from '@/lib/parcel-format';
import { dateLabel, finite, type SourceReceipt } from './data';
import { geometryRings, IMAGE_HEIGHT, IMAGE_WIDTH, imagePoint, lotBbox, lotPath, orthoUrl } from './geometry';

const boroughs: Record<string, string> = { MN: 'Manhattan', BX: 'Bronx', BK: 'Brooklyn', QN: 'Queens', SI: 'Staten Island' };
const number = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
export function CaseFile({ lots, total, sources }: { lots: ParcelIntelRow[]; total: number | null; sources: SourceReceipt[] }) {
  if (!lots.length) return null;
  const top = lots[0];
  const ranks = lots.map(lot => lot.citywide_rank).filter(finite).sort((a, b) => a - b);
  const facts: { text: string; source: string; asOf?: string | null }[] = [];
  for (const lot of lots) {
    const address = formatAddress(lot.address) || `BBL ${formatBbl(lot.bbl)}`;
    if (finite(lot.lot_area_sqft)) facts.push({ text: `${address}: ${lot.land_use === '11' ? 'vacant land, ' : ''}${number(lot.lot_area_sqft)} sf of lot area.`, source: 'property_facts', asOf: lot.property_facts_as_of });
    if (lot.zoning_district_1 && finite(lot.allowed_far)) facts.push({ text: `Zoned ${lot.zoning_district_1}, allowed FAR ${lot.allowed_far.toFixed(2)}.${finite(lot.unused_floor_area_sqft) ? ` Unused floor-area proxy: ${number(lot.unused_floor_area_sqft)} sf.` : ''}`, source: 'property_facts', asOf: lot.property_facts_as_of });
    if (finite(lot.last_sale_price) && finite(lot.last_sale_year)) facts.push({ text: `Recorded sale: $${number(lot.last_sale_price)} in ${lot.last_sale_year}.`, source: 'ownership', asOf: lot.ownership_as_of });
    if (lot.is_landmark === false && lot.is_historic_district === false) facts.push({ text: 'No landmark or historic-district flag in the cited snapshot.', source: 'constraints', asOf: lot.property_facts_as_of });
    if (lot.redev_status === 'still_vacant') facts.push({ text: 'The published redevelopment status is still vacant. Recheck current filing records.', source: 'project_activity', asOf: lot.project_activity_as_of });
  }
  const bbox = lots.every(lot => geometryRings(lot.parcel_geometry).length) ? lotBbox(lots) : null;
  const past = sources.filter(source => source.status === 'Past limit');
  const hasProxy = lots.some(lot => finite(lot.unused_floor_area_sqft));
  return <section aria-labelledby="case-heading" data-testid="home-case-file" className="mb-11 border-t-2 border-ink">
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-3">
      <h2 id="case-heading" className="text-[22px] font-bold leading-tight tracking-tight">{lots.map(lot => formatAddress(lot.address) || `BBL ${formatBbl(lot.bbl)}`).join(' and ')}, {boroughs[top.borough ?? ''] ?? formatAddress(top.borough)}</h2>
      <p className="text-[13px] text-ink-2">{ranks.length > 1 ? 'Ranks ' : 'Rank '}{ranks.join(' and ')}{total !== null ? ` of ${number(total)}` : ''} · {lots.length === 2 ? 'one two-lot site' : lots.length > 2 ? `one ${lots.length}-lot site` : 'one tax lot'} · <span className="font-mono">BBL {lots.map(lot => formatBbl(lot.bbl)).join(', ')}</span></p>
    </div>
    <div className="grid items-start gap-7 lg:grid-cols-[1.35fr_1fr]">
      <figure>
        {bbox ? <div className="relative aspect-[3/2] overflow-hidden border border-rule bg-paper-2">
          {/* The image and SVG use exactly the same Web-Mercator bounds. */}
          <OrthoImage src={orthoUrl(bbox)} alt={`2024 aerial survey of ${lots.map(lot => formatAddress(lot.address) || formatBbl(lot.bbl)).join(' and ')}`} />
          <svg viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Tax-lot outlines with citywide rank markers">
            {lots.map(lot => {
              const rings = geometryRings(lot.parcel_geometry);
              const coordinates = finite(lot.lng) && finite(lot.lat) ? [lot.lng, lot.lat] : rings[0]?.[0];
              const marker = coordinates ? imagePoint(coordinates[0], coordinates[1], bbox) : null;
              return <g key={lot.bbl}>
                <path d={lotPath(lot, bbox)} fillRule="evenodd" className="fill-select/20 stroke-select" strokeWidth="2.5" />
                {marker && <g transform={`translate(${marker[0]},${marker[1]})`}><circle r="15" className="fill-ink stroke-white" strokeWidth="2" /><text textAnchor="middle" dy=".35em" className="fill-white font-mono text-sm">{lot.citywide_rank ?? '?'}</text></g>}
              </g>;
            })}
          </svg>
        </div> : <p className="flex aspect-[3/2] items-center justify-center border border-rule bg-paper-2 p-5 text-sm text-ink-3">Aerial preview unavailable: public lot geometry is missing for one or more lots.</p>}
        <figcaption className="mt-2 font-mono text-xs text-ink-3">NYS orthoimagery, spring 2024 · Lot outlines: NYC PLUTO · retrieved {dateLabel(sources.find(source => source.key === 'property_facts')?.retrievedAt)}</figcaption>
      </figure>
      <div className="text-sm">
        <h3 className="font-semibold">What the records say</h3>
        <ul className="mb-5 divide-y divide-rule">{facts.map((fact, i) => {
          const source = sources.find(source => source.key === fact.source);
          return <li key={i} className="grid gap-1 py-2"><span>{fact.text}</span><span className={`font-mono text-xs ${source?.status === 'Past limit' || source?.status === 'Unchecked' || !source ? 'text-stale' : 'text-ink-3'}`}>{source?.source ?? fact.source.replaceAll('_', ' ')} · as of {dateLabel(fact.asOf ?? source?.retrievedAt)}{source?.status === 'Past limit' ? ' · past freshness limit' : !source || source.status === 'Unchecked' ? ' · freshness unchecked' : ''}</span></li>;
        })}</ul>
        {!facts.length && <p className="my-3 text-ink-3">Public record facts are temporarily unavailable for this lot.</p>}
        <h3 className="font-semibold">Still open</h3>
        <ul className="mb-4 mt-2 list-disc space-y-2 pl-5 text-ink-2">
          <li>Who holds title now? Sign in to review ownership provenance and verify the official record.</li>
          {!!past.length && <li>Has anything changed since the cited records? {past.map(source => source.source).join(', ')} {past.length === 1 ? 'is' : 'are'} past the freshness limit.</li>}
          {hasProxy && <li>Does the envelope hold? Floor area is a proxy. Check the zoning text, overlays and lot conditions.</li>}
        </ul>
        <Link href={`/parcel-intel?bbl=${encodeURIComponent(top.bbl)}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Open this site in the workspace</Link>
      </div>
    </div>
  </section>;
}
