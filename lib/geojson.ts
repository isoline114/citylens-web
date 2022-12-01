import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';

export type GeojsonCoordinateSpace = 'pixel' | 'geographic' | 'unknown';
export type ChangeKind = 'added' | 'removed' | 'other';

export function getGeojsonChangeKindCounts(
  fc: FeatureCollection<Geometry, GeoJsonProperties> | null | undefined,
): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, removed: 0, other: 0 };
  if (!fc || !Array.isArray(fc.features)) return counts;
  for (const feature of fc.features) {
    const props = feature?.properties;
    const kind =
      props && typeof props === 'object' && typeof (props as Record<string, unknown>).kind === 'string'
        ? String((props as Record<string, unknown>).kind).toLowerCase()
        : 'other';
    if (kind === 'added' || kind === 'removed') counts[kind] += 1;
    else counts.other += 1;
  }
  return counts;
}

function considerCoord(
  coord: unknown,
  state: { minLat: number; minLng: number; maxLat: number; maxLng: number },
) {
  if (!Array.isArray(coord) || coord.length < 2) return;
  const [lng, lat] = coord;
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  state.minLat = Math.min(state.minLat, lat);
  state.minLng = Math.min(state.minLng, lng);
  state.maxLat = Math.max(state.maxLat, lat);
  state.maxLng = Math.max(state.maxLng, lng);
}

function walkCoords(
  coords: unknown,
  state: { minLat: number; minLng: number; maxLat: number; maxLng: number },
) {
  if (!coords) return;
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    considerCoord(coords as unknown, state);
    return;
  }
  if (Array.isArray(coords)) {
    for (const c of coords) walkCoords(c, state);
  }
}

export function getGeojsonCoordinateSpace(
  fc: FeatureCollection<Geometry, GeoJsonProperties> | null | undefined,
): GeojsonCoordinateSpace {
  if (!fc || !Array.isArray(fc.features)) return 'unknown';
  for (const feature of fc.features) {
    const props = feature?.properties;
    if (props && typeof props === 'object' && (props as Record<string, unknown>).crs === 'pixel') {
      return 'pixel';
    }
  }
  return fc.features.length > 0 ? 'geographic' : 'unknown';
}

export function boundsFromGeojson(
  fc: FeatureCollection<Geometry, GeoJsonProperties>,
): { sw: [number, number]; ne: [number, number] } | null {
  const state = {
    minLat: Infinity,
    minLng: Infinity,
    maxLat: -Infinity,
    maxLng: -Infinity,
  };

  for (const f of fc.features ?? []) {
    const g = f?.geometry;
    if (!g || g.type === 'GeometryCollection') continue;
    walkCoords(g.coordinates as unknown, state);
  }

  if (
    !isFinite(state.minLat) ||
    !isFinite(state.minLng) ||
    !isFinite(state.maxLat) ||
    !isFinite(state.maxLng)
  ) {
    return null;
  }

  return {
    sw: [state.minLat, state.minLng],
    ne: [state.maxLat, state.maxLng],
  };
}
