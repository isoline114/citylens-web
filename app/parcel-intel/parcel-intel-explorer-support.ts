import type {
  ParcelIntelMapRow,
  ParcelIntelRow,
  ParcelSavedSearch,
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
  minLotAreaSqft: number | null;
  minUnusedFloorAreaSqft: number | null;
  query: string;
  ownerPortfolioId: string | null;
};

export type ParcelExplorerRow = ParcelIntelMapRow;

/**
 * Turn a parcel-ranked result set into a site-ranked decision list without
 * changing the published parcel universe. The first row is the site's
 * highest-ranked parcel because callers pass the already-sorted ranking.
 * Rows without a publisher-issued assemblage ID remain independent tax lots.
 */
export function collapseExplorerSites(
  rankedRows: ParcelExplorerRow[],
): ParcelExplorerRow[] {
  const seenSiteIds = new Set<string>();
  return rankedRows.filter((row) => {
    const siteId = row.assemblage_id?.trim();
    if (!siteId) return true;
    if (seenSiteIds.has(siteId)) return false;
    seenSiteIds.add(siteId);
    return true;
  });
}

export type ExplorerScreenRecipe = {
  id:
    | 'assemblage_scan'
    | 'transit_infill'
    | 'controlled_assemblage'
    | 'change_watch';
  label: string;
  description: string;
  priority: ExplorerPriority;
  siteType: ExplorerSiteType;
  signals: ExplorerSignal[];
  access: 'public' | 'authenticated';
};

export const EXPLORER_SCREEN_RECIPES: ExplorerScreenRecipe[] = [
  {
    id: 'assemblage_scan',
    label: 'Assemblage scan',
    description:
      'Qualified sites with two or more candidate lots on the same block.',
    priority: 'all',
    siteType: 'uncommitted',
    signals: ['assemblage'],
    access: 'public',
  },
  {
    id: 'transit_infill',
    label: 'Long-held transit screen',
    description:
      'High-priority, long-held sites whose tax-lot centroid is within 800 m of subway or SIR service.',
    priority: 'high_or_better',
    siteType: 'uncommitted',
    signals: ['transit_800m', 'long_held'],
    access: 'authenticated',
  },
  {
    id: 'controlled_assemblage',
    label: 'Owner concentration + assemblage',
    description:
      "High-priority block assemblage contexts where this parcel's exact PLUTO owner name has multiple candidate holdings.",
    priority: 'high_or_better',
    siteType: 'uncommitted',
    signals: ['assemblage', 'portfolio'],
    access: 'authenticated',
  },
  {
    id: 'change_watch',
    label: 'Recent-change watch',
    description:
      'High-priority sites with current aerial-change evidence to verify.',
    priority: 'high_or_better',
    siteType: 'uncommitted',
    signals: ['recent_change'],
    access: 'authenticated',
  },
];

export type ExplorerScreenSummary = {
  matchCount: number;
  universeCount: number;
  matchRatePct: number | null;
  medianUnusedFloorAreaSqft: number | null;
  medianLotAreaSqft: number | null;
  topBorough: string | null;
  topBoroughCount: number;
};

export type ExplorerScreenAuditCriterionId =
  | 'borough'
  | 'priority'
  | 'site_type'
  | 'owner_portfolio'
  | 'query'
  | 'min_lot_area_sqft'
  | 'min_unused_floor_area_sqft'
  | `signal:${ExplorerSignal}`;

export type ExplorerScreenAuditCriterion = {
  id: ExplorerScreenAuditCriterionId;
  label: string;
  valueLabel: string;
  relaxedMatchCount: number;
  addedIfRelaxed: number;
  coverageScopeCount: number | null;
  knownValueCount: number | null;
  missingValueCount: number | null;
  knownValueRatePct: number | null;
};

export type ExplorerScreenAudit = {
  loadedCount: number;
  matchCount: number;
  criteriaCount: number;
  criteria: ExplorerScreenAuditCriterion[];
  largestMarginalCriterion: ExplorerScreenAuditCriterion | null;
};

export type ExplorerScreenComparisonProfile = ExplorerScreenSummary & {
  lotAreaKnownCount: number;
  unusedFloorAreaKnownCount: number;
  lotAreaKnownRatePct: number | null;
  unusedFloorAreaKnownRatePct: number | null;
};

