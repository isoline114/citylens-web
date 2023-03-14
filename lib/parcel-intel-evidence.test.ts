import { describe, expect, it } from 'vitest';
import {
  historicalBenchmarkCopy,
  normalizePerformanceScope,
  parseHistoricalBenchmarkReceipt,
} from './parcel-intel-evidence';

const receipt = {
  schema: 'citylens_historical_benchmark_receipt@v1',
  target: 'dob_nb_job_filing',
  feature_origin: 2024,
  outcome_window: '2025-2025',
  evaluation_scope: 'rolling_origin_latest_out_of_time',
  evaluation_rows: 768514,
  observed_positive_rows: 956,
  base_rate: 956 / 768514,
  auc: 0.9232830323176429,
  pr_auc: 0.054015618548797745,
  top_100: {
    k: 100,
    evaluated_rows: 100,
    observed_hits: 34,
    precision: 0.34,
    precision_95ci: [0.25461520797348164, 0.43722271145275377],
  },
  top_1000: {
    k: 1000,
    evaluated_rows: 1000,
    observed_hits: 104,
    precision: 0.104,
    precision_95ci: [0.08657102809826807, 0.12445976462229157],
  },
  interval: {
    method: 'wilson_score_observed_top_k',
    confidence_level: 0.95,
    scope: 'fixed_historical_ranked_list',
    limitations: 'Observed outcomes only.',
  },
  evidence_status: 'development_exposed',
  not_current_accuracy: true,
  not_parcel_confidence: true,
} as const;

describe('parcel intelligence evaluation evidence', () => {
  it('downgrades legacy untouched-test language before rendering it', () => {
    expect(
      normalizePerformanceScope(
        'Rolling origin: PLUTO 2018/2020/2022 training; latest untouched test: 2024 features → 2025 DOB NB filings',
      ),
    ).toBe(
      'Rolling origin: PLUTO 2018/2020/2022 training; historical rolling benchmark: 2024 features → 2025 DOB NB filings',
    );
  });

  it('describes exposed historical outcomes without calling them current accuracy', () => {
    const copy = historicalBenchmarkCopy({
      precisionAt100: 0.34,
      precisionAt1000: 0.104,
      baseRate: 0.001243959,
      evidenceStatus: 'development_exposed',
    });

    expect(copy).toContain('34% of the top 100');
    expect(copy).toContain('10.4% of the top 1,000');
    expect(copy).toContain('inspected during model development');
    expect(copy).toContain('not an independent current-accuracy estimate');
    expect(copy).not.toContain('untouched');
  });

  it('renders an exact benchmark receipt with bounded uncertainty', () => {
    const parsed = parseHistoricalBenchmarkReceipt(receipt);
    const copy = historicalBenchmarkCopy({
      precisionAt100: 0.34,
      precisionAt1000: 0.104,
      baseRate: 956 / 768514,
      evidenceStatus: 'development_exposed',
      receipt: parsed,
    });

    expect(parsed).not.toBeNull();
    expect(copy).toContain('34 of the top 100');
    expect(copy).toContain('104 of the top 1000');
    expect(copy).toContain('25.5–43.7%');
    expect(copy).toContain('8.7–12.4%');
    expect(copy).toContain('fixed-list outcome uncertainty');
    expect(copy).toContain('spatial dependence');
    expect(copy).not.toContain('parcel confidence');
  });

  it('rejects a receipt whose point estimate disagrees with its counts', () => {
    expect(
      parseHistoricalBenchmarkReceipt({
        ...receipt,
        top_100: {...receipt.top_100, observed_hits: 35},
      }),
    ).toBeNull();
  });

  it('fails conservatively when benchmark metrics are unavailable', () => {
    expect(
      historicalBenchmarkCopy({
        precisionAt100: null,
        precisionAt1000: null,
        baseRate: null,
        evidenceStatus: 'unclassified',
      }),
    ).toContain('screening order, not a conversion probability');
  });
});
