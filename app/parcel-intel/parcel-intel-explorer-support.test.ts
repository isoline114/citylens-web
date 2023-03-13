import { describe, expect, it } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';
import {
  EXPLORER_SCREEN_RECIPES,
  buildExplorerScreenAudit,
  filterExplorerRows,
  explorerRowColor,
  isScreenRecipeActive,
  sortExplorerRows,
  summarizeExplorerScreen,
  type ExplorerFilters,
} from './parcel-intel-explorer-support';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3000010001',
    address: '100 Example Ave',
    borough: 'brooklyn',
    score_calibrated: 0.8,
    score_calibrated_p10: 0.7,
    score_calibrated_p90: 0.9,
    priority_rank: 10,
    priority_tier: 'high',
    lot_area_sqft: 5000,
    allowed_far: 2,
    max_floor_area_sqft: 10000,
    unused_floor_area_sqft: 4000,
    far_utilization_pct: 60,
    zoning_district_1: 'R6',
    land_use: '01',
    year_built: 1920,
    num_floors: 2,
    lat: 40.65,
    lng: -73.95,
    last_sale_price: 1000000,
    last_sale_year: 2010,
    years_held: 16,
    has_recent_sale_5yr: false,
    is_landmark: false,
    is_historic_district: false,
    block_id: '300001',
    block_rank: 1,
    owner_name: 'Example Owner LLC',
    top_features: [],
    redev_status: 'still_vacant',
    opportunity_category: 'ground_up_candidate',
    ...overrides,
  };
}

const filters: ExplorerFilters = {
  borough: 'all',
  priority: 'all',
  siteType: 'all',
  signals: [],
  minLotAreaSqft: null,
  minUnusedFloorAreaSqft: null,
  query: '',
  ownerPortfolioId: null,
};

