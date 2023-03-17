#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  encryptBrowserDiagnostics,
  positiveFormattedCount,
  positiveFormattedCountWithSuffix,
  summarizeBrowserErrors,
  summarizeParcelCsv,
  summarizeProductEvent,
  summarizeRunListResponse,
  summarizeWorkflowAnalyticsResponse,
} from './production-auth-smoke-support.mjs';

const webBase = (
  process.env.CITYLENS_WEB_BASE || 'https://www.citylens.dev'
).replace(/\/+$/, '');
const email = process.env.CITYLENS_WEB_SMOKE_EMAIL?.trim();
const password = process.env.CITYLENS_WEB_SMOKE_PASSWORD;
const diagnosticPublicKey =
  process.env.CITYLENS_DIAGNOSTIC_PUBLIC_KEY_B64?.trim();
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
let desktopCheckpoint = 'startup';
let mobileCheckpoint = 'mobile_startup';
let screeningReceiptVerified = false;
let addressResolutionVerified = false;
let officialDossierVerified = false;
let dossierReadinessVerified = false;
let salesComparablesVerified = false;
let historicalBenchmarkReceiptVerified = false;
let modelLineageReceiptVerified = false;
let prospectiveValidationReceipt = null;
let workflowOutcomeReceipt = null;
let thesisComposerVerified = false;
let thesisComposerReceiptVerified = false;
let thesisComposerFiltersVerified = false;
let thesisComposerPositiveMatchVerified = false;
let thesisComposerEventReceipt = null;
let returningSessionReloadVerified = false;
let authenticatedPublicPreviewReceiptCount = null;
let initialClusteredMapReceipt = null;
let returningClusteredMapReceipt = null;
let siteRankingReceipt = null;
let citywideExportReceipt = null;
let mobileWorkspaceReceipt = null;
let savedScreenReceipt = null;
let runOperationsReceipt = null;
let leadReviewContractReceipt = null;
let sensitiveSurface = false;
let passed = false;
let failure = null;

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) =>
  pageErrors.push({
    surface: 'desktop',
    name: error.name,
    message: error.message,
    stack: error.stack,
    checkpoint: desktopCheckpoint,
  }),
);
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
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const siteKeys = new Set(
      rows.map((row) => {
        const siteId =
          typeof row?.assemblage_id === 'string'
            ? row.assemblage_id.trim()
            : '';
        return siteId ? `site:${siteId}` : `parcel:${row?.bbl ?? ''}`;
      }),
    );
    mapReceipts.push({
      status: response.status(),
      access_scope: payload.access_scope ?? null,
      returned_count: payload.returned_count ?? null,
      available_count: payload.available_count ?? null,
      inventory_complete: payload.inventory_complete ?? null,
      row_count: rows.length,
      acquisition_site_count: siteKeys.size,
      assemblage_member_row_count: rows.filter(
        (row) =>
          typeof row?.assemblage_id === 'string' &&
          row.assemblage_id.trim().length > 0,
      ).length,
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
  desktopCheckpoint = 'sign_in_navigation';
  await page.goto(
    `${webBase}/sign-in?next=${encodeURIComponent('/parcel-intel')}`,
    { waitUntil: 'networkidle' },
  );
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/parcel-intel', { timeout: 20_000 });

  desktopCheckpoint = 'parcel_workspace';
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
  const completeMapReceipt = mapReceipts.find(
    (receipt) =>
      receipt.status === 200 &&
      receipt.access_scope === 'authenticated_full' &&
      receipt.returned_count === expectedCount &&
      receipt.available_count === expectedCount &&
      receipt.inventory_complete === true &&
      receipt.row_count === expectedCount,
  );
  const siteRankingCount = page.getByTestId('parcel-site-ranking-count');
  await siteRankingCount.waitFor({ timeout: 20_000 });
  siteRankingReceipt = {
    site_count: Number(await siteRankingCount.getAttribute('data-site-count')),
    parcel_count: Number(
      await siteRankingCount.getAttribute('data-parcel-count'),
    ),
    api_site_count: completeMapReceipt?.acquisition_site_count ?? null,
    assemblage_member_row_count:
      completeMapReceipt?.assemblage_member_row_count ?? null,
  };
  if (
    !Number.isSafeInteger(siteRankingReceipt.site_count) ||
    siteRankingReceipt.site_count <= 0 ||
    siteRankingReceipt.site_count > expectedCount ||
    siteRankingReceipt.parcel_count !== expectedCount ||
    siteRankingReceipt.api_site_count !== siteRankingReceipt.site_count
  ) {
    throw new Error(
      `Unexpected acquisition-site ranking receipt: ${JSON.stringify(siteRankingReceipt)}.`,
    );
  }
  siteRankingReceipt.collapsed_duplicate_slots =
    siteRankingReceipt.parcel_count - siteRankingReceipt.site_count;

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
  desktopCheckpoint = 'parcel_reload';
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

  // Exercise the real private persistence path without leaving synthetic
  // workspace state behind. This proves the toolbar count and API-backed
  // create/delete loop against production while restoring the smoke account
  // to its exact starting count.
  desktopCheckpoint = 'saved_screen_persistence';
  const savedViewsTrigger = page.getByRole('button', {
    name: 'Saved views',
    exact: true,
  });
  await savedViewsTrigger.click();
  const savedViewsPanel = page.getByTestId('saved-views-panel');
  await savedViewsPanel.waitFor({ timeout: 20_000 });
  await savedViewsPanel
    .getByText('Loading saved views…', { exact: true })
    .waitFor({ state: 'hidden', timeout: 20_000 });
  const savedViewDeleteButtons = savedViewsPanel.locator(
    'button[aria-label^="Delete saved view "]',
  );
  const initialSavedViewCount = await savedViewDeleteButtons.count();
  const closeButton = savedViewsPanel.getByRole('button', {
    name: 'Close saved views',
  });
  const browseFocusVerified = await closeButton.evaluate(
    (element) => element === document.activeElement,
  );
  const smokeViewName = `Production smoke ${Date.now()}`;
  const smokeDeleteButton = savedViewsPanel.getByRole('button', {
    name: `Delete saved view ${smokeViewName}`,
    exact: true,
  });
  let createdSavedViewCount = null;
  let restoredSavedViewCount = null;
  let headerCountAfterCreate = null;
  let headerCountAfterCleanup = null;
  let cleanupVerified = false;
  let createdSavedViewUrl = null;
  let createdSavedViewAuthorization = null;
  try {
    await savedViewsPanel.getByLabel('View name').fill(smokeViewName);
    const savedViewCreateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/v1\/parcel-intel\/saved-searches\/[^/]+$/.test(
          new URL(response.url()).pathname,
        ),
      { timeout: 20_000 },
    );
    await savedViewsPanel.getByTestId('saved-view-save').click();
    const savedViewCreateResponse = await savedViewCreateResponsePromise;
    createdSavedViewUrl = savedViewCreateResponse.url();
    createdSavedViewAuthorization =
      (await savedViewCreateResponse.request().allHeaders()).authorization ??
      null;
    if (!savedViewCreateResponse.ok()) {
      throw new Error(
        `Saved-screen create returned HTTP ${savedViewCreateResponse.status()}.`,
      );
    }
    await smokeDeleteButton.waitFor({ timeout: 20_000 });
    createdSavedViewCount = await savedViewDeleteButtons.count();
    const savedViewCountBadge = page.getByTestId('saved-view-count');
    await page.waitForFunction(
      ({ count }) =>
        document
          .querySelector('[data-testid="saved-view-count"]')
          ?.textContent?.trim() === String(count),
      { count: initialSavedViewCount + 1 },
      { timeout: 20_000 },
    );
    headerCountAfterCreate = Number(
      (await savedViewCountBadge.textContent())?.trim(),
    );
  } finally {
    if ((await smokeDeleteButton.count()) > 0) {
      await smokeDeleteButton.click({ timeout: 20_000 });
      await smokeDeleteButton.waitFor({ state: 'detached', timeout: 20_000 });
    } else if (createdSavedViewUrl && createdSavedViewAuthorization) {
      const cleanupResponse = await page.request.delete(createdSavedViewUrl, {
        headers: { authorization: createdSavedViewAuthorization },
      });
      if (!cleanupResponse.ok() && cleanupResponse.status() !== 404) {
        throw new Error(
          `Saved-screen cleanup returned HTTP ${cleanupResponse.status()}.`,
        );
      }
    }
    restoredSavedViewCount = await savedViewDeleteButtons.count();
    if (initialSavedViewCount === 0) {
      await page
        .getByTestId('saved-view-count')
        .waitFor({ state: 'detached', timeout: 20_000 });
    } else {
      await page.waitForFunction(
        ({ count }) =>
          document
            .querySelector('[data-testid="saved-view-count"]')
            ?.textContent?.trim() === String(count),
        { count: initialSavedViewCount },
        { timeout: 20_000 },
      );
      headerCountAfterCleanup = Number(
        (await page.getByTestId('saved-view-count').textContent())?.trim(),
      );
    }
    cleanupVerified =
      restoredSavedViewCount === initialSavedViewCount &&
      (initialSavedViewCount === 0
        ? headerCountAfterCleanup === null
        : headerCountAfterCleanup === initialSavedViewCount);
    await closeButton.click();
    await savedViewsPanel.waitFor({ state: 'detached', timeout: 20_000 });
  }
  savedScreenReceipt = {
    initial_count: initialSavedViewCount,
    created_count: createdSavedViewCount,
    header_count_after_create: headerCountAfterCreate,
    header_count_after_cleanup: headerCountAfterCleanup,
    restored_count: restoredSavedViewCount,
    browse_focus_verified: browseFocusVerified,
    cleanup_verified: cleanupVerified,
  };
  if (
    createdSavedViewCount !== initialSavedViewCount + 1 ||
    headerCountAfterCreate !== initialSavedViewCount + 1 ||
    browseFocusVerified !== true ||
    cleanupVerified !== true
  ) {
    throw new Error(
      `Unexpected saved-screen receipt: ${JSON.stringify(savedScreenReceipt)}.`,
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
  desktopCheckpoint = 'parcel_export';
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

  // Verify the private, generation-bound relevance-review surface without
  // submitting synthetic practitioner feedback. A monitor must never pollute
  // the product-quality evidence it is responsible for checking.
  desktopCheckpoint = 'lead_review_contract';
  const leadReviewResponsePromise = page.waitForResponse(
    (response) => {
      try {
        return (
          response.request().method() === 'GET' &&
          /^\/v1\/parcel-intel\/lead-reviews\/[^/]+$/.test(
            new URL(response.url()).pathname,
          )
        );
      } catch {
        return false;
      }
    },
    { timeout: 20_000 },
  );
  await page.locator('[data-parcel-ranking-bbl]').first().click();
  const leadReviewResponse = await leadReviewResponsePromise;
  const leadReviewPayload = await leadReviewResponse.json().catch(() => null);
  const leadReviewCard = page.getByTestId('parcel-lead-review');
  await leadReviewCard.waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="parcel-lead-review"]')
        ?.getAttribute('data-state') === 'ready',
    undefined,
    { timeout: 20_000 },
  );
  const currentGeneration =
    leadReviewPayload &&
    typeof leadReviewPayload === 'object' &&
    typeof leadReviewPayload.current_feed_generation === 'string'
      ? leadReviewPayload.current_feed_generation
      : null;
  const existingReview =
    leadReviewPayload &&
    typeof leadReviewPayload === 'object' &&
    leadReviewPayload.review &&
    typeof leadReviewPayload.review === 'object'
      ? leadReviewPayload.review
      : null;
  leadReviewContractReceipt = {
    status: leadReviewResponse.status(),
    schema:
      leadReviewPayload && typeof leadReviewPayload === 'object'
        ? leadReviewPayload.schema_version ?? null
        : null,
    generation_shape_valid:
      typeof currentGeneration === 'string' &&
      /^[0-9]{8}T[0-9]{12}Z-[0-9a-f]{12}$/.test(currentGeneration),
    existing_review_shape_valid:
      existingReview === null ||
      (existingReview.schema_version ===
        'citylens/parcel-lead-review@v1' &&
        existingReview.feed_generation === currentGeneration),
    card_state: await leadReviewCard.getAttribute('data-state'),
    rank_boundary_visible: await leadReviewCard
      .getByText(/never changes rank/i)
      .isVisible(),
    outcome_boundary_visible: await leadReviewCard
      .getByText(/separate from pipeline outcomes/i)
      .isVisible(),
    mutation_requested: false,
  };
  if (
    leadReviewContractReceipt.status !== 200 ||
    leadReviewContractReceipt.schema !==
      'citylens/parcel-lead-review-state@v1' ||
    leadReviewContractReceipt.generation_shape_valid !== true ||
    leadReviewContractReceipt.existing_review_shape_valid !== true ||
    leadReviewContractReceipt.card_state !== 'ready' ||
    leadReviewContractReceipt.rank_boundary_visible !== true ||
    leadReviewContractReceipt.outcome_boundary_visible !== true
  ) {
    throw new Error(
      `The generation-bound lead-review contract was incomplete: ${JSON.stringify(leadReviewContractReceipt)}.`,
    );
  }
  await page
    .getByRole('button', {
      name: 'Close parcel panel and return to ranked parcels',
    })
    .click();

  const mobilePage = await context.newPage();
  mobilePage.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`[mobile] ${message.text()}`);
    }
  });
  mobilePage.on('pageerror', (error) =>
    pageErrors.push({
      surface: 'mobile',
      name: error.name,
      message: error.message,
      stack: error.stack,
      checkpoint: mobileCheckpoint,
    }),
  );
  await mobilePage.setViewportSize(mobileViewport);
  mobileCheckpoint = 'mobile_workspace';
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

  const modelLineage = methodology.getByTestId('model-lineage-receipt');
  if (
    !(await modelLineage.isVisible()) ||
    (await modelLineage.getAttribute('data-status')) !== 'verified' ||
    !(await modelLineage.getByText('2018 · 2020 · 2022').isVisible()) ||
    !(await modelLineage.getByText('2024 → 2025').isVisible()) ||
    !(await modelLineage.getByText('Current records').isVisible()) ||
    !(await modelLineage
      .getByText(/not this final refit(?:'|’|&apos;)s current hit rate/i)
      .isVisible())
  ) {
    throw new Error(
      'The temporal model-lineage receipt was incomplete or misleading.',
    );
  }
  modelLineageReceiptVerified = true;

  const prospectiveValidation = methodology.getByTestId(
    'prospective-validation-status',
  );
  const prospectiveStatus =
    await prospectiveValidation.getAttribute('data-status');
  const prospectiveHealth =
    await prospectiveValidation.getAttribute('data-health');
  const prospectiveSchema =
    await prospectiveValidation.getAttribute('data-schema');
  const prospectiveSiteCount = Number(
    await prospectiveValidation.getAttribute('data-site-count'),
  );
  const prospectiveTop100SiteCount = Number(
    await prospectiveValidation.getAttribute(
      'data-site-top-100-count',
    ),
  );
  const prospectiveTop1000SiteCount = Number(
    await prospectiveValidation.getAttribute(
      'data-site-top-1000-count',
    ),
  );
  const acceptedProspectiveStatuses = new Set([
    'awaiting_post_issue_data',
    'collecting',
    'mature',
  ]);
  const statusBoundaryVisible =
    prospectiveStatus === 'awaiting_post_issue_data'
      ? await prospectiveValidation
          .getByText(/intentionally unavailable—not 0%/i)
          .isVisible()
      : prospectiveStatus === 'collecting'
        ? await prospectiveValidation
            .getByText(/lower bounds, not final accuracy/i)
            .isVisible()
        : prospectiveStatus === 'mature'
          ? await prospectiveValidation
              .getByText(/complete 365-day DOB New Building filing outcome window/i)
              .isVisible()
          : false;
  prospectiveValidationReceipt = {
    schema: prospectiveSchema,
    status: prospectiveStatus,
    health: prospectiveHealth,
    site_count: prospectiveSiteCount,
    top_100_site_count: prospectiveTop100SiteCount,
    top_1000_site_count: prospectiveTop1000SiteCount,
    map_site_count: siteRankingReceipt?.site_count ?? null,
    visible: await prospectiveValidation.isVisible(),
    claim_boundary_visible: statusBoundaryVisible,
  };
  if (
    prospectiveSchema !==
      'citylens-parcel-intel/prospective-validation-status@v2' ||
    !acceptedProspectiveStatuses.has(prospectiveStatus) ||
    prospectiveHealth !== 'current' ||
    !Number.isSafeInteger(prospectiveSiteCount) ||
    prospectiveSiteCount !== siteRankingReceipt?.site_count ||
    prospectiveTop100SiteCount !== 100 ||
    prospectiveTop1000SiteCount !== 1000 ||
    prospectiveValidationReceipt.visible !== true ||
    prospectiveValidationReceipt.claim_boundary_visible !== true
  ) {
    throw new Error(
      `The live prospective-validation receipt was incomplete: ${JSON.stringify(prospectiveValidationReceipt)}.`,
    );
  }

  desktopCheckpoint = 'workflow_outcome_evidence';
  const workflowAnalyticsResponsePromise = page.waitForResponse(
    (response) => {
      try {
        return (
          new URL(response.url()).pathname ===
            '/v1/parcel-intel/workflow/analytics' &&
          response.request().method() === 'GET'
        );
      } catch {
        return false;
      }
    },
    { timeout: 30_000 },
  );
  const workflowInsightsTrigger = page.getByRole('button', {
    name: 'Outcome insights',
  });
  await workflowInsightsTrigger.click();
  const workflowAnalyticsResponse =
    await workflowAnalyticsResponsePromise;
  const workflowAnalyticsPayload = await workflowAnalyticsResponse
    .json()
    .catch(() => null);
  const workflowAnalyticsApiReceipt =
    summarizeWorkflowAnalyticsResponse(
      workflowAnalyticsResponse.status(),
      workflowAnalyticsPayload,
    );
  const workflowInsightsPanel = page.getByTestId(
    'workflow-insights-panel',
  );
  await workflowInsightsPanel.waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const state = document
        .querySelector('[data-testid="workflow-insights-panel"]')
        ?.getAttribute('data-state');
      return state !== null && state !== 'loading';
    },
    undefined,
    { timeout: 20_000 },
  );
  const workflowInsightsUiState =
    await workflowInsightsPanel.getAttribute('data-state');
  const expectedWorkflowInsightsUiState =
    workflowAnalyticsApiReceipt.cohort_state === 'empty'
      ? 'empty'
      : workflowAnalyticsApiReceipt.cohort_state;
  const workflowEvidenceBoundary = workflowInsightsPanel.getByTestId(
    'workflow-insights-evidence-boundary',
  );
  const workflowMaturityBoundary = workflowInsightsPanel.getByTestId(
    'workflow-insights-maturity-boundary',
  );
  const workflowEvidenceBoundaryVisible =
    (await workflowEvidenceBoundary.isVisible()) &&
    /not the historical model(?:'|’)s validation accuracy/i.test(
      (await workflowEvidenceBoundary.textContent()) ?? '',
    );
  const workflowMaturityBoundaryVisible =
    (await workflowMaturityBoundary.isVisible()) &&
    /rates remain hidden as .Collecting. until/i.test(
      (await workflowMaturityBoundary.textContent()) ?? '',
    );
  const workflowEmptyStateVisible =
    workflowAnalyticsApiReceipt.cohort_state === 'empty'
      ? await workflowInsightsPanel
          .getByTestId('workflow-evidence-empty')
          .getByText(/never from demo or synthetic outcomes/i)
          .isVisible()
      : null;
  await workflowInsightsPanel
    .getByRole('button', { name: 'Close outcome insights' })
    .click();
  await workflowInsightsTrigger.waitFor({ state: 'visible' });
  const workflowFocusRestored = await page
    .waitForFunction(
      () =>
        document.activeElement?.getAttribute(
          'data-tool-panel-trigger',
        ) === 'insights',
      undefined,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false);
  workflowOutcomeReceipt = {
    ...workflowAnalyticsApiReceipt,
    ui_state: workflowInsightsUiState,
    evidence_boundary_visible: workflowEvidenceBoundaryVisible,
    maturity_boundary_visible: workflowMaturityBoundaryVisible,
    empty_state_honest:
      workflowAnalyticsApiReceipt.cohort_state === 'empty'
        ? workflowEmptyStateVisible
        : null,
    focus_restored: workflowFocusRestored,
  };
  if (
    workflowAnalyticsApiReceipt.shape_valid !== true ||
    workflowAnalyticsApiReceipt.maturity_boundary_safe !== true ||
    workflowAnalyticsApiReceipt.value_minimized !== true ||
    workflowInsightsUiState !== expectedWorkflowInsightsUiState ||
    workflowEvidenceBoundaryVisible !== true ||
    workflowMaturityBoundaryVisible !== true ||
    (workflowAnalyticsApiReceipt.cohort_state === 'empty' &&
      workflowEmptyStateVisible !== true) ||
    workflowFocusRestored !== true
  ) {
    throw new Error(
      `The private workflow-outcome receipt was incomplete: ${JSON.stringify(workflowOutcomeReceipt)}.`,
    );
  }

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
  const salesComparables = officialDossier.getByTestId(
    'parcel-sales-comparables',
  );
  await salesComparables
    .getByRole('button', { name: 'Load sale context' })
    .click();
  const salesComparablesReady = salesComparables.getByTestId(
    'parcel-sales-comparables-ready',
  );
  await salesComparablesReady.waitFor({ timeout: 20_000 });
  const comparableSaleCount = await salesComparablesReady
    .getByTestId('parcel-comparable-sale')
    .count();
  if (
    comparableSaleCount < 1 ||
    comparableSaleCount > 5 ||
    !(await salesComparablesReady
      .getByText('Median sale', { exact: true })
      .isVisible()) ||
    !(await salesComparablesReady
      .getByRole('link', { name: 'DOF source', exact: true })
      .isVisible()) ||
    !(await salesComparablesReady
      .getByText(/not an appraisal/i)
      .isVisible())
  ) {
    throw new Error(
      'The official comparable-sale screen was incomplete or misleading.',
    );
  }
  salesComparablesVerified = true;
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
    desktopCheckpoint = 'run_history_navigation';
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
      desktopCheckpoint = 'run_detail_navigation';
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
      desktopCheckpoint = 'run_detail_complete';
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
    const errorReceipt = {
      console: summarizeBrowserErrors(consoleErrors),
      page: summarizeBrowserErrors(pageErrors),
    };
    throw new Error(
      `Browser emitted ${consoleErrors.length} console error(s) and ${pageErrors.length} page error(s): ${JSON.stringify(errorReceipt)}.`,
    );
  }
  desktopCheckpoint = 'verification_complete';
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
  schema_version: 'citylens/production-authenticated-parcel-map@v21',
  verified_at: new Date().toISOString(),
  web_base: webBase,
  expected_count: expectedCount,
  passed,
  failure,
  auth_token_receipts: authTokenReceipts,
  map_receipts: mapReceipts,
  initial_clustered_map_receipt: initialClusteredMapReceipt,
  returning_clustered_map_receipt: returningClusteredMapReceipt,
  site_ranking_receipt: siteRankingReceipt,
  returning_session_reload_verified: returningSessionReloadVerified,
  authenticated_public_preview_receipt_count:
    authenticatedPublicPreviewReceiptCount,
  citywide_export_receipt: citywideExportReceipt,
  mobile_workspace_receipt: mobileWorkspaceReceipt,
  saved_screen_receipt: savedScreenReceipt,
  screening_receipt_verified: screeningReceiptVerified,
  address_resolution_verified: addressResolutionVerified,
  official_dossier_verified: officialDossierVerified,
  dossier_readiness_verified: dossierReadinessVerified,
  sales_comparables_verified: salesComparablesVerified,
  lead_review_contract_receipt: leadReviewContractReceipt,
  historical_benchmark_receipt_verified: historicalBenchmarkReceiptVerified,
  model_lineage_receipt_verified: modelLineageReceiptVerified,
  prospective_validation_receipt: prospectiveValidationReceipt,
  workflow_outcome_receipt: workflowOutcomeReceipt,
  thesis_composer_verified: thesisComposerVerified,
  thesis_composer_receipt_verified: thesisComposerReceiptVerified,
  thesis_composer_filters_verified: thesisComposerFiltersVerified,
  thesis_composer_positive_match_verified:
    thesisComposerPositiveMatchVerified,
  thesis_composer_event_receipt: thesisComposerEventReceipt,
  run_list_receipts: runListReceipts,
  run_operations_receipt: runOperationsReceipt,
  console_error_count: consoleErrors.length,
  console_error_receipts: summarizeBrowserErrors(consoleErrors),
  page_error_count: pageErrors.length,
  page_error_receipts: summarizeBrowserErrors(pageErrors),
};

await fs.writeFile(
  path.join(outputDir, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
if (diagnosticPublicKey && pageErrors.length > 0) {
  const encryptedDiagnostic = encryptBrowserDiagnostics(
    pageErrors,
    diagnosticPublicKey,
  );
  if (encryptedDiagnostic) {
    await fs.writeFile(
      path.join(outputDir, 'browser-diagnostic.encrypted.json'),
      `${JSON.stringify(encryptedDiagnostic, null, 2)}\n`,
      'utf8',
    );
  }
}
console.log(JSON.stringify(report, null, 2));
process.exit(passed ? 0 : 1);
