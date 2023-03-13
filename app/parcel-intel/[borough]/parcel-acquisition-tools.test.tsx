import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  ParcelDecisionAudit,
  ParcelIntelRow,
  ParcelWorkflowItem,
} from '@/lib/api';
import {
  buildLandBasisScenarios,
  EvidenceReviewChecklist,
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

describe('EvidenceReviewChecklist', () => {
  const audit: ParcelDecisionAudit = {
    schema_version: 'citylens/parcel-decision-audit@v1',
    evidence_generated_at: '2026-07-24T02:43:29Z',
    overall_status: 'screened',
    overall_label: 'Eligible lead after current gates',
    validation: {
      target: 'dob_nb_job_filing',
      evaluation_scope: 'Historical rolling-origin evaluation',
      precision_at_100: 0.34,
      precision_at_1000: 0.104,
      base_rate: 0.0012,
      prospective_validated: false,
      disclaimer: 'Historical screening order only.',
    },
    readiness: {
      status: 'initial_review_ready',
      label: 'Ready for an initial acquisition review',
      recommended_action: 'Verify the cited official records.',
      blockers: [],
      review_items: [],
      cleared_items: [],
      disclaimer: 'Not a purchase recommendation.',
    },
    checks: [
      {
        key: 'property_facts',
        layer: 'source_freshness',
        label: 'Current property facts',
        status: 'verified',
        summary: 'Current PLUTO tax-lot facts matched this BBL.',
        source: 'NYC PLUTO',
        as_of: '2026-07-24',
        affects_model_rank: false,
        affects_acquisition_eligibility: true,
      },
    ],
    limitations: [],
  };
  const baseItem = {
    bbl: '3020960069',
    evidence_reviews: {},
  } as ParcelWorkflowItem;

  it('records exact-version intent and never describes diligence as cleared', () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    const onClear = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceReviewChecklist
        audit={audit}
        item={baseItem}
        busyKey={null}
        onReview={onReview}
        onClear={onClear}
      />,
    );

    expect(
      screen.getByLabelText('0 of 1 evidence versions reviewed'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('evidence-review-toggle'));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mark Current property facts version reviewed',
      }),
    );
    expect(onReview).toHaveBeenCalledWith('property_facts', audit.checks[0]);
    expect(screen.getByText(/does not resolve risk/i)).toBeInTheDocument();
    expect(screen.queryByText(/diligence cleared/i)).not.toBeInTheDocument();
  });

  it('distinguishes current markers from stale source versions', () => {
    const currentItem = {
      ...baseItem,
      evidence_reviews: {
        property_facts: {
          check_key: 'property_facts',
          label: 'Current property facts',
          check_status: 'verified',
          source: 'NYC PLUTO',
          source_as_of: '2026-07-24',
          feed_generated_at: '2026-07-24T02:43:29Z',
          reviewed_at: '2026-07-25T10:00:00Z',
        },
      },
    } as ParcelWorkflowItem;
    const { rerender } = render(
      <EvidenceReviewChecklist
        audit={audit}
        item={currentItem}
        busyKey={null}
        onReview={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('evidence-review-toggle'));
    expect(screen.getByText(/Exact version reviewed/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText('1 of 1 evidence versions reviewed'),
    ).toBeInTheDocument();

    rerender(
      <EvidenceReviewChecklist
        audit={{
          ...audit,
          evidence_generated_at: '2026-07-26T02:43:29Z',
        }}
        item={currentItem}
        busyKey={null}
        onReview={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Source changed · review the current version again/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Mark Current property facts version reviewed',
      }),
    ).toHaveTextContent('Review current');
  });

  it('prevents evidence mutations on a terminal workflow record', () => {
    render(
      <EvidenceReviewChecklist
        audit={audit}
        item={{ ...baseItem, stage: 'pass' }}
        busyKey={null}
        onReview={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('evidence-review-toggle'));

    expect(
      screen.getByText(/Reopen this workflow record/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Mark Current property facts version reviewed',
      }),
    ).toBeDisabled();
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
