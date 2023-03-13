'use client';

import { ChevronDown, Filter, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type {
  ExplorerScreenAudit,
  ExplorerScreenAuditCriterionId,
} from './parcel-intel-explorer-support';

type Props = {
  audit: ExplorerScreenAudit;
  onRelax: (criterionId: ExplorerScreenAuditCriterionId) => void;
  onOpened?: () => void;
};

function coverageLabel(
  known: number,
  scope: number,
  rate: number | null,
): string {
  if (scope === 0) return 'No parcels pass the other conditions';
  return `${known.toLocaleString()} of ${scope.toLocaleString()} known${
    rate === null ? '' : ` · ${rate.toFixed(rate < 10 ? 1 : 0)}%`
  }`;
}

export function ParcelScreenAudit({ audit, onRelax, onOpened }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = 'parcel-screen-audit-panel';

  return (
    <div className="border-t border-white/10 bg-slate-950/75">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() =>
          setOpen((value) => {
            if (!value) onOpened?.();
            return !value;
          })
        }
        className="flex w-full items-center justify-between gap-4 px-3.5 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300 ring-1 ring-inset ring-sky-300/15">
            <Filter className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-white">
              Audit this screen
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-400">
              {audit.criteriaCount} active condition
              {audit.criteriaCount === 1 ? '' : 's'} · one-at-a-time
              sensitivity
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {audit.largestMarginalCriterion && (
            <span className="hidden rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-200 sm:inline">
              Largest marginal lift: +
              {audit.largestMarginalCriterion.addedIfRelaxed.toLocaleString()}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          data-testid="screen-audit"
          className="border-t border-slate-200 bg-white p-3.5 text-slate-950"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold">Why this set is narrow</h3>
              <p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-500">
                Each card removes one condition while holding every other
                condition fixed. The added count is a sensitivity check, not a
                causal explanation, feasibility conclusion, or new score.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {audit.matchCount.toLocaleString()} of{' '}
              {audit.loadedCount.toLocaleString()} loaded
            </span>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {audit.criteria.map((criterion) => {
              const isLargest =
                audit.largestMarginalCriterion?.id === criterion.id;
              return (
                <article
                  key={criterion.id}
                  className={`rounded-xl border p-3 ${
                    isLargest
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {criterion.label}
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-950">
                        {criterion.valueLabel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRelax(criterion.id)}
                      aria-label={`Relax ${criterion.label}: ${criterion.valueLabel}`}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm hover:border-sky-300 hover:text-sky-800"
                    >
                      Relax
                    </button>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        criterion.addedIfRelaxed > 0
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {criterion.addedIfRelaxed > 0
                        ? `+${criterion.addedIfRelaxed.toLocaleString()}`
                        : 'No marginal lift'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {criterion.relaxedMatchCount.toLocaleString()} if relaxed
                    </span>
                  </div>

                  {criterion.coverageScopeCount !== null &&
                    criterion.knownValueCount !== null && (
                      <div className="mt-2 rounded-lg bg-white px-2 py-1.5 text-[10px] text-slate-600 ring-1 ring-inset ring-slate-200">
                        <div className="font-medium text-slate-700">
                          PLUTO source coverage
                        </div>
                        <div className="mt-0.5">
                          {coverageLabel(
                            criterion.knownValueCount,
                            criterion.coverageScopeCount,
                            criterion.knownValueRatePct,
                          )}
                        </div>
                        {(criterion.missingValueCount ?? 0) > 0 && (
                          <div className="mt-1 flex items-start gap-1 text-amber-700">
                            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                            {criterion.missingValueCount?.toLocaleString()}{' '}
                            missing{' '}
                            {criterion.missingValueCount === 1
                              ? 'value fails'
                              : 'values fail'}{' '}
                            this minimum
                          </div>
                        )}
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
