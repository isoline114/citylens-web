import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ParcelFeedReceipt,
  parcelFeedReceipt,
} from './parcel-feed-receipt';

const qualityGate = {
  passed: true,
  citywide_acquisition_eligible_count: 5000,
  screening_ledger: {
    evaluated_candidate_count: 24524,
    published_candidate_count: 5000,
    screened_out_count: 12119,
    eligible_below_cutoff_count: 7405,
  },
  land_use_reconciliation: {
    blocking_project_count: 800,
    joined_blocking_project_count: 800,
    published_leakage_count: 0,
  },
  address_identity: {
    pad_enriched_count: 500,
    pluto_address_count: 4500,
  },
};

const dataSources = {
  property_facts: { source: 'NYC PLUTO', stale: false },
  land_use_activity: { source: 'NYC ZAP', stale: false },
  project_activity: { source: 'NYC DOB', stale: false },
};

describe('ParcelFeedReceipt', () => {
  it('summarizes the acquisition funnel and project reconciliation', () => {
    render(
      <ParcelFeedReceipt
        qualityGate={qualityGate}
        dataSources={dataSources}
        generatedLabel="Jul 26, 2026"
      />,
    );

    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '5,000 leads surfaced',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '24,524',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      '12,119',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'ZAP projects mapped 800 / 800',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'Address provenance 500 PAD / 4,500 PLUTO',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      /not model accuracy, seller intent, transaction probability/i,
    );
  });

  it('fails conservative when the quality receipt is absent', () => {
    render(
      <ParcelFeedReceipt
        qualityGate={{}}
        dataSources={{}}
        generatedLabel=""
      />,
    );

    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      'Qualification receipt unavailable',
    );
    expect(screen.getByTestId('parcel-feed-receipt')).toHaveTextContent(
      /treat this feed as unverified/i,
    );
  });

  it('counts current and stale source declarations without trusting labels', () => {
    expect(
      parcelFeedReceipt(qualityGate, {
        current: { source: 'Current', stale: false },
        stale: { source: 'Stale', stale: true },
        malformed: 'not metadata',
      }),
    ).toMatchObject({
      currentSources: 1,
      staleSources: 1,
      projectLeakage: 0,
    });
  });
});
