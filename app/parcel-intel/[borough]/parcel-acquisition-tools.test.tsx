import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ParcelIntelRow } from '@/lib/api';
import {
  buildLandBasisScenarios,
  LandBasisCalculator,
  WorkflowEditor,
} from './parcel-acquisition-tools';

describe('WorkflowEditor', () => {
  it('prefills a server-recommended diligence action without saving it automatically', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkflowEditor
        item={null}
        suggestedNextAction="Verify the official project record before outreach."
        busy={false}
        onSave={onSave}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Next action')).toHaveValue(
      'Verify the official project record before outreach.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires a concrete action before saving a due date', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkflowEditor
        item={null}
        busy={false}
        onSave={onSave}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Due date'), {
      target: { value: '2026-07-30' },
    });
    expect(
      screen.getByText('Add a concrete next action before setting its due date.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to pipeline' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Next action'), {
      target: { value: 'Call owner' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to pipeline' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          next_action: 'Call owner',
          next_action_due_date: '2026-07-30',
        }),
      ),
    );
  });
});

describe('LandBasisCalculator', () => {
  it('builds a deterministic, explicitly stressed land-basis range', () => {
    const scenarios = buildLandBasisScenarios({
      grossSqft: 10_000,
      lotSqft: 5_000,
      base: {
        valuePerSellableSqft: 1_000,
        hardCostPerGrossSqft: 400,
        efficiencyPct: 80,
        softCostPct: 20,
        profitMarginPct: 15,
      },
    });

    expect(scenarios.map((scenario) => scenario.key)).toEqual([
      'downside',
      'base',
      'upside',
    ]);
    expect(scenarios[0]?.landBasis).toBe(0);
    expect(scenarios[1]).toMatchObject({
      sellableSqft: 8_000,
      revenue: 8_000_000,
      hardCost: 4_000_000,
      softCost: 800_000,
      targetProfit: 1_200_000,
      landBasis: 2_000_000,
      landBasisPerLotSqft: 400,
      landBasisPerGrossSqft: 200,
    });
    expect(scenarios[2]?.landBasis).toBeCloseTo(3_276_500);
    expect(scenarios[2]?.assumptionSummary).toContain('Value +10%');
  });

  it('fails non-finite screening inputs to bounded zero values', () => {
    const scenarios = buildLandBasisScenarios({
      grossSqft: Number.NaN,
      lotSqft: Number.POSITIVE_INFINITY,
      base: {
        valuePerSellableSqft: Number.POSITIVE_INFINITY,
        hardCostPerGrossSqft: Number.NaN,
        efficiencyPct: Number.NaN,
        softCostPct: Number.POSITIVE_INFINITY,
        profitMarginPct: Number.NEGATIVE_INFINITY,
      },
    });

    for (const scenario of scenarios) {
      expect(scenario.grossSqft).toBe(0);
      expect(scenario.sellableSqft).toBe(0);
      expect(scenario.landBasis).toBe(0);
      expect(Number.isFinite(scenario.revenue)).toBe(true);
      expect(Number.isFinite(scenario.hardCost)).toBe(true);
    }
  });

  it('shows an editable, transparent scenario comparison', () => {
    const onAssumptionsChange = vi.fn();
    render(
      <LandBasisCalculator
        row={
          {
            lot_area_sqft: 5_000,
            max_floor_area_sqft: 10_000,
            mandatory_inclusionary_housing: false,
          } as ParcelIntelRow
        }
        defaultOpen
        onAssumptionsChange={onAssumptionsChange}
      />,
    );

    expect(screen.getByTestId('land-basis-range')).toHaveTextContent(
      'Illustrative acquisition range',
    );
    expect(screen.getByTestId('land-basis-scenario-downside')).toHaveTextContent(
      'Value −15%',
    );
    expect(screen.getByTestId('land-basis-scenario-base')).toHaveTextContent(
      'Uses the editable assumptions below',
    );
    expect(screen.getByTestId('land-basis-scenario-base')).toHaveTextContent(
      /Soft costs\s*20%/,
    );
    expect(screen.getByTestId('land-basis-scenario-base')).toHaveTextContent(
      /Target margin\s*15%/,
    );
    expect(screen.getByTestId('land-basis-scenario-upside')).toHaveTextContent(
      'Value +10%',
    );
    expect(screen.getByText('Formula, scope, and omissions')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Value / sellable SF'), {
      target: { value: '1000' },
    });
    expect(screen.getByTestId('land-basis-scenario-base')).toHaveTextContent(
      '$2,000,000',
    );
    expect(onAssumptionsChange).toHaveBeenCalledOnce();
  });

  it('warns that a mapped MIH parcel needs an affordability scenario', () => {
    render(
      <LandBasisCalculator
        row={
          {
            max_floor_area_sqft: 20_000,
            mandatory_inclusionary_housing: true,
          } as ParcelIntelRow
        }
        defaultOpen
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('MIH scenario required');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'does not model affordable-housing set-asides',
    );
  });
});
