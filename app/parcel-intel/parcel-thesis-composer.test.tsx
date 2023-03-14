import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ParcelIntelMapRow } from '@/lib/api';

import type { ExplorerFilters } from './parcel-intel-explorer-support';
import { ParcelThesisComposer } from './parcel-thesis-composer';

const currentFilters: ExplorerFilters = {
  borough: 'all',
  priority: 'all',
  siteType: 'uncommitted',
  signals: [],
  minLotAreaSqft: null,
  minUnusedFloorAreaSqft: null,
  query: '',
  ownerPortfolioId: null,
};

function parcel(
  bbl: string,
  overrides: Partial<ParcelIntelMapRow>,
): ParcelIntelMapRow {
  return {
    bbl,
    address: `Site ${bbl}`,
    borough: 'brooklyn',
    priority_tier: 'high',
    acquisition_eligible: true,
    opportunity_category: 'vacant_site',
    lot_area_sqft: 12_000,
    unused_floor_area_sqft: 30_000,
    years_held: 15,
    nearest_transit_station_distance_m: 500,
    ...overrides,
  } as ParcelIntelMapRow;
}

const inventory = [
  parcel('3000000001', {}),
  parcel('3000000002', {
    priority_tier: 'watch',
    years_held: 4,
  }),
  parcel('4000000001', {
    borough: 'queens',
    opportunity_category: 'ground_up_candidate',
  }),
];

function openComposer() {
  fireEvent.click(
    screen.getByRole('button', {
      name: /Compose an acquisition thesis/i,
    }),
  );
}

describe('ParcelThesisComposer', () => {
  it('reviews exact visible filters and applies them only after confirmation', () => {
    const onApply = vi.fn();
    render(
      <ParcelThesisComposer
        currentFilters={currentFilters}
        inventoryRows={inventory}
        inventoryReady
        onApply={onApply}
      />,
    );

    openComposer();
    fireEvent.change(screen.getByLabelText('Acquisition thesis'), {
      target: {
        value:
          'High-priority long-held vacant sites in Brooklyn near transit with 10k+ sf lots',
      },
    });
    fireEvent.click(screen.getByTestId('thesis-review'));

    expect(screen.getByTestId('thesis-review-receipt')).toHaveTextContent(
      'Geography: Brooklyn',
    );
    expect(screen.getByTestId('thesis-review-receipt')).toHaveTextContent(
      'Required evidence: Held 10+ years',
    );
    expect(screen.getByTestId('thesis-review-receipt')).toHaveTextContent(
      'PLUTO lot area: ≥ 10,000 sf',
    );
    expect(screen.getByTestId('thesis-match-count')).toHaveTextContent('1');
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('thesis-apply'));

    expect(onApply).toHaveBeenCalledWith({
      borough: 'brooklyn',
      priority: 'high_or_better',
      siteType: 'vacant_site',
      signals: ['long_held', 'transit_800m'],
      minLotAreaSqft: 10_000,
      minUnusedFloorAreaSqft: null,
      query: '',
      ownerPortfolioId: null,
    });
    expect(screen.getByTestId('thesis-announcement')).toHaveTextContent(
      'Applied 6 reviewed criteria. 1 current leads match.',
    );
  });

  it('shows unsupported concepts as not applied without inventing filters', () => {
    render(
      <ParcelThesisComposer
        currentFilters={currentFilters}
        inventoryRows={inventory}
        inventoryReady
        onApply={vi.fn()}
      />,
    );

    openComposer();
    fireEvent.change(screen.getByLabelText('Acquisition thesis'), {
      target: {
        value:
          'Brooklyn sites below $5m with 100 units, R6 zoning, owner phone, and a motivated seller',
      },
    });
    fireEvent.click(screen.getByTestId('thesis-review'));

    const unsupported = screen.getByTestId('thesis-unsupported');
    expect(unsupported).toHaveTextContent('Not applied');
    expect(unsupported).toHaveTextContent('Financial or market assumptions');
    expect(unsupported).toHaveTextContent('Building program or feasibility');
    expect(unsupported).toHaveTextContent('Owner contact information');
    expect(unsupported).toHaveTextContent('Seller or transaction intent');
    expect(unsupported).toHaveTextContent(
      'Custom zoning or entitlement rule',
    );
  });

  it('fails closed on conflicts and invalidates a stale review when text changes', () => {
    render(
      <ParcelThesisComposer
        currentFilters={currentFilters}
        inventoryRows={inventory}
        inventoryReady
        onApply={vi.fn()}
      />,
    );

    openComposer();
    const input = screen.getByLabelText('Acquisition thesis');
    fireEvent.change(input, {
      target: {
        value: 'Vacant and ground-up sites in Brooklyn and Queens',
      },
    });
    fireEvent.click(screen.getByTestId('thesis-review'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Resolve before applying',
    );
    expect(screen.getByTestId('thesis-apply')).toBeDisabled();

    fireEvent.change(input, {
      target: { value: 'Vacant sites in Brooklyn' },
    });
    expect(screen.getByTestId('thesis-review-receipt')).toHaveTextContent(
      'Nothing is applied automatically',
    );
    expect(screen.getByTestId('thesis-apply')).toBeDisabled();
  });

  it('waits for the verified inventory and never performs a network request', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network access is forbidden'));
    const onApply = vi.fn();
    render(
      <ParcelThesisComposer
        currentFilters={currentFilters}
        inventoryRows={inventory.slice(0, 1)}
        inventoryReady={false}
        onApply={onApply}
      />,
    );

    openComposer();
    fireEvent.change(screen.getByLabelText('Acquisition thesis'), {
      target: { value: 'Vacant sites in Brooklyn' },
    });
    fireEvent.click(screen.getByTestId('thesis-review'));

    expect(screen.getByText(/Waiting for the verified full inventory/i)).toBeVisible();
    expect(screen.getByTestId('thesis-match-count')).toHaveTextContent('—');
    expect(screen.getByTestId('thesis-apply')).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
