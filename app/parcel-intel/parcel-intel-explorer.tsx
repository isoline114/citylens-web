'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './parcel-explorer-layout.css';
import {
  ArrowUpRight,
  BellRing,
  Bookmark,
  Building2,
  CalendarClock,
  CheckCircle2,
  Columns3,
  Download,
  Filter,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Ruler,
  Search,
  Target,
  TrendingUp,
  TriangleAlert,
  X,
} from 'lucide-react';
import { formatBbl, parcelLabel } from '@/lib/parcel-format';
import { useAuth } from '@/lib/auth';
import { CITYLENS_DATA_ACCESS_READY_EVENT } from '@/lib/auth/dataAccessEvents';
import {
  advanceParcelWorkflow,
  ApiError,
  getParcelIntelMap,
  getParcelIntelParcel,
  getParcelIntelSweep,
  getParcelWorkflowActions,
  listParcelSavedSearches,
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
  EXPLORER_SCREEN_RECIPES,
  buildExplorerScreenAudit,
  collapseExplorerSites,
  filterExplorerRows,
  isScreenRecipeActive,
  opportunityLabel,
  rowMatchesSignal,
  savedSearchDimensions,
  signalLabel,
  sortExplorerRows,
  summarizeExplorerScreen,
  type ExplorerFilters,
  type ExplorerOverlay,
  type ExplorerPriority,
  type ExplorerScreenAuditCriterionId,
  type ExplorerScreenRecipe,
  type ExplorerSignal,
  type ExplorerSiteType,
} from './parcel-intel-explorer-support';
import { downloadCsv } from './[borough]/parcel-intel-csv';
import {
  checkParcelExportIntegrity,
  type ParcelExportIntegrityFailure,
} from './parcel-export-integrity';
import { ParcelIntelPropertyPanel } from './parcel-intel-property-panel';
import { ParcelAddressResolver } from './parcel-address-resolver';
import { ParcelOfficialDossierPanel } from './parcel-official-dossier';
import { ParcelComparisonDesk } from './parcel-comparison-desk';
import { ParcelWorkflowInsights } from './parcel-workflow-insights';
import { ParcelWorkflowAlertsPanel } from './parcel-workflow-alerts';
import { ParcelWorkflowActionsPanel } from './parcel-workflow-actions';
import { ParcelSavedViewsPanel } from './parcel-saved-views';
import { ParcelLeadReviewWorkspace } from './parcel-lead-review-workspace';
import { ParcelScreenAudit } from './parcel-screen-audit';
import { ParcelThesisComposer } from './parcel-thesis-composer';
import {
  canonicalParcelBbl,
  ParcelScreeningLookup,
} from './parcel-screening-lookup';
import {
  findParcelDecisionPeers,
  type ParcelDecisionPeer,
} from './parcel-decision-peers';

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
  siteType: 'uncommitted',
  signals: [],
  minLotAreaSqft: null,
  minUnusedFloorAreaSqft: null,
  query: '',
  ownerPortfolioId: null,
};

const EXPLORER_SIGNALS: ExplorerSignal[] = [
  'assemblage',
  'long_held',
  'recent_change',
  'transit_800m',
  'portfolio',
  'tax_lien',
  'violations',
  'floodplain',
  'environmental_review',
  'mih',
];

const LOT_AREA_THRESHOLDS_SQFT = [2_500, 5_000, 10_000, 20_000, 50_000];
const UNUSED_FAR_THRESHOLDS_SQFT = [
  5_000,
  10_000,
  25_000,
  50_000,
  100_000,
];

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
type InventoryState = 'preview' | 'upgrading' | 'full' | 'incomplete';
type InventoryIssue = 'auth' | 'response' | 'network' | null;
type ExportNotice = {
  kind: 'success' | 'error';
  message: string;
};

type ExplorerLoadResult = {
  rows: ParcelIntelMapRow[];
  failures: string[];
  generatedAt: string | null;
  feedGeneration: string | null;
  fullInventoryVerified: boolean;
  issue: InventoryIssue;
};

type Props = {
  sourceReceipt?: ReactNode;
  boroughs: ParcelIntelBorough[];
  initialBorough?: string | null;
  initialBbl?: string | null;
};

type ToolPanelKey = 'actions' | 'alerts' | 'insights' | 'reviews' | 'saved';

function isWorkflowBorough(value: string | null | undefined): value is WorkflowBorough {
  return WORKFLOW_BOROUGHS.some((borough) => borough === value);
}

function formatCompactSqft(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M sf`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1_000).toLocaleString()}k sf`;
  }
  return `${Math.round(value).toLocaleString()} sf`;
}

