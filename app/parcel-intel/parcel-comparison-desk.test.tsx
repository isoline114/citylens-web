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
        signedIn={false}
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onSelectParcel={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('region', {
        name: 'Scrollable parcel evidence comparison table',
      }),
    ).toHaveAttribute('tabindex', '0');
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
        signedIn={false}
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onSelectParcel={vi.fn()}
        onAdvance={vi.fn()}
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

  it('turns a deliberate comparison choice into a bounded workflow handoff', async () => {
    const first = row('3020960069', '100 E 21 STREET');
    const onAdvance = vi.fn().mockResolvedValue('created');
    const onSelectParcel = vi.fn();
    render(
      <ParcelComparisonDesk
        rows={[first, row('3050660023', '224 CLARKSON AVENUE')]}
        signedIn
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onSelectParcel={onSelectParcel}
        onAdvance={onAdvance}
      />,
    );

    expect(
      screen.getByText('Choose the parcel that earns next diligence.'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Advance 100 E 21 STREET from comparison',
      }),
    );
    const action = screen.getByLabelText('Next diligence action');
    expect(action).toHaveValue(
      'Open the parcel evidence and verify current records before pursuit.',
    );
    fireEvent.change(action, {
      target: { value: 'Verify title and current owner before outreach.' },
    });
    fireEvent.change(screen.getByLabelText(/Due date/), {
      target: { value: '2026-08-01' },
    });
    fireEvent.click(screen.getByTestId('advance-comparison-parcel'));

    await waitFor(() =>
      expect(onAdvance).toHaveBeenCalledWith(first, {
        nextAction: 'Verify title and current owner before outreach.',
        dueDate: '2026-08-01',
      }),
    );
    expect(await screen.findByText('Lead advanced to reviewing')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open parcel workspace' }),
    );
    expect(onSelectParcel).toHaveBeenCalledWith('3020960069');
  });

  it('explains when an active workflow was preserved', async () => {
    render(
      <ParcelComparisonDesk
        rows={[
          row('3020960069', '100 E 21 STREET'),
          row('3050660023', '224 CLARKSON AVENUE'),
        ]}
        signedIn
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onSelectParcel={vi.fn()}
        onAdvance={vi.fn().mockResolvedValue('existing')}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Advance 100 E 21 STREET from comparison',
      }),
    );
    fireEvent.click(screen.getByTestId('advance-comparison-parcel'));

    expect(await screen.findByText('Active workflow preserved')).toBeVisible();
    expect(
      screen.getByText(
        'No existing stage, action, assignee, or note was changed.',
      ),
    ).toBeVisible();
  });
});
