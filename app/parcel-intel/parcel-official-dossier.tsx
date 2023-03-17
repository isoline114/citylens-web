'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ClipboardCheck,
  Database,
  FileSearch,
  Landmark,
  Layers3,
  LoaderCircle,
  MapPinned,
  Route,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  getParcelOfficialDossier,
  recordParcelProductEvent,
  type ParcelOfficialDossier,
} from '@/lib/api';
import { BOROUGH_LABELS } from './parcel-intel-explorer-support';
import {
  buildDossierEvidenceReadiness,
  type DossierEvidenceStatus,
} from './parcel-official-dossier-readiness';
import { ParcelSalesComparablesPanel } from './parcel-sales-comparables';

type State =
  | { status: 'loading' }
  | { status: 'ready'; dossier: ParcelOfficialDossier }
  | { status: 'error'; message: string };

type Props = {
  bbl: string;
  compact?: boolean;
};

const LAND_USE: Record<string, string> = {
  '1': 'One & two family',
  '01': 'One & two family',
  '2': 'Multi-family walk-up',
  '02': 'Multi-family walk-up',
  '3': 'Multi-family elevator',
  '03': 'Multi-family elevator',
  '4': 'Mixed residential & commercial',
  '04': 'Mixed residential & commercial',
  '5': 'Commercial & office',
  '05': 'Commercial & office',
  '6': 'Industrial & manufacturing',
  '06': 'Industrial & manufacturing',
  '7': 'Transportation & utility',
  '07': 'Transportation & utility',
  '8': 'Public facilities & institutions',
  '08': 'Public facilities & institutions',
  '9': 'Open space & recreation',
  '09': 'Open space & recreation',
  '10': 'Parking facilities',
  '11': 'Vacant land',
};

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function money(value: number | null): string {
  if (value === null) return 'Not reported';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number | null, suffix = ''): string {
  if (value === null) return 'Not reported';
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
      {detail && (
        <div className="mt-1 text-[11px] leading-4 text-slate-500">
          {detail}
        </div>
      )}
    </div>
  );
}

function ownerStatus(dossier: ParcelOfficialDossier) {
  switch (dossier.owner_source_status) {
    case 'match':
      return {
        label: 'Recorded-owner sources align',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      };
    case 'different':
      return {
        label: 'Owner sources differ — verify title',
        className: 'border-amber-200 bg-amber-50 text-amber-900',
      };
    case 'acris_only':
      return {
        label: 'ACRIS owner available',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      };
    case 'pluto_only':
      return {
        label: 'PLUTO owner available',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      };
    default:
      return {
        label: 'Recorded owner unavailable',
        className: 'border-slate-200 bg-slate-50 text-slate-700',
      };
  }
}

