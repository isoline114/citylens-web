'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BellRing,
  Bookmark,
  Building2,
  CalendarClock,
  Columns3,
  Download,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MapPinned,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  advanceParcelWorkflow,
  getParcelIntelMap,
  getParcelIntelParcel,
  getParcelIntelSweep,
  getParcelWorkflowActions,
  recordParcelProductEvent,
  type ParcelIntelBorough,
  type ParcelIntelMapRow,
  type ParcelIntelRow,
  type ParcelProductEventSource,
  type ParcelSavedSearch,
  type ParcelWorkflowActions,
} from '@/lib/api';
import {
  BOROUGH_LABELS,
  BOROUGH_SHORT_LABELS,
  explorerRowColor,
  filterExplorerRows,
  opportunityLabel,
  priorityLabel,
  sortExplorerRows,
  type ExplorerFilters,
  type ExplorerOpportunity,
  type ExplorerOverlay,
  type ExplorerPriority,
} from './parcel-intel-explorer-support';
import { downloadCsv } from './[borough]/parcel-intel-csv';
import { ParcelIntelPropertyPanel } from './parcel-intel-property-panel';
import { ParcelComparisonDesk } from './parcel-comparison-desk';
import { ParcelWorkflowInsights } from './parcel-workflow-insights';
import { ParcelWorkflowAlertsPanel } from './parcel-workflow-alerts';
import { ParcelWorkflowActionsPanel } from './parcel-workflow-actions';
import { ParcelSavedViewsPanel } from './parcel-saved-views';

const ParcelIntelExplorerMap = dynamic(
  () =>
    import('./parcel-intel-explorer-map').then(
      (module) => module.ParcelIntelExplorerMap,
    ),
  { ssr: false, loading: () => <ExplorerMapSkeleton /> },
);

const DEFAULT_FILTERS: ExplorerFilters = {
  borough: 'all',
  priority: 'all',
  opportunity: 'uncommitted',
  query: '',
  ownerPortfolioId: null,
};

const INITIAL_LEAD_LIMIT = 30;
const MOBILE_COMPACT_LEAD_LIMIT = 10;
const LEAD_PAGE_SIZE = 30;
const MAX_COMPARISON_PARCELS = 3;
const WORKFLOW_BOROUGHS = [
  'manhattan',
  'brooklyn',
  'queens',
  'bronx',
  'staten_island',
] as const;
type WorkflowBorough = (typeof WORKFLOW_BOROUGHS)[number];

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type DetailState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  boroughs: ParcelIntelBorough[];
  initialBorough?: string | null;
  initialBbl?: string | null;
};

function isWorkflowBorough(value: string | null | undefined): value is WorkflowBorough {
  return WORKFLOW_BOROUGHS.some((borough) => borough === value);
}

function ExplorerMapSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-[560px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
      role="status"
      aria-label="Loading citywide parcel map"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(14,165,233,0.16),transparent_36%),radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.14),transparent_34%)]" />
      <div className="relative flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading citywide map…
      </div>
    </div>
  );
}

