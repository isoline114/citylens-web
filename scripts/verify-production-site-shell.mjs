#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const webBase = (
  process.env.CITYLENS_WEB_BASE || 'https://www.citylens.dev'
).replace(/\/+$/, '');
const outputDir = path.resolve(
  process.env.CITYLENS_SHELL_SMOKE_OUTPUT_DIR ||
    'test-results/production-shell-smoke',
);
const routes = [
  {
    name: 'home',
    path: '/',
    current: 'Home',
    requiredTestId: 'home-closing-cta',
  },
  { name: 'parcels', path: '/parcel-intel', current: 'Parcels' },
  {
    name: 'runs',
    path: '/runs',
    current: 'Runs',
    requiredTestId: 'public-evidence-library',
  },
  {
    name: 'new-run',
    path: '/runs/new',
    current: 'Runs',
    requiredTestId: 'new-run-access-gate',
  },
  { name: 'pricing', path: '/pricing', current: 'Pricing' },
  {
    name: 'docs',
    path: '/docs',
    current: 'Docs',
    requiredTestId: 'developer-center-hero',
  },
  { name: 'contact', path: '/contact', current: null },
  {
    name: 'sign-in',
    path: '/sign-in',
    current: null,
    requiredTestId: 'auth-page-shell',
  },
  {
    name: 'sign-up',
    path: '/sign-up',
    current: null,
    requiredTestId: 'auth-page-shell',
  },
  {
    name: 'forgot-password',
    path: '/forgot-password',
    current: null,
    requiredTestId: 'auth-page-shell',
  },
  {
    name: 'reset-password',
    path: '/reset-password',
    current: null,
    requiredTestId: 'auth-page-shell',
  },
  {
    name: 'verify-email',
    path: '/verify-email',
    current: null,
    requiredTestId: 'auth-page-shell',
  },
  {
    name: 'api-keys',
    path: '/account/api-keys',
    current: null,
    requiredTestId: 'api-key-access-gate',
  },
  {
    name: 'privacy',
    path: '/privacy',
    current: null,
    requiredTestId: 'legal-document-shell',
  },
  {
    name: 'terms',
    path: '/terms',
    current: null,
    requiredTestId: 'legal-document-shell',
  },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];
