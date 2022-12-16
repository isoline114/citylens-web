import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  createRun,
  getDemoRun,
  getFeaturedDemos,
  getRun,
  getRuns,
  joinApiUrl,
  resolveApiUrl,
  setAuthTokenGetter,
} from '@/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setAuthTokenGetter(null);
});

describe('api client', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
  });

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

  it('uses same-origin relative URLs in production even when NEXT_PUBLIC_CITYLENS_API_BASE is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.citylens.dev';

    expect(resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toBe(
      '/v1/demo/artifacts/demo-1/preview.png',
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

describe('parseFeaturedDemosResponse', () => {
  it('passes through a top-level array', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    const out = parseFeaturedDemosResponse([{ run_id: 'a' }]);
    expect(out).toEqual([{ run_id: 'a' }]);
  });

  it('unwraps {featured: []} and {runs: []} variants', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    expect(parseFeaturedDemosResponse({ featured: [{ run_id: 'a' }] })).toEqual([{ run_id: 'a' }]);
    expect(parseFeaturedDemosResponse({ runs: [{ run_id: 'b' }] })).toEqual([{ run_id: 'b' }]);
  });

  it('flattens category-keyed objects and dedupes by id', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    const raw = {
      Featured: [{ run_id: 'a', label: 'A' }, { run_id: 'b', label: 'B' }],
      'Change Detection': [{ run_id: 'a', label: 'A-dup' }, { run_id: 'c', label: 'C' }],
    };
    const out = parseFeaturedDemosResponse(raw);
    expect(out.map((d) => d.run_id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] for unrecognized shapes (and never throws)', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    expect(parseFeaturedDemosResponse(null)).toEqual([]);
    expect(parseFeaturedDemosResponse(undefined)).toEqual([]);
    expect(parseFeaturedDemosResponse(42)).toEqual([]);
    expect(parseFeaturedDemosResponse('hello')).toEqual([]);
    expect(parseFeaturedDemosResponse({})).toEqual([]);
  });
});

describe('demo fetches do not send Authorization', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
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

  it('getFeaturedDemos does not include Authorization header', async () => {
    const mockFetch = stubFetch({
      Featured: [{ run_id: 'demo-1', label: 'Test', address: 'Addr', imagery_year: 2024, baseline_year: 2017, segmentation_backend: 'sam2', outputs: [] }],
    });

    const demos = await getFeaturedDemos();
    expect(demos).toHaveLength(1);
    expect(demos[0]?.run_id).toBe('demo-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('getDemoRun does not include Authorization header', async () => {
    const mockFetch = stubFetch({ run_id: 'demo-1', status: 'succeeded' });

    const run = await getDemoRun('demo-1');
    expect(run.run_id).toBe('demo-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
  });
});

describe('non-demo fetches attach Bearer token', () => {
  it('getRun includes Authorization: Bearer header', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ run_id: 'run-1', status: 'succeeded' }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await getRun('run-1');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-abc');
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('throws ApiError(401) when no token is available', async () => {
    setAuthTokenGetter(async () => null);
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(getRun('run-1')).rejects.toMatchObject({ status: 401 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
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
