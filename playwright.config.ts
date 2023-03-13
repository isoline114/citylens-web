import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(
  process.env.PLAYWRIGHT_PORT ?? (process.env.CI ? '3000' : '3100'),
  10,
);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: process.env.CI
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    // Never let a stale developer server satisfy the e2e precondition. The
    // harness must own the server so its env and source match the test run.
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      // Disable the SSR featured-demos fetch entirely during e2e — the
      // test's expectations rely on `page.route` mocks of the browser
      // fetch path, and Server-side fetches bypass those mocks. With
      // this set, RunForm falls through to its client-side fetch where
      // page.route does intercept.
      CITYLENS_DISABLE_SSR_DEMOS: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
