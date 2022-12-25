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
    redev_status: 'still_vacant',
    top_features: [],
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

  it('renders model attribution section when top_features are present', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({
        bbl: '3000000001',
        address: 'PURDY PLACE',
        score_calibrated: 0.99,
        top_features: [
          {
            name: 'lot_area',
            value: 5000,
            contribution_logit: 0.85,
            contribution_pct: 0.31,
          },
          {
            name: 'zoning_district',
            value: 'R7A',
            contribution_logit: -0.42,
            contribution_pct: 0.15,
          },
          {
            name: 'is_landmark',
            value: false,
            contribution_logit: 0.18,
            contribution_pct: 0.07,
          },
        ],
      }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    fireEvent.click(screen.getByText('PURDY PLACE').closest('tr') as HTMLTableRowElement);

    // Disclosure button is present and currently collapsed.
    const heading = screen.getByRole('heading', { name: /Model attribution/i });
    expect(heading).toBeInTheDocument();
    const button = heading.closest('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');

    // Click to expand. All three friendly labels should now be visible.
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    // Use within() over the disclosure region so we don't accidentally
    // match the rule-based section's text.
    const list = button.parentElement?.querySelector('ul');
    expect(list).not.toBeNull();
    const scope = within(list as HTMLElement);
    expect(scope.getByText('Lot area')).toBeInTheDocument();
    expect(scope.getByText('Zoning')).toBeInTheDocument();
    expect(scope.getByText('LPC landmark')).toBeInTheDocument();
  });

  it('omits model attribution section when top_features is empty', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({
        bbl: '3000000001',
        address: 'EMPTY FEATS',
        score_calibrated: 0.7,
        top_features: [],
      }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    fireEvent.click(screen.getByText('EMPTY FEATS').closest('tr') as HTMLTableRowElement);
    expect(
      screen.queryByRole('heading', { name: /Model attribution/i }),
    ).not.toBeInTheDocument();
  });

  it('hides landmarked rows when filter toggled', () => {
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

    // Filters live inside a collapsible disclosure now. Open it first,
    // then click the "Hide landmarked" checkbox.
    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Hide landmarked/i }));
    expect(screen.getByText('KEEP')).toBeInTheDocument();
    expect(screen.queryByText('HIDE')).not.toBeInTheDocument();
  });

  it('zoning family pills filter the list', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({ bbl: '3000000001', address: 'RES', zoning_district_1: 'R6B' }),
      row({ bbl: '3000000002', address: 'COMM', zoning_district_1: 'C2-4' }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
    // All four families on by default → both rows visible.
    expect(screen.getByText('RES')).toBeInTheDocument();
    expect(screen.getByText('COMM')).toBeInTheDocument();
    // Toggle commercial off (R/M/Other remain on) — COMM should hide.
    fireEvent.click(screen.getByRole('button', { name: 'C', pressed: true }));
    expect(screen.getByText('RES')).toBeInTheDocument();
    expect(screen.queryByText('COMM')).not.toBeInTheDocument();
  });

  it('min-score range slider filters out low-score rows', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({ bbl: '3000000001', address: 'HIGH', score_calibrated: 0.95 }),
      row({ bbl: '3000000002', address: 'LOW', score_calibrated: 0.4 }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
    const slider = screen.getByLabelText(/Min score/i);
    fireEvent.change(slider, { target: { value: '50' } });
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.queryByText('LOW')).not.toBeInTheDocument();
  });
});