const summarizeBrowserErrors = (messages) =>
  messages
    .slice(0, 3)
    .map((message) => message.replace(/\s+/g, ' ').slice(0, 500));

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const receipts = [];
let failure = null;

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });

    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const startedAt = performance.now();
      const response = await page.goto(`${webBase}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 45_000,
      });
      const main = page.getByRole('main');
      const mainBounds = await main.boundingBox();
      const footerBounds = await page.locator('footer').boundingBox();
      const primaryNavigation =
        viewport.name === 'desktop'
          ? page.getByRole('navigation', { name: 'Primary navigation' })
          : page.getByRole('navigation', {
              name: 'Mobile primary navigation',
            });
      const currentLabels = await primaryNavigation
        .locator('[aria-current="page"]')
        .allTextContents();
      const requiredSurfaceCount = route.requiredTestId
        ? await page.getByTestId(route.requiredTestId).count()
        : null;
      const bodyDimensions = await page.evaluate(() => ({
        height: document.body.scrollHeight,
        width: document.body.scrollWidth,
      }));
      const docsDisclosureReceipt =
        route.name === 'docs'
          ? await page.evaluate(() => ({
              section_count: document.querySelectorAll(
                'details[data-testid^="docs-section-"]',
              ).length,
              open_section_count: document.querySelectorAll(
                'details[open][data-testid^="docs-section-"]',
              ).length,
            }))
          : null;
      const publicEvidenceReceipt =
        route.name === 'runs'
          ? {
              card_count: await page.getByTestId('featured-demo-card').count(),
              first_href: await page
                .getByTestId('featured-demo-card')
                .first()
                .getAttribute('href'),
            }
          : null;
      const receipt = {
        route: route.name,
        path: route.path,
        viewport: viewport.name,
        status: response?.status() ?? null,
        title: await page.title(),
        main_count: await main.count(),
        main_width_px: mainBounds ? Math.round(mainBounds.width) : null,
        current_navigation: currentLabels,
        expected_current_navigation: route.current,
        required_surface_test_id: route.requiredTestId ?? null,
        required_surface_count: requiredSurfaceCount,
        body_height_px: bodyDimensions.height,
        body_width_px: bodyDimensions.width,
        docs_section_count: docsDisclosureReceipt?.section_count ?? null,
        docs_open_section_count:
          docsDisclosureReceipt?.open_section_count ?? null,
        public_evidence_card_count: publicEvidenceReceipt?.card_count ?? null,
        public_evidence_first_href: publicEvidenceReceipt?.first_href ?? null,
        footer_bottom_px: footerBounds
          ? Math.round(footerBounds.y + footerBounds.height)
          : null,
        viewport_height_px: viewport.height,
        viewport_width_px: viewport.width,
        duration_ms: Math.round(performance.now() - startedAt),
        console_error_count: consoleErrors.length,
        console_error_messages: summarizeBrowserErrors(consoleErrors),
        page_error_count: pageErrors.length,
        page_error_messages: summarizeBrowserErrors(pageErrors),
        passed: false,
      };
      receipt.passed =
        receipt.status === 200 &&
        receipt.title.length > 0 &&
        receipt.main_count === 1 &&
        receipt.current_navigation.length === (route.current ? 1 : 0) &&
        (route.current === null ||
          receipt.current_navigation[0]?.trim() === route.current) &&
        (route.requiredTestId === undefined ||
          receipt.required_surface_count === 1) &&
        receipt.body_width_px <= viewport.width &&
        receipt.footer_bottom_px !== null &&
        receipt.footer_bottom_px >= viewport.height &&
        receipt.console_error_count === 0 &&
        receipt.page_error_count === 0 &&
        (route.name !== 'home' ||
          (viewport.name === 'desktop'
            ? receipt.body_height_px <= 3_800
            : receipt.body_height_px <= 5_000)) &&
        (route.name !== 'docs' ||
          (receipt.docs_section_count === 6 &&
            receipt.docs_open_section_count === 1 &&
            (viewport.name === 'desktop'
              ? receipt.body_height_px <= 3_200
              : receipt.body_height_px <= 4_800))) &&
        (route.name !== 'runs' ||
          ((receipt.public_evidence_card_count ?? 0) >= 1 &&
            /^\/runs\/[^?]+\?demo=1$/.test(
              receipt.public_evidence_first_href ?? '',
            ))) &&
        (route.name !== 'parcels' ||
          viewport.name !== 'desktop' ||
          (receipt.main_width_px !== null &&
            receipt.main_width_px >= viewport.width * 0.92));
      receipts.push(receipt);
      await page.close();
    }

    await context.close();
  }

  const skipContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const skipPage = await skipContext.newPage();
  await skipPage.goto(`${webBase}/pricing`, {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  await skipPage.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await skipPage.keyboard.press('Tab');
  const skipLink = skipPage.getByRole('link', { name: 'Skip to content' });
  const skipLinkFocused = await skipLink.evaluate(
    (element) => document.activeElement === element,
  );
  await skipLink.press('Enter');
  const skipTargetFocused = await skipPage
    .getByRole('main')
    .evaluate((element) => document.activeElement === element);
  receipts.push({
    route: 'pricing',
    path: '/pricing',
    viewport: 'keyboard',
    skip_link_focused: skipLinkFocused,
    skip_target_focused: skipTargetFocused,
    passed: skipLinkFocused && skipTargetFocused,
  });
  await skipContext.close();

  const failed = receipts.filter((receipt) => !receipt.passed);
  if (failed.length > 0) {
    throw new Error(
      `Production shell failed ${failed.length} receipt(s): ${JSON.stringify(
        failed,
      )}`,
    );
  }
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
}

const report = {
  schema_version: 'citylens/production-site-shell@v4',
  verified_at: new Date().toISOString(),
  web_base: webBase,
  passed: failure === null,
  failure,
  receipt_count: receipts.length,
  receipts,
};

await fs.writeFile(
  path.join(outputDir, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
