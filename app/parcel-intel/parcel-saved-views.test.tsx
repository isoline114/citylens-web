import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listParcelSavedSearches: vi.fn(),
  saveParcelSearch: vi.fn(),
  removeParcelSavedSearch: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    listParcelSavedSearches: mocks.listParcelSavedSearches,
    saveParcelSearch: mocks.saveParcelSearch,
    removeParcelSavedSearch: mocks.removeParcelSavedSearch,
  };
});

import { ApiError } from '@/lib/api';
import { ParcelSavedViewsPanel } from './parcel-saved-views';
import type {
  ExplorerFilters,
  ParcelExplorerRow,
} from './parcel-intel-explorer-support';

const savedView = {
  schema_version: 'citylens/parcel-saved-view@v2' as const,
  search_id: 'view-one',
  name: 'Brooklyn candidates',
  borough: 'brooklyn' as const,
  filters: {
    query: 'llc',
    priority: 'highest' as const,
    opportunity: 'vacant_site' as const,
    owner_portfolio_id: null,
    overlay: 'opportunity' as const,
  },
  alert_frequency: 'off' as const,
  created_at: '2026-07-24T12:00:00Z',
  updated_at: '2026-07-24T12:00:00Z',
};

const currentView = {
  borough: 'all',
  filters: {
    borough: 'all',
    priority: 'high_or_better' as const,
    siteType: 'uncommitted' as const,
    signals: ['long_held', 'transit_800m'],
    minLotAreaSqft: 5_000,
    minUnusedFloorAreaSqft: 10_000,
    query: '  owner llc  ',
    ownerPortfolioId: null,
  } satisfies ExplorerFilters,
  overlay: 'borough' as const,
};

const inventoryRows = [
  {
    bbl: '3000010001',
    address: '100 Brooklyn Avenue',
    borough: 'brooklyn',
    priority_tier: 'highest',
    opportunity_category: 'vacant_site',
    lot_area_sqft: 8_000,
    unused_floor_area_sqft: 12_000,
    owner_name: 'Owner LLC',
    years_held: 12,
    nearest_transit_station_distance_m: 400,
    lat: 40.66,
    lng: -73.95,
  },
  {
    bbl: '1000010001',
    address: '200 Manhattan Avenue',
    borough: 'manhattan',
    priority_tier: 'high',
    opportunity_category: 'ground_up_candidate',
    lot_area_sqft: 6_000,
    unused_floor_area_sqft: 11_000,
    owner_name: 'Owner LLC',
    years_held: 12,
    nearest_transit_station_distance_m: 500,
    lat: 40.75,
    lng: -73.99,
  },
] as ParcelExplorerRow[];

const monitorProps = {
  feedGeneration: '20260727T030301358307Z-a32b245a82db',
  feedGeneratedAt: '2026-07-27T03:03:01.358307Z',
  onSelectParcel: vi.fn(),
  onInspectExited: vi.fn(),
};

beforeEach(() => {
  monitorProps.onSelectParcel.mockReset();
  monitorProps.onInspectExited.mockReset();
  mocks.listParcelSavedSearches.mockReset();
  mocks.saveParcelSearch.mockReset();
  mocks.removeParcelSavedSearch.mockReset();
  mocks.listParcelSavedSearches.mockResolvedValue([savedView]);
  mocks.saveParcelSearch.mockImplementation(async (searchId, item) => ({
    ...savedView,
    search_id: searchId,
    ...item,
  }));
  mocks.removeParcelSavedSearch.mockResolvedValue(undefined);
});

