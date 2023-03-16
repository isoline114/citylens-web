#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  positiveFormattedCount,
  positiveFormattedCountWithSuffix,
  summarizeParcelCsv,
  summarizeProductEvent,
  summarizeRunListResponse,
} from './production-auth-smoke-support.mjs';

const webBase = (
  process.env.CITYLENS_WEB_BASE || 'https://www.citylens.dev'
).replace(/\/+$/, '');
const email = process.env.CITYLENS_WEB_SMOKE_EMAIL?.trim();
const password = process.env.CITYLENS_WEB_SMOKE_PASSWORD;
const expectedCount = Number(process.env.CITYLENS_EXPECTED_PARCEL_COUNT || 5_000);
const mobileViewport = { width: 390, height: 844 };
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const mapReceipts = [];
const authTokenReceipts = [];
const runListReceipts = [];
const consoleErrors = [];
const pageErrors = [];
let screeningReceiptVerified = false;
let addressResolutionVerified = false;
let officialDossierVerified = false;
let dossierReadinessVerified = false;
let historicalBenchmarkReceiptVerified = false;
let thesisComposerVerified = false;
let thesisComposerReceiptVerified = false;
let thesisComposerFiltersVerified = false;
let thesisComposerPositiveMatchVerified = false;
let thesisComposerEventReceipt = null;
let returningSessionReloadVerified = false;
let authenticatedPublicPreviewReceiptCount = null;
let initialClusteredMapReceipt = null;
let returningClusteredMapReceipt = null;
let citywideExportReceipt = null;
let mobileWorkspaceReceipt = null;
let runOperationsReceipt = null;
let sensitiveSurface = false;
let passed = false;
let failure = null;

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', async (response) => {
  if (response.url().includes('/api/auth/token')) {
    try {
      const payload = await response.json();
      const token =
        payload && typeof payload === 'object' ? payload.token : null;
      authTokenReceipts.push({
        status: response.status(),
        jwt_shape:
          typeof token === 'string' && token.split('.').length === 3,
      });
    } catch {
      authTokenReceipts.push({
        status: response.status(),
        jwt_shape: false,
      });
    }
  }
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

