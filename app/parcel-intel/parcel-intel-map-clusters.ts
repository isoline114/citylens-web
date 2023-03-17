import type { BBox } from 'geojson';
import Supercluster from 'supercluster';
import type { ParcelExplorerRow } from './parcel-intel-explorer-support';

export type ParcelMapPointProperties = {
  bbl: string;
};

export type ParcelMapClusterProperties = Record<string, never>;

export type ParcelMapFeature =
  | Supercluster.ClusterFeature<ParcelMapClusterProperties>
  | Supercluster.PointFeature<ParcelMapPointProperties>;

export const NYC_MAP_BBOX: BBox = [
  -74.2591,
  40.4774,
  -73.7002,
  40.9176,
];

export function isParcelClusterFeature(
  feature: ParcelMapFeature,
): feature is Supercluster.ClusterFeature<ParcelMapClusterProperties> {
  return 'cluster' in feature.properties && feature.properties.cluster === true;
}

export function buildParcelClusterIndex(rows: ParcelExplorerRow[]) {
  const points: Array<
    Supercluster.PointFeature<ParcelMapPointProperties>
  > = rows.flatMap((row) =>
    typeof row.lat === 'number' && typeof row.lng === 'number'
      ? [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [row.lng, row.lat],
            },
            properties: { bbl: row.bbl },
          },
        ]
      : [],
  );

  return new Supercluster<
    ParcelMapPointProperties,
    ParcelMapClusterProperties
  >({
    // Keep interactive cluster controls far enough apart for a 24px safe
    // touch area around the smallest 44px marker. This also reduces visual
    // collisions on the narrow citywide mobile map without hiding parcels:
    // every point remains available as the user zooms.
    radius: 72,
    maxZoom: 16,
    minPoints: 3,
    nodeSize: 64,
  }).load(points);
}

export function countRowsInBounds(
  rows: ParcelExplorerRow[],
  bounds: BBox,
): number {
  return rowBblsInBounds(rows, bounds).length;
}

export function rowBblsInBounds(
  rows: ParcelExplorerRow[],
  bounds: BBox,
): string[] {
  const [west, south, east, north] = bounds;
  return rows.flatMap((row) => {
    if (typeof row.lat !== 'number' || typeof row.lng !== 'number') {
      return [];
    }
    return row.lng >= west &&
      row.lng <= east &&
      row.lat >= south &&
      row.lat <= north
      ? [row.bbl]
      : [];
  });
}

export function clusterMarkerDiameter(pointCount: number): number {
  if (pointCount >= 1_000) return 56;
  if (pointCount >= 250) return 52;
  if (pointCount >= 50) return 48;
  return 44;
}
