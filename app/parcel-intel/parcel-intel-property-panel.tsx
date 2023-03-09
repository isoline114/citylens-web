'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  FileSearch,
  LockKeyhole,
  MapPin,
  TriangleAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  listParcelWorkflow,
  removeParcelWorkflow,
  saveParcelWorkflow,
  type ParcelIntelRow,
  type ParcelWorkflowItem,
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

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
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

function workflowSnapshot(row: ParcelIntelRow): ParcelWorkflowItem['snapshot'] {
  return {
    property_facts_as_of: row.property_facts_as_of ?? null,
    zoning_district_1: row.zoning_district_1,
    land_use: row.land_use,
    year_built: row.year_built,
    allowed_far: row.allowed_far,
    unused_floor_area_sqft: row.unused_floor_area_sqft,
    owner_name: row.owner_name ?? null,
    last_sale_year: row.last_sale_year,
    latest_nb_filing_year: row.latest_nb_filing_year ?? null,
    latest_nb_status: row.latest_nb_status ?? null,
    redev_status: row.redev_status,
    observed_imagery_year: row.observed_imagery_year ?? null,
  };
}

export function ParcelIntelPropertyPanel({ row, onClose }: Props) {
  const auth = useAuth();
  const [tab, setTab] = useState<PanelTab>('overview');
  const [workflowItem, setWorkflowItem] = useState<ParcelWorkflowItem | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const reasons = useMemo(() => explainParcel(row), [row]);
  const links = useMemo(() => externalParcelLinks(row), [row]);

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

  const saveWorkflow = async (draft: WorkflowDraft) => {
    setWorkflowBusy(true);
    setWorkflowError(null);
    try {
      const saved = await saveParcelWorkflow(row.bbl, {
        borough: row.borough ?? 'unknown',
        ...draft,
        snapshot: workflowSnapshot(row),
      });
      setWorkflowItem(saved);
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
            <WorkflowEditor
              item={workflowItem}
              busy={workflowBusy}
              onSave={saveWorkflow}
              onRemove={removeWorkflow}
            />
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
