'use client';

import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { ParcelIntelRow } from '@/lib/api';

// Borough-level bbox fallbacks, used when a borough has zero rows with
// lat/lng. Approximate; the user only sees these on the cold path.
const BOROUGH_FALLBACK_BOUNDS: Record<string, LatLngBoundsExpression> = {
  manhattan: [[40.7, -74.02], [40.88, -73.91]],
  brooklyn: [[40.57, -74.05], [40.74, -73.83]],
  queens: [[40.54, -73.96], [40.8, -73.7]],
  bronx: [[40.79, -73.93], [40.92, -73.76]],
  staten_island: [[40.49, -74.26], [40.65, -74.05]],
};

type Props = {
  borough: string;
  rows: ParcelIntelRow[];
  selectedBbl: string | null;
  onSelect: (bbl: string) => void;
};

// Color the score by tier so the map at a glance shows distribution
// rather than just dot density. We're working in a small range
// (top-100 are all ≥ 0.85 typically) so we tier by rank position.
function colorForRank(rank: number, total: number): string {
  const r = rank / total;
  if (r < 0.1) return '#dc2626'; // top 10% — rose-600
  if (r < 0.3) return '#f59e0b'; // top 30% — amber-500
  if (r < 0.6) return '#10b981'; // top 60% — emerald-500
  return '#0ea5e9'; // rest — sky-500
}

/**
 * Fits the map to the markers' bounding box on first render and
 * whenever the row set changes. Also calls `invalidateSize` once after
 * mount because Leaflet's container can be measured at 0 px when the
 * dynamic-import skeleton transitions to the real component, which
 * leaves the map locked at the wrong zoom and tile-layer coords.
 */
function FitBoundsAndInvalidate({
  rows,
  fallback,
}: {
  rows: ParcelIntelRow[];
  fallback: LatLngBoundsExpression;
}) {
  const map = useMap();

  // Safety: a fresh-mounted Leaflet map sometimes reports container
  // size as 0 when its parent height is set via flexbox. invalidateSize
  // re-reads the container and re-projects tile/marker layers.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    const points: LatLngTuple[] = [];
    for (const r of rows) {
      if (typeof r.lat === 'number' && typeof r.lng === 'number') {
        points.push([r.lat, r.lng]);
      }
    }
    // animate: false saves ~250ms on first paint by skipping Leaflet's
    // default zoom-pan animation. Subsequent re-fits (filter changes)
    // also feel snappier without the wobble.
    if (points.length === 0) {
      map.fitBounds(fallback, { padding: [16, 16], animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
      return;
    }
    map.fitBounds(points, { padding: [32, 32], animate: false });
  }, [map, rows, fallback]);
  return null;
}

function PanToSelected({
  rows,
  selectedBbl,
}: {
  rows: ParcelIntelRow[];
  selectedBbl: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedBbl) return;
    const row = rows.find((r) => r.bbl === selectedBbl);
    if (
      row &&
      typeof row.lat === 'number' &&
      typeof row.lng === 'number'
    ) {
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 16);
      map.flyTo([row.lat, row.lng], targetZoom, { duration: 0.6 });
    }
  }, [map, rows, selectedBbl]);
  return null;
}

export function ParcelIntelMap({ borough, rows, selectedBbl, onSelect }: Props) {
  const fallback = useMemo<LatLngBoundsExpression>(
    () => BOROUGH_FALLBACK_BOUNDS[borough] ?? BOROUGH_FALLBACK_BOUNDS.brooklyn,
    [borough],
  );
  const total = rows.length;

  // Filter rows that lack geometry — we still show them in the list
  // but they don't get a dot on the map.
  const mappable = useMemo(
    () =>
      rows.filter(
        (r) => typeof r.lat === 'number' && typeof r.lng === 'number',
      ),
    [rows],
  );

  // A computed initial center/zoom that already targets the borough
  // even before FitBoundsAndInvalidate runs. Prevents the brief
  // flash of "all of NYC" before bounds are applied.
  const initialCenter = useMemo<LatLngTuple>(() => {
    const fb = fallback as [LatLngTuple, LatLngTuple];
    return [(fb[0][0] + fb[1][0]) / 2, (fb[0][1] + fb[1][1]) / 2];
  }, [fallback]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <MapContainer
        center={initialCenter}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        <FitBoundsAndInvalidate rows={mappable} fallback={fallback} />
        <PanToSelected rows={rows} selectedBbl={selectedBbl} />
        {mappable.map((r, idx) => {
          const isSelected = r.bbl === selectedBbl;
          const baseColor = colorForRank(idx, total);
          return (
            <CircleMarker
              key={r.bbl}
              center={[r.lat as number, r.lng as number]}
              radius={isSelected ? 11 : 7}
              pathOptions={{
                color: isSelected ? '#0f172a' : '#ffffff',
                weight: isSelected ? 2.5 : 1.5,
                opacity: 1,
                fillColor: baseColor,
                fillOpacity: isSelected ? 0.95 : 0.85,
              }}
              eventHandlers={{
                click: () => onSelect(r.bbl),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <div className="text-xs">
                  <div className="font-semibold">{r.address ?? r.bbl}</div>
                  <div className="text-slate-600">
                    Rank #{idx + 1} ·{' '}
                    {typeof r.score_calibrated === 'number'
                      ? `${(r.score_calibrated * 100).toFixed(0)}%`
                      : '—'}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute right-2 top-2 z-[400] rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur">
        <div className="mb-1 text-slate-500">Rank</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: '#dc2626' }} />
          <span>Top 10</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: '#f59e0b' }} />
          <span>11-30</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: '#10b981' }} />
          <span>31-60</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: '#0ea5e9' }} />
          <span>61+</span>
        </div>
      </div>

      {mappable.length === 0 && (
        <div className="absolute inset-x-2 top-12 z-[400] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
          None of the {rows.length} parcels have polygon geometry — the map can&apos;t show markers. The list still works.
        </div>
      )}
      {mappable.length > 0 && mappable.length < rows.length && (
        <div className="absolute bottom-2 left-2 z-[400] max-w-xs rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 shadow-sm">
          {rows.length - mappable.length} parcels lack polygon geometry
          (typically condo billing units or transit ROW) and don&apos;t appear on the map.
        </div>
      )}
    </div>
  );
}
