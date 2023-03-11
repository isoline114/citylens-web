import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as 'loading' | 'unauthenticated' | 'authenticated',
  getParcelIntelMap: vi.fn(),
  getParcelIntelParcel: vi.fn(),
  getParcelIntelSweep: vi.fn(),
  getParcelWorkflowActions: vi.fn(),
  recordParcelProductEvent: vi.fn(),
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
    recordParcelProductEvent: mocks.recordParcelProductEvent,
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
  mocks.getParcelIntelMap.mockReset();
  mocks.getParcelIntelParcel.mockReset();
  mocks.getParcelIntelSweep.mockReset();
  mocks.getParcelWorkflowActions.mockReset();
  mocks.recordParcelProductEvent.mockReset();
  mocks.recordParcelProductEvent.mockResolvedValue(undefined);
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
});

describe('ParcelIntelExplorer', () => {
  it('loads an anonymous citywide preview without requesting authenticated data', async () => {
    render(<ParcelIntelExplorer boroughs={boroughs} />);

    expect(screen.getByText(/Preview coverage/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in for the full map/i })).toBeInTheDocument();
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
    expect(
      screen.getByRole('option', { name: /Immediate-hazard violations/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /1% floodplain exposure/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /MIH mapped-area overlap/i }),
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
    expect(guide).toHaveTextContent('Review the parcel evidence');
    expect(guide).toHaveTextContent('Save the lead');
    expect(guide).toHaveTextContent('Assign a teammate and dated next action');

    fireEvent.click(
      screen.getByRole('button', { name: 'Open highest-ranked lead' }),
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
});
