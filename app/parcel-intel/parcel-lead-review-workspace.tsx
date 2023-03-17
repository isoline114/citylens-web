'use client';

import {
  CheckCircle2,
  CircleSlash2,
  Eye,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  Target,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  getParcelLeadReviewIndex,
  type ParcelIntelMapRow,
  type ParcelLeadReviewIndex,
  type ParcelLeadReviewVerdict,
} from '@/lib/api';

type ReviewFilter = 'all' | ParcelLeadReviewVerdict;

type Props = {
  feedGeneration: string;
  inventoryRows: ParcelIntelMapRow[];
  onClose: () => void;
  onSelectParcel: (bbl: string) => void;
};

const FILTERS: Array<{
  value: ReviewFilter;
  label: string;
  Icon: typeof Target;
}> = [
  { value: 'all', label: 'All', Icon: CheckCircle2 },
  { value: 'pursue', label: 'Pursue', Icon: Target },
  { value: 'watch', label: 'Watch', Icon: Eye },
  { value: 'pass', label: 'Pass', Icon: CircleSlash2 },
  { value: 'unclear', label: 'Unclear', Icon: HelpCircle },
];

const VERDICT_STYLES: Record<ParcelLeadReviewVerdict, string> = {
  pursue: 'bg-emerald-100 text-emerald-900',
  watch: 'bg-sky-100 text-sky-900',
  pass: 'bg-rose-100 text-rose-900',
  unclear: 'bg-amber-100 text-amber-950',
};

function rankValue(row: ParcelIntelMapRow): number {
  return (
    row.citywide_rank ??
    row.acquisition_rank ??
    row.priority_rank ??
    Number.MAX_SAFE_INTEGER
  );
}

export function ParcelLeadReviewWorkspace({
  feedGeneration,
  inventoryRows,
  onClose,
  onSelectParcel,
}: Props) {
  const [data, setData] = useState<ParcelLeadReviewIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState(50);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getParcelLeadReviewIndex()
      .then((next) => {
        if (cancelled) return;
        if (
          next.current_feed_generation !== feedGeneration ||
          next.available_count !== inventoryRows.length
        ) {
          setData(null);
          setError(true);
          return;
        }
        setData(next);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedGeneration, inventoryRows.length, reloadKey]);

  const inventoryByBbl = useMemo(
    () => new Map(inventoryRows.map((row) => [row.bbl, row])),
    [inventoryRows],
  );
  const reviewedBbls = useMemo(
    () => new Set(data?.items.map((item) => item.bbl) ?? []),
    [data],
  );
  const nextUnreviewed = useMemo(
    () =>
      [...inventoryRows]
        .sort(
          (left, right) =>
            rankValue(left) - rankValue(right) ||
            left.bbl.localeCompare(right.bbl),
        )
        .find((row) => !reviewedBbls.has(row.bbl)) ?? null,
    [inventoryRows, reviewedBbls],
  );
  const visibleReviews = useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) => filter === 'all' || item.verdict === filter,
      ),
    [data, filter],
  );
  const coverage =
    data && data.available_count > 0
      ? data.reviewed_count / data.available_count
      : 0;

  useEffect(() => {
    setVisibleLimit(50);
  }, [filter]);

  return (
    <section
      id="parcel-lead-review-workspace"
      className="border-b border-slate-200 bg-slate-950 text-white"
      aria-label="Lead review workspace"
      data-testid="lead-review-workspace"
      data-state={loading ? 'loading' : error || !data ? 'error' : 'ready'}
    >
      <div className="px-4 py-5 md:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <Target className="h-4 w-4" />
              Lead review workspace
            </div>
            <h3 className="mt-1 text-xl font-semibold">
              Work the list, not just the clicks.
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">
              Review the current ranked generation systematically. Your calls
              stay private and never rewrite rank.
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close lead review workspace"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-slate-200 hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading current-generation coverage…
          </div>
        ) : error || !data ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Review coverage could not be reconciled to the current inventory.
            </span>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-200/30 bg-white/10 px-3 text-xs font-semibold hover:bg-white/15"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Current generation
                    </div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight">
                      {data.reviewed_count.toLocaleString()}
                      <span className="text-base font-medium text-slate-400">
                        {' '}
                        / {data.available_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {Math.round(coverage * 100)}% reviewed ·{' '}
                      {data.unreviewed_count.toLocaleString()} remaining
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!nextUnreviewed}
                    onClick={() => {
                      if (nextUnreviewed) onSelectParcel(nextUnreviewed.bbl);
                    }}
                    data-testid="review-next-unreviewed"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-emerald-300 px-4 text-xs font-semibold text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {nextUnreviewed ? 'Review next' : 'Generation reviewed'}
                  </button>
                </div>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Lead review coverage"
                  aria-valuemin={0}
                  aria-valuemax={data.available_count}
                  aria-valuenow={data.reviewed_count}
                >
                  <div
                    className="h-full rounded-full bg-emerald-300 transition-[width]"
                    style={{ width: `${coverage * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-[11px] leading-4 text-slate-400">
                  Coverage—not accuracy. Independent blinded review and
                  prospective outcomes remain separate evidence gates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {FILTERS.slice(1).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() =>
                      setFilter((current) =>
                        current === value ? 'all' : value,
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      filter === value
                        ? 'border-emerald-300/60 bg-emerald-300/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-4 w-4 text-slate-300" />
                      <span className="text-lg font-semibold">
                        {value === 'all'
                          ? data.reviewed_count.toLocaleString()
                          : data.verdict_counts[value].toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-slate-950">
                <div>
                  <div className="text-xs font-semibold">Reviewed leads</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {visibleReviews.length.toLocaleString()}{' '}
                    {filter === 'all' ? 'current calls' : filter}
                  </div>
                </div>
                {filter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Show all
                  </button>
                )}
              </div>
              {visibleReviews.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  No {filter === 'all' ? '' : `${filter} `}calls in this
                  generation yet.
                </div>
              ) : (
                <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                  {visibleReviews.slice(0, visibleLimit).map((review) => {
                    const row = inventoryByBbl.get(review.bbl);
                    return (
                      <button
                        key={review.review_id}
                        type="button"
                        onClick={() => onSelectParcel(review.bbl)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-slate-950 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {row?.address ?? `BBL ${review.bbl}`}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {review.citywide_rank
                              ? `NYC #${review.citywide_rank.toLocaleString()}`
                              : 'Rank unavailable'}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${VERDICT_STYLES[review.verdict]}`}
                        >
                          {review.verdict}
                        </span>
                      </button>
                    );
                  })}
                  {visibleReviews.length > visibleLimit && (
                    <div className="bg-slate-50 px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleLimit((current) => current + 50)
                        }
                        className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                      >
                        Show 50 more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
