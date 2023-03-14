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

  await page.goto('/parcel-intel');

  const map = page.getByTestId('parcel-citywide-map');
  await expect(map).toBeVisible();
  await expect(map.getByText('125 in view')).toBeVisible();
  await expect(map.getByText('125 matches')).toBeVisible();
  await expect(page.locator('.parcel-map-cluster-icon')).toHaveCount(5);

  await page.locator('.parcel-map-cluster-icon').first().click();
  await expect(map.getByText(/in view/)).toBeVisible();
  const rankView = page.getByTestId('rank-map-view');
  await expect(rankView).toHaveText(/Rank this view · [1-9][0-9]*/);
  await rankView.click();
  await expect(rankView).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText(
      'Only mapped parcels inside the current extent · unsaved scope',
    ),
  ).toBeVisible();
  await expect(rankView).toHaveText('Show all matches · 125');
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
});
