'use client';

import {
  ArrowUpRight,
  Building2,
  Columns3,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { ParcelIntelRow } from '@/lib/api';
import {
  BOROUGH_LABELS,
  opportunityLabel,
  priorityLabel,
} from './parcel-intel-explorer-support';

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return value || '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))),
  );
}

function rankLabel(row: ParcelIntelRow): string {
  if (row.citywide_rank) return `NYC #${row.citywide_rank}`;
  if (row.acquisition_rank) return `Borough #${row.acquisition_rank}`;
  if (row.priority_rank) return `Borough #${row.priority_rank}`;
  return priorityLabel(row.priority_tier);
}

function readinessLabel(row: ParcelIntelRow): string {
  const statusLabels: Record<
    NonNullable<ParcelIntelRow['acquisition_status']>,
    string
  > = {
    eligible: 'Acquisition screened',
    active_project: 'Existing project activity',
    completed_project: 'Completed project',
    constrained: 'Current constraint',
    incomplete_data: 'Evidence incomplete',
  };
  return (
    row.decision_audit?.readiness?.label ??
    (row.acquisition_status
      ? statusLabels[row.acquisition_status]
      : 'Initial review required')
  );
}

function recommendedAction(row: ParcelIntelRow): string {
  return (
    row.decision_audit?.readiness?.recommended_action ??
    'Open the parcel evidence and verify current records before pursuit.'
  );
}

