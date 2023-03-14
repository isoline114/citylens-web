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
    expect(
      screen.getByRole('button', { name: 'Close evidence changes' }),
    ).toHaveFocus();
    expect(screen.getByTestId('workflow-alerts-announcer')).toHaveTextContent(
      '2 evidence-change alerts loaded across 2 watched leads.',
    );
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
      await screen.findByText(
        /No decision-relevant differences, stale reviewed evidence versions/i,
      ),
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

  it('renders a stale reviewed version as bounded follow-up work', async () => {
    mocks.getAlerts.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-alerts@v3',
      generated_at: '2026-07-26T05:00:00Z',
      feed_generated_at: '2026-07-26T02:00:00Z',
      watched_count: 0,
      changed_lead_count: 1,
      alert_count: 1,
      removed_from_feed_count: 0,
      resolved_exit_count: 0,
      unresolved_exit_count: 0,
      screened_out_count: 0,
      eligible_below_cutoff_count: 0,
      reviewed_lead_count: 1,
      stale_review_count: 1,
      severity_counts: { urgent: 0, high: 0, medium: 1, low: 0 },
      alerts: [
        {
          bbl: '4012340056',
          borough: 'queens',
          code: 'reviewed_evidence_changed',
          severity: 'medium',
          title: 'Current property facts review is stale',
          detail:
            'The source as-of date changed after this evidence was reviewed.',
          field: 'evidence_reviews.property_facts',
          before: {
            status: 'verified',
            source: 'NYC PLUTO',
            as_of: '2026-07-20',
          },
          after: {
            status: 'verified',
            source: 'NYC PLUTO',
            as_of: '2026-07-26',
          },
          recommended_action:
            'Open the parcel evidence ledger and consider the current cited version.',
          source_evidence: [
            {
              source: 'NYC PLUTO',
              as_of: '2026-07-26',
              url: null,
              supports: 'current reviewed-evidence version',
            },
          ],
          evidence_changes: [{
            check_key: 'property_facts',
            label: 'Current property facts',
            reviewed_at: '2026-07-21T14:30:00Z',
            reviewed_status: 'verified',
            reviewed_source: 'NYC PLUTO',
            reviewed_source_as_of: '2026-07-20',
            reviewed_feed_generated_at: '2026-07-20T02:00:00Z',
            current_status: 'verified',
            current_source: 'NYC PLUTO',
            current_source_as_of: '2026-07-26',
            current_feed_generated_at: '2026-07-26T02:00:00Z',
            change_reasons: ['source_as_of', 'feed_generation'],
          }],
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

    expect(await screen.findByTestId('stale-evidence-review-summary'))
      .toHaveTextContent('1 reviewed evidence version is no longer current');
    expect(
      screen.getByTestId(
        'stale-evidence-review-4012340056-property_facts',
      ),
    ).toHaveTextContent('Reviewed version');
    expect(screen.getByText('New feed generation')).toBeInTheDocument();
    expect(screen.getByText('Source As Of')).toBeInTheDocument();
    expect(screen.getByText(/do not assert cleared diligence/i))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review evidence' }));
    expect(onSelectParcel).toHaveBeenCalledWith('4012340056');
  });

  it('surfaces a pending source report without implying the fact changed', async () => {
    mocks.getAlerts.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-alerts@v4',
      generated_at: '2026-07-26T06:00:00Z',
      feed_generated_at: '2026-07-26T02:00:00Z',
      watched_count: 0,
      changed_lead_count: 1,
      alert_count: 1,
      removed_from_feed_count: 0,
      reviewed_lead_count: 0,
      stale_review_count: 0,
      issue_lead_count: 1,
      open_issue_count: 1,
      severity_counts: { urgent: 0, high: 0, medium: 1, low: 0 },
      alerts: [
        {
          bbl: '4012340056',
          borough: 'queens',
          code: 'evidence_issue_submitted',
          severity: 'medium',
          title: 'Source issue awaiting review · Current property facts',
          detail:
            'Your private request is in the CityLens evidence-governance queue. The cited official value remains visible and unchanged until the request is resolved.',
          field: 'evidence_issues.property_facts',
          before: {
            status: 'verified',
            source: 'NYC PLUTO',
            as_of: '2026-07-26',
          },
          after: { request_status: 'submitted' },
          reason_codes: ['incorrect_value'],
          recommended_action:
            'Open the parcel workflow to inspect or withdraw the request.',
          source_evidence: [
            {
              source: 'NYC PLUTO',
              as_of: '2026-07-26',
              url: null,
              supports: 'reported evidence version',
            },
          ],
          evidence_issue: {
            issue_id: 'pei_0123456789abcdef0123456789abcdef',
            check_key: 'property_facts',
            label: 'Current property facts',
            issue_type: 'correction',
            reason_code: 'incorrect_value',
            note:
              'The displayed lot area conflicts with a current signed survey.',
            status: 'submitted',
            check_status: 'verified',
            source: 'NYC PLUTO',
            source_as_of: '2026-07-26',
            feed_generated_at: '2026-07-26T02:00:00Z',
            submitted_at: '2026-07-26T05:30:00Z',
            updated_at: '2026-07-26T05:30:00Z',
            resolved_at: null,
            resolution_note: null,
          },
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

    expect(await screen.findByTestId('open-evidence-issue-summary'))
      .toHaveTextContent('1 private source report is awaiting CityLens review');
    expect(
      screen.getByTestId(
        'open-evidence-issue-4012340056-property_facts',
      ),
    ).toHaveTextContent('Correction review');
    expect(screen.getByText(/does not edit or suppress/i)).toBeInTheDocument();
    expect(screen.queryByText(/Saved:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect request' }));
    expect(onSelectParcel).toHaveBeenCalledWith('4012340056');
  });
});
