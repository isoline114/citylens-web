import { describe, expect, it } from 'vitest';

import type { ParcelIntelRow } from '@/lib/api';
import { buildComparisonBrief } from './parcel-comparison-export';

function parcel(
  bbl: string,
  address: string,
  overrides: Partial<ParcelIntelRow> = {},
): ParcelIntelRow {
  return {
    bbl,
    address,
    borough: 'brooklyn',
    score_calibrated: 0.8,
    score_calibrated_p10: 0.7,
    score_calibrated_p90: 0.9,
    priority_rank: 4,
    priority_tier: 'high',
    acquisition_status: 'eligible',
    lot_area_sqft: 5000,
    allowed_far: 2,
    max_floor_area_sqft: 10000,
    unused_floor_area_sqft: 6000,
    far_utilization_pct: 40,
    zoning_district_1: 'R6',
    land_use: '01',
    year_built: 1930,
    num_floors: 2,
    lat: 40.65,
    lng: -73.96,
    last_sale_price: 1_400_000,
    last_sale_year: 2025,
    years_held: 1,
    has_recent_sale_5yr: true,
    is_landmark: false,
    is_historic_district: false,
    block_id: bbl.slice(0, 6),
    block_rank: 1,
    top_features: [],
    redev_status: 'still_vacant',
    opportunity_category: 'ground_up_candidate',
    property_facts_as_of: '2026-07-24',
    ownership_as_of: '2026-07-15',
    project_activity_as_of: '2026-07-24',
    ...overrides,
  };
}

describe('buildComparisonBrief', () => {
  it('builds a portable source-dated brief without hidden workflow data', () => {
    const brief = buildComparisonBrief([
      parcel('3020960069', '100 E 21 STREET', {
        owner_name: 'Example Owner LLC',
        mandatory_inclusionary_housing: true,
        mih_data_as_of: '2026-07-24',
        latest_project_job_number: '2023K0205',
        latest_project_status: 'Completed — approved',
        latest_project_url:
          'https://zap.planning.nyc.gov/projects/2023K0205',
      }),
      parcel('3050660023', '224 CLARKSON AVENUE', {
        acquisition_status: 'constrained',
        floodplain_1pct: true,
        floodplain_data_as_of: '2026-07-23',
      }),
    ]);

    expect(brief).toContain('# CityLens parcel evidence comparison');
    expect(brief).toContain('## 1. 100 E 21 STREET');
    expect(brief).toContain('## 2. 224 CLARKSON AVENUE');
    expect(brief).toContain(
      '[2023K0205 · Completed — approved](<https://zap.planning.nyc.gov/projects/2023K0205>)',
    );
    expect(brief).toContain('MIH mapped-area overlap');
    expect(brief).toContain('Floodplain: 2026-07-23');
    expect(brief).toContain('not an appraisal');
    expect(brief).not.toMatch(/notes|assignee|contact|workflow history/i);
  });

  it('escapes markdown-shaped source text and rejects unsafe project links', () => {
    const brief = buildComparisonBrief([
      parcel('3020960069', 'SITE [ONE]', {
        owner_name: '*Owner*',
        latest_project_job_number: 'unsafe',
        latest_project_url: 'javascript:alert(1)',
      }),
    ]);

    expect(brief).toContain('SITE \\[ONE\\]');
    expect(brief).toContain('\\*Owner\\*');
    expect(brief).toContain('Current project record:** unsafe');
    expect(brief).not.toContain('javascript:');
  });
});
