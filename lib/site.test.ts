import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeSiteBasePath, publicAssetPath, withSiteBasePath } from '@/lib/site';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('site path helpers', () => {
  it('normalizes empty and slash-only base paths', () => {
    expect(normalizeSiteBasePath('')).toBe('');
    expect(normalizeSiteBasePath('/')).toBe('');
  });

  it('normalizes a subpath and prefixes public assets', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_BASE_PATH', '/citylens-web/');

    expect(normalizeSiteBasePath('/citylens-web/')).toBe('/citylens-web');
    expect(withSiteBasePath('/runs')).toBe('/citylens-web/runs');
    expect(publicAssetPath('/hero-citylens.png')).toBe('/citylens-web/hero-citylens.png');
  });
});
