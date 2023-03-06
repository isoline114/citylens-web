'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Download,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MapPinned,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  getParcelIntelSweep,
  type ParcelIntelBorough,
  type ParcelIntelRow,
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
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  boroughs: ParcelIntelBorough[];
  initialBorough?: string | null;
  initialBbl?: string | null;
};

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
  const [rows, setRows] = useState<ParcelIntelRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [failedBoroughs, setFailedBoroughs] = useState<string[]>([]);
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
  const [leadLimit, setLeadLimit] = useState(30);

  const isAuthenticated = auth.status === 'authenticated';
  const totalAvailable = boroughs.reduce((sum, borough) => sum + borough.count, 0);

  useEffect(() => {
    if (auth.status === 'loading' || boroughs.length === 0) return;
    let cancelled = false;
    setLoadState('loading');
    setFailedBoroughs([]);

    void Promise.allSettled(
      boroughs.map(async (borough) => {
        const sweep = await getParcelIntelSweep(borough.slug, 1000, {
          includeAuth: isAuthenticated,
        });
        return sweep.rows.map((row) => ({
          ...row,
          // The API uses compact NYC codes (for example, "BK") while the
          // application routes and filters use canonical slugs ("brooklyn").
          // The request already establishes the row's borough, so normalize
          // it at this boundary before it reaches links, filters, or overlays.
          borough: borough.slug,
        }));
      }),
    ).then((results) => {
      if (cancelled) return;
      const nextRows: ParcelIntelRow[] = [];
      const failures: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') nextRows.push(...result.value);
        else failures.push(boroughs[index]?.slug ?? `borough-${index + 1}`);
      });
      const unique = new Map(nextRows.map((row) => [row.bbl, row]));
      setRows([...unique.values()]);
      setFailedBoroughs(failures);
      setLoadState(unique.size > 0 ? 'ready' : 'error');
    });

    return () => {
      cancelled = true;
    };
  }, [auth.status, boroughs, isAuthenticated]);

  const filtered = useMemo(
    () => filterExplorerRows(rows, filters),
    [rows, filters],
  );
  const opportunityScope = useMemo(
    () => filterExplorerRows(rows, { ...filters, opportunity: 'all' }),
    [rows, filters],
  );
  const ranked = useMemo(() => sortExplorerRows(filtered), [filtered]);
  const selected = useMemo(
    () => rows.find((row) => row.bbl === selectedBbl) ?? null,
    [rows, selectedBbl],
  );
  const activeProjectCount = opportunityScope.filter(
    (row) => row.opportunity_category === 'active_project',
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
    setFilters((current) => ({ ...current, [key]: value }));
    setLeadLimit(30);
    const nextBorough = key === 'borough' ? String(value) : filters.borough;
    if (selectedBbl) {
      setSelectedBbl(null);
    }
    if (key === 'borough' || selectedBbl) syncExplorerUrl(nextBorough, null);
  };

  const selectParcel = (bbl: string) => {
    setSelectedBbl(bbl);
    syncExplorerUrl(filters.borough, bbl);
  };

  const closeParcel = () => {
    setSelectedBbl(null);
    syncExplorerUrl(filters.borough, null);
  };

  const resetExplorer = () => {
    setFilters(DEFAULT_FILTERS);
    setLeadLimit(30);
    setSelectedBbl(null);
    syncExplorerUrl('all', null);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_-42px_rgba(15,23,42,0.42)]">
      <div className="relative overflow-hidden bg-slate-950 px-5 py-6 text-white md:px-8 md:py-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
              <MapPinned className="h-4 w-4" />
              Citywide opportunity explorer
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] md:text-4xl">
              See the whole market, then open the parcel.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base md:leading-7">
              Compare ranked redevelopment signals across all five boroughs. Separate
              uncommitted candidates from active projects, narrow the opportunity set,
              and open a parcel&apos;s full screening workspace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[470px]">
            {[
              ['Coverage', `${boroughs.length} boroughs`],
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
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className="mt-1 text-base font-semibold text-white md:text-lg">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex self-start rounded-xl border border-white/10 bg-white/5 p-1">
            {(['priority', 'opportunity', 'borough'] as ExplorerOverlay[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOverlay(value)}
                  aria-pressed={overlay === value}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium capitalize transition-colors ${
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
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {auth.status === 'loading' ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : isAuthenticated ? (
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
            )}
            {isAuthenticated
              ? `Full workspace coverage · ${totalAvailable.toLocaleString()} available`
              : `Preview coverage · sign in to load all ${totalAvailable.toLocaleString()}`}
          </div>
        </div>
      </div>

      {!isAuthenticated && auth.status !== 'loading' && (
        <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <span>
            You&apos;re viewing the top public slice from each borough. A free account
            unlocks the broader five-borough candidate set and parcel workspaces.
          </span>
          <Link
            href="/sign-in?next=%2Fparcel-intel"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-medium text-white hover:bg-slate-800"
          >
            Sign in for the full map
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3.5 md:px-6">
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,0.7fr))_auto]">
          <label className="relative">
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
              disabled={ranked.length === 0}
              onClick={() =>
                downloadCsv(
                  ranked,
                  filters.borough === 'all' ? 'citywide' : filters.borough,
                )
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Export ${ranked.length.toLocaleString()} filtered parcels`}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
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
          {auth.status === 'loading' || loadState === 'idle' || loadState === 'loading' ? (
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
              overlay={overlay}
              onSelect={selectParcel}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-slate-200 bg-white lg:h-[760px] lg:border-l lg:border-t-0">
          {selected ? (
            <ParcelIntelPropertyPanel
              key={selected.bbl}
              row={selected}
              onClose={closeParcel}
            />
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
            <button
              type="button"
              onClick={() => updateFilter('opportunity', 'active_project')}
              aria-pressed={filters.opportunity === 'active_project'}
              className={`rounded-xl px-3 py-2 text-left transition-colors ${
                filters.opportunity === 'active_project'
                  ? 'bg-amber-100 ring-2 ring-inset ring-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wide text-amber-700">
                Active projects
              </div>
              <div className="text-lg font-semibold text-amber-950">
                {activeProjectCount.toLocaleString()}
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
          <div className="min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-[560px]">
            {ranked.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No parcels match these filters.
              </div>
            ) : (
              ranked.slice(0, leadLimit).map((row) => (
                <button
                  key={row.bbl}
                  type="button"
                  onClick={() => selectParcel(row.bbl)}
                  className={`mb-1 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
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
            {ranked.length > leadLimit && (
              <button
                type="button"
                onClick={() => setLeadLimit((current) => current + 30)}
                className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
              >
                Show 30 more · {ranked.length - leadLimit} remaining
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
    </section>
  );
}
