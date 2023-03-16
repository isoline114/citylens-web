import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  expectNoWcagViolations,
} from './accessibility';

test('mobile pilot intake reaches the form without a long narrative detour', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact?plan=acquisitions');

  await expect(
    page.getByRole('heading', {
      name: 'Bring one real acquisition workflow.',
    }),
  ).toBeVisible();
  const formHeading = page.getByRole('heading', {
    name: 'Tell us enough to make the first call useful.',
  });
  await expect(formHeading).toBeVisible();
  const formHeadingBounds = await formHeading.boundingBox();
  expect(formHeadingBounds).not.toBeNull();
  expect(formHeadingBounds?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);
  await expectNoWcagViolations(page, 'Mobile pilot intake');

  await page.setViewportSize({ width: 320, height: 800 });
  await page.reload();
  await expectNoDocumentHorizontalOverflow(
    page,
    'Pilot intake at 400% equivalent zoom',
  );
});

test('prospective team can submit a private, retry-safe pilot request', async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | null = null;
  let idempotencyKey: string | null = null;

  await page.route('**/v1/pilot-requests', async (route) => {
    submittedBody = route.request().postDataJSON();
    idempotencyKey = route.request().headers()['idempotency-key'] ?? null;
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        schema_version: 'citylens/pilot-request-receipt@v1',
        request_id: 'pr_0123456789abcdef0123456789abcdef',
        status: 'received',
        created_at: '2026-07-24T20:00:00Z',
      }),
    });
  });

  await page.goto('/contact?plan=concierge');
  await expect(
    page.getByRole('heading', {
      name: 'Bring one real acquisition workflow.',
    }),
  ).toBeVisible();
  await expect(page.getByLabel(/Concierge team/i)).toBeChecked();

  await page.getByLabel('Your name').fill('Jordan Lee');
  await page.getByLabel('Work email').fill('jordan@example.com');
  await page.getByLabel('Company').fill('Example Development');
  await page.getByLabel('Role').fill('Acquisitions director');
  await page.getByTestId('pilot-borough-brooklyn').click();
  await page.getByTestId('pilot-borough-queens').click();
  await expect(page.getByLabel('Brooklyn')).toBeChecked();
  await expect(page.getByLabel('Queens')).toBeChecked();
  await page
    .getByLabel('What does your acquisition workflow look like today?')
    .fill(
      'We need a shared development-site review and outreach workflow.',
    );
  await page
    .getByLabel(/I agree that CityLens may use these details/i)
    .check();
  await page
    .getByRole('button', { name: 'Request the working session' })
    .click();

  await expect(page.getByTestId('pilot-request-success')).toContainText(
    'pr_0123456789abcdef0123456789abcdef',
  );
  expect(idempotencyKey).toMatch(/^pilot-[A-Za-z0-9-]{12,}$/);
  expect(submittedBody).toEqual({
    schema_version: 'citylens/pilot-request@v1',
    plan: 'concierge',
    name: 'Jordan Lee',
    work_email: 'jordan@example.com',
    company: 'Example Development',
    role: 'Acquisitions director',
    team_size: '2-5',
    target_boroughs: ['brooklyn', 'queens'],
    workflow_summary:
      'We need a shared development-site review and outreach workflow.',
    consent: true,
    website: '',
  });
  expect(JSON.stringify(submittedBody)).not.toMatch(
    /client_ip|user_agent|referrer|page_url|utm_/i,
  );
});
