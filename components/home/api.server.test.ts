import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHomeParcelDataOnServer, fetchHomeRunSummaryOnServer } from '@/lib/api.server';
const publicFetch = vi.fn();
const index = { boroughs: [], generated_at: null, model_metadata: {} };
const top = { bbl: '4000010001', address: '10 TEST STREET', citywide_rank: 1, assemblage_member_bbls: [] as string[] };
const inventory = { access_scope: 'public_preview', rows: [top], returned_count: 125, available_count: 5000 };
beforeEach(() => {
  vi.stubGlobal('fetch', publicFetch); vi.stubEnv('CITYLENS_DISABLE_SSR_PARCEL_INTEL', '');
  vi.stubEnv('CITYLENS_USE_PARCEL_INTEL_INDEX_FIXTURE', ''); vi.stubEnv('CITYLENS_DISABLE_SSR_DEMOS', '');
  publicFetch.mockReset();
  publicFetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/index') ? index : url.includes('/map?') ? inventory : top }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('public homepage server loaders', () => {
  it('honors both SSR disable flags without network calls, including when the index fixture is enabled', async () => {
    vi.stubEnv('CITYLENS_DISABLE_SSR_PARCEL_INTEL', '1'); vi.stubEnv('CITYLENS_USE_PARCEL_INTEL_INDEX_FIXTURE', '1'); vi.stubEnv('CITYLENS_DISABLE_SSR_DEMOS', '1');
    expect(await fetchHomeParcelDataOnServer()).toEqual({ index: null, inventory: null, lots: [] });
    expect(await fetchHomeRunSummaryOnServer('demo')).toBeNull(); expect(publicFetch).not.toHaveBeenCalled();
  });
  it('keeps fixture-mode renders off the live inventory endpoints', async () => {
    vi.stubEnv('CITYLENS_USE_PARCEL_INTEL_INDEX_FIXTURE', '1');
    const data = await fetchHomeParcelDataOnServer();
    expect(data.inventory).toBeNull(); expect(data.lots).toEqual([]);
    expect(publicFetch.mock.calls.some(([url]) => /\/v1\/parcel-intel\/(map|parcel)/.test(String(url)))).toBe(false);
  });
  it('loads the citywide number one and only explicitly listed partners without credentials', async () => {
    const partner = { ...top, bbl: '4000010002', citywide_rank: 2 };
    publicFetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/index') ? index : url.includes('/map?') ? inventory : url.endsWith(partner.bbl) ? partner : { ...top, assemblage_member_bbls: [top.bbl, partner.bbl] } }));
    const data = await fetchHomeParcelDataOnServer();
    expect(data.lots.map(lot => lot.bbl)).toEqual([top.bbl, partner.bbl]);
    expect(publicFetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/v1/parcel-intel/index', '/v1/parcel-intel/map', `/v1/parcel-intel/parcel/${top.bbl}`, `/v1/parcel-intel/parcel/${partner.bbl}`]);
    for (const [, options] of publicFetch.mock.calls) { expect(options.headers).toEqual({ Accept: 'application/json' }); expect(options.signal).toBeInstanceOf(AbortSignal); }
  });
  it('does not substitute a borough rank or a partial assemblage for a citywide site', async () => {
    publicFetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/index') ? index : { ...inventory, rows: [{ ...top, citywide_rank: 8, priority_rank: 1 }] } }));
    expect((await fetchHomeParcelDataOnServer()).lots).toEqual([]);
    expect(publicFetch).toHaveBeenCalledTimes(2);
  });
  it('degrades failed network calls and summaries without fabricated records', async () => {
    publicFetch.mockRejectedValue(new Error('offline'));
    const data = await fetchHomeParcelDataOnServer();
    expect(data.inventory).toBeNull(); expect(data.lots).toEqual([]);
    expect(await fetchHomeRunSummaryOnServer('current run')).toBeNull();
    expect(publicFetch.mock.calls.at(-1)?.[0]).toContain('/current%20run/run_summary.json');
  });
  it('omits the case if an assemblage partner cannot be loaded', async () => {
    publicFetch.mockImplementation(async (url: string) => ({ ok: !url.endsWith('4000010002'), json: async () => url.endsWith('/index') ? index : url.includes('/map?') ? inventory : { ...top, assemblage_member_bbls: ['4000010002'] } }));
    expect((await fetchHomeParcelDataOnServer()).lots).toEqual([]);
  });
});
