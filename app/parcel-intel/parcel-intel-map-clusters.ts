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
    radius: 52,
    maxZoom: 16,
    minPoints: 3,
    nodeSize: 64,
  }).load(points);
}

export function countRowsInBounds(
  rows: ParcelExplorerRow[],
  bounds: BBox,
): number {
  const [west, south, east, north] = bounds;
  return rows.reduce((count, row) => {
    if (typeof row.lat !== 'number' || typeof row.lng !== 'number') {
      return count;
    }
    return row.lng >= west &&
      row.lng <= east &&
      row.lat >= south &&
      row.lat <= north
      ? count + 1
      : count;
  }, 0);
}

export function clusterMarkerDiameter(pointCount: number): number {
  if (pointCount >= 1_000) return 54;
  if (pointCount >= 250) return 48;
  if (pointCount >= 50) return 42;
  return 36;
}
