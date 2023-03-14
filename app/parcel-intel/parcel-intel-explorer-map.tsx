'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  divIcon,
  type LatLngBoundsExpression,
  type LatLngTuple,
  type Map as LeafletMap,
} from 'leaflet';
import type { BBox, GeoJsonObject } from 'geojson';
import type Supercluster from 'supercluster';
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
import {
  buildParcelClusterIndex,
  clusterMarkerDiameter,
  countRowsInBounds,
  isParcelClusterFeature,
  NYC_MAP_BBOX,
  type ParcelMapClusterProperties,
  type ParcelMapPointProperties,
} from './parcel-intel-map-clusters';

const NYC_BOUNDS: LatLngBoundsExpression = [
  [40.4774, -74.2591],
  [40.9176, -73.7002],
];

type MapViewport = {
  bounds: BBox;
  zoom: number;
};

type Props = {
  rows: ParcelExplorerRow[];
  selectedBbl: string | null;
  selectedRow?: ParcelIntelRow | null;
  overlay: ExplorerOverlay;
  onSelect: (bbl: string) => void;
};

function fitMapToRows(map: LeafletMap, rows: ParcelExplorerRow[]) {
  const points: LatLngTuple[] = rows.flatMap((row) =>
    typeof row.lat === 'number' && typeof row.lng === 'number'
      ? ([[row.lat, row.lng]] as LatLngTuple[])
      : [],
  );
  if (points.length === 0) {
    map.fitBounds(NYC_BOUNDS, { padding: [12, 12], animate: false });
  } else if (points.length === 1) {
    map.setView(points[0], 15, { animate: false });
  } else {
    map.fitBounds(points, { padding: [28, 28], animate: false, maxZoom: 14 });
  }
}

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
    fitMapToRows(map, rows);
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

function currentViewport(map: LeafletMap): MapViewport {
  const bounds = map.getBounds();
  return {
    bounds: [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ],
    zoom: Math.round(map.getZoom()),
  };
}

