import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParcelLeadReview } from '@/lib/api';
import { ParcelLeadReviewCard } from './parcel-lead-review';

const mocks = vi.hoisted(() => ({
  getParcelLeadReview: vi.fn(),
  saveParcelLeadReview: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelLeadReview: mocks.getParcelLeadReview,
    saveParcelLeadReview: mocks.saveParcelLeadReview,
  };
});

const GENERATION = '20260730T092749819158Z-daf06394d35b';
const BBL = '3058920038';

function review(
  overrides: Partial<ParcelLeadReview> = {},
): ParcelLeadReview {
  return {
    schema_version: 'citylens/parcel-lead-review@v1',
    review_id: 'plr_0123456789abcdef0123456789abcdef',
    bbl: BBL,
    feed_generation: GENERATION,
    verdict: 'pass',
    reason_codes: ['active_or_completed_project'],
    citywide_rank: 42,
    acquisition_rank: 39,
    priority_tier: 'highest',
    opportunity_category: 'ground_up_candidate',
    created_at: '2026-07-30T12:00:00Z',
    updated_at: '2026-07-30T12:00:00Z',
    revision: 1,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getParcelLeadReview.mockReset();
  mocks.saveParcelLeadReview.mockReset();
});

describe('ParcelLeadReviewCard', () => {
  it('records a controlled pass reason against the current feed', async () => {
    const user = userEvent.setup();
    const onOpenAudit = vi.fn();
    mocks.getParcelLeadReview.mockResolvedValue({
      schema_version: 'citylens/parcel-lead-review-state@v1',
      current_feed_generation: GENERATION,
      review: null,
    });
    mocks.saveParcelLeadReview.mockResolvedValue(review());

    render(
      <ParcelLeadReviewCard
        bbl={BBL}
        feedGeneration={GENERATION}
        onOpenAudit={onOpenAudit}
      />,
    );

    expect(
      await screen.findByText('Private · tied to this ranking · never changes rank'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Pass' }));
    await user.click(
      screen.getByRole('button', {
        name: 'Already active / completed',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Record' }));

    expect(mocks.saveParcelLeadReview).toHaveBeenCalledWith(BBL, {
      expected_feed_generation: GENERATION,
      verdict: 'pass',
      reason_codes: ['active_or_completed_project'],
    });
    expect(await screen.findByText('Review recorded')).toBeVisible();
    expect(screen.getByText('Recorded')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Open source audit' }),
    );
    expect(onOpenAudit).toHaveBeenCalledOnce();
  });

  it('loads a prior review and enables only a real change', async () => {
    const user = userEvent.setup();
    mocks.getParcelLeadReview.mockResolvedValue({
      schema_version: 'citylens/parcel-lead-review-state@v1',
      current_feed_generation: GENERATION,
      review: review(),
    });
    mocks.saveParcelLeadReview.mockResolvedValue(
      review({
        verdict: 'watch',
        reason_codes: ['needs_diligence'],
        revision: 2,
      }),
    );

    render(
      <ParcelLeadReviewCard
        bbl={BBL}
        feedGeneration={GENERATION}
      />,
    );

    expect(await screen.findByText('Recorded')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Watch' }));
    await user.click(
      screen.getByRole('button', { name: 'Needs diligence' }),
    );
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(mocks.saveParcelLeadReview).toHaveBeenCalledWith(BBL, {
      expected_feed_generation: GENERATION,
      verdict: 'watch',
      reason_codes: ['needs_diligence'],
    });
  });

  it('refuses to label a panel from a stale feed generation', async () => {
    mocks.getParcelLeadReview.mockResolvedValue({
      schema_version: 'citylens/parcel-lead-review-state@v1',
      current_feed_generation:
        '20260731T092749819158Z-daf06394d35b',
      review: null,
    });

    render(
      <ParcelLeadReviewCard
        bbl={BBL}
        feedGeneration={GENERATION}
      />,
    );

    expect(
      await screen.findByText(
        'The ranking changed. Reload before reviewing this lead.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Record' }),
    ).not.toBeInTheDocument();
  });
});
