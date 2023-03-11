import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const nextConfig = require('../next.config.js') as {
  poweredByHeader?: boolean;
  headers: () => Promise<
    Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>
  >;
};

describe('browser security headers', () => {
  it('applies the production contract to every route', async () => {
    const routes = await nextConfig.headers();
    const allRoutes = routes.find((route) => route.source === '/:path*');
    const headers = Object.fromEntries(
      (allRoutes?.headers ?? []).map(({ key, value }) => [
        key.toLowerCase(),
        value,
      ]),
    );

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['permissions-policy']).toContain('microphone=()');
    expect(headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-xss-protection']).toBe('0');
  });
});