export type ExplorerScreenComparison = {
  inventoryCount: number;
  current: ExplorerScreenComparisonProfile;
  saved: ExplorerScreenComparisonProfile;
  sharedCount: number;
  currentOnlyCount: number;
  savedOnlyCount: number;
  unionCount: number;
  sharedUnionRatePct: number | null;
};

export type SavedViewMonitor = {
  status:
    | 'unavailable'
    | 'baseline_current'
    | 'unchanged'
    | 'changes'
    | 'inconsistent';
  baselineGeneration: string | null;
  currentGeneration: string | null;
  baselineCount: number | null;
  currentCount: number;
  retainedCount: number;
  enteredRows: ParcelExplorerRow[];
  exitedBbls: string[];
};

function medianPositive(values: Array<number | null | undefined>): number | null {
  const valid = values
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value > 0,
    )
    .sort((left, right) => left - right);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[middle];
  return (valid[middle - 1] + valid[middle]) / 2;
}

export function summarizeExplorerScreen(
  matches: ParcelExplorerRow[],
  universe: ParcelExplorerRow[],
): ExplorerScreenSummary {
  const boroughCounts = new Map<string, number>();
  for (const row of matches) {
    if (!row.borough) continue;
    boroughCounts.set(
      row.borough,
      (boroughCounts.get(row.borough) ?? 0) + 1,
    );
  }
  const [topBorough, topBoroughCount] = [...boroughCounts.entries()].sort(
    (left, right) =>
      right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0] ?? [null, 0];

  return {
    matchCount: matches.length,
    universeCount: universe.length,
    matchRatePct:
      universe.length > 0 ? (matches.length / universe.length) * 100 : null,
    medianUnusedFloorAreaSqft: medianPositive(
      matches.map((row) => row.unused_floor_area_sqft),
    ),
    medianLotAreaSqft: medianPositive(
      matches.map((row) => row.lot_area_sqft),
    ),
    topBorough,
    topBoroughCount,
  };
}

function compactQueryLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const compact =
    normalized.length > 30 ? `${normalized.slice(0, 27)}…` : normalized;
  return `Contains “${compact}”`;
}

function auditCriterionDefinitions(
  filters: ExplorerFilters,
): Array<{
  id: ExplorerScreenAuditCriterionId;
  label: string;
  valueLabel: string;
  relaxedFilters: ExplorerFilters;
  coverageField?: 'lot_area_sqft' | 'unused_floor_area_sqft';
}> {
  const definitions: Array<{
    id: ExplorerScreenAuditCriterionId;
    label: string;
    valueLabel: string;
    relaxedFilters: ExplorerFilters;
    coverageField?: 'lot_area_sqft' | 'unused_floor_area_sqft';
  }> = [];

  if (filters.borough !== 'all') {
    definitions.push({
      id: 'borough',
      label: 'Geography',
      valueLabel: BOROUGH_LABELS[filters.borough] ?? filters.borough,
      relaxedFilters: { ...filters, borough: 'all' },
    });
  }
  if (filters.priority !== 'all') {
    definitions.push({
      id: 'priority',
      label: 'Priority',
      valueLabel:
        filters.priority === 'highest'
          ? 'Highest tier'
          : 'High or highest tier',
      relaxedFilters: { ...filters, priority: 'all' },
    });
  }
  if (filters.siteType !== 'all') {
    definitions.push({
      id: 'site_type',
      label: 'Site type',
      valueLabel: siteTypeLabel(filters.siteType),
      relaxedFilters: { ...filters, siteType: 'all' },
    });
  }
  if (filters.ownerPortfolioId) {
    definitions.push({
      id: 'owner_portfolio',
      label: 'Legal-owner focus',
      valueLabel: 'Selected exact-name portfolio',
      relaxedFilters: { ...filters, ownerPortfolioId: null },
    });
  }
  for (const signal of filters.signals) {
    definitions.push({
      id: `signal:${signal}`,
      label: 'Required evidence',
      valueLabel: signalLabel(signal),
      relaxedFilters: {
        ...filters,
        signals: filters.signals.filter((value) => value !== signal),
      },
    });
  }
  if (filters.minLotAreaSqft !== null) {
    definitions.push({
      id: 'min_lot_area_sqft',
      label: 'PLUTO lot area',
      valueLabel: `≥ ${filters.minLotAreaSqft.toLocaleString()} sf`,
      relaxedFilters: { ...filters, minLotAreaSqft: null },
      coverageField: 'lot_area_sqft',
    });
  }
  if (filters.minUnusedFloorAreaSqft !== null) {
    definitions.push({
      id: 'min_unused_floor_area_sqft',
      label: 'Unused FAR proxy',
      valueLabel: `≥ ${filters.minUnusedFloorAreaSqft.toLocaleString()} sf`,
      relaxedFilters: { ...filters, minUnusedFloorAreaSqft: null },
      coverageField: 'unused_floor_area_sqft',
    });
  }
  if (filters.query.trim()) {
    definitions.push({
      id: 'query',
      label: 'Text search',
      valueLabel: compactQueryLabel(filters.query),
      relaxedFilters: { ...filters, query: '' },
    });
  }
  return definitions;
}

