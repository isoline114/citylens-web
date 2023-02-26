import type { ParcelIntelRow } from '@/lib/api';

/**
 * Rank-band math shared by the map markers and its legend. Kept free of any
 * leaflet/react-leaflet imports so it can be unit-tested in jsdom without
 * dragging the map runtime in.
 */

export const BAND_COLORS = {
  top: '#dc2626', // rose-600 — top 10%
  high: '#f59e0b', // amber-500 — next 20%
  mid: '#10b981', // emerald-500 — next 30%
  rest: '#0ea5e9', // sky-500 — remainder
} as const;

/**
 * Absolute rank boundaries for a given row count. Fractional tiers
 * (10% / 30% / 60%) expressed as 1-based rank cutoffs so the legend and
 * `colorForRank` can never disagree.
 */
export function bandBoundaries(total: number): { b1: number; b2: number; b3: number } {
  // Four percentile colors are noise for a two- or three-marker result.
  // Keep the best parcel distinct and group the remainder into one band.
  if (total <= 3) {
    const top = total > 0 ? 1 : 0;
    return { b1: top, b2: top, b3: top };
  }
  const clamp = (v: number, min: number) => Math.max(min, Math.round(v));
  const b1 = clamp(total * 0.1, 1);
  const b2 = clamp(total * 0.3, b1);
  const b3 = clamp(total * 0.6, b2);
  return { b1, b2, b3 };
}

/**
 * Marker color for a 0-based score rank (rank by `score_calibrated`
 * descending — NOT display/sort order).
 */
export function colorForRank(rank: number, total: number): string {
  const { b1, b2, b3 } = bandBoundaries(total);
  if (rank < b1) return BAND_COLORS.top;
  if (rank < b2) return BAND_COLORS.high;
  if (rank < b3) return BAND_COLORS.mid;
  return BAND_COLORS.rest;
}

export type LegendBand = { color: string; label: string };

/**
 * Legend entries computed from the actual row count — "Top 100 / 101-300 /
 * 301-600 / 601+" for 1000 rows rather than a hardcoded "Top 10 / 11-30 / …".
 * Degenerate bands (empty ranges at tiny row counts) are dropped.
 */
export function legendBands(total: number): LegendBand[] {
  const { b1, b2, b3 } = bandBoundaries(total);
  const bands: LegendBand[] = [];
  if (b1 > 0) bands.push({ color: BAND_COLORS.top, label: `Top ${b1}` });
  if (b2 > b1) bands.push({ color: BAND_COLORS.high, label: `${b1 + 1}-${b2}` });
  if (b3 > b2) bands.push({ color: BAND_COLORS.mid, label: `${b2 + 1}-${b3}` });
  if (total > b3) bands.push({ color: BAND_COLORS.rest, label: `${b3 + 1}+` });
  return bands;
}

/**
 * 0-based score rank per BBL (rank by `score_calibrated` descending, null
 * scores last, ties keep incoming order). Marker colors key off this so
 * re-sorting the table never recolors the map.
 */
export function scoreRankByBbl(rows: ParcelIntelRow[]): Map<string, number> {
  const order = rows
    .map((r, i) => ({ bbl: r.bbl, i, score: r.score_calibrated }))
    .sort((a, b) => {
      const as = typeof a.score === 'number' ? a.score : -Infinity;
      const bs = typeof b.score === 'number' ? b.score : -Infinity;
      return bs - as || a.i - b.i;
    });
  const ranks = new Map<string, number>();
  order.forEach((entry, rank) => {
    if (!ranks.has(entry.bbl)) ranks.set(entry.bbl, rank);
  });
  return ranks;
}

/**
 * Stable membership key for a row set: identical regardless of sort order,
 * different whenever a row enters or leaves the set. Used to refit map
 * bounds only when membership actually changes (never on re-sort).
 */
export function membershipKey(rows: ParcelIntelRow[]): string {
  return rows
    .map((r) => r.bbl)
    .sort()
    .join('|');
}
