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

beforeEach(() => {
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
        currentView={currentView}
        inventoryRows={inventoryRows}
        inventoryReady
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Brooklyn candidates')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply view' }));
    expect(onApply).toHaveBeenCalledWith(savedView);
  });

  it('saves the complete current state without promising alerts', async () => {
    render(
      <ParcelSavedViewsPanel
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
    });
    expect(screen.getByText(/do not send notifications/i)).toBeInTheDocument();
  });

  it('deletes a view and exposes a recoverable load failure', async () => {
    const { unmount } = render(
      <ParcelSavedViewsPanel
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