export function buildExplorerScreenAudit(
  rows: ParcelExplorerRow[],
  filters: ExplorerFilters,
): ExplorerScreenAudit {
  const matchCount = filterExplorerRows(rows, filters).length;
  const criteria = auditCriterionDefinitions(filters).map((definition) => {
    const relaxedRows = filterExplorerRows(rows, definition.relaxedFilters);
    const coverageScopeCount = definition.coverageField
      ? relaxedRows.length
      : null;
    const knownValueCount = definition.coverageField
      ? relaxedRows.filter((row) => {
          const value = row[definition.coverageField!];
          return typeof value === 'number' && Number.isFinite(value);
        }).length
      : null;
    const missingValueCount =
      coverageScopeCount !== null && knownValueCount !== null
        ? coverageScopeCount - knownValueCount
        : null;
    return {
      id: definition.id,
      label: definition.label,
      valueLabel: definition.valueLabel,
      relaxedMatchCount: relaxedRows.length,
      addedIfRelaxed: Math.max(relaxedRows.length - matchCount, 0),
      coverageScopeCount,
      knownValueCount,
      missingValueCount,
      knownValueRatePct:
        coverageScopeCount && knownValueCount !== null
          ? (knownValueCount / coverageScopeCount) * 100
          : null,
    };
  });
  const largestMarginalCriterion =
    [...criteria].sort(
      (left, right) =>
        right.addedIfRelaxed - left.addedIfRelaxed ||
        left.label.localeCompare(right.label) ||
        left.valueLabel.localeCompare(right.valueLabel),
    )[0] ?? null;

  return {
    loadedCount: rows.length,
    matchCount,
    criteriaCount: criteria.length,
    criteria,
    largestMarginalCriterion:
      largestMarginalCriterion?.addedIfRelaxed > 0
        ? largestMarginalCriterion
        : null,
  };
}

