'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CircleAlert,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Scale,
} from 'lucide-react';

import {
  getParcelSalesComparables,
  type ParcelSalesComparables,
} from '@/lib/api';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: ParcelSalesComparables }
  | { status: 'error'; message: string };

type Props = {
  bbl: string;
  compact?: boolean;
};

function money(value: number | null): string {
  if (value === null) return 'Not reported';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function number(value: number | null): string {
  if (value === null) return 'Not reported';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function date(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-b border-rule px-3 py-2.5 text-right tabular-nums">
      <p className="font-cond text-xs font-semibold text-ink-3">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-3">{detail}</p>
    </div>
  );
}

export function ParcelSalesComparablesPanel({
  bbl,
  compact = false,
}: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'idle' });
  }, [bbl]);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void getParcelSalesComparables(bbl)
      .then((result) => setState({ status: 'ready', result }))
      .catch((error) => {
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Official sale context could not be loaded.',
        });
      });
  }, [bbl]);

  const result = state.status === 'ready' ? state.result : null;
  const available =
    result?.status === 'available' &&
    result.summary !== null &&
    result.comparables.length > 0;

  return (
    <section
      data-testid="parcel-sales-comparables"
      data-state={state.status}
      className="overflow-hidden border-b border-rule bg-white "
    >
      <div
        className={
          compact
            ? 'flex flex-col gap-3 border-b border-rule bg-white px-4 py-4 text-ink'
            : 'flex flex-col gap-3 border-b border-rule bg-white px-4 py-4 text-ink sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div className="flex items-start gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">Official sale context</h4>
              <span className="px-2 py-0.5 text-xs font-semibold text-ink">
                NYC DOF
              </span>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-ink-3">
              Recent tax-lot transactions selected by class, scale, proximity,
              and recency. Comparable screen only; not a valuation.
            </p>
          </div>
        </div>

        {(state.status === 'idle' || state.status === 'error') && (
          <button
            type="button"
            onClick={load}
            data-testid="parcel-sales-comparables-load"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
          >
            {state.status === 'error' ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Scale className="h-3.5 w-3.5" />
            )}
            {state.status === 'error' ? 'Try again' : 'Load sale context'}
          </button>
        )}

        {state.status === 'loading' && (
          <div
            data-testid="parcel-sales-comparables-loading"
            className="inline-flex h-9 shrink-0 items-center gap-2 border-b border-rule bg-white px-3 text-xs font-semibold text-ink-3"
          >
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-ink" />
            Screening official records…
          </div>
        )}
      </div>

      {state.status === 'idle' && (
        <div className="flex items-start gap-3 px-4 py-4 text-xs leading-5 text-ink-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <p>
            Load when you need pricing context. CityLens queries current PLUTO
            location facts and recent DOF sales without changing the parcel
            score.
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div
          data-testid="parcel-sales-comparables-error"
          className="flex items-start gap-3 border-t border-rule px-4 py-4 text-xs leading-5 text-red-700"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Sale context unavailable</p>
            <p>{state.message}</p>
          </div>
        </div>
      )}

      {state.status === 'ready' && !available && (
        <div
          data-testid="parcel-sales-comparables-insufficient"
          className="flex items-start gap-3 px-4 py-4 text-xs leading-5 text-ink-2"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <div>
            <p className="font-semibold text-ink">
              No defensible comparison set
            </p>
            <p className="mt-1">
              {result?.status === 'insufficient_source_facts'
                ? 'Current PLUTO location facts are incomplete for this tax lot.'
                : 'No recent official sales passed the parcel-level quality screen.'}
            </p>
            <p className="mt-1">
              CityLens leaves the result empty rather than filling it with weak
              transactions.
            </p>
          </div>
        </div>
      )}

      {available && result.summary && (
        <div data-testid="parcel-sales-comparables-ready">
          <div
            className={
              compact
                ? 'grid gap-2 border-b border-rule p-4 sm:grid-cols-2'
                : 'grid gap-2 border-b border-rule p-4 sm:grid-cols-3'
            }
          >
            <SummaryMetric
              label="Median sale"
              value={money(result.summary.median_sale_price)}
              detail={`${result.summary.comparable_count} selected transactions`}
            />
            <SummaryMetric
              label="Median / land sf"
              value={money(result.summary.median_price_per_land_sqft)}
              detail="Reported tax-lot land area"
            />
            <SummaryMetric
              label="Observed range"
              value={
                result.summary.minimum_sale_price ===
                result.summary.maximum_sale_price
                  ? money(result.summary.minimum_sale_price)
                  : `${compactMoney(result.summary.minimum_sale_price)} – ${compactMoney(result.summary.maximum_sale_price)}`
              }
              detail={`Sales since ${date(result.query_window_start)}`}
            />
          </div>

          <div className="flex justify-between gap-3 border-b border-rule px-4 py-2 font-cond text-xs text-ink-3" aria-hidden="true"><span>Parcel and sale record</span><span>Sale price</span></div>
          <div className="divide-y divide-rule">
            {result.comparables.map((sale) => (
              <article
                key={`${sale.bbl}-${sale.sale_date}`}
                data-testid="parcel-comparable-sale"
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="truncate text-xs font-semibold text-ink">
                      {formatAddress(sale.address)}
                    </h5>
                    <span className="font-mono text-xs text-ink-3">
                      {formatBbl(sale.bbl)}
                    </span>
                    {sale.building_class && (
                      <span className="text-xs text-ink-3">
                        Class {sale.building_class}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">
                    {date(sale.sale_date)} · {sale.distance_miles.toFixed(1)} mi
                    · {number(sale.lot_area_sqft)} land sf
                    {sale.gross_area_sqft !== null
                      ? ` · ${number(sale.gross_area_sqft)} gross sf`
                      : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sale.match_reasons.map((reason) => (
                      <span
                        key={reason}
                        className="px-2 py-0.5 text-xs font-medium text-ink"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-sm font-semibold text-ink">
                    {money(sale.sale_price)}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {money(sale.price_per_land_sqft)} / land sf
                  </p>
                  {sale.price_per_gross_sqft !== null && (
                    <p className="text-xs text-ink-3">
                      {money(sale.price_per_gross_sqft)} / gross sf
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <footer className="border-t border-rule bg-white px-4 py-3">
            <div className="flex flex-col gap-2 text-xs leading-4 text-ink-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl">{result.interpretation}</p>
              <a
                href={result.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-ink hover:text-ink"
              >
                DOF source
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-3">
              Dataset {result.source_dataset_id} · source updated{' '}
              {date(
                result.source_data_updated_at ?? result.source_retrieved_at,
              )}
              {result.source_limit_reached
                ? ' · source query limit reached; review manually'
                : ''}
            </p>
          </footer>
        </div>
      )}
    </section>
  );
}
