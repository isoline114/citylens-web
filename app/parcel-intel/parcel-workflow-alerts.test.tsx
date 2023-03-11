import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAlerts: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelWorkflowAlerts: mocks.getAlerts,
  };
});

import { ParcelWorkflowAlertsPanel } from './parcel-workflow-alerts';

describe('ParcelWorkflowAlertsPanel', () => {
  beforeEach(() => {
    mocks.getAlerts.mockReset();
  });

  it('shows conservative watchlist changes and opens retained parcels', async () => {
    mocks.getAlerts.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-alerts@v1',
      generated_at: '2026-07-24T01:00:00Z',
      feed_generated_at: '2026-07-24T00:00:00Z',
      watched_count: 2,
      changed_lead_count: 2,
      alert_count: 2,
      removed_from_feed_count: 1,
      severity_counts: { urgent: 1, high: 1, medium: 0, low: 0 },
      alerts: [
        {
          bbl: '3020960069',
          borough: 'brooklyn',
          code: 'removed_from_current_feed',
          severity: 'urgent',
          title: 'No longer in the current eligible feed',
          detail:
            'Verify current DOB, ZAP, ownership, sale, and constraint records. This alert does not assert why it was removed.',
          field: 'acquisition_eligible',
          before: true,
          after: false,
        },
        {
          bbl: '4012340056',
          borough: 'queens',
          code: 'owner_changed',
          severity: 'high',
          title: 'Owner name changed',
          detail: 'Current PLUTO owner text differs from the saved lead.',
          field: 'owner_name',
          before: 'OLD OWNER LLC',
          after: 'NEW OWNER LLC',
        },
      ],
      warnings: [],
    });
    const onSelectParcel = vi.fn();

    render(
      <ParcelWorkflowAlertsPanel
        onClose={vi.fn()}
        onSelectParcel={onSelectParcel}
      />,
    );

    expect(
      await screen.findByText('No longer in the current eligible feed'),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not assert why it was removed/i))
      .toBeInTheDocument();
    expect(screen.getByText('Owner name changed')).toBeInTheDocument();
    expect(screen.getByText(/Saved: OLD OWNER LLC/i)).toBeInTheDocument();
    expect(screen.getByText(/Current: NEW OWNER LLC/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open parcel' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open parcel' }));
    expect(onSelectParcel).toHaveBeenCalledWith('4012340056');
  });

  it('shows a clean state without implying guaranteed freshness', async () => {
    mocks.getAlerts.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-alerts@v1',
      generated_at: '2026-07-24T01:00:00Z',
      feed_generated_at: '2026-07-24T00:00:00Z',
      watched_count: 4,
      changed_lead_count: 0,
      alert_count: 0,
      removed_from_feed_count: 0,
      severity_counts: { urgent: 0, high: 0, medium: 0, low: 0 },
      alerts: [],
      warnings: [],
    });

    render(
      <ParcelWorkflowAlertsPanel
        onClose={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/No decision-relevant differences were found/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Current feed: 2026-07-24/i)).toBeInTheDocument();
  });
});
