import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const BOROUGH_CENTERS = {
  manhattan: [40.76, -73.98],
  brooklyn: [40.65, -73.95],
  queens: [40.72, -73.82],
  bronx: [40.84, -73.88],
  staten_island: [40.58, -74.15],
} as const;

function publicMapRows() {
  return Object.entries(BOROUGH_CENTERS).flatMap(
    ([borough, [centerLat, centerLng]], boroughIndex) =>
      Array.from({ length: 25 }, (_, index) => ({
        bbl: `${boroughIndex + 1}${String(100_000_000 + index).padStart(9, '0')}`,
        borough,
        address: `${index + 1} ${borough.replace('_', ' ')} test avenue`,
        lat: centerLat + (index % 5) * 0.001,
        lng: centerLng + Math.floor(index / 5) * 0.001,
        acquisition_rank: boroughIndex * 25 + index + 1,
        citywide_rank: boroughIndex * 25 + index + 1,
        priority_rank: index + 1,
        acquisition_eligible: true,
        acquisition_status: 'eligible',
        priority_tier: index < 5 ? 'highest' : 'high',
        opportunity_category: 'ground_up_candidate',
        score_calibrated: 0.5 - index * 0.005,
        lot_area_sqft: 5_000,
        unused_floor_area_sqft: 12_000,
      })),
  );
}

function authenticatedMapRows() {
  return Object.entries(BOROUGH_CENTERS).flatMap(
    ([borough, [centerLat, centerLng]], boroughIndex) =>
      Array.from({ length: 1000 }, (_, index) => ({
        bbl: `${boroughIndex + 1}${String(index + 1).padStart(9, '0')}`,
        borough,
        address: `${index + 1} ${borough.replace('_', ' ')} test avenue`,
        lat: centerLat + (index % 40) * 0.0007,
        lng: centerLng + Math.floor(index / 40) * 0.0007,
        acquisition_rank: boroughIndex * 1000 + index + 1,
        citywide_rank: boroughIndex * 1000 + index + 1,
        priority_rank: index + 1,
        acquisition_eligible: true,
        acquisition_status: 'eligible',
        priority_tier: index < 50 ? 'highest' : 'high',
        opportunity_category: 'ground_up_candidate',
        score_calibrated: 0.9 - index * 0.0002,
        lot_area_sqft: 5_000,
        unused_floor_area_sqft: 12_000,
      })),
  );
}

test('clusters the citywide preview and converges borough URLs on one explorer', async ({
  page,
}) => {
  const rows = publicMapRows();
  await page.route('**/v1/parcel-intel/map?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-07-27T09:55:59.858344Z',
        feed_generation: 'e2e-cluster-generation',
        rows,
        access_scope: 'public_preview',
        requested_top_per_borough: 1000,
        returned_count: rows.length,
        available_count: 5_000,
        inventory_complete: false,
      }),
    });
  });
  await page.route('**/v1/parcel-intel/sweep?**', async (route) => {
    const borough = new URL(route.request().url()).searchParams.get('borough');
    const sweepRows = rows.filter((row) => row.borough === borough);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        borough,
        generated_at: '2026-07-27T09:55:59.858344Z',
        rows: sweepRows,
        model_metadata: {},
      }),
    });
  });
  await page.route('**/v1/parcel-intel/parcel/**', async (route) => {
    const bbl = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop() ?? '',
    );
    const selected = rows.find((row) => row.bbl === bbl) ?? rows[0];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...selected,
        top_features: [],
        block_id: bbl.slice(0, 6),
        block_rank: 1,
        redev_status: 'still_vacant',
        property_facts_as_of: '2026-07-27',
        ownership_as_of: '2026-07-27',
        project_activity_as_of: '2026-07-27',
      }),
    });
  });

  await page.goto('/parcel-intel');

  const map = page.getByTestId('parcel-citywide-map');
  await expect(map).toBeVisible();
  await expect(page.getByTestId('parcel-map-inventory-scope')).toHaveText(
    'Public preview · 125 of 5,000 loaded',
  );
  await expect(map.getByText('125 in view')).toBeVisible();
  await expect(map.getByText('125 matches')).toBeVisible();
  await expect(page.locator('.parcel-map-cluster-icon')).toHaveCount(5);

  await page.locator('.parcel-map-cluster-icon').first().click();
  await expect(map.getByText(/in view/)).toBeVisible();
  const rankView = page.getByTestId('rank-map-view');
  await expect(rankView).toHaveText(/Rank this view · [1-9][0-9]* sites/);
  await rankView.click();
  await expect(rankView).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText(
      /^[\d,]+ sites? across [\d,]+ mapped parcels? · unsaved scope$/,
    ),
  ).toBeVisible();
  await expect(rankView).toHaveText('Show all sites · 125');
  await rankView.click();
  await expect(rankView).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', {
      name: 'Fit the map to all matching parcels',
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Fit the map to all matching parcels' })
    .click();
  await expect(page.locator('.parcel-map-cluster-icon')).toHaveCount(5);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'parcel-intel-citywide-top125.csv',
  );
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const csv = await fs.readFile(downloadPath as string, 'utf8');
  expect(csv.split('\n')).toHaveLength(126);
  await expect(page.getByTestId('parcel-export-receipt')).toContainText(
    'Downloaded 125 unique parcels',
  );

  await page.goto('/parcel-intel/queens');
  await expect(page).toHaveURL(/\/parcel-intel\?borough=queens$/);
  await expect(page.getByTestId('parcel-citywide-map')).toBeVisible();
  await expect(page.getByTestId('parcel-citywide-map').getByText('25 matches')).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Filter by borough' }),
  ).toHaveValue('queens');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/parcel-intel');

  const mobileMap = page.getByTestId('parcel-citywide-map');
  const marketFilters = page.getByRole('button', {
    name: 'Market filters',
  });
  await expect(marketFilters).toBeVisible();
  await expect(marketFilters).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('parcel-mobile-access-status')).toContainText(
    'Preview access',
  );
  const mobileMapBox = await mobileMap.boundingBox();
  expect(mobileMapBox).not.toBeNull();
  expect(mobileMapBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);

  await marketFilters.click();
  await expect(marketFilters).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('combobox', { name: 'Filter by borough' }),
  ).toBeVisible();

  await marketFilters.click();
  await page.locator('[data-parcel-ranking-bbl]').first().click();
  const workspaceTabs = page.getByTestId('parcel-workspace-tabs');
  await expect(workspaceTabs).toBeVisible();
  await expect(workspaceTabs).toHaveClass(/\bsticky\b/);
});

