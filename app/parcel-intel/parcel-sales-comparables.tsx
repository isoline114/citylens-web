'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BadgeDollarSign,
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
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
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div
        className={
          compact
            ? 'flex flex-col gap-3 border-b border-slate-200 bg-slate-950 px-4 py-4 text-white'
            : 'flex flex-col gap-3 border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_40%),linear-gradient(110deg,#07101f,#10293e)] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div className="flex items-start gap-3">
          <span className="rounded-xl border border-white/10 bg-white/10 p-2 text-emerald-200">
            <BadgeDollarSign className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">Official sale context</h4>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                NYC DOF
              </span>
            </div>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-300">
              Recent tax-lot transactions selected by class, scale, proximity,
              and recency. Comparable screen only—not a valuation.
            </p>
          </div>
        </div>

        {(state.status === 'idle' || state.status === 'error') && (
          <button
            type="button"
            onClick={load}
            data-testid="parcel-sales-comparables-load"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
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
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-xs font-semibold text-slate-100"
          >
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-emerald-300" />
            Screening official records…
          </div>
        )}
      </div>

      {state.status === 'idle' && (
        <div className="flex items-start gap-3 px-4 py-4 text-xs leading-5 text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
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
          className="flex items-start gap-3 border-t border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-900"
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
          className="flex items-start gap-3 px-4 py-4 text-xs leading-5 text-slate-600"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-slate-900">
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
                ? 'grid gap-2 border-b border-slate-200 p-4 sm:grid-cols-2'
                : 'grid gap-2 border-b border-slate-200 p-4 sm:grid-cols-3'
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

          <div className="divide-y divide-slate-200">
            {result.comparables.map((sale, index) => (
              <article
                key={`${sale.bbl}-${sale.sale_date}`}
                data-testid="parcel-comparable-sale"
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[9px] font-bold text-white">
                      {index + 1}
                    </span>
                    <h5 className="truncate text-xs font-semibold text-slate-950">
                      {sale.address}
                    </h5>
                    <span className="font-mono text-[9px] text-slate-400">
                      {sale.bbl}
                    </span>
                    {sale.building_class && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                        Class {sale.building_class}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
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
                        className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-medium text-sky-800"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-slate-950">
                    {money(sale.sale_price)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {money(sale.price_per_land_sqft)} / land sf
                  </p>
                  {sale.price_per_gross_sqft !== null && (
                    <p className="text-[10px] text-slate-500">
                      {money(sale.price_per_gross_sqft)} / gross sf
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-2 text-[10px] leading-4 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl">{result.interpretation}</p>
              <a
                href={result.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-sky-700 hover:text-sky-900"
              >
                DOF source
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
            <p className="mt-1 text-[9px] text-slate-400">
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