export function ParcelIntelExplorer({
  boroughs,
  initialBorough = null,
  initialBbl = null,
}: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ParcelIntelMapRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [failedBoroughs, setFailedBoroughs] = useState<string[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ParcelIntelRow | null>(
    null,
  );
  const [detailState, setDetailState] = useState<DetailState>('idle');
  const [exporting, setExporting] = useState(false);
  const fullInventoryLoaded = useRef(false);
  const [filters, setFilters] = useState<ExplorerFilters>(() => ({
    ...DEFAULT_FILTERS,
    borough: boroughs.some((borough) => borough.slug === initialBorough)
      ? (initialBorough as string)
      : 'all',
  }));
  // The public preview contains only the top slice from each borough, so most
  // rows share the same priority tier. Borough colors make that first view
  // immediately legible; users can still switch to priority or opportunity.
  const [overlay, setOverlay] = useState<ExplorerOverlay>('borough');
  const [selectedBbl, setSelectedBbl] = useState<string | null>(initialBbl);
  const [leadLimit, setLeadLimit] = useState(INITIAL_LEAD_LIMIT);
  const [mobileRankingExpanded, setMobileRankingExpanded] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [comparisonRows, setComparisonRows] = useState<ParcelIntelRow[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [workflowActions, setWorkflowActions] =
    useState<ParcelWorkflowActions | null>(null);
  const parcelOpenSourceRef = useRef<ParcelProductEventSource>('direct');
  const trackedParcelOpensRef = useRef(new Set<string>());
  const comparisonOpenTrackedRef = useRef(false);
  const comparisonDialogRef = useRef<HTMLDivElement>(null);
  const comparisonReturnFocusRef = useRef<HTMLElement | null>(null);
  const wasAuthenticatedRef = useRef(false);

  const isAuthenticated = auth.status === 'authenticated';
  const totalAvailable = boroughs.reduce((sum, borough) => sum + borough.count, 0);

  const loadLegacySweeps = async (
    includeAuth: boolean,
  ): Promise<{
    rows: ParcelIntelMapRow[];
    failures: string[];
    generatedAt: string | null;
  }> => {
    const results = await Promise.allSettled(
      boroughs.map(async (borough) => {
        const sweep = await getParcelIntelSweep(borough.slug, 1000, {
          includeAuth,
        });
        return {
          rows: sweep.rows.map((row) => ({
            ...row,
            borough: borough.slug,
          })),
          generatedAt: sweep.generated_at,
        };
      }),
    );
    const legacyRows: ParcelIntelMapRow[] = [];
    const failures: string[] = [];
    let generatedAt: string | null = null;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        legacyRows.push(...result.value.rows);
        generatedAt ??= result.value.generatedAt;
      } else {
        failures.push(boroughs[index]?.slug ?? `borough-${index + 1}`);
      }
    });
    return { rows: legacyRows, failures, generatedAt };
  };

  const loadExplorerRows = async (
    includeAuth: boolean,
  ): Promise<{
    rows: ParcelIntelMapRow[];
    failures: string[];
    generatedAt: string | null;
  }> => {
    try {
      const response = await getParcelIntelMap(1000, { includeAuth });
      return {
        rows: response.rows,
        failures: [],
        generatedAt: response.generated_at,
      };
    } catch {
      // Backwards-compatible during the coordinated engine/web rollout.
      return loadLegacySweeps(includeAuth);
    }
  };

  // Render the public citywide preview immediately; auth initialization no
  // longer holds the map behind a full-page skeleton.
  useEffect(() => {
    if (boroughs.length === 0) return;
    let cancelled = false;
    setLoadState('loading');
    setFailedBoroughs([]);
    void loadExplorerRows(false).then((result) => {
      if (cancelled || fullInventoryLoaded.current) return;
      const unique = new Map(result.rows.map((row) => [row.bbl, row]));
      setRows([...unique.values()]);
      setFailedBoroughs(result.failures);
      setLoadState(unique.size > 0 ? 'ready' : 'error');
    });
    return () => {
      cancelled = true;
    };
    // Borough metadata changes only when the page is regenerated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boroughs]);

  // Authenticated users upgrade the already-visible preview to the compact
  // 5,000-row inventory in one request. Signing out immediately downgrades
  // the in-memory inventory so premium owner data never lingers in the UI.
  useEffect(() => {
    if (auth.status === 'loading' || boroughs.length === 0) return;
    const includeAuth = auth.status === 'authenticated';
    if (!includeAuth && !fullInventoryLoaded.current) return;
    let cancelled = false;
    void loadExplorerRows(includeAuth).then((result) => {
      if (cancelled) return;
      fullInventoryLoaded.current = includeAuth;
      const unique = new Map(result.rows.map((row) => [row.bbl, row]));
      setRows([...unique.values()]);
      setFailedBoroughs(result.failures);
      setLoadState(unique.size > 0 ? 'ready' : 'error');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, boroughs]);

  // A signed-out browser must not retain authenticated parcel detail in the
  // comparison workspace. Public-preview comparisons remain available.
  useEffect(() => {
    if (auth.status === 'authenticated') {
      wasAuthenticatedRef.current = true;
      return;
    }
    if (wasAuthenticatedRef.current) {
      wasAuthenticatedRef.current = false;
      setComparisonRows([]);
      setComparisonOpen(false);
      comparisonOpenTrackedRef.current = false;
    }
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setWorkflowActions(null);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void getParcelWorkflowActions()
        .then((next) => {
          if (!cancelled) setWorkflowActions(next);
        })
        .catch(() => {
          // The queue panel owns the visible retry state. A failed background
          // badge refresh must not block the map or sign the user out.
        });
    };
    refresh();
    window.addEventListener('citylens:workflow-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('citylens:workflow-updated', refresh);
    };
  }, [auth.status]);

  useEffect(() => {
    if (!comparisonOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [comparisonOpen]);

  const filtered = useMemo(
    () => filterExplorerRows(rows, filters),
    [rows, filters],
  );
  const opportunityScope = useMemo(
    () => filterExplorerRows(rows, { ...filters, opportunity: 'all' }),
    [rows, filters],
  );
  const ranked = useMemo(() => sortExplorerRows(filtered), [filtered]);
  const selectedSummary = useMemo(
    () => rows.find((row) => row.bbl === selectedBbl) ?? null,
    [rows, selectedBbl],
  );

  useEffect(() => {
    if (!selectedBbl || !selectedSummary) {
      setSelectedDetail(null);
      setDetailState('idle');
      return;
    }
    let cancelled = false;
    setSelectedDetail(null);
    setDetailState('loading');
    void getParcelIntelParcel(selectedBbl, {
      includeAuth: isAuthenticated,
    })
      .then((detail) => {
        if (cancelled) return;
        setSelectedDetail({ ...detail, borough: selectedSummary.borough });
        setDetailState('ready');
        if (
          isAuthenticated &&
          !trackedParcelOpensRef.current.has(selectedBbl)
        ) {
          trackedParcelOpensRef.current.add(selectedBbl);
          void recordParcelProductEvent(
            'parcel_opened',
            parcelOpenSourceRef.current,
          ).catch(() => {
            // Adoption telemetry is best-effort and never blocks diligence.
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDetailState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedBbl, selectedSummary]);
  const assemblageCount = opportunityScope.filter(
    (row) => (row.assemblage_lot_count ?? 0) >= 2,
  ).length;
  const taxLienCount = opportunityScope.filter(
    (row) => row.tax_lien_sale_year !== null && row.tax_lien_sale_year !== undefined,
  ).length;
  const criticalViolationParcelCount = opportunityScope.filter(
    (row) => (row.critical_violation_count ?? 0) > 0,
  ).length;
  const floodplainParcelCount = opportunityScope.filter(
    (row) => row.floodplain_1pct === true,
  ).length;
  const environmentalReviewParcelCount = opportunityScope.filter(
    (row) => row.environmental_review_required === true,
  ).length;
  const mihParcelCount = opportunityScope.filter(
    (row) => row.mandatory_inclusionary_housing === true,
  ).length;
  const transit800mParcelCount = opportunityScope.filter(
    (row) =>
      row.nearest_transit_station_distance_m !== null &&
      row.nearest_transit_station_distance_m !== undefined &&
      row.nearest_transit_station_distance_m <= 800,
  ).length;
  const ownerPortfolioParcelCount = opportunityScope.filter(
    (row) => (row.owner_portfolio_lot_count ?? 0) >= 2,
  ).length;
  const uncommittedCount = opportunityScope.filter(
    (row) =>
      row.acquisition_eligible ??
      [
        'vacant_site',
        'ground_up_candidate',
        'conversion_or_overbuilt',
      ].includes(row.opportunity_category ?? ''),
  ).length;
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== DEFAULT_FILTERS[key as keyof ExplorerFilters],
  );

  const syncExplorerUrl = (borough: string, bbl: string | null) => {
    const params = new URLSearchParams();
    if (borough !== 'all') params.set('borough', borough);
    if (bbl) params.set('bbl', bbl);
    const query = params.toString();
    router.replace(query ? `/parcel-intel?${query}` : '/parcel-intel', {
      scroll: false,
    });
  };

  const updateFilter = <K extends keyof ExplorerFilters>(
    key: K,
    value: ExplorerFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ownerPortfolioId:
        key === 'opportunity' && value !== 'portfolio'
          ? null
          : current.ownerPortfolioId,
    }));
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    const nextBorough = key === 'borough' ? String(value) : filters.borough;
    if (selectedBbl) {
      setSelectedBbl(null);
    }
    if (key === 'borough' || selectedBbl) syncExplorerUrl(nextBorough, null);
  };

  const selectParcel = (
    bbl: string,
    source: ParcelProductEventSource = 'ranking',
  ) => {
    parcelOpenSourceRef.current = source;
    setSelectedBbl(bbl);
    syncExplorerUrl(filters.borough, bbl);
  };

  const closeParcel = () => {
    setSelectedBbl(null);
    syncExplorerUrl(filters.borough, null);
  };

  const trackComparisonOpen = () => {
    if (
      auth.status !== 'authenticated' ||
      comparisonOpenTrackedRef.current
    ) {
      return;
    }
    comparisonOpenTrackedRef.current = true;
    void recordParcelProductEvent(
      'comparison_opened',
      'comparison',
    ).catch(() => {
      // Comparison remains available if coarse, value-minimized adoption
      // telemetry is unavailable.
    });
  };

  const openComparison = () => {
    if (comparisonRows.length < 2) return;
    comparisonReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setComparisonOpen(true);
    trackComparisonOpen();
  };

  const closeComparison = () => {
    setComparisonOpen(false);
    window.setTimeout(() => comparisonReturnFocusRef.current?.focus(), 0);
  };

  const toggleComparison = (row: ParcelIntelRow) => {
    const alreadyIncluded = comparisonRows.some(
      (candidate) => candidate.bbl === row.bbl,
    );
    if (alreadyIncluded) {
      const next = comparisonRows.filter(
        (candidate) => candidate.bbl !== row.bbl,
      );
      setComparisonRows(next);
      if (next.length < 2) setComparisonOpen(false);
      return;
    }
    if (comparisonRows.length >= MAX_COMPARISON_PARCELS) return;
    const next = [...comparisonRows, row];
    setComparisonRows(next);
    if (next.length >= 2) {
      comparisonReturnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setComparisonOpen(true);
      trackComparisonOpen();
    }
  };

  const removeComparison = (bbl: string) => {
    const next = comparisonRows.filter((row) => row.bbl !== bbl);
    setComparisonRows(next);
    if (next.length < 2) closeComparison();
  };

  const clearComparison = () => {
    setComparisonRows([]);
    setComparisonOpen(false);
  };

  const advanceComparisonParcel = async (
    row: ParcelIntelRow,
    input: { nextAction: string; dueDate: string | null },
  ) => {
    if (auth.status !== 'authenticated' || !isWorkflowBorough(row.borough)) {
      throw new Error('Authenticated workflow context is unavailable');
    }
    const result = await advanceParcelWorkflow(row.bbl, {
      borough: row.borough,
      next_action: input.nextAction,
      next_action_due_date: input.dueDate,
    });
    window.dispatchEvent(new Event('citylens:workflow-updated'));
    return result.status;
  };

  const focusOwnerPortfolio = (ownerPortfolioId: string) => {
    setFilters({
      ...DEFAULT_FILTERS,
      borough: 'all',
      opportunity: 'portfolio',
      ownerPortfolioId,
    });
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setSelectedBbl(null);
    syncExplorerUrl('all', null);
  };

  const clearOwnerPortfolioFocus = () => {
    setFilters((current) => ({ ...current, ownerPortfolioId: null }));
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
  };

  const exportFilteredRows = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const targets =
        filters.borough === 'all'
          ? boroughs
          : boroughs.filter((borough) => borough.slug === filters.borough);
      const results = await Promise.all(
        targets.map(async (borough) => {
          const sweep = await getParcelIntelSweep(borough.slug, 1000, {
            includeAuth: isAuthenticated,
          });
          return sweep.rows.map((row) => ({
            ...row,
            borough: borough.slug,
          }));
        }),
      );
      const exportRows = sortExplorerRows(
        filterExplorerRows(results.flat(), filters),
      );
      downloadCsv(
        exportRows,
        filters.borough === 'all' ? 'citywide' : filters.borough,
      );
    } finally {
      setExporting(false);
    }
  };

  const resetExplorer = () => {
    setFilters(DEFAULT_FILTERS);
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setSelectedBbl(null);
    syncExplorerUrl('all', null);
  };

  const openActionQueue = () => {
    setActionsOpen(true);
    setAlertsOpen(false);
    setInsightsOpen(false);
    setSavedViewsOpen(false);
  };

  const applySavedView = (view: ParcelSavedSearch) => {
    setFilters({
      borough: view.borough,
      priority: view.filters.priority,
      opportunity: view.filters.opportunity,
      query: view.filters.query,
      ownerPortfolioId: view.filters.owner_portfolio_id,
    });
    setOverlay(view.filters.overlay);
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setSelectedBbl(null);
    setSavedViewsOpen(false);
    syncExplorerUrl(view.borough, null);
    void recordParcelProductEvent(
      'saved_view_applied',
      'saved_views',
    ).catch(() => {
      // Applying a private saved view must remain usable when coarse,
      // value-minimized adoption telemetry is unavailable.
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_-42px_rgba(15,23,42,0.42)]">
      <div className="relative overflow-hidden bg-slate-950 px-4 py-4 text-white md:px-6 md:py-5">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
              <MapPinned className="h-4 w-4" />
              Citywide opportunity explorer
            </div>
            <p className="mt-1 hidden max-w-2xl text-xs leading-5 text-slate-300 sm:block md:text-sm">
              Filter the five-borough market, compare signals, and open a parcel&apos;s
              evidence workspace.
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-slate-300 sm:hidden">
            <span>
              <strong className="text-sm text-white">{boroughs.length}</strong>{' '}
              boroughs
            </span>
            <span>
              <strong className="text-sm text-white">
                {loadState === 'ready'
                  ? filtered.length.toLocaleString()
                  : '…'}
              </strong>{' '}
              {isAuthenticated ? 'visible' : 'preview'}
            </span>
            <span>
              <strong className="text-sm text-white">
                {totalAvailable.toLocaleString()}
              </strong>{' '}
              {isAuthenticated ? 'available' : 'with account'}
            </span>
          </div>
          <div className="hidden grid-cols-3 gap-2 sm:grid lg:min-w-[430px]">
            {[
              ['Boroughs', boroughs.length.toString()],
              [
                'Visible now',
                loadState === 'ready' ? filtered.length.toLocaleString() : 'Loading…',
              ],
              ['Available', totalAvailable.toLocaleString()],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur"
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-white md:text-base">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full grid-cols-3 self-start rounded-xl border border-white/10 bg-white/5 p-1 sm:inline-flex sm:w-auto">
            {(['priority', 'opportunity', 'borough'] as ExplorerOverlay[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOverlay(value)}
                  aria-pressed={overlay === value}
                  className={`inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-medium capitalize transition-colors sm:gap-1.5 sm:px-3.5 sm:text-xs ${
                    overlay === value
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Layers3 className="h-3.5 w-3.5" />
                  {value}
                </button>
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-300">
            <span className="hidden items-center gap-2 sm:inline-flex">
              {auth.status === 'loading' ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : isAuthenticated ? (
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
              )}
              <span>
                {isAuthenticated
                  ? `Full workspace coverage · ${totalAvailable.toLocaleString()} available`
                  : `Preview coverage · sign in to load all ${totalAvailable.toLocaleString()}`}
              </span>
            </span>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setSavedViewsOpen((value) => !value);
                  setActionsOpen(false);
                  setAlertsOpen(false);
                  setInsightsOpen(false);
                }}
                aria-expanded={savedViewsOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
              >
                <Bookmark className="h-3.5 w-3.5 text-amber-300" />
                Saved views
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  if (actionsOpen) {
                    setActionsOpen(false);
                  } else {
                    openActionQueue();
                  }
                }}
                aria-expanded={actionsOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
              >
                <CalendarClock className="h-3.5 w-3.5 text-violet-300" />
                Action queue
                {workflowActions && workflowActions.attention_count > 0 && (
                  <span
                    className="rounded-full bg-violet-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950"
                    aria-label={`${workflowActions.attention_count} workflow items need attention`}
                  >
                    {workflowActions.attention_count}
                  </span>
                )}
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen((value) => !value);
                  setInsightsOpen(false);
                  setActionsOpen(false);
                  setSavedViewsOpen(false);
                }}
                aria-expanded={alertsOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
              >
                <BellRing className="h-3.5 w-3.5 text-sky-300" />
                Watchlist changes
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setInsightsOpen((value) => !value);
                  setAlertsOpen(false);
                  setActionsOpen(false);
                  setSavedViewsOpen(false);
                }}
                aria-expanded={insightsOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                Outcome insights
              </button>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && insightsOpen && (
        <ParcelWorkflowInsights onClose={() => setInsightsOpen(false)} />
      )}
      {isAuthenticated && savedViewsOpen && (
        <ParcelSavedViewsPanel
          currentView={{
            borough: filters.borough,
            filters,
            overlay,
          }}
          onApply={applySavedView}
          onClose={() => setSavedViewsOpen(false)}
        />
      )}
      {isAuthenticated && actionsOpen && (
        <ParcelWorkflowActionsPanel
          onClose={() => setActionsOpen(false)}
          onDataChange={setWorkflowActions}
          onSelectParcel={(bbl) => {
            setActionsOpen(false);
            selectParcel(bbl, 'action_queue');
          }}
        />
      )}
      {isAuthenticated && alertsOpen && (
        <ParcelWorkflowAlertsPanel
          onClose={() => setAlertsOpen(false)}
          onSelectParcel={(bbl) => {
            setAlertsOpen(false);
            selectParcel(bbl, 'watchlist');
          }}
        />
      )}

      {isAuthenticated &&
        workflowActions &&
        !actionsOpen &&
        !alertsOpen &&
        !insightsOpen &&
        !savedViewsOpen &&
        (workflowActions.open_records === 0 ||
          workflowActions.attention_count > 0) && (
          <section
            className="border-b border-sky-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-5 py-4 md:px-7"
            aria-label="Acquisition workflow next step"
            data-testid={
              workflowActions.open_records === 0
                ? 'activation-guide-empty'
                : 'activation-guide-attention'
            }
          >
            {workflowActions.open_records === 0 ? (
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
                    <Sparkles className="h-4 w-4" />
                    Build your first evidence-backed shortlist
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">
                    Compare before you commit team time.
                  </h3>
                  <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                    {[
                      'Open a current lead',
                      'Add a second parcel to Compare',
                      'Save only the one worth next diligence',
                    ].map((step, index) => (
                      <li key={step} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-800">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <button
                  type="button"
                  disabled={ranked.length === 0}
                  onClick={() => {
                    const topLead = ranked[0];
                    if (topLead) selectParcel(topLead.bbl, 'ranking');
                  }}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open the first lead
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-800">
                    <CalendarClock className="h-4 w-4" />
                    Resume your acquisition work
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-950">
                      {workflowActions.attention_count} saved lead
                      {workflowActions.attention_count === 1 ? '' : 's'}
                    </span>{' '}
                    need a plan, assignee, due date, or outcome update.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openActionQueue}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-4 text-xs font-semibold text-white shadow-sm hover:bg-violet-800"
                >
                  Review {workflowActions.attention_count}{' '}
                  {workflowActions.attention_count === 1 ? 'action' : 'actions'}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>
        )}

      {!isAuthenticated && auth.status !== 'loading' && (
        <div className="hidden items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:flex md:px-7">
          <span className="leading-5">
            <strong>Try the public decision flow:</strong> open a parcel, add it
            to Compare, then choose a second. A free account unlocks the
            broader inventory and private workflow.
          </span>
          <Link
            href="/sign-in?next=%2Fparcel-intel"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-medium text-white hover:bg-slate-800"
          >
            Sign in for the full workspace
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3.5 md:px-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,0.7fr))_auto]">
          <label className="relative col-span-2 md:col-span-1">
            <span className="sr-only">Search parcels</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={filters.query}
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Address, BBL, owner, or zoning"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label>
            <span className="sr-only">Filter by borough</span>
            <select
              value={filters.borough}
              onChange={(event) => updateFilter('borough', event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            >
              <option value="all">All boroughs</option>
              {boroughs.map((borough) => (
                <option key={borough.slug} value={borough.slug}>
                  {borough.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by priority</span>
            <select
              value={filters.priority}
              onChange={(event) =>
                updateFilter('priority', event.target.value as ExplorerPriority)
              }
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            >
              <option value="all">All priorities</option>
              <option value="highest">Highest only</option>
              <option value="high_or_better">High or better</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by opportunity</span>
            <select
              value={filters.opportunity}
              onChange={(event) =>
                updateFilter(
                  'opportunity',
                  event.target.value as ExplorerOpportunity,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            >
              <option value="all">All opportunities</option>
              <option value="uncommitted">Qualified acquisition leads</option>
              {isAuthenticated && (
                <option value="tax_lien">Final lien-sale history</option>
              )}
              {isAuthenticated && (
                <option value="violations">Immediate-hazard violations</option>
              )}
              {isAuthenticated && (
                <option value="floodplain">1% floodplain exposure</option>
              )}
              {isAuthenticated && (
                <option value="environmental_review">
                  E/R-designated lots
                </option>
              )}
              {isAuthenticated && (
                <option value="mih">MIH mapped-area overlap</option>
              )}
              {isAuthenticated && (
                <option value="transit_800m">Subway/SIR within 800 m</option>
              )}
              {isAuthenticated && (
                <option value="portfolio">Multi-lot legal owners</option>
              )}
              <option value="assemblage">Assemblage opportunities</option>
              <option value="vacant_site">Vacant sites</option>
              <option value="ground_up_candidate">Ground-up candidates</option>
              <option value="conversion_or_overbuilt">Conversion / overbuilt</option>
              <option value="active_project">Active projects</option>
            </select>
          </label>
          <div className="flex gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={resetExplorer}
                className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            <button
              type="button"
              disabled={ranked.length === 0 || exporting}
              onClick={() => void exportFilteredRows()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Export ${ranked.length.toLocaleString()} filtered parcels`}
            >
              {exporting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exporting ? 'Preparing…' : 'CSV'}
            </button>
          </div>
        </div>
      </div>

      {failedBoroughs.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900">
          Could not load {failedBoroughs.map((slug) => BOROUGH_LABELS[slug] ?? slug).join(', ')}.
          The remaining boroughs are still available.
        </div>
      )}

      <div className="grid min-h-[740px] gap-0 lg:h-[760px] lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="min-h-[560px] p-3 md:p-4 lg:h-[760px]">
          {loadState === 'idle' || loadState === 'loading' ? (
            <ExplorerMapSkeleton />
          ) : loadState === 'error' ? (
            <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
              <div>
                <MapPinned className="mx-auto h-8 w-8 text-rose-500" />
                <h3 className="mt-3 font-semibold text-rose-950">The explorer could not load</h3>
                <p className="mt-1 max-w-sm text-sm text-rose-800">
                  The parcel feed may be temporarily unavailable. Refresh the page or try
                  again in a few minutes.
                </p>
              </div>
            </div>
          ) : (
            <ParcelIntelExplorerMap
              rows={filtered}
              selectedBbl={selectedBbl}
              selectedRow={selectedDetail}
              overlay={overlay}
              onSelect={(bbl) => selectParcel(bbl, 'map')}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-slate-200 bg-white lg:h-[760px] lg:border-l lg:border-t-0">
          {selectedDetail ? (
            <ParcelIntelPropertyPanel
              key={selectedDetail.bbl}
              row={selectedDetail}
              onClose={closeParcel}
              onViewOwnerPortfolio={focusOwnerPortfolio}
              isCompared={comparisonRows.some(
                (row) => row.bbl === selectedDetail.bbl,
              )}
              compareLimitReached={
                comparisonRows.length >= MAX_COMPARISON_PARCELS &&
                !comparisonRows.some(
                  (row) => row.bbl === selectedDetail.bbl,
                )
              }
              onToggleCompare={() => toggleComparison(selectedDetail)}
            />
          ) : selectedSummary && detailState === 'loading' ? (
            <div
              className="flex h-full flex-col items-center justify-center p-6 text-center"
              role="status"
            >
              <LoaderCircle className="h-6 w-6 animate-spin text-sky-600" />
              <h3 className="mt-3 text-sm font-semibold text-slate-950">
                Loading parcel diligence
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Fetching geometry, ownership, project history, and model evidence.
              </p>
            </div>
          ) : selectedSummary && detailState === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <TriangleAlert className="h-7 w-7 text-amber-500" />
              <h3 className="mt-3 text-sm font-semibold text-slate-950">
                Parcel detail is temporarily unavailable
              </h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">
                The ranked map is still available. Close this panel and try the
                parcel again in a moment.
              </p>
              <button
                type="button"
                onClick={closeParcel}
                className="mt-4 text-xs font-medium text-sky-700 hover:text-sky-900"
              >
                Back to ranked parcels
              </button>
            </div>
          ) : selectedBbl && loadState === 'ready' ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">
                Parcel not included in this access tier
              </h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">
                BBL {selectedBbl} is not in the current preview. Sign in to load the
                broader five-borough dataset.
              </p>
              {!isAuthenticated && (
                <Link
                  href={`/sign-in?next=${encodeURIComponent(
                    `/parcel-intel?bbl=${selectedBbl}`,
                  )}`}
                  className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-950 px-4 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Sign in to continue
                </Link>
              )}
              <button
                type="button"
                onClick={closeParcel}
                className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Back to ranked parcels
              </button>
            </div>
          ) : (
            <>
          {filters.ownerPortfolioId && (
            <div className="flex items-center justify-between gap-3 border-b border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-950">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-indigo-700" />
                <span>
                  Showing current candidate holdings with the same exact
                  normalized PLUTO legal name.
                </span>
              </div>
              <button
                type="button"
                onClick={clearOwnerPortfolioFocus}
                className="shrink-0 font-semibold text-indigo-800 hover:text-indigo-950"
              >
                Show all portfolios
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3">
            <button
              type="button"
              onClick={() => updateFilter('opportunity', 'uncommitted')}
              aria-pressed={filters.opportunity === 'uncommitted'}
              className={`rounded-xl px-3 py-2 text-left transition-colors ${
                filters.opportunity === 'uncommitted'
                  ? 'bg-emerald-100 ring-2 ring-inset ring-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wide text-emerald-700">
                Qualified leads
              </div>
              <div className="text-lg font-semibold text-emerald-950">
                {uncommittedCount.toLocaleString()}
              </div>
            </button>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => updateFilter('opportunity', 'portfolio')}
                aria-pressed={filters.opportunity === 'portfolio'}
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'portfolio'
                    ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400'
                    : 'bg-indigo-50 hover:bg-indigo-100'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-indigo-700">
                  <Building2 className="h-3 w-3" />
                  Multi-lot owners
                </div>
                <div className="text-lg font-semibold text-indigo-950">
                  {ownerPortfolioParcelCount.toLocaleString()}
                </div>
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => updateFilter('opportunity', 'tax_lien')}
                aria-pressed={filters.opportunity === 'tax_lien'}
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'tax_lien'
                    ? 'bg-amber-100 ring-2 ring-inset ring-amber-400'
                    : 'bg-amber-50 hover:bg-amber-100'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-amber-700">
                  Lien-sale records
                </div>
                <div className="text-lg font-semibold text-amber-950">
                  {taxLienCount.toLocaleString()}
                </div>
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => updateFilter('opportunity', 'violations')}
                aria-pressed={filters.opportunity === 'violations'}
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'violations'
                    ? 'bg-rose-100 ring-2 ring-inset ring-rose-400'
                    : 'bg-rose-50 hover:bg-rose-100'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-rose-700">
                  Immediate hazards
                </div>
                <div className="text-lg font-semibold text-rose-950">
                  {criticalViolationParcelCount.toLocaleString()}
                </div>
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => updateFilter('opportunity', 'floodplain')}
                aria-pressed={filters.opportunity === 'floodplain'}
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'floodplain'
                    ? 'bg-sky-100 ring-2 ring-inset ring-sky-400'
                    : 'bg-sky-50 hover:bg-sky-100'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-sky-700">
                  1% floodplain
                </div>
                <div className="text-lg font-semibold text-sky-950">
                  {floodplainParcelCount.toLocaleString()}
                </div>
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() =>
                  updateFilter('opportunity', 'environmental_review')
                }
                aria-pressed={
                  filters.opportunity === 'environmental_review'
                }
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'environmental_review'
                    ? 'bg-orange-100 ring-2 ring-inset ring-orange-400'
                    : 'bg-orange-50 hover:bg-orange-100'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-orange-700">
                  E/R-designated lots
                </div>
                <div className="text-lg font-semibold text-orange-950">
                  {environmentalReviewParcelCount.toLocaleString()}
                </div>
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => updateFilter('opportunity', 'mih')}
                aria-pressed={filters.opportunity === 'mih'}
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'mih'
                    ? 'bg-fuchsia-100 ring-2 ring-inset ring-fuchsia-400'
                    : 'bg-fuchsia-50 hover:bg-fuchsia-100'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-fuchsia-700">
                  MIH mapped areas
                </div>
                <div className="text-lg font-semibold text-fuchsia-950">
                  {mihParcelCount.toLocaleString()}
                </div>
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => updateFilter('opportunity', 'transit_800m')}
                aria-pressed={filters.opportunity === 'transit_800m'}
                className={`rounded-xl px-3 py-2 text-left transition-colors ${
                  filters.opportunity === 'transit_800m'
                    ? 'bg-cyan-100 ring-2 ring-inset ring-cyan-400'
                    : 'bg-cyan-50 hover:bg-cyan-100'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-cyan-800">
                  <MapPinned className="h-3 w-3" />
                  Subway/SIR ≤800 m
                </div>
                <div className="text-lg font-semibold text-cyan-950">
                  {transit800mParcelCount.toLocaleString()}
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={() => updateFilter('opportunity', 'assemblage')}
              aria-pressed={filters.opportunity === 'assemblage'}
              className={`rounded-xl px-3 py-2 text-left transition-colors ${
                filters.opportunity === 'assemblage'
                  ? 'bg-violet-100 ring-2 ring-inset ring-violet-400'
                  : 'bg-violet-50 hover:bg-violet-100'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wide text-violet-700">
                Assemblages
              </div>
              <div className="text-lg font-semibold text-violet-950">
                {assemblageCount.toLocaleString()}
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Acquisition ranking</h3>
              <p className="text-xs text-slate-500">
                Current-project screened and ranked for pursuit
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {ranked.length.toLocaleString()}
            </span>
          </div>
          <div
            id="parcel-acquisition-ranking"
            className="min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-[560px]"
          >
            {ranked.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No parcels match these filters.
              </div>
            ) : (
              ranked.slice(0, leadLimit).map((row, index) => (
                <button
                  key={row.bbl}
                  type="button"
                  onClick={() => selectParcel(row.bbl, 'ranking')}
                  className={`mb-1 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    !mobileRankingExpanded && index >= MOBILE_COMPACT_LEAD_LIMIT
                      ? 'hidden sm:block'
                      : ''
                  } ${
                    selectedBbl === row.bbl
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: explorerRowColor(row, overlay) }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-950">
                          {row.address ?? row.bbl}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} ·{' '}
                          {opportunityLabel(row.opportunity_category)}
                        </div>
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                      title={`${BOROUGH_LABELS[row.borough ?? ''] ?? 'Borough'} priority rank`}
                    >
                      {filters.borough === 'all' && row.citywide_rank
                        ? `NYC #${row.citywide_rank}`
                        : row.priority_rank
                          ? `${BOROUGH_SHORT_LABELS[row.borough ?? ''] ?? 'BR'} #${row.priority_rank}`
                        : priorityLabel(row.priority_tier)}
                    </span>
                  </div>
                </button>
              ))
            )}
            {ranked.length > MOBILE_COMPACT_LEAD_LIMIT && (
              <div className="mt-1 grid gap-2 sm:hidden">
                <button
                  type="button"
                  aria-controls="parcel-acquisition-ranking"
                  aria-expanded={mobileRankingExpanded}
                  onClick={() =>
                    setMobileRankingExpanded((current) => !current)
                  }
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                >
                  {mobileRankingExpanded
                    ? 'Show fewer ranked leads'
                    : `Show more ranked leads · ${(
                        ranked.length - MOBILE_COMPACT_LEAD_LIMIT
                      ).toLocaleString()} remaining`}
                </button>
                {mobileRankingExpanded && ranked.length > leadLimit && (
                  <button
                    type="button"
                    onClick={() =>
                      setLeadLimit((current) => current + LEAD_PAGE_SIZE)
                    }
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                  >
                    Load {Math.min(LEAD_PAGE_SIZE, ranked.length - leadLimit)} more
                    · {(ranked.length - leadLimit).toLocaleString()} remaining
                  </button>
                )}
              </div>
            )}
            {ranked.length > leadLimit && (
              <button
                type="button"
                onClick={() =>
                  setLeadLimit((current) => current + LEAD_PAGE_SIZE)
                }
                className="mt-1 hidden h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 sm:inline-flex"
              >
                Show {Math.min(LEAD_PAGE_SIZE, ranked.length - leadLimit)} more ·{' '}
                {(ranked.length - leadLimit).toLocaleString()} remaining
              </button>
            )}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Map scores are ordinal screening signals. Verify current records before
            acquisition diligence.
          </div>
            </>
          )}
        </aside>
      </div>

      <div className="grid gap-2 border-t border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => updateFilter('borough', 'all')}
          aria-pressed={filters.borough === 'all'}
          className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${
            filters.borough === 'all'
              ? 'border-sky-300 bg-sky-50 text-sky-950 shadow-sm'
              : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm'
          }`}
        >
          <span>
            <span className="font-semibold">All NYC</span>
            <span className="ml-1 opacity-70">{totalAvailable.toLocaleString()}</span>
          </span>
          <MapPinned className="h-3.5 w-3.5 text-sky-600" />
        </button>
        {boroughs.map((borough) => (
          <button
            key={borough.slug}
            type="button"
            onClick={() => updateFilter('borough', borough.slug)}
            aria-pressed={filters.borough === borough.slug}
            className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${
              filters.borough === borough.slug
                ? 'border-sky-300 bg-sky-50 text-sky-950 shadow-sm'
                : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm'
            }`}
          >
            <span>
              <span className="font-semibold">{borough.display_name}</span>
              <span className="ml-1 opacity-70">{borough.count.toLocaleString()}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600" />
          </button>
        ))}
      </div>

      {comparisonRows.length > 0 && !comparisonOpen && (
        <section
          className="fixed bottom-4 left-1/2 z-[1100] flex w-[min(94vw,920px)] -translate-x-1/2 flex-col gap-3 rounded-2xl border border-white/15 bg-slate-950 px-4 py-3 text-white shadow-2xl shadow-slate-950/35 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Parcel comparison tray"
          data-testid="parcel-comparison-tray"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <Columns3 className="h-4 w-4" />
              Compare shortlist · {comparisonRows.length}/
              {MAX_COMPARISON_PARCELS}
            </div>
            <div className="mt-2 flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
              {comparisonRows.map((row) => (
                <button
                  key={row.bbl}
                  type="button"
                  onClick={() => removeComparison(row.bbl)}
                  className="inline-flex max-w-56 shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/15"
                  aria-label={`Remove ${row.address ?? row.bbl} from comparison`}
                >
                  <span className="truncate">{row.address ?? row.bbl}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearComparison}
              className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={openComparison}
              disabled={comparisonRows.length < 2}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Columns3 className="h-3.5 w-3.5" />
              {comparisonRows.length < 2 ? 'Add one more' : 'Compare now'}
            </button>
          </div>
        </section>
      )}

      {comparisonOpen && comparisonRows.length >= 2 && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeComparison();
            }
          }}
        >
          <div
            ref={comparisonDialogRef}
            className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Compare shortlisted parcels"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeComparison();
                return;
              }
              if (event.key !== 'Tab') return;
              const focusable = comparisonDialogRef.current?.querySelectorAll<
                HTMLElement
              >(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
              );
              if (!focusable?.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (
                !event.shiftKey &&
                document.activeElement === last
              ) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <ParcelComparisonDesk
              rows={comparisonRows}
              signedIn={isAuthenticated}
              onClose={closeComparison}
              onRemove={removeComparison}
              onAdvance={advanceComparisonParcel}
              onSelectParcel={(bbl) => {
                setComparisonOpen(false);
                selectParcel(bbl, 'comparison');
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
