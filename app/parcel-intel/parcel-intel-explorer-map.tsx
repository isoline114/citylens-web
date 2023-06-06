'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  type LatLngBoundsExpression,
  type LatLngTuple,
  type Map as LeafletMap,
} from 'leaflet';
import type { BBox, GeoJsonObject } from 'geojson';
import { parcelLabel } from '@/lib/parcel-format';
import type { ParcelIntelRow } from '@/lib/api';
import { OpenStreetMapBasemap } from '@/components/OpenStreetMapBasemap';
import {
  BOROUGH_COLORS,
  BOROUGH_LABELS,
  OPPORTUNITY_COLORS,
  PRIORITY_COLORS,
  explorerRowColor,
  explorerRankRadius,
  opportunityLabel,
  priorityLabel,
  type ParcelExplorerRow,
  type ExplorerOverlay,
} from './parcel-intel-explorer-support';
import {
  NYC_MAP_BBOX,
  rowBblsInBounds,
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
  inventoryScope: 'public_preview' | 'authenticated_full';
  inventoryLoadedCount: number;
  inventoryAvailableCount: number;
  onSelect: (bbl: string) => void;
  onViewportRowsChange?: (bbls: string[]) => void;
};

function mapHasSize(map: LeafletMap): boolean {
  const container = map.getContainer();
  return container.clientWidth > 0 && container.clientHeight > 0;
}

