import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    status: 'unauthenticated' as 'unauthenticated' | 'authenticated' | 'loading',
    user: null as { id: string; email: string | null } | null,
  },
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    signIn: () => undefined,
    signOut: () => undefined,
    getAccessToken: async () => null,
  }),
}));

// Keep analytics inert in tests — trackEvent must never reach the network.
vi.mock('@/lib/analytics', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    listParcelWorkflow: vi.fn(() => new Promise(() => undefined)),
    listParcelSavedSearches: vi.fn(() => new Promise(() => undefined)),
    saveParcelWorkflow: vi.fn(),
    removeParcelWorkflow: vi.fn(),
    saveParcelSearch: vi.fn(),
    removeParcelSavedSearch: vi.fn(),
  };
});

// Stub the dynamic-imported leaflet map so jsdom doesn't choke on
// window.requestAnimationFrame / Leaflet's DOM globals.
vi.mock('./parcel-intel-map', () => ({
  ParcelIntelMap: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="map-stub">map: {Array.isArray(rows) ? rows.length : 0} rows</div>
  ),
}));

import {
  hasWatchedParcelChanged,
  ParcelIntelWorkspace,
} from './parcel-intel-workspace';
import type { ParcelIntelRow, ParcelWorkflowItem } from '@/lib/api';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3000000001',
    address: 'TEST ST',
    borough: 'BK',
    score_calibrated: 0.5,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    priority_rank: 1,
    priority_tier: 'highest',
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
    opportunity_category: 'ground_up_candidate',
    property_facts_current: true,
    top_features: [],
    ...overrides,
  };
}

