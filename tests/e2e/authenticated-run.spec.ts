import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function expectMeshState(page: Page) {
  await expect(page.getByTestId('artifact-mesh')).toBeVisible();
  await expect(page.getByTestId('artifact-mesh-download')).toBeVisible();
  const meshStatus = page
    .getByTestId('mesh-viewer')
    .getByTestId('mesh-status');
  await expect(meshStatus).toBeVisible({ timeout: 15000 });
  await expect(meshStatus).toHaveText(/Loading|Ready|Error|Unavailable/);
}

test('authenticated run detail renders artifacts and qa summary', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'citylens_mock_auth_user',
      JSON.stringify({ id: 'mock-test', email: 'test@mock.local', displayName: 'mock-test' }),
    );
  });

  await page.route('**/v1/runs/run-123', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        run_id: 'run-123',
        status: 'succeeded',
        stage: 'complete',
        progress: 1,
        artifacts: [
          { name: 'preview.png', signed_url: 'https://example.test/preview.png' },
          { name: 'change.geojson', signed_url: 'https://example.test/change.geojson' },
          { name: 'mesh.ply', signed_url: 'https://example.test/mesh.ply' },
          { name: 'run_summary.json', signed_url: 'https://example.test/run_summary.json' },
        ],
      }),
    });
  });

  await page.route('https://example.test/preview.png', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });
  await page.route('https://example.test/change.geojson', async (route) => {
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
        ],
      }),
    });
  });
  await page.route('https://example.test/mesh.ply', async (route) => {
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
  await page.route('https://example.test/run_summary.json', async (route) => {
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

  await page.goto('/runs/run-123');
  await expect(page.getByRole('heading', { name: 'Run run-123' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Status', { exact: true })).toBeVisible();
  await expect(page.getByTestId('artifacts-panel')).toBeVisible();
  await expect(page.getByTestId('artifact-preview-name')).toHaveText('preview.png', { timeout: 15000 });
  await expect(page.getByTestId('artifact-preview-download')).toBeVisible();
  await expectMeshState(page);

  await page.getByTestId('run-summary-load').click();
  await expect(page.getByText('Reference case')).toBeVisible();
  await expect(page.getByText('100 E 21st St Brooklyn, NY 11226').first()).toBeVisible();
  await expect(page.getByText('Added: 1')).toBeVisible();
  await expect(page.getByText('Demolished: 0')).toBeVisible();
});
