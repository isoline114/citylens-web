'use client';

import { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { ParcelIntelRow } from '@/lib/api';
import {
  BOROUGH_COLORS,
  BOROUGH_LABELS,
  OPPORTUNITY_COLORS,
  PRIORITY_COLORS,
  explorerRowColor,
  opportunityLabel,
  priorityLabel,
  type ParcelExplorerRow,
  type ExplorerOverlay,
} from './parcel-intel-explorer-support';

const NYC_BOUNDS: LatLngBoundsExpression = [
  [40.4774, -74.2591],
  [40.9176, -73.7002],
];

type Props = {
  rows: ParcelExplorerRow[];
  selectedBbl: string | null;
  selectedRow?: ParcelIntelRow | null;
  overlay: ExplorerOverlay;
  onSelect: (bbl: string) => void;
};

function FitExplorerBounds({
  rows,
  selectedBbl,
}: {
  rows: ParcelExplorerRow[];
  selectedBbl: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Selection owns the viewport while a property panel is open. When the
    // panel closes, selectedBbl becomes null and this effect restores the
    // full filtered extent instead of leaving the user stranded at lot zoom.
    if (selectedBbl) return;
    const points: LatLngTuple[] = rows.flatMap((row) =>
      typeof row.lat === 'number' && typeof row.lng === 'number'
        ? ([[row.lat, row.lng]] as LatLngTuple[])
        : [],
    );
    if (points.length === 0) {
      map.fitBounds(NYC_BOUNDS, { padding: [12, 12], animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
      return;
    }
    map.fitBounds(points, { padding: [28, 28], animate: false, maxZoom: 14 });
  }, [map, rows, selectedBbl]);

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function PanToSelection({
  rows,
  selectedBbl,
}: {
  rows: ParcelExplorerRow[];
  selectedBbl: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedBbl) return;
    const selected = rows.find((row) => row.bbl === selectedBbl);
    if (
      selected &&
      typeof selected.lat === 'number' &&
      typeof selected.lng === 'number'
    ) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 15), {
        duration: 0.45,
      });
    }
  }, [map, rows, selectedBbl]);

  return null;
}

function OverlayLegend({ overlay }: { overlay: ExplorerOverlay }) {
  const items =
    overlay === 'borough'
      ? Object.entries(BOROUGH_COLORS).map(([key, color]) => ({
          key,
          color,
          label: BOROUGH_LABELS[key] ?? key,
        }))
      : overlay === 'opportunity'
        ? Object.entries(OPPORTUNITY_COLORS).map(([key, color]) => ({
            key,
            color,
            label: opportunityLabel(
              key as ParcelIntelRow['opportunity_category'],
            ),
          }))
        : Object.entries(PRIORITY_COLORS).map(([key, color]) => ({
            key,
            color,
            label: priorityLabel(key as ParcelIntelRow['priority_tier']),
          }));

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
      <div className="mb-1.5 font-semibold uppercase tracking-[0.12em] text-slate-500">
        {overlay}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:flex-wrap">
        {items.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-white"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ParcelIntelExplorerMap({
  rows,
  selectedBbl,
  selectedRow = null,
  overlay,
  onSelect,
}: Props) {
  const mappable = useMemo(
    () =>
      rows.filter(
        (row) => typeof row.lat === 'number' && typeof row.lng === 'number',
      ),
    [rows],
  );
  const selectedGeometry = selectedRow?.parcel_geometry as
    | GeoJsonObject
    | null
    | undefined;

  return (
    <div
      className="relative h-full min-h-[560px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner"
      data-testid="parcel-citywide-map"
    >
      <MapContainer
        bounds={NYC_BOUNDS}
        preferCanvas
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
        <FitExplorerBounds rows={mappable} selectedBbl={selectedBbl} />
        <PanToSelection rows={mappable} selectedBbl={selectedBbl} />
        {selectedGeometry && (
          <GeoJSON
            key={`citywide-outline-${selectedBbl}`}
            data={selectedGeometry}
            style={{
              color: '#0f172a',
              weight: 3,
              fillColor: '#38bdf8',
              fillOpacity: 0.25,
            }}
          />
        )}
        {mappable.map((row) => {
          const isSelected = row.bbl === selectedBbl;
          const color = explorerRowColor(row, overlay);
          return (
            <CircleMarker
              key={row.bbl}
              center={[row.lat as number, row.lng as number]}
              radius={isSelected ? 10 : row.priority_tier === 'highest' ? 5 : 3.5}
              pathOptions={{
                color: isSelected ? '#0f172a' : '#ffffff',
                weight: isSelected ? 2.5 : 0.8,
                opacity: 1,
                fillColor: color,
                fillOpacity: isSelected ? 1 : 0.78,
              }}
              eventHandlers={{ click: () => onSelect(row.bbl) }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={0.97}>
                <div className="min-w-44 text-xs">
                  <div className="font-semibold text-slate-950">
                    {row.address ?? row.bbl}
                  </div>
                  <div className="mt-0.5 text-slate-600">
                    {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} ·{' '}
                    {priorityLabel(row.priority_tier)} priority
                  </div>
                  <div className="text-slate-500">
                    {opportunityLabel(row.opportunity_category)}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur">
        {mappable.length.toLocaleString()} mapped parcels
      </div>
      <OverlayLegend overlay={overlay} />
      {mappable.length === 0 && (
        <div className="absolute inset-x-4 top-16 z-[400] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
          No parcels with map coordinates match these filters.
        </div>
      )}
    </div>
  );
}
