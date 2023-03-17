import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ParcelFeedReceipt,
  parcelFeedReceipt,
} from './parcel-feed-receipt';

const qualityGate = {
  passed: true,
  citywide_acquisition_eligible_count: 5000,
  screening_ledger: {
    evaluated_candidate_count: 24524,
    published_candidate_count: 5000,
    screened_out_count: 12119,
    eligible_below_cutoff_count: 7405,
  },
  land_use_reconciliation: {
    blocking_project_count: 800,
    joined_blocking_project_count: 800,
    published_leakage_count: 0,
  },
  address_identity: {
    pad_enriched_count: 500,
    pluto_address_count: 4500,
  },
  selection_policy: {
    policy_id: 'borough_floor_250',
    minimum_per_borough: 250,
    pure_citywide_overlap_fraction: 0.9766,
  },
};

const dataSources = {
  property_facts: { source: 'NYC PLUTO', stale: false },
  land_use_activity: { source: 'NYC ZAP', stale: false },
  project_activity: { source: 'NYC DOB', stale: false },
};

const modelMetadata = {
  precision_at_100: 0.34,
  precision_at_1000: 0.104,
  spatial_cv_base_rate: 0.001244,
  evaluation_evidence: {
    status: 'development_exposed',
  },
};

const prospectiveValidation = {
  schema: 'citylens-parcel-intel/prospective-validation-status@v1' as const,
  cohort_id: 'generation-1',
  source_generation: 'generation-1',
  label_definition: 'dob_nb_job_filing' as const,
  measurement_status: 'awaiting_post_issue_data' as const,
  issued_at: '2026-07-26T18:55:32Z',
  observation_starts_on: '2026-07-27',
  observed_through: '2026-07-25',
  matures_at: '2027-07-26T18:55:32Z',
  elapsed_days: 0,
  maturity_fraction: 0,
  metrics: {
    top_100: {
      eligible_parcels: 100,
      observed_nb_filing_hits: null,
      observed_precision_lower_bound: null,
      final_precision: null,
      final_precision_95ci: null,
    },
    top_1000: {
      eligible_parcels: 1000,
      observed_nb_filing_hits: null,
      observed_precision_lower_bound: null,
      final_precision: null,
      final_precision_95ci: null,
    },
  },
  historical_benchmark: {
    scope: 'rolling_origin_latest_out_of_time',
    evaluation_window: '2025-2025',
    precision_at_100: 0.34,
    precision_at_1000: 0.104,
    not_current_cohort_accuracy: true as const,
  },
  official_sources: [],
  report_reference: {
    observation_id: 'observation-1',
    sha256: 'a'.repeat(64),
  },
  interpretation: 'Historical evidence only.',
};

const prospectiveHealth = {
  status: 'current',
  reason: 'current',
  observation_lag_days: 1,
  max_observation_lag_days: 8,
  next_monitor_due_on: '2026-08-02',
  oldest_official_source_updated_at: '2026-07-25T20:23:37Z',
} as const;

describe('ParcelFeedReceipt', () => {
  it('summarizes the acquisition funnel and project reconciliation', () => {
    render(
      <ParcelFeedReceipt
        qualityGate={qualityGate}
        dataSources={dataSources}
        modelMetadata={modelMetadata}
        prospectiveValidation={prospectiveValidation}
        prospectiveValidationHealth={prospectiveHealth}
        generatedLabel="Jul 26, 2026"
      />,
    );

    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '5,000 leads surfaced',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '24,524',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '12,119',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'ZAP projects mapped 800 / 800',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'Address provenance 500 PAD / 4,500 PLUTO',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '250-lead borough floor · 97.7% pure-merit overlap',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'Membership gate only—it does not retrain the rank.',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'Selection borough floor 250',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      /not model accuracy, seller intent, transaction probability/i,
    );
    const historicalEvidence = within(
      screen.getByTestId('parcel-feed-receipt'),
    ).getByTestId('historical-ranking-evidence');
    expect(historicalEvidence).toHaveTextContent('Top 10034.0%');
    expect(historicalEvidence).toHaveTextContent('Top 1,00010.4%');
    expect(historicalEvidence).toHaveTextContent('NYC base0.12%');
    expect(historicalEvidence).toHaveTextContent(
      '273× top-100 enrichment · 84× top-1,000',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '2024 features → 2025 DOB NB filings',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'development-exposed benchmark',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'awaiting post-issue DOB data',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'current precision is intentionally not claimed',
    );
  });

  it('fails conservative when the quality receipt is absent', () => {
    render(
      <ParcelFeedReceipt
        qualityGate={{}}
        dataSources={{}}
        generatedLabel=""
      />,
    );

    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'Qualification receipt unavailable',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      /treat this feed as unverified/i,
    );
  });

  it('counts current and stale source declarations without trusting labels', () => {
    expect(
      parcelFeedReceipt(qualityGate, {
        current: { source: 'Current', stale: false },
        stale: { source: 'Stale', stale: true },
        malformed: 'not metadata',
      }),
    ).toMatchObject({
      currentSources: 1,
      staleSources: 1,
      projectLeakage: 0,
    });
  });
});
