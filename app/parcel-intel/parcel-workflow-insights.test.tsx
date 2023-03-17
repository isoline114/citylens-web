import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAnalytics: vi.fn(),
  getExport: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelWorkflowAnalytics: mocks.getAnalytics,
    getParcelWorkflowOutcomeExport: mocks.getExport,
  };
});

import type {
  ParcelWorkflowAnalytics,
  ParcelWorkflowRate,
} from '@/lib/api';

import { ParcelWorkflowInsights } from './parcel-workflow-insights';

describe('ParcelWorkflowInsights', () => {
  beforeEach(() => {
    mocks.getAnalytics.mockReset();
    mocks.getExport.mockReset();
  });

  it('withholds percentages while prospective denominators are too small', async () => {
    mocks.getAnalytics.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-analytics@v3',
      generated_at: '2026-07-23T23:00:00Z',
      measurement_status: 'collecting',
      measurement_label: 'Collecting observation time',
      total_records: 3,
      active_records: 2,
      archived_records: 1,
      event_history_records: 3,
      rank_snapshot_records: 3,
      valid_saved_at_records: 3,
      oldest_followup_days: 12,
      median_followup_days: 8,
      minimum_cohort_size: 30,
      minimum_rate_denominator: 10,
      stage_counts: { reviewing: 3 },
      outcome_counts: { owner_contacted: 1, unknown: 2 },
      decision_reason_counts: {},
      funnel: {
        saved: 3,
        contacted: 1,
        meeting_scheduled: 0,
        qualified: 0,
        offer_submitted: 0,
        under_contract: 0,
        closed: 0,
        rejected: 0,
        lost: 0,
        contacted_per_saved: {
          numerator: 1,
          denominator: 3,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        qualified_per_contacted: {
          numerator: 0,
          denominator: 1,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        offer_per_qualified: {
          numerator: 0,
          denominator: 0,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        contract_per_offer: {
          numerator: 0,
          denominator: 0,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        close_per_contract: {
          numerator: 0,
          denominator: 0,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
      },
      maturity_windows: [
        {
          milestone: 'owner_contacted',
          label: 'Contacted within 30 days',
          horizon_days: 30,
          eligible_records: 0,
          reached_within_horizon: 0,
          pending_records: 3,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
      ],
      cohorts: [
        {
          dimension: 'rank_band',
          value: '1-100',
          total: 3,
          contacted: 1,
          qualified: 0,
          offer_submitted: 0,
          under_contract: 0,
          closed: 0,
          rejected: 0,
          lost: 0,
          contacted_rate_denominator: 0,
          qualified_rate_denominator: 0,
          close_rate_denominator: 0,
          contacted_rate: null,
          contacted_confidence_interval: null,
          qualified_rate: null,
          qualified_confidence_interval: null,
          close_rate: null,
          close_confidence_interval: null,
        },
      ],
      warnings: [],
    });

    render(<ParcelWorkflowInsights onClose={vi.fn()} />);

    expect(
      await screen.findByText('Collecting observation time'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('workflow-insights-panel')).toHaveAttribute(
      'data-state',
      'collecting',
    );
    expect(
      screen.getByTestId('workflow-insights-evidence-boundary'),
    ).toHaveTextContent(
      "These rates are not the historical model's validation accuracy.",
    );
    expect(
      screen.getByTestId('workflow-insights-maturity-boundary'),
    ).toHaveTextContent(
      'Rates remain hidden as “Collecting” until that mature denominator reaches 10.',
    );
    expect(
      screen.getByRole('button', { name: 'Close outcome insights' }),
    ).toHaveFocus();
    expect(
      screen.getByTestId('workflow-insights-announcer'),
    ).toHaveTextContent(
      'Collecting observation time. 3 saved leads in prospective outcome evidence.',
    );
    expect(
      screen.getByTestId('workflow-insights-measurement-label'),
    ).toHaveTextContent('Collecting observation time');
    expect(
      screen.getByRole('region', {
        name: 'Scrollable fixed-horizon outcomes by saved rank',
      }),
    ).toHaveAttribute('tabindex', '0');
    expect(screen.getAllByText('Collecting').length).toBeGreaterThan(0);
    expect(screen.getByText(/0 of 0 mature · 3 pending/i)).toBeInTheDocument();
    expect(screen.getByText(/not the historical model's validation accuracy/i))
      .toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1-100' })).toBeInTheDocument();
    expect(screen.getByText(/Archived leads remain in denominators/i))
      .toBeInTheDocument();
  });

  it('shows an activation path instead of empty rate cards without a cohort', async () => {
    const emptyRate = {
      numerator: 0,
      denominator: 0,
      rate: null,
      confidence_interval: null,
      sufficient_denominator: false,
    } satisfies ParcelWorkflowRate;
    mocks.getAnalytics.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-analytics@v3',
      generated_at: '2026-07-24T12:00:00Z',
      measurement_status: 'collecting',
      measurement_label: 'Collecting observation time',
      total_records: 0,
      active_records: 0,
      archived_records: 0,
      event_history_records: 0,
      rank_snapshot_records: 0,
      valid_saved_at_records: 0,
      oldest_followup_days: null,
      median_followup_days: null,
      minimum_cohort_size: 30,
      minimum_rate_denominator: 10,
      stage_counts: {},
      outcome_counts: {},
      decision_reason_counts: {},
      funnel: {
        saved: 0,
        contacted: 0,
        meeting_scheduled: 0,
        qualified: 0,
        offer_submitted: 0,
        under_contract: 0,
        closed: 0,
        rejected: 0,
        lost: 0,
        contacted_per_saved: emptyRate,
        qualified_per_contacted: emptyRate,
        offer_per_qualified: emptyRate,
        contract_per_offer: emptyRate,
        close_per_contract: emptyRate,
      },
      maturity_windows: [],
      cohorts: [],
      warnings: [],
    } satisfies ParcelWorkflowAnalytics);

    render(<ParcelWorkflowInsights onClose={vi.fn()} />);

    const emptyState = await screen.findByTestId('workflow-evidence-empty');
    expect(screen.getByTestId('workflow-insights-panel')).toHaveAttribute(
      'data-state',
      'empty',
    );
    expect(emptyState).toHaveTextContent('No outcome cohort yet');
    expect(emptyState).toHaveTextContent('Save ranked leads');
    expect(emptyState).toHaveTextContent('Work the queue');
    expect(emptyState).toHaveTextContent('Record outcomes');
    expect(emptyState).toHaveTextContent('at least 30 leads are saved');
    expect(screen.queryByText('Contacted within 30 days')).not.toBeInTheDocument();
  });

  it('downloads a privacy-safe, maturity-qualified evidence artifact', async () => {
    const emptyRate = {
      numerator: 0,
      denominator: 0,
      rate: null,
      confidence_interval: null,
      sufficient_denominator: false,
    } satisfies ParcelWorkflowRate;
    mocks.getAnalytics.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-analytics@v3',
      generated_at: '2026-07-24T12:00:00Z',
      measurement_status: 'collecting',
      measurement_label: 'Collecting observation time',
      total_records: 1,
      active_records: 1,
      archived_records: 0,
      event_history_records: 1,
      rank_snapshot_records: 1,
      valid_saved_at_records: 1,
      oldest_followup_days: 40,
      median_followup_days: 40,
      minimum_cohort_size: 30,
      minimum_rate_denominator: 10,
      stage_counts: { reviewing: 1 },
      outcome_counts: { owner_contacted: 1 },
      decision_reason_counts: { pursuing: 1 },
      funnel: {
        saved: 1,
        contacted: 1,
        meeting_scheduled: 0,
        qualified: 0,
        offer_submitted: 0,
        under_contract: 0,
        closed: 0,
        rejected: 0,
        lost: 0,
        contacted_per_saved: emptyRate,
        qualified_per_contacted: emptyRate,
        offer_per_qualified: emptyRate,
        contract_per_offer: emptyRate,
        close_per_contract: emptyRate,
      },
      maturity_windows: [],
      cohorts: [],
      warnings: [],
    } satisfies ParcelWorkflowAnalytics);
    mocks.getExport.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-outcome-export@v1',
      methodology_schema_version:
        'citylens/parcel-workflow-analytics-methodology@v2',
      generated_at: '2026-07-24T12:00:00Z',
      input_record_count: 1,
      exported_record_count: 1,
      excluded_invalid_saved_at_count: 0,
      event_history_observed_count: 1,
      rank_snapshot_count: 1,
      rows_sha256: 'a'.repeat(64),
      label_semantics: 'Mature labels only.',
      score_semantics: 'Not acquisition probability.',
      privacy_contract: 'Private fields excluded.',
      excluded_private_fields: ['notes'],
      rows: [],
    });
    const createObjectURL = vi.fn(() => 'blob:outcome-evidence');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<ParcelWorkflowInsights onClose={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Export evidence' }),
    );

    await waitFor(() => expect(mocks.getExport).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Exported 1 privacy-safe outcome record.'),
    ).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:outcome-evidence');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
