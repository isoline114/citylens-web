import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ParcelModelLineage } from './parcel-model-lineage';

describe('ParcelModelLineage', () => {
  it('makes the historical-to-current inference contract explicit', () => {
    render(
      <ParcelModelLineage
        trainingOrigins={[2018, 2020, 2022]}
        calibrationOrigin={2024}
        benchmarkOutcomeWindow="2025-2025"
        inferenceSnapshot="current"
        selectionPolicySummary=" Current gates qualify the published list."
      />,
    );

    const receipt = screen.getByTestId('model-lineage-receipt');
    expect(receipt).toHaveAttribute('data-status', 'verified');
    expect(receipt).toHaveTextContent('2018 · 2020 · 2022');
    expect(receipt).toHaveTextContent('2024 → 2025');
    expect(receipt).toHaveTextContent('Current records');
    expect(receipt).toHaveTextContent(/no current outcome labels/i);
    expect(receipt).toHaveTextContent(/not this final refit's current hit rate/i);
  });

  it('fails visibly when lineage metadata is incomplete', () => {
    render(
      <ParcelModelLineage
        trainingOrigins={[]}
        calibrationOrigin={null}
        benchmarkOutcomeWindow={null}
        inferenceSnapshot={null}
        selectionPolicySummary=""
      />,
    );

    const receipt = screen.getByTestId('model-lineage-receipt');
    expect(receipt).toHaveAttribute('data-status', 'incomplete');
    expect(screen.getByText('Inspect')).toBeVisible();
  });
});