describe('ParcelSavedViewsPanel', () => {
  it('loads and applies an existing private view', async () => {
    const onApply = vi.fn();
    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Brooklyn candidates')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close saved views' }),
    ).toHaveFocus();
    expect(screen.getByTestId('saved-views-announcer')).toHaveTextContent(
      '1 saved view loaded.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply view' }));
    expect(onApply).toHaveBeenCalledWith(savedView);
  });

  it('focuses the screen name when opened from the activation guide', async () => {
    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        initialFocus="name"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText('View name')).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Close saved views' }),
    ).not.toHaveFocus();
  });

  it('saves the complete current state without promising alerts', async () => {
    const updated = vi.fn();
    window.addEventListener('citylens:saved-views-updated', updated);
    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText('Brooklyn candidates');

    fireEvent.change(screen.getByLabelText('View name'), {
      target: { value: 'Owner search' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save current view' }),
    );

    await waitFor(() => expect(mocks.saveParcelSearch).toHaveBeenCalled());
    expect(updated).toHaveBeenCalledTimes(1);
    window.removeEventListener('citylens:saved-views-updated', updated);
    const [, payload] = mocks.saveParcelSearch.mock.calls[0];
    expect(payload).toEqual({
      name: 'Owner search',
      borough: 'all',
      filters: {
        query: 'owner llc',
        priority: 'high_or_better',
        opportunity: 'all',
        site_type: 'uncommitted',
        signals: ['long_held', 'transit_800m'],
        min_lot_area_sqft: 5_000,
        min_unused_floor_area_sqft: 10_000,
        owner_portfolio_id: null,
        overlay: 'borough',
      },
      alert_frequency: 'off',
      snapshot: {
        schema_version: 'citylens/parcel-saved-view-snapshot@v1',
        feed_generation: '20260727T030301358307Z-a32b245a82db',
        feed_generated_at: '2026-07-27T03:03:01.358307Z',
        match_count: 2,
        matched_bbls: ['1000010001', '3000010001'],
      },
    });
    expect(
      screen.getByText(/notifications are not sent yet/i),
    ).toBeInTheDocument();
  });

  it('shows exact entered and exited parcels across feed generations', async () => {
    const onSelectParcel = vi.fn();
    const onInspectExited = vi.fn();
    const onChangesOpened = vi.fn();
    mocks.listParcelSavedSearches.mockResolvedValueOnce([
      {
        ...savedView,
        schema_version: 'citylens/parcel-saved-view@v3',
        snapshot: {
          schema_version: 'citylens/parcel-saved-view-snapshot@v1',
          feed_generation: '20260701T000000000000Z-aaaaaaaaaaaa',
          feed_generated_at: '2026-07-01T00:00:00Z',
          match_count: 1,
          matched_bbls: ['3000019999'],
        },
      },
    ]);

    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        onSelectParcel={onSelectParcel}
        onInspectExited={onInspectExited}
        onChangesOpened={onChangesOpened}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: /1 entered · 1 left/i,
      }),
    );
    expect(onChangesOpened).toHaveBeenCalledWith('view-one');
    expect(onChangesOpened).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: /100 Brooklyn Avenue.*3000010001/i,
      }),
    );
    expect(onSelectParcel).toHaveBeenCalledWith('3000010001');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'BBL 3000019999 · inspect current screening',
      }),
    );
    expect(onInspectExited).toHaveBeenCalledWith('3000019999');
    expect(
      screen.getByText(
        /exact membership change—not seller intent or a new prediction/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Mark current set reviewed' }),
    );
    await waitFor(() =>
      expect(mocks.saveParcelSearch).toHaveBeenCalledWith(
        'view-one',
        expect.objectContaining({
          snapshot: {
            schema_version: 'citylens/parcel-saved-view-snapshot@v1',
            feed_generation: monitorProps.feedGeneration,
            feed_generated_at: monitorProps.feedGeneratedAt,
            match_count: 1,
            matched_bbls: ['3000010001'],
          },
        }),
      ),
    );
  });

  it('reloads the canonical baseline when another session advanced it', async () => {
    const staleView = {
      ...savedView,
      schema_version: 'citylens/parcel-saved-view@v3' as const,
      snapshot: {
        schema_version: 'citylens/parcel-saved-view-snapshot@v1' as const,
        feed_generation: '20260701T000000000000Z-aaaaaaaaaaaa',
        feed_generated_at: '2026-07-01T00:00:00Z',
        match_count: 1,
        matched_bbls: ['3000019999'],
      },
    };
    const currentViewRecord = {
      ...staleView,
      snapshot: {
        ...staleView.snapshot,
        feed_generation: monitorProps.feedGeneration,
        feed_generated_at: monitorProps.feedGeneratedAt,
        matched_bbls: ['3000010001'],
      },
    };
    mocks.listParcelSavedSearches
      .mockResolvedValueOnce([staleView])
      .mockResolvedValueOnce([currentViewRecord]);
    mocks.saveParcelSearch.mockRejectedValueOnce(
      new ApiError('Newer baseline exists', { status: 409 }),
    );

    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: /1 entered · 1 left/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark current set reviewed' }),
    );

    await waitFor(() =>
      expect(mocks.listParcelSavedSearches).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByText(/Current baseline · 1 matching parcel/i),
    ).toBeInTheDocument();
  });

  it('deletes a view and exposes a recoverable load failure', async () => {
    const { unmount } = render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText('Brooklyn candidates');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete saved view Brooklyn candidates',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Brooklyn candidates')).not.toBeInTheDocument(),
    );
    expect(mocks.removeParcelSavedSearch).toHaveBeenCalledWith('view-one');

    unmount();
    mocks.listParcelSavedSearches.mockRejectedValueOnce(new Error('offline'));
    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      await screen.findByText('Saved views are temporarily unavailable.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('compares one saved screen against the current complete inventory', async () => {
    const onApply = vi.fn();
    const onComparisonOpened = vi.fn();
    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={onApply}
        onComparisonOpened={onComparisonOpened}
        onClose={vi.fn()}
      />,
    );

    await screen.findByText('Brooklyn candidates');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Compare current screen with Brooklyn candidates',
      }),
    );

    const comparison = screen.getByTestId('saved-screen-comparison');
    expect(comparison).toHaveTextContent(
      'Both screens are re-evaluated against the same 2 currently loaded ranked leads.',
    );
    expect(screen.getByTestId('saved-screen-shared-count')).toHaveTextContent(
      '1',
    );
    expect(comparison).toHaveTextContent('Current only');
    expect(comparison).toHaveTextContent('Saved only');
    expect(comparison).toHaveTextContent(
      /not ranking accuracy, relative quality, feasibility, seller intent/i,
    );
    expect(onComparisonOpened).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply saved screen' }),
    );
    expect(onApply).toHaveBeenCalledWith(savedView);
  });

  it('keeps comparison disabled until the complete inventory is ready', async () => {
    render(
      <ParcelSavedViewsPanel
        {...monitorProps}
        currentView={currentView}
        inventoryRows={inventoryRows.slice(0, 1)}
        inventoryReady={false}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByText('Brooklyn candidates');
    expect(
      screen.getByRole('button', {
        name: 'Compare current screen with Brooklyn candidates',
      }),
    ).toBeDisabled();
    expect(
      screen.getByText('Loading the current ranked-lead inventory…'),
    ).toBeInTheDocument();
  });
});
