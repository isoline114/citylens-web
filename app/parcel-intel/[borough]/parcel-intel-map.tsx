'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
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

function FitBoundsToRows({
  rows,
  fallback,
}: {
  rows: ParcelIntelRow[];
  fallback: LatLngBoundsExpression;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    for (const r of rows) {
      if (typeof r.lat === 'number' && typeof r.lng === 'number') {
        points.push([r.lat, r.lng]);
      }
    }
    if (points.length === 0) {
      map.fitBounds(fallback, { padding: [16, 16] });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
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
      // Smooth-pan; keep the user's current zoom unless very far out.
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 16);
      map.flyTo([row.lat, row.lng], targetZoom, { duration: 0.6 });
    }
  }, [map, rows, selectedBbl]);
  return null;
}

export function ParcelIntelMap({ borough, rows, selectedBbl, onSelect }: Props) {
  const fallback = BOROUGH_FALLBACK_BOUNDS[borough] ?? BOROUGH_FALLBACK_BOUNDS.brooklyn;
  const total = rows.length;
  const mapRef = useRef<unknown>(null);

  // Filter rows that lack geometry — we still show them in the list but
  // they don't get a dot on the map.
  const mappable = useMemo(
    () =>
      rows.filter(
        (r) => typeof r.lat === 'number' && typeof r.lng === 'number',
      ),
    [rows],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <MapContainer
        ref={mapRef as never}
        center={[40.7128, -74.006]}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          // No attribution prop here; we render our own footer below.
        />
        <FitBoundsToRows rows={rows} fallback={fallback} />
        <PanToSelected rows={rows} selectedBbl={selectedBbl} />
        {mappable.map((r, idx) => {
          const isSelected = r.bbl === selectedBbl;
          const baseColor = colorForRank(idx, total);
          return (
            <CircleMarker
              key={r.bbl}
              center={[r.lat as number, r.lng as number]}
              radius={isSelected ? 11 : 6}
              pathOptions={{
                color: isSelected ? '#0f172a' : baseColor,
                weight: isSelected ? 2 : 1,
                fillColor: baseColor,
                fillOpacity: isSelected ? 0.95 : 0.75,
              }}
              eventHandlers={{
                click: () => onSelect(r.bbl),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
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

      {/* Legend — small, fixed, non-interactive */}
      <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur">
        <div className="mb-1 text-slate-500">Rank</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#dc2626' }} />
          <span>Top 10</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#f59e0b' }} />
          <span>11-30</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#10b981' }} />
          <span>31-60</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#0ea5e9' }} />
          <span>61+</span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-1 right-2 text-[9px] text-slate-500">
        © OpenStreetMap · CARTO
      </div>

      {mappable.length < rows.length && (
        <div className="absolute bottom-2 left-2 max-w-xs rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 shadow-sm">
          {rows.length - mappable.length} parcels lack polygon geometry
          (typically condo billing units or transit ROW) and don&apos;t appear on the map.
        </div>
      )}
    </div>
  );
}
