import { describe, expect, it } from 'vitest';

import type { ParcelIntelRow } from '@/lib/api';
import { buildCsv, flattenTopFeatures } from './parcel-intel-csv';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3050290001',
    address: '100 E 21ST ST',
    borough: 'BK',
    score_calibrated: 0.9,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    priority_rank: 1,
    priority_tier: 'highest',
    model_rank: 42,
    acquisition_rank: 1,
    citywide_rank: 1,
    acquisition_eligible: true,
    acquisition_status: 'eligible',
    acquisition_exclusion_reasons: [],
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
    last_sale_price: 1500000,
    last_sale_year: 2021,
    years_held: 5,
    has_recent_sale_5yr: true,
    is_landmark: false,
    is_historic_district: false,
    block_id: '305029',
    block_rank: 1,
    redev_status: 'still_vacant',
    opportunity_category: 'ground_up_candidate',
    top_features: [],
    ...overrides,
  };
}

const EXPECTED_HEADER =
  'Address,BBL,Borough,NYC acquisition rank,Borough acquisition rank,Original model rank,' +
  'Priority tier,Acquisition eligible,Acquisition status,Exclusion reasons,Opportunity,' +
  'Zoning,Land use,Lot area (sqft),Allowed FAR,Built FAR %,Unused floor area (sqft),' +
  'Last sale price,Last sale year,Years held,Owner,Owner source,PLUTO owner type,Landmark,Historic district,' +
  'Status,Latest project type,Latest project filing year,Latest project status,' +
  'Latest project job number,PLUTO facts as of,ACRIS ownership as of,DOB activity as of,' +
  'Imagery observed through,Top model factors';

describe('buildCsv', () => {
  it('emits the whitelisted human-label header row', () => {
    const lines = buildCsv([row({})]).split('\n');
    expect(lines[0]).toBe(EXPECTED_HEADER);
  });

  it('returns only the header row for empty input', () => {
    expect(buildCsv([])).toBe(EXPECTED_HEADER);
  });

  it('serializes a row with expected values and no [object Object]', () => {
    const csv = buildCsv([
      row({
        top_features: [
          { name: 'lot_area', value: 5000, contribution_logit: 0.8, contribution_pct: 0.32 },
        ],
      }),
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    const cells = lines[1].split(',');
    expect(cells.slice(0, 10)).toEqual([
      '100 E 21ST ST',
      '3050290001',
      'BK',
      '1',
      '1',
      '42',
      'highest',
      'yes',
      'eligible',
      '',
    ]);
    expect(lines[1]).toContain(',ground_up_candidate,R7A,11,5000,4,25,15000,');
    expect(lines[1].endsWith(',lot_area (+32%)')).toBe(true);
    expect(csv).not.toContain('[object Object]');
  });

  it('quotes fields containing commas, quotes, and newlines', () => {
    const csv = buildCsv([
      row({
        address: '100 MAIN ST, UNIT "A"',
        zoning_district_1: 'R7\nA',
      }),
    ]);
    const body = csv.slice(csv.indexOf('\n') + 1);
    expect(body.startsWith('"100 MAIN ST, UNIT ""A""",')).toBe(true);
    expect(body).toContain('"R7\nA"');
  });

  it('renders null/undefined fields as empty cells', () => {
    const csv = buildCsv([
      row({
        address: null,
        priority_rank: null,
        acquisition_rank: null,
        citywide_rank: null,
        last_sale_price: null,
        last_sale_year: null,
        years_held: null,
        unused_floor_area_sqft: null,
        far_utilization_pct: null,
      }),
    ]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[0]).toBe(''); // Address
    expect(cells[3]).toBe(''); // No invented citywide rank
    expect(cells[4]).toBe(''); // No invented borough rank
    expect(cells[16]).toBe(''); // Unused floor area
    expect(cells[17]).toBe(''); // Last sale price
  });

  it('flattens top_features into a single semicolon-joined column', () => {
    const csv = buildCsv([
      row({
        top_features: [
          { name: 'lot_area', value: 5000, contribution_logit: 0.85, contribution_pct: 0.32 },
          { name: 'zoning_district', value: 'R7A', contribution_logit: -0.4, contribution_pct: 0.18 },
        ],
      }),
    ]);
    const body = csv.split('\n')[1];
    // Semicolons (not commas) join factors, so the column needs no quoting.
    expect(body.endsWith(',lot_area (+32%); zoning_district (-18%)')).toBe(true);
  });

  it('never invents a rank for an excluded high-scoring parcel', () => {
    const csv = buildCsv([
      row({
        bbl: '1000000001',
        score_calibrated: 0.99,
        priority_rank: null,
        acquisition_rank: null,
        citywide_rank: null,
        acquisition_eligible: false,
        acquisition_status: 'active_project',
        acquisition_exclusion_reasons: ['active_project'],
      }),
    ]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[3]).toBe('');
    expect(cells[4]).toBe('');
    expect(cells[7]).toBe('no');
    expect(cells[8]).toBe('active_project');
    expect(cells[9]).toBe('active_project');
  });
});

describe('flattenTopFeatures', () => {
  it('returns empty string for empty or missing features', () => {
    expect(flattenTopFeatures([])).toBe('');
    expect(flattenTopFeatures(null)).toBe('');
    expect(flattenTopFeatures(undefined)).toBe('');
  });

  it('formats name + signed contribution percent', () => {
    expect(
      flattenTopFeatures([
        { name: 'lot_area', value: 1, contribution_logit: 1.2, contribution_pct: 0.315 },
        { name: 'is_landmark', value: false, contribution_logit: -0.1, contribution_pct: 0.07 },
      ]),
    ).toBe('lot_area (+32%); is_landmark (-7%)');
  });
});
