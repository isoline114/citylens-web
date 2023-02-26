import { describe, expect, it } from 'vitest';

import type { ParcelIntelRow } from '@/lib/api';
import {
  BAND_COLORS,
  bandBoundaries,
  colorForRank,
  legendBands,
  membershipKey,
  scoreRankByBbl,
} from './parcel-intel-map-support';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3000000001',
    address: 'TEST ST',
    borough: 'BK',
    score_calibrated: 0.5,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    lot_area_sqft: 5000,
    allowed_far: 4,
    max_floor_area_sqft: 20000,
    unused_floor_area_sqft: 15000,
    far_utilization_pct: 25,
    zoning_district_1: 'R7A',
    land_use: '11',
    year_built: 1900,
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
    redev_status: 'still_vacant',
    top_features: [],
    ...overrides,
  };
}

describe('legendBands', () => {
  it('matches band math for 100 rows', () => {
    expect(legendBands(100).map((b) => b.label)).toEqual([
      'Top 10',
      '11-30',
      '31-60',
      '61+',
    ]);
  });

  it('matches band math for 1000 rows', () => {
    expect(legendBands(1000).map((b) => b.label)).toEqual([
      'Top 100',
      '101-300',
      '301-600',
      '601+',
    ]);
  });

  it('drops degenerate bands at tiny row counts', () => {
    // total=3 → b1=b2=b3=1; only "Top 1" and the rest band survive.
    expect(legendBands(3).map((b) => b.label)).toEqual(['Top 1', '2+']);
  });

  it('colors line up with the marker palette', () => {
    const bands = legendBands(1000);
    expect(bands.map((b) => b.color)).toEqual([
      BAND_COLORS.top,
      BAND_COLORS.high,
      BAND_COLORS.mid,
      BAND_COLORS.rest,
    ]);
  });
});

describe('colorForRank', () => {
  it('uses the same boundaries as the legend (total=1000)', () => {
    const { b1, b2, b3 } = bandBoundaries(1000);
    expect([b1, b2, b3]).toEqual([100, 300, 600]);
    // rank is 0-based; boundary b means ranks 0..b-1 are inside the band.
    expect(colorForRank(0, 1000)).toBe(BAND_COLORS.top);
    expect(colorForRank(99, 1000)).toBe(BAND_COLORS.top);
    expect(colorForRank(100, 1000)).toBe(BAND_COLORS.high);
    expect(colorForRank(299, 1000)).toBe(BAND_COLORS.high);
    expect(colorForRank(300, 1000)).toBe(BAND_COLORS.mid);
    expect(colorForRank(599, 1000)).toBe(BAND_COLORS.mid);
    expect(colorForRank(600, 1000)).toBe(BAND_COLORS.rest);
    expect(colorForRank(999, 1000)).toBe(BAND_COLORS.rest);
  });

  it('uses the same boundaries as the legend (total=100)', () => {
    expect(colorForRank(9, 100)).toBe(BAND_COLORS.top);
    expect(colorForRank(10, 100)).toBe(BAND_COLORS.high);
    expect(colorForRank(29, 100)).toBe(BAND_COLORS.high);
    expect(colorForRank(30, 100)).toBe(BAND_COLORS.mid);
    expect(colorForRank(59, 100)).toBe(BAND_COLORS.mid);
    expect(colorForRank(60, 100)).toBe(BAND_COLORS.rest);
  });
});

describe('scoreRankByBbl', () => {
  it('ranks by score descending, independent of row order', () => {
    const rows = [
      row({ bbl: '1', score_calibrated: 0.2 }),
      row({ bbl: '2', score_calibrated: 0.9 }),
      row({ bbl: '3', score_calibrated: 0.5 }),
    ];
    const ranks = scoreRankByBbl(rows);
    expect(ranks.get('2')).toBe(0);
    expect(ranks.get('3')).toBe(1);
    expect(ranks.get('1')).toBe(2);

    // Same set re-sorted (as after a table sort) → identical ranks.
    const resorted = scoreRankByBbl([rows[1], rows[2], rows[0]]);
    expect(resorted).toEqual(ranks);
  });

  it('puts null scores last', () => {
    const ranks = scoreRankByBbl([
      row({ bbl: '1', score_calibrated: null }),
      row({ bbl: '2', score_calibrated: 0.1 }),
    ]);
    expect(ranks.get('2')).toBe(0);
    expect(ranks.get('1')).toBe(1);
  });
});

describe('membershipKey', () => {
  it('is stable across re-sorts of the same set', () => {
    const a = [row({ bbl: '1' }), row({ bbl: '2' }), row({ bbl: '3' })];
    const b = [a[2], a[0], a[1]];
    expect(membershipKey(a)).toBe(membershipKey(b));
  });

  it('changes when membership changes', () => {
    const a = [row({ bbl: '1' }), row({ bbl: '2' })];
    const b = [row({ bbl: '1' })];
    expect(membershipKey(a)).not.toBe(membershipKey(b));
  });
});
