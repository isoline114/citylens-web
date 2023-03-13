import { expect, test } from '@playwright/test';

test('explains why an exact BBL is absent from the published inventory', async ({
  page,
}) => {
  const productEvents: unknown[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'citylens_mock_auth_user',
      JSON.stringify({
        id: 'mock-screening',
        email: 'screening@mock.local',
        displayName: 'Screening tester',
      }),
    );
  });
  await page.route('**/v1/parcel-intel/map?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-07-26T18:00:00Z',
        rows: [
          {
            bbl: '3020960069',
            borough: 'brooklyn',
            address: '100 E 21 STREET',
            lat: 40.65,
            lng: -73.96,
            acquisition_rank: 21,
            priority_rank: 21,
            acquisition_eligible: true,
            acquisition_status: 'eligible',
            priority_tier: 'highest',
            opportunity_category: 'ground_up_candidate',
            score_calibrated: 0.42,
            lot_area_sqft: 5_000,
            unused_floor_area_sqft: 12_000,
          },
        ],
        access_scope: 'authenticated_full',
        requested_top_per_borough: 1000,
        returned_count: 1,
        available_count: 1,
        inventory_complete: true,
      }),
    });
  });
  await page.route(
    '**/v1/parcel-intel/screening/3058920038',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'citylens/parcel-screening-status@v1',
          bbl: '3058920038',
          borough: 'brooklyn',
          result: 'screened_out',
          evaluated: true,
          published: false,
          acquisition_eligible: false,
          acquisition_status: 'active_project',
          exclusion_reasons: ['approved_land_use_project'],
          latest_project_filing_year: 2023,
          latest_project_status: 'Approved',
          latest_project_type: 'land_use_entitlement',
          latest_project_job_number: '2023K0205',
          latest_project_url:
            'https://zap.planning.nyc.gov/projects/2023K0205',
          property_facts_as_of: '2026-07-19',
          ownership_as_of: '2026-07-15',
          project_activity_as_of: '2026-07-19',
          land_use_activity_as_of: '2026-07-25',
          feed_generation: 'generation-1',
          feed_generated_at: '2026-07-26T18:00:00Z',
          interpretation:
            'This parcel was evaluated but excluded from the acquisition inventory.',
        }),
      });
    },
  );
  await page.route(
    '**/v1/parcel-intel/product-events',
    async (route) => {
      productEvents.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, body: '' });
    },
  );

  await page.goto('/parcel-intel');
  await expect(page.getByTestId('parcel-inventory-status')).toContainText(
    'Full inventory verified',
  );
  await page.getByLabel('Search parcels').fill('3-05892-0038');
  await page
    .getByRole('button', { name: 'Check current screening' })
    .click();

  const receipt = page.getByTestId('parcel-screening-receipt');
  await expect(receipt).toContainText(
    'Excluded from the current acquisition inventory',
  );
  await expect(receipt).toContainText('Approved land-use project');
  await expect(receipt).toContainText('2023K0205');
  await expect(
    page.getByRole('link', { name: 'Open official record' }),
  ).toHaveAttribute(
    'href',
    'https://zap.planning.nyc.gov/projects/2023K0205',
  );
  await expect(receipt).not.toContainText(/model rank|score/i);
  await expect
    .poll(() => productEvents.length)
    .toBeGreaterThan(0);
  expect(productEvents).toContainEqual({
    schema_version: 'citylens/parcel-product-event@v1',
    event: 'screening_lookup_completed',
    source: 'screening_lookup',
  });
  expect(JSON.stringify(productEvents)).not.toMatch(
    /3058920038|2023K0205|approved_land_use_project/i,
  );
});