function formatExportSnapshot(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)} UTC`;
}

function exportIntegrityMessage(reason: ParcelExportIntegrityFailure): string {
  if (reason === 'generation_changed') {
    return 'A newer parcel snapshot became available while this map was open. Refresh the workspace before exporting.';
  }
  if (reason === 'mixed_generation') {
    return 'The borough feeds are updating at different times. Export is paused until one consistent snapshot is available.';
  }
  if (reason === 'generation_missing') {
    return 'This map has no verifiable snapshot receipt. Refresh the workspace before exporting.';
  }
  return 'The export scope did not exactly match the visible acquisition ranking. Refresh the workspace and try again.';
}

const AUTHENTICATED_INVENTORY_RETRY_DELAYS_MS = [
  1_000,
  3_000,
  8_000,
  30_000,
] as const;

function ExplorerMapSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-[320px] items-center justify-center overflow-hidden bg-paper-2"
      role="status"
      aria-label="Loading citywide parcel map"
    >
      <div className="relative flex items-center gap-2 rounded-sm border border-rule bg-white px-4 py-2 text-sm font-medium text-ink">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading citywide map…
      </div>
    </div>
  );
}

export function ParcelIntelExplorer({
  boroughs,
  sourceReceipt,
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
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const fullInventoryLoaded = useRef(false);
  const [fullInventoryReady, setFullInventoryReady] = useState(false);
  const [inventoryState, setInventoryState] =
    useState<InventoryState>('preview');
  const [inventoryIssue, setInventoryIssue] =
    useState<InventoryIssue>(null);
  const [inventoryFeedGeneration, setInventoryFeedGeneration] =
    useState<string | null>(null);
  const [inventoryGeneratedAt, setInventoryGeneratedAt] =
    useState<string | null>(null);
  const [inventoryReloadKey, setInventoryReloadKey] = useState(0);
  const automaticInventoryRetryCount = useRef(0);
  const [filters, setFilters] = useState<ExplorerFilters>(() => ({
    ...DEFAULT_FILTERS,
    borough: boroughs.some((borough) => borough.slug === initialBorough)
      ? (initialBorough as string)
      : 'all',
  }));
  const [overlay, setOverlay] = useState<ExplorerOverlay>('priority');
  const [selectedBbl, setSelectedBbl] = useState<string | null>(initialBbl);
  const [mobilePane, setMobilePane] = useState<'results' | 'map' | 'details'>(initialBbl ? 'details' : 'map');
  const activeMobilePane = mobilePane === 'details' && !selectedBbl ? 'results' : mobilePane;
  const parcelReturnPaneRef = useRef<'results' | 'map'>('map');
  const panesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panes = panesRef.current;
    if (!panes) return;
    const resize = () => {
      const top = panes.getBoundingClientRect().top + window.scrollY;
      panes.style.setProperty('--parcel-pane-height', `${Math.max(440, window.innerHeight - top - 4)}px`);
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (panes.parentElement) observer?.observe(panes.parentElement);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  const [viewportBbls, setViewportBbls] = useState<string[] | null>(null);
  const [rankMapView, setRankMapView] = useState(false);
  const [leadLimit, setLeadLimit] = useState(INITIAL_LEAD_LIMIT);
  const [mobileRankingExpanded, setMobileRankingExpanded] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [leadReviewsOpen, setLeadReviewsOpen] = useState(false);
  const [savedViewsEntry, setSavedViewsEntry] = useState<
    'browse' | 'create'
  >('browse');
  const [signalFiltersOpen, setSignalFiltersOpen] = useState(false);
  const [siteCriteriaOpen, setSiteCriteriaOpen] = useState(false);
  const [mobileMarketFiltersOpen, setMobileMarketFiltersOpen] = useState(false);
  const [mobileWorkspaceToolsOpen, setMobileWorkspaceToolsOpen] =
    useState(false);
  const [comparisonRows, setComparisonRows] = useState<ParcelIntelRow[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [workflowActions, setWorkflowActions] =
    useState<ParcelWorkflowActions | null>(null);
  const [savedViewCount, setSavedViewCount] = useState<number | null>(null);
  const parcelOpenSourceRef = useRef<ParcelProductEventSource>('direct');
  const screenAuditOpenTrackedRef = useRef(false);
  const savedViewComparisonOpenTrackedRef = useRef(false);
  const savedThesisChangesTrackedRef = useRef(new Set<string>());
  const marketExplorerOpenTrackedRef = useRef(false);
  const trackedParcelOpensRef = useRef(new Set<string>());
  const comparisonOpenTrackedRef = useRef(false);
  const comparisonDialogRef = useRef<HTMLDivElement>(null);
  const comparisonReturnFocusRef = useRef<HTMLElement | null>(null);
  const parcelReturnFocusRef = useRef<HTMLElement | null>(null);
  const parcelReturnBblRef = useRef<string | null>(initialBbl);
  const toolPanelReturnFocusRef = useRef<HTMLElement | null>(null);
  const wasAuthenticatedRef = useRef(false);
  const selectedBblRef = useRef<string | null>(selectedBbl);

  const isAuthenticated = auth.status === 'authenticated';
  const totalAvailable = boroughs.reduce((sum, borough) => sum + borough.count, 0);

  const loadLegacySweeps = async (
    includeAuth: boolean,
  ): Promise<ExplorerLoadResult> => {
    const results = await Promise.allSettled(
      boroughs.map(async (borough) => {
        const sweep = await getParcelIntelSweep(borough.slug, 5000, {
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
    const uniqueCount = new Set(legacyRows.map((row) => row.bbl)).size;
    return {
      rows: legacyRows,
      failures,
      generatedAt,
      feedGeneration: null,
      fullInventoryVerified:
        includeAuth &&
        failures.length === 0 &&
        uniqueCount >= totalAvailable,
      issue:
        includeAuth && failures.length > 0
          ? 'network'
          : includeAuth && uniqueCount < totalAvailable
            ? 'response'
            : null,
    };
  };

  const loadExplorerRows = async (
    includeAuth: boolean,
  ): Promise<ExplorerLoadResult> => {
    if (includeAuth) {
      try {
        // A visible Neon session and a usable CityLens API credential are two
        // different facts. Validate a fresh credential before requesting the
        // private inventory so an old/null client token cannot silently leave
        // a signed-in user looking at the 125-row public preview.
        const credential = await auth.getAccessToken({ forceRefresh: true });
        if (!credential) {
          return {
            rows: [],
            failures: [],
            generatedAt: null,
            feedGeneration: null,
            fullInventoryVerified: false,
            issue: 'auth',
          };
        }
      } catch {
        return {
          rows: [],
          failures: [],
          generatedAt: null,
          feedGeneration: null,
          fullInventoryVerified: false,
          issue: 'auth',
        };
      }
    }

    try {
      const response = await getParcelIntelMap(1000, { includeAuth });
      const hasInventoryReceipt =
        typeof response.returned_count === 'number' &&
        typeof response.available_count === 'number' &&
        typeof response.inventory_complete === 'boolean' &&
        typeof response.access_scope === 'string';
      const uniqueMapCount = new Set(
        response.rows.map((row) => row.bbl),
      ).size;
      const receiptMatchesRows =
        response.returned_count === response.rows.length &&
        uniqueMapCount === response.rows.length &&
        response.available_count === response.returned_count;
      const receiptCoversPublishedInventory =
        uniqueMapCount >= totalAvailable &&
        response.returned_count >= totalAvailable &&
        response.available_count >= totalAvailable;
      const fullInventoryVerified =
        includeAuth &&
        (hasInventoryReceipt
          ? response.access_scope === 'authenticated_full' &&
            response.inventory_complete === true &&
            receiptMatchesRows &&
            receiptCoversPublishedInventory
          : response.rows.length >= totalAvailable);
      const mapResult: ExplorerLoadResult = {
        rows: response.rows,
        failures: [],
        generatedAt: response.generated_at,
        feedGeneration: response.feed_generation ?? null,
        fullInventoryVerified,
        issue:
          includeAuth && !fullInventoryVerified
            ? response.access_scope === 'public_preview'
              ? 'auth'
              : 'response'
            : null,
      };

      if (!includeAuth || fullInventoryVerified) return mapResult;

      // During a rolling engine/web deploy—or if an intermediary incorrectly
      // reuses a public response—never accept 125 preview rows as the signed-in
      // inventory. The authenticated borough feeds provide a recovery path.
      const legacyResult = await loadLegacySweeps(true);
      if (legacyResult.fullInventoryVerified) return legacyResult;

      // A signed-in workspace must never render the public 125-row preview as
      // though it were the user's parcel inventory. Preserve the failure
      // receipt, but withhold preview rows until the authenticated 5,000-row
      // inventory can be verified.
      return {
        ...mapResult,
        rows: [],
        failures: legacyResult.failures,
        issue: mapResult.issue ?? legacyResult.issue ?? 'response',
      };
    } catch (error) {
      // Backwards-compatible during the coordinated engine/web rollout.
      const legacy = await loadLegacySweeps(includeAuth);
      const fullInventoryVerified =
        includeAuth && legacy.fullInventoryVerified;
      return {
        ...legacy,
        rows:
          includeAuth && !fullInventoryVerified
            ? []
            : legacy.rows,
        fullInventoryVerified,
        issue:
          includeAuth && error instanceof ApiError && error.status === 401
            ? 'auth'
            : legacy.issue ?? 'network',
      };
    }
  };

  // Resolve the browser session before choosing an inventory tier. Starting
  // the public 125-row request and the authenticated 5,000-row request
  // together created a visible preview flash and allowed a late public
  // response to compete with the verified inventory in real browsers.
  // Authenticated sessions now issue only the private request. Signed-out
  // sessions issue only the public request. If credential recovery fails,
  // load the public rows afterwards and label them as incomplete.
  useEffect(() => {
    if (auth.status === 'loading' || boroughs.length === 0) return;
    const includeAuth = auth.status === 'authenticated';
    const hadFullInventory = fullInventoryLoaded.current;
    if (!includeAuth) {
      automaticInventoryRetryCount.current = 0;
      fullInventoryLoaded.current = false;
      if (hadFullInventory) {
        // Never leave private fields in memory while the public request is in
        // flight after sign-out.
        setRows([]);
        setLoadState('loading');
      }
    } else if (!fullInventoryLoaded.current && rows.length > 0) {
      // A session can become authenticated while the public explorer is
      // already open. Remove that preview before requesting private data so
      // the signed-in state never appears to contain only 125 leads.
      setRows([]);
      setLoadState('loading');
    }
    let cancelled = false;
    if (rows.length === 0) setLoadState('loading');
    setFailedBoroughs([]);
    setFullInventoryReady(false);
    setInventoryState(includeAuth ? 'upgrading' : 'preview');
    setInventoryIssue(null);
    void (async () => {
      const result = await loadExplorerRows(includeAuth);
      if (cancelled) return;
      const unique = new Map(result.rows.map((row) => [row.bbl, row]));
      const fullInventoryVerified =
        includeAuth &&
        result.fullInventoryVerified &&
        unique.size > 0 &&
        result.failures.length === 0;
      fullInventoryLoaded.current = fullInventoryVerified;
      if (fullInventoryVerified) {
        automaticInventoryRetryCount.current = 0;
      }
      setRows((current) => {
        if (includeAuth && !fullInventoryVerified) return [];
        return unique.size > 0 ? [...unique.values()] : current;
      });
      // A legacy sweep recovery has no immutable generation receipt. Clear
      // any earlier public-preview value instead of letting saved views bind
      // a full inventory to an unverified generation.
      setInventoryFeedGeneration(result.feedGeneration);
      setInventoryGeneratedAt(result.generatedAt);
      setFailedBoroughs(result.failures);
      setLoadState((current) =>
        unique.size > 0 ? 'ready' : current === 'ready' ? current : 'error',
      );
      setFullInventoryReady(fullInventoryVerified);
      setInventoryIssue(includeAuth && !fullInventoryVerified ? result.issue : null);
      setInventoryState(
        includeAuth
          ? fullInventoryVerified
            ? 'full'
            : 'incomplete'
          : 'preview',
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, boroughs, inventoryReloadKey]);

  // A browser can learn that a Neon session exists a moment before the
  // same-origin auth endpoint can mint its API JWT. Without another auth
  // state transition, that race used to strand the signed-in workspace on
  // the 125-row public preview until a manual refresh. Retry a bounded number
  // of times, and retry again when the user returns online or refocuses the
  // tab. Permanent auth failures still settle into the explicit reconnect UI.
  useEffect(() => {
    if (
      auth.status !== 'authenticated' ||
      inventoryState !== 'incomplete' ||
      fullInventoryReady
    ) {
      return;
    }

    const attempt = automaticInventoryRetryCount.current;
    const delay = AUTHENTICATED_INVENTORY_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) return;

    const timeout = window.setTimeout(() => {
      automaticInventoryRetryCount.current += 1;
      setInventoryReloadKey((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [auth.status, fullInventoryReady, inventoryState]);

  // Count only a verified authenticated market activation. This event carries
  // no inventory size, filters, geography, parcel identifiers, or account
  // values; the server stores one bounded aggregate daily counter. Public
  // previews and failed/incomplete upgrades never enter the funnel.
  useEffect(() => {
    if (
      !isAuthenticated ||
      inventoryState !== 'full' ||
      !fullInventoryReady ||
      marketExplorerOpenTrackedRef.current
    ) {
      return;
    }
    marketExplorerOpenTrackedRef.current = true;
    void recordParcelProductEvent(
      'market_explorer_opened',
      'full_inventory',
    ).catch(() => {
      // Adoption telemetry is best-effort and never blocks the market.
    });
  }, [fullInventoryReady, inventoryState, isAuthenticated]);

  useEffect(() => {
    if (
      auth.status !== 'authenticated' ||
      inventoryState !== 'incomplete'
    ) {
      return;
    }
    const retryIncompleteInventory = () => {
      if (fullInventoryLoaded.current) return;
      automaticInventoryRetryCount.current = 0;
      setInventoryReloadKey((value) => value + 1);
    };
    window.addEventListener('focus', retryIncompleteInventory);
    window.addEventListener('online', retryIncompleteInventory);
    window.addEventListener(
      CITYLENS_DATA_ACCESS_READY_EVENT,
      retryIncompleteInventory,
    );
    return () => {
      window.removeEventListener('focus', retryIncompleteInventory);
      window.removeEventListener('online', retryIncompleteInventory);
      window.removeEventListener(
        CITYLENS_DATA_ACCESS_READY_EVENT,
        retryIncompleteInventory,
      );
    };
  }, [auth.status, inventoryState]);

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
      savedViewComparisonOpenTrackedRef.current = false;
      savedThesisChangesTrackedRef.current.clear();
      setFilters((current) => ({
        ...current,
        signals: current.signals.filter(
          (signal) => signal === 'assemblage',
        ),
        ownerPortfolioId: null,
      }));
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
    if (auth.status !== 'authenticated') {
      setSavedViewCount(null);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void listParcelSavedSearches()
        .then((views) => {
          if (!cancelled) setSavedViewCount(views.length);
        })
        .catch(() => {
          // Saved-view discovery should not block the inventory. Leaving this
          // unknown also prevents false first-session onboarding.
        });
    };
    refresh();
    window.addEventListener('citylens:saved-views-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('citylens:saved-views-updated', refresh);
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
  const signalScope = useMemo(
    () => filterExplorerRows(rows, { ...filters, signals: [] }),
    [rows, filters],
  );
  const ranked = useMemo(() => sortExplorerRows(filtered), [filtered]);
  const viewportBblSet = useMemo(
    () => new Set(viewportBbls ?? []),
    [viewportBbls],
  );
  const rankedInViewport = useMemo(
    () => ranked.filter((row) => viewportBblSet.has(row.bbl)),
    [ranked, viewportBblSet],
  );
  const rankedSites = useMemo(() => collapseExplorerSites(ranked), [ranked]);
  const rankedSitesInViewport = useMemo(
    () => collapseExplorerSites(rankedInViewport),
    [rankedInViewport],
  );
  const rankingParcels = rankMapView ? rankedInViewport : ranked;
  const rankingRows = rankMapView ? rankedSitesInViewport : rankedSites;
  const handleViewportRowsChange = useCallback((bbls: string[]) => {
    setViewportBbls((current) => current?.length === bbls.length && current.every((bbl, index) => bbl === bbls[index]) ? current : bbls);
  }, []);
  useEffect(() => {
    setExportNotice(null);
  }, [filters, rankMapView, viewportBbls]);
  const queryMatchesFullInventory = useMemo(() => {
    const query = filters.query.trim();
    if (!query) return true;
    return (
      filterExplorerRows(rows, {
        ...DEFAULT_FILTERS,
        siteType: 'all',
        query,
      }).length > 0
    );
  }, [filters.query, rows]);
  const screeningLookupBbl = useMemo(() => {
    const queried = canonicalParcelBbl(filters.query);
    if (queried && !rows.some((row) => row.bbl === queried)) {
      return queried;
    }
    return selectedBbl &&
      !rows.some((row) => row.bbl === selectedBbl)
      ? selectedBbl
      : null;
  }, [filters.query, rows, selectedBbl]);
  const addressResolverQuery = useMemo(() => {
    const query = filters.query.trim();
    if (
      query.length < 5 ||
      canonicalParcelBbl(query) !== null ||
      queryMatchesFullInventory
    ) {
      return null;
    }
    return query;
  }, [filters.query, queryMatchesFullInventory]);
  const selectedSummary = useMemo(
    () => rows.find((row) => row.bbl === selectedBbl) ?? null,
    [rows, selectedBbl],
  );
  const decisionPeers: ParcelDecisionPeer[] = useMemo(
    () =>
      selectedDetail
        ? findParcelDecisionPeers(selectedDetail, rows, 3)
        : [],
    [rows, selectedDetail],
  );

  useEffect(() => {
    selectedBblRef.current = selectedBbl;
  }, [selectedBbl]);

  // Key the detail fetch on the parcel's identity, not the summary object:
  // inventory updates (for example after saving a lead) recreate `rows`, and
  // refetching would unmount the open property panel and drop its state.
  const selectedSummaryBorough = selectedSummary?.borough ?? null;
  const hasSelectedSummary = selectedSummary !== null;
  useEffect(() => {
    if (!selectedBbl || !hasSelectedSummary) {
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
        setSelectedDetail({ ...detail, borough: selectedSummaryBorough });
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
  }, [hasSelectedSummary, isAuthenticated, selectedBbl, selectedSummaryBorough]);
  const signalCounts = useMemo(
    () =>
      Object.fromEntries(
        EXPLORER_SIGNALS.map((signal) => [
          signal,
          signalScope.filter((row) => rowMatchesSignal(row, signal)).length,
        ]),
      ) as Record<ExplorerSignal, number>,
    [signalScope],
  );
  const screenSummary = useMemo(
    () => summarizeExplorerScreen(filtered, signalScope),
    [filtered, signalScope],
  );
  const screenAudit = useMemo(
    () => buildExplorerScreenAudit(rows, filters),
    [rows, filters],
  );
  const visibleSignals = isAuthenticated
    ? EXPLORER_SIGNALS
    : EXPLORER_SIGNALS.filter((signal) => signal === 'assemblage');
  const visibleScreenRecipes = EXPLORER_SCREEN_RECIPES.filter(
    (recipe) => recipe.access === 'public' || isAuthenticated,
  );
  const screenRecipeCounts = useMemo(
    () =>
      Object.fromEntries(
        EXPLORER_SCREEN_RECIPES.map((recipe) => [
          recipe.id,
          filterExplorerRows(rows, {
            borough: filters.borough,
            priority: recipe.priority,
            siteType: recipe.siteType,
            signals: recipe.signals,
            minLotAreaSqft: filters.minLotAreaSqft,
            minUnusedFloorAreaSqft: filters.minUnusedFloorAreaSqft,
            query: filters.query,
            ownerPortfolioId: null,
          }).length,
        ]),
      ) as Record<ExplorerScreenRecipe['id'], number>,
    [
      filters.borough,
      filters.minLotAreaSqft,
      filters.minUnusedFloorAreaSqft,
      filters.query,
      rows,
    ],
  );
  const activeScreenRecipe =
    EXPLORER_SCREEN_RECIPES.find((recipe) =>
      isScreenRecipeActive(filters, recipe),
    ) ?? null;
  const activeSiteCriteriaCount =
    Number(filters.minLotAreaSqft !== null) +
    Number(filters.minUnusedFloorAreaSqft !== null);
  const activeMarketFilterCount =
    Number(filters.borough !== DEFAULT_FILTERS.borough) +
    Number(filters.priority !== DEFAULT_FILTERS.priority) +
    Number(filters.siteType !== DEFAULT_FILTERS.siteType);
  const hasFilters =
    filters.borough !== DEFAULT_FILTERS.borough ||
    filters.priority !== DEFAULT_FILTERS.priority ||
    filters.siteType !== DEFAULT_FILTERS.siteType ||
    filters.signals.length > 0 ||
    filters.minLotAreaSqft !== null ||
    filters.minUnusedFloorAreaSqft !== null ||
    filters.query !== DEFAULT_FILTERS.query ||
    filters.ownerPortfolioId !== null;
  const [screenAnnouncement, setScreenAnnouncement] = useState('');

  const inventoryAnnouncement =
    auth.status === 'loading'
      ? 'Checking parcel workspace access.'
      : inventoryState === 'upgrading'
        ? `Loading the full parcel inventory. ${totalAvailable.toLocaleString()} parcels expected.`
        : inventoryState === 'full'
          ? `Full parcel inventory loaded and verified. ${rows.length.toLocaleString()} parcels available.`
          : inventoryState === 'incomplete'
            ? `Parcel inventory is incomplete. ${rows.length.toLocaleString()} of ${totalAvailable.toLocaleString()} parcels loaded.`
            : loadState === 'ready'
              ? `Public parcel preview loaded. ${rows.length.toLocaleString()} of ${totalAvailable.toLocaleString()} parcels available.`
              : 'Loading the public parcel preview.';

  const workspaceAnnouncement = comparisonOpen
    ? ''
    : selectedDetail
      ? `Parcel workspace opened for ${parcelLabel(selectedDetail.address, selectedDetail.bbl)}.`
      : selectedSummary && detailState === 'loading'
        ? `Loading parcel workspace for ${parcelLabel(selectedSummary.address, selectedSummary.bbl)}.`
        : selectedSummary && detailState === 'error'
          ? `Parcel workspace could not load for ${parcelLabel(selectedSummary.address, selectedSummary.bbl)}.`
          : '';

  const comparisonAnnouncement =
    comparisonRows.length === 0
      ? ''
      : comparisonOpen
        ? `Comparison workspace opened with ${comparisonRows.length} parcels.`
        : `Comparison shortlist contains ${comparisonRows.length} of ${MAX_COMPARISON_PARCELS} parcels.`;

  useEffect(() => {
    if (loadState !== 'ready') return;
    const boroughLabel =
      filters.borough === 'all'
        ? 'all five boroughs'
        : BOROUGH_LABELS[filters.borough] ?? filters.borough;
    const timeout = window.setTimeout(() => {
      setScreenAnnouncement(
        rankMapView
          ? `${rankingRows.length.toLocaleString()} acquisition ${
              rankingRows.length === 1 ? 'site' : 'sites'
            } across ${rankingParcels.length.toLocaleString()} ${
              rankingParcels.length === 1 ? 'parcel' : 'parcels'
            } ${rankingRows.length === 1 ? 'is' : 'are'} inside the current map view; ${rankedSites.length.toLocaleString()} ${
              rankedSites.length === 1 ? 'site' : 'sites'
            } across ${ranked.length.toLocaleString()} ${
              ranked.length === 1 ? 'parcel' : 'parcels'
            } ${rankedSites.length === 1 ? 'matches' : 'match'} the full screen in ${boroughLabel}.`
          : `${rankedSites.length.toLocaleString()} acquisition ${
              rankedSites.length === 1 ? 'site' : 'sites'
            } across ${ranked.length.toLocaleString()} ${
              ranked.length === 1 ? 'parcel' : 'parcels'
            } ${rankedSites.length === 1 ? 'matches' : 'match'} the current screen in ${boroughLabel}.`,
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    filters,
    loadState,
    ranked.length,
    rankedSites.length,
    rankingParcels.length,
    rankingRows.length,
    rankMapView,
  ]);

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
        key === 'signals' &&
        !(value as ExplorerSignal[]).includes('portfolio')
          ? null
          : current.ownerPortfolioId,
    }));
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    const nextBorough = key === 'borough' ? String(value) : filters.borough;
    if (selectedBbl) {
      setSelectedBbl(null);
      setMobilePane('results');
    }
    if (key === 'borough' || selectedBbl) syncExplorerUrl(nextBorough, null);
  };

  const toggleSignal = (signal: ExplorerSignal) => {
    const nextSignals = filters.signals.includes(signal)
      ? filters.signals.filter((value) => value !== signal)
      : [...filters.signals, signal];
    updateFilter('signals', nextSignals);
  };

  const relaxScreenCriterion = (
    criterionId: ExplorerScreenAuditCriterionId,
  ) => {
    if (isAuthenticated) {
      void recordParcelProductEvent(
        'screen_criterion_relaxed',
        'screen_audit',
      ).catch(() => {
        // Screen relaxation remains local when coarse telemetry is unavailable.
      });
    }
    if (criterionId.startsWith('signal:')) {
      toggleSignal(criterionId.slice('signal:'.length) as ExplorerSignal);
      return;
    }
    if (criterionId === 'borough') {
      updateFilter('borough', 'all');
      return;
    }
    if (criterionId === 'priority') {
      updateFilter('priority', 'all');
      return;
    }
    if (criterionId === 'site_type') {
      updateFilter('siteType', 'all');
      return;
    }
    if (criterionId === 'owner_portfolio') {
      updateFilter('ownerPortfolioId', null);
      return;
    }
    if (criterionId === 'min_lot_area_sqft') {
      updateFilter('minLotAreaSqft', null);
      return;
    }
    if (criterionId === 'min_unused_floor_area_sqft') {
      updateFilter('minUnusedFloorAreaSqft', null);
      return;
    }
    updateFilter('query', '');
  };

  const trackScreenAuditOpen = () => {
    if (!isAuthenticated || screenAuditOpenTrackedRef.current) return;
    screenAuditOpenTrackedRef.current = true;
    void recordParcelProductEvent(
      'screen_audit_opened',
      'screen_summary',
    ).catch(() => {
      // The explanatory screen remains available if telemetry is unavailable.
    });
  };

  const applyScreenRecipe = (recipe: ExplorerScreenRecipe) => {
    setFilters((current) => ({
      ...current,
      priority: recipe.priority,
      siteType: recipe.siteType,
      signals: [...recipe.signals],
      ownerPortfolioId: null,
    }));
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setSelectedBbl(null);
    syncExplorerUrl(filters.borough, null);
  };

  const selectParcel = (
    bbl: string,
    source: ParcelProductEventSource = 'ranking',
  ) => {
    const fromWorkspace = source === 'ranking' || source === 'map';
    if (fromWorkspace || !selectedBblRef.current) {
      parcelReturnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      parcelReturnBblRef.current = bbl;
    } else if (parcelReturnBblRef.current === null) {
      parcelReturnBblRef.current = selectedBblRef.current;
    }
    parcelOpenSourceRef.current = source;
    if (fromWorkspace) {
      parcelReturnPaneRef.current = source === 'ranking' ? 'results' : 'map';
    }
    setMobilePane('details');
    setSelectedBbl(bbl);
    syncExplorerUrl(filters.borough, bbl);
  };

  const closeParcel = () => {
    const returnFocus = parcelReturnFocusRef.current;
    const returnBbl = parcelReturnBblRef.current ?? selectedBblRef.current;
    const returnPane = parcelReturnPaneRef.current;
    setMobilePane(returnPane);
    setSelectedBbl(null);
    syncExplorerUrl(filters.borough, null);
    window.setTimeout(() => {
      const mapPane = document.getElementById('parcel-map-pane');
      const fallback =
        returnPane === 'map'
          ? mapPane
          : returnBbl === null
          ? null
          : Array.from(
              document.querySelectorAll<HTMLElement>(
                '[data-parcel-ranking-bbl]',
              ),
            ).find(
              (candidate) =>
                candidate.dataset.parcelRankingBbl === returnBbl,
            ) ?? null;
      const target =
        returnFocus?.isConnected &&
        returnFocus !== document.body &&
        returnFocus !== document.documentElement &&
        (returnPane !== 'map' || mapPane?.contains(returnFocus))
          ? returnFocus
          : fallback;
      target?.focus();
      parcelReturnFocusRef.current = null;
      parcelReturnBblRef.current = null;
    }, 0);
  };

  const trackComparisonOpen = (
    source: Extract<
      ParcelProductEventSource,
      'comparison' | 'decision_peers'
    > = 'comparison',
  ) => {
    if (
      auth.status !== 'authenticated' ||
      comparisonOpenTrackedRef.current
    ) {
      return;
    }
    comparisonOpenTrackedRef.current = true;
    void recordParcelProductEvent(
      'comparison_opened',
      source,
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

  const compareDecisionPeer = async (peer: ParcelIntelMapRow) => {
    if (!selectedDetail) {
      throw new Error('Selected parcel detail is unavailable');
    }
    const subject = selectedDetail;
    // Capture the invoking button before the async detail fetch. The peer
    // control disables itself while loading, and Chromium may move focus away
    // from a disabled control before the request resolves.
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const peerDetail = await getParcelIntelParcel(peer.bbl, {
      includeAuth: isAuthenticated,
    });
    if (selectedBblRef.current !== subject.bbl) {
      throw new Error('Selected parcel changed while preparing comparison');
    }
    comparisonReturnFocusRef.current = returnFocus;
    setComparisonRows([
      subject,
      { ...peerDetail, borough: peer.borough },
    ]);
    setComparisonOpen(true);
    trackComparisonOpen('decision_peers');
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
      siteType: 'all',
      signals: ['portfolio'],
      ownerPortfolioId,
    });
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setRankMapView(false);
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
    const startedAt = performance.now();
    setExportNotice(null);
    setExporting(true);
    try {
      const targets =
        filters.borough === 'all'
          ? boroughs
          : boroughs.filter((borough) => borough.slug === filters.borough);
      const results = await Promise.all(
        targets.map(async (borough) => {
          const sweep = await getParcelIntelSweep(borough.slug, 5000, {
            includeAuth: isAuthenticated,
          });
          return {
            generatedAt: sweep.generated_at,
            rows: sweep.rows.map((row) => ({
              ...row,
              borough: borough.slug,
            })),
          };
        }),
      );
      const filteredExportRows = sortExplorerRows(
        filterExplorerRows(
          results.flatMap((result) => result.rows),
          filters,
        ),
      );
      const exportRows = rankMapView
        ? filteredExportRows.filter((row) => viewportBblSet.has(row.bbl))
        : filteredExportRows;
      const integrity = checkParcelExportIntegrity({
        loadedGeneratedAt: inventoryGeneratedAt,
        sweepGeneratedAt: results.map((result) => result.generatedAt),
        expectedBbls: rankingParcels.map((row) => row.bbl),
        exportRows,
      });
      if (!integrity.ok) {
        setExportNotice({
          kind: 'error',
          message: exportIntegrityMessage(integrity.reason),
        });
        return;
      }
      downloadCsv(
        exportRows,
        `${
          filters.borough === 'all' ? 'citywide' : filters.borough
        }${rankMapView ? '-map-view' : ''}`,
      );
      const elapsedSeconds = Math.max(
        0.1,
        (performance.now() - startedAt) / 1_000,
      );
      setExportNotice({
        kind: 'success',
        message: `Downloaded ${integrity.uniqueBblCount.toLocaleString()} unique ${
          integrity.uniqueBblCount === 1 ? 'parcel' : 'parcels'
        } from the ${formatExportSnapshot(
          integrity.generatedAt,
        )} snapshot in ${elapsedSeconds.toFixed(1)}s.`,
      });
    } catch {
      setExportNotice({
        kind: 'error',
        message:
          'Export could not be prepared. The map is unchanged; check your connection and try again.',
      });
    } finally {
      setExporting(false);
    }
  };

  const resetExplorer = () => {
    setFilters(DEFAULT_FILTERS);
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setMobileMarketFiltersOpen(false);
    setRankMapView(false);
    setSelectedBbl(null);
    syncExplorerUrl('all', null);
  };

  const rememberToolPanelOpener = () => {
    toolPanelReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };

  const closeToolPanel = (panel: ToolPanelKey, close: () => void) => {
    const returnFocus = toolPanelReturnFocusRef.current;
    close();
    window.setTimeout(() => {
      const fallback = Array.from(
        document.querySelectorAll<HTMLElement>('[data-tool-panel-trigger]'),
      ).find(
        (candidate) => candidate.dataset.toolPanelTrigger === panel,
      );
      const target =
        returnFocus?.isConnected &&
        returnFocus !== document.body &&
        returnFocus !== document.documentElement
          ? returnFocus
          : fallback;
      target?.focus();
      toolPanelReturnFocusRef.current = null;
    }, 0);
  };

  const openActionQueue = () => {
    if (!actionsOpen) {
      rememberToolPanelOpener();
    }
    setActionsOpen(true);
    setAlertsOpen(false);
    setInsightsOpen(false);
    setSavedViewsOpen(false);
    setLeadReviewsOpen(false);
  };

  const openSavedViews = (entry: 'browse' | 'create' = 'browse') => {
    if (!savedViewsOpen) {
      rememberToolPanelOpener();
    }
    setSavedViewsEntry(entry);
    setSavedViewsOpen(true);
    setActionsOpen(false);
    setAlertsOpen(false);
    setInsightsOpen(false);
    setLeadReviewsOpen(false);
  };

  const openLeadReviews = () => {
    if (!leadReviewsOpen) {
      rememberToolPanelOpener();
    }
    setLeadReviewsOpen(true);
    setActionsOpen(false);
    setAlertsOpen(false);
    setInsightsOpen(false);
    setSavedViewsOpen(false);
  };

  const applySavedView = (view: ParcelSavedSearch) => {
    const dimensions = savedSearchDimensions(view.filters);
    setFilters({
      borough: view.borough,
      priority: view.filters.priority,
      siteType: dimensions.siteType,
      signals: dimensions.signals,
      minLotAreaSqft: view.filters.min_lot_area_sqft ?? null,
      minUnusedFloorAreaSqft:
        view.filters.min_unused_floor_area_sqft ?? null,
      query: view.filters.query,
      ownerPortfolioId: view.filters.owner_portfolio_id,
    });
    setOverlay(view.filters.overlay);
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setRankMapView(false);
    setSelectedBbl(null);
    closeToolPanel('saved', () => setSavedViewsOpen(false));
    syncExplorerUrl(view.borough, null);
    void recordParcelProductEvent(
      'saved_view_applied',
      'saved_views',
    ).catch(() => {
      // Applying a private saved view must remain usable when coarse,
      // value-minimized adoption telemetry is unavailable.
    });
  };

  const applyThesisFilters = (next: ExplorerFilters) => {
    setFilters(next);
    setLeadLimit(INITIAL_LEAD_LIMIT);
    setMobileRankingExpanded(false);
    setRankMapView(false);
    setSelectedBbl(null);
    setSignalFiltersOpen(false);
    setSiteCriteriaOpen(false);
    syncExplorerUrl(next.borough, null);
    void recordParcelProductEvent(
      'thesis_composer_applied',
      'thesis_composer',
    ).catch(() => {
      // The browser-local composer remains usable when coarse,
      // value-minimized adoption telemetry is unavailable.
    });
  };

  const trackSavedViewComparisonOpen = () => {
    if (savedViewComparisonOpenTrackedRef.current) return;
    savedViewComparisonOpenTrackedRef.current = true;
    void recordParcelProductEvent(
      'saved_view_comparison_opened',
      'saved_views',
    ).catch(() => {
      // Screen comparison remains local when coarse telemetry is unavailable.
    });
  };

  const trackSavedThesisChangesOpen = (searchId: string) => {
    if (savedThesisChangesTrackedRef.current.has(searchId)) return;
    savedThesisChangesTrackedRef.current.add(searchId);
    void recordParcelProductEvent(
      'saved_thesis_changes_opened',
      'saved_views',
    ).catch(() => {
      // Reviewing exact membership changes remains local when coarse,
      // identifier-free adoption telemetry is unavailable.
    });
  };

  const retryFullInventory = () => {
    automaticInventoryRetryCount.current = 0;
    setInventoryReloadKey((value) => value + 1);
  };

  return (
    <section className="ws-tabular flex min-w-0 flex-col border border-rule bg-white" aria-label="Citywide opportunity explorer">
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="parcel-inventory-announcer"
      >
        {inventoryAnnouncement}
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="parcel-screen-announcer"
      >
        {screenAnnouncement}
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="parcel-workspace-announcer"
      >
        {workspaceAnnouncement}
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="parcel-comparison-announcer"
      >
        {comparisonAnnouncement}
      </div>
      {isAuthenticated && inventoryState === 'incomplete' && (
        <div
          role="alert"
          data-testid="parcel-inventory-incomplete"
          className="flex flex-col gap-2 border-b border-rule bg-white px-4 py-3 text-xs text-ink sm:flex-row sm:items-center sm:justify-between md:px-6"
        >
          <span className="inline-flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <span>
              <strong>Full inventory could not be verified.</strong>{' '}
              {inventoryIssue === 'auth'
                ? 'Your account session is visible, but its data-access credential could not be refreshed. '
                : 'The signed-in inventory response was incomplete. '}
              The public 125-row preview is hidden here. Retry or reconnect to
              load the verified {totalAvailable.toLocaleString()}-parcel workspace.
            </span>
          </span>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {inventoryIssue === 'auth' && (
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(auth.signOut()).finally(() => {
                    window.location.assign(
                      '/sign-in?next=%2Fparcel-intel',
                    );
                  });
                }}
                className="inline-flex h-8 items-center justify-center rounded-sm border border-control bg-white px-3 font-semibold text-ink hover:bg-paper-2"
              >
                Reconnect account
              </button>
            )}
            <button
              type="button"
              onClick={retryFullInventory}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 font-semibold text-ink hover:bg-paper-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry full inventory
            </button>
          </div>
        </div>
      )}

      {isAuthenticated && insightsOpen && (
        <ParcelWorkflowInsights
          onClose={() =>
            closeToolPanel('insights', () => setInsightsOpen(false))
          }
        />
      )}
      {isAuthenticated &&
        leadReviewsOpen &&
        inventoryState === 'full' &&
        inventoryFeedGeneration && (
          <ParcelLeadReviewWorkspace
            feedGeneration={inventoryFeedGeneration}
            inventoryRows={rows}
            onClose={() =>
              closeToolPanel('reviews', () => setLeadReviewsOpen(false))
            }
            onSelectParcel={(bbl) => {
              setLeadReviewsOpen(false);
              selectParcel(bbl, 'lead_reviews');
            }}
          />
        )}
      {isAuthenticated && savedViewsOpen && (
        <ParcelSavedViewsPanel
          currentView={{
            borough: filters.borough,
            filters,
            overlay,
          }}
          inventoryRows={rows}
          inventoryReady={
            loadState === 'ready' &&
            fullInventoryReady &&
            failedBoroughs.length === 0
          }
          feedGeneration={inventoryFeedGeneration}
          feedGeneratedAt={inventoryGeneratedAt}
          initialFocus={savedViewsEntry === 'create' ? 'name' : 'close'}
          onApply={applySavedView}
          onSelectParcel={(bbl) => {
            setSavedViewsOpen(false);
            selectParcel(bbl, 'saved_views');
          }}
          onInspectExited={(bbl) => {
            setSavedViewsOpen(false);
            if (rows.some((row) => row.bbl === bbl)) {
              selectParcel(bbl, 'saved_views');
              return;
            }
            setRankMapView(false);
            setSelectedBbl(null);
            setFilters({
              ...DEFAULT_FILTERS,
              query: bbl,
            });
            setLeadLimit(INITIAL_LEAD_LIMIT);
            setMobileRankingExpanded(false);
            syncExplorerUrl('all', null);
          }}
          onComparisonOpened={trackSavedViewComparisonOpen}
          onChangesOpened={trackSavedThesisChangesOpen}
          onClose={() =>
            closeToolPanel('saved', () => setSavedViewsOpen(false))
          }
        />
      )}
      {isAuthenticated && actionsOpen && (
        <ParcelWorkflowActionsPanel
          onClose={() =>
            closeToolPanel('actions', () => setActionsOpen(false))
          }
          onDataChange={setWorkflowActions}
          onSelectParcel={(bbl) => {
            setActionsOpen(false);
            selectParcel(bbl, 'action_queue');
          }}
        />
      )}
      {isAuthenticated && alertsOpen && (
        <ParcelWorkflowAlertsPanel
          onClose={() =>
            closeToolPanel('alerts', () => setAlertsOpen(false))
          }
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
        !leadReviewsOpen &&
        !savedViewsOpen &&
        ((workflowActions.total_records === 0 && savedViewCount === 0) ||
          workflowActions.attention_count > 0) && (
          <section
            className="order-2 border-t border-rule bg-white px-4 py-3"
            aria-label="Acquisition workflow next step"
            data-testid={
              workflowActions.total_records === 0 && savedViewCount === 0
                ? 'activation-guide-empty'
                : 'activation-guide-attention'
            }
          >
            {workflowActions.total_records === 0 && savedViewCount === 0 ? (
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-ink">
                    Open a lead or watch this exact screen.
                  </h3>
                  <p className="mt-1 text-xs text-ink-3">Make the market repeatable</p>
                  <p className="mt-1 text-xs leading-5 text-ink-3">
                    Review the top parcel now, or save this result set and see
                    what enters or exits after the next feed.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    data-tool-panel-trigger="saved"
                    onClick={() => openSavedViews('create')}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-sm border border-ink bg-white px-4 text-xs font-semibold text-ink hover:bg-paper-2"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Watch this screen
                  </button>
                  <button
                    type="button"
                    disabled={rankingRows.length === 0}
                    onClick={() => {
                      const topLead = rankingRows[0];
                      if (topLead) selectParcel(topLead.bbl, 'ranking');
                    }}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Open top lead
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-cond flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <CalendarClock className="h-4 w-4" />
                    Resume your acquisition work
                  </div>
                  <p className="mt-1 text-sm text-ink">
                    <span className="font-semibold text-ink">
                      {workflowActions.attention_count} saved lead
                      {workflowActions.attention_count === 1 ? '' : 's'}
                    </span>{' '}
                    need a plan, assignee, due date, or outcome update.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openActionQueue}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink"
                >
                  Review {workflowActions.attention_count}{' '}
                  {workflowActions.attention_count === 1 ? 'action' : 'actions'}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>
        )}

      {isAuthenticated && (
        <div className="order-2">
          <ParcelThesisComposer
            currentFilters={filters}
            inventoryRows={rows}
            inventoryReady={
              loadState === 'ready' &&
              fullInventoryReady &&
              failedBoroughs.length === 0
            }
            onApply={applyThesisFilters}
          />
        </div>
      )}

      <div className="parcel-workspace-tools border-b border-rule bg-white px-3 py-2">
        <div className="parcel-workspace-toolbar grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(120px,0.6fr)_minmax(120px,0.6fr)_minmax(150px,0.8fr)_auto_auto]">
          <label className="relative sm:col-span-2 xl:col-span-1">
            <span className="sr-only">Search parcels</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-3" />
            <input
              value={filters.query}
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Address or BBL"
              className="h-10 w-full rounded-sm border border-control bg-white pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-select focus:ring-2 focus:ring-select"
            />
          </label>
          <button
            type="button"
            onClick={() => setMobileMarketFiltersOpen((value) => !value)}
            aria-expanded={mobileMarketFiltersOpen}
            aria-controls="parcel-mobile-market-filters"
            className="inline-flex h-10 items-center justify-between rounded-sm border border-rule bg-white px-3 text-xs font-semibold text-ink sm:hidden"
          >
            <span className="inline-flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Market filters
            </span>
            <span className="text-xs font-medium text-ink-3">
              {activeMarketFilterCount > 0
                ? `${activeMarketFilterCount} active`
                : 'Borough · priority'}
            </span>
          </button>
          <div
            id="parcel-mobile-market-filters"
            className={`col-span-1 gap-2 ${
              mobileMarketFiltersOpen ? 'grid' : 'hidden'
            } sm:contents`}
          >
            <label>
              <span className="sr-only">Filter by borough</span>
              <select
                value={filters.borough}
                onChange={(event) => updateFilter('borough', event.target.value)}
                className="h-10 w-full rounded-sm border border-control bg-white px-3 text-sm text-ink outline-none focus:border-select focus:ring-2 focus:ring-select"
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
                className="h-10 w-full rounded-sm border border-control bg-white px-3 text-sm text-ink outline-none focus:border-select focus:ring-2 focus:ring-select"
              >
                <option value="all">All priorities</option>
                <option value="highest">Highest only</option>
                <option value="high_or_better">High or better</option>
              </select>
            </label>
            <label className="sm:col-span-2 xl:col-span-1">
              <span className="sr-only">Filter by site type</span>
              <select
                value={filters.siteType}
                onChange={(event) =>
                  updateFilter(
                    'siteType',
                    event.target.value as ExplorerSiteType,
                  )
                }
                className="h-10 w-full rounded-sm border border-control bg-white px-3 text-sm text-ink outline-none focus:border-select focus:ring-2 focus:ring-select"
              >
                <option value="all">All site types</option>
                <option value="uncommitted">Qualified leads</option>
                <option value="vacant_site">Vacant sites</option>
                <option value="ground_up_candidate">Ground-up candidates</option>
                <option value="conversion_or_overbuilt">Conversion / overbuilt</option>
                <option value="active_project">Active projects</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1 xl:flex-nowrap">
            <button
              type="button"
              onClick={() => {
                setSignalFiltersOpen((value) => !value);
                setSiteCriteriaOpen(false);
              }}
              aria-label={
                filters.signals.length > 0
                  ? `Signals (${filters.signals.length} active)`
                  : 'Signals'
              }
              aria-expanded={signalFiltersOpen}
              aria-controls="parcel-signal-filters"
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-sm border px-3 text-xs font-semibold ${
                signalFiltersOpen || filters.signals.length > 0
                  ? 'border-ink bg-paper-2 text-ink'
                  : 'border-control bg-white text-ink hover:bg-paper-2'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Signals
              {filters.signals.length > 0 && (
                <span className="rounded-sm bg-ink px-1.5 py-0.5 text-xs text-white">
                  {filters.signals.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setSiteCriteriaOpen((value) => !value);
                setSignalFiltersOpen(false);
              }}
              aria-label={
                activeSiteCriteriaCount > 0
                  ? `Site criteria (${activeSiteCriteriaCount} active)`
                  : 'Site criteria'
              }
              aria-expanded={siteCriteriaOpen}
              aria-controls="parcel-site-criteria"
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-sm border px-3 text-xs font-semibold ${
                siteCriteriaOpen || activeSiteCriteriaCount > 0
                  ? 'border-control bg-white text-ink'
                  : 'border-control bg-white text-ink hover:bg-paper-2'
              }`}
            >
              <Ruler className="h-3.5 w-3.5" />
              <span>Criteria</span>
              {activeSiteCriteriaCount > 0 && (
                <span className="rounded-sm bg-ink px-1.5 py-0.5 text-xs text-white">
                  {activeSiteCriteriaCount}
                </span>
              )}
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={resetExplorer}
                className="inline-flex h-10 items-center justify-center gap-1 rounded-sm border border-control bg-white px-3 text-xs font-medium text-ink hover:bg-paper-2"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            <button
              type="button"
              disabled={rankingParcels.length === 0 || exporting}
              onClick={() => void exportFilteredRows()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-medium text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                rankMapView
                  ? `Export ${rankingParcels.length.toLocaleString()} parcels from the current map view`
                  : `Export ${rankingParcels.length.toLocaleString()} filtered parcels`
              }
            >
              {exporting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exporting ? 'Preparing…' : 'CSV'}
            </button>
          </div>
          {sourceReceipt}
          <span data-testid="parcel-mobile-access-status" className="border-l border-rule pl-2 text-[11px] sm:hidden">
            <b className="font-semibold text-ink">{auth.status === 'loading' ? 'Checking' : inventoryState === 'upgrading' ? 'Upgrading' : inventoryState === 'full' ? 'Full' : inventoryState === 'incomplete' ? 'Reconnect' : 'Preview'}</b> access
          </span>
          {isAuthenticated && (
            <button type="button" onClick={() => { setMobileWorkspaceToolsOpen((value) => !value); setMobilePane('results'); }} aria-label="Workspace tools" aria-expanded={mobileWorkspaceToolsOpen} aria-controls="parcel-mobile-workspace-tools" className="btn sm:hidden">
              <Bookmark className="h-3.5 w-3.5" />Workspace tools
              {workflowActions && workflowActions.attention_count > 0 && <span className="text-ink">{workflowActions.attention_count} need attention</span>}
            </button>
          )}
        </div>
        {exportNotice && (
          <div
            role={exportNotice.kind === 'error' ? 'alert' : 'status'}
            data-testid="parcel-export-receipt"
            className="mt-3 flex items-start justify-between gap-3 rounded-sm border border-rule bg-white px-3 py-2.5 text-xs text-ink"
          >
            <div className="flex min-w-0 items-start gap-2">
              {exportNotice.kind === 'error' ? (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
              )}
              <span>{exportNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              className="shrink-0 rounded-sm p-0.5 text-current opacity-60 hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              aria-label="Dismiss export receipt"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {signalFiltersOpen && (
          <div
            id="parcel-signal-filters"
            className="mt-3 rounded-sm border border-rule bg-white p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold text-ink">
                  Require every selected signal
                </div>
                <p className="mt-0.5 text-xs leading-4 text-ink-3">
                  Compound filters narrow the current inventory; they never alter
                  model rank or imply seller intent.
                </p>
              </div>
              {filters.signals.length > 0 && (
                <button
                  type="button"
                  onClick={() => updateFilter('signals', [])}
                  className="text-xs font-semibold text-ink hover:text-ink"
                >
                  Clear signals
                </button>
              )}
            </div>
            <div className="mt-4 border-t border-rule pt-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="font-cond flex items-center gap-1.5 text-[13px] font-semibold text-ink-3">
                    <Filter className="h-3.5 w-3.5" />
                    Evidence recipes
                  </div>
                  <p className="mt-1 text-xs leading-4 text-ink-3">
                    Apply a transparent acquisition thesis, then refine it.
                  </p>
                </div>
                <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-medium text-ink-3">
                  Live loaded-inventory counts
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {visibleScreenRecipes.map((recipe) => {
                  const active = isScreenRecipeActive(filters, recipe);
                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyScreenRecipe(recipe)}
                      className={`group rounded border p-3 text-left transition ${
                        active
                          ? 'border-ink bg-paper-2 ring-2 ring-paper-2'
                          : 'border-control bg-white hover:border-ink hover:bg-white '
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">
                          {recipe.label}
                        </span>
                        <span
                          className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${
                            active
                              ? 'bg-ink text-white'
                              : 'bg-white text-ink-3 ring-1 ring-rule'
                          }`}
                        >
                          {screenRecipeCounts[recipe.id].toLocaleString()}
                        </span>
                      </div>
                      <span className="mt-1.5 block text-xs leading-4 text-ink-3">
                        {recipe.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleSignals.map(
                (signal) => {
                  const selected = filters.signals.includes(signal);
                  return (
                    <button
                      key={signal}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSignal(signal)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-xs font-semibold transition-colors ${
                        selected
                          ? 'border-ink bg-paper-2 text-ink'
                          : 'border-control bg-white text-ink hover:border-rule hover:bg-paper-2'
                      }`}
                    >
                      {signalLabel(signal)}
                      <span className="text-xs font-medium text-ink-3">
                        {signalCounts[signal].toLocaleString()}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            {!isAuthenticated && (
              <p className="mt-3 text-xs text-ink-3">
                Sign in to combine ownership, transaction, hazard, environmental,
                transit, and imagery signals.
              </p>
            )}
          </div>
        )}
        {siteCriteriaOpen && (
          <div
            id="parcel-site-criteria"
            className="mt-3 rounded-sm border border-rule bg-white p-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Ruler className="h-3.5 w-3.5 text-ink" />
                  Source-backed site criteria
                </div>
                <p className="mt-0.5 text-xs leading-4 text-ink-3">
                  Missing values do not pass a minimum. These PLUTO fields are
                  screening proxies, not surveyed area or buildable yield.
                </p>
              </div>
              {activeSiteCriteriaCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      minLotAreaSqft: null,
                      minUnusedFloorAreaSqft: null,
                    }))
                  }
                  className="text-xs font-semibold text-ink hover:text-ink"
                >
                  Clear site criteria
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="rounded-sm border border-white bg-white/80 p-3">
                <span className="text-xs font-semibold text-ink">
                  Minimum lot area
                </span>
                <select
                  aria-label="Minimum lot area"
                  value={filters.minLotAreaSqft ?? ''}
                  onChange={(event) =>
                    updateFilter(
                      'minLotAreaSqft',
                      event.target.value
                        ? Number(event.target.value)
                        : null,
                    )
                  }
                  className="mt-2 h-10 w-full rounded-sm border border-control bg-white px-3 text-sm text-ink outline-none focus:border-control focus:ring-2 focus:ring-rule"
                >
                  <option value="">Any PLUTO lot area</option>
                  {filters.minLotAreaSqft !== null &&
                    !LOT_AREA_THRESHOLDS_SQFT.includes(
                      filters.minLotAreaSqft,
                    ) && (
                      <option value={filters.minLotAreaSqft}>
                        {filters.minLotAreaSqft.toLocaleString()}+ sf (reviewed)
                      </option>
                    )}
                  {LOT_AREA_THRESHOLDS_SQFT.map((value) => (
                    <option key={value} value={value}>
                      {value.toLocaleString()}+ sf
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-xs leading-4 text-ink-3">
                  Current PLUTO tax-lot area; not a survey.
                </span>
              </label>
              <label className="rounded-sm border border-white bg-white/80 p-3">
                <span className="text-xs font-semibold text-ink">
                  Minimum unused FAR proxy
                </span>
                <select
                  aria-label="Minimum unused FAR proxy"
                  value={filters.minUnusedFloorAreaSqft ?? ''}
                  onChange={(event) =>
                    updateFilter(
                      'minUnusedFloorAreaSqft',
                      event.target.value
                        ? Number(event.target.value)
                        : null,
                    )
                  }
                  className="mt-2 h-10 w-full rounded-sm border border-control bg-white px-3 text-sm text-ink outline-none focus:border-control focus:ring-2 focus:ring-rule"
                >
                  <option value="">Any unused-FAR proxy</option>
                  {filters.minUnusedFloorAreaSqft !== null &&
                    !UNUSED_FAR_THRESHOLDS_SQFT.includes(
                      filters.minUnusedFloorAreaSqft,
                    ) && (
                      <option value={filters.minUnusedFloorAreaSqft}>
                        {filters.minUnusedFloorAreaSqft.toLocaleString()}+ sf
                        (reviewed)
                      </option>
                    )}
                  {UNUSED_FAR_THRESHOLDS_SQFT.map((value) => (
                    <option key={value} value={value}>
                      {value.toLocaleString()}+ sf
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-xs leading-4 text-ink-3">
                  Allowed-FAR minus built-FAR proxy; not feasible development
                  yield.
                </span>
              </label>
            </div>
          </div>
        )}
        {filters.signals.length > 0 && !signalFiltersOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-cond mr-1 text-[13px] font-semibold text-ink-3">
              Required
            </span>
            {filters.signals.map((signal) => (
              <button
                key={signal}
                type="button"
                onClick={() => toggleSignal(signal)}
                aria-label={`Remove ${signalLabel(signal)} filter`}
                className="inline-flex items-center gap-1 rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold text-ink"
              >
                {signalLabel(signal)}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        {activeSiteCriteriaCount > 0 && !siteCriteriaOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-cond mr-1 text-[13px] font-semibold text-ink-3">
              Site criteria
            </span>
            {filters.minLotAreaSqft !== null && (
              <button
                type="button"
                onClick={() => updateFilter('minLotAreaSqft', null)}
                aria-label="Remove minimum lot area criterion"
                className="inline-flex items-center gap-1 rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold text-ink"
              >
                Lot ≥ {filters.minLotAreaSqft.toLocaleString()} sf
                <X className="h-3 w-3" />
              </button>
            )}
            {filters.minUnusedFloorAreaSqft !== null && (
              <button
                type="button"
                onClick={() =>
                  updateFilter('minUnusedFloorAreaSqft', null)
                }
                aria-label="Remove minimum unused FAR proxy criterion"
                className="inline-flex items-center gap-1 rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold text-ink"
              >
                Unused FAR ≥{' '}
                {filters.minUnusedFloorAreaSqft.toLocaleString()} sf
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {hasFilters && loadState === 'ready' && (
          <section
            data-testid="screen-intelligence"
            aria-label="Current screen intelligence"
            className="mt-3 overflow-hidden rounded-sm border border-rule bg-white text-ink"
          >
            <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_repeat(3,minmax(120px,0.65fr))]">
              <div className="bg-white p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-cond text-[13px] font-semibold text-ink-3">
                    Current screen
                  </span>
                  {activeScreenRecipe && (
                    <span className="rounded-sm bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-3">
                      {activeScreenRecipe.label}
                    </span>
                  )}
                </div>
                <div
                  data-testid="screen-match-count"
                  className="mt-1 text-lg font-semibold"
                >
                  {screenSummary.matchCount.toLocaleString()}
                  {filters.signals.length > 0 && (
                    <span className="text-sm font-medium text-ink-3">
                      {' '}
                      of {screenSummary.universeCount.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-4 text-ink-3">
                  {screenSummary.matchCount === 0
                    ? 'No loaded parcels meet every condition. Remove one signal or broaden priority.'
                    : 'Matching loaded parcels; filter evidence does not change rank or predict a transaction.'}
                </p>
              </div>
              <div className="bg-white p-3.5">
                <div className="font-cond text-[13px] text-ink-3">
                  {filters.signals.length > 0
                    ? 'Evidence match'
                    : 'Scope state'}
                </div>
                <div className="mt-1 text-base font-semibold">
                  {filters.signals.length > 0 &&
                  screenSummary.matchRatePct !== null
                    ? `${screenSummary.matchRatePct.toFixed(
                        screenSummary.matchRatePct < 10 ? 1 : 0,
                      )}%`
                    : 'Scoped'}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  {filters.signals.length > 0
                    ? 'of current pre-signal scope'
                    : 'borough / priority / site type'}
                </div>
              </div>
              <div className="bg-white p-3.5">
                <div className="font-cond text-[13px] text-ink-3">
                  Median unused FAR proxy
                </div>
                <div className="mt-1 text-base font-semibold">
                  {formatCompactSqft(
                    screenSummary.medianUnusedFloorAreaSqft,
                  )}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  current PLUTO screen
                </div>
              </div>
              <div className="bg-white p-3.5">
                <div className="font-cond text-[13px] text-ink-3">
                  {filters.borough === 'all' ? 'Largest borough' : 'Median lot'}
                </div>
                <div className="mt-1 text-base font-semibold">
                  {filters.borough === 'all'
                    ? screenSummary.topBorough
                      ? BOROUGH_LABELS[screenSummary.topBorough] ??
                        screenSummary.topBorough
                      : '—'
                    : formatCompactSqft(screenSummary.medianLotAreaSqft)}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  {filters.borough === 'all' && screenSummary.topBorough
                    ? `${screenSummary.topBoroughCount.toLocaleString()} matches`
                    : filters.borough === 'all'
                      ? 'no current matches'
                      : 'current PLUTO screen'}
                </div>
              </div>
            </div>
            {screenAudit.criteriaCount > 0 && (
              <ParcelScreenAudit
                audit={screenAudit}
                onRelax={relaxScreenCriterion}
                onOpened={trackScreenAuditOpen}
              />
            )}
          </section>
        )}
      </div>

      {screeningLookupBbl &&
        loadState === 'ready' &&
        auth.status !== 'loading' &&
        (!isAuthenticated || fullInventoryReady) && (
          <>
            {isAuthenticated && (
              <ParcelOfficialDossierPanel bbl={screeningLookupBbl} />
            )}
            <ParcelScreeningLookup
              bbl={screeningLookupBbl}
              isAuthenticated={isAuthenticated}
            />
          </>
        )}

      {addressResolverQuery &&
        loadState === 'ready' &&
        isAuthenticated &&
        fullInventoryReady && (
          <ParcelAddressResolver address={addressResolverQuery} />
        )}

      {failedBoroughs.length > 0 && (
        <div className="border-b border-rule bg-white px-5 py-2 text-xs text-ink">
          Could not load {failedBoroughs.map((slug) => BOROUGH_LABELS[slug] ?? slug).join(', ')}.
          The remaining boroughs are still available.
        </div>
      )}

      <div className="grid grid-cols-3 border-b border-rule bg-white lg:hidden" aria-label="Workspace views">
        {(['results', 'map', 'details'] as const).map((pane) => (
          <button key={pane} type="button" aria-pressed={activeMobilePane === pane} aria-controls={`parcel-${pane === 'details' ? 'detail' : pane}-pane`} disabled={pane === 'details' && !selectedBbl} onClick={() => setMobilePane(pane)} className={`h-11 border-b-2 text-xs font-medium disabled:opacity-40 ${activeMobilePane === pane ? 'border-ink text-ink' : 'border-transparent text-ink-3'}`}>
            {pane === 'results' ? 'Results' : pane === 'map' ? 'Map' : 'Parcel details'}
          </button>
        ))}
      </div>
      <div ref={panesRef} data-testid="parcel-explorer-panes" className={`explorer-panes grid min-h-0 min-w-0 ${selectedBbl ? 'has-selection lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[300px_minmax(0,1fr)_380px]' : 'lg:grid-cols-[300px_minmax(0,1fr)]'}`}>
        <aside id="parcel-results-pane" aria-label="Acquisition site results" className={`min-h-0 flex-col overflow-y-auto overscroll-contain border-rule bg-white lg:order-1 lg:border-r ${activeMobilePane === 'results' ? 'flex' : 'hidden'} ${selectedBbl ? 'lg:hidden xl:flex' : 'lg:flex'}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule bg-white px-3 py-2 text-xs text-ink-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
              <details className="relative">
                <summary className="cursor-pointer font-cond text-ink">Map color · {overlay === 'priority' ? 'Rank' : overlay}</summary>
                <div className="absolute left-0 top-full z-[500] border border-control bg-white p-1">
                  <div className="inline-flex items-center gap-1" aria-label="Map colors">
                    {(['priority', 'opportunity', 'borough'] as ExplorerOverlay[]).map((value) => (
                      <button key={value} type="button" onClick={() => setOverlay(value)} aria-pressed={overlay === value}
                        className={`h-9 rounded-sm px-2.5 text-xs capitalize transition-colors ${overlay === value ? 'bg-paper-2 font-semibold text-ink' : 'text-ink-3 hover:bg-white'}`}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </details>

            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span data-testid="parcel-desktop-access-status" className="sr-only">
                <span className="sr-only">Access</span>{auth.status === 'loading' ? 'Checking…' : inventoryState === 'upgrading' ? 'Verifying…' : inventoryState === 'full' ? 'Full · verified' : inventoryState === 'incomplete' ? 'Reconnect' : 'Preview · signed out'}
              </span>
              <span data-testid="parcel-inventory-status" className={isAuthenticated ? "text-ink-3" : "sr-only"}>
                {auth.status === 'loading' ? 'Checking workspace access…' : inventoryState === 'upgrading' ? `Loading all ${totalAvailable.toLocaleString()} parcels…` : inventoryState === 'full' ? `Full inventory verified · ${rows.length.toLocaleString()} loaded` : inventoryState === 'incomplete' ? `Inventory incomplete · ${rows.length.toLocaleString()} of ${totalAvailable.toLocaleString()} loaded` : `Preview coverage · ${rows.length.toLocaleString()} of ${totalAvailable.toLocaleString()}`}
              </span>
            </div>
            <div id="parcel-mobile-workspace-tools" className={`w-full flex-wrap items-center gap-1 border-t border-rule pt-2 ${isAuthenticated && mobileWorkspaceToolsOpen ? 'flex' : 'hidden'} ${isAuthenticated ? 'sm:flex' : ''}`}>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      if (leadReviewsOpen) {
                        setLeadReviewsOpen(false);
                      } else {
                        openLeadReviews();
                      }
                    }}
                    disabled={
                      inventoryState !== 'full' || !inventoryFeedGeneration
                    }
                    aria-expanded={leadReviewsOpen}
                    aria-controls="parcel-lead-review-workspace"
                    data-tool-panel-trigger="reviews"
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-medium text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Target className="h-3.5 w-3.5 text-ink" />
                    Lead reviews
                  </button>
                )}
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      if (savedViewsOpen) {
                        setSavedViewsOpen(false);
                        return;
                      }
                      openSavedViews('browse');
                    }}
                    aria-expanded={savedViewsOpen}
                    aria-controls="parcel-saved-views-panel"
                    data-tool-panel-trigger="saved"
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-medium text-ink hover:bg-paper-2"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-ink" />
                    Saved views
                    {savedViewCount !== null && savedViewCount > 0 && (
                      <span
                        aria-hidden="true"
                        data-testid="saved-view-count"
                        className="inline-flex min-w-5 items-center justify-center rounded-sm bg-paper-2 px-1.5 py-0.5 text-xs font-bold leading-none text-ink"
                      >
                        {savedViewCount}
                      </span>
                    )}
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
                    aria-controls="parcel-action-queue"
                    data-tool-panel-trigger="actions"
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-medium text-ink hover:bg-paper-2"
                  >
                    <CalendarClock className="h-3.5 w-3.5 text-ink-3" />
                    Action queue
                    {workflowActions && workflowActions.attention_count > 0 && (
                      <span
                        className="rounded-sm bg-paper-2 px-1.5 py-0.5 text-xs font-semibold text-ink"
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
                      if (!alertsOpen) {
                        rememberToolPanelOpener();
                      }
                      setAlertsOpen((value) => !value);
                      setInsightsOpen(false);
                      setActionsOpen(false);
                      setSavedViewsOpen(false);
                      setLeadReviewsOpen(false);
                    }}
                    aria-expanded={alertsOpen}
                    aria-controls="parcel-evidence-changes"
                    data-tool-panel-trigger="alerts"
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-medium text-ink hover:bg-paper-2"
                  >
                    <BellRing className="h-3.5 w-3.5 text-ink" />
                    Evidence changes
                  </button>
                )}
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!insightsOpen) {
                        rememberToolPanelOpener();
                      }
                      setInsightsOpen((value) => !value);
                      setAlertsOpen(false);
                      setActionsOpen(false);
                      setSavedViewsOpen(false);
                      setLeadReviewsOpen(false);
                    }}
                    aria-expanded={insightsOpen}
                    aria-controls="parcel-outcome-insights"
                    data-tool-panel-trigger="insights"
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-medium text-ink hover:bg-paper-2"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-ink" />
                    Outcome insights
                  </button>
                )}
            </div>
          </div>

          {!isAuthenticated && auth.status !== 'loading' && (
            <div
              data-testid="parcel-public-inventory-notice"
              className="flex flex-col gap-1 border-b border-rule bg-white px-4 py-2 text-xs text-ink-3"
            >
              <span className="leading-5">
                {loadState === 'ready'
                  ? `Public preview · ${rows.length.toLocaleString()} of ${totalAvailable.toLocaleString()}`
                  : loadState === 'error' ? 'Public preview unavailable' : 'Loading public preview…'}
              </span>
              <Link
                href="/sign-in?next=%2Fparcel-intel"
                className="inline-flex min-h-8 shrink-0 items-center gap-1.5 text-xs font-semibold text-select underline-offset-4 hover:underline"
              >
                Sign in for the full workspace
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {filters.ownerPortfolioId && (
            <div className="flex items-center justify-between gap-3 border-b border-rule bg-white px-4 py-3 text-xs text-ink">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-ink" />
                <span>
                  Showing current candidate holdings with the same exact
                  normalized PLUTO legal name.
                </span>
              </div>
              <button
                type="button"
                onClick={clearOwnerPortfolioFocus}
                className="shrink-0 font-semibold text-ink hover:text-ink"
              >
                Show all portfolios
              </button>
            </div>
          )}
          <div className="flex flex-col gap-3 border-b border-rule px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">
                Acquisition sites
              </h2>
              <p className="text-xs text-ink-3">
                {rankMapView
                  ? `${rankingRows.length.toLocaleString()} ${
                      rankingRows.length === 1 ? 'site' : 'sites'
                    } across ${rankingParcels.length.toLocaleString()} mapped ${
                      rankingParcels.length === 1 ? 'parcel' : 'parcels'
                    } · unsaved scope`
                  : `${rankingRows.length.toLocaleString()} ${
                      rankingRows.length === 1 ? 'site' : 'sites'
                    } across ${rankingParcels.length.toLocaleString()} matching ${
                      rankingParcels.length === 1 ? 'parcel' : 'parcels'
                    } · best matching parcel rank retained`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-testid="rank-map-view"
                aria-pressed={rankMapView}
                disabled={viewportBbls === null}
                onClick={() => {
                  setRankMapView((current) => !current);
                  setLeadLimit(INITIAL_LEAD_LIMIT);
                  setMobileRankingExpanded(false);
                }}
                className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  rankMapView
                    ? 'border-ink bg-paper-2 text-ink hover:bg-paper-2'
                    : 'border-control bg-white text-ink hover:border-ink hover:bg-paper-2 hover:text-ink'
                }`}
              >
                <MapPinned className="h-3.5 w-3.5" />
                {rankMapView
                  ? `Show all sites · ${rankedSites.length.toLocaleString()}`
                  : `Rank this view · ${rankedSitesInViewport.length.toLocaleString()} ${
                      rankedSitesInViewport.length === 1 ? 'site' : 'sites'
                    }`}
              </button>
              <span
                className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-medium text-ink-3"
                data-testid="parcel-site-ranking-count"
                data-site-count={rankingRows.length}
                data-parcel-count={rankingParcels.length}
              >
                {rankingRows.length.toLocaleString()}{' '}
                {rankingRows.length === 1 ? 'site' : 'sites'}
              </span>
            </div>
          </div>
          <div
            id="parcel-acquisition-ranking"
            className="min-h-[16rem] flex-1 overflow-y-auto overscroll-contain"
          >
            {rankingRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-3">
                {rankMapView
                  ? 'No acquisition sites are inside this view. Pan, zoom out, or choose Show all sites.'
                  : 'No acquisition sites match these filters.'}
              </div>
            ) : (
              rankingRows.slice(0, leadLimit).map((row, index) => (
                <button
                  key={row.bbl}
                  type="button"
                  data-parcel-ranking-bbl={row.bbl}
                  onClick={() => selectParcel(row.bbl, 'ranking')}
                  aria-pressed={selectedBbl === row.bbl}
                  className={`parcel-result-row w-full border-b border-rule px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-select ${
                    !mobileRankingExpanded && index >= MOBILE_COMPACT_LEAD_LIMIT ? 'hidden sm:block' : ''
                  } ${selectedBbl === row.bbl ? 'bg-select-wash' : 'bg-white hover:bg-paper-2'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-8 shrink-0 pt-0.5 text-right font-mono text-sm tabular-nums ${selectedBbl === row.bbl ? 'text-select' : 'text-ink-3'}`}
                      title="Citywide priority rank">
                      {row.citywide_rank ?? row.acquisition_rank ?? '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium text-ink">{parcelLabel(row.address, row.bbl)}</div>
                      <div className="mt-1 break-words font-mono text-[11px] text-ink-3">
                        {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} · {formatBbl(row.bbl)}
                      </div>
                      <div className="sr-only">{opportunityLabel(row.opportunity_category)}</div>
                      {(row.assemblage_lot_count ?? 0) >= 2 && (
                        <div className="mt-1 text-xs text-ink-2">
                          {row.assemblage_lot_count?.toLocaleString()} lots{row.assemblage_combined_lot_area_sqft
                            ? `, ${Math.round(row.assemblage_combined_lot_area_sqft).toLocaleString()} sf combined site` : ''}
                        </div>
                      )}
                      {(row.assemblage_lot_count ?? 0) >= 2 && Boolean(row.assemblage_combined_buildable_sqft) && (
                        <p className="mt-1 text-[11px] text-ink-3">{formatCompactSqft(row.assemblage_combined_buildable_sqft ?? null)} buildable envelope</p>
                      )}
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs tabular-nums" aria-label={(row.assemblage_lot_count ?? 0) >= 2 ? 'Ranked member parcel facts' : 'Parcel facts'}>
                        <div><dt className="font-cond text-ink-3">Lot area</dt><dd className="mt-1 font-medium text-ink">{row.lot_area_sqft == null ? '—' : <>{Math.round(row.lot_area_sqft).toLocaleString()}<small className="font-normal text-ink-3"> sf</small></>}</dd></div>
                        <div><dt className="font-cond text-ink-3">Zoning</dt><dd className="mt-1 font-medium text-ink">{row.zoning_district_1 || '—'}</dd></div>
                        <div><dt className="font-cond text-ink-3">Held</dt><dd className="mt-1 font-medium text-ink">{row.years_held == null ? '—' : <>{row.years_held.toLocaleString()}<small className="font-normal text-ink-3"> yr</small></>}</dd></div>
                      </dl>
                    </div>
                  </div>
                </button>
              ))
            )}
            {rankingRows.length > MOBILE_COMPACT_LEAD_LIMIT && (
              <div className="mt-1 grid gap-2 sm:hidden">
                <button
                  type="button"
                  aria-controls="parcel-acquisition-ranking"
                  aria-expanded={mobileRankingExpanded}
                  onClick={() =>
                    setMobileRankingExpanded((current) => !current)
                  }
                  className="inline-flex h-10 w-full items-center justify-center rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink hover:border-ink hover:bg-paper-2 hover:text-ink"
                >
                  {mobileRankingExpanded
                    ? 'Show fewer ranked leads'
                    : `Show more ranked leads · ${(
                        rankingRows.length - MOBILE_COMPACT_LEAD_LIMIT
                      ).toLocaleString()} remaining`}
                </button>
                {mobileRankingExpanded && rankingRows.length > leadLimit && (
                  <button
                    type="button"
                    onClick={() =>
                      setLeadLimit((current) => current + LEAD_PAGE_SIZE)
                    }
                    className="inline-flex h-10 w-full items-center justify-center rounded-sm border border-control bg-white px-3 text-xs font-medium text-ink hover:border-ink hover:bg-paper-2 hover:text-ink"
                  >
                    Load {Math.min(LEAD_PAGE_SIZE, rankingRows.length - leadLimit)} more
                    · {(rankingRows.length - leadLimit).toLocaleString()} remaining
                  </button>
                )}
              </div>
            )}
            {rankingRows.length > leadLimit && (
              <button
                type="button"
                onClick={() =>
                  setLeadLimit((current) => current + LEAD_PAGE_SIZE)
                }
                className="mt-1 hidden h-9 w-full items-center justify-center rounded-sm border border-control bg-white text-xs font-medium text-ink hover:border-ink hover:bg-paper-2 hover:text-ink sm:inline-flex"
              >
                Show {Math.min(LEAD_PAGE_SIZE, rankingRows.length - leadLimit)} more ·{' '}
                {(rankingRows.length - leadLimit).toLocaleString()} remaining
              </button>
            )}
          </div>
          <div className="border-t border-rule bg-white px-4 py-2 text-xs text-ink-3">
            <p className="mb-1 font-mono text-[10px]">PLUTO · ACRIS · Feed as of {inventoryGeneratedAt ? formatExportSnapshot(inventoryGeneratedAt) : 'date unavailable'}</p>
            Map scores are ordinal screening signals. Verify current records before
            acquisition diligence.
          </div>
        </aside>
        <div id="parcel-map-pane" tabIndex={-1} className={`min-h-0 min-w-0 ${activeMobilePane === 'map' ? 'block' : 'hidden'} lg:order-2 lg:block`}>
          {loadState === 'idle' || loadState === 'loading' ? (
            <ExplorerMapSkeleton />
          ) : loadState === 'error' ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-sm border border-rule bg-white p-8 text-center">
              <div>
                <MapPinned className="mx-auto h-8 w-8 text-red-700" />
                <h3 className="mt-3 font-semibold text-red-700">The explorer could not load</h3>
                <p className="mt-1 max-w-sm text-sm text-red-700">
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
              inventoryScope={
                fullInventoryReady
                  ? 'authenticated_full'
                  : 'public_preview'
              }
              inventoryLoadedCount={rows.length}
              inventoryAvailableCount={totalAvailable}
              onSelect={(bbl) => selectParcel(bbl, 'map')}
              onViewportRowsChange={handleViewportRowsChange}
            />
          )}
        </div>

        <aside id="parcel-detail-pane" aria-label="Parcel decision workspace" className={`min-h-0 flex-col overflow-y-auto border-rule bg-white lg:order-3 lg:border-l ${selectedBbl && activeMobilePane === 'details' ? 'flex' : 'hidden'} ${selectedBbl ? 'lg:flex' : 'lg:hidden'}`}>
          {selectedDetail ? (
            <ParcelIntelPropertyPanel
              key={selectedDetail.bbl}
              row={selectedDetail}
              feedGeneration={inventoryFeedGeneration}
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
              decisionPeers={decisionPeers}
              peerInventoryComplete={fullInventoryReady}
              onOpenPeer={(bbl) => selectParcel(bbl, 'decision_peers')}
              onComparePeer={compareDecisionPeer}
            />
          ) : selectedSummary && detailState === 'loading' ? (
            <div
              className="flex h-full flex-col items-center justify-center p-6 text-center"
              role="status"
            >
              <LoaderCircle className="h-6 w-6 animate-spin text-ink" />
              <h3 className="mt-3 text-sm font-semibold text-ink">
                Loading parcel diligence
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                Fetching geometry, ownership, project history, and model evidence.
              </p>
            </div>
          ) : selectedSummary && detailState === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <TriangleAlert className="h-7 w-7 text-ink-3" />
              <h3 className="mt-3 text-sm font-semibold text-ink">
                Parcel detail is temporarily unavailable
              </h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-ink-3">
                The ranked map is still available. Close this panel and try the
                parcel again in a moment.
              </p>
              <button
                type="button"
                onClick={closeParcel}
                className="mt-4 text-xs font-medium text-ink hover:text-ink"
              >
                Back to ranked parcels
              </button>
            </div>
          ) : selectedBbl && loadState === 'ready' ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-2">
                <Search className="h-5 w-5 text-ink-3" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink">
                {isAuthenticated
                  ? 'Parcel is outside the ranked lead inventory'
                  : 'Parcel not included in this access tier'}
              </h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-ink-3">
                {isAuthenticated
                  ? `BBL ${formatBbl(selectedBbl)} is not one of the current 5,000 published leads. Review its official dossier and separate screening receipt above; CityLens does not infer a rank for it.`
                  : `BBL ${formatBbl(selectedBbl)} is not in the current preview. Sign in to load the broader five-borough dataset.`}
              </p>
              {!isAuthenticated && (
                <Link
                  href={`/sign-in?next=${encodeURIComponent(
                    `/parcel-intel?bbl=${selectedBbl}`,
                  )}`}
                  className="mt-4 inline-flex h-9 items-center rounded-sm bg-ink px-4 text-xs font-medium text-white hover:bg-ink"
                >
                  Sign in to continue
                </Link>
              )}
              <button
                type="button"
                onClick={closeParcel}
                className="mt-2 text-xs font-medium text-ink-3 hover:text-ink"
              >
                Back to ranked parcels
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="hidden grid-cols-6 gap-1 border-t border-rule bg-white p-1 lg:grid">
        <button
          type="button"
          onClick={() => updateFilter('borough', 'all')}
          aria-pressed={filters.borough === 'all'}
          className={`group flex items-center justify-between rounded-sm border px-3 py-2 text-xs transition-colors ${
            filters.borough === 'all'
              ? 'border-ink bg-paper-2 text-ink '
              : 'border-control bg-white hover:border-ink '
          }`}
        >
          <span>
            <span className="font-semibold">All NYC</span>
            <span className="ml-1 text-ink-3">{totalAvailable.toLocaleString()}</span>
          </span>
          <MapPinned className="h-3.5 w-3.5 text-ink" />
        </button>
        {boroughs.map((borough) => (
          <button
            key={borough.slug}
            type="button"
            onClick={() => updateFilter('borough', borough.slug)}
            aria-pressed={filters.borough === borough.slug}
            className={`group flex items-center justify-between rounded-sm border px-3 py-2 text-xs transition-colors ${
              filters.borough === borough.slug
                ? 'border-ink bg-paper-2 text-ink '
                : 'border-control bg-white hover:border-ink '
            }`}
          >
            <span>
              <span className="font-semibold">{borough.display_name}</span>
              <span className="ml-1 text-ink-3">{borough.count.toLocaleString()}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-ink-3 group-hover:text-ink" />
          </button>
        ))}
      </div>

      {comparisonRows.length > 0 && !comparisonOpen && (
        <section
          className="fixed bottom-4 left-1/2 z-[1100] flex w-[min(94vw,920px)] -translate-x-1/2 flex-col gap-3 rounded-sm border border-white/15 bg-ink px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between"
          aria-label="Parcel comparison tray"
          data-testid="parcel-comparison-tray"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
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
                  className="inline-flex max-w-56 shrink-0 items-center gap-1 rounded-sm bg-white/10 px-2.5 py-1 text-xs text-ink-3 hover:bg-white/15"
                  aria-label={`Remove ${parcelLabel(row.address, row.bbl)} from comparison`}
                >
                  <span className="truncate">{parcelLabel(row.address, row.bbl)}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearComparison}
              className="h-9 rounded-sm px-3 text-xs font-semibold text-ink-3 hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={openComparison}
              disabled={comparisonRows.length < 2}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-white px-3 text-xs font-semibold text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Columns3 className="h-3.5 w-3.5" />
              {comparisonRows.length < 2 ? 'Add one more' : 'Compare now'}
            </button>
          </div>
        </section>
      )}

      {comparisonOpen && comparisonRows.length >= 2 && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-ink/50 p-2 sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeComparison();
            }
          }}
        >
          <div
            ref={comparisonDialogRef}
            className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-sm bg-white"
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
