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
  value: (row: ParcelIntelRow) => CellValue;
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
  { header: 'NYC acquisition rank', value: (r) => r.citywide_rank },
  {
    header: 'Borough acquisition rank',
    value: (r) => r.acquisition_rank ?? r.priority_rank,
  },
  { header: 'Original model rank', value: (r) => r.model_rank },
  { header: 'Priority tier', value: (r) => r.priority_tier },
  {
    header: 'Acquisition eligible',
    value: (r) =>
      r.acquisition_eligible === null || r.acquisition_eligible === undefined
        ? null
        : r.acquisition_eligible
          ? 'yes'
          : 'no',
  },
  { header: 'Acquisition status', value: (r) => r.acquisition_status },
  {
    header: 'Exclusion reasons',
    value: (r) => (r.acquisition_exclusion_reasons ?? []).join('; '),
  },
  { header: 'Opportunity', value: (r) => r.opportunity_category },
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
  { header: 'Final tax-lien sale date', value: (r) => r.tax_lien_sale_date },
  {
    header: 'Tax-lien water debt only',
    value: (r) =>
      r.tax_lien_water_debt_only === null ||
      r.tax_lien_water_debt_only === undefined
        ? null
        : r.tax_lien_water_debt_only
          ? 'yes'
          : 'no',
  },
  { header: 'Tax-lien data retrieved', value: (r) => r.tax_lien_data_as_of },
  {
    header: 'DOB Safety active violations',
    value: (r) => r.dob_safety_active_count,
  },
  {
    header: 'DOB Safety latest issue',
    value: (r) => r.dob_safety_latest_issue_date,
  },
  { header: 'OATH ECB active violations', value: (r) => r.ecb_active_count },
  {
    header: 'OATH ECB Class 1 violations',
    value: (r) => r.ecb_class_1_count,
  },
  { header: 'OATH ECB reported balance', value: (r) => r.ecb_balance_due },
  { header: 'OATH ECB latest issue', value: (r) => r.ecb_latest_issue_date },
  { header: 'HPD open violations', value: (r) => r.hpd_open_count },
  { header: 'HPD Class C violations', value: (r) => r.hpd_class_c_count },
  {
    header: 'HPD latest inspection',
    value: (r) => r.hpd_latest_inspection_date,
  },
  {
    header: 'Immediate-hazard violations',
    value: (r) => r.critical_violation_count,
  },
  { header: 'Violation data retrieved', value: (r) => r.violation_data_as_of },
  {
    header: 'FEMA 2007 FIRM 1% tax-lot overlap',
    value: (r) =>
      r.firm07_floodplain === null || r.firm07_floodplain === undefined
        ? null
        : r.firm07_floodplain
          ? 'yes'
          : 'no',
  },
  {
    header: 'FEMA 2015 PFIRM 1% tax-lot overlap',
    value: (r) =>
      r.pfirm15_floodplain === null || r.pfirm15_floodplain === undefined
        ? null
        : r.pfirm15_floodplain
          ? 'yes'
          : 'no',
  },
  {
    header: 'Any 1% floodplain tax-lot overlap',
    value: (r) =>
      r.floodplain_1pct === null || r.floodplain_1pct === undefined
        ? null
        : r.floodplain_1pct
          ? 'yes'
          : 'no',
  },
  { header: 'Floodplain data retrieved', value: (r) => r.floodplain_data_as_of },
  { header: 'Owner', value: (r) => r.owner_name },
  { header: 'Owner source', value: (r) => r.owner_name_source },
  { header: 'PLUTO owner type', value: (r) => r.owner_type },
  { header: 'Landmark', value: (r) => (r.is_landmark ? 'yes' : 'no') },
  { header: 'Historic district', value: (r) => (r.is_historic_district ? 'yes' : 'no') },
  { header: 'Status', value: (r) => r.redev_status },
  { header: 'Latest project type', value: (r) => r.latest_project_type },
  { header: 'Latest project filing year', value: (r) => r.latest_project_filing_year },
  { header: 'Latest project status', value: (r) => r.latest_project_status },
  { header: 'Latest project job number', value: (r) => r.latest_project_job_number },
  { header: 'PLUTO facts as of', value: (r) => r.property_facts_as_of },
  { header: 'ACRIS ownership as of', value: (r) => r.ownership_as_of },
  { header: 'DOB activity as of', value: (r) => r.project_activity_as_of },
  { header: 'Imagery observed through', value: (r) => r.observed_imagery_year },
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
 * sort). Acquisition ranks come only from the server-side eligibility gate;
 * excluded rows deliberately keep blank ranks. An empty input yields just the
 * header row.
 */
export function buildCsv(rows: ParcelIntelRow[]): string {
  const lines = [COLUMNS.map((c) => csvEscape(c.header)).join(',')];
  rows.forEach((row) => {
    lines.push(COLUMNS.map((c) => csvEscape(c.value(row))).join(','));
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
