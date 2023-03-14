import { describe, expect, it } from 'vitest';
import {
  composeParcelThesis,
  filtersFromThesisComposition,
} from './parcel-thesis-composer-support';
import type { ExplorerFilters } from './parcel-intel-explorer-support';

const current: ExplorerFilters = {
  borough: 'manhattan',
  priority: 'highest',
  siteType: 'active_project',
  signals: ['tax_lien'],
  minLotAreaSqft: 2_500,
  minUnusedFloorAreaSqft: 5_000,
  query: 'private owner search',
  ownerPortfolioId: 'private-owner-id',
};

describe('composeParcelThesis', () => {
  it('maps a supported thesis to exact visible source-backed criteria', () => {
    const result = composeParcelThesis(
      'High-priority long-held vacant sites in Brooklyn near transit with 10k+ sf lots and at least 25,000 sf unused FAR',
    );

    expect(result).toMatchObject({
      borough: 'brooklyn',
      priority: 'high_or_better',
      siteType: 'vacant_site',
      signals: ['long_held', 'transit_800m'],
      minLotAreaSqft: 10_000,
      minUnusedFloorAreaSqft: 25_000,
      explicitCriterionCount: 7,
      unsupported: [],
      conflicts: [],
      canApply: true,
    });
    expect(result.criteria.map((criterion) => criterion.valueLabel)).toEqual([
      'Brooklyn',
      'High or highest tier',
      'Vacant sites',
      'Held 10+ years',
      'Transit within 800 m',
      '≥ 10,000 sf',
      '≥ 25,000 sf',
    ]);
  });

  it('uses qualified leads as a disclosed safe default', () => {
    const result = composeParcelThesis('Assemblage opportunities in Queens');

    expect(result.siteType).toBe('uncommitted');
    expect(result.criteria).toContainEqual({
      id: 'site_type',
      label: 'Site type',
      valueLabel: 'Qualified acquisition leads',
      source: 'safe_default',
    });
    expect(result.canApply).toBe(true);
  });

  it('does not reverse a negative hazard request into a positive signal', () => {
    const result = composeParcelThesis(
      'Vacant Brooklyn sites without floodplain or violations',
    );

    expect(result.signals).toEqual([]);
    expect(result.unsupported.map((item) => item.id)).toContain('exclusion');
    expect(result.canApply).toBe(true);
  });

  it('flags unsupported financial, feasibility, intent, and zoning concepts', () => {
    const result = composeParcelThesis(
      'Brooklyn sites below $5m with 100 units, R6 zoning, owner phone, and a motivated seller',
    );

    expect(result.unsupported.map((item) => item.id)).toEqual([
      'financial',
      'program',
      'owner_contact',
      'seller_intent',
      'zoning',
    ]);
    expect(result.criteria.map((criterion) => criterion.valueLabel)).toContain(
      'Brooklyn',
    );
  });

  it('fails closed when the prompt contains conflicting supported criteria', () => {
    const result = composeParcelThesis(
      'Vacant and ground-up sites in Brooklyn and Queens',
    );

    expect(result.canApply).toBe(false);
    expect(result.conflicts).toHaveLength(2);
  });

  it('fails closed when one numeric criterion contains competing minimums', () => {
    const result = composeParcelThesis(
      'Brooklyn lots over 5,000 sf and lots over 10,000 sf',
    );

    expect(result.canApply).toBe(false);
    expect(result.conflicts).toContain(
      'Minimum lot area contains more than one minimum. Use one explicit threshold.',
    );
  });

  it('requires at least one explicit supported criterion', () => {
    const result = composeParcelThesis('Find the best possible deal');

    expect(result.explicitCriterionCount).toBe(0);
    expect(result.canApply).toBe(false);
    expect(result.criteria).toContainEqual(
      expect.objectContaining({ source: 'safe_default' }),
    );
  });

  it('replaces hidden prior search state when applying a reviewed thesis', () => {
    const result = composeParcelThesis(
      'Highest-priority assemblage sites in the Bronx',
    );
    const next = filtersFromThesisComposition(current, result);

    expect(next).toEqual({
      borough: 'bronx',
      priority: 'highest',
      siteType: 'uncommitted',
      signals: ['assemblage'],
      minLotAreaSqft: null,
      minUnusedFloorAreaSqft: null,
      query: '',
      ownerPortfolioId: null,
    });
  });
});
