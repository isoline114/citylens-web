import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  createRun,
  getDemoRun,
  getFeaturedDemos,
  getRun,
  getRuns,
  joinApiUrl,
  resolveApiUrl,
} from '@/lib/api';

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

  it('uses same-origin relative URLs in production when NEXT_PUBLIC_CITYLENS_API_BASE is not set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.NEXT_PUBLIC_CITYLENS_API_BASE;

    expect(resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toBe(
      '/v1/demo/artifacts/demo-1/preview.png',
    );
  });

  it('joinApiUrl handles empty base for same-origin', () => {
    expect(joinApiUrl('', '/v1/demo/featured')).toBe('/v1/demo/featured');
    expect(joinApiUrl('', 'v1/health')).toBe('/v1/health');
    expect(joinApiUrl('', '')).toBe('/');
  });
});

describe('demo fetches do not send API key', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubFetch(body: unknown) {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);
    return mockFetch;
  }

  it('getFeaturedDemos does not include X-API-Key header', async () => {
    const mockFetch = stubFetch({
      Featured: [{ run_id: 'demo-1', label: 'Test', address: 'Addr', imagery_year: 2024, baseline_year: 2017, segmentation_backend: 'sam2', outputs: [] }],
    });

    vi.stubGlobal('localStorage', {
      getItem: () => 'secret-key',
      setItem: () => {},
      removeItem: () => {},
    });

    const demos = await getFeaturedDemos();
    expect(demos).toHaveLength(1);
    expect(demos[0]?.run_id).toBe('demo-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('getDemoRun does not include X-API-Key header', async () => {
    const mockFetch = stubFetch({ run_id: 'demo-1', status: 'succeeded' });

    vi.stubGlobal('localStorage', {
      getItem: () => 'secret-key',
      setItem: () => {},
      removeItem: () => {},
    });

    const run = await getDemoRun('demo-1');
    expect(run.run_id).toBe('demo-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('getRun includes X-API-Key header when key is available', async () => {
    const mockFetch = stubFetch({ run_id: 'run-1', status: 'succeeded' });

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === 'citylens_api_key' ? 'secret-key' : null),
      setItem: () => {},
      removeItem: () => {},
    });

    await getRun('run-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('X-API-Key')).toBe('secret-key');
  });
});

describe('error handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws ApiError with status on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Run not found' }),
        text: async () => '',
      } as Response),
    );

    await expect(getFeaturedDemos()).rejects.toThrow(ApiError);
    try {
      await getFeaturedDemos();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
    }
  });

  it('throws ApiError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(getDemoRun('demo-1')).rejects.toThrow(ApiError);
    try {
      await getDemoRun('demo-1');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toContain('Network error');
    }
  });
});
