import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const mapRows = [
  {
    bbl: '3020960069',
    borough: 'brooklyn',
    address: '100 E 21 STREET',
    lat: 40.65,
    lng: -73.96,
    citywide_rank: 82,
    acquisition_rank: 21,
    priority_rank: 21,
    acquisition_eligible: true,
    acquisition_status: 'eligible',
    priority_tier: 'highest',
    opportunity_category: 'ground_up_candidate',
    score_calibrated: 0.42,
    lot_area_sqft: 5_000,
    unused_floor_area_sqft: 12_000,
    land_use: '01',
    assemblage_lot_count: 3,
    owner_portfolio_lot_count: 4,
  },
  {
    bbl: '4012340056',
    borough: 'queens',
    address: '41-20 QUEENS PLAZA',
    lat: 40.75,
    lng: -73.94,
    citywide_rank: 145,
    acquisition_rank: 38,
    priority_rank: 38,
    acquisition_eligible: true,
    acquisition_status: 'eligible',
    priority_tier: 'high',
    opportunity_category: 'vacant_site',
    score_calibrated: 0.31,
    lot_area_sqft: 7_500,
    unused_floor_area_sqft: 5_000,
    land_use: '11',
  },
];

function detail(row: (typeof mapRows)[number]) {
  return {
    ...row,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    model_rank: row.citywide_rank,
    acquisition_exclusion_reasons: [],
    allowed_far: row.borough === 'brooklyn' ? 2 : 4,
    max_floor_area_sqft: row.borough === 'brooklyn' ? 10_000 : 30_000,
    unused_floor_area_sqft: row.borough === 'brooklyn' ? 5_000 : 24_000,
    far_utilization_pct: row.borough === 'brooklyn' ? 50 : 20,
    zoning_district_1: row.borough === 'brooklyn' ? 'R6' : 'M1-5',
    year_built: row.borough === 'brooklyn' ? 1930 : 0,
    num_floors: row.borough === 'brooklyn' ? 2 : 0,
    last_sale_price: row.borough === 'brooklyn' ? 1_400_000 : 2_100_000,
    last_sale_year: row.borough === 'brooklyn' ? 2025 : 2022,
    years_held: row.borough === 'brooklyn' ? 1 : 4,
    has_recent_sale_5yr: true,
    is_landmark: false,
    is_historic_district: false,
    block_id: row.bbl.slice(0, 6),
    block_rank: 1,
    top_features: [],
    redev_status: 'still_vacant',
    property_facts_current: true,
    property_facts_as_of: '2026-07-24',
    ownership_as_of: '2026-07-15',
    project_activity_as_of: '2026-07-22',
    land_use_activity_as_of: '2026-07-24',
    violation_data_as_of: '2026-07-24',
    data_warnings: [],
    owner_name:
      row.borough === 'brooklyn' ? 'BROOKLYN HOLDINGS LLC' : 'QUEENS LAND LLC',
    decision_audit: {
      schema_version: 'citylens/parcel-decision-audit@v1',
      overall_status: 'screened',
      overall_label: 'Eligible lead',
      readiness: {
        status: 'review_required',
        label: 'Current evidence review required',
        recommended_action:
          'Verify current records before owner outreach or underwriting.',
        blockers: [],
        review_items: [],
        cleared_items: ['Current acquisition gates passed.'],
        disclaimer:
          'Decision readiness is not a purchase recommendation or appraisal.',
      },
      validation: {
        target: 'dob_nb_job_filing',
        evaluation_scope: 'Historical filing evaluation',
        precision_at_100: 0.34,
        precision_at_1000: 0.104,
        base_rate: 0.0012,
        prospective_validated: false,
        disclaimer: 'Historical screening performance is not seller intent.',
      },
      checks: [],
      limitations: [],
    },
  };
}

