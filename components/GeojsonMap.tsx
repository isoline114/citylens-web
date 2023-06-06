'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties, GeoJsonObject } from 'geojson';
import { Download } from 'lucide-react';
import { OpenStreetMapBasemap } from '@/components/OpenStreetMapBasemap';
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
    <div className="overflow-hidden border-t border-rule bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="text-sm font-medium">change.geojson</div>
        <a
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
          data-testid="artifact-change-download"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
      <div className="h-80 w-full">
        {error ? (
          <div className="p-4 text-sm text-red-700">{error}</div>
        ) : coordinateSpace === 'pixel' ? (
          <div className="p-4 text-sm text-ink-2">
            This GeoJSON uses pixel coordinates (`properties.crs = &quot;pixel&quot;`), so it cannot be plotted on
            the Leaflet basemap. Download the file to inspect the pixel-space change boxes directly.
          </div>
        ) : !geojson ? (
          <div className="p-4 text-sm text-ink-2">Loading GeoJSON…</div>
        ) : !leafletBounds ? (
          <div className="p-4 text-sm text-ink-2">No mappable geometry found in GeoJSON.</div>
        ) : (
          <div className="flex h-full flex-col">
            <div aria-label="Model-detected change legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule px-4 py-2 text-xs text-ink-2">
              <span>Model-detected</span>
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#00c83c' }} />
                Added: {kindCounts.added}
              </span>
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#dc1e1e' }} />
                Demolished: {kindCounts.removed}
              </span>
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#ffc800' }} />
                Modified: {kindCounts.modified}
              </span>
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#8c8c8c' }} />
                Unchanged: {kindCounts.unchanged}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <MapContainer style={{ height: '100%', width: '100%' }} bounds={leafletBounds}>
                <OpenStreetMapBasemap />
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
