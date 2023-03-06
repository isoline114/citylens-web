'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  Bell,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  Filter,
  Lock,
  MapPin,
  Save,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import {
  listParcelSavedSearches,
  listParcelWorkflow,
  removeParcelSavedSearch,
  removeParcelWorkflow,
  saveParcelSearch,
  saveParcelWorkflow,
  type ParcelIntelRow,
  type ParcelSavedSearch,
  type ParcelWorkflowItem,
  type ParcelWorkflowSnapshot,
  type TopFeature,
} from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { downloadCsv } from './parcel-intel-csv';
import { explainParcel, type Reason } from './parcel-intel-explain';
import {
  LandBasisCalculator,
  ParcelBriefActions,
  WorkflowEditor,
  WORKFLOW_STAGE_LABELS,
  type WorkflowDraft,
} from './parcel-acquisition-tools';

// Leaflet must not render on the server (window/document references).
// next/dynamic's `loading` callback can't receive props; the skeleton
// uses a generic NYC silhouette regardless of which borough is loading.
// Visual continuity matters more than shape accuracy here.
const ParcelIntelMap = dynamic(
  () => import('./parcel-intel-map').then((m) => m.ParcelIntelMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

type Props = {
  rows: ParcelIntelRow[];
  borough: string;
  boroughDisplayName: string;
  initialBbl?: string | null;
};

type SortKey =
  | 'score_calibrated'
  | 'lot_area_sqft'
  | 'last_sale_price'
  | 'years_held'
  | 'year_built'
  | 'num_floors'
  | 'allowed_far'
  | 'far_utilization_pct';

// Zoning families: first letter of zoning_district_1.
type ZoningFamily = 'R' | 'C' | 'M' | 'Other';

// Condensed land-use buckets for the filter dropdown. PLUTO has 11 codes;
// most users think in coarser product terms.
type LandUseFilter = 'all' | 'residential' | 'commercial' | 'industrial' | 'vacant';
type PriorityFilter = 'all' | 'highest' | 'high_or_better' | 'medium_or_better';
type OpportunityFilter =
  | 'all'
  | 'ground_up'
  | 'vacant_site'
  | 'ground_up_candidate'
  | 'conversion_or_overbuilt'
  | 'active_project';
const LAND_USE_GROUPS: Record<LandUseFilter, Set<string>> = {
  all: new Set(),
  residential: new Set(['01', '02', '03', '04']),
  commercial: new Set(['05']),
  industrial: new Set(['06']),
  vacant: new Set(['11']),
};

type Direction = 'asc' | 'desc';

const WATCHED_PARCEL_FIELDS = [
  'zoning_district_1',
  'land_use',
  'year_built',
  'allowed_far',
  'unused_floor_area_sqft',
  'owner_name',
  'last_sale_year',
  'latest_nb_filing_year',
  'latest_nb_status',
  'redev_status',
  'observed_imagery_year',
] as const satisfies readonly (keyof ParcelWorkflowSnapshot & keyof ParcelIntelRow)[];

export function hasWatchedParcelChanged(
  item: ParcelWorkflowItem,
  row: ParcelIntelRow,
): boolean {
  return WATCHED_PARCEL_FIELDS.some(
    (field) => (item.snapshot[field] ?? null) !== (row[field] ?? null),
  );
}

// Shared focus-ring style. Apply to every interactive element so keyboard
// users get a consistent visible affordance (sky-blue ring with an offset
// so it doesn't blend into adjacent surfaces).
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const SORT_LABELS: Record<SortKey, string> = {
  score_calibrated: 'Priority',
  lot_area_sqft: 'Lot',
  last_sale_price: 'Last sale',
  years_held: 'Held',
  year_built: 'Built',
  num_floors: 'Floors',
  allowed_far: 'FAR',
  far_utilization_pct: 'Util %',
};

function zoningFamilyOf(zone: string | null | undefined): ZoningFamily {
  const ch = (zone ?? '').trim().charAt(0).toUpperCase();
  if (ch === 'R' || ch === 'C' || ch === 'M') return ch;
  return 'Other';
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000) {
    // Strip trailing ".0" so $4.0M renders as $4M while $1.5M stays $1.5M.
    return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPriority(row: ParcelIntelRow): string {
  if (typeof row.priority_rank === 'number') return `#${row.priority_rank}`;
  return row.priority_tier ? `${row.priority_tier} priority` : 'Ranked';
}

function priorityTierLabel(value: ParcelIntelRow['priority_tier']): string {
  return {
    highest: 'Highest priority',
    high: 'High priority',
    medium: 'Medium priority',
    watch: 'Watch',
  }[value ?? 'watch'];
}

function opportunityLabel(value: ParcelIntelRow['opportunity_category']): string {
  return {
    vacant_site: 'Vacant site',
    ground_up_candidate: 'Ground-up candidate',
    conversion_or_overbuilt: 'Conversion / overbuilt',
    active_project: 'Active project',
    completed_project: 'Completed project',
  }[value ?? 'ground_up_candidate'];
}

// CSV serialization lives in ./parcel-intel-csv (pure `buildCsv` +
// browser-only `downloadCsv`) so the column contract is unit-testable.

// Table pagination: 100 rows per page keeps the DOM light at the
// 1000-row sweep size while staying simpler (and more testable) than
// windowed virtualization for these variable-height rows.
const PAGE_SIZE = 100;

// Generic NYC-blob silhouette for the loading placeholder. Not geographically
// accurate — its job is purely visual continuity between the gray skeleton
// and the real map tiles.
const NYC_SILHOUETTE =
  'M 100 200 Q 200 170 280 210 L 320 280 L 290 360 L 200 380 L 110 340 L 80 270 Z';

function MapSkeleton() {
  const silhouette = NYC_SILHOUETTE;
  // Placeholder marker positions, evenly distributed across the borough
  // silhouette. Color-coded to match the rank legend on the real map so
  // the visual idiom is consistent.
  const placeholders = [
    { cx: 220, cy: 220, r: 9, fill: '#dc2626' },
    { cx: 180, cy: 280, r: 7, fill: '#f59e0b' },
    { cx: 260, cy: 260, r: 7, fill: '#f59e0b' },
    { cx: 140, cy: 230, r: 6, fill: '#10b981' },
    { cx: 280, cy: 200, r: 6, fill: '#10b981' },
    { cx: 200, cy: 180, r: 5, fill: '#0ea5e9' },
    { cx: 160, cy: 320, r: 5, fill: '#0ea5e9' },
    { cx: 240, cy: 310, r: 5, fill: '#0ea5e9' },
  ];
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      role="status"
      aria-label="Loading map"
    >
      <svg
        viewBox="0 0 460 460"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(148,163,184,0.15)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="460" height="460" fill="url(#grid)" />
        <path
          d={silhouette}
          fill="rgba(226,232,240,0.7)"
          stroke="rgba(148,163,184,0.5)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {placeholders.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.fill}
            fillOpacity="0.5"
            stroke="white"
            strokeWidth="1.5"
          >
            <animate
              attributeName="fillOpacity"
              values="0.3;0.7;0.3"
              dur="2s"
              repeatCount="indefinite"
              begin={`${i * 0.15}s`}
            />
          </circle>
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-slate-500">
        Loading map …
      </div>
    </div>
  );
}

// Exported so the borough Server Component can render the same gate before it
// ever fetches the sweep — keeping parcel data out of the SSR HTML for
// unauthenticated visitors. `rowCount` is optional: the server path gates
// without a count (it deliberately skips the data fetch).
export function SignInGate({
  borough,
  boroughDisplayName,
  rowCount,
}: {
  borough: string;
  boroughDisplayName: string;
  rowCount?: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1 bg-sky-500" aria-hidden="true" />
      <div className="flex flex-col items-start gap-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
          <Lock className="h-3.5 w-3.5" />
          Account required
        </div>
        <h2 className="text-2xl font-semibold text-slate-950">
          Sign in to view {boroughDisplayName} parcel intelligence
        </h2>
        <p className="max-w-prose text-sm leading-6 text-slate-600">
          The parcel-level workspace surfaces address, BBL, recent sale prices, owner
          information, FAR utilization, LPC constraints, and per-parcel &quot;why this scored
          high&quot; reasoning derived from the underlying public data. We gate it behind a
          free account so we can rate-limit fairly and ensure the data is being used
          responsibly — these are real properties owned by real people, not anonymized
          fixtures.
        </p>
        <ul className="text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>
              {typeof rowCount === 'number' ? `${rowCount} ranked candidates` : 'Ranked candidates'}{' '}
              with full feature breakdown
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Borough-wide map with rank-coded markers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>CSV export of any sort + filter combination</span>
          </li>
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href={`/sign-in?next=${encodeURIComponent(`/parcel-intel/${borough}`)}`}
            onClick={() => trackEvent('gate_signin_click', { borough, cta: 'sign_in' })}
            className={`group inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 ${FOCUS_RING}`}
          >
            Sign in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={`/sign-up?next=${encodeURIComponent(`/parcel-intel/${borough}`)}`}
            onClick={() => trackEvent('gate_signin_click', { borough, cta: 'sign_up' })}
            className={`inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 ${FOCUS_RING}`}
          >
            Create a free account
          </Link>
          <Link
            href="/parcel-intel"
            className={`inline-flex h-10 items-center justify-center rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 ${FOCUS_RING}`}
          >
            Back to all boroughs
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          Free plan includes 5 CityLens runs per month. Parcel intelligence views don&apos;t consume run quota.
        </p>
      </div>
    </section>
  );
}

// Map internal SHAP roll-up names to user-facing labels. Names not present
// in the table fall through with a tidied-up version of the raw key.
const FEATURE_LABELS: Record<string, string> = {
  lot_area: 'Lot area',
  allowed_far: 'Allowed FAR',
  lot_huge_flag: 'Oversize lot',
  lot_tiny_flag: 'Undersize lot',
  assesstot_per_lot: 'Total assessment / lot',
  assessland_per_lot: 'Land assessment / lot',
  assessbldg_per_lot: 'Building assessment / lot',
  units: 'Residential units',
  zoning_district: 'Zoning',
  zoning_family: 'Zoning family',
  bldg_class: 'Building class',
  year_bucket: 'Build era',
  floors_bucket: 'Floors',
  land_use: 'Land use',
  borough: 'Borough',
  is_landmark: 'LPC landmark',
  is_historic_district: 'Historic district',
  last_sale_price: 'Last sale price',
  years_held: 'Years held',
  has_recent_sale_5yr: 'Recent sale (5 yr)',
  has_any_sale: 'Has ACRIS deed',
  last_sale_price_missing: 'Sale price missing',
  prior_nb_count: 'Prior NB permits',
  prior_alt_count: 'Prior ALT permits',
  prior_structural_count: 'Prior structural permits',
  prior_recent_nb_count: 'Recent NB permits',
  years_since_last_structural: 'Years since structural permit',
  years_since_last_structural_missing: 'No prior structural permit',
  block_prior_nb_count: 'Block prior NB permits',
  block_prior_structural_count: 'Block prior structural permits',
  block_redev_share: 'Block redevelopment share',
  change_added_count: 'CityLens added structures',
  change_modified_count: 'CityLens modified structures',
  change_demolished_count: 'CityLens demolished structures',
  change_run_count: 'CityLens run count',
  change_any_activity: 'CityLens activity flag',
};

function friendlyFeatureLabel(name: string): string {
  if (FEATURE_LABELS[name]) return FEATURE_LABELS[name];
  // Fallback: snake_case → Title case so unknown features still read.
  return name
    .split('_')
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
}

function formatFeatureValue(value: TopFeature['value']): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return String(value);
  }
  return value;
}

