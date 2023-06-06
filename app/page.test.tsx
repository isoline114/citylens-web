import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeParcelData } from '@/lib/api.server';
import type { ParcelIntelRow } from '@/lib/api';
const mocks = vi.hoisted(() => ({ fetchFeaturedDemosOnServer: vi.fn(), fetchHomeParcelDataOnServer: vi.fn(), fetchHomeRunSummaryOnServer: vi.fn(), getFeaturedDemos: vi.fn() }));
vi.mock('@/lib/api.server', () => mocks);
vi.mock('@/lib/api', async () => ({ ...await vi.importActual('@/lib/api'), getFeaturedDemos: mocks.getFeaturedDemos }));
import HomePage from './page';
const top = { bbl: '4000010001', address: '10 TEST STREET', borough: 'QN', citywide_rank: 1, land_use: '11', lot_area_sqft: 2000, zoning_district_1: 'R4', allowed_far: 1, unused_floor_area_sqft: 2000, property_facts_as_of: '2026-10-05', parcel_geometry: { type: 'Polygon', coordinates: [[[-73.89, 40.72], [-73.8899, 40.72], [-73.8899, 40.7201], [-73.89, 40.72]]] }, lat: 40.72005, lng: -73.88995, owner_name: 'PRIVATE OWNER MUST NOT RENDER' } as unknown as ParcelIntelRow;
const parcel: HomeParcelData = {
  index: { boroughs: [], generated_at: '2026-10-05T00:00:00Z', model_metadata: {}, quality_gate: { citywide_acquisition_eligible_count: 5000 }, data_sources: { property_facts: { source: 'NYC PLUTO', retrieved_at: '2026-10-05', max_age_days: 45, stale: false }, project_activity: { source: 'NYC DOB', retrieved_at: '2020-01-01', max_age_days: 8, stale: true } } },
  inventory: { rows: [], returned_count: 125, available_count: 5000, access_scope: 'public_preview', generated_at: null, inventory_complete: false, requested_top_per_borough: 1000 }, lots: [top],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchFeaturedDemosOnServer.mockResolvedValue([]);
  mocks.fetchHomeParcelDataOnServer.mockResolvedValue({ index: null, inventory: null, lots: [] });
  mocks.fetchHomeRunSummaryOnServer.mockResolvedValue(null);
  mocks.getFeaturedDemos.mockResolvedValue([]);
});
describe('HomePage', () => {
  it('keeps the lede and safe public actions when every source is unavailable', async () => {
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1, name: 'Every tax lot in New York City, ranked for redevelopment.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the parcel map' })).toHaveAttribute('href', '/parcel-intel');
    expect(screen.queryByTestId('home-case-file')).not.toBeInTheDocument();
    expect(screen.getByText(/Live inventory counts are temporarily unavailable/)).toBeVisible();
    expect(screen.getByText(/public source receipt is temporarily unavailable/)).toBeVisible();
    expect(screen.getByText(/Featured demos are temporarily unavailable/)).toBeVisible();
    expect(screen.queryAllByRole('link').filter(link => link.getAttribute('href')?.includes('?demo=1'))).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Create site evidence' })).not.toBeInTheDocument();
  });
  it('uses live counts, source dates and the current public number one without owner fields', async () => {
    mocks.fetchHomeParcelDataOnServer.mockResolvedValue(parcel);
    render(await HomePage());
    expect(screen.getByText('Public preview: 125 of 5,000 ranked parcels, no account needed.')).toBeVisible();
    const site = within(screen.getByTestId('home-case-file'));
    expect(site.getByRole('heading', { name: '10 Test Street, Queens' })).toBeVisible();
    expect(site.getByText(/Rank 1 of 5,000 · one tax lot/)).toBeVisible();
    expect(site.getByRole('link', { name: 'Open this site in the workspace' })).toHaveAttribute('href', '/parcel-intel?bbl=4000010001');
    expect(site.getByRole('img', { name: /2024 aerial survey/ }).getAttribute('src')).toContain('bboxSR=3857');
    expect(screen.getByRole('table', { name: 'Public source freshness receipt' })).toHaveTextContent('Past limit');
    expect(screen.getByText(/Past freshness limit: NYC DOB/)).toHaveClass('text-stale');
    expect(screen.queryByText(/PRIVATE OWNER/)).not.toBeInTheDocument();
  });
  it('uses the featured preview and model summary counts without a baseline slider', async () => {
    mocks.fetchFeaturedDemosOnServer.mockResolvedValue([{ run_id: 'live-demo', label: 'Current evidence', address: '10 TEST STREET', baseline_year: 2017, imagery_year: 2024, outputs: ['previews'] }]);
    mocks.fetchHomeRunSummaryOnServer.mockResolvedValue({ qa: { change_counts: { added: 0, demolished: 1, modified: 3, unchanged: 20 } } });
    render(await HomePage());
    expect(mocks.fetchHomeRunSummaryOnServer).toHaveBeenCalledWith('live-demo');
    expect(screen.getByRole('img', { name: 'Aerial change evidence for Current evidence' })).toHaveAttribute('src', '/v1/demo/artifacts/live-demo/preview.png');
    expect(screen.getByRole('list', { name: 'Model-detected change classes' })).toHaveTextContent('added0demolished1modified3unchanged20');
    expect(screen.getByRole('link', { name: 'Inspect site evidence: Current evidence' })).toHaveAttribute('href', '/runs/live-demo?demo=1');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Public evidence runs' })).toHaveTextContent('2017 → 2024');
  });
  it('does not invent an assemblage when only the top lot is public', async () => {
    mocks.fetchHomeParcelDataOnServer.mockResolvedValue(parcel);
    render(await HomePage());
    expect(screen.queryByText(/two-lot site/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Still open' })).toBeInTheDocument();
  });
});
