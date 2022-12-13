'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties, GeoJsonObject } from 'geojson';
import {
  boundsFromGeojson,
  getGeojsonChangeKindCounts,
  getGeojsonCoordinateSpace,
  normalizeChangeKind,
} from '@/lib/geojson';

type LatLng = [number, number];

function FitBounds({ bounds }: { bounds: { sw: LatLng; ne: LatLng } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds([bounds.sw, bounds.ne], { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

export function GeojsonMap({ url }: { url: string }) {
  const [geojson, setGeojson] = useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      setGeojson(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GeoJSON fetch failed (${res.status})`);
        const json = (await res.json()) as FeatureCollection;
        if (!cancelled) setGeojson(json);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const coordinateSpace = useMemo(() => getGeojsonCoordinateSpace(geojson), [geojson]);
  const bounds = useMemo(() => (geojson ? boundsFromGeojson(geojson) : null), [geojson]);
  const kindCounts = useMemo(() => getGeojsonChangeKindCounts(geojson), [geojson]);
  const leafletBounds = useMemo(
    () => (bounds ? ([bounds.sw, bounds.ne] as [LatLng, LatLng]) : null),
    [bounds],
  );

  function styleForFeature(feature: Feature | undefined) {
    const kind = normalizeChangeKind(feature?.properties);
    if (kind === 'removed') {
      // demolished / removed
      return { color: '#dc1e1e', weight: 2, fillColor: '#dc1e1e', fillOpacity: 0.3 };
    }
    if (kind === 'added') {
      return { color: '#00c83c', weight: 2, fillColor: '#00c83c', fillOpacity: 0.3 };
    }
    if (kind === 'modified') {
      return { color: '#ffc800', weight: 2, fillColor: '#ffc800', fillOpacity: 0.3 };
    }
    if (kind === 'unchanged') {
      return { color: '#8c8c8c', weight: 2, fillColor: '#8c8c8c', fillOpacity: 0.2 };
    }
    return { color: '#334155', weight: 2, fillColor: '#cbd5e1', fillOpacity: 0.2 };
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">change.geojson</div>
      <div className="h-80 w-full">
        {error ? (
          <div className="p-4 text-sm text-rose-700">{error}</div>
        ) : coordinateSpace === 'pixel' ? (
          <div className="p-4 text-sm text-slate-700">
            This GeoJSON uses pixel coordinates (`properties.crs = &quot;pixel&quot;`), so it cannot be plotted on
            the Leaflet basemap. Download the file to inspect the pixel-space change boxes directly.
          </div>
        ) : !geojson ? (
          <div className="p-4 text-sm text-slate-600">Loading GeoJSON…</div>
        ) : !leafletBounds ? (
          <div className="p-4 text-sm text-slate-600">No mappable geometry found in GeoJSON.</div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-700">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#00c83c' }} />
                Added: {kindCounts.added}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#dc1e1e' }} />
                Demolished: {kindCounts.removed}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#ffc800' }} />
                Modified: {kindCounts.modified}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#8c8c8c' }} />
                Unchanged: {kindCounts.unchanged}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <MapContainer style={{ height: '100%', width: '100%' }} bounds={leafletBounds}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds bounds={bounds} />
                <GeoJSON data={geojson as unknown as GeoJsonObject} style={styleForFeature} />
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
