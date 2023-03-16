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
  { name: 'home', path: '/', current: 'Home', demo: true },
  { name: 'parcels', path: '/parcel-intel', current: 'Parcels', demo: false },
  { name: 'runs', path: '/runs', current: 'Runs', demo: true },
  {
    name: 'new-run',
    path: '/runs/new',
    current: 'Runs',
    demo: false,
    requiredTestId: 'new-run-access-gate',
  },
  { name: 'pricing', path: '/pricing', current: 'Pricing', demo: false },
  { name: 'docs', path: '/docs', current: 'Docs', demo: false },
  { name: 'contact', path: '/contact', current: null, demo: false },
  {
    name: 'sign-in',
    path: '/sign-in',
    current: null,
    demo: false,
    requiredTestId: 'auth-page-shell',
  },
  {
    name: 'api-keys',
    path: '/account/api-keys',
    current: null,
    demo: false,
    requiredTestId: 'api-key-access-gate',
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
      const demoBannerCount = await page
        .getByText(/demo mode \(precomputed\)/i)
        .count();
      const requiredSurfaceCount = route.requiredTestId
        ? await page.getByTestId(route.requiredTestId).count()
        : null;
      const bodyDimensions = await page.evaluate(() => ({
        height: document.body.scrollHeight,
        width: document.body.scrollWidth,
      }));
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
        demo_banner_visible: demoBannerCount > 0,
        expected_demo_banner: route.demo,
        required_surface_test_id: route.requiredTestId ?? null,
        required_surface_count: requiredSurfaceCount,
        body_height_px: bodyDimensions.height,
        body_width_px: bodyDimensions.width,
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
        receipt.demo_banner_visible === route.demo &&
        (route.requiredTestId === undefined ||
          receipt.required_surface_count === 1) &&
        receipt.body_width_px <= viewport.width &&
        receipt.footer_bottom_px !== null &&
        receipt.footer_bottom_px >= viewport.height &&
        receipt.console_error_count === 0 &&
        receipt.page_error_count === 0 &&
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
  schema_version: 'citylens/production-site-shell@v2',
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
