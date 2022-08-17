'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

type LatLng = [number, number];

function boundsFromGeojson(fc: FeatureCollection): { sw: LatLng; ne: LatLng } | null {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  function considerCoord(coord: any) {
    if (!Array.isArray(coord) || coord.length < 2) return;
    const [lng, lat] = coord;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    minLat = Math.min(minLat, lat);
    minLng = Math.min(minLng, lng);
    maxLat = Math.max(maxLat, lat);
    maxLng = Math.max(maxLng, lng);
  }

  function walkCoords(coords: any) {
    if (!coords) return;
    if (typeof coords[0] === 'number') {
      considerCoord(coords);
      return;
    }
    if (Array.isArray(coords)) {
      for (const c of coords) walkCoords(c);
    }
  }

  for (const f of fc.features ?? []) {
    const g: any = f?.geometry;
    if (!g) continue;
    walkCoords(g.coordinates);
  }

  if (!isFinite(minLat) || !isFinite(minLng) || !isFinite(maxLat) || !isFinite(maxLng)) return null;
  return { sw: [minLat, minLng], ne: [maxLat, maxLng] };
}

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
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const bounds = useMemo(() => (geojson ? boundsFromGeojson(geojson) : null), [geojson]);
  const leafletBounds = useMemo(
    () => (bounds ? ([bounds.sw, bounds.ne] as [LatLng, LatLng]) : null),
    [bounds],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">change.geojson</div>
      <div className="h-80 w-full">
        {error ? (
          <div className="p-4 text-sm text-rose-700">{error}</div>
        ) : !geojson ? (
          <div className="p-4 text-sm text-slate-600">Loading GeoJSON…</div>
        ) : !leafletBounds ? (
          <div className="p-4 text-sm text-slate-600">No mappable geometry found in GeoJSON.</div>
        ) : (
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            bounds={leafletBounds}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds bounds={bounds} />
            <GeoJSON data={geojson as any} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
