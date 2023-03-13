'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Columns3,
  LoaderCircle,
  Network,
  TriangleAlert,
} from 'lucide-react';
import type { ParcelIntelMapRow, ParcelIntelRow } from '@/lib/api';
import {
  BOROUGH_LABELS,
  opportunityLabel,
} from './parcel-intel-explorer-support';

export type ParcelDecisionPeer = {
  row: ParcelIntelMapRow;
  reasons: string[];
};

function numeric(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function relativeGap(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  const a = numeric(left);
  const b = numeric(right);
  if (a === null || b === null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / Math.max(a, b);
}

function absoluteGap(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  const a = numeric(left);
  const b = numeric(right);
  return a === null || b === null ? null : Math.abs(a - b);
}

function peerAffinity(
  subject: ParcelIntelRow,
  candidate: ParcelIntelMapRow,
): number {
  let affinity = 0;
  if (
    subject.zoning_district_1 &&
    subject.zoning_district_1 === candidate.zoning_district_1
  ) {
    affinity += 8;
  }
  if (
    subject.opportunity_category &&
    subject.opportunity_category === candidate.opportunity_category
  ) {
    affinity += 6;
  }
  if (subject.borough && subject.borough === candidate.borough) affinity += 4;

  const lotGap = relativeGap(subject.lot_area_sqft, candidate.lot_area_sqft);
  if (lotGap !== null) affinity += Math.max(0, 4 * (1 - lotGap));

  const utilizationGap = absoluteGap(
    subject.far_utilization_pct,
    candidate.far_utilization_pct,
  );
  if (utilizationGap !== null) {
    affinity += Math.max(0, 2 * (1 - utilizationGap / 25));
  }

  const unusedGap = relativeGap(
    subject.unused_floor_area_sqft,
    candidate.unused_floor_area_sqft,
  );
  if (unusedGap !== null) affinity += Math.max(0, 2 * (1 - unusedGap));
  return affinity;
}

function peerReasons(
  subject: ParcelIntelRow,
  candidate: ParcelIntelMapRow,
): string[] {
  const reasons: string[] = [];
  if (
    subject.zoning_district_1 &&
    subject.zoning_district_1 === candidate.zoning_district_1
  ) {
    reasons.push(`Same ${subject.zoning_district_1} zoning district`);
  }
  if (
    subject.opportunity_category &&
    subject.opportunity_category === candidate.opportunity_category
  ) {
    reasons.push(`Same ${opportunityLabel(subject.opportunity_category).toLowerCase()} screen`);
  }
  if (subject.borough && subject.borough === candidate.borough) {
    reasons.push(`Same ${BOROUGH_LABELS[subject.borough] ?? subject.borough} market`);
  }

  const lotGap = relativeGap(subject.lot_area_sqft, candidate.lot_area_sqft);
  if (lotGap !== null && lotGap <= 0.3) {
    reasons.push(`Lot area within ${Math.round(lotGap * 100)}%`);
  }

  const utilizationGap = absoluteGap(
    subject.far_utilization_pct,
    candidate.far_utilization_pct,
  );
  if (utilizationGap !== null && utilizationGap <= 15) {
    reasons.push(`Built utilization within ${Math.round(utilizationGap)} pts`);
  }

  const unusedGap = relativeGap(
    subject.unused_floor_area_sqft,
    candidate.unused_floor_area_sqft,
  );
  if (unusedGap !== null && unusedGap <= 0.3) {
    reasons.push(`Unused-FAR proxy within ${Math.round(unusedGap * 100)}%`);
  }

  return reasons.slice(0, 3);
}

export function findParcelDecisionPeers(
  subject: ParcelIntelRow,
  candidates: ParcelIntelMapRow[],
  limit = 3,
): ParcelDecisionPeer[] {
  if (limit <= 0) return [];
  return candidates
    .filter(
      (candidate) =>
        candidate.bbl !== subject.bbl &&
        candidate.acquisition_eligible === true,
    )
    .map((candidate) => ({
      row: candidate,
      reasons: peerReasons(subject, candidate),
      affinity: peerAffinity(subject, candidate),
    }))
    .sort(
      (left, right) =>
        right.affinity - left.affinity ||
        (left.row.citywide_rank ?? Number.MAX_SAFE_INTEGER) -
          (right.row.citywide_rank ?? Number.MAX_SAFE_INTEGER) ||
        left.row.bbl.localeCompare(right.row.bbl),
    )
    .slice(0, limit)
    .map(({ row, reasons }) => ({
      row,
      reasons:
        reasons.length > 0
          ? reasons
          : ['Closest available source-fact profile in the ranked inventory'],
    }));
}

export function ParcelDecisionPeers({
  peers,
  fullInventory,
  onOpen,
  onCompare,
}: {
  peers: ParcelDecisionPeer[];
  fullInventory: boolean;
  onOpen: (bbl: string) => void;
  onCompare: (peer: ParcelIntelMapRow) => Promise<void>;
}) {
  const [busyBbl, setBusyBbl] = useState<string | null>(null);
  const [errorBbl, setErrorBbl] = useState<string | null>(null);
  if (peers.length === 0) return null;

  const compare = async (peer: ParcelIntelMapRow) => {
    setBusyBbl(peer.bbl);
    setErrorBbl(null);
    try {
      await onCompare(peer);
    } catch {
      setErrorBbl(peer.bbl);
    } finally {
      setBusyBbl(null);
    }
  };

  return (
    <section
      className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fafc)] shadow-sm"
      data-testid="parcel-decision-peers"
    >
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
            <Network className="h-3.5 w-3.5" />
          </span>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">
              Decision peers
            </h4>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-600">
              Similar qualified leads from the same governed inventory—not
              valuation or sale comps.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {peers.map(({ row, reasons }) => (
          <article
            key={row.bbl}
            className="px-3 py-3"
            data-testid={`parcel-decision-peer-${row.bbl}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-slate-950">
                  {row.address ?? `BBL ${row.bbl}`}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough}
                  {row.zoning_district_1 ? ` · ${row.zoning_district_1}` : ''}
                  {row.lot_area_sqft
                    ? ` · ${Math.round(row.lot_area_sqft).toLocaleString()} sf`
                    : ''}
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-slate-950 px-1.5 py-1 text-[9px] font-semibold text-white">
                {row.citywide_rank ? `NYC #${row.citywide_rank}` : 'Ranked'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 ring-1 ring-inset ring-sky-100"
                >
                  {reason}
                </span>
              ))}
            </div>
            {errorBbl === row.bbl && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-rose-700">
                <TriangleAlert className="h-3 w-3" />
                Could not prepare this comparison. Retry.
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpen(row.bbl)}
                aria-label={`Open decision peer ${row.address ?? row.bbl}`}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-900"
              >
                Open peer
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={busyBbl !== null}
                onClick={() => void compare(row)}
                aria-label={`Compare 1:1 with ${row.address ?? row.bbl}`}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-slate-950 px-2 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {busyBbl === row.bbl ? (
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                ) : (
                  <Columns3 className="h-3 w-3" />
                )}
                Compare 1:1
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[9px] leading-4 text-slate-500">
        {fullInventory
          ? 'Matched across the complete 5,000-lead inventory.'
          : 'Preview peer set only—sign in to match across all 5,000 leads.'}{' '}
        Selection uses displayed zoning, opportunity, geography, lot, and
        build-out fields; it is not an appraisal or a parcel-specific
        probability.
      </div>
    </section>
  );
}
