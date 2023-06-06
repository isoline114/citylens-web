'use client';

import { ArrowRight, Database } from 'lucide-react';

import type { ExplorerScreenComparison } from './parcel-intel-explorer-support';
import { BOROUGH_LABELS } from './parcel-intel-explorer-support';

function formatSquareFeet(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M sf`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k sf`;
  }
  return `${Math.round(value).toLocaleString()} sf`;
}

function formatRate(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function ComparisonProfile({
  name,
  profile,
}: {
  name: string;
  profile: ExplorerScreenComparison['current'];
}) {
  const leadingBorough = profile.topBorough
    ? (BOROUGH_LABELS[profile.topBorough] ?? profile.topBorough)
    : '—';

  return (
    <article className="border-t border-rule bg-white p-3.5">
      <h4 className="mt-1 truncate text-sm font-semibold text-ink">{name}</h4>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-white p-2.5">
          <div className="text-[9px] font-cond text-ink-3">
            Matches now
          </div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {profile.matchCount.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-3">
            {formatRate(profile.matchRatePct)} of loaded inventory
          </div>
        </div>
        <div className="rounded-sm bg-white p-2.5">
          <div className="text-[9px] font-cond text-ink-3">
            Leading borough
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-ink">
            {leadingBorough}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-3">
            {profile.topBoroughCount.toLocaleString()} matches
          </div>
        </div>
        <div className="rounded-sm bg-white p-2.5">
          <div className="text-[9px] font-cond text-ink-3">
            Median lot
          </div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {formatSquareFeet(profile.medianLotAreaSqft)}
          </div>
        </div>
        <div className="rounded-sm bg-white p-2.5">
          <div className="text-[9px] font-cond text-ink-3">
            Median unused-FAR proxy
          </div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {formatSquareFeet(profile.medianUnusedFloorAreaSqft)}
          </div>
        </div>
      </div>
      <div className="mt-2 border-t border-rule bg-white px-2.5 py-2 text-[10px] leading-4 text-ink-2">
        <div className="flex items-center gap-1.5 font-medium text-ink-2">
          <Database className="h-3 w-3 text-ink" />
          PLUTO field coverage within matches
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ink-3">
          <span>
            Lot {profile.lotAreaKnownCount.toLocaleString()}/
            {profile.matchCount.toLocaleString()} ·{' '}
            {formatRate(profile.lotAreaKnownRatePct)}
          </span>
          <span>
            Unused FAR {profile.unusedFloorAreaKnownCount.toLocaleString()}/
            {profile.matchCount.toLocaleString()} ·{' '}
            {formatRate(profile.unusedFloorAreaKnownRatePct)}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ParcelSavedScreenComparison({
  comparison,
  savedViewName,
  onApplySaved,
}: {
  comparison: ExplorerScreenComparison;
  savedViewName: string;
  onApplySaved: () => void;
}) {
  return (
    <section
      data-testid="saved-screen-comparison"
      aria-label={`Compare current screen with ${savedViewName}`}
      className="mt-4 overflow-hidden border-t border-rule"
    >
      <div className="flex flex-col gap-3 border-b border-rule px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="mt-1 text-base font-semibold text-ink">
            See how a saved thesis changes the shortlist.
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-ink-2">
            Both screens are re-evaluated against the same{' '}
            {comparison.inventoryCount.toLocaleString()} currently loaded
            ranked leads. Saved views store conditions rather than counts, so results
            can change when the source feed refreshes.
          </p>
        </div>
        <button
          type="button"
          onClick={onApplySaved}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-white px-3 text-xs font-semibold text-ink hover:bg-paper-2"
        >
          Apply saved screen
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-3 xl:grid-cols-4">
        <div className="border-t border-rule bg-white p-3">
          <div className="text-[9px] font-cond text-ink-3">
            Shared candidates
          </div>
          <div
            data-testid="saved-screen-shared-count"
            className="mt-1 tabular-nums text-xl font-semibold text-ink"
          >
            {comparison.sharedCount.toLocaleString()}
          </div>
        </div>
        <div className="border-t border-rule bg-white p-3">
          <div className="text-[9px] font-cond text-ink-3">
            Current only
          </div>
          <div className="mt-1 tabular-nums text-xl font-semibold text-ink">
            {comparison.currentOnlyCount.toLocaleString()}
          </div>
        </div>
        <div className="border-t border-rule bg-white p-3">
          <div className="text-[9px] font-cond text-ink-3">
            Saved only
          </div>
          <div className="mt-1 tabular-nums text-xl font-semibold text-ink">
            {comparison.savedOnlyCount.toLocaleString()}
          </div>
        </div>
        <div className="border-t border-rule bg-white p-3">
          <div className="text-[9px] font-cond text-ink-3">
            Shared share of union
          </div>
          <div className="mt-1 tabular-nums text-xl font-semibold text-ink">
            {formatRate(comparison.sharedUnionRatePct)}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-3">
            {comparison.unionCount.toLocaleString()} distinct candidates
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
        <ComparisonProfile
          name="Unsaved working screen"
          profile={comparison.current}
        />
        <ComparisonProfile
          name={savedViewName}
          profile={comparison.saved}
        />
      </div>

      {comparison.unionCount === 0 && (
        <p className="mx-4 mb-4 rounded-sm border border-rule bg-white px-3 py-2 text-[11px] leading-5 text-stale">
          Neither screen matches the current inventory. Apply the saved screen
          to inspect its conditions, or relax one condition before comparing
          again.
        </p>
      )}

      <p className="border-t border-rule px-4 py-3 text-[10px] leading-4 text-ink-3">
        Overlap describes candidate membership in the current ranked-lead
        inventory. It is not ranking accuracy, relative quality, feasibility,
        seller intent, or evidence that either screen will produce a
        transaction.
      </p>
    </section>
  );
}
