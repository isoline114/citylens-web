import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAnalytics: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelWorkflowAnalytics: mocks.getAnalytics,
  };
});

import { ParcelWorkflowInsights } from './parcel-workflow-insights';

describe('ParcelWorkflowInsights', () => {
  beforeEach(() => {
    mocks.getAnalytics.mockReset();
  });

  it('withholds percentages while prospective denominators are too small', async () => {
    mocks.getAnalytics.mockResolvedValue({
      schema_version: 'citylens/parcel-workflow-analytics@v2',
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
          rate: 0.3333,
          sufficient_denominator: false,
        },
        qualified_per_contacted: {
          numerator: 0,
          denominator: 1,
          rate: 0,
          sufficient_denominator: false,
        },
        offer_per_qualified: {
          numerator: 0,
          denominator: 0,
          rate: null,
          sufficient_denominator: false,
        },
        contract_per_offer: {
          numerator: 0,
          denominator: 0,
          rate: null,
          sufficient_denominator: false,
        },
        close_per_contract: {
          numerator: 0,
          denominator: 0,
          rate: null,
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
          contacted_rate: 0.3333,
          qualified_rate: 0,
          close_rate: 0,
        },
      ],
      warnings: [],
    });

    render(<ParcelWorkflowInsights onClose={vi.fn()} />);

    expect(
      await screen.findByText('Collecting observation time'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Collecting').length).toBeGreaterThan(0);
    expect(screen.getByText(/0 of 0 mature · 3 pending/i)).toBeInTheDocument();
    expect(screen.getByText(/not the historical model's validation accuracy/i))
      .toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1-100' })).toBeInTheDocument();
    expect(screen.getByText(/Archived leads remain in denominators/i))
      .toBeInTheDocument();
  });
});
