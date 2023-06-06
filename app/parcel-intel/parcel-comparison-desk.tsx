'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';

import Link from 'next/link';
import {
  ArrowUpRight,
  BookmarkPlus,
  BriefcaseBusiness,
  Building2,
  Check,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import type {
  ParcelIntelRow,
  ParcelWorkflowAdvanceResponse,
} from '@/lib/api';
import { downloadCsv } from './[borough]/parcel-intel-csv';
import { buildComparisonBrief } from './parcel-comparison-export';
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

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function currentProject(row: ParcelIntelRow): ReactNode {
  if (!row.latest_project_job_number && !row.latest_project_status) return 'None surfaced';
  const label = [
    row.latest_project_job_number,
    row.latest_project_status,
  ]
    .filter(Boolean)
    .join(' · ');
  const projectUrl = safeHttpsUrl(row.latest_project_url);
  if (projectUrl && row.latest_project_job_number) {
    return (
      <a
        href={projectUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-ink hover:text-select"
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
        <div className="font-semibold text-ink">{readinessLabel(row)}</div>
        <p className="mt-1 text-xs leading-5 text-ink-3">
          {recommendedAction(row)}
        </p>
      </div>
    ),
  },
  {
    label: 'Opportunity',
    render: (row) => (
      <div>
        <div className="font-medium text-ink">
          {opportunityLabel(row.opportunity_category)}
        </div>
        <div className="mt-1 text-xs text-ink-3">
          {priorityLabel(row.priority_tier)} priority
        </div>
      </div>
    ),
  },
  {
    label: 'Development capacity',
    description: 'PLUTO screening values, not a zoning determination',
    render: (row) => (
      <dl className="space-y-2 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Lot</dt>
          <dd className="text-right text-sm font-medium tabular-nums text-ink">
            {formatNumber(row.lot_area_sqft)} sqft
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Allowed FAR</dt>
          <dd className="text-right text-sm font-medium tabular-nums text-ink">
            {row.allowed_far?.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }) ?? '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Unused floor area</dt>
          <dd className="text-right text-sm font-medium tabular-nums text-ink">
            {formatNumber(row.unused_floor_area_sqft)} sqft
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Built</dt>
          <dd className="text-right text-sm font-medium tabular-nums text-ink">
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
        <div className="font-medium text-ink">
          {row.owner_name ?? row.owner_type ?? 'Owner unavailable'}
        </div>
        <div className="text-xs text-ink-3">
          Held {formatNumber(row.years_held)} years
          {row.owner_portfolio_lot_count && row.owner_portfolio_lot_count > 1
            ? ` · ${row.owner_portfolio_lot_count} exact-name lots`
            : ''}
        </div>
        <div className="text-xs text-ink-3">
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
              className="text-xs text-ink-2"
            >
              {flag}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-ink">
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
        <dl className="space-y-2 text-xs">
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
              <dt className="text-ink-3">{item.label}</dt>
              <dd className="text-right font-mono text-xs text-ink-3">{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    },
  },
];

export function ParcelComparisonDesk({
  rows,
  signedIn,
  onClose,
  onRemove,
  onSelectParcel,
  onAdvance,
}: {
  rows: ParcelIntelRow[];
  signedIn: boolean;
  onClose: () => void;
  onRemove: (bbl: string) => void;
  onSelectParcel: (bbl: string) => void;
  onAdvance: (
    row: ParcelIntelRow,
    input: { nextAction: string; dueDate: string | null },
  ) => Promise<ParcelWorkflowAdvanceResponse['status']>;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const [selectedBbl, setSelectedBbl] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [advanceState, setAdvanceState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | {
        status: 'saved';
        result: ParcelWorkflowAdvanceResponse['status'];
      }
    | { status: 'error' }
  >({ status: 'idle' });
  const selectedRow =
    rows.find((candidate) => candidate.bbl === selectedBbl) ?? null;

  const copyEvidenceBrief = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyState('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(buildComparisonBrief(rows));
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  };

  const chooseForAdvance = (row: ParcelIntelRow, trigger: HTMLElement) => {
    const dialog = trigger.closest<HTMLElement>('[role="dialog"]');
    if (dialog) {
      dialog.scrollTop = 0;
    }
    setSelectedBbl(row.bbl);
    setNextAction(recommendedAction(row));
    setDueDate('');
    setAdvanceState({ status: 'idle' });
  };

  const removeRow = (bbl: string) => {
    if (selectedBbl === bbl) {
      setSelectedBbl(null);
      setNextAction('');
      setDueDate('');
      setAdvanceState({ status: 'idle' });
    }
    onRemove(bbl);
  };

  const advanceSelected = async () => {
    const action = nextAction.trim();
    if (!selectedRow || !action || advanceState.status === 'saving') return;
    setAdvanceState({ status: 'saving' });
    try {
      const result = await onAdvance(selectedRow, {
        nextAction: action,
        dueDate: dueDate || null,
      });
      setAdvanceState({ status: 'saved', result });
    } catch {
      setAdvanceState({ status: 'error' });
    }
  };

  return (
    <section
      className="flex min-w-0 flex-col border-b border-rule bg-white text-ink"
      aria-label="Parcel comparison desk"
      data-testid="parcel-comparison-desk"
    >
      <div className="order-1 flex flex-col gap-3 border-b border-rule bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
        <div>
          <h3 className="mt-1 text-lg font-semibold text-ink">
            Compare parcel evidence
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-3">
            Side-by-side current facts, acquisition posture, capacity, and
            source dates. This is a screening aid, not an appraisal, site plan,
            zoning opinion, or buy/pass recommendation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(rows, 'comparison')}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink hover:bg-white"
          >
            <Download className="h-3.5 w-3.5" />
            Evidence CSV
          </button>
          <button
            type="button"
            onClick={() => void copyEvidenceBrief()}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink hover:bg-white"
          >
            {copyState === 'copied' ? (
              <Check className="h-3.5 w-3.5 text-ink" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copyState === 'copied'
              ? 'Brief copied'
              : copyState === 'error'
                ? 'Copy unavailable'
                : 'Copy evidence brief'}
          </button>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close parcel comparison"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      </div>

      <div
        className="order-3 min-w-0 overflow-x-auto px-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-select md:px-5"
        role="region"
        aria-label="Scrollable parcel evidence comparison table"
        tabIndex={0}
      >
        <p className="mb-2 text-xs leading-4 text-ink-3 md:hidden">
          Scroll horizontally to review every parcel and evidence field.
        </p>
        <table
          className="w-full table-fixed border-collapse bg-white tabular-nums"
          style={{ minWidth: `${190 + rows.length * 270}px` }}
        >
          <caption className="sr-only">
            Current acquisition evidence for {rows.length} shortlisted parcels
          </caption>
          <thead>
            <tr className="border-b border-rule bg-white text-left text-ink">
              <th scope="col" className="font-cond w-[190px] px-4 py-4 align-top text-[13px] font-semibold text-ink-3">
                Measure
              </th>
              {rows.map((row) => (
                <th scope="col" key={row.bbl} className="border-l border-rule px-4 py-4 align-top">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-ink-3">
                        {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} ·{' '}
                        {rankLabel(row)}
                      </div>
                      <div className="mt-1 break-words text-base font-semibold text-ink">
                        {formatAddress(row.address) || `BBL ${formatBbl(row.bbl)}`}
                      </div>
                      <div className="mt-1 font-mono text-xs font-normal text-ink-3">
                        BBL {formatBbl(row.bbl)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.bbl)}
                      aria-label={`Remove ${row.address ?? row.bbl} from comparison`}
                      className="rounded-sm p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectParcel(row.bbl)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-select"
                  >
                    Open parcel
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                  {signedIn && (
                    <button
                      type="button"
                      onClick={(event) =>
                        chooseForAdvance(row, event.currentTarget)
                      }
                      aria-pressed={selectedBbl === row.bbl}
                      aria-label={`Advance ${row.address ?? row.bbl} from comparison`}
                      className={`ml-3 mt-3 inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-semibold transition-colors ${
                        selectedBbl === row.bbl
                          ? 'border-ink bg-paper-2 text-ink'
                          : 'border-control bg-white text-ink hover:bg-paper-2'
                      }`}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      {selectedBbl === row.bbl ? 'Selected to advance' : 'Advance'}
                    </button>
                  )}
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
                    : 'border-b border-rule'
                }
              >
                <th scope="row" className="px-4 py-4 text-left align-top">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    {item.label === 'Decision posture' ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-ink" />
                    ) : item.label === 'Development capacity' ? (
                      <Building2 className="h-3.5 w-3.5 text-ink" />
                    ) : null}
                    {item.label}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs font-normal leading-4 text-ink-3">
                      {item.description}
                    </p>
                  )}
                </th>
                {rows.map((row) => (
                  <td
                    key={`${item.label}-${row.bbl}`}
                    className="border-l border-rule px-4 py-4 align-top text-sm text-ink"
                  >
                    {item.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section
        className="order-2 border-b border-rule bg-white px-4 py-4 md:px-6"
        aria-label="Comparison decision handoff"
        data-testid="comparison-decision-handoff"
      >
        {!signedIn ? (
          <div className="flex flex-col gap-3 border-l-2 border-rule pl-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
                <BriefcaseBusiness className="h-4 w-4" />
                Turn evidence into a decision
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink">
                Sign in to advance one parcel with a fixed evidence snapshot
                and a concrete next diligence action.
              </p>
            </div>
            <Link
              href="/sign-in?next=%2Fparcel-intel"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90"
            >
              Sign in to advance
            </Link>
          </div>
        ) : selectedRow ? (
          <div className="border-l-2 border-ink pl-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="mt-1 text-base font-semibold text-ink">
                  Advance {formatAddress(selectedRow.address) || `BBL ${formatBbl(selectedRow.bbl)}`}
                </h4>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-3">
                  CityLens records your choice as pursuing and preserves the
                  current evidence snapshot. It will never replace an active
                  workflow record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBbl(null);
                  setNextAction('');
                  setDueDate('');
                  setAdvanceState({ status: 'idle' });
                }}
                className="text-xs font-semibold text-ink-3 hover:text-ink"
              >
                Choose another
              </button>
            </div>

            {advanceState.status === 'saved' ? (
              <div
                className="mt-4 flex flex-col gap-3 border-t border-rule bg-white py-4 sm:flex-row sm:items-center sm:justify-between"
                role="status"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Check className="h-4 w-4" />
                    {advanceState.result === 'existing'
                      ? 'Active workflow preserved'
                      : advanceState.result === 'restored'
                        ? 'Lead restored to reviewing'
                        : 'Lead advanced to reviewing'}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink-3">
                    {advanceState.result === 'existing'
                      ? 'No existing stage, action, assignee, or note was changed.'
                      : 'The save-time evidence is fixed; future workflow edits cannot rewrite the original rank.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectParcel(selectedRow.bbl)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink px-3 text-xs font-semibold text-white hover:bg-ink/90"
                >
                  Open parcel workspace
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="text-xs font-medium text-ink">
                    Next diligence action
                    <input
                      value={nextAction}
                      onChange={(event) => {
                        setNextAction(event.target.value);
                        if (advanceState.status === 'error') {
                          setAdvanceState({ status: 'idle' });
                        }
                      }}
                      maxLength={240}
                      className="field mt-1 h-10 w-full rounded-sm border border-control bg-white px-3 text-sm font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
                    />
                  </label>
                  <label className="text-xs font-medium text-ink">
                    Due date <span className="font-normal text-ink-3">(optional)</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="field mt-1 h-10 w-full rounded-sm border border-control bg-white px-3 text-sm font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={`text-xs ${
                      advanceState.status === 'error'
                        ? 'text-rose-700'
                        : 'text-ink-3'
                    }`}
                    role={advanceState.status === 'error' ? 'alert' : undefined}
                  >
                    {advanceState.status === 'error'
                      ? 'This parcel could not be advanced. Your comparison is unchanged; retry when ready.'
                      : 'Watching is enabled so current-source changes can resurface this decision.'}
                  </p>
                  <button
                    type="button"
                    data-testid="advance-comparison-parcel"
                    disabled={
                      !nextAction.trim() || advanceState.status === 'saving'
                    }
                    onClick={() => void advanceSelected()}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {advanceState.status === 'saving' ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <BookmarkPlus className="h-4 w-4" />
                    )}
                    {advanceState.status === 'saving'
                      ? 'Advancing…'
                      : 'Advance to pipeline'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 border-l-2 border-rule pl-4">
            <BriefcaseBusiness className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
            <div>
              <h4 className="text-sm font-semibold text-ink">
                Choose the parcel that earns next diligence.
              </h4>
              <p className="mt-1 text-xs leading-5 text-ink-3">
                Use “Advance” above to make the decision yourself. CityLens
                shows the evidence and records the handoff; it does not choose
                a winner or imply seller intent.
              </p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