async function verifyClusteredMap(expectedFormatted) {
  const map = page.getByTestId('parcel-citywide-map');
  const inventoryScopeLabel = (
    await page.getByTestId('parcel-map-inventory-scope').textContent()
  )?.trim();
  await map
    .getByText(`${expectedFormatted} matches`, { exact: true })
    .waitFor({ timeout: 30_000 });
  const inViewText = (
    await map.getByText(/^[\d,]+ in view$/).textContent()
  )?.trim();
  const matchText = (
    await map
      .getByText(`${expectedFormatted} matches`, { exact: true })
      .textContent()
  )?.trim();
  const clusterCount = await page.locator('.parcel-map-cluster-icon').count();
  const fitControlVisible = await page
    .getByRole('button', {
      name: 'Fit the map to all matching parcels',
    })
    .isVisible();
  const mappedAriaLabel = await map.getAttribute('aria-label');
  const receipt = {
    inventory_scope_label: inventoryScopeLabel ?? null,
    in_view_count: positiveFormattedCountWithSuffix(inViewText, 'in view'),
    match_count: positiveFormattedCountWithSuffix(matchText, 'matches'),
    cluster_count: clusterCount,
    fit_control_visible: fitControlVisible,
    mapped_aria_label_matches:
      mappedAriaLabel?.includes(
        `with ${expectedFormatted} matching parcels`,
      ) === true,
  };
  if (
    receipt.inventory_scope_label !==
      `Full inventory · ${expectedFormatted} loaded` ||
    receipt.in_view_count !== expectedCount ||
    receipt.match_count !== expectedCount ||
    receipt.cluster_count <= 0 ||
    receipt.fit_control_visible !== true ||
    receipt.mapped_aria_label_matches !== true
  ) {
    throw new Error(
      `Unexpected clustered map receipt: ${JSON.stringify(receipt)}.`,
    );
  }
  return receipt;
}

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
  const expectedFormatted = expectedCount.toLocaleString('en-US');
  if (
    inventoryStatus !==
    `Full inventory verified · ${expectedFormatted} loaded`
  ) {
    throw new Error(`Unexpected inventory status: ${inventoryStatus ?? 'missing'}`);
  }
  initialClusteredMapReceipt =
    await verifyClusteredMap(expectedFormatted);
  if (
    !authTokenReceipts.some(
      (receipt) => receipt.status === 200 && receipt.jwt_shape === true,
    )
  ) {
    throw new Error(
      'The signed-in browser session did not mint a valid API credential.',
    );
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

  // A fresh sign-in alone is not enough evidence. Real users commonly return
  // to an already-authenticated tab or reload the explorer later. Require a
  // second complete inventory receipt after a full document reload so stale
  // client auth/session state cannot strand returning users on the public
  // 125-row preview while this monitor remains green.
  const completeReceiptCountBeforeReload = mapReceipts.filter(
    (receipt) =>
      receipt.status === 200 &&
      receipt.access_scope === 'authenticated_full' &&
      receipt.returned_count === expectedCount &&
      receipt.available_count === expectedCount &&
      receipt.inventory_complete === true &&
      receipt.row_count === expectedCount,
  ).length;
  await page.reload({ waitUntil: 'networkidle' });
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
  returningClusteredMapReceipt =
    await verifyClusteredMap(expectedFormatted);
  const completeReceiptCountAfterReload = mapReceipts.filter(
    (receipt) =>
      receipt.status === 200 &&
      receipt.access_scope === 'authenticated_full' &&
      receipt.returned_count === expectedCount &&
      receipt.available_count === expectedCount &&
      receipt.inventory_complete === true &&
      receipt.row_count === expectedCount,
  ).length;
  if (
    completeReceiptCountAfterReload <= completeReceiptCountBeforeReload
  ) {
    throw new Error(
      'Returning authenticated session did not produce a second complete inventory receipt.',
    );
  }
  returningSessionReloadVerified = true;
  authenticatedPublicPreviewReceiptCount = mapReceipts.filter(
    (receipt) => receipt.access_scope === 'public_preview',
  ).length;
  if (authenticatedPublicPreviewReceiptCount !== 0) {
    throw new Error(
      `Authenticated explorer requested ${authenticatedPublicPreviewReceiptCount} public preview response(s) before loading the full inventory.`,
    );
  }

  const exportButton = page.getByRole('button', { name: 'CSV' });
  const exportTitle = await exportButton.getAttribute('title');
  if (exportTitle !== `Export ${expectedFormatted} filtered parcels`) {
    throw new Error(
      `Unexpected citywide export scope: ${exportTitle ?? 'missing'}.`,
    );
  }
  const exportDownloadPromise = page.waitForEvent('download', {
    timeout: 60_000,
  });
  const exportStartedAt = Date.now();
  await exportButton.click();
  const exportDownload = await exportDownloadPromise;
  const exportPath = await exportDownload.path();
  if (!exportPath) {
    throw new Error('The citywide CSV download did not produce a local file.');
  }
  const exportSummary = summarizeParcelCsv(
    await fs.readFile(exportPath, 'utf8'),
  );
  const exportStats = await fs.stat(exportPath);
  citywideExportReceipt = {
    ...exportSummary,
    expected_row_count: expectedCount,
    file_bytes: exportStats.size,
    duration_ms: Date.now() - exportStartedAt,
    filename_shape_matches:
      exportDownload.suggestedFilename() ===
      `parcel-intel-citywide-top${expectedCount}.csv`,
  };
  if (
    citywideExportReceipt.row_count !== expectedCount ||
    citywideExportReceipt.unique_bbl_count !== expectedCount ||
    citywideExportReceipt.bbl_column_present !== true ||
    citywideExportReceipt.column_count <= 1 ||
    citywideExportReceipt.consistent_column_count !== true ||
    citywideExportReceipt.filename_shape_matches !== true
  ) {
    throw new Error(
      `Unexpected citywide CSV receipt: ${JSON.stringify(citywideExportReceipt)}.`,
    );
  }

  const mobilePage = await context.newPage();
  mobilePage.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`[mobile] ${message.text()}`);
    }
  });
  mobilePage.on('pageerror', (error) =>
    pageErrors.push(`[mobile] ${error.message}`),
  );
  await mobilePage.setViewportSize(mobileViewport);
  await mobilePage.goto(`${webBase}/parcel-intel`, {
    waitUntil: 'networkidle',
  });
  const mobileAccessStatus = mobilePage.getByTestId(
    'parcel-mobile-access-status',
  );
  await mobileAccessStatus
    .getByText('Full', { exact: true })
    .waitFor({ timeout: 30_000 });
  const mobileMap = mobilePage.getByTestId('parcel-citywide-map');
  await mobileMap
    .getByText(`${expectedFormatted} matches`, { exact: true })
    .waitFor({ timeout: 30_000 });
  const mobileMarketFilters = mobilePage.getByRole('button', {
    name: 'Market filters',
  });
  const mobileWorkspaceTools = mobilePage.getByRole('button', {
    name: 'Workspace tools',
  });
  const mobileMapBounds = await mobileMap.boundingBox();
  mobileWorkspaceReceipt = {
    access_status: (await mobileAccessStatus.textContent())?.trim() ?? null,
    match_count: positiveFormattedCountWithSuffix(
      (
        await mobileMap
          .getByText(`${expectedFormatted} matches`, { exact: true })
          .textContent()
      )?.trim(),
      'matches',
    ),
    market_filters_visible: await mobileMarketFilters.isVisible(),
    market_filters_collapsed:
      (await mobileMarketFilters.getAttribute('aria-expanded')) === 'false',
    workspace_tools_visible: await mobileWorkspaceTools.isVisible(),
    workspace_tools_collapsed:
      (await mobileWorkspaceTools.getAttribute('aria-expanded')) === 'false',
    map_top_px: mobileMapBounds ? Math.round(mobileMapBounds.y) : null,
    map_within_first_viewport:
      mobileMapBounds !== null && mobileMapBounds.y < mobileViewport.height,
  };
  if (
    mobileWorkspaceReceipt.access_status !== 'Full access' ||
    mobileWorkspaceReceipt.match_count !== expectedCount ||
    mobileWorkspaceReceipt.market_filters_visible !== true ||
    mobileWorkspaceReceipt.market_filters_collapsed !== true ||
    mobileWorkspaceReceipt.workspace_tools_visible !== true ||
    mobileWorkspaceReceipt.workspace_tools_collapsed !== true ||
    mobileWorkspaceReceipt.map_within_first_viewport !== true
  ) {
    throw new Error(
      `Unexpected mobile workspace receipt: ${JSON.stringify(mobileWorkspaceReceipt)}.`,
    );
  }
  await mobilePage.close();

  const methodology = page
    .locator('details')
    .filter({ hasText: 'How CityLens ranks and qualifies parcels' });
  await page
    .getByText('How CityLens ranks and qualifies parcels', { exact: true })
    .click();
  if (
    !(await methodology
      .getByText(/34 of the top 100 received a DOB new-building filing/)
      .isVisible()) ||
    !(await methodology.getByText(/observed 95% interval 25\.5–43\.7%/).isVisible()) ||
    !(await methodology
      .getByText(/104 of the top 1000 did so/)
      .isVisible()) ||
    !(await methodology.getByText(/observed 95% interval 8\.7–12\.4%/).isVisible()) ||
    !(await methodology
      .getByText(/not an independent current-accuracy estimate/)
      .isVisible()) ||
    !(await methodology
      .getByText(/do not include model selection, spatial dependence, dataset shift/)
      .isVisible())
  ) {
    throw new Error(
      'The historical benchmark receipt or its limitations were incomplete.',
    );
  }
  historicalBenchmarkReceiptVerified = true;
  await page.getByLabel('Search parcels').fill('3058920038');
  const officialDossier = page.getByTestId('parcel-official-dossier');
  await officialDossier.waitFor({ timeout: 15_000 });
  if (
    !(await officialDossier
      .getByText('464 OVINGTON AVENUE', { exact: true })
      .isVisible()) ||
    !(await officialDossier
      .getByText('Any NYC tax lot · not a lead score', { exact: true })
      .isVisible()) ||
    (await officialDossier
      .getByText('GEFFEN MANAGEMENT LLC', { exact: true })
      .count()) < 1 ||
    !(await officialDossier
      .getByText('$1,460,000', { exact: true })
      .isVisible()) ||
    !(await officialDossier.getByText('R6A', { exact: true }).isVisible()) ||
    !(await officialDossier
      .getByRole('link', { name: 'ZoLa', exact: true })
      .isVisible()) ||
    !(await officialDossier
      .getByRole('link', { name: 'ACRIS', exact: true })
      .isVisible()) ||
    !(await officialDossier
      .getByRole('link', { name: 'DOB BIS', exact: true })
      .isVisible())
  ) {
    throw new Error(
      'The authenticated official parcel dossier was incomplete.',
    );
  }
  officialDossierVerified = true;
  const readiness = officialDossier.getByTestId(
    'parcel-dossier-readiness',
  );
  if (
    !(await readiness.getByText('Evidence readiness').isVisible()) ||
    !(await readiness
      .getByText('6 of 6 groups present', { exact: false })
      .isVisible()) ||
    !(await readiness
      .getByText('Source review required', { exact: true })
      .isVisible()) ||
    !(await readiness
      .getByTestId('parcel-dossier-action-verify-zoning')
      .isVisible())
  ) {
    throw new Error(
      'The official dossier evidence-readiness guidance was incomplete.',
    );
  }
  dossierReadinessVerified = true;
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
  await page
    .getByLabel('Search parcels')
    .fill('464 Ovington Ave, Brooklyn, NY 11209');
  const resolver = page.getByTestId('parcel-address-resolver');
  await resolver.waitFor({ timeout: 10_000 });
  await resolver
    .getByRole('button', { name: 'Resolve official tax lots' })
    .click();
  await resolver
    .getByText('One official tax lot found')
    .waitFor({ timeout: 15_000 });
  if (
    !(await resolver.getByText('3058920038').isVisible()) ||
    !(await resolver.getByText(/NYC PAD/).isVisible())
  ) {
    throw new Error(
      'The official address resolver did not return its source-bound BBL.',
    );
  }
  await page
    .getByRole('button', { name: 'Check current screening' })
    .click();
  await page
    .getByTestId('parcel-screening-receipt')
    .getByText('Excluded from the current acquisition inventory')
    .waitFor({ timeout: 15_000 });
  addressResolutionVerified = true;

  await page
    .getByRole('button', { name: /Compose an acquisition thesis/i })
    .click();
  await page
    .getByRole('textbox', { name: 'Acquisition thesis' })
    .fill('High-priority sites in Brooklyn near transit');
  await page.getByTestId('thesis-review').click();

  const thesisReceipt = page.getByTestId('thesis-review-receipt');
  const receiptChecks = await Promise.all([
    thesisReceipt.getByText('Geography: Brooklyn').isVisible(),
    thesisReceipt
      .getByText('Priority: High or highest tier')
      .isVisible(),
    thesisReceipt
      .getByText('Site type: Qualified acquisition leads')
      .isVisible(),
    thesisReceipt
      .getByText('Required evidence: Transit within 800 m')
      .isVisible(),
  ]);
  if (!receiptChecks.every(Boolean)) {
    throw new Error(
      'The acquisition-thesis review receipt was incomplete.',
    );
  }
  thesisComposerReceiptVerified = true;

  const thesisMatchText = (
    await page.getByTestId('thesis-match-count').textContent()
  )?.trim();
  if (positiveFormattedCount(thesisMatchText) === null) {
    throw new Error(
      'The reviewed acquisition thesis did not produce a positive full-inventory match count.',
    );
  }
  thesisComposerPositiveMatchVerified = true;

  const thesisEventResponsePromise = page.waitForResponse(
    (response) => {
      if (
        !response.url().includes('/v1/parcel-intel/product-events') ||
        response.request().method() !== 'POST'
      ) {
        return false;
      }
      try {
        return (
          response.request().postDataJSON()?.event ===
          'thesis_composer_applied'
        );
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );
  await page.getByTestId('thesis-apply').click();
  const thesisEventResponse = await thesisEventResponsePromise;
  thesisComposerEventReceipt = summarizeProductEvent(
    thesisEventResponse.status(),
    thesisEventResponse.request().postDataJSON(),
  );
  if (!thesisComposerEventReceipt.value_minimized) {
    throw new Error(
      'The acquisition-thesis event was rejected or exceeded its value-minimized contract.',
    );
  }

  const appliedBorough = await page
    .getByLabel('Filter by borough')
    .inputValue();
  const appliedPriority = await page
    .getByLabel('Filter by priority')
    .inputValue();
  const appliedSiteType = await page
    .getByLabel('Filter by site type')
    .inputValue();
  const signalSummaryVisible = await page
    .getByRole('button', { name: 'Signals (1 active)' })
    .isVisible();
  if (
    appliedBorough !== 'brooklyn' ||
    appliedPriority !== 'high_or_better' ||
    appliedSiteType !== 'uncommitted' ||
    !signalSummaryVisible
  ) {
    throw new Error(
      'The reviewed acquisition thesis did not produce the expected visible filters.',
    );
  }
  thesisComposerFiltersVerified = true;

  const thesisAnnouncement = (
    await page.getByTestId('thesis-announcement').textContent()
  )?.trim();
  if (
    !thesisAnnouncement?.startsWith(
      'Applied 3 reviewed criteria.',
    ) ||
    !thesisAnnouncement.endsWith('current leads match.')
  ) {
    throw new Error(
      'The applied acquisition thesis did not announce its reviewed result.',
    );
  }
  thesisComposerVerified = true;

  // Verify account-scoped run operations without persisting customer
  // identities or values. The receipt keeps only counts and fixed state
  // categories; it never stores run ids, addresses, cursors, artifact URLs,
  // backend error text, or exact run timestamps.
  sensitiveSurface = true;
  try {
    const runListResponsePromise = page.waitForResponse(
      (response) => {
        try {
          return (
            new URL(response.url()).pathname === '/v1/runs' &&
            response.request().method() === 'GET'
          );
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    );
    await page.goto(`${webBase}/runs`, { waitUntil: 'networkidle' });
    const runListResponse = await runListResponsePromise;
    const runListPayload = await runListResponse
      .json()
      .catch(() => null);
    const runListReceipt = summarizeRunListResponse(
      runListResponse.status(),
      runListPayload,
    );
    runListReceipts.push(runListReceipt);

    await page
      .getByRole('heading', { level: 1, name: 'Runs' })
      .waitFor({ timeout: 15_000 });
    if (
      (await page.title()) !== 'Runs — CityLens' ||
      (await page.getByTestId('private-run-access-gate').count()) !== 0 ||
      !(await page.getByRole('link', { name: 'New run' }).isVisible()) ||
      runListReceipt.status !== 200 ||
      runListReceipt.shape_valid !== true ||
      runListReceipt.value_minimized !== true
    ) {
      throw new Error('history-shell');
    }
    await page.waitForFunction(
      ({ expected }) => {
        const value = document.querySelector(
          '[data-testid="run-summary-loaded-value"]',
        )?.textContent;
        return (
          Number((value ?? '').replaceAll(',', '').trim()) === expected
        );
      },
      { expected: runListReceipt.item_count },
      { timeout: 15_000 },
    );

    const summaryCounts = {
      loaded: positiveFormattedCount(
        await page
          .getByTestId('run-summary-loaded-value')
          .textContent(),
      ) ?? 0,
      ready: positiveFormattedCount(
        await page
          .getByTestId('run-summary-ready-value')
          .textContent(),
      ) ?? 0,
      processing: positiveFormattedCount(
        await page
          .getByTestId('run-summary-processing-value')
          .textContent(),
      ) ?? 0,
      attention: positiveFormattedCount(
        await page
          .getByTestId('run-summary-attention-value')
          .textContent(),
      ) ?? 0,
    };
    const historyRows = page.getByTestId('run-history-row');
    const domRowCount = await historyRows.count();
    const expectedProcessing =
      runListReceipt.status_counts.queued +
      runListReceipt.status_counts.running;
    const summaryCountsMatch =
      summaryCounts.loaded === runListReceipt.item_count &&
      summaryCounts.ready === runListReceipt.status_counts.succeeded &&
      summaryCounts.processing === expectedProcessing &&
      summaryCounts.attention === runListReceipt.status_counts.failed &&
      domRowCount === runListReceipt.item_count;

    if (!summaryCountsMatch) {
      throw new Error('history-counts');
    }
    if (
      runListReceipt.item_count === 0 &&
      !(await page.getByTestId('run-history-empty').isVisible())
    ) {
      throw new Error('history-empty-state');
    }

    let detailState = 'not_available_empty_history';
    let detailOutputState = 'not_available';
    let detailShellVisible = false;
    let detailStatusVisible = false;
    if (domRowCount > 0) {
      await historyRows.first().click();
      const detailShell = page.getByTestId('run-detail-shell');
      await detailShell.waitFor({ timeout: 20_000 });
      const statusCard = page.getByTestId('run-status-card');
      await statusCard.waitFor({ timeout: 20_000 });
      if ((await page.getByTestId('private-run-access-gate').count()) !== 0) {
        throw new Error('detail-access');
      }
      const output = page
        .locator(
          '[data-testid="artifacts-panel"], [data-testid="artifacts-pending"], [data-testid="artifacts-unavailable"]',
        )
        .first();
      await output.waitFor({ timeout: 30_000 });
      detailOutputState = (await page
        .getByTestId('artifacts-panel')
        .isVisible()
        .catch(() => false))
        ? 'published'
        : (await page
              .getByTestId('artifacts-pending')
              .isVisible()
              .catch(() => false))
          ? 'pending'
          : 'unavailable';
      detailState = 'verified';
      detailShellVisible = await detailShell.isVisible();
      detailStatusVisible = await statusCard.isVisible();
    }

    runOperationsReceipt = {
      history_state:
        runListReceipt.item_count > 0 ? 'populated' : 'empty',
      list_api_verified: true,
      item_count: runListReceipt.item_count,
      next_page_available: runListReceipt.next_cursor_present,
      status_counts: runListReceipt.status_counts,
      dom_row_count: domRowCount,
      summary_counts_match: summaryCountsMatch,
      detail_state: detailState,
      detail_output_state: detailOutputState,
      detail_shell_visible: detailShellVisible,
      detail_status_visible: detailStatusVisible,
      value_minimized: true,
    };
  } catch {
    throw new Error(
      'Authenticated run operations receipt was incomplete.',
    );
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(
      `Browser emitted ${consoleErrors.length} console error(s) and ${pageErrors.length} page error(s).`,
    );
  }
  passed = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  if (!sensitiveSurface) {
    await page
      .screenshot({
        path: path.join(outputDir, 'failure.png'),
        fullPage: true,
      })
      .catch(() => undefined);
  }
} finally {
  await page
    .getByRole('button', { name: 'Sign out' })
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await browser.close();
}

const report = {
  schema_version: 'citylens/production-authenticated-parcel-map@v12',
  verified_at: new Date().toISOString(),
  web_base: webBase,
  expected_count: expectedCount,
  passed,
  failure,
  auth_token_receipts: authTokenReceipts,
  map_receipts: mapReceipts,
  initial_clustered_map_receipt: initialClusteredMapReceipt,
  returning_clustered_map_receipt: returningClusteredMapReceipt,
  returning_session_reload_verified: returningSessionReloadVerified,
  authenticated_public_preview_receipt_count:
    authenticatedPublicPreviewReceiptCount,
  citywide_export_receipt: citywideExportReceipt,
  mobile_workspace_receipt: mobileWorkspaceReceipt,
  screening_receipt_verified: screeningReceiptVerified,
  address_resolution_verified: addressResolutionVerified,
  official_dossier_verified: officialDossierVerified,
  dossier_readiness_verified: dossierReadinessVerified,
  historical_benchmark_receipt_verified: historicalBenchmarkReceiptVerified,
  thesis_composer_verified: thesisComposerVerified,
  thesis_composer_receipt_verified: thesisComposerReceiptVerified,
  thesis_composer_filters_verified: thesisComposerFiltersVerified,
  thesis_composer_positive_match_verified:
    thesisComposerPositiveMatchVerified,
  thesis_composer_event_receipt: thesisComposerEventReceipt,
  run_list_receipts: runListReceipts,
  run_operations_receipt: runOperationsReceipt,
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
