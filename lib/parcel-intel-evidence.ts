import type {
  ParcelHistoricalBenchmarkReceipt,
  ParcelHistoricalTopKReceipt,
} from './api';

function finiteRatio(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function parseTopKReceipt(
  value: unknown,
  expectedK: 100 | 1000,
): ParcelHistoricalTopKReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.k !== expectedK ||
    typeof raw.evaluated_rows !== 'number' ||
    !Number.isInteger(raw.evaluated_rows) ||
    raw.evaluated_rows < 1 ||
    raw.evaluated_rows > expectedK ||
    typeof raw.observed_hits !== 'number' ||
    !Number.isInteger(raw.observed_hits) ||
    raw.observed_hits < 0 ||
    raw.observed_hits > raw.evaluated_rows ||
    !finiteRatio(raw.precision) ||
    !Array.isArray(raw.precision_95ci) ||
    raw.precision_95ci.length !== 2 ||
    !finiteRatio(raw.precision_95ci[0]) ||
    !finiteRatio(raw.precision_95ci[1])
  ) {
    return null;
  }
  const precision = raw.observed_hits / raw.evaluated_rows;
  if (
    Math.abs(raw.precision - precision) > 1e-12 ||
    raw.precision_95ci[0] > raw.precision ||
    raw.precision_95ci[1] < raw.precision
  ) {
    return null;
  }
  return raw as unknown as ParcelHistoricalTopKReceipt;
}

export function parseHistoricalBenchmarkReceipt(
  value: unknown,
): ParcelHistoricalBenchmarkReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const top100 = parseTopKReceipt(raw.top_100, 100);
  const top1000 = parseTopKReceipt(raw.top_1000, 1000);
  const interval =
    raw.interval && typeof raw.interval === 'object'
      ? (raw.interval as Record<string, unknown>)
      : null;
  if (
    raw.schema !== 'citylens_historical_benchmark_receipt@v1' ||
    typeof raw.target !== 'string' ||
    !raw.target ||
    typeof raw.feature_origin !== 'number' ||
    !Number.isInteger(raw.feature_origin) ||
    typeof raw.outcome_window !== 'string' ||
    typeof raw.evaluation_scope !== 'string' ||
    typeof raw.evaluation_rows !== 'number' ||
    !Number.isInteger(raw.evaluation_rows) ||
    raw.evaluation_rows < 1000 ||
    typeof raw.observed_positive_rows !== 'number' ||
    !Number.isInteger(raw.observed_positive_rows) ||
    raw.observed_positive_rows < 0 ||
    raw.observed_positive_rows > raw.evaluation_rows ||
    !finiteRatio(raw.base_rate) ||
    Math.abs(
      raw.base_rate - raw.observed_positive_rows / raw.evaluation_rows,
    ) > 1e-12 ||
    !finiteRatio(raw.auc) ||
    !finiteRatio(raw.pr_auc) ||
    !top100 ||
    !top1000 ||
    !interval ||
    interval.method !== 'wilson_score_observed_top_k' ||
    interval.confidence_level !== 0.95 ||
    interval.scope !== 'fixed_historical_ranked_list' ||
    typeof interval.limitations !== 'string' ||
    !interval.limitations ||
    !['unexposed', 'development_exposed', 'retired', 'unclassified'].includes(
      String(raw.evidence_status),
    ) ||
    raw.not_current_accuracy !== true ||
    raw.not_parcel_confidence !== true
  ) {
    return null;
  }
  return raw as unknown as ParcelHistoricalBenchmarkReceipt;
}

export function normalizePerformanceScope(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value
    .replace(
      /validated rolling procedure:\s*latest untouched test/i,
      'Historical rolling benchmark',
    )
    .replace(/latest untouched test:/i, 'historical rolling benchmark:');
}

export function historicalBenchmarkCopy({
  precisionAt100,
  precisionAt1000,
  baseRate,
  evidenceStatus,
  receipt = null,
}: {
  precisionAt100: number | null;
  precisionAt1000: number | null;
  baseRate: number | null;
  evidenceStatus: string;
  receipt?: ParcelHistoricalBenchmarkReceipt | null;
}): string {
  if (precisionAt100 === null || precisionAt1000 === null) {
    return (
      'Historical benchmark hit rates are unavailable for this feed. Treat ' +
      'the rank as a screening order, not a conversion probability.'
    );
  }
  const baseRateCopy =
    baseRate === null
      ? ''
      : `, versus a ${(baseRate * 100).toFixed(
          3,
        )}% eligible-population base rate`;
  const evidenceCopy =
    evidenceStatus === 'unexposed'
      ? 'The versioned benchmark ledger marks this evidence as reserved and unexposed.'
      : 'These outcomes have been inspected during model development and are not an independent current-accuracy estimate.';
  if (receipt) {
    const top100Rate = (receipt.top_100.precision * 100).toFixed(0);
    const top1000Rate = (receipt.top_1000.precision * 100).toFixed(1);
    const top100Low = (receipt.top_100.precision_95ci[0] * 100).toFixed(1);
    const top100High = (receipt.top_100.precision_95ci[1] * 100).toFixed(1);
    const top1000Low = (receipt.top_1000.precision_95ci[0] * 100).toFixed(1);
    const top1000High = (receipt.top_1000.precision_95ci[1] * 100).toFixed(1);
    return (
      `In the historical 2024→2025 benchmark, ${receipt.top_100.observed_hits} ` +
      `of the top ${receipt.top_100.evaluated_rows} received a DOB ` +
      `new-building filing (${top100Rate}%; observed 95% interval ${top100Low}–${top100High}%), ` +
      `and ${receipt.top_1000.observed_hits} of the top ` +
      `${receipt.top_1000.evaluated_rows} did so (${top1000Rate}%; ` +
      `observed 95% interval ${top1000Low}–${top1000High}%)${baseRateCopy}. ` +
      `${evidenceCopy} The ranges quantify fixed-list outcome uncertainty ` +
      'only; they do not include model selection, spatial dependence, dataset ' +
      'shift, or current acquisition outcomes.'
    );
  }
  return (
    `In the historical 2024→2025 benchmark, ${(
      precisionAt100 * 100
    ).toFixed(0)}% of the top 100 and ${(precisionAt1000 * 100).toFixed(
      1,
    )}% of the top 1,000 received a DOB new-building filing within one year` +
    `${baseRateCopy}. ${evidenceCopy} This measures filing hazard—not seller ` +
    'intent, acquisition, or closing probability.'
  );
}
