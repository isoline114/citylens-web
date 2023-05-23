import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelIndex } from '@/lib/api';
import ParcelIntelIndexPage from './page';

const mocks = vi.hoisted(() => ({ index: vi.fn() }));
vi.mock('@/lib/api.server', () => ({ fetchParcelIntelIndexOnServer: mocks.index }));
vi.mock('./parcel-feed-receipt', () => ({ ParcelFeedReceipt: () => null }));
vi.mock('./parcel-intel-explorer', () => ({ ParcelIntelExplorer: () => null }));
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
  it('keeps overdue source dates in a collapsed disclosure above the map', async () => {
    const sources = Array.from({ length: 11 }, (_, i) => ({
      source: `Official source ${i + 1}`,
      stale: true,
      age_days: 70,
      max_age_days: 7,
    }));
    mocks.index.mockResolvedValue({
      boroughs: [],
      generated_at: null,
      data_sources: {
        ...Object.fromEntries(sources.map((source, i) => [String(i), source])),
        imagery: { source: 'Historical imagery', stale: true, baseline_year: 2017 },
      },
    });

    render(await ParcelIntelIndexPage({ searchParams: Promise.resolve({}) }));

    const summary = screen.getByText(/Freshness warning: 11 sources overdue/);
    const disclosure = summary.closest('details');
    expect(summary).toBeVisible();
    expect(disclosure).not.toHaveAttribute('open');
    for (const { source } of sources) {
      expect(screen.getByText(`${source} (70 days old)`)).not.toBeVisible();
    }
    disclosure?.setAttribute('open', '');
    for (const { source } of sources) {
      expect(screen.getByText(`${source} (70 days old)`)).toBeVisible();
    }
    expect(screen.queryByText(/Historical imagery/)).not.toBeInTheDocument();
  });

  it('does not show a freshness warning when no source is overdue', async () => {
    render(await ParcelIntelIndexPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(/Freshness warning/)).not.toBeInTheDocument();
  });
});