describe('parcel citywide explorer support', () => {
  it('combines borough, priority, site type, and search filters', () => {
    const rows = [
      row({ bbl: '3000010001' }),
      row({
        bbl: '1000010001',
        address: '12 Broadway',
        borough: 'manhattan',
        priority_tier: 'highest',
        opportunity_category: 'vacant_site',
        owner_name: 'Downtown Sites LLC',
      }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        borough: 'manhattan',
        priority: 'highest',
        siteType: 'vacant_site',
        query: 'downtown',
      }).map((item) => item.bbl),
    ).toEqual(['1000010001']);
  });

  it('requires source-backed numeric site criteria and excludes missing values', () => {
    const rows = [
      row({
        bbl: 'meets-both',
        citywide_rank: 8,
        lot_area_sqft: 5_000,
        unused_floor_area_sqft: 10_000,
      }),
      row({
        bbl: 'lot-too-small',
        citywide_rank: 2,
        lot_area_sqft: 4_999,
        unused_floor_area_sqft: 20_000,
      }),
      row({
        bbl: 'capacity-too-small',
        citywide_rank: 1,
        lot_area_sqft: 8_000,
        unused_floor_area_sqft: 9_999,
      }),
      row({
        bbl: 'capacity-missing',
        citywide_rank: 3,
        lot_area_sqft: 8_000,
        unused_floor_area_sqft: null,
      }),
    ];

    const result = filterExplorerRows(rows, {
      ...filters,
      minLotAreaSqft: 5_000,
      minUnusedFloorAreaSqft: 10_000,
    });

    expect(result.map((item) => item.bbl)).toEqual(['meets-both']);
    expect(result[0]?.citywide_rank).toBe(8);
  });

  it('sorts priority rank first and score second', () => {
    const rows = [
      row({ bbl: 'a', priority_rank: 20, score_calibrated: 0.99 }),
      row({ bbl: 'b', priority_rank: 2, score_calibrated: 0.5 }),
      row({ bbl: 'c', priority_rank: 2, score_calibrated: 0.9 }),
    ];

    expect(sortExplorerRows(rows).map((item) => item.bbl)).toEqual(['c', 'b', 'a']);
  });

  it('colors rows by the selected overlay', () => {
    const item = row({
      borough: 'brooklyn',
      priority_tier: 'highest',
      opportunity_category: 'vacant_site',
    });

    expect(explorerRowColor(item, 'priority')).toBe('#dc2626');
    expect(explorerRowColor(item, 'opportunity')).toBe('#16a34a');
    expect(explorerRowColor(item, 'borough')).toBe('#059669');
  });

  it('groups vacant, ground-up, and conversion parcels as uncommitted', () => {
    const rows = [
      row({
        bbl: 'vacant',
        acquisition_eligible: null,
        opportunity_category: 'vacant_site',
      }),
      row({ bbl: 'ground-up', opportunity_category: 'ground_up_candidate' }),
      row({ bbl: 'conversion', opportunity_category: 'conversion_or_overbuilt' }),
      row({
        bbl: 'active',
        acquisition_eligible: null,
        opportunity_category: 'active_project',
      }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        siteType: 'uncommitted',
      }).map((item) => item.bbl),
    ).toEqual(['vacant', 'ground-up', 'conversion']);
  });

  it('filters multi-lot common-owner assemblages', () => {
    const rows = [
      row({ bbl: 'single', assemblage_lot_count: null }),
      row({ bbl: 'pair', assemblage_lot_count: 2 }),
      row({ bbl: 'cluster', assemblage_lot_count: 4 }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['assemblage'],
      }).map((item) => item.bbl),
    ).toEqual(['pair', 'cluster']);
  });

  it('filters official final tax-lien sale history without treating it as a score', () => {
    const rows = [
      row({ bbl: 'no-record', tax_lien_sale_year: null }),
      row({ bbl: 'final-sale', tax_lien_sale_year: 2025 }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['tax_lien'],
      }).map((item) => item.bbl),
    ).toEqual(['final-sale']);
  });

  it('filters parcels with official immediate-hazard violation records', () => {
    const rows = [
      row({ bbl: 'none', critical_violation_count: 0 }),
      row({ bbl: 'critical', critical_violation_count: 3 }),
      row({ bbl: 'not-loaded', critical_violation_count: null }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['violations'],
      }).map((item) => item.bbl),
    ).toEqual(['critical']);
  });

  it('filters parcels with either official 1% floodplain overlap flag', () => {
    const rows = [
      row({ bbl: 'outside', floodplain_1pct: false }),
      row({ bbl: 'overlap', floodplain_1pct: true }),
      row({ bbl: 'not-loaded', floodplain_1pct: null }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['floodplain'],
      }).map((item) => item.bbl),
    ).toEqual(['overlap']);
  });

  it('filters parcels with a current PLUTO environmental designation', () => {
    const rows = [
      row({ bbl: 'none', environmental_review_required: false }),
      row({
        bbl: 'review',
        environmental_review_required: true,
        environmental_designation_number: 'R-14',
        environmental_designation_kind: 'restrictive_declaration',
      }),
      row({ bbl: 'not-loaded', environmental_review_required: null }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['environmental_review'],
      }).map((item) => item.bbl),
    ).toEqual(['review']);
  });

  it('filters current NYC Planning MIH mapped-area overlaps', () => {
    const rows = [
      row({ bbl: 'outside', mandatory_inclusionary_housing: false }),
      row({ bbl: 'overlap', mandatory_inclusionary_housing: true }),
      row({ bbl: 'not-loaded', mandatory_inclusionary_housing: null }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['mih'],
      }).map((item) => item.bbl),
    ).toEqual(['overlap']);
  });

  it('filters current MTA station proximity within 800 straight-line meters', () => {
    const rows = [
      row({ bbl: 'near', nearest_transit_station_distance_m: 420 }),
      row({ bbl: 'boundary', nearest_transit_station_distance_m: 800 }),
      row({ bbl: 'far', nearest_transit_station_distance_m: 801 }),
      row({ bbl: 'not-loaded', nearest_transit_station_distance_m: null }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['transit_800m'],
      }).map((item) => item.bbl),
    ).toEqual(['near', 'boundary']);
  });

  it('filters multi-lot legal-owner portfolios without changing rank order', () => {
    const rows = [
      row({ bbl: 'single', owner_portfolio_lot_count: 1 }),
      row({
        bbl: 'portfolio-a',
        citywide_rank: 8,
        owner_portfolio_id: 'owner-a',
        owner_portfolio_lot_count: 4,
      }),
      row({
        bbl: 'portfolio-b',
        citywide_rank: 12,
        owner_portfolio_id: 'owner-b',
        owner_portfolio_lot_count: 9,
      }),
    ];

    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['portfolio'],
      }).map((item) => item.bbl),
    ).toEqual(['portfolio-a', 'portfolio-b']);
    expect(
      filterExplorerRows(rows, {
        ...filters,
        signals: ['portfolio'],
        ownerPortfolioId: 'owner-b',
      }).map((item) => item.bbl),
    ).toEqual(['portfolio-b']);
  });

  it('requires every selected evidence signal without changing rank', () => {
    const rows = [
      row({
        bbl: 'all-signals',
        citywide_rank: 4,
        nearest_transit_station_distance_m: 500,
        years_held: 18,
        recent_change: true,
      }),
      row({
        bbl: 'not-long-held',
        citywide_rank: 2,
        nearest_transit_station_distance_m: 500,
        years_held: 4,
        recent_change: true,
      }),
      row({
        bbl: 'no-change',
        citywide_rank: 1,
        nearest_transit_station_distance_m: 500,
        years_held: 20,
        recent_change: false,
      }),
    ];

    const result = filterExplorerRows(rows, {
      ...filters,
      siteType: 'uncommitted',
      signals: ['transit_800m', 'long_held', 'recent_change'],
    });

    expect(result.map((item) => item.bbl)).toEqual(['all-signals']);
    expect(result[0]?.citywide_rank).toBe(4);
  });

  it('summarizes the current result set without turning it into a score', () => {
    const universe = [
      row({
        bbl: 'brooklyn-large',
        borough: 'brooklyn',
        unused_floor_area_sqft: 12_000,
        lot_area_sqft: 6_000,
      }),
      row({
        bbl: 'brooklyn-small',
        borough: 'brooklyn',
        unused_floor_area_sqft: 4_000,
        lot_area_sqft: 2_000,
      }),
      row({
        bbl: 'queens-middle',
        borough: 'queens',
        unused_floor_area_sqft: 8_000,
        lot_area_sqft: 4_000,
      }),
      row({
        bbl: 'excluded',
        borough: 'manhattan',
        unused_floor_area_sqft: 1_000,
        lot_area_sqft: 1_000,
      }),
    ];

    expect(summarizeExplorerScreen(universe.slice(0, 3), universe)).toEqual({
      matchCount: 3,
      universeCount: 4,
      matchRatePct: 75,
      medianUnusedFloorAreaSqft: 8_000,
      medianLotAreaSqft: 4_000,
      topBorough: 'brooklyn',
      topBoroughCount: 2,
    });
  });

  it('audits each active condition independently and exposes numeric source coverage', () => {
    const rows = [
      row({
        bbl: 'all-pass',
        lot_area_sqft: 6_000,
        unused_floor_area_sqft: 12_000,
        years_held: 20,
      }),
      row({
        bbl: 'lot-too-small',
        lot_area_sqft: 4_000,
        unused_floor_area_sqft: 15_000,
        years_held: 20,
      }),
      row({
        bbl: 'capacity-missing',
        lot_area_sqft: 7_000,
        unused_floor_area_sqft: null,
        years_held: 20,
      }),
      row({
        bbl: 'not-long-held',
        lot_area_sqft: 8_000,
        unused_floor_area_sqft: 20_000,
        years_held: 2,
      }),
      row({
        bbl: 'overlapping-failures',
        lot_area_sqft: 2_000,
        unused_floor_area_sqft: 20_000,
        years_held: 2,
      }),
    ];

    const audit = buildExplorerScreenAudit(rows, {
      ...filters,
      signals: ['long_held'],
      minLotAreaSqft: 5_000,
      minUnusedFloorAreaSqft: 10_000,
    });

    expect(audit.matchCount).toBe(1);
    expect(audit.loadedCount).toBe(5);
    expect(audit.criteriaCount).toBe(3);
    expect(
      audit.criteria.find((item) => item.id === 'signal:long_held'),
    ).toMatchObject({
      relaxedMatchCount: 2,
      addedIfRelaxed: 1,
    });
    expect(
      audit.criteria.find((item) => item.id === 'min_lot_area_sqft'),
    ).toMatchObject({
      relaxedMatchCount: 2,
      addedIfRelaxed: 1,
      coverageScopeCount: 2,
      knownValueCount: 2,
      missingValueCount: 0,
      knownValueRatePct: 100,
    });
    expect(
      audit.criteria.find(
        (item) => item.id === 'min_unused_floor_area_sqft',
      ),
    ).toMatchObject({
      relaxedMatchCount: 2,
      addedIfRelaxed: 1,
      coverageScopeCount: 2,
      knownValueCount: 1,
      missingValueCount: 1,
      knownValueRatePct: 50,
    });
  });

  it('recognizes recipes by exact, order-independent filter semantics', () => {
    const recipe = EXPLORER_SCREEN_RECIPES.find(
      (item) => item.id === 'transit_infill',
    );
    expect(recipe).toBeDefined();
    expect(
      isScreenRecipeActive(
        {
          ...filters,
          priority: 'high_or_better',
          siteType: 'uncommitted',
          signals: ['long_held', 'transit_800m'],
        },
        recipe!,
      ),
    ).toBe(true);
    expect(
      isScreenRecipeActive(
        {
          ...filters,
          priority: 'high_or_better',
          siteType: 'uncommitted',
          signals: ['transit_800m'],
        },
        recipe!,
      ),
    ).toBe(false);
  });
});
