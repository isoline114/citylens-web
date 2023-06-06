import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelIndex } from '@/lib/api';
import ParcelIntelIndexPage from './page';

const mocks = vi.hoisted(() => ({ index: vi.fn() }));
vi.mock('@/lib/api.server', () => ({ fetchParcelIntelIndexOnServer: mocks.index }));
// The freshness warning lives in the real source receipt, which the explorer
// renders in its toolbar; render that slot and nothing else of the explorer.
vi.mock('./parcel-intel-explorer', () => ({
  ParcelIntelExplorer: ({ sourceReceipt }: { sourceReceipt?: React.ReactNode }) => <>{sourceReceipt}</>,
}));
vi.mock('./parcel-model-lineage', () => ({ ParcelModelLineage: () => null }));
vi.mock('./parcel-prospective-validation', () => ({ ParcelProspectiveValidation: () => null }));

beforeEach(() => {
  mocks.index.mockResolvedValue({
    boroughs: [],
    generated_at: null,
    feed_generation: null,
    model_metadata: {},
    data_sources: {},
    quality_gate: {},
  } satisfies ParcelIntelIndex);
});

describe('parcel source freshness warning', () => {
  it('keeps overdue source dates in a collapsed disclosure in the toolbar', async () => {
    const sources = Array.from({ length: 11 }, (_, i) => ({
      source: `Official source ${i + 1}`,
      stale: true,
      age_days: 70,
      max_age_days: 7,
    }));
    mocks.index.mockResolvedValue({
      boroughs: [{ slug: 'brooklyn', display_name: 'Brooklyn', count: 1, top_score: 0.5 }],
      generated_at: null,
      data_sources: {
        ...Object.fromEntries(sources.map((source, i) => [String(i), source])),
        imagery: { source: 'Historical imagery', stale: true, baseline_year: 2017 },
      },
    });

    render(await ParcelIntelIndexPage({ searchParams: Promise.resolve({}) }));

    const receipt = screen.getByTestId('parcel-feed-receipt');
    const summary = receipt.querySelector('summary')!;
    expect(summary).toHaveTextContent('Sources · 11 past limit');
    expect(summary).toHaveAccessibleName(/Freshness warning: Official source 1 \(70 days old\)/);
    expect(receipt).not.toHaveAttribute('open');
    for (const { source } of sources) {
      expect(screen.getByText(source, { exact: true })).not.toBeVisible();
    }
    receipt.setAttribute('open', '');
    for (const { source } of sources) {
      expect(screen.getByText(source, { exact: true })).toBeVisible();
    }
    // Historical sources without a refresh limit never count as overdue.
    expect(summary).not.toHaveAccessibleName(/Historical imagery/);
  });

  it('does not show a freshness warning when no source is overdue', async () => {
    render(await ParcelIntelIndexPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(/Freshness warning/)).not.toBeInTheDocument();
    expect(screen.queryByText(/past limit/)).not.toBeInTheDocument();
  });
});
