import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParcelIntelRow } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  downloadCsv: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('./[borough]/parcel-intel-csv', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('./[borough]/parcel-intel-csv')
    >();
  return { ...actual, downloadCsv: mocks.downloadCsv };
});

import { ParcelComparisonDesk } from './parcel-comparison-desk';

function row(bbl: string, address: string): ParcelIntelRow {
  return {
    bbl,
    address,
    borough: 'brooklyn',
    score_calibrated: 0.9,
    score_calibrated_p10: 0.8,
    score_calibrated_p90: 0.95,
    priority_rank: 1,
    priority_tier: 'highest',
    citywide_rank: 12,
    acquisition_status: 'eligible',
    lot_area_sqft: 5000,
    allowed_far: 2,
    max_floor_area_sqft: 10000,
    unused_floor_area_sqft: 5000,
    far_utilization_pct: 50,
    zoning_district_1: 'R6',
    land_use: '01',
    year_built: 1930,
    num_floors: 2,
    lat: 40.65,
    lng: -73.96,
    last_sale_price: 1_400_000,
    last_sale_year: 2025,
    years_held: 1,
    has_recent_sale_5yr: true,
    is_landmark: false,
    is_historic_district: false,
    block_id: bbl.slice(0, 6),
    block_rank: 1,
    owner_name: 'Example Owner LLC',
    top_features: [],
    redev_status: 'still_vacant',
    opportunity_category: 'ground_up_candidate',
    property_facts_as_of: '2026-07-24',
    ownership_as_of: '2026-07-15',
    project_activity_as_of: '2026-07-24',
  };
}

describe('ParcelComparisonDesk', () => {
  beforeEach(() => {
    mocks.downloadCsv.mockReset();
    mocks.writeText.mockReset();
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it('exports only the compared rows and copies the portable evidence brief', async () => {
    const rows = [
      row('3020960069', '100 E 21 STREET'),
      row('3050660023', '224 CLARKSON AVENUE'),
    ];
    render(
      <ParcelComparisonDesk
        rows={rows}
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Evidence CSV' }),
    );
    expect(mocks.downloadCsv).toHaveBeenCalledWith(rows, 'comparison');

    fireEvent.click(
      screen.getByRole('button', { name: 'Copy evidence brief' }),
    );
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledOnce());
    expect(mocks.writeText.mock.calls[0][0]).toContain(
      '# CityLens parcel evidence comparison',
    );
    expect(mocks.writeText.mock.calls[0][0]).toContain('100 E 21 STREET');
    expect(screen.getByRole('button', { name: 'Brief copied' })).toBeVisible();
  });

  it('keeps copy failure visible without breaking comparison', async () => {
    mocks.writeText.mockRejectedValueOnce(new Error('clipboard unavailable'));
    render(
      <ParcelComparisonDesk
        rows={[
          row('3020960069', '100 E 21 STREET'),
          row('3050660023', '224 CLARKSON AVENUE'),
        ]}
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Copy evidence brief' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Copy unavailable' }),
    ).toBeVisible();
    expect(screen.getByText('Development capacity')).toBeVisible();
  });
});