function ModelAttributionSection({ features }: { features: TopFeature[] }) {
  const [open, setOpen] = useState(false);
  if (features.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left ${FOCUS_RING}`}
      >
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Model attribution
          </h4>
          <p className="mt-0.5 text-xs leading-4 text-slate-500">
            What the model weighed for this parcel — top {features.length} features by
            absolute contribution to the score.
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {open && (
        <ul className="border-t border-slate-100 px-3 py-2">
          {features.map((feat, i) => {
            const positive = feat.contribution_logit >= 0;
            const widthPct = Math.min(Math.max(feat.contribution_pct * 100, 0), 100);
            const Icon = positive ? TrendingUp : TrendingDown;
            const iconClass = positive ? 'text-emerald-600' : 'text-rose-600';
            const barClass = positive ? 'bg-emerald-500' : 'bg-rose-500';
            return (
              <li key={`${feat.name}-${i}`} className="py-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden />
                  <span className="font-medium text-slate-900">
                    {friendlyFeatureLabel(feat.name)}
                  </span>
                  <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                    {formatFeatureValue(feat.value)}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                  aria-label={`${feat.contribution_pct.toFixed(2)} share of total contribution`}
                >
                  <div
                    className={`h-full ${barClass}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReasonChip({ reason }: { reason: Reason }) {
  const tone = {
    positive: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    neutral: 'bg-slate-50 text-slate-800 ring-slate-200',
    caution: 'bg-rose-50 text-rose-900 ring-rose-200',
  }[reason.tone];
  return (
    <li className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
        {reason.label}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{reason.detail}</p>
    </li>
  );
}

/**
 * Split a 10-digit BBL into its parts: 1-digit borough, 5-digit block,
 * 4-digit lot. City systems (ACRIS, ZoLa, BIS) want block/lot without
 * leading zeros. Returns null for malformed BBLs so callers can skip
 * the BBL-derived links entirely.
 */
export function parseBbl(
  bbl: string | null | undefined,
): { borough: string; block: string; lot: string } | null {
  const m = /^([1-5])(\d{5})(\d{4})$/.exec((bbl ?? '').trim());
  if (!m) return null;
  return {
    borough: m[1],
    block: String(Number(m[2])),
    lot: String(Number(m[3])),
  };
}

type ExternalParcelLink = { label: string; href: string };

/** External lookups for a parcel: city systems keyed by BBL, Google by centroid. */
export function externalParcelLinks(row: ParcelIntelRow): ExternalParcelLink[] {
  const links: ExternalParcelLink[] = [];
  const parts = parseBbl(row.bbl);
  if (parts) {
    const { borough, block, lot } = parts;
    links.push(
      {
        label: 'ACRIS',
        href: `https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${borough}&block=${block}&lot=${lot}`,
      },
      {
        label: 'ZoLa',
        href: `https://zola.planning.nyc.gov/l/lot/${borough}/${block}/${lot}`,
      },
      {
        label: 'DOB BIS',
        href: `https://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?allborough=${borough}&allblock=${block}&alllot=${lot}&go5=+GO+`,
      },
    );
  }
  if (typeof row.lat === 'number' && typeof row.lng === 'number') {
    links.push(
      {
        label: 'Google Maps',
        href: `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`,
      },
      {
        label: 'Street View',
        href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${row.lat},${row.lng}`,
      },
    );
  }
  return links;
}

function ParcelLinksRow({ row }: { row: ParcelIntelRow }) {
  const links = externalParcelLinks(row);
  if (links.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="External lookups">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 ${FOCUS_RING}`}
        >
          {link.label}
          <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function ParcelDetailPanel({
  row,
  onClose,
  workflowItem,
  workflowBusy,
  onSaveWorkflow,
  onRemoveWorkflow,
}: {
  row: ParcelIntelRow | null;
  onClose: () => void;
  workflowItem: ParcelWorkflowItem | null;
  workflowBusy: boolean;
  onSaveWorkflow: (draft: WorkflowDraft) => Promise<void>;
  onRemoveWorkflow: () => Promise<void>;
}) {
  if (!row) {
    return (
      <aside className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-slate-200">
          <MapPin className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">
          No parcel selected
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Click a row or a map marker to review why it was prioritized.
        </p>
      </aside>
    );
  }
  const reasons = explainParcel(row);
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            BBL {row.bbl}
          </div>
          <h3 className="mt-1 truncate text-lg font-semibold text-slate-950" title={row.address ?? ''}>
            {row.address || '—'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {row.zoning_district_1 ?? '—'} · land use {row.land_use ?? '—'} ·{' '}
            {row.year_built && row.year_built > 0 ? row.year_built : 'no build yr'}
          </p>
          <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200">
            {opportunityLabel(row.opportunity_category)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${FOCUS_RING}`}
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {row.owner_name?.trim() && (
          <div className="col-span-2 min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:col-span-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Owner
            </dt>
            <dd className="mt-0.5 truncate text-base font-semibold text-slate-950" title={row.owner_name}>
              {row.owner_name}
            </dd>
          </div>
        )}
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Priority
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {formatPriority(row)} · {priorityTierLabel(row.priority_tier)}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lot
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {formatNumber(row.lot_area_sqft)} sqft
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Allowed FAR
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {row.allowed_far ?? '—'}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Built %
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {typeof row.far_utilization_pct === 'number'
              ? `${row.far_utilization_pct.toFixed(0)}%`
              : '—'}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unused FAR (SF)
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {formatNumber(row.unused_floor_area_sqft)}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last sale
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {formatCurrency(row.last_sale_price)}
            {row.last_sale_year && (
              <span className="ml-1 text-xs text-slate-500">
                ({row.last_sale_year})
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Held
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {row.years_held ?? '—'} {row.years_held === 1 ? 'year' : 'years'}
          </dd>
        </div>
      </dl>

      {row.assemblage_id && (row.assemblage_lot_count ?? 0) >= 2 && (
        <section className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
            Assemblage opportunity · {row.assemblage_lot_count} adjacent lots
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-violet-900">
            <div><span className="block text-violet-600">Combined lot</span>{formatNumber(row.assemblage_combined_lot_area_sqft)} sqft</div>
            <div><span className="block text-violet-600">Combined envelope</span>{formatNumber(row.assemblage_combined_buildable_sqft)} sqft</div>
          </div>
          <p className="mt-2 font-mono text-[10px] text-violet-700">
            {(row.assemblage_member_bbls ?? []).join(' · ')}
          </p>
        </section>
      )}

      <ParcelLinksRow row={row} />

      {(row.recent_change ||
        row.is_landmark ||
        row.is_historic_district ||
        row.redev_status !== 'still_vacant') && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.recent_change && (
            <span
              className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-inset ring-emerald-200"
              title="Physical change observed in current aerial imagery compared with the 2017 baseline; verify the event date during diligence."
            >
              Change observed in 2017→{row.change_latest_imagery_year ?? 'latest'}
            </span>
          )}
          {row.redev_status === 'active' && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200"
              title="DOB has issued an NB permit on this BBL since the model's 2018 feature year, but the build hasn't been recorded as complete yet. The model still surfaces it as a similar-pattern candidate; verify against current DOB filings."
            >
              Active project{row.latest_nb_filing_year ? ` · NB ${row.latest_nb_filing_year}` : ''}
            </span>
          )}
          {row.redev_status === 'already_built' && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300"
              title="PLUTO records this parcel as built post-2018 with a meaningful built_far jump. The publisher normally filters these out; if you're seeing this, the data may be stale."
            >
              Already built
            </span>
          )}
          {row.is_landmark && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900 ring-1 ring-inset ring-rose-200">
              LPC landmark
            </span>
          )}
          {row.is_historic_district && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
              Historic district
            </span>
          )}
        </div>
      )}

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <div className="font-semibold text-slate-800">Current-fact provenance</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>PLUTO {row.property_facts_as_of ? `retrieved ${row.property_facts_as_of}` : 'date unavailable'}</span>
          <span>ACRIS {row.ownership_as_of ? `retrieved ${row.ownership_as_of}` : 'date unavailable'}</span>
          <span>DOB {row.project_activity_as_of ? `retrieved ${row.project_activity_as_of}` : 'date unavailable'}</span>
          {row.observed_imagery_year && <span>Imagery observed through {row.observed_imagery_year}</span>}
        </div>
        {row.property_facts_current === false && (
          <p className="mt-2 font-medium text-amber-800">
            Current lot match unavailable. Verify all capacity facts before acquisition use.
          </p>
        )}
        {(row.data_warnings ?? []).map((warning) => (
          <p key={warning} className="mt-1 text-amber-800">{warning}</p>
        ))}
      </div>

      <ParcelBriefActions row={row} />
      <LandBasisCalculator row={row} />
      <WorkflowEditor
        item={workflowItem}
        busy={workflowBusy}
        onSave={onSaveWorkflow}
        onRemove={onRemoveWorkflow}
      />

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Why CityLens prioritized it
        </h4>
        <ul className="mt-2 space-y-2">
          {reasons.length > 0 ? (
            reasons.map((r, i) => <ReasonChip key={i} reason={r} />)
          ) : (
            <li className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
              No single feature stands out — the model places this parcel in
              the top-N based on the aggregate of PLUTO, DOB, ACRIS, and LPC
              signals.
            </li>
          )}
        </ul>
      </div>

      <ModelAttributionSection features={row.top_features ?? []} />
    </aside>
  );
}

const DEFAULT_ZONING_FAMILIES: Set<ZoningFamily> = new Set([
  'R',
  'C',
  'M',
  'Other',
]);

export function ParcelIntelWorkspace({
  rows,
  borough,
  boroughDisplayName,
  initialBbl = null,
}: Props) {
  const auth = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>('score_calibrated');
  const [direction, setDirection] = useState<Direction>('desc');
  const [hideLandmarked, setHideLandmarked] = useState(false);
  const [selectedBbl, setSelectedBbl] = useState<string | null>(() =>
    initialBbl && rows.some((row) => row.bbl === initialBbl) ? initialBbl : null,
  );

  // Pagination (0-based page of PAGE_SIZE rows, with a "show all" escape
  // hatch). Sorting and filtering always operate on the FULL set; only
  // rendering is windowed.
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Start with the acquisition buyer's core use case: vacant and underbuilt
  // ground-up sites. Active and overbuilt projects remain one filter away.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [zoningFamilies, setZoningFamilies] = useState<Set<ZoningFamily>>(
    new Set(DEFAULT_ZONING_FAMILIES),
  );
  const [landUseFilter, setLandUseFilter] = useState<LandUseFilter>('all');
  const [recentSaleOnly, setRecentSaleOnly] = useState(false);
  const [recentChangeOnly, setRecentChangeOnly] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>('ground_up');
  const [pipelineOnly, setPipelineOnly] = useState(false);

  const [workflow, setWorkflow] = useState<Map<string, ParcelWorkflowItem>>(new Map());
  const [workflowBusyBbl, setWorkflowBusyBbl] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<ParcelSavedSearch[]>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [saveViewFrequency, setSaveViewFrequency] = useState<'off' | 'daily' | 'weekly'>('weekly');

  const authenticated = auth.status === 'authenticated';

  // Analytics: one workspace_open per authenticated mount (no PII —
  // borough only).
  const openTracked = useRef(false);
  useEffect(() => {
    if (!authenticated || openTracked.current) return;
    openTracked.current = true;
    trackEvent('workspace_open', { borough });
  }, [authenticated, borough]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    Promise.all([listParcelWorkflow(), listParcelSavedSearches()])
      .then(([items, searches]) => {
        if (cancelled) return;
        setWorkflow(
          new Map(
            items
              .filter((item) => item.borough === borough)
              .map((item) => [item.bbl, item]),
          ),
        );
        setSavedSearches(searches.filter((search) => search.borough === borough));
      })
      .catch(() => {
        if (!cancelled) setWorkflowError('Pipeline sync is temporarily unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, borough]);

  // Analytics: filter_change fires once per filter TYPE per mount, so a
  // dragged range slider or repeated toggles don't spam events.
  const trackedFilters = useRef<Set<string>>(new Set());
  const noteFilterChange = (filter: string) => {
    if (trackedFilters.current.has(filter)) return;
    trackedFilters.current.add(filter);
    trackEvent('filter_change', { borough, filter });
  };

  const filterCount =
    (hideLandmarked ? 1 : 0) +
    (zoningFamilies.size < 4 ? 1 : 0) +
    (landUseFilter !== 'all' ? 1 : 0) +
    (recentSaleOnly ? 1 : 0) +
    (recentChangeOnly ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (opportunityFilter !== 'ground_up' ? 1 : 0) +
    (pipelineOnly ? 1 : 0);

  const resetFilters = () => {
    setHideLandmarked(false);
    setZoningFamilies(new Set(DEFAULT_ZONING_FAMILIES));
    setLandUseFilter('all');
    setRecentSaleOnly(false);
    setRecentChangeOnly(false);
    setPriorityFilter('all');
    setOpportunityFilter('ground_up');
    setPipelineOnly(false);
  };

  const toggleZoningFamily = (fam: ZoningFamily) => {
    setZoningFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(fam)) {
        next.delete(fam);
      } else {
        next.add(fam);
      }
      // Don't allow zero zoning families — that'd render an empty list
      // with no good way to recover from one click.
      return next.size === 0 ? new Set(DEFAULT_ZONING_FAMILIES) : next;
    });
  };

  const filtered = useMemo(() => {
    const luSet = LAND_USE_GROUPS[landUseFilter];
    const tierWeight = { highest: 0, high: 1, medium: 2, watch: 3 } as const;
    const maxTier = {
      all: 3,
      highest: 0,
      high_or_better: 1,
      medium_or_better: 2,
    }[priorityFilter];
    return rows.filter((r) => {
      if (hideLandmarked && (r.is_landmark || r.is_historic_district)) return false;
      if (!zoningFamilies.has(zoningFamilyOf(r.zoning_district_1))) return false;
      if (luSet.size > 0 && !luSet.has(r.land_use ?? '')) return false;
      if (recentSaleOnly && !r.has_recent_sale_5yr) return false;
      if (recentChangeOnly && !r.recent_change) return false;
      if (tierWeight[r.priority_tier ?? 'watch'] > maxTier) return false;
      if (
        opportunityFilter === 'ground_up' &&
        !['vacant_site', 'ground_up_candidate'].includes(
          r.opportunity_category ?? 'ground_up_candidate',
        )
      ) return false;
      if (
        opportunityFilter !== 'all' &&
        opportunityFilter !== 'ground_up' &&
        r.opportunity_category !== opportunityFilter
      ) return false;
      if (pipelineOnly && !workflow.has(r.bbl)) return false;
      return true;
    });
  }, [
    rows,
    hideLandmarked,
    zoningFamilies,
    landUseFilter,
    recentSaleOnly,
    recentChangeOnly,
    priorityFilter,
    opportunityFilter,
    pipelineOnly,
    workflow,
  ]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return direction === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return out;
  }, [filtered, sortKey, direction]);

  const selected = useMemo(
    () => rows.find((r) => r.bbl === selectedBbl) ?? null,
    [rows, selectedBbl],
  );

  // Any change to the filter/sort configuration resets to the first page —
  // the previous page offset is meaningless against a reordered set.
  useEffect(() => {
    setPage(0);
  }, [
    sortKey,
    direction,
    hideLandmarked,
    zoningFamilies,
    landUseFilter,
    recentSaleOnly,
    recentChangeOnly,
    priorityFilter,
    opportunityFilter,
    pipelineOnly,
  ]);

  const watchedUpdates = useMemo(
    () =>
      rows.filter((row) => {
        const item = workflow.get(row.bbl);
        if (!item?.watching) return false;
        return hasWatchedParcelChanged(item, row);
      }).length,
    [rows, workflow],
  );

  const saveWorkflowForSelected = async (draft: WorkflowDraft) => {
    if (!selected) return;
    const previous = workflow.get(selected.bbl);
    setWorkflowBusyBbl(selected.bbl);
    setWorkflowError(null);
    const now = new Date().toISOString();
    const optimistic: ParcelWorkflowItem = {
      bbl: selected.bbl,
      borough,
      ...draft,
      snapshot: {
        property_facts_as_of: selected.property_facts_as_of ?? null,
        zoning_district_1: selected.zoning_district_1,
        land_use: selected.land_use,
        year_built: selected.year_built,
        allowed_far: selected.allowed_far,
        unused_floor_area_sqft: selected.unused_floor_area_sqft,
        owner_name: selected.owner_name ?? null,
        last_sale_year: selected.last_sale_year,
        latest_nb_filing_year: selected.latest_nb_filing_year ?? null,
        latest_nb_status: selected.latest_nb_status ?? null,
        redev_status: selected.redev_status,
        observed_imagery_year: selected.observed_imagery_year ?? null,
      },
      saved_at: workflow.get(selected.bbl)?.saved_at ?? now,
      updated_at: now,
    };
    setWorkflow((current) => new Map(current).set(selected.bbl, optimistic));
    try {
      const saved = await saveParcelWorkflow(selected.bbl, {
        borough,
        ...draft,
        snapshot: optimistic.snapshot,
      });
      setWorkflow((current) => new Map(current).set(selected.bbl, saved));
      trackEvent('parcel_pipeline_save', { borough, stage: draft.stage });
    } catch {
      setWorkflow((current) => {
        const next = new Map(current);
        if (previous) next.set(selected.bbl, previous);
        else next.delete(selected.bbl);
        return next;
      });
      setWorkflowError('Could not save this parcel. Please retry.');
    } finally {
      setWorkflowBusyBbl(null);
    }
  };

  const removeSelectedFromWorkflow = async () => {
    if (!selected) return;
    const previous = workflow.get(selected.bbl);
    setWorkflowBusyBbl(selected.bbl);
    setWorkflow((current) => {
      const next = new Map(current);
      next.delete(selected.bbl);
      return next;
    });
    try {
      await removeParcelWorkflow(selected.bbl);
      trackEvent('parcel_pipeline_remove', { borough });
    } catch {
      if (previous) setWorkflow((current) => new Map(current).set(selected.bbl, previous));
      setWorkflowError('Could not remove this parcel. Please retry.');
    } finally {
      setWorkflowBusyBbl(null);
    }
  };

  const applySavedSearch = (search: ParcelSavedSearch) => {
    const f = search.filters;
    setLandUseFilter(f.landUseFilter);
    setPriorityFilter(f.priorityFilter);
    setOpportunityFilter(f.opportunityFilter);
    setHideLandmarked(Boolean(f.hideLandmarked));
    setRecentSaleOnly(Boolean(f.recentSaleOnly));
    setRecentChangeOnly(Boolean(f.recentChangeOnly));
    setPipelineOnly(Boolean(f.pipelineOnly));
    if (f.zoningFamilies.length > 0) {
      setZoningFamilies(new Set(f.zoningFamilies));
    }
    setSortKey(f.sortKey);
    setDirection(f.direction);
    trackEvent('parcel_saved_search_apply', { borough, cadence: search.alert_frequency });
  };

  const deleteSavedSearch = async (search: ParcelSavedSearch) => {
    const previousIndex = savedSearches.findIndex(
      (candidate) => candidate.search_id === search.search_id,
    );
    setSavedSearches((current) =>
      current.filter((candidate) => candidate.search_id !== search.search_id),
    );
    setWorkflowError(null);
    try {
      await removeParcelSavedSearch(search.search_id);
      trackEvent('parcel_saved_search_remove', { borough });
    } catch {
      setSavedSearches((current) => {
        const next = [...current];
        next.splice(Math.max(previousIndex, 0), 0, search);
        return next;
      });
      setWorkflowError('Could not remove this saved view. Please retry.');
    }
  };

  const persistCurrentView = async () => {
    const name = saveViewName.trim();
    if (!name) return;
    const searchId = `${borough}-${Date.now().toString(36)}`;
    try {
      const saved = await saveParcelSearch(searchId, {
        name,
        borough,
        alert_frequency: saveViewFrequency,
        filters: {
          landUseFilter,
          priorityFilter,
          opportunityFilter,
          hideLandmarked,
          recentSaleOnly,
          recentChangeOnly,
          pipelineOnly,
          zoningFamilies: Array.from(zoningFamilies),
          sortKey,
          direction,
        },
      });
      setSavedSearches((current) => [...current, saved]);
      setSaveViewName('');
      setSaveViewOpen(false);
      trackEvent('parcel_saved_search', { borough, cadence: saveViewFrequency });
    } catch {
      setWorkflowError('Could not save this view. Please retry.');
    }
  };

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const visible = showAll
    ? sorted
    : sorted.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);
  const visibleStart = showAll ? 0 : clampedPage * PAGE_SIZE;

  // Scroll the selected row into view in the list when picked from map —
  // jumping to its page first if pagination has it off-screen. jsdom
  // doesn't implement scrollIntoView, so guard for the test environment
  // (and any odd browsers that don't ship it).
  useEffect(() => {
    if (!selectedBbl) return;
    if (!showAll) {
      const idx = sorted.findIndex((r) => r.bbl === selectedBbl);
      if (idx >= 0) {
        const targetPage = Math.floor(idx / PAGE_SIZE);
        if (targetPage !== clampedPage) {
          setPage(targetPage);
          return; // effect re-runs after the page renders, then scrolls
        }
      }
    }
    const el = document.getElementById(`parcel-row-${selectedBbl}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedBbl, sorted, showAll, clampedPage]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('desc');
    }
  };

  // Plain helper rather than an inline component so we don't trip the
  // react-hooks/static-components rule when used at multiple call sites.
  const renderSortIcon = (k: SortKey) => {
    if (sortKey !== k)
      return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return direction === 'desc' ? (
      <ChevronDown className="h-3 w-3 text-slate-700" />
    ) : (
      <ChevronUp className="h-3 w-3 text-slate-700" />
    );
  };

  // Auth gate. While auth is still resolving (e.g. mockAuth or Neon
  // booting), render the gate — protects the data even briefly.
  if (auth.status !== 'authenticated') {
    return (
      <SignInGate
        borough={borough}
        boroughDisplayName={boroughDisplayName}
        rowCount={rows.length}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(440px,520px)]">
      {/* MAP — left pane */}
      <div className="order-2 h-[400px] lg:order-1 lg:h-[680px]">
        <ParcelIntelMap
          borough={borough}
          rows={sorted}
          selectedBbl={selectedBbl}
          onSelect={(bbl) => setSelectedBbl(bbl)}
        />
      </div>

      {/* LIST + DETAIL — right pane */}
      <div className="order-1 flex flex-col gap-4 lg:order-2">
        {(workflowError || watchedUpdates > 0) && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${workflowError ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            {workflowError ?? `${watchedUpdates} watched parcel${watchedUpdates === 1 ? '' : 's'} changed since you saved them.`}
          </div>
        )}

        {savedSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Saved views</span>
            {savedSearches.map((search) => (
              <span
                key={search.search_id}
                className="inline-flex h-7 items-center overflow-hidden rounded-full border border-slate-300 bg-white text-xs text-slate-700"
              >
                <button
                  type="button"
                  onClick={() => applySavedSearch(search)}
                  title={`${search.alert_frequency} review cadence`}
                  className={`inline-flex h-full items-center gap-1 px-2.5 hover:bg-slate-50 ${FOCUS_RING}`}
                >
                  {search.alert_frequency !== 'off' && <Bell className="h-3 w-3" />}
                  {search.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete saved view ${search.name}`}
                  onClick={() => void deleteSavedSearch(search)}
                  className={`inline-flex h-full items-center border-l border-slate-200 px-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 ${FOCUS_RING}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="parcel-intel-filters"
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 hover:bg-slate-50 ${FOCUS_RING}`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {filterCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                  {filterCount}
                </span>
              )}
              {filtersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              aria-pressed={pipelineOnly}
              onClick={() => setPipelineOnly((value) => !value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${FOCUS_RING} ${pipelineOnly ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
            >
              <Bookmark className="h-3.5 w-3.5" /> Pipeline ({workflow.size})
            </button>
            <button
              type="button"
              onClick={() => setSaveViewOpen((value) => !value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 hover:bg-slate-50 ${FOCUS_RING}`}
            >
              <Save className="h-3.5 w-3.5" /> Save view
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {sorted.length} of {rows.length}
            </span>
            <button
              type="button"
              disabled={sorted.length === 0}
              title={
                sorted.length === 0
                  ? 'No rows match your filters — nothing to export'
                  : `Export all ${sorted.length} filtered rows as CSV`
              }
              onClick={() => {
                // Exports ALL filtered rows (not just the visible page).
                downloadCsv(sorted, borough);
                trackEvent('csv_export', { borough, rows: sorted.length });
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white ${FOCUS_RING}`}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        {saveViewOpen && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="min-w-48 flex-1 text-xs font-medium text-slate-700">
              View name
              <input
                value={saveViewName}
                onChange={(event) => setSaveViewName(event.target.value)}
                placeholder="High-priority vacant sites"
                className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Review cadence
              <select
                value={saveViewFrequency}
                onChange={(event) => setSaveViewFrequency(event.target.value as 'off' | 'daily' | 'weekly')}
                className={`mt-1 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="off">Off</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!saveViewName.trim()}
              onClick={() => void persistCurrentView()}
              className={`h-9 rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50 ${FOCUS_RING}`}
            >
              Save current filters
            </button>
          </div>
        )}

        {filtersOpen && (
          <div
            id="parcel-intel-filters"
            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Zoning family pills */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Zoning
                </span>
                <div className="flex gap-1">
                  {(['R', 'C', 'M', 'Other'] as ZoningFamily[]).map((fam) => {
                    const active = zoningFamilies.has(fam);
                    return (
                      <button
                        key={fam}
                        type="button"
                        onClick={() => {
                          noteFilterChange('zoning_family');
                          toggleZoningFamily(fam);
                        }}
                        aria-pressed={active}
                        className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium ${FOCUS_RING} ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {fam}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Land use bucket */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="parcel-intel-landuse"
                  className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Land use
                </label>
                <select
                  id="parcel-intel-landuse"
                  value={landUseFilter}
                  onChange={(e) => {
                    noteFilterChange('land_use');
                    setLandUseFilter(e.target.value as LandUseFilter);
                  }}
                  className={`h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 ${FOCUS_RING}`}
                >
                  <option value="all">All</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="vacant">Vacant land</option>
                </select>
              </div>

              {/* Landmarks, sale recency, and aerial-change toggles */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Filters
                </span>
                <div className="flex gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={hideLandmarked}
                      onChange={(e) => {
                        noteFilterChange('hide_landmarked');
                        setHideLandmarked(e.target.checked);
                      }}
                      className={`h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-700 ${FOCUS_RING}`}
                    />
                    Hide landmarked
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={recentSaleOnly}
                      onChange={(e) => {
                        noteFilterChange('recent_sale');
                        setRecentSaleOnly(e.target.checked);
                      }}
                      className={`h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-700 ${FOCUS_RING}`}
                    />
                    Sold in last 5 yrs
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={recentChangeOnly}
                      onChange={(e) => {
                        noteFilterChange('recent_change');
                        setRecentChangeOnly(e.target.checked);
                      }}
                      className={`h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-700 ${FOCUS_RING}`}
                    />
                    Recently changed
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="parcel-intel-priority" className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Priority
                </label>
                <select
                  id="parcel-intel-priority"
                  value={priorityFilter}
                  onChange={(event) => {
                    noteFilterChange('priority');
                    setPriorityFilter(event.target.value as PriorityFilter);
                  }}
                  className={`h-7 rounded-md border border-slate-300 bg-white px-2 text-xs ${FOCUS_RING}`}
                >
                  <option value="all">All ranks</option>
                  <option value="highest">Highest only</option>
                  <option value="high_or_better">High or better</option>
                  <option value="medium_or_better">Medium or better</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="parcel-intel-opportunity" className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Opportunity
                </label>
                <select
                  id="parcel-intel-opportunity"
                  value={opportunityFilter}
                  onChange={(event) => {
                    noteFilterChange('opportunity');
                    setOpportunityFilter(event.target.value as OpportunityFilter);
                  }}
                  className={`h-7 rounded-md border border-slate-300 bg-white px-2 text-xs ${FOCUS_RING}`}
                >
                  <option value="all">All categories</option>
                  <option value="ground_up">Ground-up acquisition sites</option>
                  <option value="vacant_site">Vacant sites</option>
                  <option value="ground_up_candidate">Ground-up candidates</option>
                  <option value="conversion_or_overbuilt">Conversion / overbuilt</option>
                  <option value="active_project">Active projects</option>
                </select>
              </div>

              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className={`ml-auto inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 ${FOCUS_RING}`}
                >
                  Reset all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detail panel */}
        <ParcelDetailPanel
          row={selected}
          onClose={() => setSelectedBbl(null)}
          workflowItem={selected ? workflow.get(selected.bbl) ?? null : null}
          workflowBusy={selected ? workflowBusyBbl === selected.bbl : false}
          onSaveWorkflow={saveWorkflowForSelected}
          onRemoveWorkflow={removeSelectedFromWorkflow}
        />

        {/* Compact list */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Address · BBL</th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('score_calibrated')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.score_calibrated}
                      {renderSortIcon('score_calibrated')}
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('lot_area_sqft')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.lot_area_sqft}
                      {renderSortIcon('lot_area_sqft')}
                    </button>
                  </th>
                  {/* Last sale and Held are hidden on narrow viewports;
                      a compact inline summary surfaces them under the
                      Address · BBL cell instead. */}
                  <th className="hidden px-3 py-2 sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('last_sale_price')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.last_sale_price}
                      {renderSortIcon('last_sale_price')}
                    </button>
                  </th>
                  <th className="hidden px-3 py-2 sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('years_held')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.years_held}
                      {renderSortIcon('years_held')}
                    </button>
                  </th>
                  <th className="hidden px-3 py-2 lg:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('year_built')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.year_built}
                      {renderSortIcon('year_built')}
                    </button>
                  </th>
                  <th className="hidden px-3 py-2 lg:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('num_floors')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.num_floors}
                      {renderSortIcon('num_floors')}
                    </button>
                  </th>
                  <th className="hidden px-3 py-2 lg:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('allowed_far')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.allowed_far}
                      {renderSortIcon('allowed_far')}
                    </button>
                  </th>
                  <th className="hidden px-3 py-2 lg:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('far_utilization_pct')}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-slate-900 ${FOCUS_RING}`}
                    >
                      {SORT_LABELS.far_utilization_pct}
                      {renderSortIcon('far_utilization_pct')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <p className="text-sm text-slate-600">
                        No parcels match your filters.
                      </p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className={`mt-2 inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50 ${FOCUS_RING}`}
                      >
                        Clear all filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  visible.map((r, i) => {
                    const isSel = r.bbl === selectedBbl;
                    const ariaLabel = `Open detail for ${r.address || '—'}, BBL ${r.bbl}`;
                    return (
                      <tr
                        key={r.bbl}
                        id={`parcel-row-${r.bbl}`}
                        role="button"
                        tabIndex={0}
                        aria-label={ariaLabel}
                        onClick={() => setSelectedBbl(r.bbl)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedBbl(r.bbl);
                          }
                        }}
                        className={`cursor-pointer transition-colors ${FOCUS_RING} ${
                          isSel ? 'bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-slate-500">{visibleStart + i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {r.address || '—'}
                          </div>
                          <div className="font-mono text-xs text-slate-500">
                            {r.bbl}
                            {workflow.has(r.bbl) && (
                              <span className="ml-1 rounded-full bg-sky-50 px-1 font-sans text-sky-800">
                                {WORKFLOW_STAGE_LABELS[workflow.get(r.bbl)!.stage]}
                              </span>
                            )}
                            {r.is_landmark && (
                              <span className="ml-1 rounded-full bg-rose-50 px-1 text-rose-700">
                                LPC
                              </span>
                            )}
                            {r.is_historic_district && !r.is_landmark && (
                              <span className="ml-1 rounded-full bg-amber-50 px-1 text-amber-700">
                                HD
                              </span>
                            )}
                          </div>
                          {/* Mobile-only: surface the columns we hide
                              below sm so users on narrow screens still
                              see sale + holding. */}
                          <div className="text-xs text-slate-500 sm:hidden">
                            {formatCurrency(r.last_sale_price)} ·{' '}
                            {r.years_held ?? '—'}y held
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {opportunityLabel(r.opportunity_category)}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          <div>{formatPriority(r)}</div>
                          <div className="text-[10px] font-normal text-slate-500">
                            {priorityTierLabel(r.priority_tier)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          {formatNumber(r.lot_area_sqft)}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-700 sm:table-cell">
                          {formatCurrency(r.last_sale_price)}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-700 sm:table-cell">
                          {r.years_held ?? '—'}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-700 lg:table-cell">
                          {r.year_built && r.year_built > 0 ? r.year_built : '—'}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-700 lg:table-cell">
                          {r.num_floors ?? '—'}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-700 lg:table-cell">
                          {r.allowed_far ?? '—'}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-700 lg:table-cell">
                          {typeof r.far_utilization_pct === 'number'
                            ? `${r.far_utilization_pct.toFixed(0)}%`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer — only when there's more than one page's
              worth of rows. CSV export always covers ALL filtered rows. */}
          {sorted.length > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-600">
                {showAll
                  ? `Showing all ${sorted.length} parcels`
                  : `Showing ${visibleStart + 1}–${Math.min(
                      visibleStart + PAGE_SIZE,
                      sorted.length,
                    )} of ${sorted.length}`}
              </span>
              <div className="flex items-center gap-1.5">
                {!showAll && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={clampedPage === 0}
                      aria-label="Previous page"
                      className={`inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white ${FOCUS_RING}`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </button>
                    <span className="px-1 text-xs tabular-nums text-slate-600">
                      {clampedPage + 1} / {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={clampedPage >= pageCount - 1}
                      aria-label="Next page"
                      className={`inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white ${FOCUS_RING}`}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowAll((v) => !v);
                    setPage(0);
                  }}
                  className={`inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 ${FOCUS_RING}`}
                >
                  {showAll ? 'Show pages' : `Show all ${sorted.length}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