test('lets a first-session user watch the verified citywide screen', async ({
  page,
}) => {
  const rows = authenticatedMapRows();
  const savedViews: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'citylens_mock_auth_user',
      JSON.stringify({
        id: 'mock-first-session',
        email: 'first-session@mock.local',
        displayName: 'First session',
      }),
    );
  });
  await page.route('**/v1/parcel-intel/map?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-07-30T01:00:00Z',
        feed_generation: 'e2e-first-session-generation',
        rows,
        access_scope: 'authenticated_full',
        requested_top_per_borough: 1000,
        returned_count: rows.length,
        available_count: rows.length,
        inventory_complete: true,
      }),
    });
  });
  await page.route('**/v1/parcel-intel/workflow/actions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schema_version: 'citylens/parcel-workflow-actions@v1',
        generated_at: '2026-07-30T01:00:00Z',
        total_records: 0,
        open_records: 0,
        completed_records: 0,
        overdue_count: 0,
        due_today_count: 0,
        due_soon_count: 0,
        scheduled_count: 0,
        unscheduled_count: 0,
        unassigned_count: 0,
        outcome_update_due_count: 0,
        attention_count: 0,
        snoozed_count: 0,
        complete_plan_count: 0,
        plan_coverage_rate: null,
        assigned_count: 0,
        assignee_coverage_rate: null,
        outcome_current_count: 0,
        outcome_current_rate: null,
        items: [],
      }),
    });
  });
  await page.route('**/v1/parcel-intel/saved-searches', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(savedViews),
    });
  });
  await page.route('**/v1/parcel-intel/saved-searches/*', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as Record<string, unknown>;
    const searchId = new URL(request.url()).pathname.split('/').at(-1);
    const savedView = {
      schema_version: 'citylens/parcel-saved-view@v3',
      search_id: searchId,
      ...payload,
      created_at: '2026-07-30T01:05:00Z',
      updated_at: '2026-07-30T01:05:00Z',
    };
    savedViews.unshift(savedView);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(savedView),
    });
  });
  await page.route('**/v1/parcel-intel/product-events', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/parcel-intel');

  await expect(page.getByTestId('parcel-map-inventory-scope')).toHaveText(
    'Full inventory · 5,000 loaded',
  );
  const guide = page.getByTestId('activation-guide-empty');
  await expect(guide).toContainText(
    'Open a lead—or watch this exact screen.',
  );
  await guide.getByRole('button', { name: 'Watch this screen' }).click();
  await expect(page.getByTestId('saved-views-panel')).toBeVisible();
  await expect(page.getByLabel('View name')).toBeFocused();
  await expect(page.getByTestId('saved-view-save')).toBeEnabled();
  await expect(page.getByText('No saved views yet.')).toBeVisible();
  await page.getByTestId('saved-view-save').click();
  await expect(page.getByTestId('saved-view-save')).toHaveText('Saved');
  await expect(page.getByTestId('saved-view-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Close saved views' }).click();
  await expect(page.getByTestId('activation-guide-empty')).toHaveCount(0);
});