function workflowItem(overrides: Partial<ParcelWorkflowItem> = {}): ParcelWorkflowItem {
  return {
    bbl: '3000000001',
    borough: 'brooklyn',
    stage: 'new',
    notes: '',
    tags: [],
    assignee: null,
    watching: true,
    decision_reason: null,
    outcome: 'unknown',
    snapshot: {
      property_facts_as_of: '2026-06-01',
      zoning_district_1: 'R7A',
      land_use: '11',
      year_built: 1900,
      allowed_far: 4,
      unused_floor_area_sqft: 15000,
      owner_name: null,
      last_sale_year: null,
      latest_nb_filing_year: null,
      latest_nb_status: null,
      redev_status: 'still_vacant',
      observed_imagery_year: 2024,
    },
    saved_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('watched parcel comparisons', () => {
  it('ignores a source refresh date when parcel facts are unchanged', () => {
    expect(
      hasWatchedParcelChanged(
        workflowItem(),
        row({ property_facts_as_of: '2026-07-17', observed_imagery_year: 2024 }),
      ),
    ).toBe(false);
  });

  it('detects a decision-relevant parcel fact change', () => {
    expect(
      hasWatchedParcelChanged(
        workflowItem(),
        row({ zoning_district_1: 'R8A', observed_imagery_year: 2024 }),
      ),
    ).toBe(true);
  });
});

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

    // The prioritization explanation heading appears.
    expect(
      screen.getByRole('heading', { name: /Why CityLens prioritized it/i }),
    ).toBeInTheDocument();
    // Vacant residential reason should appear.
    expect(
      screen.getByText(/Vacant land in residential zone/i),
    ).toBeInTheDocument();
    // Recent priced sale reason.
    expect(screen.getByText(/Sold for \$5\.0M 2022/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Disposition reason/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Outcome$/i)).toBeInTheDocument();
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

  it('opportunity filter separates ground-up from overbuilt rows', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    const rows = [
      row({ bbl: '3000000001', address: 'GROUND UP', opportunity_category: 'ground_up_candidate' }),
      row({ bbl: '3000000002', address: 'OVERBUILT', opportunity_category: 'conversion_or_overbuilt' }),
    ];
    render(
      <ParcelIntelWorkspace
        rows={rows}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
    fireEvent.change(screen.getByLabelText(/Opportunity/i), {
      target: { value: 'ground_up_candidate' },
    });
    expect(screen.getByText('GROUND UP')).toBeInTheDocument();
    expect(screen.queryByText('OVERBUILT')).not.toBeInTheDocument();
  });

  it('filters to recently changed parcels', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[
          row({ bbl: '3000000001', address: 'CHANGED', recent_change: true }),
          row({ bbl: '3000000002', address: 'UNCHANGED', recent_change: false }),
        ]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Recently changed$/i }));

    expect(screen.getByText('CHANGED')).toBeInTheDocument();
    expect(screen.queryByText('UNCHANGED')).not.toBeInTheDocument();
  });

  it('conditionally shows owner and recent-change signals in parcel detail', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[
          row({
            address: 'OWNER PLACE',
            owner_name: 'OWNER PLACE HOLDINGS LLC',
            recent_change: true,
          }),
        ]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );

    fireEvent.click(screen.getByText('OWNER PLACE').closest('tr') as HTMLTableRowElement);

    expect(screen.getByText('OWNER PLACE HOLDINGS LLC')).toBeInTheDocument();
    expect(screen.getByText(/Change observed in 2017→/)).toBeInTheDocument();
  });

  it('opens a shared parcel brief from the initial BBL', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[
          row({
            bbl: '3000000042',
            address: 'SHARED BRIEF',
            opportunity_category: 'active_project',
          }),
        ]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
        initialBbl="3000000042"
      />,
    );
    expect(screen.getByRole('heading', { name: 'SHARED BRIEF' })).toBeInTheDocument();
  });

  it('disables the CSV export button when no rows match the filters', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[row({ score_calibrated: 0.2 })]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    const csvButton = screen.getByRole('button', { name: /CSV/i });
    expect(csvButton).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
    fireEvent.change(screen.getByLabelText(/Opportunity/i), {
      target: { value: 'active_project' },
    });
    expect(screen.getByRole('button', { name: /CSV/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /CSV/i })).toHaveAttribute(
      'title',
      expect.stringMatching(/nothing to export/i),
    );
  });

  it('shows the Unused FAR tile and external links in the detail panel', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[
          row({
            bbl: '3050290001', // borough 3, block 05029, lot 0001
            address: 'LINKS PLACE',
            unused_floor_area_sqft: 12345,
            lat: 40.65,
            lng: -73.96,
          }),
        ]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    fireEvent.click(screen.getByText('LINKS PLACE').closest('tr') as HTMLTableRowElement);

    // Unused FAR stat tile with thousands separator.
    expect(screen.getByText('Unused FAR (SF)')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();

    // External links parse the BBL (leading zeros stripped) and centroid.
    const acris = screen.getByRole('link', { name: /ACRIS/i });
    expect(acris).toHaveAttribute(
      'href',
      'https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=3&block=5029&lot=1',
    );
    expect(acris).toHaveAttribute('target', '_blank');
    expect(acris.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: /ZoLa/i })).toHaveAttribute(
      'href',
      'https://zola.planning.nyc.gov/l/lot/3/5029/1',
    );
    expect(screen.getByRole('link', { name: /DOB BIS/i })).toHaveAttribute(
      'href',
      'https://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?allborough=3&allblock=5029&alllot=1&go5=+GO+',
    );
    expect(screen.getByRole('link', { name: /Google Maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=40.65,-73.96',
    );
    expect(screen.getByRole('link', { name: /Street View/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=40.65,-73.96',
    );
  });

  it('omits Google links when the parcel has no centroid', () => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u1', email: 'a@b' };
    render(
      <ParcelIntelWorkspace
        rows={[row({ bbl: '3050290001', address: 'NO GEO', lat: null, lng: null })]}
        borough="brooklyn"
        boroughDisplayName="Brooklyn"
      />,
    );
    fireEvent.click(screen.getByText('NO GEO').closest('tr') as HTMLTableRowElement);
    expect(screen.getByRole('link', { name: /ACRIS/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google Maps/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Street View/i })).not.toBeInTheDocument();
  });

  describe('pagination', () => {
    const manyRows = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        row({
          bbl: String(3000000000 + i + 1),
          address: `PARCEL ${i + 1}`,
          // Descending scores so default sort keeps PARCEL 1 first.
          score_calibrated: 1 - i / (n * 2),
        }),
      );

    beforeEach(() => {
      mocks.authState.status = 'authenticated';
      mocks.authState.user = { id: 'u1', email: 'a@b' };
    });

    it('renders 100 rows per page with a working Next button', () => {
      render(
        <ParcelIntelWorkspace
          rows={manyRows(150)}
          borough="brooklyn"
          boroughDisplayName="Brooklyn"
        />,
      );
      expect(screen.getByText('PARCEL 1')).toBeInTheDocument();
      expect(screen.getByText('PARCEL 100')).toBeInTheDocument();
      expect(screen.queryByText('PARCEL 101')).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 1–100 of 150/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Next page/i }));
      expect(screen.getByText('PARCEL 101')).toBeInTheDocument();
      expect(screen.queryByText(/^PARCEL 1$/)).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 101–150 of 150/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Previous page/i }));
      expect(screen.getByText('PARCEL 1')).toBeInTheDocument();
    });

    it('"Show all" renders every row; toggling back re-paginates', () => {
      render(
        <ParcelIntelWorkspace
          rows={manyRows(150)}
          borough="brooklyn"
          boroughDisplayName="Brooklyn"
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Show all 150/i }));
      expect(screen.getByText('PARCEL 150')).toBeInTheDocument();
      expect(screen.getByText(/Showing all 150 parcels/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Show pages/i }));
      expect(screen.queryByText('PARCEL 150')).not.toBeInTheDocument();
    });

    it('hides the pagination footer at or below one page of rows', () => {
      render(
        <ParcelIntelWorkspace
          rows={manyRows(50)}
          borough="brooklyn"
          boroughDisplayName="Brooklyn"
        />,
      );
      expect(screen.queryByText(/Showing 1–/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Next page/i })).not.toBeInTheDocument();
    });

    it('resets to the first page when a filter changes', () => {
      const rows = manyRows(150);
      // Make one first-page row landmarked so the filter changes the set.
      rows[0] = { ...rows[0], is_landmark: true };
      render(
        <ParcelIntelWorkspace
          rows={rows}
          borough="brooklyn"
          boroughDisplayName="Brooklyn"
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Next page/i }));
      expect(screen.getByText(/Showing 101–150 of 150/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /Hide landmarked/i }));
      expect(screen.getByText(/Showing 1–100 of 149/)).toBeInTheDocument();
    });
  });
});
