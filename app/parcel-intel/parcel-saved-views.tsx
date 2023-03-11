'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  LoaderCircle,
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
  type ExplorerFilters,
  type ExplorerOpportunity,
  type ExplorerOverlay,
  type ExplorerPriority,
} from './parcel-intel-explorer-support';

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

const OPPORTUNITY_LABELS: Record<ExplorerOpportunity, string> = {
  all: 'All opportunities',
  uncommitted: 'Qualified leads',
  assemblage: 'Assemblage opportunities',
  tax_lien: 'Lien-sale history',
  violations: 'Immediate-hazard violations',
  floodplain: 'Floodplain exposure',
  environmental_review: 'E/R-designated lots',
  mih: 'MIH mapped areas',
  transit_800m: 'Transit within 800 m',
  portfolio: 'Multi-lot owners',
  vacant_site: 'Vacant sites',
  ground_up_candidate: 'Ground-up candidates',
  conversion_or_overbuilt: 'Conversion / overbuilt',
  active_project: 'Active projects',
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
  return `${scope} · ${OPPORTUNITY_LABELS[draft.filters.opportunity]}`;
}

export function ParcelSavedViewsPanel({
  currentView,
  onApply,
  onClose,
}: {
  currentView: SavedViewDraft;
  onApply: (view: ParcelSavedSearch) => void;
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listParcelSavedSearches()
      .then((items) => {
        if (!cancelled) setViews(items);
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

  const saveCurrentView = async () => {
    const normalizedName = name.trim();
    if (!normalizedName || saving) return;
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
          opportunity: currentView.filters.opportunity,
          owner_portfolio_id: currentView.filters.ownerPortfolioId,
          overlay: currentView.overlay,
        },
        alert_frequency: 'off',
      });
      setViews((current) => [created, ...current]);
      setSaved(true);
    } catch {
      setError('This view could not be saved. Try again.');
    } finally {
      setSaving(false);
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
            Return to the same opportunity set.
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Save the current borough, filters, search, owner focus, and map
            overlay. Saved views are private to your account and do not send
            notifications.
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
              {OPPORTUNITY_LABELS[currentView.filters.opportunity]}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-1">
              {currentView.overlay} overlay
            </span>
          </div>
          <button
            type="button"
            data-testid="saved-view-save"
            onClick={() => void saveCurrentView()}
            disabled={!name.trim() || saving}
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
        </div>

        <div>
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
              {orderedViews.map((view) => (
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
                        · {OPPORTUNITY_LABELS[view.filters.opportunity]}
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
                  <button
                    type="button"
                    onClick={() => onApply(view)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
                  >
                    Apply view
                  </button>
                </article>
              ))}
            </div>
          )}
          {error && views.length > 0 && (
            <p className="mt-2 text-xs text-rose-200">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}