test('compares two parcels and downloads a source-dated evidence packet', async ({
  page,
}) => {
  const advanceRequests: unknown[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'citylens_mock_auth_user',
      JSON.stringify({
        id: 'mock-comparison',
        email: 'comparison@mock.local',
        displayName: 'Comparison tester',
      }),
    );
  });
  await page.route('**/v1/parcel-intel/map?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-07-24T02:43:29Z',
        rows: mapRows,
        access_scope: 'authenticated_full',
        requested_top_per_borough: 1000,
        returned_count: mapRows.length,
        available_count: mapRows.length,
        inventory_complete: true,
      }),
    });
  });
  await page.route('**/v1/parcel-intel/parcel/*', async (route) => {
    const bbl = new URL(route.request().url()).pathname.split('/').at(-1);
    const row = mapRows.find((candidate) => candidate.bbl === bbl);
    if (!row) {
      await route.fulfill({ status: 404, body: '{}' });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(detail(row)),
    });
  });
  await page.route(
    '**/v1/parcel-intel/workflow/*/advance',
    async (route) => {
      advanceRequests.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'created',
          item: {
            bbl: '3020960069',
            borough: 'brooklyn',
            stage: 'reviewing',
          },
        }),
      });
    },
  );

  await page.goto('/parcel-intel');
  await expect(page.getByTestId('parcel-inventory-status')).toContainText(
    'Full inventory verified',
  );
  await page.getByRole('button', { name: /^Signals$/ }).click();
  await page
    .getByRole('button', { name: /Owner concentration \+ assemblage/i })
    .click();
  await expect(page.getByTestId('screen-intelligence')).toContainText(
    '1 of 2',
  );
  await expect(
    page.getByRole('button', { name: /Owner concentration \+ assemblage/i }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: /^Site criteria$/ }).click();
  await page.getByLabel('Minimum lot area').selectOption('5000');
  await page
    .getByLabel('Minimum unused FAR proxy')
    .selectOption('10000');
  await expect(page.getByTestId('screen-intelligence')).toContainText(
    '12k sf',
  );
  await page.getByRole('button', { name: /Audit this screen/i }).click();
  await expect(page.getByTestId('screen-audit')).toContainText(
    'one condition while holding every other condition fixed',
  );
  await page
    .getByRole('button', {
      name: 'Relax Unused FAR proxy: ≥ 10,000 sf',
    })
    .click();
  await expect(page.getByTestId('screen-match-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Reset' }).click();

  const ranking = page.locator('#parcel-acquisition-ranking');

  await ranking
    .getByRole('button', { name: /100 E 21 STREET/i })
    .click();
  await page
    .getByRole('button', { name: 'Add 100 E 21 STREET to comparison' })
    .click();
  await page
    .getByRole('button', {
      name: 'Close parcel panel and return to ranked parcels',
    })
    .click();

  await ranking
    .getByRole('button', { name: /41-20 QUEENS PLAZA/i })
    .click();
  await page
    .getByRole('button', { name: 'Add 41-20 QUEENS PLAZA to comparison' })
    .click();

  const desk = page.getByTestId('parcel-comparison-desk');
  await expect(desk).toBeVisible();
  await expect(desk).toContainText('100 E 21 STREET');
  await expect(desk).toContainText('41-20 QUEENS PLAZA');
  await expect(desk).toContainText('Evidence currency');
  const overlayOrder = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>(
      '[aria-label="Compare shortlisted parcels"]',
    );
    const mapControls = document.querySelector<HTMLElement>('.leaflet-top');
    return {
      comparison: Number.parseInt(
        window.getComputedStyle(dialog?.parentElement ?? dialog!).zIndex || '0',
        10,
      ),
      map: Number.parseInt(
        window.getComputedStyle(mapControls!).zIndex || '0',
        10,
      ),
    };
  });
  expect(overlayOrder.comparison).toBeGreaterThan(overlayOrder.map);

  const downloadPromise = page.waitForEvent('download');
  await desk.getByRole('button', { name: 'Evidence CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'parcel-intel-comparison-top2.csv',
  );
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const csv = await readFile(downloadPath as string, 'utf8');
  expect(csv).toContain('Decision evidence status');
  expect(csv).toContain('PLUTO facts as of');
  expect(csv).toContain('100 E 21 STREET');
  expect(csv).toContain('41-20 QUEENS PLAZA');
  expect(csv).not.toContain('notes');
  expect(csv).not.toContain('assignee');

  await desk
    .getByRole('button', {
      name: 'Advance 100 E 21 STREET from comparison',
    })
    .click();
  await expect(
    page.getByTestId('comparison-decision-handoff'),
  ).toBeInViewport();
  await desk
    .getByLabel('Next diligence action')
    .fill('Verify current title and owner before outreach.');
  await desk.getByTestId('advance-comparison-parcel').click();
  await expect(desk.getByText('Lead advanced to reviewing')).toBeVisible();
  expect(advanceRequests).toEqual([
    {
      borough: 'brooklyn',
      next_action: 'Verify current title and owner before outreach.',
      next_action_due_date: null,
    },
  ]);
  expect(JSON.stringify(advanceRequests)).not.toMatch(
    /address|owner_name|notes|assignee|tags|score|price/i,
  );
});
