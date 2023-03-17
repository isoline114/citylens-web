import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParcelProspectiveValidationStatus } from '@/lib/api';
import type { ParcelProspectiveValidationHealth } from '@/lib/api';
import { ParcelProspectiveValidation } from './parcel-prospective-validation';

function status(
  measurementStatus: ParcelProspectiveValidationStatus['measurement_status'],
  siteAware = false,
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
  const result: ParcelProspectiveValidationStatus = {
    schema: siteAware
      ? 'citylens-parcel-intel/prospective-validation-status@v2'
      : 'citylens-parcel-intel/prospective-validation-status@v1',
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
  if (siteAware) {
    const siteMetric = (eligibleSites: number, hits: number) => {
      const values = metric(eligibleSites, hits);
      return {
        eligible_sites: eligibleSites,
        observed_nb_filing_hits: values.observed_nb_filing_hits,
        observed_precision_lower_bound:
          values.observed_precision_lower_bound,
        final_precision: values.final_precision,
        final_precision_95ci: values.final_precision_95ci,
      };
    };
    result.site_count = 4769;
    result.site_metrics = {
      top_100: siteMetric(100, 2),
      top_1000: siteMetric(1000, 7),
    };
  }
  return result;
}

function health(
  state: ParcelProspectiveValidationHealth['status'] = 'current',
): ParcelProspectiveValidationHealth {
  return {
    status: state,
    reason:
      state === 'stale'
        ? 'observation_lag_exceeded'
        : state === 'unavailable'
          ? 'status_missing_or_invalid'
          : 'current',
    observation_lag_days:
      state === 'unavailable' ? null : state === 'stale' ? 10 : 1,
    max_observation_lag_days: 8,
    next_monitor_due_on:
      state === 'unavailable' ? null : '2026-08-02',
    oldest_official_source_updated_at:
      state === 'unavailable' ? null : '2026-07-24T19:00:00Z',
  };
}

describe('ParcelProspectiveValidation', () => {
  it('does not turn pre-observation nulls into zero accuracy', () => {
    render(
      <ParcelProspectiveValidation
        status={status('awaiting_post_issue_data')}
        health={health()}
      />,
    );

    expect(screen.getByTestId('prospective-validation-status')).toHaveAttribute(
      'data-status',
      'awaiting_post_issue_data',
    );
    expect(screen.getByText(/intentionally unavailable—not 0%/i)).toBeVisible();
    expect(screen.getByText(/weekly evidence monitor current/i)).toBeVisible();
  });

  it('labels immature observations as lower bounds', () => {
    render(
      <ParcelProspectiveValidation status={status('collecting')} />,
    );

    expect(screen.getByText(/3 filings · 3.00% lower bound/i)).toBeVisible();
    expect(screen.getByText(/lower bounds, not final accuracy/i)).toBeVisible();
  });

  it('separates issuance-time site outcomes from parcel outcomes', () => {
    render(
      <ParcelProspectiveValidation status={status('collecting', true)} />,
    );

    expect(screen.getByTestId('prospective-site-metrics')).toBeVisible();
    expect(screen.getByText('Parcel top 100')).toBeVisible();
    expect(screen.getByText('Site top 100')).toBeVisible();
    expect(screen.getByText(/2 filings · 2\.00% lower bound/i)).toBeVisible();
    expect(screen.getByText(/7 filings · 0\.70% lower bound/i)).toBeVisible();
  });

  it('discloses the frozen site cohort before observations begin', () => {
    render(
      <ParcelProspectiveValidation
        status={status('awaiting_post_issue_data', true)}
      />,
    );

    expect(
      screen.getByText(/4,769 frozen acquisition sites/i),
    ).toBeVisible();
    const receipt = screen.getByTestId('prospective-validation-status');
    expect(receipt).toHaveAttribute(
      'data-schema',
      'citylens-parcel-intel/prospective-validation-status@v2',
    );
    expect(receipt).toHaveAttribute('data-site-count', '4769');
    expect(receipt).toHaveAttribute('data-site-top-100-count', '100');
    expect(receipt).toHaveAttribute('data-site-top-1000-count', '1000');
  });

  it('shows final precision and intervals only for mature cohorts', () => {
    render(<ParcelProspectiveValidation status={status('mature')} />);

    expect(
      screen.getByText(/3\.00% \(95% CI 1\.50%–4\.50%\)/i),
    ).toBeVisible();
    expect(screen.getByText(/complete 365-day/i)).toBeVisible();
  });

  it('fails visibly when live status is unavailable', () => {
    render(
      <ParcelProspectiveValidation
        status={null}
        health={health('unavailable')}
      />,
    );

    expect(screen.getByText('Live cohort status unavailable')).toBeVisible();
    expect(
      screen.getByText(/do not infer current accuracy/i),
    ).toBeVisible();
  });

  it('blocks stale live metrics behind an overdue warning', () => {
    render(
      <ParcelProspectiveValidation
        status={status('collecting')}
        health={health('stale')}
      />,
    );

    expect(screen.getByTestId('prospective-validation-status')).toHaveAttribute(
      'data-status',
      'stale',
    );
    expect(screen.getByText('Live cohort monitor overdue')).toBeVisible();
    expect(screen.getByText(/has not advanced for 10 days/i)).toBeVisible();
    expect(screen.getByText(/must not be treated as current accuracy/i)).toBeVisible();
    expect(screen.queryByText(/3 filings/i)).not.toBeInTheDocument();
  });
});
