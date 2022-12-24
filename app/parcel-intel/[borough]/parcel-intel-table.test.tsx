import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ParcelIntelTable } from './parcel-intel-table';
import type { ParcelIntelRow } from '@/lib/api';

function row(overrides: Partial<ParcelIntelRow>): ParcelIntelRow {
  return {
    bbl: '3000000001',
    address: 'TEST ST',
    borough: 'BK',
    score_calibrated: 0.5,
    score_calibrated_p10: null,
    score_calibrated_p90: null,
    lot_area_sqft: 5000,
    allowed_far: 4,
    max_floor_area_sqft: 20000,
    unused_floor_area_sqft: 15000,
    far_utilization_pct: 25,
    zoning_district_1: 'R7A',
    land_use: '11',
    year_built: 1900,
    num_floors: 0,
    last_sale_price: null,
    last_sale_year: null,
    years_held: null,
    has_recent_sale_5yr: false,
    is_landmark: false,
    is_historic_district: false,
    block_id: '300000',
    block_rank: 1,
    ...overrides,
  };
}

describe('ParcelIntelTable', () => {
  const rows: ParcelIntelRow[] = [
    row({ bbl: '3000000001', address: 'A', score_calibrated: 0.99, lot_area_sqft: 5000 }),
    row({ bbl: '3000000002', address: 'B', score_calibrated: 0.5, lot_area_sqft: 10000 }),
    row({ bbl: '3000000003', address: 'C', score_calibrated: 0.7, lot_area_sqft: 1000, is_landmark: true }),
  ];

  it('renders one row per parcel by default, sorted by score desc', () => {
    render(<ParcelIntelTable rows={rows} borough="brooklyn" />);
    const tbody = screen.getAllByRole('rowgroup')[1];
    const dataRows = within(tbody).getAllByRole('row');
    expect(dataRows).toHaveLength(3);
    // First row should be A (highest score) regardless of input order.
    expect(within(dataRows[0]).getByText('A')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('C')).toBeInTheDocument(); // 0.7
    expect(within(dataRows[2]).getByText('B')).toBeInTheDocument(); // 0.5
  });

  it('toggles sort direction when clicking the same column twice', () => {
    render(<ParcelIntelTable rows={rows} borough="brooklyn" />);
    const scoreHeader = screen.getByRole('button', { name: /Score/i });
    fireEvent.click(scoreHeader); // desc → asc
    const tbody = screen.getAllByRole('rowgroup')[1];
    let dataRows = within(tbody).getAllByRole('row');
    expect(within(dataRows[0]).getByText('B')).toBeInTheDocument(); // 0.5 first when asc
    fireEvent.click(scoreHeader); // asc → desc
    dataRows = within(tbody).getAllByRole('row');
    expect(within(dataRows[0]).getByText('A')).toBeInTheDocument(); // 0.99 first when desc
  });

  it('sorts by lot area when that column is clicked', () => {
    render(<ParcelIntelTable rows={rows} borough="brooklyn" />);
    fireEvent.click(screen.getByRole('button', { name: /Lot area/i }));
    const tbody = screen.getAllByRole('rowgroup')[1];
    const dataRows = within(tbody).getAllByRole('row');
    // Lot 10000 (B) > 5000 (A) > 1000 (C) when desc.
    expect(within(dataRows[0]).getByText('B')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('A')).toBeInTheDocument();
    expect(within(dataRows[2]).getByText('C')).toBeInTheDocument();
  });

  it('hides landmarked rows when checkbox toggled', () => {
    render(<ParcelIntelTable rows={rows} borough="brooklyn" />);
    const checkbox = screen.getByRole('checkbox', { name: /landmarked/i });
    fireEvent.click(checkbox);
    expect(screen.queryByText('C')).not.toBeInTheDocument(); // C had is_landmark
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders a download button labeled with current row count', () => {
    render(<ParcelIntelTable rows={rows} borough="brooklyn" />);
    expect(screen.getByRole('button', { name: /Download CSV \(3\)/ })).toBeInTheDocument();
  });
});