function MapViewportObserver({
  onChange,
}: {
  onChange: (viewport: MapViewport) => void;
}) {
  const map = useMapEvents({
    moveend: () => onChange(currentViewport(map)),
    zoomend: () => onChange(currentViewport(map)),
  });

  useEffect(() => {
    onChange(currentViewport(map));
  }, [map, onChange]);

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
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
      <div className="mb-1.5 font-semibold uppercase tracking-[0.12em] text-slate-500">
        {overlay}
      </div>
      <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:flex sm:flex-wrap">
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

function clusterIcon(pointCount: number) {
  const diameter = clusterMarkerDiameter(pointCount);
  return divIcon({
    className: 'parcel-map-cluster-icon',
    html: `<span>${pointCount.toLocaleString()}</span>`,
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
  });
}

function ParcelClusterLayer({
  index,
  viewport,
  rowsByBbl,
  selectedBbl,
  overlay,
  onSelect,
}: {
  index: Supercluster<
    ParcelMapPointProperties,
    ParcelMapClusterProperties
  >;
  viewport: MapViewport;
  rowsByBbl: Map<string, ParcelExplorerRow>;
  selectedBbl: string | null;
  overlay: ExplorerOverlay;
  onSelect: (bbl: string) => void;
}) {
  const map = useMap();
  const features = useMemo(
    () => index.getClusters(viewport.bounds, viewport.zoom),
    [index, viewport],
  );

  return (
    <>
      {features.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        if (isParcelClusterFeature(feature)) {
          const count = feature.properties.point_count;
          const clusterId = feature.properties.cluster_id;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              position={[lat, lng]}
              icon={clusterIcon(count)}
              keyboard
              title={`${count.toLocaleString()} matched parcels. Activate to zoom in.`}
              eventHandlers={{
                click: () => {
                  map.flyTo(
                    [lat, lng],
                    Math.min(index.getClusterExpansionZoom(clusterId), 18),
                    { duration: 0.4 },
                  );
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -18]} opacity={0.97}>
                <div className="text-xs">
                  <div className="font-semibold text-slate-950">
                    {count.toLocaleString()} matched parcels
                  </div>
                  <div className="text-slate-500">Select to zoom and separate</div>
                </div>
              </Tooltip>
            </Marker>
          );
        }

        const row = rowsByBbl.get(feature.properties.bbl);
        if (!row || row.bbl === selectedBbl) return null;
        const color = explorerRowColor(row, overlay);
        return (
          <CircleMarker
            key={row.bbl}
            center={[lat, lng]}
            radius={row.priority_tier === 'highest' ? 5 : 3.5}
            pathOptions={{
              color: '#ffffff',
              weight: 0.8,
              opacity: 1,
              fillColor: color,
              fillOpacity: 0.82,
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
    </>
  );
}

export function ParcelIntelExplorerMap({
  rows,
  selectedBbl,
  selectedRow = null,
  overlay,
  onSelect,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [viewport, setViewport] = useState<MapViewport>({
    bounds: NYC_MAP_BBOX,
    zoom: 10,
  });
  const mappable = useMemo(
    () =>
      rows.filter(
        (row) => typeof row.lat === 'number' && typeof row.lng === 'number',
      ),
    [rows],
  );
  const rowsByBbl = useMemo(
    () => new Map(mappable.map((row) => [row.bbl, row])),
    [mappable],
  );
  const clusterIndex = useMemo(
    () => buildParcelClusterIndex(mappable),
    [mappable],
  );
  const visibleCount = useMemo(
    () => countRowsInBounds(mappable, viewport.bounds),
    [mappable, viewport.bounds],
  );
  const handleViewportChange = useCallback((next: MapViewport) => {
    setViewport(next);
  }, []);
  const selectedMapRow = selectedBbl ? rowsByBbl.get(selectedBbl) : null;
  const selectedGeometry = selectedRow?.parcel_geometry as
    | GeoJsonObject
    | null
    | undefined;

  return (
    <div
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner sm:min-h-[560px]"
      data-testid="parcel-citywide-map"
      role="region"
      aria-label={`Interactive citywide map with ${mappable.length.toLocaleString()} mapped ${
        mappable.length === 1 ? 'parcel' : 'parcels'
      }. Use the acquisition ranking after the map for a keyboard-accessible list.`}
    >
      <MapContainer
        ref={mapRef}
        bounds={NYC_BOUNDS}
        preferCanvas
        scrollWheelZoom={false}
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
        <MapViewportObserver onChange={handleViewportChange} />
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
        <ParcelClusterLayer
          index={clusterIndex}
          viewport={viewport}
          rowsByBbl={rowsByBbl}
          selectedBbl={selectedBbl}
          overlay={overlay}
          onSelect={onSelect}
        />
        {selectedMapRow && (
          <CircleMarker
            key={`selected-${selectedMapRow.bbl}`}
            center={[
              selectedMapRow.lat as number,
              selectedMapRow.lng as number,
            ]}
            radius={10}
            pathOptions={{
              color: '#0f172a',
              weight: 3,
              opacity: 1,
              fillColor: explorerRowColor(selectedMapRow, overlay),
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(selectedMapRow.bbl) }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.97}>
              <div className="min-w-44 text-xs">
                <div className="font-semibold text-slate-950">
                  {selectedMapRow.address ?? selectedMapRow.bbl}
                </div>
                <div className="mt-0.5 text-slate-600">Selected parcel</div>
              </div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <div className="absolute right-3 top-3 z-[400] flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 pl-3 text-xs text-slate-700 shadow-md backdrop-blur">
        <span className="font-semibold">
          {visibleCount.toLocaleString()} in view
        </span>
        <span className="text-slate-400" aria-hidden="true">
          /
        </span>
        <span>{mappable.length.toLocaleString()} matches</span>
        <button
          type="button"
          onClick={() => {
            if (mapRef.current) fitMapToRows(mapRef.current, mappable);
          }}
          className="ml-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-sky-100 hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Fit the map to all matching parcels"
        >
          Fit
        </button>
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
