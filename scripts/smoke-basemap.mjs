import { Buffer } from 'node:buffer';

const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
);

// Keep scheduled browser checks off public tile infrastructure, including
// deployments still using the retired CARTO basemap. API reads remain live.
function isBasemapTile(url) {
  const osm =
    url.hostname === 'tile.openstreetmap.org' ||
    url.hostname.endsWith('.tile.openstreetmap.org');
  const carto =
    url.hostname === 'basemaps.cartocdn.com' ||
    url.hostname.endsWith('.basemaps.cartocdn.com');
  return (
    (osm && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)) ||
    (carto && /^\/light_all\/\d+\/\d+\/\d+(?:@2x)?\.png$/.test(url.pathname))
  );
}

export async function mockSmokeBasemap(context) {
  const receipt = {
    mode: 'mocked',
    live_provider_verified: false,
    intercepted_tile_count: 0,
  };
  await context.route(isBasemapTile, async (route) => {
    await route.fulfill({ contentType: 'image/png', body: tile });
    receipt.intercepted_tile_count += 1;
  });
  return receipt;
}
