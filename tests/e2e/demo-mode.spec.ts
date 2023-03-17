import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  expectNoWcagViolations,
} from './accessibility';

async function expectMeshState(page: Page) {
  await page.getByTestId('artifact-tab-mesh').click();
  await expect(page.getByTestId('artifact-mesh')).toBeVisible();
  await expect(page.getByTestId('artifact-mesh-download')).toBeVisible();
  const meshStatus = page
    .getByTestId('mesh-viewer')
    .getByTestId('mesh-status');
  await expect(meshStatus).toBeVisible({ timeout: 15000 });
  await expect(meshStatus).toHaveText(/Loading|Ready|Error|Unavailable/);
}

test('demo mode renders a precomputed run and its artifacts', async ({ page }) => {
  await page.route('**/v1/demo/featured', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        Featured: [
          {
            run_id: 'demo-1',
            label: 'Brooklyn demo',
            address: '100 E 21st St Brooklyn, NY 11226',
            imagery_year: 2024,
            baseline_year: 2017,
            segmentation_backend: 'sam2',
            outputs: ['previews', 'change', 'mesh'],
          },
        ],
      }),
    });
  });

  await page.route('**/v1/demo/runs/demo-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        run_id: 'demo-1',
        status: 'succeeded',
        stage: 'complete',
        progress: 100,
        request: { address: '100 E 21st St Brooklyn, NY 11226' },
        artifacts: [
          { name: 'preview.png', signed_url: '/v1/demo/artifacts/demo-1/preview.png' },
          { name: 'change.geojson', signed_url: '/v1/demo/artifacts/demo-1/change.geojson' },
          { name: 'mesh.ply', signed_url: '/v1/demo/artifacts/demo-1/mesh.ply' },
          { name: 'run_summary.json', signed_url: '/v1/demo/artifacts/demo-1/run_summary.json' },
        ],
      }),
    });
  });

  await page.route('**/v1/demo/artifacts/demo-1/preview.png', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });
  await page.route('**/v1/demo/artifacts/demo-1/change.geojson', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { kind: 'added' },
            geometry: {
              type: 'Polygon',
              coordinates: [[[73.9, 40.7], [73.91, 40.7], [73.91, 40.71], [73.9, 40.71], [73.9, 40.7]]],
            },
          },
          {
            type: 'Feature',
            properties: { kind: 'removed' },
            geometry: {
              type: 'Polygon',
              coordinates: [[[73.92, 40.7], [73.93, 40.7], [73.93, 40.71], [73.92, 40.71], [73.92, 40.7]]],
            },
          },
        ],
      }),
    });
  });
  await page.route('**/v1/demo/artifacts/demo-1/mesh.ply', async (route) => {
    await route.fulfill({
      contentType: 'text/plain',
      body: `ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
element face 2
property list uchar int vertex_indices
end_header
0 0 0
1 0 0
1 1 0
0 1 0
3 0 1 2
3 0 2 3
`,
    });
  });
  await page.route('**/v1/demo/artifacts/demo-1/run_summary.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        qa: {
          reference_case_id: '100 E 21st St Brooklyn, NY 11226',
          baseline_footprints_used: true,
          lidar_used: true,
          mask_iou: 0.91,
          change_polygon_f1: 0.87,
          mesh_footprint_iou: 0.86,
          parity_status: 'near_match',
        },
        performance: {
          total_runtime_seconds: 123.4,
          stage_timings_seconds: {
            fetch: 4.2,
            segment: 31.1,
            change: 6.8,
          },
        },
      }),
    });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Turn the whole NYC market into a defensible weekly shortlist/i,
    }),
  ).toBeVisible();
  await page.getByLabel('Select a featured demo run').selectOption('demo-1');

  await expect(page).toHaveURL(/\/runs\/demo-1\?demo=1/);
  await expect(page.getByText('Public demo', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: '100 E 21st St Brooklyn, NY 11226',
    }),
  ).toBeVisible();
  await expect(page.getByTestId('artifacts-panel')).toBeVisible();
  await expect(page.getByTestId('artifact-preview-name')).toHaveText('preview.png', { timeout: 15000 });
  await expect(page.getByTestId('artifact-preview-download')).toBeVisible();
  await expectMeshState(page);

  await page.getByTestId('artifact-tab-summary').click();
  await expect(page.getByText('Reference case')).toBeVisible();

  await page.getByTestId('artifact-tab-change').click();
  await expect(page.getByText('Added: 1')).toBeVisible();
  await expect(page.getByText('Demolished: 1')).toBeVisible();
  await expectNoWcagViolations(page, 'Demo evidence workspace');

  await page.setViewportSize({ width: 320, height: 800 });
  await page.reload();
  await expect(page.getByTestId('artifacts-panel')).toBeVisible();
  await expectNoDocumentHorizontalOverflow(
    page,
    'Demo evidence workspace at 400% equivalent zoom',
  );
});

test('shows error message instead of infinite loading when demo API is unreachable', async ({ page }) => {
  await page.route('**/v1/demo/featured', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ Featured: [{ run_id: 'demo-fail', label: 'Fail demo', address: 'Addr', imagery_year: 2024, baseline_year: 2017, segmentation_backend: 'sam2', outputs: [] }] }),
    });
  });

  await page.route('**/v1/demo/runs/demo-fail', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Run not found' }) });
  });

  await page.goto('/runs/demo-fail?demo=1');
  await expect(page.getByText('Public demo', { exact: true })).toBeVisible();
  await expect(page.getByText('Could not load this run')).toBeVisible({ timeout: 15000 });
});

test('homepage shows product-safe copy when /v1/demo/featured returns 404', async ({ page }) => {
  await page.route('**/v1/demo/featured', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not Found' }) });
  });

  await page.goto('/');
  // When the demo endpoint fails, the run form's selector and the demo
  // cards both show the same product-safe fallback. We don't surface
  // raw error strings to a public visitor.
  await expect(
    page.getByText(/Featured demos are temporarily unavailable/i).first(),
  ).toBeVisible({ timeout: 10000 });
  // Old, crawler-hostile copy must not surface
  await expect(page.getByText(/Failed to load demos/i)).not.toBeVisible();
  await expect(page.getByText(/No featured demos found/i)).not.toBeVisible();
});

test('homepage foregrounds the acquisition workspace without viewport overflow', async ({
  page,
}) => {
  await page.route('**/v1/demo/featured', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not Found' }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Turn the whole NYC market into a defensible weekly shortlist/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open the NYC opportunity map' }),
  ).toBeVisible();
  const desktopPreview = await page
    .getByTestId('acquisition-workspace-preview')
    .boundingBox();
  expect(desktopPreview).not.toBeNull();
  expect(desktopPreview?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(1000);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Open the NYC opportunity map' }),
  ).toBeVisible();
  const mobilePreview = await page
    .getByTestId('acquisition-workspace-preview')
    .boundingBox();
  expect(mobilePreview).not.toBeNull();
  expect(mobilePreview?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
