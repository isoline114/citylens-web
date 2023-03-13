#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const webBase = (
  process.env.CITYLENS_WEB_BASE || 'https://www.citylens.dev'
).replace(/\/+$/, '');
const email = process.env.CITYLENS_WEB_SMOKE_EMAIL?.trim();
const password = process.env.CITYLENS_WEB_SMOKE_PASSWORD;
const expectedCount = Number(process.env.CITYLENS_EXPECTED_PARCEL_COUNT || 5_000);
const outputDir = path.resolve(
  process.env.CITYLENS_SMOKE_OUTPUT_DIR || 'test-results/production-auth-smoke',
);

if (!email || !password) {
  console.error(
    'CITYLENS_WEB_SMOKE_EMAIL and CITYLENS_WEB_SMOKE_PASSWORD are required.',
  );
  process.exit(2);
}
if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0) {
  console.error('CITYLENS_EXPECTED_PARCEL_COUNT must be a positive integer.');
  process.exit(2);
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const mapReceipts = [];
const consoleErrors = [];
const pageErrors = [];
let screeningReceiptVerified = false;
let passed = false;
let failure = null;

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', async (response) => {
  if (!response.url().includes('/v1/parcel-intel/map?')) return;
  try {
    const payload = await response.json();
    mapReceipts.push({
      status: response.status(),
      access_scope: payload.access_scope ?? null,
      returned_count: payload.returned_count ?? null,
      available_count: payload.available_count ?? null,
      inventory_complete: payload.inventory_complete ?? null,
      row_count: Array.isArray(payload.rows) ? payload.rows.length : null,
    });
  } catch {
    mapReceipts.push({
      status: response.status(),
      access_scope: null,
      returned_count: null,
      available_count: null,
      inventory_complete: null,
      row_count: null,
    });
  }
});

try {
  await page.goto(
    `${webBase}/sign-in?next=${encodeURIComponent('/parcel-intel')}`,
    { waitUntil: 'networkidle' },
  );
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/parcel-intel', { timeout: 20_000 });

  await page.waitForFunction(
    ({ count }) =>
      document
        .querySelector('[data-testid="parcel-inventory-status"]')
        ?.textContent?.includes(
          `Full inventory verified · ${Number(count).toLocaleString(
            'en-US',
          )} loaded`,
        ),
    { count: expectedCount },
    { timeout: 30_000 },
  );

  const inventoryStatus = (
    await page.getByTestId('parcel-inventory-status').textContent()
  )?.trim();
  const mappedStatus = (
    await page.getByText(/mapped parcels$/).textContent()
  )?.trim();
  const expectedFormatted = expectedCount.toLocaleString('en-US');
  if (
    inventoryStatus !==
    `Full inventory verified · ${expectedFormatted} loaded`
  ) {
    throw new Error(`Unexpected inventory status: ${inventoryStatus ?? 'missing'}`);
  }
  if (mappedStatus !== `${expectedFormatted} mapped parcels`) {
    throw new Error(`Unexpected map status: ${mappedStatus ?? 'missing'}`);
  }
  if (
    !mapReceipts.some(
      (receipt) =>
        receipt.status === 200 &&
        receipt.access_scope === 'authenticated_full' &&
        receipt.returned_count === expectedCount &&
        receipt.available_count === expectedCount &&
        receipt.inventory_complete === true &&
        receipt.row_count === expectedCount,
    )
  ) {
    throw new Error(
      'No complete authenticated Parcel Intelligence map response was observed.',
    );
  }
  await page.getByLabel('Search parcels').fill('3058920038');
  await page
    .getByRole('button', { name: 'Check current screening' })
    .click();
  const screeningReceipt = page.getByTestId('parcel-screening-receipt');
  await screeningReceipt.waitFor({ timeout: 15_000 });
  if (
    !(await screeningReceipt
      .getByText('Excluded from the current acquisition inventory')
      .isVisible()) ||
    !(await screeningReceipt
      .getByRole('link', { name: 'Open official record' })
      .isVisible())
  ) {
    throw new Error(
      'The authenticated exact-BBL screening receipt was incomplete.',
    );
  }
  screeningReceiptVerified = true;
  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(
      `Browser emitted ${consoleErrors.length} console error(s) and ${pageErrors.length} page error(s).`,
    );
  }
  passed = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  await page
    .screenshot({
      path: path.join(outputDir, 'failure.png'),
      fullPage: true,
    })
    .catch(() => undefined);
} finally {
  await page
    .getByRole('button', { name: 'Sign out' })
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await browser.close();
}

const report = {
  schema_version: 'citylens/production-authenticated-parcel-map@v1',
  verified_at: new Date().toISOString(),
  web_base: webBase,
  expected_count: expectedCount,
  passed,
  failure,
  map_receipts: mapReceipts,
  screening_receipt_verified: screeningReceiptVerified,
  console_error_count: consoleErrors.length,
  page_error_count: pageErrors.length,
};

await fs.writeFile(
  path.join(outputDir, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
process.exit(passed ? 0 : 1);
