import type { ParcelIntelRow } from '@/lib/api';

export const BOROUGH_LABELS: Record<string, string> = {
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  bronx: 'Bronx',
  staten_island: 'Staten Island',
};

export const BOROUGH_SHORT_LABELS: Record<string, string> = {
  manhattan: 'MN',
  brooklyn: 'BK',
  queens: 'QN',
  bronx: 'BX',
  staten_island: 'SI',
};

export const BOROUGH_COLORS: Record<string, string> = {
  manhattan: '#0284c7',
  brooklyn: '#059669',
  queens: '#d97706',
  bronx: '#e11d48',
  staten_island: '#7c3aed',
};

export const PRIORITY_COLORS: Record<string, string> = {
  highest: '#dc2626',
  high: '#f59e0b',
  medium: '#0ea5e9',
  watch: '#64748b',
};

export const OPPORTUNITY_COLORS: Record<string, string> = {
  vacant_site: '#16a34a',
  ground_up_candidate: '#0ea5e9',
  conversion_or_overbuilt: '#7c3aed',
  active_project: '#f97316',
  completed_project: '#64748b',
};

export type ExplorerOverlay = 'priority' | 'opportunity' | 'borough';
export type ExplorerPriority = 'all' | 'highest' | 'high_or_better';
export type ExplorerOpportunity =
  | 'all'
  | 'uncommitted'
  | 'vacant_site'
  | 'ground_up_candidate'
  | 'conversion_or_overbuilt'
  | 'active_project';

export type ExplorerFilters = {
  borough: string;
  priority: ExplorerPriority;
  opportunity: ExplorerOpportunity;
  query: string;
};

export function explorerRowColor(
  row: ParcelIntelRow,
  overlay: ExplorerOverlay,
): string {
  if (overlay === 'borough') {
    return BOROUGH_COLORS[row.borough ?? ''] ?? '#64748b';
  }
  if (overlay === 'opportunity') {
    return OPPORTUNITY_COLORS[row.opportunity_category ?? ''] ?? '#64748b';
  }
  return PRIORITY_COLORS[row.priority_tier ?? 'watch'] ?? PRIORITY_COLORS.watch;
}

export function filterExplorerRows(
  rows: ParcelIntelRow[],
  filters: ExplorerFilters,
): ParcelIntelRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.borough !== 'all' && row.borough !== filters.borough) return false;
    if (filters.priority === 'highest' && row.priority_tier !== 'highest') return false;
    if (
      filters.priority === 'high_or_better' &&
      row.priority_tier !== 'highest' &&
      row.priority_tier !== 'high'
    ) {
      return false;
    }
    if (filters.opportunity === 'uncommitted') {
      const eligible =
        row.acquisition_eligible ??
        [
          'vacant_site',
          'ground_up_candidate',
          'conversion_or_overbuilt',
        ].includes(row.opportunity_category ?? '');
      if (!eligible) {
        return false;
      }
    } else if (
      filters.opportunity !== 'all' &&
      row.opportunity_category !== filters.opportunity
    ) return false;
    if (!query) return true;
    return [row.address, row.bbl, row.owner_name, row.zoning_district_1]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLowerCase().includes(query));
  });
}

export function sortExplorerRows(rows: ParcelIntelRow[]): ParcelIntelRow[] {
  return [...rows].sort((a, b) => {
    const rankDelta =
      (a.citywide_rank ??
        a.acquisition_rank ??
        a.priority_rank ??
        Number.MAX_SAFE_INTEGER) -
      (b.citywide_rank ??
        b.acquisition_rank ??
        b.priority_rank ??
        Number.MAX_SAFE_INTEGER);
    if (rankDelta !== 0) return rankDelta;
    return (b.score_calibrated ?? -1) - (a.score_calibrated ?? -1);
  });
}

export function opportunityLabel(
  value: ParcelIntelRow['opportunity_category'],
): string {
  return {
    vacant_site: 'Vacant site',
    ground_up_candidate: 'Ground-up candidate',
    conversion_or_overbuilt: 'Conversion / overbuilt',
    active_project: 'Active project',
    completed_project: 'Completed project',
  }[value ?? 'ground_up_candidate'];
}

export function priorityLabel(value: ParcelIntelRow['priority_tier']): string {
  return {
    highest: 'Highest',
    high: 'High',
    medium: 'Medium',
    watch: 'Watch',
  }[value ?? 'watch'];
}
