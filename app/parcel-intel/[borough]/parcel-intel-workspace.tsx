'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Lock,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import type { ParcelIntelRow, TopFeature } from '@/lib/api';
import { explainParcel, type Reason } from './parcel-intel-explain';

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
};

type SortKey =
  | 'score_calibrated'
  | 'lot_area_sqft'
  | 'last_sale_price'
  | 'years_held';

type Direction = 'asc' | 'desc';

const SORT_LABELS: Record<SortKey, string> = {
  score_calibrated: 'Score',
  lot_area_sqft: 'Lot',
  last_sale_price: 'Last sale',
  years_held: 'Held',
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function downloadCSV(rows: ParcelIntelRow[], borough: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]) as (keyof ParcelIntelRow)[];
  const csv = [headers.join(',')]
    .concat(
      rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h];
            if (v === null || v === undefined) return '';
            if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
              return `"${v.replace(/"/g, '""')}"`;
            }
            return String(v);
          })
          .join(','),
      ),
    )
    .join('\n');
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

function SignInGate({
  borough,
  boroughDisplayName,
  rowCount,
}: {
  borough: string;
  boroughDisplayName: string;
  rowCount: number;
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
          information, FAR utilization, LPC constraints, and per-parcel "why this scored
          high" reasoning derived from the underlying public data. We gate it behind a
          free account so we can rate-limit fairly and ensure the data is being used
          responsibly — these are real properties owned by real people, not anonymized
          fixtures.
        </p>
        <ul className="text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{rowCount} ranked candidates with full feature breakdown</span>
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
            className="group inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={`/sign-up?next=${encodeURIComponent(`/parcel-intel/${borough}`)}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Create a free account
          </Link>
          <Link
            href="/parcel-intel"
            className="inline-flex h-10 items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-900"
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
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Model attribution
          </h4>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
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
                  <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
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
    caution: 'bg-rose-50 text-rose-800 ring-rose-200',
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

function ParcelDetailPanel({
  row,
  onClose,
}: {
  row: ParcelIntelRow | null;
  onClose: () => void;
}) {
  if (!row) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <Info className="mx-auto h-5 w-5 text-slate-400" />
        <p className="mt-2 text-xs text-slate-500">
          Click a row or a map marker to see why it scored high.
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
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Score
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {formatScore(row.score_calibrated)}
          </dd>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Lot
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {formatNumber(row.lot_area_sqft)} sqft
          </dd>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Allowed FAR
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {row.allowed_far ?? '—'}
          </dd>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Built %
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {typeof row.far_utilization_pct === 'number'
              ? `${row.far_utilization_pct.toFixed(0)}%`
              : '—'}
          </dd>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Held
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-950">
            {row.years_held ?? '—'} {row.years_held === 1 ? 'year' : 'years'}
          </dd>
        </div>
      </dl>

      {(row.is_landmark || row.is_historic_district) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.is_landmark && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
              LPC landmark
            </span>
          )}
          {row.is_historic_district && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Historic district
            </span>
          )}
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Why it scored high
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

export function ParcelIntelWorkspace({ rows, borough, boroughDisplayName }: Props) {
  const auth = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>('score_calibrated');
  const [direction, setDirection] = useState<Direction>('desc');
  const [hideLandmarked, setHideLandmarked] = useState(false);
  const [selectedBbl, setSelectedBbl] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      hideLandmarked
        ? rows.filter((r) => !r.is_landmark && !r.is_historic_district)
        : rows,
    [rows, hideLandmarked],
  );

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
    () => sorted.find((r) => r.bbl === selectedBbl) ?? null,
    [sorted, selectedBbl],
  );

  // Scroll the selected row into view in the list when picked from map.
  // jsdom doesn't implement scrollIntoView, so guard for the test
  // environment (and any odd browsers that don't ship it).
  useEffect(() => {
    if (!selectedBbl) return;
    const el = document.getElementById(`parcel-row-${selectedBbl}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedBbl]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
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
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={hideLandmarked}
              onChange={(e) => setHideLandmarked(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-700"
            />
            Hide landmarked
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCSV(sorted, borough)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV ({sorted.length})
            </button>
          </div>
        </div>

        {/* Detail panel */}
        <ParcelDetailPanel row={selected} onClose={() => setSelectedBbl(null)} />

        {/* Compact list */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Address · BBL</th>
                  {(
                    [
                      'score_calibrated',
                      'lot_area_sqft',
                      'last_sale_price',
                      'years_held',
                    ] as SortKey[]
                  ).map((k) => (
                    <th key={k} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleSort(k)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        {SORT_LABELS[k]}
                        <SortIcon k={k} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((r, i) => {
                  const isSel = r.bbl === selectedBbl;
                  return (
                    <tr
                      key={r.bbl}
                      id={`parcel-row-${r.bbl}`}
                      onClick={() => setSelectedBbl(r.bbl)}
                      className={`cursor-pointer transition-colors ${
                        isSel ? 'bg-sky-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">
                          {r.address || '—'}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {r.bbl}
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
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {formatScore(r.score_calibrated)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {formatNumber(r.lot_area_sqft)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {formatCurrency(r.last_sale_price)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {r.years_held ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
