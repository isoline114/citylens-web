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
  'Last sale price,Last sale year,Years held,Final tax-lien sale date,Tax-lien water debt only,' +
  'Tax-lien data retrieved,DOB Safety active violations,DOB Safety latest issue,' +
  'OATH ECB active violations,OATH ECB Class 1 violations,OATH ECB reported balance,' +
  'OATH ECB latest issue,HPD open violations,HPD Class C violations,HPD latest inspection,' +
  'Immediate-hazard violations,Violation data retrieved,FEMA 2007 FIRM 1% tax-lot overlap,' +
  'FEMA 2015 PFIRM 1% tax-lot overlap,Any 1% floodplain tax-lot overlap,' +
  'Floodplain data retrieved,Environmental designation present,' +
  'Environmental designation type,Environmental designation number,' +
  'Environmental designation data retrieved,MIH mapped-area tax-lot overlap,' +
  'MIH mapped options,MIH area record count,MIH data retrieved,' +
  'Nearest MTA station complex ID,Nearest MTA station,' +
  'Nearest MTA station straight-line distance (m),Nearest MTA daytime routes,' +
  'Nearest MTA ADA status,MTA station complexes within 400 m,' +
  'MTA station complexes within 800 m,MTA straight-line access tier,' +
  'MTA station data retrieved,' +
  'Owner,Owner source,PLUTO owner type,' +
  'Owner entity type,Owner portfolio ID,Owner portfolio tax lots,' +
  'Owner portfolio boroughs,Owner portfolio lot area (sqft),' +
  'Owner portfolio current leads,Owner portfolio match method,' +
  'Owner portfolio data retrieved,' +
  'Landmark,Historic district,' +
  'Status,Latest project type,Latest project filing year,Latest project status,' +
  'Latest project job number,Latest official project URL,Decision evidence status,' +
  'Decision evidence label,Decision readiness,Recommended next diligence action,' +
  'PLUTO facts as of,ACRIS ownership as of,DOB activity as of,' +
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

  it('neutralizes spreadsheet formulas in source text without changing numbers', () => {
    const csv = buildCsv([
      row({
        address: '=1+1',
        owner_name: '@SUM(A1:A2)',
        last_sale_price: -125000,
      }),
    ]);
    const headers = EXPECTED_HEADER.split(',');
    const body = csv.split('\n')[1];
    expect(body.startsWith("'=1+1,")).toBe(true);
    const cells = body.split(',');
    expect(cells[headers.indexOf('Owner')]).toBe("'@SUM(A1:A2)");
    expect(cells[headers.indexOf('Last sale price')]).toBe('-125000');
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

  it('exports the current environmental designation as diligence, not a rank signal', () => {
    const csv = buildCsv([
      row({
        environmental_review_required: true,
        environmental_designation_number: 'R-14',
        environmental_designation_kind: 'restrictive_declaration',
        environmental_designation_data_as_of: '2026-07-24',
      }),
    ]);
    const headers = EXPECTED_HEADER.split(',');
    const cells = csv.split('\n')[1].split(',');
    expect(cells[headers.indexOf('Environmental designation present')]).toBe(
      'yes',
    );
    expect(cells[headers.indexOf('Environmental designation type')]).toBe(
      'restrictive_declaration',
    );
    expect(cells[headers.indexOf('Environmental designation number')]).toBe(
      'R-14',
    );
    expect(
      cells[headers.indexOf('Environmental designation data retrieved')],
    ).toBe('2026-07-24');
    expect(cells[headers.indexOf('NYC acquisition rank')]).toBe('1');
  });

  it('exports the current MIH mapped-area screen without changing rank', () => {
    const csv = buildCsv([
      row({
        mandatory_inclusionary_housing: true,
        mih_options: ['Option 1', 'Deep Affordability Option'],
        mih_area_count: 2,
        mih_data_as_of: '2026-07-24',
      }),
    ]);
    const headers = EXPECTED_HEADER.split(',');
    const cells = csv.split('\n')[1].split(',');
    expect(cells[headers.indexOf('MIH mapped-area tax-lot overlap')]).toBe(
      'yes',
    );
    expect(cells[headers.indexOf('MIH mapped options')]).toBe(
      'Option 1 | Deep Affordability Option',
    );
    expect(cells[headers.indexOf('MIH area record count')]).toBe('2');
    expect(cells[headers.indexOf('MIH data retrieved')]).toBe('2026-07-24');
    expect(cells[headers.indexOf('NYC acquisition rank')]).toBe('1');
  });

  it('exports dated MTA station proximity without changing rank', () => {
    const csv = buildCsv([
      row({
        nearest_transit_complex_id: '628',
        nearest_transit_station_name: 'Church Av',
        nearest_transit_station_distance_m: 420,
        nearest_transit_routes: ['B', 'Q'],
        nearest_transit_ada_status: 'full',
        transit_station_count_400m: 0,
        transit_station_count_800m: 2,
        transit_access_tier: 'walkable',
        transit_data_as_of: '2026-07-24',
      }),
    ]);
    const headers = EXPECTED_HEADER.split(',');
    const cells = csv.split('\n')[1].split(',');
    expect(cells[headers.indexOf('Nearest MTA station')]).toBe('Church Av');
    expect(
      cells[
        headers.indexOf('Nearest MTA station straight-line distance (m)')
      ],
    ).toBe('420');
    expect(cells[headers.indexOf('Nearest MTA daytime routes')]).toBe('B | Q');
    expect(cells[headers.indexOf('MTA station complexes within 800 m')]).toBe(
      '2',
    );
    expect(cells[headers.indexOf('MTA station data retrieved')]).toBe(
      '2026-07-24',
    );
    expect(cells[headers.indexOf('NYC acquisition rank')]).toBe('1');
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

  it('exports only HTTPS project evidence and the server-owned decision posture', () => {
    const csv = buildCsv([
      row({
        latest_project_job_number: '2023K0205',
        latest_project_status: 'Completed — approved',
        latest_project_url:
          'https://zap.planning.nyc.gov/projects/2023K0205',
        decision_audit: {
          schema_version: 'citylens/parcel-decision-audit@v1',
          overall_status: 'screened_with_flags',
          overall_label: 'Eligible lead with diligence flags',
          readiness: {
            status: 'review_required',
            label: 'Review project activity',
            recommended_action: 'Open the cited project record.',
            blockers: [],
            review_items: ['Project activity'],
            cleared_items: [],
            disclaimer: 'Screening only.',
          },
          validation: {
            target: 'dob_nb_job_filing',
            evaluation_scope: 'Historical forward test',
            precision_at_100: 0.34,
            precision_at_1000: 0.104,
            base_rate: 0.0012,
            prospective_validated: false,
            disclaimer: 'Not seller intent.',
          },
          checks: [],
          limitations: [],
        },
      }),
    ]);
    const headers = EXPECTED_HEADER.split(',');
    const cells = csv.split('\n')[1].split(',');
    expect(cells[headers.indexOf('Latest official project URL')]).toBe(
      'https://zap.planning.nyc.gov/projects/2023K0205',
    );
    expect(cells[headers.indexOf('Decision evidence status')]).toBe(
      'screened_with_flags',
    );
    expect(cells[headers.indexOf('Decision readiness')]).toBe(
      'Review project activity',
    );
    expect(cells[headers.indexOf('Recommended next diligence action')]).toBe(
      'Open the cited project record.',
    );

    const unsafeCsv = buildCsv([
      row({ latest_project_url: 'javascript:alert(1)' }),
      row({ bbl: '3050290002', latest_project_url: 'https://' }),
    ]);
    const unsafeCells = unsafeCsv.split('\n')[1].split(',');
    const malformedCells = unsafeCsv.split('\n')[2].split(',');
    expect(unsafeCells[headers.indexOf('Latest official project URL')]).toBe('');
    expect(malformedCells[headers.indexOf('Latest official project URL')]).toBe('');
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
