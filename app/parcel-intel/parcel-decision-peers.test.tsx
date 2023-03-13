import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParcelIntelMapRow, ParcelIntelRow } from '@/lib/api';
import {
  findParcelDecisionPeers,
  ParcelDecisionPeers,
} from './parcel-decision-peers';

const subject: ParcelIntelRow = {
  bbl: '4027990131',
  address: '70-25 Queens Midtown Expressway',
  borough: 'queens',
  score_calibrated: 0.75,
  score_calibrated_p10: null,
  score_calibrated_p90: null,
  priority_rank: 1,
  priority_tier: 'highest',
  model_rank: 28,
  acquisition_eligible: true,
  acquisition_status: 'eligible',
  lot_area_sqft: 10_000,
  allowed_far: 2,
  max_floor_area_sqft: 20_000,
  unused_floor_area_sqft: 15_000,
  far_utilization_pct: 25,
  zoning_district_1: 'R4-1',
  land_use: '05',
  year_built: 1930,
  num_floors: 2,
  lat: 40.7,
  lng: -73.9,
  last_sale_price: null,
  last_sale_year: null,
  years_held: null,
  has_recent_sale_5yr: false,
  is_landmark: false,
  is_historic_district: false,
  block_id: '402799',
  block_rank: 1,
  top_features: [],
  redev_status: 'still_vacant',
  opportunity_category: 'vacant_site',
};

function peer(
  bbl: string,
  overrides: Partial<ParcelIntelMapRow> = {},
): ParcelIntelMapRow {
  return {
    bbl,
    address: `Peer ${bbl}`,
    borough: 'queens',
    score_calibrated: 0.5,
    priority_rank: 10,
    priority_tier: 'high',
    model_rank: 100,
    acquisition_rank: 10,
    citywide_rank: 10,
    acquisition_eligible: true,
    acquisition_status: 'eligible',
    lot_area_sqft: 10_500,
    unused_floor_area_sqft: 14_000,
    far_utilization_pct: 28,
    zoning_district_1: 'R4-1',
    lat: 40.71,
    lng: -73.91,
    last_sale_price: null,
    last_sale_year: null,
    years_held: null,
    tax_lien_sale_year: null,
    critical_violation_count: null,
    floodplain_1pct: null,
    environmental_review_required: null,
    mandatory_inclusionary_housing: null,
    nearest_transit_station_name: null,
    nearest_transit_station_distance_m: null,
    nearest_transit_routes: null,
    nearest_transit_ada_status: null,
    transit_station_count_800m: null,
    transit_access_tier: null,
    owner_name: null,
    owner_entity_type: null,
    owner_portfolio_id: null,
    owner_portfolio_lot_count: null,
    owner_portfolio_borough_count: null,
    owner_portfolio_candidate_count: null,
    recent_change: null,
    opportunity_category: 'vacant_site',
    assemblage_lot_count: null,
    ...overrides,
  };
}

describe('ParcelDecisionPeers', () => {
  it('selects qualified source-fact peers deterministically without exposing a confidence score', () => {
    const peers = findParcelDecisionPeers(subject, [
      peer(subject.bbl),
      peer('4000000002', {
        citywide_rank: 2,
        acquisition_eligible: false,
      }),
      peer('4000000003', {
        citywide_rank: 3,
        borough: 'brooklyn',
        zoning_district_1: 'M1-1',
        opportunity_category: 'conversion_or_overbuilt',
        lot_area_sqft: 50_000,
      }),
      peer('4000000004', { citywide_rank: 40 }),
      peer('4000000005', {
        citywide_rank: 20,
        lot_area_sqft: 9_900,
      }),
    ]);

    expect(peers.map(({ row }) => row.bbl)).toEqual([
      '4000000005',
      '4000000004',
      '4000000003',
    ]);
    expect(peers[0]?.reasons).toContain('Same R4-1 zoning district');
    expect(peers[0]?.reasons).toContain('Same vacant site screen');
    expect(JSON.stringify(peers)).not.toMatch(/confidence|probability/i);
  });

  it('opens a peer and starts a bounded pair comparison', async () => {
    const onOpen = vi.fn();
    const onCompare = vi.fn().mockResolvedValue(undefined);
    const peers = findParcelDecisionPeers(subject, [peer('4000000005')], 1);
    render(
      <ParcelDecisionPeers
        peers={peers}
        fullInventory={false}
        onOpen={onOpen}
        onCompare={onCompare}
      />,
    );

    expect(screen.getByText('Decision peers')).toBeInTheDocument();
    expect(screen.getByText(/not valuation or sale comps/i)).toBeInTheDocument();
    expect(screen.getByText(/Preview peer set only/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open decision peer Peer 4000000005',
      }),
    );
    expect(onOpen).toHaveBeenCalledWith('4000000005');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Compare 1:1 with Peer 4000000005',
      }),
    );
    await waitFor(() =>
      expect(onCompare).toHaveBeenCalledWith(peers[0]?.row),
    );
  });
});
