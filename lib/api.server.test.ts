import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchParcelIntelIndexOnServer,
  fetchParcelIntelSweepOnServer,
} from './api.server';

const INDEX_RESPONSE = {
  boroughs: [],
  generated_at: null,
  model_metadata: {},
};

const SWEEP_RESPONSE = {
  borough: 'brooklyn',
  rows: [],
  generated_at: null,
  model_metadata: {},
};

describe('parcel-intel server API authentication', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    delete process.env.CITYLENS_DISABLE_SSR_PARCEL_INTEL;
    delete process.env.CITYLENS_SERVER_API_KEY;
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.example.test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CITYLENS_SERVER_API_KEY;
    delete process.env.NEXT_PUBLIC_CITYLENS_API_BASE;
  });

  it('sends the configured server API key on index and sweep requests', async () => {
    process.env.CITYLENS_SERVER_API_KEY = '  clk_live_server  ';
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(INDEX_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SWEEP_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await fetchParcelIntelIndexOnServer();
    await fetchParcelIntelSweepOnServer('brooklyn', 1000);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/v1/parcel-intel/index',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer clk_live_server',
        },
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/v1/parcel-intel/sweep?borough=brooklyn&top=1000',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer clk_live_server',
        },
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
