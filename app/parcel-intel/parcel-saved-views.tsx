'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
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
  ApiError,
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
      <div className="mt-3 border-t border-rule bg-white px-3 py-2 text-xs text-ink-3">
        Waiting for the verified full inventory before evaluating this thesis.
      </div>
    );
  }
  if (monitor.status === 'unavailable') {
    return (
      <div className="mt-3 border-t border-rule bg-white p-3">
        <div className="flex items-start gap-2">
          <Radar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stale" />
          <div>
            <p className="text-xs font-semibold text-stale">
              Monitoring baseline not established
            </p>
            <p className="mt-1 text-xs leading-4 text-stale">
              Capture today&apos;s exact BBL membership to audit what enters or
              leaves this screen after the next published feed.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefreshBaseline}
          disabled={busy}
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-sm border border-control bg-white px-2 text-xs font-semibold text-stale hover:bg-paper-2 disabled:opacity-50"
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
        className="mt-3 border-t border-rule bg-white px-3 py-2 text-xs leading-4 text-stale"
      >
        <strong>Membership could not be compared safely.</strong> The saved and
        current sets disagree inside one feed generation. Refresh the inventory;
        CityLens is not labeling this as a market change.
      </div>
    );
  }
  if (monitor.status === 'baseline_current') {
    return (
      <div className="mt-3 flex items-center gap-2 border-t border-rule bg-paper-2 px-3 py-2 text-xs text-ink">
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
      <div className="mt-3 border-t border-rule bg-paper-2 p-3">
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
          <div>
            <p className="text-xs font-semibold text-ink">
              No membership changes
            </p>
            <p className="mt-1 text-xs leading-4 text-ink">
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
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-sm border border-control bg-white px-2 text-xs font-semibold text-ink hover:bg-paper-2 disabled:opacity-50"
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
    <div className="mt-3 overflow-hidden border-t border-rule bg-paper-2">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-paper-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <History className="h-3.5 w-3.5 shrink-0 text-ink" />
          <span>
            <strong className="text-xs text-ink">
              {enteredCount} entered · {exitedCount} left
            </strong>
            <span className="mt-0.5 block text-xs text-ink">
              Since {formatBaselineDate(view.snapshot!.feed_generated_at)}
            </span>
          </span>
        </span>
        <ArrowRight
          className={`h-3.5 w-3.5 shrink-0 text-ink  ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-rule px-3 pb-3 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="font-cond text-[13px] font-semibold text-ink-3">
                Entered saved screen
              </div>
              {enteredCount === 0 ? (
                <p className="mt-1 text-xs text-ink-3">None</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {monitor.enteredRows.slice(0, 5).map((row) => (
                    <button
                      key={row.bbl}
                      type="button"
                      onClick={() => onSelectParcel(row.bbl)}
                      className="block w-full truncate rounded-sm bg-white px-2 py-1.5 text-left text-xs text-ink hover:bg-paper-2"
                    >
                      <span className="font-semibold text-ink">
                        {formatAddress(row.address) || formatBbl(row.bbl)}
                      </span>
                      <span className="ml-1 font-mono text-ink-3">· {formatBbl(row.bbl)}</span>
                    </button>
                  ))}
                  {enteredCount > 5 && (
                    <p className="text-xs text-ink-3">
                      +{enteredCount - 5} more; apply the view to inspect all.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="font-cond text-[13px] font-semibold text-ink-3">
                Left saved screen
              </div>
              {exitedCount === 0 ? (
                <p className="mt-1 text-xs text-ink-3">None</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {monitor.exitedBbls.slice(0, 5).map((bbl) => (
                    <button
                      key={bbl}
                      type="button"
                      onClick={() => onInspectExited(bbl)}
                      className="block w-full border-b border-control py-1.5 text-left font-mono text-xs text-ink hover:bg-paper-2"
                    >
                      BBL {formatBbl(bbl)} · inspect current screening
                    </button>
                  ))}
                  {exitedCount > 5 && (
                    <p className="text-xs text-ink-3">
                      +{exitedCount - 5} more departures.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-2">
            <span className="text-xs leading-4 text-ink-3">
              Exact membership change, not seller intent or a new prediction.
            </span>
            <button
              type="button"
              onClick={onRefreshBaseline}
              disabled={busy}
              className="inline-flex h-7 items-center gap-1 rounded-sm border border-control bg-white px-2 text-xs font-semibold text-ink hover:bg-paper-2 disabled:opacity-50"
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
  onChangesOpened,
  onClose,
  initialFocus = 'close',
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
  onChangesOpened?: (searchId: string) => void;
  onClose: () => void;
  initialFocus?: 'close' | 'name';
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
    void listParcelSavedSearches()
      .then((items) => {
        if (!cancelled) {
          setError(null);
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
      window.dispatchEvent(new Event('citylens:saved-views-updated'));
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
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 409) {
        setError(
          'This thesis was updated in another session. Loading its newest baseline…',
        );
        setReloadKey((value) => value + 1);
      } else {
        setError('The current thesis baseline could not be saved. Try again.');
      }
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
      window.dispatchEvent(new Event('citylens:saved-views-updated'));
    } catch {
      setError('This saved view could not be deleted. Try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      id="parcel-saved-views-panel"
      className="border-b border-rule bg-white px-4 py-5 text-ink md:px-7"
      aria-label="Saved parcel views"
      data-testid="saved-views-panel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="mt-1 text-xl font-semibold">
            Watch this acquisition screen.
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-3">
            Save its exact BBL baseline. On the next feed, CityLens shows what
            entered or left. Views stay private and update when you open the
            workspace; notifications are not sent yet.
          </p>
        </div>
        <button
          type="button"
          autoFocus={initialFocus === 'close'}
          onClick={onClose}
          aria-label="Close saved views"
          className="self-end rounded-sm border border-control p-2 text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:self-auto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <div className="border-t border-rule bg-white p-4">
          <label className="text-xs font-medium text-ink" htmlFor="saved-view-name">
            View name
          </label>
          <input
            id="saved-view-name"
            autoFocus={initialFocus === 'name'}
            value={name}
            maxLength={100}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className="field mt-2 h-10 w-full rounded-sm border border-control bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-select focus:ring-2 focus:ring-select"
          />
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-ink-3">
            <span className="">
              {currentView.borough === 'all'
                ? 'All boroughs'
                : BOROUGH_LABELS[currentView.borough]}
            </span>
            <span className="">
              {PRIORITY_LABELS[currentView.filters.priority]}
            </span>
            <span className="">
              {siteTypeLabel(currentView.filters.siteType)}
            </span>
            {currentView.filters.signals.map((signal) => (
              <span
                key={signal}
                className="rounded-sm bg-paper-2 px-2 py-1 text-ink"
              >
                {signalLabel(signal)}
              </span>
            ))}
            {currentView.filters.minLotAreaSqft !== null && (
              <span className="text-ink">
                Lot ≥{' '}
                {currentView.filters.minLotAreaSqft.toLocaleString()} sf
              </span>
            )}
            {currentView.filters.minUnusedFloorAreaSqft !== null && (
              <span className="text-ink">
                Unused FAR ≥{' '}
                {currentView.filters.minUnusedFloorAreaSqft.toLocaleString()}{' '}
                sf
              </span>
            )}
            <span className="">
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
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save current view'}
          </button>
          {(!inventoryReady || !feedGeneration || !feedGeneratedAt) && (
            <p className="mt-2 text-xs leading-4 text-stale">
              A verified full inventory and feed generation are required before
              CityLens can establish an auditable baseline.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
            <span className="font-semibold font-cond text-ink-3">
              Your saved screens
            </span>
            <span>
              {inventoryReady
                ? `${inventoryRows.length.toLocaleString()} current leads ready to compare`
                : 'Loading the current ranked-lead inventory…'}
            </span>
          </div>
          {loading ? (
            <div className="flex min-h-36 items-center justify-center gap-2 border-t border-rule bg-white text-sm text-ink-3">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading saved views…
            </div>
          ) : error && views.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center border-t border-rule bg-white p-4 text-center text-sm text-red-700">
              <TriangleAlert className="h-5 w-5" />
              <p className="mt-2">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 inline-flex items-center gap-1 rounded-sm border border-control px-2.5 py-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : orderedViews.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center rounded-sm border border-dashed border-rule bg-white p-5 text-center text-sm text-ink-3">
              No saved views yet. Save the current opportunity set to make it
              available in your next session.
            </div>
          ) : (
            <>
              <div
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="saved-views-announcer"
              >
                {orderedViews.length.toLocaleString()} saved{' '}
                {orderedViews.length === 1 ? 'view' : 'views'} loaded.
              </div>
              <div className="divide-y divide-rule md:max-h-72 md:overflow-y-auto md:pr-1">
              {orderedViews.map((view) => {
                const dimensions = savedSearchDimensions(view.filters);
                const monitor = monitors.get(view.search_id);
                return (
                  <article
                    key={view.search_id}
                    className="border-t border-rule bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="break-words text-sm font-semibold text-ink">
                          {view.name}
                        </h4>
                        <p className="mt-1 text-xs text-ink-3">
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
                        className="shrink-0 rounded-sm p-1.5 text-ink-3 hover:bg-white hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === view.search_id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    {view.filters.query && (
                      <p className="mt-2 break-words text-xs text-ink-3">
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
                            className="rounded-sm bg-paper-2 px-2 py-0.5 text-xs text-ink"
                          >
                            {signalLabel(signal)}
                          </span>
                        ))}
                        {view.filters.min_lot_area_sqft && (
                          <span className="text-xs text-ink">
                            Lot ≥{' '}
                            {view.filters.min_lot_area_sqft.toLocaleString()}{' '}
                            sf
                          </span>
                        )}
                        {view.filters.min_unused_floor_area_sqft && (
                          <span className="text-xs text-ink">
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
                        onToggle={() => {
                          const opening =
                            reviewViewId !== view.search_id;
                          setReviewViewId(
                            opening ? view.search_id : null,
                          );
                          if (
                            opening &&
                            monitor.status === 'changes'
                          ) {
                            onChangesOpened?.(view.search_id);
                          }
                        }}
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
                        className="inline-flex h-8 items-center justify-center rounded-sm border border-control bg-white px-3 text-xs font-medium text-ink hover:bg-paper-2"
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
                        className={`inline-flex h-8 items-center justify-center gap-1 rounded-sm border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45 ${
                          comparisonViewId === view.search_id
                            ? 'border-control bg-paper-2 text-ink'
                            : 'border-control bg-white text-ink hover:bg-paper-2'
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
            </>
          )}
          {error && views.length > 0 && (
            <p className="mt-2 text-xs text-red-700">{error}</p>
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
