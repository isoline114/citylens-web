/**
 * Rule-based "why this parcel scores high" explainer.
 *
 * The model is a calibrated GBT — there's no clean linear coefficient
 * to surface per row. Instead we derive defensible insights from the
 * features the model uses, in plain language a real-estate analyst can
 * verify against the underlying public data.
 *
 * Output shape: an array of `{ label, detail }` reasons sorted by
 * importance (most-load-bearing first). Empty when no signal stands out
 * (the UI then says "scored high on a combination of weak signals").
 */

import type { ParcelIntelRow } from '@/lib/api';

export type Reason = {
  label: string;
  detail: string;
  // Used by the UI to color-code the reason chip.
  tone: 'positive' | 'neutral' | 'caution';
};

const VACANT_LAND_USE = '11';

function moneyShort(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function explainParcel(row: ParcelIntelRow): Reason[] {
  const reasons: Reason[] = [];
  const score =
    typeof row.score_calibrated === 'number' ? row.score_calibrated : null;

  // 1) Vacant land in an R-zone is the cleanest signal — vacant lots
  //    where someone bothered to maintain ownership through a recent
  //    sale are textbook redev candidates.
  if (row.land_use === VACANT_LAND_USE && (row.zoning_district_1 ?? '').startsWith('R')) {
    reasons.push({
      label: 'Vacant land in residential zone',
      detail:
        `This parcel is currently vacant and zoned ${row.zoning_district_1 ?? '—'}. ` +
        'Vacant residential lots are the highest-velocity redev category in NYC ' +
        'because they require no demolition and no tenant relocation.',
      tone: 'positive',
    });
  } else if (row.land_use === VACANT_LAND_USE) {
    reasons.push({
      label: 'Vacant land',
      detail:
        `Currently vacant (${row.zoning_district_1 ?? '—'} zone). ` +
        'Avoiding demolition and tenant displacement makes vacant lots low-friction development sites.',
      tone: 'positive',
    });
  }

  // 2) FAR utilization — heavy underbuild signals room for redevelopment.
  if (
    typeof row.far_utilization_pct === 'number' &&
    row.far_utilization_pct < 30 &&
    typeof row.unused_floor_area_sqft === 'number' &&
    row.unused_floor_area_sqft > 5_000
  ) {
    reasons.push({
      label: `Only ${row.far_utilization_pct.toFixed(0)}% of allowed FAR built`,
      detail:
        `Zoning permits up to ${(row.max_floor_area_sqft ?? 0).toLocaleString()} sqft, ` +
        `but only ${((row.max_floor_area_sqft ?? 0) - (row.unused_floor_area_sqft ?? 0)).toLocaleString()} sqft is built — ` +
        `${row.unused_floor_area_sqft.toLocaleString()} sqft of unused capacity.`,
      tone: 'positive',
    });
  }

  // 3) Recent expensive sale — capital is in motion.
  if (
    row.has_recent_sale_5yr &&
    typeof row.last_sale_price === 'number' &&
    row.last_sale_price >= 1_000_000
  ) {
    const priceLabel = moneyShort(row.last_sale_price);
    const yearLabel = row.last_sale_year ? `${row.last_sale_year}` : 'recently';
    const heldLabel =
      typeof row.years_held === 'number'
        ? `${row.years_held} year${row.years_held === 1 ? '' : 's'} ago`
        : 'recently';
    reasons.push({
      label: `Sold for ${priceLabel} ${yearLabel}`,
      detail:
        `Last arms-length deed transfer was ${priceLabel} (${heldLabel}). ` +
        'A fresh, priced acquisition is one of the strongest signals that a ' +
        'developer is preparing to file a New Building permit.',
      tone: 'positive',
    });
  }

  // 4) Old building on a small lot in a dense residential zone — classic
  //    knock-down-and-replace candidate.
  if (
    row.year_built &&
    row.year_built > 0 &&
    row.year_built < 1950 &&
    typeof row.lot_area_sqft === 'number' &&
    row.lot_area_sqft <= 5_000 &&
    (row.zoning_district_1 ?? '').startsWith('R')
  ) {
    reasons.push({
      label: `${row.year_built} low-rise on small lot`,
      detail:
        `Pre-1950 building on a ${Math.round(row.lot_area_sqft).toLocaleString()}-sqft lot in ${row.zoning_district_1}. ` +
        'Small old residential lots in dense R-zones are commonly assembled ' +
        'with neighbors or replaced with multifamily new construction.',
      tone: 'neutral',
    });
  }

  // 5) Block-level activity — neighbors are getting redeveloped.
  if (typeof row.block_rank === 'number' && row.block_rank > 1) {
    reasons.push({
      label: `${row.block_rank} of N picks on this block`,
      detail:
        `The model has surfaced multiple parcels on tax block ${row.block_id ?? row.bbl.slice(0, 6)}. ` +
        'When several adjacent lots score highly together, it usually means a ' +
        'developer is assembling — or that the block is on a known pipeline.',
      tone: 'neutral',
    });
  }

  // 6) Caution flags — soft model signal, but a real product user wants
  //    to see these prominently.
  if (row.is_landmark) {
    reasons.push({
      label: 'LPC individual landmark',
      detail:
        'Redeveloping the building envelope requires a Certificate of ' +
        'Appropriateness from the Landmarks Preservation Commission. COAs ' +
        'are almost never granted for full-envelope new construction.',
      tone: 'caution',
    });
  } else if (row.is_historic_district) {
    reasons.push({
      label: 'Inside a historic district',
      detail:
        'The parcel is inside an LPC-designated historic district. Any ' +
        'visible exterior change requires LPC review and approval.',
      tone: 'caution',
    });
  }

  // 7) "Score is high" fallback for parcels that don't trigger any of
  //    the above rules but still made the top-N.
  if (reasons.length === 0 && score !== null && score >= 0.8) {
    reasons.push({
      label: 'Strong combined signal',
      detail:
        'The model ranks this parcel highly based on the aggregate of ' +
        'PLUTO, DOB, ACRIS, and LPC features. None of the individual signals ' +
        'are dominant, but together they place this parcel in the top-N.',
      tone: 'neutral',
    });
  }

  return reasons;
}
