'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';
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
  const unitValue = /^(.*?)( (?:sqft|years))$/.exec(value);
  return (
    <div className="min-w-0 border-b border-rule py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-baseline gap-3">
        <div className="font-cond text-[13px] text-ink-3">{label}</div>
        <div className="break-words text-right text-sm font-medium tabular-nums text-ink">{unitValue ? <>{unitValue[1]}<small className="text-xs font-normal text-ink-3">{unitValue[2]}</small></> : value}</div>
      </div>
      {detail && (
        <div className="mt-1 text-right text-xs leading-4 text-ink-3">
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
        className: 'text-ink',
      };
    case 'different':
      return {
        label: 'Owner sources differ; verify title',
        className: 'text-stale',
      };
    case 'acris_only':
      return {
        label: 'ACRIS owner available',
        className: 'text-ink',
      };
    case 'pluto_only':
      return {
        label: 'PLUTO owner available',
        className: 'text-ink',
      };
    default:
      return {
        label: 'Recorded owner unavailable',
        className: 'text-ink',
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
        className="border-b border-rule bg-white px-5 py-5"
      >
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <LoaderCircle className="h-4 w-4 animate-spin text-ink" />
          Loading source-verified tax-lot facts…
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section
        data-testid="parcel-official-dossier-error"
        className="border-b border-rule bg-white px-5 py-4"
      >
        <div className="flex items-start gap-2 text-sm text-red-700">
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
      ? 'text-stale'
      : readiness.status === 'partial'
        ? 'text-ink-3'
        : 'text-ink';

  const evidenceTone = (status: DossierEvidenceStatus) =>
    status === 'available'
      ? 'text-ink'
      : status === 'review'
        ? 'text-stale'
        : status === 'partial'
          ? 'text-ink-3'
          : 'text-ink-3';

  return (
    <section
      data-testid="parcel-official-dossier"
      className="min-w-0 border-b border-rule bg-white [overflow-wrap:anywhere]"
    >
      <div className="border-b border-rule bg-white px-4 py-4 text-ink md:px-6">
        <div
          className={
            compact
              ? 'flex flex-col gap-4'
              : 'flex flex-col gap-4 md:flex-row md:items-start md:justify-between'
          }
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-ink-3">
              <MapPinned className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                {formatAddress(dossier.address) || 'Address not reported'}
              </h3>
              <p className="mt-1 text-xs text-ink-3">Official parcel dossier · Any NYC tax lot · not a lead score</p>
              <p className="mt-1 text-xs text-ink-3">
                {BOROUGH_LABELS[dossier.borough] ?? dossier.borough} · BBL{' '}
                <span className="font-mono text-ink">{formatBbl(dossier.bbl)}</span>
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
                className="inline-flex h-8 items-center gap-1 rounded-sm border border-control bg-white px-2.5 text-xs font-semibold text-ink transition hover:bg-paper-2"
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
          className="border-t border-rule"
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
                  <div className="flex items-center gap-2 text-ink">
                    <ClipboardCheck className="h-4 w-4 text-ink" />
                    <h4 className="text-sm font-semibold">
                      Evidence readiness
                    </h4>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-3">
                    Source coverage and discrepancies; not correctness,
                    investment suitability, or predictive confidence.
                  </p>
                </div>
                <div
                  data-testid="parcel-dossier-readiness-status"
                  className={`text-right ${readinessTone}`}
                >
                  <div className="font-cond text-[13px] font-semibold">
                    {readiness.presentCount} of {readiness.totalCount} groups
                    present
                  </div>
                  <div className="mt-0.5 text-xs font-semibold">
                    {readiness.label}
                  </div>
                </div>
              </div>
              <div className="mt-4 divide-y divide-rule">
                {readiness.groups.map((group) => (
                  <div
                    key={group.key}
                    data-testid={`parcel-dossier-evidence-${group.key}`}
                    className={`py-3 ${evidenceTone(group.status)}`}
                  >
                    <div className="flex items-center gap-2">
                      {group.status === 'available' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : group.status === 'review' ? (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="font-cond text-[13px] font-semibold ">
                        {group.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-4">
                      {group.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside
              className={`border-t border-rule bg-white p-4 text-ink md:p-5 ${
                compact ? '' : 'lg:border-l lg:border-t-0'
              }`}
            >
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-ink" />
                <h4 className="text-[13px] font-semibold ">
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
                    className="group flex items-start gap-3 rounded-sm border border-control bg-white p-3 transition hover:border-control hover:bg-paper-2"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold text-ink">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-xs font-semibold text-ink">
                        {action.label}
                        <ArrowUpRight className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                      </span>
                      <span className="mt-1 block text-xs leading-4 text-ink-3">
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
        <p className="font-mono text-xs text-ink-3">PLUTO as of {dossier.property_facts_retrieved_at.slice(0, 10)} · Dataset {dossier.property_facts_dataset_id}</p>

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
          <div className="border-t border-rule py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-ink" />
                <h4 className="text-sm font-semibold text-ink">
                  Recorded ownership & deed
                </h4>
              </div>
              <span
                className={`border px-2.5 py-1 text-xs font-semibold ${ownership.className}`}
              >
                {ownership.label}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-ink-3">ACRIS features as of {dossier.ownership_features_updated_at.slice(0, 10)} · PLUTO as of {dossier.property_facts_retrieved_at.slice(0, 10)}</p>
            <div className="mt-3 divide-y divide-rule">
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
              <div className="mt-3 flex gap-2 border-b border-rule bg-white p-3 text-xs leading-5 text-ink">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                PLUTO and ACRIS name different recorded parties. CityLens has
                preserved both rather than inferring which entity controls the
                parcel; verify the deed chain and title.
              </div>
            )}
          </div>

          <div className="border-t border-rule py-4">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-ink" />
              <h4 className="text-sm font-semibold text-ink">
                Mapped FAR references
              </h4>
            </div>
            <p className="mt-2 font-mono text-xs text-ink-3">PLUTO as of {dossier.property_facts_retrieved_at.slice(0, 10)}</p>
            <div className="mt-3 divide-y divide-rule">
              {mappedFar.length ? (
                mappedFar.map(([label, value]) => (
                  <Metric key={label} label={label} value={number(value)} />
                ))
              ) : (
                <p className="col-span-2 text-xs text-ink-3">
                  FAR references are not reported for this lot.
                </p>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-3">
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
          className={`flex flex-col gap-3 border-b border-rule bg-white px-4 py-3 text-ink ${
            compact ? '' : 'md:flex-row md:items-center md:justify-between'
          }`}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <p className="max-w-4xl text-xs leading-5">
              {dossier.interpretation}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
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
