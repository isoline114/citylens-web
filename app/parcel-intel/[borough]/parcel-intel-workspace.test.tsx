import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    status: 'unauthenticated' as 'unauthenticated' | 'authenticated' | 'loading',
    user: null as { id: string; email: string | null } | null,
  },
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    signIn: () => undefined,
    signOut: () => undefined,
    getAccessToken: async () => null,
  }),
}));

// Stub the dynamic-imported leaflet map so jsdom doesn't choke on
// window.requestAnimationFrame / Leaflet's DOM globals.
vi.mock('./parcel-intel-map', () => ({
  ParcelIntelMap: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="map-stub">map: {Array.isArray(rows) ? rows.length : 0} rows</div>
  ),
}));

import { ParcelIntelWorkspace } from './parcel-intel-workspace';
import type { ParcelIntelRow } from '@/lib/api';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3000000001',
    address: 'TEST ST',
    borough: 'BK',
    score_calibrated: 0.5,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    lot_area_sqft: 5000,
    allowed_far: 4,
    max_floor_area_sqft: 20000,
    unused_floor_area_sqft: 15000,
    far_utilization_pct: 25,
    zoning_district_1: 'R7A',
    land_use: '11',
    year_built: 1900,
    num_floors: 0,
    lat: 40.7,
    lng: -73.9,
    last_sale_price: null,
    last_sale_year: null,
    years_held: null,
    has_recent_sale_5yr: false,
    is_landmark: false,
    is_historic_district: false,
    block_id: '300000',
    block_rank: 1,
    ...overrides,
  };
}

describe('ParcelIntelWorkspace', () => {
  beforeEach(() => {
    mocks.authState.status = 'unauthenticated';
    mocks.authState.user = null;
  });

  it('renders sign-in gate when unauthenticated', () => {
    render(
      <ParcelIntelWorkspace
        rows={[row({})]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    expect(
      screen.getByRole('heading', { name: /Sign in to view Brooklyn parcel intelligence/i }),
    ).toBeInTheDocument();
    // CTA links carry the deep-return path so post-sign-in lands on the right page.
    const signIn = screen.getByRole('link', { name: /^Sign in$/i });
    expect(signIn.getAttribute('href')).toContain('next=%2Fparcel-intel%2Fbrooklyn');
    // The actual workspace (map / list) must NOT render.
    expect(screen.queryByTestId('map-stub')).not.toBeInTheDocument();
  });

  it('renders sign-in gate while auth is still loading', () => {
    mocks.authState.status = 'loading';
    render(
      <ParcelIntelWorkspace
        rows={[row({})]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    expect(
      screen.getByRole('heading', { name: /Sign in to view/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('map-stub')).not.toBeInTheDocument();
  });

  it('renders the list when authenticated', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[
          row({ bbl: '3000000001', address: 'A', score_calibrated: 0.99 }),
          row({ bbl: '3000000002', address: 'B', score_calibrated: 0.5 }),
        ]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    expect(screen.queryByText(/Sign in to view/i)).not.toBeInTheDocument();
    // List shows both addresses (map is dynamic-imported and not asserted
    // here — its own behavior is tested at the component level).
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('opens the parcel detail panel on row click', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({
        bbl: '3000000001',
        address: 'PURDY PLACE',
        score_calibrated: 0.99,
        last_sale_price: 5_000_000,
        last_sale_year: 2022,
        years_held: 4,
        has_recent_sale_5yr: true,
        land_use: '11',
        zoning_district_1: 'R6B',
      }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    // Empty state visible before any row is selected.
    expect(
      screen.getByText(/Click a row or a map marker/i),
    ).toBeInTheDocument();

    // Clicking the row opens the detail panel with the explanation list.
    const tableRow = screen.getByText('PURDY PLACE').closest('tr');
    expect(tableRow).not.toBeNull();
    fireEvent.click(tableRow as HTMLTableRowElement);

    // The "Why it scored high" heading appears (uppercase tracking).
    expect(
      screen.getByRole('heading', { name: /Why it scored high/i }),
    ).toBeInTheDocument();
    // Vacant residential reason should appear.
    expect(
      screen.getByText(/Vacant land in residential zone/i),
    ).toBeInTheDocument();
    // Recent priced sale reason.
    expect(screen.getByText(/Sold for \$5\.0M 2022/)).toBeInTheDocument();
  });

  it('hides landmarked rows when checkbox toggled', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({ bbl: '3000000001', address: 'KEEP' }),
      row({ bbl: '3000000002', address: 'HIDE', is_landmark: true }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    expect(screen.getByText('KEEP')).toBeInTheDocument();
    expect(screen.getByText('HIDE')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Hide landmarked/i }));
    expect(screen.getByText('KEEP')).toBeInTheDocument();
    expect(screen.queryByText('HIDE')).not.toBeInTheDocument();
  });
});
