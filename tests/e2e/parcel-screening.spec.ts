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
    '**/v1/parcel-intel/screening/*',
    async (route) => {
      const bbl = new URL(route.request().url()).pathname.split('/').pop();
      const excluded = bbl === '3058920038';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'citylens/parcel-screening-status@v1',
          bbl,
          borough: 'brooklyn',
          result: excluded ? 'screened_out' : 'not_evaluated',
          evaluated: excluded,
          published: false,
          acquisition_eligible: excluded ? false : null,
          acquisition_status: excluded ? 'active_project' : null,
          exclusion_reasons: excluded
            ? ['approved_land_use_project']
            : [],
          latest_project_filing_year: excluded ? 2023 : null,
          latest_project_status: excluded ? 'Approved' : null,
          latest_project_type: excluded ? 'land_use_entitlement' : null,
          latest_project_job_number: excluded ? '2023K0205' : null,
          latest_project_url: excluded
            ? 'https://zap.planning.nyc.gov/projects/2023K0205'
            : null,
          property_facts_as_of: '2026-07-19',
          ownership_as_of: '2026-07-15',
          project_activity_as_of: '2026-07-19',
          land_use_activity_as_of: '2026-07-25',
          feed_generation: 'generation-1',
          feed_generated_at: '2026-07-26T18:00:00Z',
          interpretation: excluded
            ? 'This parcel was evaluated but excluded from the acquisition inventory.'
            : 'This parcel is outside the current evaluated candidate ledger.',
        }),
      });
    },
  );
  await page.route(
    '**/v1/parcel-intel/resolve-address',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version:
            'citylens/parcel-address-resolve-response@v1',
          match_status: 'ambiguous',
          match_method: 'exact_normalized_official_address',
          candidate_count: 2,
          truncated: false,
          candidates: [
            { bbl: '3058920038', borough: 'brooklyn' },
            { bbl: '3058920039', borough: 'brooklyn' },
          ],
          unit_designator_ignored: false,
          locality_ignored: true,
          source_name:
            'NYC Property Address Directory with PLUTO fallback',
          source_dataset_id: 'bc8t-ecyu',
          source_retrieved_at: '2026-07-26T23:37:33Z',
          resolver_generation:
            '20260727T000234316462Z-1824ab6b25f2',
          address_normalization_schema:
            'citylens/address-normalization@v1',
          interpretation:
            'The official directory maps this address to two tax lots; CityLens did not choose one automatically.',
        }),
      });
    },
  );
  await page.route(
    '**/v1/parcel-intel/official-parcel/*',
    async (route) => {
      const bbl = new URL(route.request().url()).pathname.split('/').pop();
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'citylens/parcel-official-dossier@v1',
          bbl,
          borough: 'brooklyn',
          address:
            bbl === '3058920038'
              ? '464 OVINGTON AVENUE'
              : 'OFFICIAL TEST ADDRESS',
          pluto_owner_name: 'PLUTO OWNER LLC',
          acris_owner_name: 'ACRIS OWNER LLC',
          owner_source_status: 'different',
          last_sale_date: '2022-06-15',
          last_sale_price: 1_460_000,
          years_held: 4,
          lot_area_sqft: 9_260,
          building_area_sqft: 3_006,
          units: 2,
          num_floors: 2,
          year_built: 1899,
          land_use: '01',
          building_class: 'R4',
          zoning_district_1: 'R6A',
          zoning_district_2: null,
          built_far: 0.32,
          residential_far: 3,
          commercial_far: 0,
          facility_far: 3,
          assessed_land: 32_400,
          assessed_building: 7_020,
          assessed_total: 39_420,
          firm_2007_floodplain: false,
          pfirm_2015_floodplain: false,
          environmental_review_required: true,
          environmental_designation_kind: 'E',
          environmental_designation_number: 'E-839',
          property_facts_dataset_id: '64uk-42ks',
          property_facts_retrieved_at: '2026-07-19T00:00:00Z',
          ownership_dataset_ids: {
            master: 'bnx9-e6tj',
            legals: '8h5j-fqxa',
            parties: '636b-3b5g',
          },
          ownership_features_updated_at: '2026-07-15T00:00:00Z',
          dossier_generation: 'generation-1',
          official_links: {
            zola: 'https://zola.planning.nyc.gov/',
            acris: 'https://a836-acris.nyc.gov/',
            dob_bis: 'https://a810-bisweb.nyc.gov/',
          },
          interpretation:
            'Official source facts only. This is not a lead score, title report, appraisal, zoning analysis, seller-intent signal, or beneficial-owner determination.',
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
  await expect(page.getByTestId('parcel-official-dossier')).toContainText(
    '464 OVINGTON AVENUE',
  );
  await expect(page.getByTestId('parcel-official-dossier')).toContainText(
    'Owner sources differ — verify title',
  );
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

  await page
    .getByLabel('Search parcels')
    .fill('464 Ovington Ave, Brooklyn, NY 11209');
  const resolver = page.getByTestId('parcel-address-resolver');
  await expect(resolver).toContainText('Official tax-lot discovery');
  await resolver
    .getByRole('button', { name: 'Resolve official tax lots' })
    .click();
  await expect(resolver).toContainText(
    '2 official tax lots share this address',
  );
  await resolver.getByRole('button', { name: /3058920039/ }).click();
  await expect(page.getByTestId('parcel-official-dossier')).toContainText(
    'Any NYC tax lot · not a lead score',
  );
  await page
    .getByRole('button', { name: 'Check current screening' })
    .click();
  await expect(page.getByTestId('parcel-screening-receipt')).toContainText(
    'Outside the current candidate ledger',
  );
});
