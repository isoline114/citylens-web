import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as 'loading' | 'unauthenticated' | 'authenticated',
  getParcelIntelMap: vi.fn(),
  getParcelIntelParcel: vi.fn(),
  getParcelIntelSweep: vi.fn(),
  getParcelWorkflowActions: vi.fn(),
  listParcelSavedSearches: vi.fn(),
  saveParcelSearch: vi.fn(),
  removeParcelSavedSearch: vi.fn(),
  recordParcelProductEvent: vi.fn(),
  advanceParcelWorkflow: vi.fn(),
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
  return {
    ...actual,
    getParcelIntelMap: mocks.getParcelIntelMap,
    getParcelIntelParcel: mocks.getParcelIntelParcel,
    getParcelIntelSweep: mocks.getParcelIntelSweep,
    getParcelWorkflowActions: mocks.getParcelWorkflowActions,
    listParcelSavedSearches: mocks.listParcelSavedSearches,
    saveParcelSearch: mocks.saveParcelSearch,
    removeParcelSavedSearch: mocks.removeParcelSavedSearch,
    recordParcelProductEvent: mocks.recordParcelProductEvent,
    advanceParcelWorkflow: mocks.advanceParcelWorkflow,
  };
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
  ParcelIntelPropertyPanel: ({
    row,
    onClose,
    isCompared,
    onToggleCompare,
  }: {
    row: ParcelIntelRow;
    onClose: () => void;
    isCompared?: boolean;
    onToggleCompare?: () => void;
  }) => (
    <div data-testid="property-panel-stub">
      {row.borough}:{row.bbl}
      <button type="button" onClick={onClose}>
        Back to ranking
      </button>
      <button
        type="button"
        aria-pressed={isCompared}
        onClick={onToggleCompare}
      >
        {isCompared ? 'Compared' : 'Compare'}
      </button>
    </div>
  ),
}));

import { ParcelIntelExplorer } from './parcel-intel-explorer';

function row(
  bbl: string,
  borough: string,
  overrides: Partial<ParcelIntelRow> = {},
): ParcelIntelRow {
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
    ...overrides,
  };
}

const boroughs = [
  { slug: 'manhattan', display_name: 'Manhattan', count: 1000, top_score: 1 },
  { slug: 'brooklyn', display_name: 'Brooklyn', count: 1000, top_score: 1 },
];

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
  mocks.getParcelIntelMap.mockReset();
  mocks.getParcelIntelParcel.mockReset();
  mocks.getParcelIntelSweep.mockReset();
  mocks.getParcelWorkflowActions.mockReset();
  mocks.listParcelSavedSearches.mockReset();
  mocks.saveParcelSearch.mockReset();
  mocks.removeParcelSavedSearch.mockReset();
  mocks.recordParcelProductEvent.mockReset();
  mocks.recordParcelProductEvent.mockResolvedValue(undefined);
  mocks.advanceParcelWorkflow.mockReset();
  mocks.advanceParcelWorkflow.mockResolvedValue({
    status: 'created',
    item: {},
  });
  mocks.routerReplace.mockReset();
  mocks.getParcelIntelMap.mockImplementation(
    async () => ({
      rows: [
        row('1000010001', 'manhattan'),
        row('3000010001', 'brooklyn'),
      ],
      generated_at: '2026-07-19T00:00:00Z',
    }),
  );
  mocks.getParcelIntelParcel.mockImplementation(async (bbl: string) =>
    row(bbl, bbl.startsWith('1') ? 'MN' : 'BK'),
  );
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
  mocks.getParcelWorkflowActions.mockResolvedValue({
    schema_version: 'citylens/parcel-workflow-actions@v1',
    generated_at: '2026-07-23T14:00:00Z',
    total_records: 2,
    open_records: 2,
    completed_records: 0,
    overdue_count: 1,
    due_today_count: 1,
    due_soon_count: 0,
    scheduled_count: 0,
    unscheduled_count: 0,
    unassigned_count: 0,
    outcome_update_due_count: 0,
    attention_count: 2,
    snoozed_count: 0,
    complete_plan_count: 1,
    plan_coverage_rate: 0.5,
    assigned_count: 2,
    assignee_coverage_rate: 1,
    outcome_current_count: 1,
    outcome_current_rate: 0.5,
    items: [],
  });
  mocks.listParcelSavedSearches.mockResolvedValue([]);
  mocks.saveParcelSearch.mockImplementation(async (searchId, item) => ({
    schema_version: 'citylens/parcel-saved-view@v2',
    search_id: searchId,
    ...item,
    created_at: '2026-07-24T12:00:00Z',
    updated_at: '2026-07-24T12:00:00Z',
  }));
  mocks.removeParcelSavedSearch.mockResolvedValue(undefined);
});

