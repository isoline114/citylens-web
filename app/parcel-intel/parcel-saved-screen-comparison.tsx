'use client';

import { ArrowRight, Database, GitCompareArrows } from 'lucide-react';

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
  eyebrow,
  name,
  profile,
}: {
  eyebrow: string;
  name: string;
  profile: ExplorerScreenComparison['current'];
}) {
  const leadingBorough = profile.topBorough
    ? (BOROUGH_LABELS[profile.topBorough] ?? profile.topBorough)
    : '—';

  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/45 p-3.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-300">
        {eyebrow}
      </div>
      <h4 className="mt-1 truncate text-sm font-semibold text-white">{name}</h4>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.07] p-2.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Matches now
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            {profile.matchCount.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {formatRate(profile.matchRatePct)} of loaded inventory
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.07] p-2.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Leading borough
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-white">
            {leadingBorough}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {profile.topBoroughCount.toLocaleString()} matches
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.07] p-2.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Median lot
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {formatSquareFeet(profile.medianLotAreaSqft)}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.07] p-2.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Median unused-FAR proxy
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {formatSquareFeet(profile.medianUnusedFloorAreaSqft)}
          </div>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] leading-4 text-slate-300">
        <div className="flex items-center gap-1.5 font-medium text-slate-200">
          <Database className="h-3 w-3 text-emerald-300" />
          PLUTO field coverage within matches
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
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
      className="mt-4 overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-400/12 via-white/5 to-emerald-400/10"
    >
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
            <GitCompareArrows className="h-4 w-4" />
            Saved-screen comparison
          </div>
          <h3 className="mt-1 text-base font-semibold text-white">
            See how a saved thesis changes the shortlist.
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-300">
            Both screens are re-evaluated against the same{' '}
            {comparison.inventoryCount.toLocaleString()} currently loaded
            ranked leads. Saved views store conditions—not counts—so results
            can change when the source feed refreshes.
          </p>
        </div>
        <button
          type="button"
          onClick={onApplySaved}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-950 hover:bg-slate-100"
        >
          Apply saved screen
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-3 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Shared candidates
          </div>
          <div
            data-testid="saved-screen-shared-count"
            className="mt-1 text-xl font-semibold text-white"
          >
            {comparison.sharedCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Current only
          </div>
          <div className="mt-1 text-xl font-semibold text-sky-200">
            {comparison.currentOnlyCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Saved only
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-200">
            {comparison.savedOnlyCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
          <div className="text-[9px] uppercase tracking-wide text-slate-400">
            Shared share of union
          </div>
          <div className="mt-1 text-xl font-semibold text-white">
            {formatRate(comparison.sharedUnionRatePct)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {comparison.unionCount.toLocaleString()} distinct candidates
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
        <ComparisonProfile
          eyebrow="Current screen"
          name="Unsaved working screen"
          profile={comparison.current}
        />
        <ComparisonProfile
          eyebrow="Saved screen"
          name={savedViewName}
          profile={comparison.saved}
        />
      </div>

      {comparison.unionCount === 0 && (
        <p className="mx-4 mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] leading-5 text-amber-100">
          Neither screen matches the current inventory. Apply the saved screen
          to inspect its conditions, or relax one condition before comparing
          again.
        </p>
      )}

      <p className="border-t border-white/10 px-4 py-3 text-[10px] leading-4 text-slate-400">
        Overlap describes candidate membership in the current ranked-lead
        inventory. It is not ranking accuracy, relative quality, feasibility,
        seller intent, or evidence that either screen will produce a
        transaction.
      </p>
    </section>
  );
}
