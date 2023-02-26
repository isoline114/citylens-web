import type { ParcelIntelRow, TopFeature } from '@/lib/api';

/**
 * CSV export for the parcel-intel workspace.
 *
 * `buildCsv` is a pure function (no DOM) so it can be unit-tested; the
 * blob/anchor plumbing lives in `downloadCsv` below. Columns are an explicit
 * whitelist with human-readable headers — never `Object.keys(row)`, which
 * leaks internal fields and serializes `top_features` as `[object Object]`.
 */

type CellValue = string | number | boolean | null | undefined;

type Column = {
  header: string;
  value: (row: ParcelIntelRow, scoreRank: number) => CellValue;
};

/** Flatten SHAP attributions to `"lot_area (+32%); zoning (-18%)"`. */
export function flattenTopFeatures(features: TopFeature[] | null | undefined): string {
  if (!Array.isArray(features) || features.length === 0) return '';
  return features
    .map((f) => {
      const sign = f.contribution_logit >= 0 ? '+' : '-';
      const pct = Math.round(Math.abs(f.contribution_pct) * 100);
      return `${f.name} (${sign}${pct}%)`;
    })
    .join('; ');
}

const COLUMNS: Column[] = [
  { header: 'Address', value: (r) => r.address },
  { header: 'BBL', value: (r) => r.bbl },
  { header: 'Borough', value: (r) => r.borough },
  {
    header: 'Score (%)',
    value: (r) =>
      typeof r.score_calibrated === 'number'
        ? (r.score_calibrated * 100).toFixed(1)
        : null,
  },
  // Rank is by calibrated score (descending) within the exported set, not
  // the on-screen sort order — matches the map's rank-coded marker colors.
  { header: 'Rank', value: (_r, scoreRank) => scoreRank },
  { header: 'Zoning', value: (r) => r.zoning_district_1 },
  { header: 'Land use', value: (r) => r.land_use },
  { header: 'Lot area (sqft)', value: (r) => r.lot_area_sqft },
  { header: 'Allowed FAR', value: (r) => r.allowed_far },
  {
    header: 'Built FAR %',
    value: (r) =>
      typeof r.far_utilization_pct === 'number'
        ? r.far_utilization_pct.toFixed(0)
        : null,
  },
  { header: 'Unused floor area (sqft)', value: (r) => r.unused_floor_area_sqft },
  { header: 'Last sale price', value: (r) => r.last_sale_price },
  { header: 'Last sale year', value: (r) => r.last_sale_year },
  { header: 'Years held', value: (r) => r.years_held },
  { header: 'Landmark', value: (r) => (r.is_landmark ? 'yes' : 'no') },
  { header: 'Historic district', value: (r) => (r.is_historic_district ? 'yes' : 'no') },
  { header: 'Status', value: (r) => r.redev_status },
  { header: 'Top model factors', value: (r) => flattenTopFeatures(r.top_features) },
];

/** RFC 4180-style escaping: quote when the field contains , " or a newline. */
function csvEscape(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize rows to CSV. Rows are exported in the order given (the current
 * sort), while the Rank column reflects score order. An empty input yields
 * just the header row.
 */
export function buildCsv(rows: ParcelIntelRow[]): string {
  // Score-rank lookup: 1-based rank by score_calibrated descending. Rows
  // with a null score sort last; ties keep their incoming relative order.
  const byScore = rows
    .map((r, i) => ({ bbl: r.bbl, i, score: r.score_calibrated }))
    .sort((a, b) => {
      const as = typeof a.score === 'number' ? a.score : -Infinity;
      const bs = typeof b.score === 'number' ? b.score : -Infinity;
      return bs - as || a.i - b.i;
    });
  const rankByIndex = new Map<number, number>();
  byScore.forEach((entry, rank) => rankByIndex.set(entry.i, rank + 1));

  const lines = [COLUMNS.map((c) => csvEscape(c.header)).join(',')];
  rows.forEach((row, i) => {
    const scoreRank = rankByIndex.get(i) ?? i + 1;
    lines.push(COLUMNS.map((c) => csvEscape(c.value(row, scoreRank))).join(','));
  });
  return lines.join('\n');
}

/** Browser-only: build the CSV and trigger a download. */
export function downloadCsv(rows: ParcelIntelRow[], borough: string): void {
  if (rows.length === 0) return;
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `parcel-intel-${borough}-top${rows.length}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
