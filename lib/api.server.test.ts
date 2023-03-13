import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchParcelIntelIndexOnServer } from './api.server';

const INDEX_RESPONSE = {
  boroughs: [],
  generated_at: null,
  model_metadata: {},
};

describe('parcel-intel server index request', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    delete process.env.CITYLENS_DISABLE_SSR_PARCEL_INTEL;
    delete process.env.CITYLENS_USE_PARCEL_INTEL_INDEX_FIXTURE;
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.example.test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_CITYLENS_API_BASE;
    delete process.env.CITYLENS_USE_PARCEL_INTEL_INDEX_FIXTURE;
  });

  it('keeps the server-rendered index anonymous and free of parcel rows', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(INDEX_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await fetchParcelIntelIndexOnServer();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/v1/parcel-intel/index',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('keeps local and CI requests anonymous when the key is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(INDEX_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await fetchParcelIntelIndexOnServer();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/v1/parcel-intel/index',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('loads the explicit server fixture without contacting production', async () => {
    process.env.CITYLENS_USE_PARCEL_INTEL_INDEX_FIXTURE = '1';

    const index = await fetchParcelIntelIndexOnServer();

    expect(index.boroughs).toHaveLength(5);
    expect(index.quality_gate?.passed).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
