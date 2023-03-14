import { describe, expect, it } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';
import {
  buildParcelClusterIndex,
  clusterMarkerDiameter,
  countRowsInBounds,
  isParcelClusterFeature,
  NYC_MAP_BBOX,
} from './parcel-intel-map-clusters';

function row(
  bbl: string,
  lat: number | null,
  lng: number | null,
): ParcelIntelRow {
  return {
    bbl,
    address: `${bbl} Example Avenue`,
    borough: 'brooklyn',
    score_calibrated: 0.8,
    score_calibrated_p10: 0.7,
    score_calibrated_p90: 0.9,
    priority_rank: 1,
    priority_tier: 'highest',
    lot_area_sqft: 5_000,
    allowed_far: 2,
    max_floor_area_sqft: 10_000,
    unused_floor_area_sqft: 5_000,
    far_utilization_pct: 50,
    zoning_district_1: 'R6',
    land_use: '01',
    year_built: 1920,
    num_floors: 2,
    lat,
    lng,
    last_sale_price: null,
    last_sale_year: null,
    years_held: null,
    has_recent_sale_5yr: false,
    is_landmark: false,
    is_historic_district: false,
    block_id: bbl.slice(0, 6),
    block_rank: 1,
    owner_name: null,
    top_features: [],
    redev_status: 'still_vacant',
    opportunity_category: 'ground_up_candidate',
  };
}

describe('parcel explorer map clustering', () => {
  it('clusters dense parcels and preserves every parcel as a leaf', () => {
    const rows = Array.from({ length: 100 }, (_, index) =>
      row(
        `300001${String(index).padStart(4, '0')}`,
        40.68 + index * 0.00001,
        -73.95 + index * 0.00001,
      ),
    );
    const index = buildParcelClusterIndex(rows);
    const features = index.getClusters(NYC_MAP_BBOX, 10);
    const cluster = features.find(isParcelClusterFeature);

    expect(cluster?.properties.point_count).toBe(100);
    expect(
      index.getLeaves(cluster?.properties.cluster_id ?? 0, Infinity),
    ).toHaveLength(100);
  });

  it('counts only mappable parcels inside the current viewport', () => {
    const rows = [
      row('inside', 40.7, -73.95),
      row('outside', 41.1, -73.95),
      row('missing', null, null),
    ];

    expect(countRowsInBounds(rows, NYC_MAP_BBOX)).toBe(1);
  });

  it('scales cluster controls without allowing unbounded markers', () => {
    expect(clusterMarkerDiameter(12)).toBe(36);
    expect(clusterMarkerDiameter(50)).toBe(42);
    expect(clusterMarkerDiameter(250)).toBe(48);
    expect(clusterMarkerDiameter(1_000)).toBe(54);
    expect(clusterMarkerDiameter(5_000)).toBe(54);
  });
});
