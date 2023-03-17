import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getParcelLeadReviewIndex: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelLeadReviewIndex: mocks.getParcelLeadReviewIndex,
  };
});

import type {
  ParcelIntelMapRow,
  ParcelLeadReviewIndex,
} from '@/lib/api';
import { ParcelLeadReviewWorkspace } from './parcel-lead-review-workspace';

const generation = '20260727T030301358307Z-a32b245a82db';
const rows = [
  {
    bbl: '3000010001',
    address: '100 Brooklyn Avenue',
    citywide_rank: 1,
    acquisition_rank: 1,
  },
  {
    bbl: '4000010001',
    address: '200 Queens Avenue',
    citywide_rank: 2,
    acquisition_rank: 2,
  },
] as ParcelIntelMapRow[];

const index: ParcelLeadReviewIndex = {
  schema_version: 'citylens/parcel-lead-review-index@v1',
  current_feed_generation: generation,
  available_count: 2,
  reviewed_count: 1,
  unreviewed_count: 1,
  verdict_counts: {
    pursue: 1,
    watch: 0,
    pass: 0,
    unclear: 0,
  },
  items: [
    {
      schema_version: 'citylens/parcel-lead-review@v1',
      review_id: `${generation}:3000010001`,
      bbl: '3000010001',
      feed_generation: generation,
      verdict: 'pursue',
      reason_codes: ['strong_capacity'],
      citywide_rank: 1,
      acquisition_rank: 1,
      priority_tier: 'highest',
      opportunity_category: 'vacant_site',
      created_at: '2026-07-30T12:00:00Z',
      updated_at: '2026-07-30T12:00:00Z',
      revision: 1,
    },
  ],
};

describe('ParcelLeadReviewWorkspace', () => {
  beforeEach(() => {
    mocks.getParcelLeadReviewIndex.mockReset();
    mocks.getParcelLeadReviewIndex.mockResolvedValue(index);
  });

  it('shows current-generation coverage and advances to the highest-ranked unreviewed lead', async () => {
    const onSelectParcel = vi.fn();
    render(
      <ParcelLeadReviewWorkspace
        feedGeneration={generation}
        inventoryRows={rows}
        onClose={vi.fn()}
        onSelectParcel={onSelectParcel}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('lead-review-workspace')).toHaveAttribute(
        'data-state',
        'ready',
      ),
    );
    expect(
      screen.getByRole('progressbar', { name: 'Lead review coverage' }),
    ).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText(/Coverage—not accuracy/i)).toBeInTheDocument();
    expect(screen.getByText('100 Brooklyn Avenue')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('review-next-unreviewed'));
    expect(onSelectParcel).toHaveBeenCalledWith('4000010001');
  });

  it('filters reviewed calls without changing inventory coverage', async () => {
    render(
      <ParcelLeadReviewWorkspace
        feedGeneration={generation}
        inventoryRows={rows}
        onClose={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    await screen.findByText('100 Brooklyn Avenue');
    fireEvent.click(screen.getByRole('button', { name: /Pass/i }));
    expect(screen.getByText(/No pass calls/i)).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Lead review coverage' }),
    ).toHaveAttribute('aria-valuemax', '2');
  });

  it('fails closed when the review index does not match the loaded inventory', async () => {
    mocks.getParcelLeadReviewIndex.mockResolvedValue({
      ...index,
      available_count: 5_000,
      unreviewed_count: 4_999,
    });

    render(
      <ParcelLeadReviewWorkspace
        feedGeneration={generation}
        inventoryRows={rows}
        onClose={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(
        /Review coverage could not be reconciled to the current inventory/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('lead-review-workspace')).toHaveAttribute(
      'data-state',
      'error',
    );
  });
});
