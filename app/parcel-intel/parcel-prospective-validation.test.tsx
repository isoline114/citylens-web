import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParcelProspectiveValidationStatus } from '@/lib/api';
import { ParcelProspectiveValidation } from './parcel-prospective-validation';

function status(
  measurementStatus: ParcelProspectiveValidationStatus['measurement_status'],
): ParcelProspectiveValidationStatus {
  const collecting = measurementStatus !== 'awaiting_post_issue_data';
  const mature = measurementStatus === 'mature';
  const metric = (
    eligibleParcels: number,
    hits: number,
  ) => {
    const precision = hits / eligibleParcels;
    return {
      eligible_parcels: eligibleParcels,
      observed_nb_filing_hits: collecting ? hits : null,
      observed_precision_lower_bound: collecting ? precision : null,
      final_precision: mature ? precision : null,
      final_precision_95ci: mature
        ? ([
            precision / 2,
            Math.min(1, precision * 1.5),
          ] as [number, number])
        : null,
    };
  };
  return {
    schema: 'citylens-parcel-intel/prospective-validation-status@v1',
    cohort_id: '20260724T211504776940Z-9242d66f6201',
    source_generation: '20260724T211504776940Z-9242d66f6201',
    label_definition: 'dob_nb_job_filing',
    measurement_status: measurementStatus,
    issued_at: '2026-07-24T21:15:04Z',
    observation_starts_on: '2026-07-25',
    observed_through:
      measurementStatus === 'awaiting_post_issue_data'
        ? '2026-07-24'
        : mature
          ? '2027-07-25'
          : '2026-08-24',
    matures_at: '2027-07-24T21:15:04Z',
    elapsed_days: collecting ? (mature ? 365 : 31) : 0,
    maturity_fraction: collecting ? (mature ? 1 : 31 / 365) : 0,
    metrics: {
      top_100: metric(100, 3),
      top_1000: metric(1000, 8),
    },
    historical_benchmark: {
      scope: 'rolling_origin_latest_out_of_time',
      evaluation_window: '2025-2025',
      precision_at_100: 0.34,
      precision_at_1000: 0.104,
      not_current_cohort_accuracy: true,
    },
    official_sources: [
      {
        dataset_id: 'ic3t-wcy2',
        rows_updated_at: '2026-08-24T20:00:00Z',
      },
      {
        dataset_id: 'w9ak-ipjd',
        rows_updated_at: '2026-08-24T19:00:00Z',
      },
    ],
    report_reference: {
      observation_id: '20260824-aaaaaaaaaaaa',
      sha256: 'a'.repeat(64),
    },
    interpretation: 'Maturity-safe DOB filing measurement.',
  };
}

describe('ParcelProspectiveValidation', () => {
  it('does not turn pre-observation nulls into zero accuracy', () => {
    render(
      <ParcelProspectiveValidation
        status={status('awaiting_post_issue_data')}
      />,
    );

    expect(screen.getByTestId('prospective-validation-status')).toHaveAttribute(
      'data-status',
      'awaiting_post_issue_data',
    );
    expect(screen.getByText(/intentionally unavailable—not 0%/i)).toBeVisible();
  });

  it('labels immature observations as lower bounds', () => {
    render(
      <ParcelProspectiveValidation status={status('collecting')} />,
    );

    expect(screen.getByText(/3 filings · 3.00% lower bound/i)).toBeVisible();
    expect(screen.getByText(/lower bounds, not final accuracy/i)).toBeVisible();
  });

  it('shows final precision and intervals only for mature cohorts', () => {
    render(<ParcelProspectiveValidation status={status('mature')} />);

    expect(
      screen.getByText(/3\.00% \(95% CI 1\.50%–4\.50%\)/i),
    ).toBeVisible();
    expect(screen.getByText(/complete 365-day/i)).toBeVisible();
  });

  it('fails visibly when live status is unavailable', () => {
    render(<ParcelProspectiveValidation status={null} />);

    expect(screen.getByText('Live cohort status unavailable')).toBeVisible();
    expect(
      screen.getByText(/do not infer current accuracy/i),
    ).toBeVisible();
  });
});
