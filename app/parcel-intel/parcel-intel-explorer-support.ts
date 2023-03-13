import type {
  ParcelIntelMapRow,
  ParcelIntelRow,
  ParcelSavedSearchFilters,
} from '@/lib/api';

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
export type ExplorerSiteType =
  | 'all'
  | 'uncommitted'
  | 'vacant_site'
  | 'ground_up_candidate'
  | 'conversion_or_overbuilt'
  | 'active_project';
export type ExplorerSignal =
  | 'assemblage'
  | 'tax_lien'
  | 'violations'
  | 'floodplain'
  | 'environmental_review'
  | 'mih'
  | 'transit_800m'
  | 'portfolio'
  | 'recent_change'
  | 'long_held';

export type ExplorerFilters = {
  borough: string;
  priority: ExplorerPriority;
  siteType: ExplorerSiteType;
  signals: ExplorerSignal[];
  query: string;
  ownerPortfolioId: string | null;
};

export type ParcelExplorerRow = ParcelIntelMapRow;

export function explorerRowColor(
  row: ParcelExplorerRow,
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

export function filterExplorerRows<T extends ParcelExplorerRow>(
  rows: T[],
  filters: ExplorerFilters,
): T[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.borough !== 'all' && row.borough !== filters.borough) return false;
    if (
      filters.ownerPortfolioId &&
      row.owner_portfolio_id !== filters.ownerPortfolioId
    ) {
      return false;
    }
    if (filters.priority === 'highest' && row.priority_tier !== 'highest') return false;
    if (
      filters.priority === 'high_or_better' &&
      row.priority_tier !== 'highest' &&
      row.priority_tier !== 'high'
    ) {
      return false;
    }
    if (filters.siteType === 'uncommitted') {
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
      filters.siteType !== 'all' &&
      row.opportunity_category !== filters.siteType
    ) return false;
    if (
      filters.signals.some((signal) => !rowMatchesSignal(row, signal))
    ) {
      return false;
    }
    if (!query) return true;
    return [
      row.address,
      row.bbl,
      row.owner_name,
      row.zoning_district_1,
      row.nearest_transit_station_name,
    ]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLowerCase().includes(query));
  });
}

export function rowMatchesSignal(
  row: ParcelExplorerRow,
  signal: ExplorerSignal,
): boolean {
  if (signal === 'assemblage') {
    return (row.assemblage_lot_count ?? 0) >= 2;
  }
  if (signal === 'tax_lien') {
    return row.tax_lien_sale_year !== null && row.tax_lien_sale_year !== undefined;
  }
  if (signal === 'violations') {
    return (row.critical_violation_count ?? 0) > 0;
  }
  if (signal === 'floodplain') {
    return row.floodplain_1pct === true;
  }
  if (signal === 'environmental_review') {
    return row.environmental_review_required === true;
  }
  if (signal === 'mih') {
    return row.mandatory_inclusionary_housing === true;
  }
  if (signal === 'transit_800m') {
    return (
      row.nearest_transit_station_distance_m !== null &&
      row.nearest_transit_station_distance_m !== undefined &&
      row.nearest_transit_station_distance_m <= 800
    );
  }
  if (signal === 'portfolio') {
    return (row.owner_portfolio_lot_count ?? 0) >= 2;
  }
  if (signal === 'recent_change') {
    return row.recent_change === true;
  }
  return row.years_held !== null && row.years_held >= 10;
}

export function siteTypeLabel(value: ExplorerSiteType): string {
  return {
    all: 'All site types',
    uncommitted: 'Qualified acquisition leads',
    vacant_site: 'Vacant sites',
    ground_up_candidate: 'Ground-up candidates',
    conversion_or_overbuilt: 'Conversion / overbuilt',
    active_project: 'Active projects',
  }[value];
}

export function signalLabel(value: ExplorerSignal): string {
  return {
    assemblage: 'Assemblage',
    tax_lien: 'Final lien-sale history',
    violations: 'Immediate-hazard violations',
    floodplain: '1% floodplain exposure',
    environmental_review: 'E/R-designated',
    mih: 'MIH mapped area',
    transit_800m: 'Transit within 800 m',
    portfolio: 'Multi-lot legal owner',
    recent_change: 'Recent aerial change',
    long_held: 'Held 10+ years',
  }[value];
}

export function savedSearchDimensions(
  filters: ParcelSavedSearchFilters,
): Pick<ExplorerFilters, 'siteType' | 'signals'> {
  const legacySiteTypes = new Set<ExplorerSiteType>([
    'uncommitted',
    'vacant_site',
    'ground_up_candidate',
    'conversion_or_overbuilt',
    'active_project',
  ]);
  const legacySignals = new Set<ExplorerSignal>([
    'assemblage',
    'tax_lien',
    'violations',
    'floodplain',
    'environmental_review',
    'mih',
    'transit_800m',
    'portfolio',
  ]);
  const legacy = filters.opportunity;
  return {
    siteType:
      filters.site_type ??
      (legacySiteTypes.has(legacy as ExplorerSiteType)
        ? (legacy as ExplorerSiteType)
        : 'all'),
    signals:
      filters.signals ??
      (legacySignals.has(legacy as ExplorerSignal)
        ? [legacy as ExplorerSignal]
        : []),
  };
}

export function sortExplorerRows<T extends ParcelExplorerRow>(rows: T[]): T[] {
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
