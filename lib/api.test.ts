import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiConfigError, createRun, getRuns, joinApiUrl, resolveApiUrl } from '@/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('api client', () => {
  it('normalizes string createRun responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'run-123',
        json: async () => null,
      } as Response),
    );

    const result = await createRun({
      address: '1 Main St',
      imagery_year: 2024,
      baseline_year: 2017,
      segmentation_backend: 'sam2',
      aoi_radius_m: 250,
      outputs: ['previews'],
    });

    expect(result.runId).toBe('run-123');
  });

  it('parses paginated runs responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          items: [{ run_id: 'run-1', status: 'succeeded' }],
          next_cursor: 'cursor-2',
        }),
        text: async () => '',
      } as Response),
    );

    const page = await getRuns({ limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.run_id).toBe('run-1');
    expect(page.nextCursor).toBe('cursor-2');
  });

  it('rebases API-relative URLs against NEXT_PUBLIC_CITYLENS_API_BASE', () => {
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.citylens.dev';

    expect(resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toBe(
      'https://api.citylens.dev/v1/demo/artifacts/demo-1/preview.png',
    );
    expect(resolveApiUrl('https://example.test/preview.png')).toBe('https://example.test/preview.png');
  });

  it('preserves API path prefixes when joining relative API URLs', () => {
    expect(joinApiUrl('https://api.citylens.dev/platform', '/v1/demo/artifacts/demo-1/preview.png')).toBe(
      'https://api.citylens.dev/platform/v1/demo/artifacts/demo-1/preview.png',
    );
  });

  it('requires NEXT_PUBLIC_CITYLENS_API_BASE in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.NEXT_PUBLIC_CITYLENS_API_BASE;

    expect(() => resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toThrow(ApiConfigError);
  });
});
