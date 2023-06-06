import type { ParcelIntelIndex } from '@/lib/api';

export type SourceReceipt = {
  key: string; source: string; usedFor: string; retrievedAt: string | null;
  ageDays: number | null; limitDays: number | null; status: 'Past limit' | 'Within limit' | 'Unchecked' | 'Not applicable';
};
const uses: Record<string, string> = {
  property_facts: 'Lot area and zoning', ownership: 'Recorded sales and ownership', constraints: 'Landmark and historic district screen',
  project_activity: 'Building filings and permits', land_use_activity: 'Land-use projects', property_addresses: 'Tax-lot address identity',
  tax_lien_sale_history: 'Historical lien sale diligence', current_violations: 'Violation diligence', floodplain_screen: 'Floodplain diligence',
  environmental_review: 'Environmental designation diligence', mandatory_inclusionary_housing: 'MIH diligence',
  transit_access: 'Straight-line transit proximity', owner_portfolio: 'Owner portfolio diligence', imagery: 'Model-detected change evidence',
};
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
export function receipts(index: ParcelIntelIndex | null, now: number): SourceReceipt[] {
  const sources = index?.data_sources ?? record(index?.quality_gate?.data_sources);
  return Object.entries(sources).map(([key, value]) => {
    const row = record(value);
    const retrievedAt = typeof row.retrieved_at === 'string' ? row.retrieved_at : null;
    const timestamp = retrievedAt ? Date.parse(retrievedAt) : NaN;
    const ageDays = Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 86400000) : finite(row.age_days) ? row.age_days : null;
    const limitDays = finite(row.max_age_days) ? row.max_age_days : null;
    const status = row.freshness_status === 'not_applicable' ? 'Not applicable'
      : row.stale === true || (ageDays !== null && limitDays !== null && ageDays > limitDays) ? 'Past limit'
      : ageDays !== null && limitDays !== null && retrievedAt ? 'Within limit' : 'Unchecked';
    return { key, source: typeof row.source === 'string' ? row.source : key.replaceAll('_', ' '), usedFor: uses[key] ?? key.replaceAll('_', ' '), retrievedAt, ageDays, limitDays, status };
  });
}
export function dateLabel(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
