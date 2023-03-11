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
    opportunity: 'uncommitted' as const,
    query: '  owner llc  ',
    ownerPortfolioId: null,
  },
  overlay: 'borough' as const,
};

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
        opportunity: 'uncommitted',
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
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      await screen.findByText('Saved views are temporarily unavailable.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
