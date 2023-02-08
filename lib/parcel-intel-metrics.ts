/**
 * Single source of truth for the parcel-intel model's headline metrics.
 *
 * Why this module exists: the AUC / P@100 numbers were previously hardcoded in
 * two pages and had already drifted out of sync (`0.978` on the picker vs
 * `0.98` on the borough page). A hardcoded number also silently lies after a
 * retrain. So: one fallback constant here, plus a resolver that prefers live
 * values from the published `model_metadata` (manifest.json) when the publisher
 * emits them.
 *
 * The fallback values are the deployed model's temporal-holdout results — see
 * `source`. Update them only alongside a model change. Once
 * `citylens-parcel-intel/scripts/publish_sweep.py` emits `auc` /
 * `precision_at_100` into the manifest, the live path takes over automatically.
 */

export type ParcelIntelMetrics = {
  /** ROC AUC under temporal holdout. */
  auc: number;
  /**
   * Precision@100 — share of the top-100 ranked parcels that received a
   * new-building permit within the holdout window.
   */
  precisionAt100: number;
  /** PLUTO snapshot year the features are frozen at. */
  featureYear: number;
  /** Label window for NB-permit outcomes. */
  labelWindow: string;
  /** Provenance string for the fallback numbers. */
  source: string;
};

// Authoritative source: citylens-parcel-intel/data/nyc/backtest/
// temporal_2018_2019_2024.json → `calibrated` block (AUC 0.9786, P@100 0.85,
// P@1000 0.86). The previously-shown P@100 0.92 was overstated relative to this
// artifact; 0.85 is the real top-100 precision under temporal holdout.
export const FALLBACK_PARCEL_INTEL_METRICS: ParcelIntelMetrics = {
  auc: 0.978,
  precisionAt100: 0.85,
  featureYear: 2018,
  labelWindow: '2019-2024',
  source: 'temporal_2018_2019_2024.json (calibrated)',
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Resolve the metrics to display, preferring live values from the published
 * manifest's `model_metadata` (`auc`, `precision_at_100`, `feature_year`,
 * `label_window`) and falling back to {@link FALLBACK_PARCEL_INTEL_METRICS}
 * field-by-field. Live numbers can't lie after a retrain; the fallback
 * guarantees the copy still renders if the publisher hasn't emitted metrics yet.
 */
export function resolveParcelIntelMetrics(
  modelMetadata?: Record<string, unknown> | null,
): ParcelIntelMetrics {
  const m = modelMetadata ?? {};
  const auc = toFiniteNumber(m.auc);
  const precisionAt100 = toFiniteNumber(m.precision_at_100);
  const featureYear = toFiniteNumber(m.feature_year);
  const labelWindow =
    typeof m.label_window === 'string' && m.label_window.trim() !== ''
      ? m.label_window
      : null;

  return {
    auc: auc ?? FALLBACK_PARCEL_INTEL_METRICS.auc,
    precisionAt100: precisionAt100 ?? FALLBACK_PARCEL_INTEL_METRICS.precisionAt100,
    featureYear: featureYear ?? FALLBACK_PARCEL_INTEL_METRICS.featureYear,
    labelWindow: labelWindow ?? FALLBACK_PARCEL_INTEL_METRICS.labelWindow,
    source: FALLBACK_PARCEL_INTEL_METRICS.source,
  };
}

/** Format AUC as a 3-decimal string, e.g. `0.978`. */
export function formatAuc(auc: number): string {
  return auc.toFixed(3);
}

/** Format P@100 as a 2-decimal string, e.g. `0.92`. */
export function formatPrecisionAt100(precisionAt100: number): string {
  return precisionAt100.toFixed(2);
}