function fitMapToRows(map: LeafletMap, rows: ParcelExplorerRow[]) {
  if (!mapHasSize(map)) return;
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

function ExplorerMapView({
  rows,
  selectedBbl,
}: {
  rows: ParcelExplorerRow[];
  selectedBbl: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    let frame = 0;
    let pendingView = true;
    const resize = () => {
      window.cancelAnimationFrame(frame);
      // Mobile panes stay mounted while hidden. Zero-sized map math produces
      // NaN coordinates in Leaflet flyTo and must not replace the last view.
      if (!mapHasSize(map)) {
        map.stop();
        return;
      }
      frame = window.requestAnimationFrame(() => {
        if (!mapHasSize(map)) return;
        map.invalidateSize({ pan: false, debounceMoveend: true });
        if (!pendingView) return;
        pendingView = false;
        const selected = selectedBbl
          ? rows.find((row) => row.bbl === selectedBbl)
          : null;
        if (
          selected &&
          typeof selected.lat === 'number' && Number.isFinite(selected.lat) &&
          typeof selected.lng === 'number' && Number.isFinite(selected.lng)
        ) {
          // A synchronous move cannot continue animating after a mobile tab
          // hides the map. Deferred selections are applied when it reopens.
          map.setView(
            [selected.lat, selected.lng],
            Math.max(Number.isFinite(map.getZoom()) ? map.getZoom() : 15, 15),
            { animate: false },
          );
        } else if (!selectedBbl) {
          fitMapToRows(map, rows);
        }
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [map, rows, selectedBbl]);

  return null;
}

function currentViewport(map: LeafletMap): MapViewport | null {
  if (!mapHasSize(map)) return null;
  const bounds = map.getBounds();
  const viewport: MapViewport = {
    bounds: [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ],
    zoom: Math.round(map.getZoom()),
  };
  if (
    !Number.isFinite(viewport.zoom) ||
    !viewport.bounds.every(Number.isFinite) ||
    viewport.bounds[0] >= viewport.bounds[2] ||
    viewport.bounds[1] >= viewport.bounds[3]
  ) return null;
  return viewport;
}

function MapViewportObserver({
  onChange,
}: {
  onChange: (viewport: MapViewport) => void;
}) {
  const publishViewport = () => {
    const viewport = currentViewport(map);
    if (viewport) onChange(viewport);
  };
  const map = useMapEvents({
    moveend: publishViewport,
    zoomend: publishViewport,
  });

  useEffect(() => {
    const viewport = currentViewport(map);
    if (viewport) onChange(viewport);
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
    <div className="pointer-events-none absolute bottom-7 left-3 z-[400] max-w-[calc(100%-1.5rem)] rounded-sm border border-rule bg-white px-3 py-2 font-cond text-[11px] text-ink">
      <div className="mb-1.5 font-cond font-medium text-ink-3">
        {overlay === 'priority' ? 'Rank' : overlay === 'borough' ? 'Borough' : 'Opportunity'}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="rounded-full ring-1 ring-white"
              style={{ backgroundColor: item.color, width: overlay === 'priority' ? ({ highest: 11, high: 9, medium: 8, watch: 7 }[item.key] ?? 8) : 8, height: overlay === 'priority' ? ({ highest: 11, high: 9, medium: 8, watch: 7 }[item.key] ?? 8) : 8 }}
            />
            {overlay === 'priority' ? ({ highest: '1–100', high: '101–500', medium: '501–1,500', watch: '1,501+' }[item.key]) : item.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-3 w-3 rounded-full border-2 border-select" />Selected lot</span>
      </div>
    </div>
  );
}

const ParcelPointLayer = memo(function ParcelPointLayer({
  rows, overlay, onSelect,
}: Pick<Props, 'rows' | 'overlay' | 'onSelect'>) {
  // A viewport change updates counts, not 5,000 React marker/tooltip trees.
  return rows.map((row) => (
    <CircleMarker
      key={row.bbl}
      center={[row.lat as number, row.lng as number]}
      radius={explorerRankRadius(row)}
      pathOptions={{ color: '#ffffff', weight: 0.8, opacity: 1,
        fillColor: explorerRowColor(row, overlay), fillOpacity: 0.9 }}
      eventHandlers={{ click: () => onSelect(row.bbl) }}
    >
      <Tooltip direction="top" offset={[0, -6]} opacity={0.97}>
        <div className="min-w-44 text-xs">
          <div className="font-semibold text-ink">{parcelLabel(row.address, row.bbl)}</div>
          <div className="mt-0.5 text-ink-2">{BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} · {priorityLabel(row.priority_tier)} priority</div>
          <div className="text-ink-3">{opportunityLabel(row.opportunity_category)}</div>
        </div>
      </Tooltip>
    </CircleMarker>
  ));
});

export function ParcelIntelExplorerMap({
  rows,
  selectedBbl,
  selectedRow = null,
  overlay,
  inventoryScope,
  inventoryLoadedCount,
  inventoryAvailableCount,
  onSelect,
  onViewportRowsChange,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  const selectPoint = useCallback((bbl: string) => onSelectRef.current(bbl), []);
  const [viewport, setViewport] = useState<MapViewport>({
    bounds: NYC_MAP_BBOX,
    zoom: 10,
  });
  const mappable = useMemo(
    () =>
      rows.filter(
        (row) => typeof row.lat === 'number' && Number.isFinite(row.lat) &&
          typeof row.lng === 'number' && Number.isFinite(row.lng),
      ),
    [rows],
  );
  const rowsByBbl = useMemo(
    () => new Map(mappable.map((row) => [row.bbl, row])),
    [mappable],
  );
  const visibleBbls = useMemo(
    () => rowBblsInBounds(mappable, viewport.bounds),
    [mappable, viewport.bounds],
  );
  const visibleCount = visibleBbls.length;
  const handleViewportChange = useCallback((next: MapViewport) => {
    setViewport(next);
  }, []);
  const selectedMapRow = selectedBbl ? rowsByBbl.get(selectedBbl) : null;
  const selectedGeometry = selectedRow?.parcel_geometry as
    | GeoJsonObject
    | null
    | undefined;
  const fullInventory = inventoryScope === 'authenticated_full';
  const inventoryLabel = fullInventory
    ? `${mappable.length.toLocaleString()} of ${inventoryAvailableCount.toLocaleString()} ranked parcels shown · full inventory`
    : `${mappable.length.toLocaleString()} of ${inventoryAvailableCount.toLocaleString()} ranked parcels shown · public preview`;

  useEffect(() => {
    onViewportRowsChange?.(visibleBbls);
  }, [onViewportRowsChange, visibleBbls]);

  return (
    <div
      className="map-surface relative h-full min-h-[320px] w-full overflow-hidden bg-paper-2 md:min-h-[440px]"
      data-testid="parcel-citywide-map"
      role="region"
      aria-label={`Interactive citywide map using ${
        fullInventory
          ? `the full ${inventoryLoadedCount.toLocaleString()}-parcel inventory`
          : `a public preview of ${inventoryLoadedCount.toLocaleString()} of ${inventoryAvailableCount.toLocaleString()} parcels`
      }, with ${mappable.length.toLocaleString()} matching ${
        mappable.length === 1 ? 'parcel' : 'parcels'
      }. Use the acquisition results for a keyboard-accessible list.`}
    >
      <MapContainer
        ref={mapRef}
        bounds={NYC_BOUNDS}
        preferCanvas
        scrollWheelZoom={false}
        trackResize={false}
        className="h-full w-full"
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <OpenStreetMapBasemap />
        <ExplorerMapView rows={mappable} selectedBbl={selectedBbl} />
        <MapViewportObserver onChange={handleViewportChange} />
        {selectedGeometry && (
          <GeoJSON
            key={`citywide-outline-${selectedBbl}`}
            data={selectedGeometry}
            style={{
              color: '#2150d0',
              weight: 3,
              fillColor: '#2150d0',
              fillOpacity: 0.15,
            }}
          />
        )}
        <ParcelPointLayer
          rows={mappable}
          overlay={overlay}
          onSelect={selectPoint}
        />
        {selectedMapRow && (
          <CircleMarker
            key={`selected-${selectedMapRow.bbl}`}
            center={[
              selectedMapRow.lat as number,
              selectedMapRow.lng as number,
            ]}
            radius={explorerRankRadius(selectedMapRow) + 4}
            pathOptions={{
              color: '#2150d0',
              weight: 3,
              opacity: 1,
              fill: false,
            }}
            eventHandlers={{ click: () => onSelect(selectedMapRow.bbl) }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.97}>
              <div className="min-w-44 text-xs">
                <div className="font-semibold text-ink">
                  {parcelLabel(selectedMapRow.address, selectedMapRow.bbl)}
                </div>
                <div className="mt-0.5 text-ink-3">Selected parcel</div>
              </div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <div className="absolute right-3 top-3 z-[400] flex max-w-[calc(100%-4.5rem)] flex-wrap items-center justify-end gap-x-1 gap-y-1 rounded-sm border border-rule bg-white p-1 pl-2 text-[10px] text-ink-3">
        <span
          data-testid="parcel-map-inventory-scope"
          className="px-1 py-1 font-medium text-ink"
        >
          {inventoryLabel}
        </span>
        <span className="text-ink-3" aria-hidden="true">
          ·
        </span>
        <span className="font-semibold">
          {mappable.length.toLocaleString()} matches
        </span>
        <span className="text-ink-3" aria-hidden="true">
          ·
        </span>
        <span>{visibleCount.toLocaleString()} in view</span>
        <button
          type="button"
          onClick={() => {
            if (mapRef.current) fitMapToRows(mapRef.current, mappable);
          }}
          className="ml-1 rounded-sm border border-control px-2 py-1 font-medium text-ink hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
          aria-label="Fit the map to all matching parcels"
        >
          Fit
        </button>
      </div>
      <OverlayLegend overlay={overlay} />
      {mappable.length === 0 && (
        <div className="absolute inset-x-4 top-16 z-[400] rounded-sm border border-rule bg-white px-4 py-3 text-sm text-ink">
          No parcels with map coordinates match these filters.
        </div>
      )}
    </div>
  );
}
