import { describe, expect, it } from 'vitest';

import type { ParcelOfficialDossier } from '@/lib/api';
import { buildDossierEvidenceReadiness } from './parcel-official-dossier-readiness';

function dossier(
  overrides: Partial<ParcelOfficialDossier> = {},
): ParcelOfficialDossier {
  return {
    schema_version: 'citylens/parcel-official-dossier@v1',
    bbl: '3058920038',
    borough: 'brooklyn',
    address: '464 OVINGTON AVENUE',
    pluto_owner_name: 'GEFFEN MANAGEMENT LLC',
    acris_owner_name: 'GEFFEN MANAGEMENT LLC',
    owner_source_status: 'match',
    last_sale_date: '2022-06-15',
    last_sale_price: 1_460_000,
    years_held: 4,
    lot_area_sqft: 9_260,
    building_area_sqft: 3_006,
    units: 2,
    num_floors: 2,
    year_built: 1899,
    land_use: '01',
    building_class: 'R4',
    zoning_district_1: 'R6A',
    zoning_district_2: null,
    built_far: 0.32,
    residential_far: 3,
    commercial_far: 0,
    facility_far: 3,
    assessed_land: 32_400,
    assessed_building: 7_020,
    assessed_total: 39_420,
    firm_2007_floodplain: false,
    pfirm_2015_floodplain: false,
    environmental_review_required: false,
    environmental_designation_kind: null,
    environmental_designation_number: null,
    property_facts_dataset_id: '64uk-42ks',
    property_facts_retrieved_at: '2026-07-19T00:00:00Z',
    ownership_dataset_ids: {
      master: 'bnx9-e6tj',
      legals: '8h5j-fqxa',
      parties: '636b-3b5g',
    },
    ownership_features_updated_at: '2026-07-15T00:00:00Z',
    dossier_generation: 'generation-1',
    official_links: {
      zola: 'https://zola.planning.nyc.gov/l/lot/3/5892/38',
      acris: 'https://a836-acris.nyc.gov/DS/DocumentSearch/BBL',
      dob_bis:
        'https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet',
    },
    interpretation: 'Official source facts only.',
    ...overrides,
  };
}

describe('buildDossierEvidenceReadiness', () => {
  it('reports complete source coverage without turning it into confidence', () => {
    const readiness = buildDossierEvidenceReadiness(dossier());

    expect(readiness).toMatchObject({
      status: 'strong',
      label: 'Source coverage strong',
      presentCount: 6,
      totalCount: 6,
      reviewCount: 0,
      partialCount: 0,
      missingCount: 0,
    });
    expect(readiness.actions).toEqual([
      expect.objectContaining({
        key: 'verify-source',
        link: 'zola',
      }),
    ]);
  });

  it('turns source disagreements and mapped flags into verification actions', () => {
    const readiness = buildDossierEvidenceReadiness(
      dossier({
        owner_source_status: 'different',
        pluto_owner_name: 'PLUTO OWNER LLC',
        acris_owner_name: 'ACRIS GRANTEE LLC',
        firm_2007_floodplain: true,
        environmental_review_required: true,
        environmental_designation_number: 'E-839',
      }),
    );

    expect(readiness.status).toBe('review_required');
    expect(readiness.reviewCount).toBe(2);
    expect(readiness.actions.map((action) => action.key)).toEqual([
      'verify-title',
      'verify-zoning',
      'verify-flood',
    ]);
  });

  it('distinguishes one-source coverage from a contradictory owner record', () => {
    const readiness = buildDossierEvidenceReadiness(
      dossier({
        owner_source_status: 'pluto_only',
        acris_owner_name: null,
      }),
    );

    expect(readiness.status).toBe('partial');
    expect(readiness.reviewCount).toBe(0);
    expect(readiness.partialCount).toBe(1);
    expect(
      readiness.groups.find((group) => group.key === 'ownership')?.status,
    ).toBe('partial');
    expect(readiness.actions[0]).toEqual(
      expect.objectContaining({ key: 'verify-title', link: 'acris' }),
    );
  });

  it('keeps absent official facts missing instead of inventing a low score', () => {
    const readiness = buildDossierEvidenceReadiness(
      dossier({
        address: null,
        pluto_owner_name: null,
        acris_owner_name: null,
        owner_source_status: 'unavailable',
        last_sale_date: null,
        last_sale_price: null,
        lot_area_sqft: null,
        building_area_sqft: null,
        units: null,
        year_built: null,
        land_use: null,
        building_class: null,
        zoning_district_1: null,
        built_far: null,
        residential_far: null,
        commercial_far: null,
        facility_far: null,
      }),
    );

    expect(readiness.status).toBe('partial');
    expect(readiness.missingCount).toBe(5);
    expect(readiness.presentCount).toBe(1);
    expect(readiness.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ownership', status: 'missing' }),
        expect.objectContaining({ key: 'deed', status: 'missing' }),
        expect.objectContaining({ key: 'physical', status: 'missing' }),
        expect.objectContaining({ key: 'zoning', status: 'missing' }),
      ]),
    );
  });

  it('treats legitimate zero values as present source facts', () => {
    const readiness = buildDossierEvidenceReadiness(
      dossier({
        last_sale_price: 0,
        building_area_sqft: 0,
        units: 0,
        built_far: 0,
        residential_far: 0,
      }),
    );

    expect(
      readiness.groups.find((group) => group.key === 'deed')?.status,
    ).toBe('available');
    expect(
      readiness.groups.find((group) => group.key === 'physical')?.status,
    ).toBe('available');
    expect(
      readiness.groups.find((group) => group.key === 'zoning')?.status,
    ).toBe('available');
  });
});
