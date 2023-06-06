'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';

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
  pursue: 'text-ink',
  watch: 'text-ink',
  pass: 'text-ink',
  unclear: 'text-ink-3',
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
      className="border-b border-rule bg-white text-ink"
      aria-label="Lead review workspace"
      data-testid="lead-review-workspace"
      data-state={loading ? 'loading' : error || !data ? 'error' : 'ready'}
    >
      <div className="px-4 py-5 md:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="mt-1 text-xl font-semibold">
              Review leads in the current generation.
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-2">
              Review the current ranked generation systematically. Your calls
              stay private and never rewrite rank.
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close lead review workspace"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-control bg-white text-ink-2 hover:bg-white hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 border-t border-rule bg-white p-4 text-sm text-ink-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading current-generation coverage…
          </div>
        ) : error || !data ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-rule bg-white p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Review coverage could not be reconciled to the current inventory.
            </span>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold hover:bg-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
              <div className="border-t border-rule bg-white p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="font-cond text-[13px] text-ink-3">
                      Current generation
                    </div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight">
                      {data.reviewed_count.toLocaleString()}
                      <span className="text-base font-medium text-ink-3">
                        {' '}
                        / {data.available_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-3">
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
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm bg-paper-2 px-4 text-xs font-semibold text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {nextUnreviewed ? 'Review next' : 'Generation reviewed'}
                  </button>
                </div>
                <div
                  className="mt-4 h-2 overflow-hidden bg-paper-2"
                  role="progressbar"
                  aria-label="Lead review coverage"
                  aria-valuemin={0}
                  aria-valuemax={data.available_count}
                  aria-valuenow={data.reviewed_count}
                >
                  <div
                    className="h-full bg-ink transition-[width]"
                    style={{ width: `${coverage * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-[11px] leading-4 text-ink-3">
                  Coverage does not measure accuracy. Independent blinded review and
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
                    className={`border-b border-control py-3 text-left transition-colors ${
                      filter === value
                        ? 'border-ink bg-paper-2'
                        : 'border-control hover:bg-paper-2'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-4 w-4 text-ink-2" />
                      <span className="text-lg font-semibold">
                        {value === 'all'
                          ? data.reviewed_count.toLocaleString()
                          : data.verdict_counts[value].toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-3">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-hidden border-t border-rule bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-ink">
                <div>
                  <div className="text-xs font-semibold">Reviewed leads</div>
                  <div className="mt-0.5 text-[11px] text-ink-3">
                    {visibleReviews.length.toLocaleString()}{' '}
                    {filter === 'all' ? 'current calls' : filter}
                  </div>
                </div>
                {filter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="text-xs font-semibold text-ink hover:text-select"
                  >
                    Show all
                  </button>
                )}
              </div>
              {visibleReviews.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-ink-3">
                  No {filter === 'all' ? '' : `${filter} `}calls in this
                  generation yet.
                </div>
              ) : (
                <div className="max-h-64 divide-y divide-rule overflow-y-auto">
                  {visibleReviews.slice(0, visibleLimit).map((review) => {
                    const row = inventoryByBbl.get(review.bbl);
                    return (
                      <button
                        key={review.review_id}
                        type="button"
                        onClick={() => onSelectParcel(review.bbl)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-ink hover:bg-paper-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {formatAddress(row?.address) || `BBL ${formatBbl(review.bbl)}`}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-ink-3">
                            {review.citywide_rank
                              ? `NYC #${review.citywide_rank.toLocaleString()}`
                              : 'Rank unavailable'}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-xs font-medium capitalize ${VERDICT_STYLES[review.verdict]}`}
                        >
                          {review.verdict}
                        </span>
                      </button>
                    );
                  })}
                  {visibleReviews.length > visibleLimit && (
                    <div className="bg-paper-2 px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleLimit((current) => current + 50)
                        }
                        className="text-xs font-semibold text-ink hover:text-select"
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