export function ParcelOfficialDossierPanel({ bbl, compact = false }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const trackedBblsRef = useRef(new Set<string>());

  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    void getParcelOfficialDossier(bbl)
      .then((dossier) => {
        if (!current) return;
        setState({ status: 'ready', dossier });
        if (!trackedBblsRef.current.has(bbl)) {
          trackedBblsRef.current.add(bbl);
          void recordParcelProductEvent(
            'official_dossier_opened',
            'official_dossier',
          ).catch(() => {
            // Adoption telemetry is best effort and must never block facts.
          });
        }
      })
      .catch((error) => {
        if (!current) return;
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Official parcel facts could not be loaded.',
        });
      });
    return () => {
      current = false;
    };
  }, [bbl]);

  if (state.status === 'loading') {
    return (
      <section
        data-testid="parcel-official-dossier-loading"
        className="border-b border-slate-200 bg-slate-50 px-5 py-5"
      >
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <LoaderCircle className="h-4 w-4 animate-spin text-sky-600" />
          Loading source-verified tax-lot facts…
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section
        data-testid="parcel-official-dossier-error"
        className="border-b border-amber-200 bg-amber-50 px-5 py-4"
      >
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Official parcel record unavailable</div>
            <div className="mt-1 text-xs leading-5">{state.message}</div>
          </div>
        </div>
      </section>
    );
  }

  const { dossier } = state;
  const ownership = ownerStatus(dossier);
  const mappedFar = [
    ['Built', dossier.built_far],
    ['Residential', dossier.residential_far],
    ['Commercial', dossier.commercial_far],
    ['Facility', dossier.facility_far],
  ].filter((entry): entry is [string, number] => entry[1] !== null);
  const hasFloodReference =
    dossier.firm_2007_floodplain || dossier.pfirm_2015_floodplain;
  const readiness = buildDossierEvidenceReadiness(dossier);
  const readinessTone =
    readiness.status === 'review_required'
      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
      : readiness.status === 'partial'
        ? 'border-sky-300/30 bg-sky-300/10 text-sky-100'
        : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100';

  const evidenceTone = (status: DossierEvidenceStatus) =>
    status === 'available'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status === 'review'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : status === 'partial'
          ? 'border-sky-200 bg-sky-50 text-sky-800'
          : 'border-slate-200 bg-slate-100 text-slate-600';

  return (
    <section
      data-testid="parcel-official-dossier"
      className="border-b border-slate-200 bg-[#f8fafc]"
    >
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_38%),linear-gradient(115deg,#07101f,#0f2740_58%,#0c4a6e)] px-5 py-5 text-white md:px-6">
        <div
          className={
            compact
              ? 'flex flex-col gap-4'
              : 'flex flex-col gap-4 md:flex-row md:items-start md:justify-between'
          }
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-sky-200 shadow-inner">
              <MapPinned className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                  Official parcel dossier
                </p>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  Any NYC tax lot · not a lead score
                </span>
              </div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                {dossier.address ?? 'Address not reported'}
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                {BOROUGH_LABELS[dossier.borough] ?? dossier.borough} · BBL{' '}
                <span className="font-mono text-white">{dossier.bbl}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {Object.entries(dossier.official_links).map(([key, href]) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 text-[10px] font-semibold text-white transition hover:bg-white/15"
              >
                {key === 'zola'
                  ? 'ZoLa'
                  : key === 'acris'
                    ? 'ACRIS'
                    : 'DOB BIS'}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 md:px-6">
        <div
          data-testid="parcel-dossier-readiness"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            className={
              compact
                ? 'grid gap-0'
                : 'grid gap-0 lg:grid-cols-[1.35fr_0.65fr]'
            }
          >
            <div className="p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-slate-950">
                    <ClipboardCheck className="h-4 w-4 text-emerald-700" />
                    <h4 className="text-sm font-semibold">
                      Evidence readiness
                    </h4>
                  </div>
                  <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
                    Source coverage and discrepancies—not correctness,
                    investment suitability, or predictive confidence.
                  </p>
                </div>
                <div
                  data-testid="parcel-dossier-readiness-status"
                  className={`rounded-xl border px-3 py-2 ${readinessTone}`}
                >
                  <div className="text-[9px] font-semibold uppercase tracking-[0.13em] opacity-75">
                    {readiness.presentCount} of {readiness.totalCount} groups
                    present
                  </div>
                  <div className="mt-0.5 text-xs font-semibold">
                    {readiness.label}
                  </div>
                </div>
              </div>
              <div
                className={
                  compact
                    ? 'mt-4 grid gap-2 sm:grid-cols-2'
                    : 'mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3'
                }
              >
                {readiness.groups.map((group) => (
                  <div
                    key={group.key}
                    data-testid={`parcel-dossier-evidence-${group.key}`}
                    className={`rounded-xl border p-3 ${evidenceTone(group.status)}`}
                  >
                    <div className="flex items-center gap-2">
                      {group.status === 'available' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : group.status === 'review' ? (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
                        {group.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-4 opacity-80">
                      {group.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside
              className={`border-t border-slate-200 bg-slate-950 p-4 text-white md:p-5 ${
                compact ? '' : 'lg:border-l lg:border-t-0'
              }`}
            >
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-sky-300" />
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Verify next
                </h4>
              </div>
              <div className="mt-3 space-y-2">
                {readiness.actions.map((action, index) => (
                  <a
                    key={action.key}
                    data-testid={`parcel-dossier-action-${action.key}`}
                    href={dossier.official_links[action.link]}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 transition hover:border-sky-300/30 hover:bg-white/[0.1]"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-300/15 text-[9px] font-bold text-sky-200">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-white">
                        {action.label}
                        <ArrowUpRight className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                      </span>
                      <span className="mt-1 block text-[10px] leading-4 text-slate-400">
                        {action.detail}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </div>

        <ParcelSalesComparablesPanel bbl={bbl} compact={compact} />

        <div
          className={
            compact
              ? 'grid gap-3 sm:grid-cols-2'
              : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
          }
        >
          <Metric
            label="Lot"
            value={number(dossier.lot_area_sqft, ' sqft')}
            detail="Current PLUTO tax-lot area"
          />
          <Metric
            label="Building"
            value={number(dossier.building_area_sqft, ' sqft')}
            detail={`${number(dossier.num_floors)} floors · ${number(dossier.units)} units`}
          />
          <Metric
            label="Zoning"
            value={
              [dossier.zoning_district_1, dossier.zoning_district_2]
                .filter(Boolean)
                .join(' / ') || 'Not reported'
            }
            detail="Mapped district reference"
          />
          <Metric
            label="Use / class"
            value={
              (dossier.land_use && LAND_USE[dossier.land_use]) ||
              'Not reported'
            }
            detail={
              dossier.building_class
                ? `PLUTO building class ${dossier.building_class}`
                : 'Building class unavailable'
            }
          />
        </div>

        <div
          className={
            compact
              ? 'grid gap-3'
              : 'grid gap-3 lg:grid-cols-[1.15fr_0.85fr]'
          }
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-sky-700" />
                <h4 className="text-sm font-semibold text-slate-950">
                  Recorded ownership & deed
                </h4>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${ownership.className}`}
              >
                {ownership.label}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Metric
                label="ACRIS recorded grantee"
                value={dossier.acris_owner_name ?? 'Not reported'}
                detail={`Features updated ${displayDate(dossier.ownership_features_updated_at)}`}
              />
              <Metric
                label="PLUTO owner field"
                value={dossier.pluto_owner_name ?? 'Not reported'}
                detail={`PLUTO retrieved ${displayDate(dossier.property_facts_retrieved_at)}`}
              />
              <Metric
                label="Last deed consideration"
                value={money(dossier.last_sale_price)}
                detail={
                  dossier.last_sale_date
                    ? displayDate(dossier.last_sale_date)
                    : 'Date not reported'
                }
              />
              <Metric
                label="Observed tenure"
                value={
                  dossier.years_held === null
                    ? 'Not reported'
                    : `${dossier.years_held} years`
                }
                detail="Derived from the latest available ACRIS deed"
              />
            </div>
            {dossier.owner_source_status === 'different' && (
              <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                PLUTO and ACRIS name different recorded parties. CityLens has
                preserved both rather than inferring which entity controls the
                parcel; verify the deed chain and title.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-violet-700" />
              <h4 className="text-sm font-semibold text-slate-950">
                Mapped FAR references
              </h4>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {mappedFar.length ? (
                mappedFar.map(([label, value]) => (
                  <Metric key={label} label={label} value={number(value)} />
                ))
              ) : (
                <p className="col-span-2 text-xs text-slate-500">
                  FAR references are not reported for this lot.
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">
              These are PLUTO mapped references, not a zoning calculation or
              buildable-area determination. Overlays, use, lot geometry,
              bonuses, deductions, and project-specific rules may control.
            </p>
          </div>
        </div>

        <div
          className={
            compact
              ? 'grid gap-3 sm:grid-cols-2'
              : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
          }
        >
          <Metric
            label="Year built"
            value={number(dossier.year_built)}
            detail="Zero or implausible source values remain unknown"
          />
          <Metric
            label="Assessed total"
            value={money(dossier.assessed_total)}
            detail={`Land ${money(dossier.assessed_land)} · building ${money(dossier.assessed_building)}`}
          />
          <Metric
            label="Flood references"
            value={hasFloodReference ? 'Mapped overlap' : 'No mapped overlap'}
            detail={`2007 FIRM ${dossier.firm_2007_floodplain ? 'yes' : 'no'} · 2015 PFIRM ${dossier.pfirm_2015_floodplain ? 'yes' : 'no'}`}
          />
          <Metric
            label="Environmental review"
            value={
              dossier.environmental_review_required
                ? 'Mapped requirement'
                : 'No mapped designation'
            }
            detail={
              dossier.environmental_designation_number ??
              dossier.environmental_designation_kind ??
              'Current PLUTO reference'
            }
          />
        </div>

        <div
          className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-slate-200 ${
            compact ? '' : 'md:flex-row md:items-center md:justify-between'
          }`}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="max-w-4xl text-[11px] leading-5">
              {dossier.interpretation}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Database className="h-3 w-3" />
              PLUTO {dossier.property_facts_dataset_id}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileSearch className="h-3 w-3" />
              Source-dated
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