describe('ParcelIntelExplorer', () => {
  it('loads an anonymous citywide preview without requesting authenticated data', async () => {
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    expect(screen.getByText(/Preview coverage/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Sign in for the full workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Try the public decision flow/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Immediate-hazard violations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /1% floodplain exposure/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /MIH mapped-area overlap/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent('2 mapped rows'));
    expect(screen.getByTestId('citywide-map-stub')).toHaveAttribute(
      'data-overlay',
      'borough',
    );
    expect(mocks.getParcelIntelMap).toHaveBeenCalledWith(1000, {
      includeAuth: false,
    });
    expect(mocks.getParcelIntelSweep).not.toHaveBeenCalled();
    expect(mocks.getParcelWorkflowActions).not.toHaveBeenCalled();
  });

  it('does not hold the public map behind auth initialization', async () => {
    mocks.authStatus = 'loading';

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    await waitFor(() =>
      expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent(
        '2 mapped rows',
      ),
    );
    expect(mocks.getParcelIntelMap).toHaveBeenCalledWith(1000, {
      includeAuth: false,
    });
  });

  it('keeps the mobile ranking compact until the user expands it', async () => {
    const rankedRows = Array.from({ length: 12 }, (_, index) => ({
      ...row(`100001${String(index + 1).padStart(4, '0')}`, 'manhattan'),
      address: `${index + 1} TEST AVENUE`,
      citywide_rank: index + 1,
      priority_rank: index + 1,
    }));
    mocks.getParcelIntelMap.mockResolvedValue({
      rows: rankedRows,
      generated_at: '2026-07-24T00:00:00Z',
    });

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    const eleventhLead = await screen.findByRole('button', {
      name: /11 TEST AVENUE/i,
    });
    expect(eleventhLead).toHaveClass('hidden', 'sm:block');

    const expand = screen.getByRole('button', {
      name: /Show more ranked leads · 2 remaining/i,
    });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(expand).toHaveAttribute(
      'aria-controls',
      'parcel-acquisition-ranking',
    );

    fireEvent.click(expand);

    expect(eleventhLead).not.toHaveClass('hidden');
    expect(
      screen.getByRole('button', { name: /Show fewer ranked leads/i }),
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(screen.getByLabelText('Filter by borough'), {
      target: { value: 'manhattan' },
    });

    expect(eleventhLead).toHaveClass('hidden', 'sm:block');
    expect(
      screen.getByRole('button', { name: /Show more ranked leads/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('requests the full authenticated overlay for signed-in users', async () => {
    mocks.authStatus = 'authenticated';
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    expect(screen.getByText(/Full workspace coverage/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Signals$/i }));
    const signalPanel = document.getElementById('parcel-signal-filters');
    expect(signalPanel).not.toBeNull();
    expect(
      within(signalPanel as HTMLElement).getByRole('button', {
        name: /Immediate-hazard violations/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(signalPanel as HTMLElement).getByRole('button', {
        name: /1% floodplain exposure/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(signalPanel as HTMLElement).getByRole('button', {
        name: /MIH mapped area/i,
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent('2 mapped rows'));
    expect(mocks.getParcelIntelMap).toHaveBeenCalledWith(1000, {
      includeAuth: true,
    });
    expect(mocks.getParcelIntelSweep).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.getParcelWorkflowActions).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByLabelText('2 workflow items need attention'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('activation-guide-attention')).toHaveTextContent(
      '2 saved leads',
    );
  });

  it('applies an evidence recipe and explains the resulting intersection', async () => {
    mocks.authStatus = 'authenticated';
    mocks.getParcelIntelMap.mockResolvedValue({
      rows: [
        row('3000010001', 'brooklyn', {
          nearest_transit_station_distance_m: 500,
          years_held: 18,
          priority_tier: 'high',
          unused_floor_area_sqft: 12_000,
        }),
        row('3000010002', 'brooklyn', {
          nearest_transit_station_distance_m: 500,
          years_held: 4,
          priority_tier: 'high',
        }),
        row('4000010001', 'queens', {
          nearest_transit_station_distance_m: 900,
          years_held: 20,
          priority_tier: 'high',
        }),
      ],
      generated_at: '2026-07-26T00:00:00Z',
    });

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    fireEvent.click(await screen.findByRole('button', { name: /^Signals$/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Long-held transit screen/i }),
    );

    expect(
      screen.getByRole('button', { name: /Long-held transit screen/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /Transit within 800 m/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /Held 10\+ years/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent(
        '1 mapped rows',
      ),
    );
    expect(screen.getByTestId('screen-intelligence')).toHaveTextContent(
      '1 of 3',
    );
    expect(screen.getByTestId('screen-intelligence')).toHaveTextContent(
      '12k sf',
    );
    expect(screen.getByTestId('screen-intelligence')).toHaveTextContent(
      /does not change rank or predict a transaction/i,
    );
  });

  it('guides a first-time signed-in user directly into the highest-ranked lead', async () => {
    mocks.authStatus = 'authenticated';
    mocks.getParcelWorkflowActions.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-actions@v1',
      generated_at: '2026-07-24T14:00:00Z',
      total_records: 0,
      open_records: 0,
      completed_records: 0,
      overdue_count: 0,
      due_today_count: 0,
      due_soon_count: 0,
      scheduled_count: 0,
      unscheduled_count: 0,
      unassigned_count: 0,
      outcome_update_due_count: 0,
      attention_count: 0,
      snoozed_count: 0,
      complete_plan_count: 0,
      plan_coverage_rate: null,
      assigned_count: 0,
      assignee_coverage_rate: null,
      outcome_current_count: 0,
      outcome_current_rate: null,
      items: [],
    });

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    const guide = await screen.findByTestId('activation-guide-empty');
    expect(guide).toHaveTextContent('Open a current lead');
    expect(guide).toHaveTextContent('Add a second parcel to Compare');
    expect(guide).toHaveTextContent(
      'Save only the one worth next diligence',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open the first lead' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('property-panel-stub')).toHaveTextContent(
        'manhattan:1000010001',
      ),
    );
    expect(mocks.routerReplace).toHaveBeenLastCalledWith(
      '/parcel-intel?bbl=1000010001',
      { scroll: false },
    );
  });

  it('restores the full explorer state from a private saved view', async () => {
    mocks.authStatus = 'authenticated';
    mocks.recordParcelProductEvent.mockRejectedValueOnce(
      new Error('telemetry unavailable'),
    );
    mocks.listParcelSavedSearches.mockResolvedValue([
      {
        schema_version: 'citylens/parcel-saved-view@v2',
        search_id: 'view-brooklyn',
        name: 'Brooklyn priority',
        borough: 'brooklyn',
        filters: {
          query: 'test site',
          priority: 'highest',
          opportunity: 'vacant_site',
          owner_portfolio_id: null,
          overlay: 'opportunity',
        },
        alert_frequency: 'off',
        created_at: '2026-07-24T12:00:00Z',
        updated_at: '2026-07-24T12:00:00Z',
      },
    ]);

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Saved views' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Apply view' }),
    );

    expect(screen.getByLabelText('Filter by borough')).toHaveValue('brooklyn');
    expect(screen.getByLabelText('Filter by priority')).toHaveValue('highest');
    expect(screen.getByLabelText('Filter by site type')).toHaveValue(
      'vacant_site',
    );
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
        'saved_view_applied',
        'saved_views',
      ),
    );
    expect(
      JSON.stringify(mocks.recordParcelProductEvent.mock.calls),
    ).not.toMatch(/view-brooklyn|Brooklyn priority|test site|vacant_site/i);
    expect(screen.getByLabelText('Search parcels')).toHaveValue('test site');
    expect(
      screen.getByRole('button', { name: 'opportunity' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.routerReplace).toHaveBeenLastCalledWith(
      '/parcel-intel?borough=brooklyn',
      { scroll: false },
    );
    expect(screen.queryByTestId('saved-views-panel')).not.toBeInTheDocument();
  });

  it('removes private evidence filters when an authenticated session ends', async () => {
    mocks.authStatus = 'authenticated';
    const { rerender } = render(
      <ParcelIntelExplorer boroughs={boroughs} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Signals/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Final lien-sale history/i }),
    );
    expect(
      screen.getByRole('button', {
        name: /Final lien-sale history/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    mocks.authStatus = 'unauthenticated';
    rerender(<ParcelIntelExplorer boroughs={boroughs} />);

    await waitFor(() =>
      expect(
        screen.queryByText('Final lien-sale history'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Signals/i })).toHaveTextContent(
      'Signals',
    );
  });

  it('resumes an attention queue without making users rediscover the workflow menu', async () => {
    mocks.authStatus = 'authenticated';

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    await screen.findByTestId('activation-guide-attention');
    fireEvent.click(screen.getByRole('button', { name: 'Review 2 actions' }));

    expect(
      await screen.findByRole('heading', {
        name: 'What needs attention next?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('activation-guide-attention'),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Attention 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not show activation coaching when the open pipeline is current', async () => {
    mocks.authStatus = 'authenticated';
    mocks.getParcelWorkflowActions.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-actions@v1',
      generated_at: '2026-07-24T14:00:00Z',
      total_records: 2,
      open_records: 2,
      completed_records: 0,
      overdue_count: 0,
      due_today_count: 0,
      due_soon_count: 0,
      scheduled_count: 2,
      unscheduled_count: 0,
      unassigned_count: 0,
      outcome_update_due_count: 0,
      attention_count: 0,
      snoozed_count: 0,
      complete_plan_count: 2,
      plan_coverage_rate: 1,
      assigned_count: 2,
      assignee_coverage_rate: 1,
      outcome_current_count: 2,
      outcome_current_rate: 1,
      items: [],
    });

    render(<ParcelIntelExplorer boroughs={boroughs} />);

    await waitFor(() =>
      expect(mocks.getParcelWorkflowActions).toHaveBeenCalled(),
    );
    expect(screen.queryByTestId('activation-guide-empty')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('activation-guide-attention'),
    ).not.toBeInTheDocument();
  });

  it('loads full parcel detail only after opening a map summary', async () => {
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    await screen.findByText('2 mapped rows');
    fireEvent.change(screen.getByLabelText('Filter by borough'), {
      target: { value: 'brooklyn' },
    });
    expect(screen.getByTestId('citywide-map-stub')).toHaveTextContent(
      '1 mapped rows',
    );

    const brooklynLead = await screen.findByRole('button', {
      name: /brooklyn test site/i,
    });
    fireEvent.click(brooklynLead);

    await waitFor(() =>
      expect(screen.getByTestId('property-panel-stub')).toHaveTextContent(
        'brooklyn:3000010001',
      ),
    );
    expect(mocks.getParcelIntelParcel).toHaveBeenCalledWith('3000010001', {
      includeAuth: false,
    });
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

  it('records one coarse authenticated parcel open without parcel identifiers', async () => {
    mocks.authStatus = 'authenticated';
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    const brooklynLead = await screen.findByRole('button', {
      name: /brooklyn test site/i,
    });
    fireEvent.click(brooklynLead);

    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
        'parcel_opened',
        'ranking',
      ),
    );
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(mocks.recordParcelProductEvent.mock.calls),
    ).not.toMatch(/3000010001|brooklyn test site/i);

    fireEvent.click(brooklynLead);
    await waitFor(() =>
      expect(mocks.getParcelIntelParcel).toHaveBeenCalled(),
    );
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(1);
  });

  it('compares two parcels without sending their identities in telemetry', async () => {
    mocks.authStatus = 'authenticated';
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    fireEvent.click(
      await screen.findByRole('button', { name: /manhattan test site/i }),
    );
    await screen.findByTestId('property-panel-stub');
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByTestId('parcel-comparison-tray')).toHaveTextContent(
      '1/3',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to ranking' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /brooklyn test site/i }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('property-panel-stub')).toHaveTextContent(
        'brooklyn:3000010001',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

    const desk = await screen.findByTestId('parcel-comparison-desk');
    expect(desk).toHaveTextContent('MN test site');
    expect(desk).toHaveTextContent('BK test site');
    expect(desk).toHaveTextContent('Development capacity');
    expect(desk).toHaveTextContent('Evidence currency');
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
        'comparison_opened',
        'comparison',
      ),
    );
    expect(
      JSON.stringify(mocks.recordParcelProductEvent.mock.calls),
    ).not.toMatch(/1000010001|3000010001|MN test site|BK test site/i);

    fireEvent.click(
      within(desk).getByRole('button', {
        name: 'Advance MN test site from comparison',
      }),
    );
    fireEvent.change(
      within(desk).getByLabelText('Next diligence action'),
      {
        target: { value: 'Verify current title before outreach.' },
      },
    );
    fireEvent.click(
      within(desk).getByTestId('advance-comparison-parcel'),
    );
    await waitFor(() =>
      expect(mocks.advanceParcelWorkflow).toHaveBeenCalledWith(
        '1000010001',
        {
          borough: 'manhattan',
          next_action: 'Verify current title before outreach.',
          next_action_due_date: null,
        },
      ),
    );
    expect(
      JSON.stringify(mocks.advanceParcelWorkflow.mock.calls[0]?.[1]),
    ).not.toMatch(/address|owner|score|price|notes|assignee|tags/i);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('parcel-comparison-tray')).toBeInTheDocument();
  });
});
