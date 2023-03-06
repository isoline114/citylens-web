import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as 'loading' | 'unauthenticated' | 'authenticated',
  getParcelIntelSweep: vi.fn(),
  routerReplace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    status: mocks.authStatus,
    user:
      mocks.authStatus === 'authenticated'
        ? { id: 'user-1', email: 'user@example.com' }
        : null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(async () => 'token'),
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, getParcelIntelSweep: mocks.getParcelIntelSweep };
});

vi.mock('./parcel-intel-explorer-map', () => ({
  ParcelIntelExplorerMap: ({
    rows,
    overlay,
  }: {
    rows: ParcelIntelRow[];
    overlay: string;
  }) => (
    <div data-testid="citywide-map-stub" data-overlay={overlay}>
      {rows.length} mapped rows
    </div>
  ),
}));

vi.mock('./parcel-intel-property-panel', () => ({
  ParcelIntelPropertyPanel: ({ row }: { row: ParcelIntelRow }) => (
    <div data-testid="property-panel-stub">
      {row.borough}:{row.bbl}
    </div>
  ),
}));

import { ParcelIntelExplorer } from './parcel-intel-explorer';

function row(bbl: string, borough: string): ParcelIntelRow {
  return {
    bbl,
    address: `${borough} test site`,
    borough,
    score_calibrated: 0.9,
    score_calibrated_p10: 0.8,
    score_calibrated_p90: 0.95,
    priority_rank: 1,
    priority_tier: 'highest',
    lot_area_sqft: 5000,
    allowed_far: 2,
    max_floor_area_sqft: 10000,
    unused_floor_area_sqft: 5000,
    far_utilization_pct: 50,
    zoning_district_1: 'R6',
    land_use: '11',
    year_built: 0,
    num_floors: 0,
    lat: 40.7,
    lng: -73.9,
    last_sale_price: null,
    last_sale_year: null,
    years_held: null,
    has_recent_sale_5yr: false,
    is_landmark: false,
    is_historic_district: false,
    block_id: bbl.slice(0, 6),
    block_rank: 1,
    top_features: [],
    redev_status: 'still_vacant',
    opportunity_category: 'vacant_site',
  };
}

const boroughs = [
  { slug: 'manhattan', display_name: 'Manhattan', count: 1000, top_score: 1 },
  { slug: 'brooklyn', display_name: 'Brooklyn', count: 1000, top_score: 1 },
];

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
  mocks.getParcelIntelSweep.mockReset();
  mocks.routerReplace.mockReset();
  mocks.getParcelIntelSweep.mockImplementation(async (borough: string) => ({
    borough,
    rows: [
      row(
        borough === 'manhattan' ? '1000010001' : '3000010001',
        borough === 'manhattan' ? 'MN' : 'BK',
      ),
    ],
    generated_at: '2026-07-19T00:00:00Z',
    model_metadata: {},
  }));
});

describe('ParcelIntelExplorer', () => {
  it('loads an anonymous citywide preview without requesting authenticated data', async () => {
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    expect(screen.getByText(/Preview coverage/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in for the full map/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent('2 mapped rows'));
    expect(screen.getByTestId('citywide-map-stub')).toHaveAttribute(
      'data-overlay',
      'borough',
    );
    expect(mocks.getParcelIntelSweep).toHaveBeenCalledTimes(2);
    for (const call of mocks.getParcelIntelSweep.mock.calls) {
      expect(call[2]).toEqual({ includeAuth: false });
    }
  });

  it('requests the full authenticated overlay for signed-in users', async () => {
    mocks.authStatus = 'authenticated';
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    expect(screen.getByText(/Full workspace coverage/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent('2 mapped rows'));
    for (const call of mocks.getParcelIntelSweep.mock.calls) {
      expect(call[2]).toEqual({ includeAuth: true });
    }
  });

  it('normalizes API borough codes before opening the unified property panel', async () => {
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    await screen.findByText('2 mapped rows');
    fireEvent.change(screen.getByLabelText('Filter by borough'), {
      target: { value: 'brooklyn' },
    });
    expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent(
      '1 mapped rows',
    );

    const brooklynLead = await screen.findByRole('button', {
      name: /BK test site/i,
    });
    fireEvent.click(brooklynLead);

    expect(screen.getByTestId('property-panel-stub')).toHaveTextContent(
      'brooklyn:3000010001',
    );
    expect(mocks.routerReplace).toHaveBeenLastCalledWith(
      '/parcel-intel?borough=brooklyn&bbl=3000010001',
      { scroll: false },
    );

    fireEvent.click(screen.getByRole('button', { name: /All NYC/i }));
    expect(screen.queryByTestId('property-panel-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent(
      '2 mapped rows',
    );
    expect(mocks.routerReplace).toHaveBeenLastCalledWith('/parcel-intel', {
      scroll: false,
    });
  });
});
