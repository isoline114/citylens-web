import { expect, type Locator, type Page } from '@playwright/test';

/** Keep map tests offline for tiles, including the retired CARTO provider. */
export async function mockBasemapTiles(page: Page) {
  const requests: URL[] = [];
  await page.route(
    (url) =>
      url.hostname === 'tile.openstreetmap.org' ||
      url.hostname.endsWith('.tile.openstreetmap.org') ||
      url.hostname === 'basemaps.cartocdn.com' ||
      url.hostname.endsWith('.basemaps.cartocdn.com'),
    async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    },
  );
  return requests;
}

export async function expectOpenStreetMapBasemap(map: Locator, requests: URL[]) {
  await expect
    .poll(() =>
      map.locator('img.leaflet-tile-loaded').evaluateAll((tiles) =>
        tiles.filter(
          (tile) => tile instanceof HTMLImageElement && tile.naturalWidth > 0,
        ).length,
      ),
    )
    .toBeGreaterThan(0);
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(url.origin).toBe('https://tile.openstreetmap.org');
    expect(url.pathname).toMatch(/^\/(?:[0-9]|1[0-9])\/\d+\/\d+\.png$/);
    expect(url.search).toBe('');
  }
  const attribution = map.getByRole('link', { name: 'OpenStreetMap contributors' });
  await expect(attribution).toBeVisible();
  await expect(attribution).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/copyright',
  );
}
