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
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.example.test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_CITYLENS_API_BASE;
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
});
