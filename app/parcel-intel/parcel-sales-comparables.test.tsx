import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParcelSalesComparables } from '@/lib/api';
import { ParcelSalesComparablesPanel } from './parcel-sales-comparables';

const mocks = vi.hoisted(() => ({
  getParcelSalesComparables: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelSalesComparables: mocks.getParcelSalesComparables,
  };
});

function result(
  overrides: Partial<ParcelSalesComparables> = {},
): ParcelSalesComparables {
  return {
    schema_version: 'citylens/parcel-sales-comparables@v1',
    status: 'available',
    subject_bbl: '3058920038',
    search_zip_code: '11209',
    query_window_start: '2023-01-01',
    source_candidate_count: 1391,
    eligible_candidate_count: 128,
    source_limit_reached: false,
    comparables: [
      {
        bbl: '3058750084',
        address: '609 OVINGTON AVENUE',
        sale_date: '2024-10-25',
        sale_price: 1_610_000,
        distance_miles: 0.21,
        lot_area_sqft: 7_500,
        gross_area_sqft: 3_100,
        residential_units: 2,
        commercial_units: 0,
        total_units: 2,
        year_built: 1910,
        building_class: 'B2',
        building_class_category: '01 ONE FAMILY DWELLINGS',
        price_per_land_sqft: 214.67,
        price_per_gross_sqft: 519.35,
        match_reasons: [
          'Same building-class family',
          'Lot area within 35%',
          'Within 0.2 miles',
        ],
      },
    ],
    summary: {
      comparable_count: 1,
      median_sale_price: 1_610_000,
      median_price_per_land_sqft: 214.67,
      median_price_per_gross_sqft: 519.35,
      minimum_sale_price: 1_610_000,
      maximum_sale_price: 1_610_000,
    },
    source_name: 'NYC Department of Finance annualized property sales',
    source_dataset_id: 'w2pb-icbu',
    source_url:
      'https://data.cityofnewyork.us/City-Government/NYC-Citywide-Annualized-Calendar-Sales-Update/w2pb-icbu',
    source_data_updated_at: '2026-06-09T18:31:52Z',
    source_retrieved_at: '2026-07-30T12:00:00Z',
    selection_method: 'Transparent bounded screen.',
    interpretation:
      'This is a comparable-transaction screen, not an appraisal.',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getParcelSalesComparables.mockReset();
});

describe('ParcelSalesComparablesPanel', () => {
  it('loads an explainable official comparison set only on demand', async () => {
    const user = userEvent.setup();
    mocks.getParcelSalesComparables.mockResolvedValue(result());

    render(<ParcelSalesComparablesPanel bbl="3058920038" />);

    expect(mocks.getParcelSalesComparables).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Load sale context' }),
    );

    expect(
      await screen.findByTestId('parcel-sales-comparables-ready'),
    ).toBeVisible();
    expect(screen.getByTestId('parcel-comparable-sale')).toHaveTextContent(
      '$1,610,000',
    );
    expect(screen.getByText('609 OVINGTON AVENUE')).toBeVisible();
    expect(screen.getByText('Same building-class family')).toBeVisible();
    expect(screen.getByText(/not an appraisal/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'DOF source' })).toHaveAttribute(
      'href',
      expect.stringContaining('w2pb-icbu'),
    );
    expect(mocks.getParcelSalesComparables).toHaveBeenCalledWith(
      '3058920038',
    );
  });

  it('leaves the panel empty when no defensible set exists', async () => {
    const user = userEvent.setup();
    mocks.getParcelSalesComparables.mockResolvedValue(
      result({
        status: 'insufficient_sales',
        comparables: [],
        summary: null,
      }),
    );

    render(<ParcelSalesComparablesPanel bbl="3058920038" />);
    await user.click(
      screen.getByRole('button', { name: 'Load sale context' }),
    );

    expect(
      await screen.findByTestId(
        'parcel-sales-comparables-insufficient',
      ),
    ).toHaveTextContent('No defensible comparison set');
    expect(screen.getByText(/rather than filling it/i)).toBeVisible();
  });

  it('shows a recoverable source error', async () => {
    const user = userEvent.setup();
    mocks.getParcelSalesComparables.mockRejectedValue(
      new Error('Official source is temporarily unavailable'),
    );

    render(<ParcelSalesComparablesPanel bbl="3058920038" />);
    await user.click(
      screen.getByRole('button', { name: 'Load sale context' }),
    );

    expect(
      await screen.findByTestId('parcel-sales-comparables-error'),
    ).toHaveTextContent('Official source is temporarily unavailable');
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeVisible();
  });
});
