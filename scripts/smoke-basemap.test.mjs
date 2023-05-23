import { describe, expect, it, vi } from 'vitest';

import { mockSmokeBasemap } from './smoke-basemap.mjs';

describe('automated browser basemap interception', () => {
  it('fulfills known map tiles locally and records that the provider was not verified', async () => {
    const context = { route: vi.fn() };
    const receipt = await mockSmokeBasemap(context);
    const [matches, handle] = context.route.mock.calls[0];
    const route = { fulfill: vi.fn() };

    for (const url of [
      'https://tile.openstreetmap.org/12/1200/1500.png',
      'https://a.tile.openstreetmap.org/12/1200/1500.png',
      'https://a.basemaps.cartocdn.com/light_all/12/1200/1500.png',
      'https://b.basemaps.cartocdn.com/light_all/12/1200/1500@2x.png',
    ]) {
      expect(matches(new URL(url))).toBe(true);
      await handle(route);
    }

    expect(receipt).toEqual({
      mode: 'mocked',
      live_provider_verified: false,
      intercepted_tile_count: 4,
    });
    const image = route.fulfill.mock.calls[0][0];
    expect(image.contentType).toBe('image/png');
    expect([...image.body.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('leaves API, authentication, artifacts, and unrelated resources live', async () => {
    const context = { route: vi.fn() };
    await mockSmokeBasemap(context);
    const [matches] = context.route.mock.calls[0];

    for (const url of [
      'https://www.citylens.dev/v1/parcel-intel/map?top=5000',
      'https://api.citylens.dev/v1/runs',
      'https://www.citylens.dev/api/auth/token',
      'https://api.citylens.dev/v1/demo/reference/artifacts/preview.png',
      'https://www.citylens.dev/_next/static/map.js',
      'https://tile.openstreetmap.org/api/status',
      'https://tile.openstreetmap.org.example.org/12/1200/1500.png',
      'https://other.example.org/12/1200/1500.png',
    ]) {
      expect(matches(new URL(url))).toBe(false);
    }
  });
});
