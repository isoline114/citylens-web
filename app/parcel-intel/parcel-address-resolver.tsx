'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  MapPinCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Signpost,
  TriangleAlert,
} from 'lucide-react';

import {
  resolveParcelAddress,
  type ParcelAddressResolution,
} from '@/lib/api';
import { ParcelScreeningLookup } from './parcel-screening-lookup';
import { BOROUGH_LABELS } from './parcel-intel-explorer-support';

type ResolverState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: ParcelAddressResolution }
  | { status: 'error'; message: string };

type Props = {
  address: string;
};

function sourceDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function ParcelAddressResolver({ address }: Props) {
  const [state, setState] = useState<ResolverState>({ status: 'idle' });
  const [selectedBbl, setSelectedBbl] = useState<string | null>(null);

  useEffect(() => {
    setState({ status: 'idle' });
    setSelectedBbl(null);
  }, [address]);

  const resolve = async () => {
    setState({ status: 'loading' });
    setSelectedBbl(null);
    try {
      const result = await resolveParcelAddress(address);
      setState({ status: 'ready', result });
      if (
        result.match_status === 'unique' &&
        result.candidates.length === 1
      ) {
        setSelectedBbl(result.candidates[0].bbl);
      }
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The official address directory could not be checked.',
      });
    }
  };

  const result = state.status === 'ready' ? state.result : null;

  return (
    <>
      <section
        data-testid="parcel-address-resolver"
        className="border-b border-sky-200 bg-[linear-gradient(110deg,#f0f9ff_0%,#ffffff_48%,#ecfdf5_100%)] px-4 py-5 md:px-6"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl border border-sky-200 bg-white p-2.5 text-sky-700 shadow-sm">
              <MapPinCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
                Official tax-lot discovery
              </p>
              <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-950">
                Search the complete NYC address directory
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                No ranked lead matches this search. Resolve it against current
                PAD and PLUTO records, then inspect the selected tax lot&apos;s
                separate CityLens screening receipt.
              </p>
              <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white/85 px-2.5 py-1.5 text-xs text-slate-700 shadow-sm">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="truncate">{address}</span>
              </p>
            </div>
          </div>

          {(state.status === 'idle' || state.status === 'error') && (
            <div className="shrink-0">
              {state.status === 'error' && (
                <p
                  className="mb-2 max-w-sm text-xs leading-5 text-rose-700"
                  role="alert"
                >
                  {state.message}
                </p>
              )}
              <button
                type="button"
                onClick={() => void resolve()}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                {state.status === 'error' ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <Signpost className="h-3.5 w-3.5" />
                )}
                {state.status === 'error'
                  ? 'Retry official lookup'
                  : 'Resolve official tax lots'}
              </button>
            </div>
          )}

          {state.status === 'loading' && (
            <div
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-xs font-semibold text-sky-900 shadow-sm"
              role="status"
            >
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Checking official address records…
            </div>
          )}
        </div>

        {result && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2.5">
                {result.match_status === 'unique' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : result.match_status === 'ambiguous' ? (
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                ) : (
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {result.match_status === 'unique'
                      ? 'One official tax lot found'
                      : result.match_status === 'ambiguous'
                        ? `${result.candidate_count.toLocaleString()} official tax lots share this address`
                        : 'No exact official tax-lot match'}
                  </p>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                    {result.interpretation}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  NYC PAD · {sourceDate(result.source_retrieved_at)}
                </span>
              </div>
            </div>

            {result.candidates.length > 0 && (
              <div
                data-testid="parcel-address-candidates"
                className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              >
                {result.candidates.map((candidate) => {
                  const selected = selectedBbl === candidate.bbl;
                  return (
                    <button
                      key={candidate.bbl}
                      type="button"
                      onClick={() => setSelectedBbl(candidate.bbl)}
                      aria-pressed={selected}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                        selected
                          ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100'
                          : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'
                      }`}
                    >
                      <span>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {BOROUGH_LABELS[candidate.borough] ??
                            candidate.borough}
                        </span>
                        <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-950">
                          {candidate.bbl}
                        </span>
                      </span>
                      <ArrowRight
                        className={`h-4 w-4 ${
                          selected ? 'text-sky-700' : 'text-slate-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {result.truncated && (
              <p className="mt-3 text-xs leading-5 text-amber-800">
                This unusually broad address has more than 20 tax-lot matches.
                Refine the street number or verify the intended BBL in ZoLa.
              </p>
            )}
            {(result.unit_designator_ignored ||
              result.locality_ignored) && (
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Tax-lot matching ignores apartment/unit designators and
                postal locality text; it does not resolve individual units.
              </p>
            )}
            {result.match_status === 'not_found' && (
              <a
                href="https://zola.planning.nyc.gov/"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Verify in NYC ZoLa
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </section>

      {selectedBbl && (
        <ParcelScreeningLookup bbl={selectedBbl} isAuthenticated />
      )}
    </>
  );
}
