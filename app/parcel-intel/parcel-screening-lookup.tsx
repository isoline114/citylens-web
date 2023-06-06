'use client';

import Link from 'next/link';
import { formatBbl } from '@/lib/parcel-format';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  getParcelScreeningStatus,
  recordParcelProductEvent,
  type ParcelScreeningStatus,
} from '@/lib/api';

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; receipt: ParcelScreeningStatus }
  | { status: 'error'; message: string };

type Props = {
  bbl: string;
  isAuthenticated: boolean;
};

const RESULT_COPY: Record<
  ParcelScreeningStatus['result'],
  { status: string; title: string; tone: string; icon: typeof SearchCheck }
> = {
  published_lead: {
    status: 'Published lead',
    title: 'This parcel is in the current acquisition inventory',
    tone: 'border-rule bg-white text-ink',
    icon: CheckCircle2,
  },
  qualified_below_cutoff: {
    status: 'Qualified · below cutoff',
    title: 'This parcel passed screening but is outside the top 5,000',
    tone: 'border-rule bg-white text-ink',
    icon: SearchCheck,
  },
  screened_out: {
    status: 'Screened out',
    title: 'Excluded from the current acquisition inventory',
    tone: 'border-rule bg-white text-ink',
    icon: ShieldAlert,
  },
  not_evaluated: {
    status: 'Not evaluated',
    title: 'Outside the current candidate ledger',
    tone: 'border-rule bg-white text-ink',
    icon: SearchCheck,
  },
};

const REASON_LABELS: Record<string, string> = {
  approved_land_use_project: 'Approved land-use project',
  active_land_use_project: 'Active land-use project',
  active_new_building_project: 'Active new-building project',
  completed_new_building_project: 'Completed new-building project',
  recent_sale: 'Recent sale',
  public_or_non_private_owner: 'Public or non-private owner',
  landmark_or_historic_district: 'Landmark or historic-district constraint',
  incomplete_property_record: 'Incomplete property record',
};

function humanizeReason(reason: string): string {
  return (
    REASON_LABELS[reason] ??
    reason
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function sourceDates(receipt: ParcelScreeningStatus) {
  return [
    ['Property facts', receipt.property_facts_as_of],
    ['Ownership', receipt.ownership_as_of],
    ['DOB projects', receipt.project_activity_as_of],
    ['ZAP land use', receipt.land_use_activity_as_of],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

export function canonicalParcelBbl(query: string): string | null {
  if (!/^[\d\s-]+$/.test(query.trim())) return null;
  const bbl = query.replace(/\D/g, '');
  return /^[1-5]\d{9}$/.test(bbl) ? bbl : null;
}

export function ParcelScreeningLookup({ bbl, isAuthenticated }: Props) {
  const [state, setState] = useState<LookupState>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'idle' });
  }, [bbl, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <section className="border-b border-rule bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-sm border border-rule bg-white p-2 text-ink">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <div>
              <p className="font-cond text-[13px] font-semibold text-ink">
                Exact-BBL screening receipt
              </p>
              <p className="mt-1 text-sm leading-5 text-ink">
                BBL <span className="font-mono font-semibold">{formatBbl(bbl)}</span> is
                not in this public preview. Sign in to check the complete
                inventory and its current screening status.
              </p>
            </div>
          </div>
          <Link
            href="/sign-in?next=%2Fparcel-intel"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink"
          >
            Sign in to inspect
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  const inspect = async () => {
    setState({ status: 'loading' });
    try {
      const receipt = await getParcelScreeningStatus(bbl);
      setState({ status: 'ready', receipt });
      void recordParcelProductEvent(
        'screening_lookup_completed',
        'screening_lookup',
      ).catch(() => {
        // Adoption telemetry must never block the screening result.
      });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The screening receipt could not be loaded.',
      });
    }
  };

  if (state.status === 'ready') {
    const { receipt } = state;
    const copy = RESULT_COPY[receipt.result];
    const Icon = copy.icon;
    const dates = sourceDates(receipt);
    return (
      <section
        data-testid="parcel-screening-receipt"
        className={`border-b px-4 py-5 md:px-6 ${copy.tone}`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 rounded-sm border border-current/15 bg-white/70 p-2">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight">{copy.title}</h3>
              <p className="mt-1 text-xs text-ink-3">{copy.status} · BBL <span className="font-mono">{formatBbl(receipt.bbl)}</span></p>
              <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">
                {receipt.interpretation}
              </p>
              {receipt.exclusion_reasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {receipt.exclusion_reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-sm border border-current/15 bg-white/75 px-2.5 py-1 text-xs font-medium"
                    >
                      {humanizeReason(reason)}
                    </span>
                  ))}
                </div>
              )}
              {receipt.latest_project_job_number && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                  <span>
                    Latest official project:{' '}
                    <strong>{receipt.latest_project_job_number}</strong>
                    {receipt.latest_project_status
                      ? ` · ${receipt.latest_project_status}`
                      : ''}
                  </span>
                  {receipt.latest_project_url && (
                    <a
                      href={receipt.latest_project_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline decoration-current/30 underline-offset-2 hover:decoration-current"
                    >
                      Open official record
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 rounded-sm border border-current/10 bg-white/70 px-3.5 py-3 text-xs">
            <p className="font-cond font-semibold text-ink-3">
              Evidence currency
            </p>
            {dates.length > 0 ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-ink-3">
                {dates.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="opacity-65">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2">Current feed receipt</p>
            )}
            <p className="mt-2 border-t border-current/10 pt-2">
              Exact lookup · private · no bulk ledger exposure
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-rule bg-white px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-sm border border-rule bg-white p-2 text-ink">
            <SearchCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="font-cond text-[13px] font-semibold text-ink-3">
              Not found in the published 5,000
            </p>
            <p className="mt-1 text-sm leading-5 text-ink">
              Inspect the private, current screening receipt for BBL{' '}
              <span className="font-mono font-semibold text-ink">
                {formatBbl(bbl)}
              </span>
              .
            </p>
            {state.status === 'error' && (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {state.message}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void inspect()}
          disabled={state.status === 'loading'}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink disabled:cursor-wait disabled:opacity-70"
        >
          {state.status === 'loading' ? (
            <>
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Checking current ledger
            </>
          ) : state.status === 'error' ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry screening check
            </>
          ) : (
            <>
              Check current screening
              <ArrowUpRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </section>
  );
}
