'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Clock3,
  ExternalLink,
  FileSearch,
  LockKeyhole,
  MapPin,
  TriangleAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  listParcelWorkflow,
  listParcelWorkflowEvents,
  removeParcelWorkflow,
  saveParcelWorkflow,
  type ParcelIntelRow,
  type ParcelWorkflowItem,
  type ParcelWorkflowEvent,
  type TopFeature,
} from '@/lib/api';
import {
  LandBasisCalculator,
  ParcelBriefActions,
  WorkflowEditor,
  type WorkflowDraft,
} from './[borough]/parcel-acquisition-tools';
import { explainParcel } from './[borough]/parcel-intel-explain';
import {
  BOROUGH_LABELS,
  BOROUGH_SHORT_LABELS,
  opportunityLabel,
  priorityLabel,
} from './parcel-intel-explorer-support';

type PanelTab = 'overview' | 'underwrite' | 'workflow';

type Props = {
  row: ParcelIntelRow;
  onClose: () => void;
  onViewOwnerPortfolio?: (ownerPortfolioId: string) => void;
};

type ExternalParcelLink = { label: string; href: string };

const MODEL_FEATURE_LABELS: Record<string, string> = {
  allowed_far: 'Allowed development density',
  assessbldg_per_lot: 'Assessed building value',
  assessland_per_lot: 'Assessed land value',
  assesstot_per_lot: 'Total assessed value',
  bldg_class: 'Building class',
  block_prior_nb_activity_record_count: 'Nearby new-building activity records',
  block_prior_structural_activity_record_count: 'Nearby structural activity records',
  block_redev_share: 'Nearby redevelopment share',
  borough: 'Borough',
  floors_bucket: 'Existing floor count',
  land_use: 'Land-use class',
  lot_area: 'Lot size',
  prior_alt_activity_record_count: 'Historical alteration activity records',
  prior_nb_activity_record_count: 'Historical new-building activity records',
  prior_recent_nb_activity_record_count: 'Recent new-building activity records',
  prior_structural_activity_record_count: 'Structural activity records',
  units: 'Existing residential units',
  year_bucket: 'Year built',
  years_held: 'Years held',
  years_since_last_structural_activity: 'Years since latest structural activity',
  zoning_district: 'Zoning district',
  zoning_family: 'Zoning family',
};

function modelFeatureLabel(name: string): string {
  return MODEL_FEATURE_LABELS[name] ?? name.replaceAll('_', ' ');
}

function modelFeatureValue(feature: TopFeature): string {
  const { value } = feature;
  if (value === null) return 'Value unavailable';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (feature.name === 'lot_area') return `${formatNumber(value)} sqft`;
    if (feature.name === 'block_redev_share') return `${Math.round(value * 100)}%`;
    if (feature.name.startsWith('assess')) return formatCurrency(value);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function ownerEntityLabel(
  value: ParcelIntelRow['owner_entity_type'],
): string {
  return {
    llc: 'LLC',
    corp: 'corporation',
    partnership: 'partnership',
    trust: 'trust',
    hdfc: 'HDFC',
    nonprofit: 'nonprofit',
    religious: 'religious organization',
    government: 'government',
    estate: 'estate',
    individual: 'individual',
    unknown: 'legal entity',
  }[value ?? 'unknown'];
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

function formatIsoDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return value ?? null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))),
  );
}

function parseBbl(
  bbl: string,
): { borough: string; block: string; lot: string } | null {
  const match = /^([1-5])(\d{5})(\d{4})$/.exec(bbl.trim());
  if (!match) return null;
  return {
    borough: match[1],
    block: String(Number(match[2])),
    lot: String(Number(match[3])),
  };
}

