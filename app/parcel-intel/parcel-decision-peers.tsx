'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';

import { useState } from 'react';
import {
  ArrowRight,
  Columns3,
  LoaderCircle,
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
      className="mt-4 border-b border-rule bg-white"
      data-testid="parcel-decision-peers"
    >
      <h4 className="text-sm font-semibold text-ink">Decision peers</h4>
      <p className="mt-1 text-xs leading-4 text-ink-3">
        Similar qualified leads from the same governed inventory, not valuation or sale comps.
      </p>

      <div className="divide-y divide-rule">
        {peers.map(({ row, reasons }) => (
          <article
            key={row.bbl}
            className="py-2"
            data-testid={`parcel-decision-peer-${row.bbl}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-ink">
                  {formatAddress(row.address) || `BBL ${formatBbl(row.bbl)}`}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  {row.lot_area_sqft != null ? Math.round(row.lot_area_sqft).toLocaleString() : '—'}<small className="text-ink-3"> sf</small>
                </div>
              </div>
              <span className="shrink-0 py-1 text-xs tabular-nums text-ink-3">
                {row.citywide_rank ? `NYC #${row.citywide_rank}` : 'Ranked'}
              </span>
            </div>
            <details className="group mt-1 border-t border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-xs text-ink-3 after:content-['+'] group-open:after:content-['−'] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select">Peer matching evidence</summary>
              <ul className="space-y-1 pb-2 text-xs text-ink-3">
                {reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </details>
            {errorBbl === row.bbl && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-700">
                <TriangleAlert className="h-3 w-3" />
                Could not prepare this comparison. Retry.
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpen(row.bbl)}
                aria-label={`Open decision peer ${row.address ?? row.bbl}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-control bg-white px-2 text-xs font-semibold text-ink hover:border-rule hover:text-select"
              >
                Open peer
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={busyBbl !== null}
                onClick={() => void compare(row)}
                aria-label={`Compare 1:1 with ${row.address ?? row.bbl}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-sm bg-ink px-2 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
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

      <div className="border-t border-rule py-2 text-xs leading-4 text-ink-3">
        {fullInventory
          ? 'Matched across the complete 5,000-lead inventory.'
          : 'Preview peer set only; sign in to match across all 5,000 leads.'}{' '}
        Selection uses displayed zoning, opportunity, geography, lot, and
        build-out fields; it is not an appraisal or a parcel-specific
        probability.
      </div>
    </section>
  );
}
