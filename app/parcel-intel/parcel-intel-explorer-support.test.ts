import { describe, expect, it } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';
import {
  filterExplorerRows,
  explorerRowColor,
  sortExplorerRows,
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
  opportunity: 'all',
  query: '',
  ownerPortfolioId: null,
};

describe('parcel citywide explorer support', () => {
  it('combines borough, priority, opportunity, and search filters', () => {
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
        opportunity: 'vacant_site',
        query: 'downtown',
      }).map((item) => item.bbl),
    ).toEqual(['1000010001']);
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
        opportunity: 'uncommitted',
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
        opportunity: 'assemblage',
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
        opportunity: 'tax_lien',
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
        opportunity: 'violations',
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
        opportunity: 'floodplain',
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
        opportunity: 'environmental_review',
      }).map((item) => item.bbl),
    ).toEqual(['review']);
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
        opportunity: 'portfolio',
      }).map((item) => item.bbl),
    ).toEqual(['portfolio-a', 'portfolio-b']);
    expect(
      filterExplorerRows(rows, {
        ...filters,
        opportunity: 'portfolio',
        ownerPortfolioId: 'owner-b',
      }).map((item) => item.bbl),
    ).toEqual(['portfolio-b']);
  });
});
