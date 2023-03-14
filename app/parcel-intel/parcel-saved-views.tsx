'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  GitCompareArrows,
  History,
  LoaderCircle,
  Radar,
  RefreshCw,
  Save,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import {
  listParcelSavedSearches,
  removeParcelSavedSearch,
  saveParcelSearch,
  type ParcelSavedSearch,
} from '@/lib/api';
import {
  BOROUGH_LABELS,
  buildSavedViewMonitor,
  buildExplorerScreenComparison,
  explorerFiltersFromSavedSearch,
  filterExplorerRows,
  savedSearchDimensions,
  signalLabel,
  siteTypeLabel,
  type ExplorerFilters,
  type ExplorerOverlay,
  type ParcelExplorerRow,
  type ExplorerPriority,
  type SavedViewMonitor,
} from './parcel-intel-explorer-support';
import { ParcelSavedScreenComparison } from './parcel-saved-screen-comparison';

type SavedViewDraft = {
  borough: string;
  filters: ExplorerFilters;
  overlay: ExplorerOverlay;
};

const PRIORITY_LABELS: Record<ExplorerPriority, string> = {
  all: 'All priorities',
  highest: 'Highest only',
  high_or_better: 'High or better',
};

function createSavedViewId(): string {
  return `view-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function suggestedName(draft: SavedViewDraft): string {
  const scope =
    draft.borough === 'all'
      ? 'All NYC'
      : (BOROUGH_LABELS[draft.borough] ?? draft.borough);
  const signalSuffix =
    draft.filters.signals.length > 0
      ? ` + ${draft.filters.signals.length} signal${
          draft.filters.signals.length === 1 ? '' : 's'
        }`
      : '';
  const criteriaCount =
    Number(draft.filters.minLotAreaSqft !== null) +
    Number(draft.filters.minUnusedFloorAreaSqft !== null);
  const criteriaSuffix =
    criteriaCount > 0
      ? ` + ${criteriaCount} site ${
          criteriaCount === 1 ? 'criterion' : 'criteria'
        }`
      : '';
  return `${scope} · ${siteTypeLabel(
    draft.filters.siteType,
  )}${signalSuffix}${criteriaSuffix}`;
}

function formatBaselineDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'saved baseline';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SavedViewMonitorCard({
  view,
  monitor,
  inventoryReady,
  expanded,
  busy,
  onToggle,
  onRefreshBaseline,
  onSelectParcel,
  onInspectExited,
}: {
  view: ParcelSavedSearch;
  monitor: SavedViewMonitor;
  inventoryReady: boolean;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onRefreshBaseline: () => void;
  onSelectParcel: (bbl: string) => void;
  onInspectExited: (bbl: string) => void;
}) {
  if (!inventoryReady) {
    return (
      <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
        Waiting for the verified full inventory before evaluating this thesis.
      </div>
    );
  }
  if (monitor.status === 'unavailable') {
    return (
      <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
        <div className="flex items-start gap-2">
          <Radar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />
          <div>
            <p className="text-[11px] font-semibold text-amber-100">
              Monitoring baseline not established
            </p>
            <p className="mt-1 text-[10px] leading-4 text-amber-100/70">
              Capture today&apos;s exact BBL membership to audit what enters or
              leaves this screen after the next published feed.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefreshBaseline}
          disabled={busy}
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-amber-200/30 bg-white/10 px-2 text-[10px] font-semibold text-amber-50 hover:bg-white/15 disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <Radar className="h-3 w-3" />
          )}
          Start monitoring
        </button>
      </div>
    );
  }
  if (monitor.status === 'inconsistent') {
    return (
      <div
        role="alert"
        className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11px] leading-4 text-amber-100"
      >
        <strong>Membership could not be compared safely.</strong> The saved and
        current sets disagree inside one feed generation. Refresh the inventory;
        CityLens is not labeling this as a market change.
      </div>
    );
  }
  if (monitor.status === 'baseline_current') {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-[11px] text-emerald-100">
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span>
          Current baseline · {monitor.currentCount.toLocaleString()} matching
          parcel{monitor.currentCount === 1 ? '' : 's'}
        </span>
      </div>
    );
  }
  if (monitor.status === 'unchanged') {
    return (
      <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" />
          <div>
            <p className="text-[11px] font-semibold text-emerald-50">
              No membership changes
            </p>
            <p className="mt-1 text-[10px] leading-4 text-emerald-100/70">
              {monitor.currentCount.toLocaleString()} matching parcel
              {monitor.currentCount === 1 ? '' : 's'} remain after a newer
              published feed.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefreshBaseline}
          disabled={busy}
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200/30 bg-white/10 px-2 text-[10px] font-semibold text-emerald-50 hover:bg-white/15 disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-3 w-3 animate-spin" />}
          Mark current feed reviewed
        </button>
      </div>
    );
  }

  const enteredCount = monitor.enteredRows.length;
  const exitedCount = monitor.exitedBbls.length;
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-sky-300/25 bg-sky-300/10">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5"
      >
        <span className="flex min-w-0 items-center gap-2">
          <History className="h-3.5 w-3.5 shrink-0 text-sky-200" />
          <span>
            <strong className="text-[11px] text-sky-50">
              {enteredCount} entered · {exitedCount} left
            </strong>
            <span className="mt-0.5 block text-[10px] text-sky-100/70">
              Since {formatBaselineDate(view.snapshot!.feed_generated_at)}
            </span>
          </span>
        </span>
        <ArrowRight
          className={`h-3.5 w-3.5 shrink-0 text-sky-200 transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-sky-200/15 px-3 pb-3 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                Entered saved screen
              </div>
              {enteredCount === 0 ? (
                <p className="mt-1 text-[10px] text-slate-400">None</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {monitor.enteredRows.slice(0, 5).map((row) => (
                    <button
                      key={row.bbl}
                      type="button"
                      onClick={() => onSelectParcel(row.bbl)}
                      className="block w-full truncate rounded-md bg-white/5 px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-white/10"
                    >
                      <span className="font-semibold text-white">
                        {row.address ?? row.bbl}
                      </span>
                      <span className="ml-1 text-slate-400">· {row.bbl}</span>
                    </button>
                  ))}
                  {enteredCount > 5 && (
                    <p className="text-[10px] text-slate-400">
                      +{enteredCount - 5} more; apply the view to inspect all.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200">
                Left saved screen
              </div>
              {exitedCount === 0 ? (
                <p className="mt-1 text-[10px] text-slate-400">None</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {monitor.exitedBbls.slice(0, 5).map((bbl) => (
                    <button
                      key={bbl}
                      type="button"
                      onClick={() => onInspectExited(bbl)}
                      className="block w-full rounded-md bg-white/5 px-2 py-1.5 text-left text-[10px] font-semibold text-white hover:bg-white/10"
                    >
                      BBL {bbl} · inspect current screening
                    </button>
                  ))}
                  {exitedCount > 5 && (
                    <p className="text-[10px] text-slate-400">
                      +{exitedCount - 5} more departures.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
            <span className="text-[10px] leading-4 text-slate-400">
              Exact membership change—not seller intent or a new prediction.
            </span>
            <button
              type="button"
              onClick={onRefreshBaseline}
              disabled={busy}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[10px] font-semibold text-white hover:bg-white/15 disabled:opacity-50"
            >
              {busy && <LoaderCircle className="h-3 w-3 animate-spin" />}
              Mark current set reviewed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ParcelSavedViewsPanel({
  currentView,
  inventoryRows,
  inventoryReady,
  feedGeneration,
  feedGeneratedAt,
  onApply,
  onSelectParcel,
  onInspectExited,
  onComparisonOpened,
  onClose,
}: {
  currentView: SavedViewDraft;
  inventoryRows: ParcelExplorerRow[];
  inventoryReady: boolean;
  feedGeneration: string | null;
  feedGeneratedAt: string | null;
  onApply: (view: ParcelSavedSearch) => void;
  onSelectParcel: (bbl: string) => void;
  onInspectExited: (bbl: string) => void;
  onComparisonOpened?: () => void;
  onClose: () => void;
}) {
  const [views, setViews] = useState<ParcelSavedSearch[]>([]);
  const [name, setName] = useState(() => suggestedName(currentView));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const [comparisonViewId, setComparisonViewId] = useState<string | null>(
    null,
  );
  const [reviewViewId, setReviewViewId] = useState<string | null>(null);
  const [baselineBusyId, setBaselineBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listParcelSavedSearches()
      .then((items) => {
        if (!cancelled) {
          setViews(items);
          setComparisonViewId((current) =>
            current && items.some((item) => item.search_id === current)
              ? current
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Saved views are temporarily unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const orderedViews = useMemo(
    () =>
      [...views].sort((left, right) =>
        right.updated_at.localeCompare(left.updated_at),
      ),
    [views],
  );
  const comparisonView = useMemo(
    () =>
      comparisonViewId
        ? views.find((view) => view.search_id === comparisonViewId) ?? null
        : null,
    [comparisonViewId, views],
  );
  const comparison = useMemo(
    () =>
      comparisonView && inventoryReady
        ? buildExplorerScreenComparison(
            inventoryRows,
            currentView.filters,
            comparisonView,
          )
        : null,
    [comparisonView, currentView.filters, inventoryReady, inventoryRows],
  );
  const monitors = useMemo(
    () =>
      new Map(
        views.map((view) => [
          view.search_id,
          buildSavedViewMonitor(
            inventoryRows,
            view,
            feedGeneration,
          ),
        ]),
      ),
    [feedGeneration, inventoryRows, views],
  );

  const snapshotForFilters = (
    viewFilters: ExplorerFilters,
  ): ParcelSavedSearch['snapshot'] | null => {
    if (!inventoryReady || !feedGeneration || !feedGeneratedAt) return null;
    const matchedBbls = filterExplorerRows(inventoryRows, viewFilters)
      .map((row) => row.bbl)
      .sort();
    return {
      schema_version: 'citylens/parcel-saved-view-snapshot@v1',
      feed_generation: feedGeneration,
      feed_generated_at: feedGeneratedAt,
      match_count: matchedBbls.length,
      matched_bbls: matchedBbls,
    };
  };

  const saveCurrentView = async () => {
    const normalizedName = name.trim();
    const snapshot = snapshotForFilters(currentView.filters);
    if (!normalizedName || saving || !snapshot) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const created = await saveParcelSearch(createSavedViewId(), {
        name: normalizedName,
        borough: currentView.borough as ParcelSavedSearch['borough'],
        filters: {
          query: currentView.filters.query.trim(),
          priority: currentView.filters.priority,
          opportunity: 'all',
          site_type: currentView.filters.siteType,
          signals: currentView.filters.signals,
          min_lot_area_sqft: currentView.filters.minLotAreaSqft,
          min_unused_floor_area_sqft:
            currentView.filters.minUnusedFloorAreaSqft,
          owner_portfolio_id: currentView.filters.ownerPortfolioId,
          overlay: currentView.overlay,
        },
        alert_frequency: 'off',
        snapshot,
      });
      setViews((current) => [created, ...current]);
      setSaved(true);
    } catch {
      setError('This view could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const refreshBaseline = async (view: ParcelSavedSearch) => {
    if (baselineBusyId) return;
    const snapshot = snapshotForFilters(
      explorerFiltersFromSavedSearch(view),
    );
    if (!snapshot) return;
    setBaselineBusyId(view.search_id);
    setError(null);
    try {
      const updated = await saveParcelSearch(view.search_id, {
        name: view.name,
        borough: view.borough,
        filters: view.filters,
        alert_frequency: 'off',
        snapshot,
      });
      setViews((current) =>
        current.map((item) =>
          item.search_id === updated.search_id ? updated : item,
        ),
      );
      setReviewViewId(null);
    } catch {
      setError('The current thesis baseline could not be saved. Try again.');
    } finally {
      setBaselineBusyId(null);
    }
  };

  const deleteView = async (searchId: string) => {
    if (deletingId) return;
    setDeletingId(searchId);
    setError(null);
    try {
      await removeParcelSavedSearch(searchId);
      setViews((current) =>
        current.filter((view) => view.search_id !== searchId),
      );
      setComparisonViewId((current) =>
        current === searchId ? null : current,
      );
    } catch {
      setError('This saved view could not be deleted. Try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:px-7"
      aria-label="Saved parcel views"
      data-testid="saved-views-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
            <Bookmark className="h-4 w-4" />
            Saved views
          </div>
          <h3 className="mt-1 text-xl font-semibold">
            Monitor an acquisition thesis across feed updates.
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Save the current borough, filters, search, owner focus, and map
            overlay with its exact matching BBL set. CityLens will show what
            entered or left after a new feed is published. Views are private,
            evaluated when you open the workspace, and do not send notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close saved views"
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs font-medium text-slate-200" htmlFor="saved-view-name">
            View name
          </label>
          <input
            id="saved-view-name"
            value={name}
            maxLength={100}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className="mt-2 h-10 w-full rounded-lg border border-white/15 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          />
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
            <span className="rounded-full bg-white/10 px-2 py-1">
              {currentView.borough === 'all'
                ? 'All boroughs'
                : BOROUGH_LABELS[currentView.borough]}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-1">
              {PRIORITY_LABELS[currentView.filters.priority]}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-1">
              {siteTypeLabel(currentView.filters.siteType)}
            </span>
            {currentView.filters.signals.map((signal) => (
              <span
                key={signal}
                className="rounded-full bg-sky-400/15 px-2 py-1 text-sky-100"
              >
                {signalLabel(signal)}
              </span>
            ))}
            {currentView.filters.minLotAreaSqft !== null && (
              <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-100">
                Lot ≥{' '}
                {currentView.filters.minLotAreaSqft.toLocaleString()} sf
              </span>
            )}
            {currentView.filters.minUnusedFloorAreaSqft !== null && (
              <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-100">
                Unused FAR ≥{' '}
                {currentView.filters.minUnusedFloorAreaSqft.toLocaleString()}{' '}
                sf
              </span>
            )}
            <span className="rounded-full bg-white/10 px-2 py-1">
              {currentView.overlay} overlay
            </span>
          </div>
          <button
            type="button"
            data-testid="saved-view-save"
            onClick={() => void saveCurrentView()}
            disabled={
              !name.trim() ||
              saving ||
              !inventoryReady ||
              !feedGeneration ||
              !feedGeneratedAt
            }
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-xs font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save current view'}
          </button>
          {(!inventoryReady || !feedGeneration || !feedGeneratedAt) && (
            <p className="mt-2 text-[10px] leading-4 text-amber-200">
              A verified full inventory and feed generation are required before
              CityLens can establish an auditable baseline.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <span className="font-semibold uppercase tracking-[0.12em] text-slate-300">
              Your saved screens
            </span>
            <span>
              {inventoryReady
                ? `${inventoryRows.length.toLocaleString()} current leads ready to compare`
                : 'Loading the current ranked-lead inventory…'}
            </span>
          </div>
          {loading ? (
            <div className="flex min-h-36 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading saved views…
            </div>
          ) : error && views.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-center text-sm text-rose-100">
              <TriangleAlert className="h-5 w-5" />
              <p className="mt-2">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : orderedViews.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 p-5 text-center text-sm text-slate-300">
              No saved views yet. Save the current opportunity set to make it
              available in your next session.
            </div>
          ) : (
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {orderedViews.map((view) => {
                const dimensions = savedSearchDimensions(view.filters);
                const monitor = monitors.get(view.search_id);
                return (
                  <article
                    key={view.search_id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-white">
                          {view.name}
                        </h4>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {view.borough === 'all'
                            ? 'All boroughs'
                            : BOROUGH_LABELS[view.borough]}{' '}
                          · {siteTypeLabel(dimensions.siteType)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteView(view.search_id)}
                        disabled={deletingId === view.search_id}
                        aria-label={`Delete saved view ${view.name}`}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50"
                      >
                        {deletingId === view.search_id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    {view.filters.query && (
                      <p className="mt-2 truncate text-[11px] text-slate-300">
                        Search: “{view.filters.query}”
                      </p>
                    )}
                    {(dimensions.signals.length > 0 ||
                      view.filters.min_lot_area_sqft ||
                      view.filters.min_unused_floor_area_sqft) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dimensions.signals.map((signal) => (
                          <span
                            key={signal}
                            className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-100"
                          >
                            {signalLabel(signal)}
                          </span>
                        ))}
                        {view.filters.min_lot_area_sqft && (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-100">
                            Lot ≥{' '}
                            {view.filters.min_lot_area_sqft.toLocaleString()}{' '}
                            sf
                          </span>
                        )}
                        {view.filters.min_unused_floor_area_sqft && (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-100">
                            Unused FAR ≥{' '}
                            {view.filters.min_unused_floor_area_sqft.toLocaleString()}{' '}
                            sf
                          </span>
                        )}
                      </div>
                    )}
                    {monitor && (
                      <SavedViewMonitorCard
                        view={view}
                        monitor={monitor}
                        inventoryReady={inventoryReady}
                        expanded={reviewViewId === view.search_id}
                        busy={baselineBusyId === view.search_id}
                        onToggle={() =>
                          setReviewViewId((current) =>
                            current === view.search_id
                              ? null
                              : view.search_id,
                          )
                        }
                        onRefreshBaseline={() =>
                          void refreshBaseline(view)
                        }
                        onSelectParcel={onSelectParcel}
                        onInspectExited={onInspectExited}
                      />
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onApply(view)}
                        aria-label="Apply view"
                        className="inline-flex h-8 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        disabled={!inventoryReady}
                        aria-pressed={comparisonViewId === view.search_id}
                        aria-label={`${
                          comparisonViewId === view.search_id
                            ? 'Stop comparing'
                            : 'Compare current screen with'
                        } ${view.name}`}
                        onClick={() => {
                          const opening =
                            comparisonViewId !== view.search_id;
                          setComparisonViewId(
                            opening ? view.search_id : null,
                          );
                          if (opening) onComparisonOpened?.();
                        }}
                        className={`inline-flex h-8 items-center justify-center gap-1 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45 ${
                          comparisonViewId === view.search_id
                            ? 'border-sky-300/40 bg-sky-300/15 text-sky-100'
                            : 'border-white/15 bg-white/5 text-white hover:bg-white/15'
                        }`}
                      >
                        <GitCompareArrows className="h-3.5 w-3.5" />
                        {comparisonViewId === view.search_id
                          ? 'Comparing'
                          : 'Compare'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {error && views.length > 0 && (
            <p className="mt-2 text-xs text-rose-200">{error}</p>
          )}
        </div>
      </div>
      {comparison && comparisonView && (
        <ParcelSavedScreenComparison
          comparison={comparison}
          savedViewName={comparisonView.name}
          onApplySaved={() => onApply(comparisonView)}
        />
      )}
    </section>
  );
}