export function isScreenRecipeActive(
  filters: ExplorerFilters,
  recipe: ExplorerScreenRecipe,
): boolean {
  if (
    filters.priority !== recipe.priority ||
    filters.siteType !== recipe.siteType ||
    filters.ownerPortfolioId !== null ||
    filters.signals.length !== recipe.signals.length
  ) {
    return false;
  }
  return recipe.signals.every((signal) => filters.signals.includes(signal));
}

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
    if (
      filters.minLotAreaSqft !== null &&
      (typeof row.lot_area_sqft !== 'number' ||
        row.lot_area_sqft < filters.minLotAreaSqft)
    ) {
      return false;
    }
    if (
      filters.minUnusedFloorAreaSqft !== null &&
      (typeof row.unused_floor_area_sqft !== 'number' ||
        row.unused_floor_area_sqft < filters.minUnusedFloorAreaSqft)
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

export function explorerFiltersFromSavedSearch(
  view: Pick<ParcelSavedSearch, 'borough' | 'filters'>,
): ExplorerFilters {
  const dimensions = savedSearchDimensions(view.filters);
  return {
    borough: view.borough,
    priority: view.filters.priority,
    siteType: dimensions.siteType,
    signals: dimensions.signals,
    minLotAreaSqft: view.filters.min_lot_area_sqft ?? null,
    minUnusedFloorAreaSqft:
      view.filters.min_unused_floor_area_sqft ?? null,
    query: view.filters.query,
    ownerPortfolioId: view.filters.owner_portfolio_id,
  };
}

function screenComparisonProfile(
  matches: ParcelExplorerRow[],
  inventory: ParcelExplorerRow[],
): ExplorerScreenComparisonProfile {
  const lotAreaKnownCount = matches.filter(
    (row) =>
      typeof row.lot_area_sqft === 'number' &&
      Number.isFinite(row.lot_area_sqft),
  ).length;
  const unusedFloorAreaKnownCount = matches.filter(
    (row) =>
      typeof row.unused_floor_area_sqft === 'number' &&
      Number.isFinite(row.unused_floor_area_sqft),
  ).length;
  return {
    ...summarizeExplorerScreen(matches, inventory),
    lotAreaKnownCount,
    unusedFloorAreaKnownCount,
    lotAreaKnownRatePct:
      matches.length > 0 ? (lotAreaKnownCount / matches.length) * 100 : null,
    unusedFloorAreaKnownRatePct:
      matches.length > 0
        ? (unusedFloorAreaKnownCount / matches.length) * 100
        : null,
  };
}

export function buildExplorerScreenComparison(
  rows: ParcelExplorerRow[],
  currentFilters: ExplorerFilters,
  savedView: Pick<ParcelSavedSearch, 'borough' | 'filters'>,
): ExplorerScreenComparison {
  const currentRows = filterExplorerRows(rows, currentFilters);
  const savedRows = filterExplorerRows(
    rows,
    explorerFiltersFromSavedSearch(savedView),
  );
  const currentIds = new Set(currentRows.map((row) => row.bbl));
  const savedIds = new Set(savedRows.map((row) => row.bbl));
  const sharedCount = [...currentIds].filter((bbl) => savedIds.has(bbl)).length;
  const unionCount = new Set([...currentIds, ...savedIds]).size;

  return {
    inventoryCount: rows.length,
    current: screenComparisonProfile(currentRows, rows),
    saved: screenComparisonProfile(savedRows, rows),
    sharedCount,
    currentOnlyCount: currentIds.size - sharedCount,
    savedOnlyCount: savedIds.size - sharedCount,
    unionCount,
    sharedUnionRatePct:
      unionCount > 0 ? (sharedCount / unionCount) * 100 : null,
  };
}

export function buildSavedViewMonitor(
  rows: ParcelExplorerRow[],
  view: Pick<ParcelSavedSearch, 'borough' | 'filters' | 'snapshot'>,
  currentGeneration: string | null,
): SavedViewMonitor {
  const currentRows = sortExplorerRows(
    filterExplorerRows(rows, explorerFiltersFromSavedSearch(view)),
  );
  const snapshot = view.snapshot;
  if (!snapshot || !currentGeneration) {
    return {
      status: 'unavailable',
      baselineGeneration: snapshot?.feed_generation ?? null,
      currentGeneration,
      baselineCount: snapshot?.match_count ?? null,
      currentCount: currentRows.length,
      retainedCount: 0,
      enteredRows: [],
      exitedBbls: [],
    };
  }

  const baselineIds = new Set(snapshot.matched_bbls);
  const currentIds = new Set(currentRows.map((row) => row.bbl));
  const enteredRows = currentRows.filter((row) => !baselineIds.has(row.bbl));
  const exitedBbls = snapshot.matched_bbls.filter(
    (bbl) => !currentIds.has(bbl),
  );
  const retainedCount = currentRows.length - enteredRows.length;
  const generationChanged = snapshot.feed_generation !== currentGeneration;
  const membershipChanged =
    enteredRows.length > 0 || exitedBbls.length > 0;

  return {
    status: generationChanged
      ? membershipChanged
        ? 'changes'
        : 'unchanged'
      : membershipChanged
        ? 'inconsistent'
        : 'baseline_current',
    baselineGeneration: snapshot.feed_generation,
    currentGeneration,
    baselineCount: snapshot.match_count,
    currentCount: currentRows.length,
    retainedCount,
    enteredRows,
    exitedBbls,
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
