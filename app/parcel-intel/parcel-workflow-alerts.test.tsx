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

  it('shows source-backed exits and opens only retained parcels', async () => {
    mocks.getAlerts.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-alerts@v2',
      generated_at: '2026-07-24T01:00:00Z',
      feed_generated_at: '2026-07-24T00:00:00Z',
      watched_count: 2,
      changed_lead_count: 2,
      alert_count: 2,
      removed_from_feed_count: 1,
      resolved_exit_count: 1,
      unresolved_exit_count: 0,
      screened_out_count: 1,
      eligible_below_cutoff_count: 0,
      severity_counts: { urgent: 1, high: 1, medium: 0, low: 0 },
      alerts: [
        {
          bbl: '3020960069',
          borough: 'brooklyn',
          code: 'screened_out_of_current_feed',
          severity: 'urgent',
          title: 'Current project activity now screens out this lead',
          detail:
            'The current source-backed screen identifies active or recently approved project activity. Official project 2023K0205 is attached.',
          field: 'acquisition_eligible',
          before: true,
          after: false,
          current_disposition: 'screened_out',
          reason_codes: ['approved_land_use_project'],
          recommended_action:
            'Review the cited project record before changing the lead disposition.',
          source_evidence: [
            {
              source: 'NYC ZAP project activity',
              as_of: '2026-07-24',
              url: 'https://zap.planning.nyc.gov/projects/2023K0205',
              supports: 'approved_land_use_project',
            },
          ],
          parcel_available: false,
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
          parcel_available: true,
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
      await screen.findByText('Current project activity now screens out this lead'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Official project 2023K0205 is attached/i))
      .toBeInTheDocument();
    expect(screen.getByText('Approved Land Use Project')).toBeInTheDocument();
    expect(screen.getByText(/NYC ZAP project activity/i)).toBeInTheDocument();
    expect(screen.getByText(/as of Jul 24, 2026/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official record/i })).toHaveAttribute(
      'href',
      'https://zap.planning.nyc.gov/projects/2023K0205',
    );
    expect(screen.getByText(/Review the cited project record/i))
      .toBeInTheDocument();
    expect(screen.getByTestId('watchlist-exit-coverage')).toHaveTextContent(
      '1 feed exit has a current screening explanation',
    );
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

  it('formats structured before and after values as readable evidence', async () => {
    mocks.getAlerts.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-alerts@v2',
      generated_at: '2026-07-24T01:00:00Z',
      feed_generated_at: '2026-07-24T00:00:00Z',
      watched_count: 1,
      changed_lead_count: 1,
      alert_count: 1,
      removed_from_feed_count: 0,
      resolved_exit_count: 0,
      unresolved_exit_count: 0,
      screened_out_count: 0,
      eligible_below_cutoff_count: 0,
      severity_counts: { urgent: 0, high: 0, medium: 1, low: 0 },
      alerts: [
        {
          bbl: '4012340056',
          borough: 'queens',
          code: 'transit_access_changed',
          severity: 'medium',
          title: 'Transit access changed',
          detail: 'The nearest mapped transit complex changed.',
          field: 'transit_access',
          before: { station_name: 'Old Station', distance_m: 740 },
          after: { station_name: 'New Station', distance_m: 310 },
          parcel_available: true,
        },
      ],
      warnings: [],
    });

    render(
      <ParcelWorkflowAlertsPanel
        onClose={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Saved: Station Name: Old Station/i))
      .toHaveTextContent('Distance M: 740');
    expect(screen.getByText(/Current: Station Name: New Station/i))
      .toHaveTextContent('Distance M: 310');
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });
});
