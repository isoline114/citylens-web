import { describe, expect, it } from 'vitest';

import { explainParcel } from './parcel-intel-explain';
import type { ParcelIntelRow } from '@/lib/api';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3000000001',
    address: 'TEST ST',
    borough: 'BK',
    score_calibrated: 0.95,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    lot_area_sqft: 5000,
    allowed_far: 4,
    max_floor_area_sqft: 20000,
    unused_floor_area_sqft: 15000,
    far_utilization_pct: 25,
    zoning_district_1: 'R7A',
    land_use: '11',
    year_built: 0,
    num_floors: 0,
    lat: 40.7,
    lng: -73.9,
    last_sale_price: null,
    last_sale_year: null,
    years_held: null,
    has_recent_sale_5yr: false,
    is_landmark: false,
    is_historic_district: false,
    block_id: '300000',
    block_rank: 1,
    top_features: [],
    ...overrides,
  };
}

describe('explainParcel', () => {
  it('flags vacant residential land as the strongest signal', () => {
    const reasons = explainParcel(row({ land_use: '11', zoning_district_1: 'R6B' }));
    expect(reasons[0].label).toMatch(/Vacant land in residential zone/i);
    expect(reasons[0].tone).toBe('positive');
  });

  it('reports underbuilt FAR with computed unused capacity', () => {
    const reasons = explainParcel(
      row({
        far_utilization_pct: 20,
        max_floor_area_sqft: 30_000,
        unused_floor_area_sqft: 24_000,
      }),
    );
    const farReason = reasons.find((r) => /allowed FAR built/i.test(r.label));
    expect(farReason).toBeDefined();
    expect(farReason!.detail).toContain('30,000');
    expect(farReason!.detail).toContain('24,000');
  });

  it('reports a recent priced sale with year + held duration', () => {
    const reasons = explainParcel(
      row({
        has_recent_sale_5yr: true,
        last_sale_price: 5_500_000,
        last_sale_year: 2022,
        years_held: 4,
      }),
    );
    const saleReason = reasons.find((r) => /Sold for/i.test(r.label));
    expect(saleReason).toBeDefined();
    expect(saleReason!.label).toMatch(/\$5\.5M/);
    expect(saleReason!.label).toMatch(/2022/);
    expect(saleReason!.detail).toMatch(/4 years ago/);
  });

  it('flags landmarks as a caution, not a positive signal', () => {
    const reasons = explainParcel(row({ is_landmark: true }));
    const landmarkReason = reasons.find((r) => /landmark/i.test(r.label));
    expect(landmarkReason).toBeDefined();
    expect(landmarkReason!.tone).toBe('caution');
  });

  it('flags historic district when not also a landmark', () => {
    const reasons = explainParcel(
      row({ is_landmark: false, is_historic_district: true }),
    );
    const hd = reasons.find((r) => /historic district/i.test(r.label));
    expect(hd).toBeDefined();
    expect(hd!.tone).toBe('caution');
  });

  it('mentions assemblage rank when block_rank > 1', () => {
    const reasons = explainParcel(
      row({ block_rank: 2, block_id: '506662' }),
    );
    const blockReason = reasons.find((r) => /on this block/i.test(r.label));
    expect(blockReason).toBeDefined();
    expect(blockReason!.detail).toContain('506662');
  });

  it('falls back to a generic "strong combined signal" when no rule matches', () => {
    // High score, but doesn't satisfy any specific rule (commercial use,
    // no recent sale, no LPC flag, normal year, no block annotation).
    const reasons = explainParcel(
      row({
        score_calibrated: 0.92,
        land_use: '05',
        zoning_district_1: 'C2-4',
        year_built: 1985,
        lot_area_sqft: 20_000,
        far_utilization_pct: 65,
        unused_floor_area_sqft: 1_000,
        has_recent_sale_5yr: false,
        last_sale_price: null,
        block_rank: 1,
      }),
    );
    expect(reasons.length).toBe(1);
    expect(reasons[0].label).toMatch(/combined signal/i);
  });

  it('returns no reasons for a low-score parcel that misses every rule', () => {
    const reasons = explainParcel(
      row({
        score_calibrated: 0.4,
        land_use: '05',
        zoning_district_1: 'C1-2',
        far_utilization_pct: 65,
        unused_floor_area_sqft: 1_000,
        has_recent_sale_5yr: false,
        last_sale_price: null,
      }),
    );
    expect(reasons).toEqual([]);
  });
});