function currentProject(row: ParcelIntelRow): ReactNode {
  if (!row.latest_project_job_number && !row.latest_project_status) return 'None surfaced';
  const label = [
    row.latest_project_job_number,
    row.latest_project_status,
  ]
    .filter(Boolean)
    .join(' · ');
  if (
    row.latest_project_url?.startsWith('https://') &&
    row.latest_project_job_number
  ) {
    return (
      <a
        href={row.latest_project_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-900"
      >
        {label}
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    );
  }
  return label;
}

function diligenceFlags(row: ParcelIntelRow): string[] {
  const flags: string[] = [];
  if (row.acquisition_status === 'active_project') flags.push('Active project');
  if (row.acquisition_status === 'completed_project') flags.push('Completed project');
  if (row.is_landmark) flags.push('Individual landmark');
  if (row.is_historic_district) flags.push('Historic district');
  if (row.floodplain_1pct) flags.push('1% floodplain');
  if (row.environmental_review_required) flags.push('E/R designation');
  if (row.mandatory_inclusionary_housing) flags.push('MIH mapped area');
  if ((row.critical_violation_count ?? 0) > 0) {
    flags.push(`${formatNumber(row.critical_violation_count)} immediate hazards`);
  }
  return flags;
}

function diligenceEvidenceDates(
  row: ParcelIntelRow,
): Array<{ label: string; value: string }> {
  return [
    { label: 'Violations', value: row.violation_data_as_of },
    { label: 'Floodplain', value: row.floodplain_data_as_of },
    {
      label: 'Environmental',
      value: row.environmental_designation_data_as_of,
    },
    { label: 'MIH', value: row.mih_data_as_of },
    { label: 'Transit', value: row.transit_data_as_of },
    { label: 'Tax-lien history', value: row.tax_lien_data_as_of },
  ]
    .filter(
      (
        item,
      ): item is {
        label: string;
        value: string;
      } => Boolean(item.value),
    )
    .map((item) => ({ ...item, value: formatDate(item.value) }));
}

type ComparisonRow = {
  label: string;
  description?: string;
  render: (row: ParcelIntelRow) => ReactNode;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Decision posture',
    description: 'Current screening, separate from historical rank',
    render: (row) => (
      <div>
        <div className="font-semibold text-slate-950">{readinessLabel(row)}</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {recommendedAction(row)}
        </p>
      </div>
    ),
  },
  {
    label: 'Opportunity',
    render: (row) => (
      <div>
        <div className="font-medium text-slate-950">
          {opportunityLabel(row.opportunity_category)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {priorityLabel(row.priority_tier)} priority
        </div>
      </div>
    ),
  },
  {
    label: 'Development capacity',
    description: 'PLUTO screening values—not a zoning determination',
    render: (row) => (
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Lot</dt>
          <dd className="font-medium text-slate-900">
            {formatNumber(row.lot_area_sqft)} sqft
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Allowed FAR</dt>
          <dd className="font-medium text-slate-900">
            {row.allowed_far?.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }) ?? '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Unused floor area</dt>
          <dd className="font-medium text-slate-900">
            {formatNumber(row.unused_floor_area_sqft)} sqft
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Built</dt>
          <dd className="font-medium text-slate-900">
            {row.far_utilization_pct === null
              ? '—'
              : `${Math.round(row.far_utilization_pct)}%`}
          </dd>
        </div>
      </dl>
    ),
  },
  {
    label: 'Ownership & sale',
    render: (row) => (
      <div className="space-y-1">
        <div className="font-medium text-slate-950">
          {row.owner_name ?? row.owner_type ?? 'Owner unavailable'}
        </div>
        <div className="text-xs text-slate-500">
          Held {formatNumber(row.years_held)} years
          {row.owner_portfolio_lot_count && row.owner_portfolio_lot_count > 1
            ? ` · ${row.owner_portfolio_lot_count} exact-name lots`
            : ''}
        </div>
        <div className="text-xs text-slate-600">
          Last sale {formatCurrency(row.last_sale_price)}
          {row.last_sale_year ? ` (${row.last_sale_year})` : ''}
        </div>
      </div>
    ),
  },
  {
    label: 'Current project record',
    render: currentProject,
  },
  {
    label: 'Surfaced diligence',
    render: (row) => {
      const flags = diligenceFlags(row);
      return flags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((flag) => (
            <span
              key={flag}
              className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200"
            >
              {flag}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-emerald-800">
          No surfaced flags; full diligence still required
        </span>
      );
    },
  },
  {
    label: 'Evidence currency',
    render: (row) => {
      const diligenceDates = diligenceEvidenceDates(row);
      return (
        <dl className="space-y-1 text-xs">
          {[
            {
              label: 'Property facts',
              value: formatDate(row.property_facts_as_of),
            },
            { label: 'Ownership', value: formatDate(row.ownership_as_of) },
            {
              label: 'Project activity',
              value: formatDate(row.project_activity_as_of),
            },
            ...diligenceDates,
          ].map((item) => (
            <div key={item.label} className="flex justify-between gap-3">
              <dt className="text-slate-500">{item.label}</dt>
              <dd className="font-medium text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    },
  },
];

export function ParcelComparisonDesk({
  rows,
  onClose,
  onRemove,
  onSelectParcel,
}: {
  rows: ParcelIntelRow[];
  onClose: () => void;
  onRemove: (bbl: string) => void;
  onSelectParcel: (bbl: string) => void;
}) {
  return (
    <section
      className="border-b border-slate-200 bg-slate-50"
      aria-label="Parcel comparison desk"
      data-testid="parcel-comparison-desk"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            <Columns3 className="h-4 w-4" />
            Evidence comparison
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Compare the shortlist before committing team time.
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            Side-by-side current facts, acquisition posture, capacity, and
            source dates. This is a screening aid—not an appraisal, site plan,
            zoning opinion, or buy/pass recommendation.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          aria-label="Close parcel comparison"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="overflow-x-auto px-3 py-4 md:px-5">
        <table
          className="w-full table-fixed overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ minWidth: `${190 + rows.length * 270}px` }}
        >
          <caption className="sr-only">
            Current acquisition evidence for {rows.length} shortlisted parcels
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-950 text-left text-white">
              <th className="w-[190px] px-4 py-4 align-top text-xs font-semibold uppercase tracking-wide text-slate-400">
                Measure
              </th>
              {rows.map((row) => (
                <th key={row.bbl} className="px-4 py-4 align-top">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                        {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} ·{' '}
                        {rankLabel(row)}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">
                        {row.address ?? `BBL ${row.bbl}`}
                      </div>
                      <div className="mt-1 text-[11px] font-normal text-slate-400">
                        BBL {row.bbl}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(row.bbl)}
                      aria-label={`Remove ${row.address ?? row.bbl} from comparison`}
                      className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectParcel(row.bbl)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-100"
                  >
                    Open parcel
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((item, index) => (
              <tr
                key={item.label}
                className={
                  index === COMPARISON_ROWS.length - 1
                    ? ''
                    : 'border-b border-slate-200'
                }
              >
                <th className="bg-slate-50 px-4 py-4 text-left align-top">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    {item.label === 'Decision posture' ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    ) : item.label === 'Development capacity' ? (
                      <Building2 className="h-3.5 w-3.5 text-violet-600" />
                    ) : null}
                    {item.label}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-[10px] font-normal leading-4 text-slate-500">
                      {item.description}
                    </p>
                  )}
                </th>
                {rows.map((row) => (
                  <td
                    key={`${item.label}-${row.bbl}`}
                    className="px-4 py-4 align-top text-sm text-slate-700"
                  >
                    {item.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