export function externalParcelLinks(row: ParcelIntelRow): ExternalParcelLink[] {
  const links: ExternalParcelLink[] = [];
  const parts = parseBbl(row.bbl);
  if (parts) {
    const { borough, block, lot } = parts;
    links.push(
      {
        label: 'ACRIS',
        href: `https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${borough}&block=${block}&lot=${lot}`,
      },
      {
        label: 'ZoLa',
        href: `https://zola.planning.nyc.gov/l/lot/${borough}/${block}/${lot}`,
      },
      {
        label: 'DOB BIS',
        href: `https://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?allborough=${borough}&allblock=${block}&alllot=${lot}&go5=+GO+`,
      },
    );
  }
  if (typeof row.lat === 'number' && typeof row.lng === 'number') {
    links.push(
      {
        label: 'Google Maps',
        href: `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`,
      },
      {
        label: 'Street View',
        href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${row.lat},${row.lng}`,
      },
    );
  }
  return links;
}

export function ParcelIntelPropertyPanel({
  row,
  onClose,
  onViewOwnerPortfolio,
}: Props) {
  const auth = useAuth();
  const [tab, setTab] = useState<PanelTab>('overview');
  const [workflowItem, setWorkflowItem] = useState<ParcelWorkflowItem | null>(null);
  const [workflowEvents, setWorkflowEvents] = useState<ParcelWorkflowEvent[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const reasons = useMemo(() => explainParcel(row), [row]);
  const links = useMemo(() => externalParcelLinks(row), [row]);
  const hasViolationSnapshot =
    (row.dob_safety_active_count ?? 0) +
      (row.ecb_active_count ?? 0) +
      (row.hpd_open_count ?? 0) >
    0;
  const hasFloodplainScreen =
    typeof row.firm07_floodplain === 'boolean' &&
    typeof row.pfirm15_floodplain === 'boolean';
  const environmentalDesignationLabel =
    row.environmental_designation_kind === 'restrictive_declaration'
      ? 'restrictive declaration'
      : row.environmental_designation_kind === 'e_designation'
        ? 'E-designation'
        : 'environmental designation';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setTab('overview');
    setWorkflowItem(null);
    setWorkflowEvents([]);
    setWorkflowError(null);
    if (auth.status !== 'authenticated') return;
    let cancelled = false;
    void listParcelWorkflow()
      .then((items) => {
        if (!cancelled) {
          setWorkflowItem(items.find((item) => item.bbl === row.bbl) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setWorkflowError('Pipeline status could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status, row.bbl]);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !workflowItem) {
      setWorkflowEvents([]);
      return;
    }
    let cancelled = false;
    void listParcelWorkflowEvents(row.bbl)
      .then((events) => {
        if (!cancelled) setWorkflowEvents(events);
      })
      .catch(() => {
        if (!cancelled) setWorkflowEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status, row.bbl, workflowItem]);

  const saveWorkflow = async (draft: WorkflowDraft) => {
    setWorkflowBusy(true);
    setWorkflowError(null);
    try {
      const saved = await saveParcelWorkflow(row.bbl, {
        borough: row.borough ?? 'unknown',
        ...draft,
      });
      setWorkflowItem(saved);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch {
      setWorkflowError('Could not save this parcel. Please retry.');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const removeWorkflow = async () => {
    setWorkflowBusy(true);
    setWorkflowError(null);
    try {
      await removeParcelWorkflow(row.bbl);
      setWorkflowItem(null);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch {
      setWorkflowError('Could not remove this parcel. Please retry.');
    } finally {
      setWorkflowBusy(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-white"
      data-testid="parcel-property-panel"
    >
      <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close parcel panel and return to ranked parcels"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to ranked parcels
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-sky-700">
              {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} · BBL {row.bbl}
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {row.address ?? 'Address unavailable'}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200">
                {opportunityLabel(row.opportunity_category)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {priorityLabel(row.priority_tier)} priority
              </span>
              {row.acquisition_eligible && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  Acquisition screened
                </span>
              )}
              {row.recent_change && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  Recent physical change
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white">
            {row.citywide_rank
              ? `NYC #${row.citywide_rank}`
              : row.priority_rank
                ? `${BOROUGH_SHORT_LABELS[row.borough ?? ''] ?? 'BR'} #${row.priority_rank}`
              : 'Ranked'}
          </span>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 border-b border-slate-200 bg-slate-50 p-1.5">
        {(
          [
            ['overview', FileSearch, 'Overview'],
            ['underwrite', Building2, 'Underwrite'],
            ['workflow', BriefcaseBusiness, 'Workflow'],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === value
                ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {workflowError && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {workflowError}
          </div>
        )}

        {tab === 'overview' && (
          <div>
            {row.acquisition_status === 'active_project' && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-950">
                      Existing project activity detected
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      {row.latest_project_type === 'land_use_entitlement'
                        ? `NYC Planning records ${row.latest_project_status?.toLowerCase() || 'active'} land-use entitlement activity`
                        : `Recent DOB ${row.latest_project_type === 'alt_co_new_building'
                            ? 'ALT-CO new-building'
                            : row.latest_project_type === 'demolition'
                              ? 'demolition'
                              : 'New Building'} activity`}{' '}
                      suggests this site is already committed. Treat it as market context,
                      not an acquisition lead.
                      {row.latest_project_job_number
                        ? ` Project ${row.latest_project_job_number}.`
                        : ''}
                    </p>
                    {row.latest_project_url && (
                      <a
                        href={row.latest_project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2"
                      >
                        Open official project record
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {(row.acquisition_status === 'constrained' ||
              row.acquisition_status === 'incomplete_data') && (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                <div className="font-semibold text-slate-950">
                  Not included in the acquisition ranking
                </div>
                <div className="mt-1">
                  {(row.acquisition_exclusion_reasons ?? [])
                    .map((reason) => reason.replaceAll('_', ' '))
                    .join(' · ') || 'Additional diligence is required.'}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {row.owner_name?.trim() && (
                <FactCard
                  label={row.owner_name_source === 'pluto' ? 'Owner (PLUTO)' : 'Owner'}
                  value={row.owner_name}
                  wide
                />
              )}
              <FactCard label="Lot area" value={`${formatNumber(row.lot_area_sqft)} sf`} />
              <FactCard label="Allowed FAR" value={String(row.allowed_far ?? '—')} />
              <FactCard
                label="Unused floor area"
                value={`${formatNumber(row.unused_floor_area_sqft)} sf`}
              />
              <FactCard
                label="Built utilization"
                value={
                  typeof row.far_utilization_pct === 'number'
                    ? `${row.far_utilization_pct.toFixed(0)}%`
                    : '—'
                }
              />
              <FactCard
                label="Last sale"
                value={`${formatCurrency(row.last_sale_price)}${
                  row.last_sale_year ? ` · ${row.last_sale_year}` : ''
                }`}
              />
              <FactCard
                label="Held"
                value={
                  typeof row.years_held === 'number'
                    ? `${row.years_held} ${row.years_held === 1 ? 'year' : 'years'}`
                    : '—'
                }
              />
              <FactCard label="Zoning" value={row.zoning_district_1 ?? '—'} />
              <FactCard
                label="Existing building"
                value={row.year_built && row.year_built > 0 ? String(row.year_built) : 'None recorded'}
              />
            </dl>

            {row.owner_portfolio_id &&
              (row.owner_portfolio_lot_count ?? 0) >= 2 && (
                <section className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-950">
                        Current PLUTO owner portfolio
                      </h4>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-lg font-semibold text-indigo-950">
                            {formatNumber(row.owner_portfolio_lot_count)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700">
                            Tax lots
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-indigo-950">
                            {formatNumber(row.owner_portfolio_borough_count)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700">
                            Boroughs
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-indigo-950">
                            {formatNumber(row.owner_portfolio_candidate_count)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700">
                            Current leads
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-indigo-900">
                        {formatNumber(row.owner_portfolio_total_lot_area_sqft)} sf
                        across current tax lots ·{' '}
                        {ownerEntityLabel(row.owner_entity_type)}
                      </p>
                      <p className="mt-2 text-[11px] leading-4 text-indigo-800">
                        Exact normalized PLUTO legal name only. Related LLCs are
                        not inferred, and same-name entities still require
                        ownership verification.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {onViewOwnerPortfolio && (
                          <button
                            type="button"
                            onClick={() =>
                              onViewOwnerPortfolio(row.owner_portfolio_id as string)
                            }
                            className="inline-flex h-8 items-center rounded-lg bg-indigo-950 px-3 text-xs font-medium text-white hover:bg-indigo-800"
                          >
                            View current candidate holdings
                          </button>
                        )}
                        <a
                          href="https://data.cityofnewyork.us/d/64uk-42ks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 hover:text-indigo-950"
                        >
                          PLUTO source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="mt-2 text-[10px] text-indigo-700">
                        Data retrieved{' '}
                        {row.owner_portfolio_data_as_of ?? 'date unavailable'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

            {row.tax_lien_sale_year && (
              <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-950">
                      {row.tax_lien_sale_year} final tax-lien sale record
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      NYC DOF included this tax lot in its final{' '}
                      {formatIsoDate(row.tax_lien_sale_date) ??
                        `${row.tax_lien_sale_year}`}{' '}
                      lien-sale list
                      {row.tax_lien_water_debt_only
                        ? ' for a water-debt-only record'
                        : ''}
                      . This historical distress signal does not prove a balance remains
                      unpaid, that foreclosure occurred, or that the property is for
                      sale. Verify current payoff and status before outreach.
                    </p>
                    {row.tax_lien_data_as_of && (
                      <p className="mt-1 text-[11px] text-amber-800">
                        Official dataset retrieved {row.tax_lien_data_as_of}.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      <a
                        href="https://www.nyc.gov/site/finance/property/property-lien-sales.page"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2"
                      >
                        NYC DOF guidance
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://data.cityofnewyork.us/d/9rz4-mjek"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2"
                      >
                        Official source data
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {hasViolationSnapshot && (
              <section className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-950">
                      Open violation snapshot
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-rose-900">
                      Current official agency statuses joined by BBL. Counts are
                      diligence flags, not ranking inputs or evidence that this
                      property is available.
                    </p>
                  </div>
                  {(row.critical_violation_count ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white">
                      {formatNumber(row.critical_violation_count)} immediate-hazard{' '}
                      {(row.critical_violation_count ?? 0) === 1
                        ? 'record'
                        : 'records'}
                    </span>
                  )}
                </div>

                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-rose-100 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      DOB Safety active
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">
                      {formatNumber(row.dob_safety_active_count)}
                    </dd>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      Latest issue{' '}
                      {formatIsoDate(row.dob_safety_latest_issue_date) ?? 'unavailable'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-100 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      OATH / ECB active
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">
                      {formatNumber(row.ecb_active_count)}
                    </dd>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      {formatNumber(row.ecb_class_1_count)} Class 1
                      immediately hazardous · reported balance{' '}
                      {formatCurrency(row.ecb_balance_due)}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      Latest issue {formatIsoDate(row.ecb_latest_issue_date) ?? 'unavailable'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-100 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      HPD open
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">
                      {formatNumber(row.hpd_open_count)}
                    </dd>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      {formatNumber(row.hpd_class_c_count)} Class C immediately
                      hazardous
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      Latest inspection{' '}
                      {formatIsoDate(row.hpd_latest_inspection_date) ?? 'unavailable'}
                    </div>
                  </div>
                </dl>

                <p className="mt-3 text-[11px] leading-4 text-rose-900">
                  A building can have multiple records. Verify current status,
                  correction, hearing, and payment details in the agency systems
                  before underwriting or outreach
                  {row.violation_data_as_of
                    ? ` · data retrieved ${row.violation_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {[
                    ['DOB Safety source', 'https://data.cityofnewyork.us/d/855j-jady'],
                    ['OATH / ECB source', 'https://data.cityofnewyork.us/d/6bgk-3dad'],
                    ['HPD source', 'https://data.cityofnewyork.us/d/wvxf-dwi5'],
                  ].map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-950 underline decoration-rose-300 underline-offset-2"
                    >
                      {label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {hasFloodplainScreen && (
              <section
                className={`mt-3 rounded-xl border p-3 ${
                  row.floodplain_1pct
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        row.floodplain_1pct ? 'text-sky-950' : 'text-slate-800'
                      }`}
                    >
                      1% annual-chance floodplain screen
                    </h4>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        row.floodplain_1pct ? 'text-sky-900' : 'text-slate-600'
                      }`}
                    >
                      {row.floodplain_1pct
                        ? 'PLUTO flags some portion of this tax lot inside at least one mapped 1% annual-chance floodplain.'
                        : 'PLUTO does not flag this tax lot in either of the two parcel-level 1% annual-chance floodplain fields.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      row.floodplain_1pct
                        ? 'bg-sky-700 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300'
                    }`}
                  >
                    {row.floodplain_1pct ? 'Mapped overlap' : 'No PLUTO flag'}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/80 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      FEMA 2007 FIRM
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {row.firm07_floodplain ? 'Tax-lot overlap' : 'Not flagged'}
                    </dd>
                    <div className="mt-1 text-[11px] text-slate-600">
                      Adopted map
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/80 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      FEMA 2015 PFIRM
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {row.pfirm15_floodplain ? 'Tax-lot overlap' : 'Not flagged'}
                    </dd>
                    <div className="mt-1 text-[11px] text-slate-600">
                      Preliminary planning map
                    </div>
                  </div>
                </dl>

                <p
                  className={`mt-3 text-[11px] leading-4 ${
                    row.floodplain_1pct ? 'text-sky-900' : 'text-slate-600'
                  }`}
                >
                  A parcel overlap does not prove that an existing building lies
                  inside the mapped portion, establish a site elevation, or replace
                  survey, insurance, code, and resilience review
                  {row.floodplain_data_as_of
                    ? ` · PLUTO retrieved ${row.floodplain_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <a
                    href="https://data.cityofnewyork.us/d/64uk-42ks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 underline decoration-sky-300 underline-offset-2"
                  >
                    Official PLUTO source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://www.nyc.gov/site/floodmaps/maps/overview.page"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 underline decoration-sky-300 underline-offset-2"
                  >
                    NYC flood-map guidance
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </section>
            )}

            {typeof row.environmental_review_required === 'boolean' && (
              <section
                className={`mt-3 rounded-xl border p-3 ${
                  row.environmental_review_required
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        row.environmental_review_required
                          ? 'text-orange-950'
                          : 'text-slate-800'
                      }`}
                    >
                      Environmental designation
                    </h4>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        row.environmental_review_required
                          ? 'text-orange-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {row.environmental_review_required
                        ? `PLUTO lists ${environmentalDesignationLabel} ${
                            row.environmental_designation_number ??
                            'number unavailable'
                          } for this tax lot.`
                        : 'PLUTO does not list an E-designation or restrictive declaration for this tax lot.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      row.environmental_review_required
                        ? 'bg-orange-700 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300'
                    }`}
                  >
                    {row.environmental_review_required
                      ? row.environmental_designation_number ?? 'Review required'
                      : 'No PLUTO flag'}
                  </span>
                </div>
                <p
                  className={`mt-3 text-[11px] leading-4 ${
                    row.environmental_review_required
                      ? 'text-orange-900'
                      : 'text-slate-600'
                  }`}
                >
                  E-designations and restrictive declarations can concern
                  hazardous materials, air emissions, or noise. Neither is
                  proof of contamination or an automatic development
                  prohibition. Confirm the instrument, proposed-work trigger,
                  and required OER notices with an environmental professional
                  {row.environmental_designation_data_as_of
                    ? ` · PLUTO retrieved ${row.environmental_designation_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <a
                    href="https://www.nyc.gov/site/oer/remediation/e-designation.page"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-950 underline decoration-orange-300 underline-offset-2"
                  >
                    NYC OER guidance
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://data.cityofnewyork.us/d/64uk-42ks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-950 underline decoration-orange-300 underline-offset-2"
                  >
                    Official PLUTO source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </section>
            )}

            {(row.assemblage_lot_count ?? 0) >= 2 && (
              <section className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
                  Assemblage · {row.assemblage_lot_count} adjacent lots
                </h4>
                <p className="mt-1 text-xs text-violet-800">
                  {formatNumber(row.assemblage_combined_lot_area_sqft)} sf combined lot ·{' '}
                  {formatNumber(row.assemblage_combined_buildable_sqft)} sf potential envelope
                </p>
              </section>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="External parcel records">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-800"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>

            <ParcelBriefActions row={row} />

            <section className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Why it surfaced
              </h4>
              <div className="mt-2 space-y-2">
                {reasons.length > 0 ? (
                  reasons.map((reason) => (
                    <div
                      key={`${reason.label}-${reason.detail}`}
                      className={`rounded-xl border p-3 ${
                        reason.tone === 'caution'
                          ? 'border-amber-200 bg-amber-50'
                          : reason.tone === 'positive'
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        {reason.label}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {reason.detail}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    No single signal dominates this ranking. Review the underlying records
                    before advancing the parcel.
                  </p>
                )}
              </div>
            </section>

            {(row.top_features ?? []).length > 0 && (
              <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Model attribution
                </summary>
                <ul className="mt-3 space-y-2">
                  {row.top_features.map((feature) => (
                    <li key={feature.name} className="text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-800">
                          {modelFeatureLabel(feature.name)}
                        </span>
                        <span className="shrink-0">
                          {feature.contribution_logit >= 0 ? 'Raises' : 'Lowers'} ranking ·{' '}
                          {Math.round(feature.contribution_pct * 100)}%
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Observed value: {modelFeatureValue(feature)}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={
                            feature.contribution_logit >= 0
                              ? 'h-full bg-emerald-500'
                              : 'h-full bg-rose-500'
                          }
                          style={{
                            width: `${Math.min(
                              Math.abs(feature.contribution_pct) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-4 text-slate-500">
                  DOB activity records can include filings, trade permits, and renewals tied
                  to one job; they are not a count of completed buildings. Contributions
                  explain this model score, not seller intent.
                </p>
              </details>
            )}

            <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-xs font-semibold text-slate-800">Source freshness</h4>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>PLUTO {row.property_facts_as_of ?? 'date unavailable'}</span>
                <span>
                  {row.owner_name_source === 'pluto' ? 'PLUTO owner' : 'ACRIS ownership'}{' '}
                  {row.ownership_as_of ?? 'date unavailable'}
                </span>
                <span>DOB {row.project_activity_as_of ?? 'date unavailable'}</span>
                <span>ZAP {row.land_use_activity_as_of ?? 'date unavailable'}</span>
                {row.observed_imagery_year && (
                  <span>Imagery through {row.observed_imagery_year}</span>
                )}
              </div>
              {row.property_facts_current === false && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Current lot match unavailable. Verify capacity facts before use.
                </p>
              )}
            </section>
          </div>
        )}

        {tab === 'underwrite' && (
          <div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
              This is a fast residual-land-value screen, not an appraisal. Verify zoning,
              affordable-housing requirements, construction costs, and tenancy.
            </div>
            <LandBasisCalculator row={row} defaultOpen />
          </div>
        )}

        {tab === 'workflow' &&
          (auth.status === 'authenticated' ? (
            <>
              <WorkflowEditor
                item={workflowItem}
                busy={workflowBusy}
                onSave={saveWorkflow}
                onRemove={removeWorkflow}
              />
              {workflowEvents.length > 0 && (
                <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    <Clock3 className="h-3.5 w-3.5" />
                    Decision history
                  </h4>
                  <ol className="mt-2 space-y-2">
                    {workflowEvents.slice(0, 8).map((event) => (
                      <li
                        key={event.event_id}
                        className="border-l-2 border-slate-200 pl-3 text-xs"
                      >
                        <div className="font-medium capitalize text-slate-900">
                          {event.event_type}
                          {event.to_stage ? ` · ${event.to_stage}` : ''}
                          {event.to_outcome && event.to_outcome !== 'unknown'
                            ? ` · ${event.to_outcome.replaceAll('_', ' ')}`
                            : ''}
                        </div>
                        <div className="mt-0.5 text-slate-500">
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(event.occurred_at))}
                          {event.changed_fields.length > 0
                            ? ` · ${event.changed_fields.length} field${
                                event.changed_fields.length === 1 ? '' : 's'
                              } changed`
                            : ''}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                <LockKeyhole className="h-5 w-5 text-slate-500" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-slate-950">
                Sign in to manage this opportunity
              </h4>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">
                Save notes, assign an owner, watch record changes, and move the parcel
                through your acquisition pipeline.
              </p>
              <Link
                href={`/sign-in?next=${encodeURIComponent(
                  `/parcel-intel?bbl=${row.bbl}`,
                )}`}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-950 px-4 text-xs font-medium text-white hover:bg-slate-800"
              >
                Sign in
              </Link>
            </div>
          ))}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] leading-4 text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Screening intelligence only—verify official
          records and site conditions.
        </span>
      </div>
    </div>
  );
}

function FactCard({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 ${
        wide ? 'col-span-2' : ''
      }`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-950" title={value}>
        {value}
      </dd>
    </div>
  );
}
