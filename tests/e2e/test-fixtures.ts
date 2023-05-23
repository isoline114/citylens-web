import { test as base } from '@playwright/test';
import { mockBasemapTiles } from './basemap';

export { expect, type Page } from '@playwright/test';

// Browser suites must not consume public map-provider capacity.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await mockBasemapTiles(page);
    await runTest(page);
  },
});
