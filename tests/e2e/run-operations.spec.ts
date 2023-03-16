import { expect, test } from '@playwright/test';

async function useMockAccount(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'citylens_mock_auth_user',
      JSON.stringify({
        id: 'mock-operator',
        email: 'operator@mock.local',
        displayName: 'Operator',
      }),
    );
  });
}

test('a signed-out private run deep link opens an account gate, not the demo API', async ({
  page,
}) => {
  let demoRequests = 0;
  await page.route('**/v1/demo/runs/**', async (route) => {
    demoRequests += 1;
    await route.abort();
  });

  await page.goto('/runs/private-run-123');

  await expect(page.getByTestId('private-run-access-gate')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Sign in to open this evidence package.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sign in to continue' }),
  ).toHaveAttribute(
    'href',
    '/sign-in?next=%2Fruns%2Fprivate-run-123',
  );
  expect(demoRequests).toBe(0);
});

test('run creation stays inside the authenticated product workspace', async ({
  page,
}) => {
  await useMockAccount(page);
  await page.route('**/v1/runs?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });
  await page.route('**/v1/run-options', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        imagery_years: [2024],
        baseline_years: [2017],
        segmentation_backends: ['sam2'],
        outputs: ['previews', 'change', 'mesh'],
        defaults: {
          imagery_year: 2024,
          baseline_year: 2017,
          segmentation_backend: 'sam2',
          outputs: ['previews', 'change', 'mesh'],
          aoi_radius_m: 120,
        },
      }),
    });
  });
  let demoRequests = 0;
  await page.route('**/v1/demo/featured', async (route) => {
    demoRequests += 1;
    await route.fulfill({ contentType: 'application/json', body: '{}' });
  });

  await page.goto('/runs');
  await expect(page.getByTestId('run-history-empty')).toBeVisible();
  await page.getByRole('link', { name: 'Create a run' }).click();

  await expect(page).toHaveURL(/\/runs\/new$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Start a new run' }),
  ).toBeVisible();
  await expect(page.getByTestId('run-form')).toBeVisible();
  await expect(page.getByLabel('Address')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start processing' }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: /featured demo/i }),
  ).toHaveCount(0);
  expect(demoRequests).toBe(0);
});

test('run history leads with address and customer-facing status', async ({
  page,
}) => {
  await useMockAccount(page);
  await page.route('**/v1/runs?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            run_id: '01J4VQW3MJ6Y4E6YJ8Q1F6WZ10',
            status: 'running',
            stage: 'baseline_refine',
            progress: 38,
            request: { address: '100 E 21st St, Brooklyn' },
            created_at: '2026-07-27T14:00:00Z',
            updated_at: '2026-07-27T14:05:00Z',
          },
          {
            run_id: 'ready-run-2',
            status: 'succeeded',
            stage: 'done',
            progress: 100,
            request: { address: '55 Water St, Manhattan' },
            created_at: '2026-07-26T12:00:00Z',
            updated_at: '2026-07-26T12:04:00Z',
          },
        ],
        next_cursor: null,
      }),
    });
  });

  await page.goto('/runs');

  await expect(
    page.getByRole('heading', { name: 'Runs', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('product-page-header')).toBeVisible();
  const rows = page.getByTestId('run-history-row');
  const activeRow = rows.filter({ hasText: '100 E 21st St, Brooklyn' });
  const readyRow = rows.filter({ hasText: '55 Water St, Manhattan' });
  await expect(activeRow).toBeVisible();
  await expect(readyRow).toBeVisible();
  await expect(activeRow.getByText('Processing', { exact: true })).toBeVisible();
  await expect(readyRow.getByText('Ready', { exact: true })).toBeVisible();
  await expect(activeRow.getByText('Baseline Refine')).toBeVisible();
  await expect(activeRow.getByText('38% complete')).toBeVisible();
});

test('an active run reserves one clear output state while polling', async ({
  page,
}) => {
  await useMockAccount(page);
  await page.route('**/v1/runs/active-run-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        run_id: 'active-run-1',
        status: 'running',
        stage: 'reconstruct',
        progress: 62,
        request: { address: '100 E 21st St, Brooklyn' },
        created_at: '2026-07-27T14:00:00Z',
        updated_at: '2026-07-27T14:06:00Z',
      }),
    });
  });

  await page.goto('/runs/active-run-1');

  await expect(
    page.getByRole('heading', { name: '100 E 21st St, Brooklyn' }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('run-status-card')
      .getByText('Processing', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Run progress' })).toHaveAttribute(
    'aria-valuenow',
    '62',
  );
  await expect(page.getByTestId('artifacts-pending')).toBeVisible();
  await expect(page.getByTestId('artifacts-panel')).toHaveCount(0);
});

test('a failed run presents recovery context without empty viewers', async ({
  page,
}) => {
  await useMockAccount(page);
  await page.route('**/v1/runs/failed-run-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        run_id: 'failed-run-1',
        status: 'failed',
        stage: 'fetch_inputs',
        progress: 6,
        request: { address: 'Unknown source address' },
        error: {
          code: 'SOURCE_UNAVAILABLE',
          stage: 'fetch_inputs',
          message: 'No orthophoto could be acquired for this request.',
          traceback_summary: ['internal implementation detail'],
        },
        created_at: '2026-07-27T14:00:00Z',
        updated_at: '2026-07-27T14:01:00Z',
      }),
    });
  });

  await page.goto('/runs/failed-run-1');

  await expect(
    page
      .getByTestId('run-status-card')
      .getByText('Needs attention', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('run-status-card')
      .getByText('Processing stopped', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No orthophoto could be acquired for this request.'),
  ).toBeVisible();
  await expect(page.getByText('Technical details')).toBeVisible();
  await expect(page.getByText('internal implementation detail')).not.toBeVisible();
  await expect(page.getByTestId('artifacts-unavailable')).toBeVisible();
  await expect(page.getByTestId('artifacts-panel')).toHaveCount(0);
});
