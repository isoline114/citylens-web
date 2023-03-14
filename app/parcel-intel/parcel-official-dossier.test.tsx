import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParcelOfficialDossier } from '@/lib/api';
import { ParcelOfficialDossierPanel } from './parcel-official-dossier';

const mocks = vi.hoisted(() => ({
  getParcelOfficialDossier: vi.fn(),
  recordParcelProductEvent: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelOfficialDossier: mocks.getParcelOfficialDossier,
    recordParcelProductEvent: mocks.recordParcelProductEvent,
  };
});

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
    environmental_review_required: true,
    environmental_designation_kind: 'E',
    environmental_designation_number: 'E-839',
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
      dob_bis: 'https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet',
    },
    interpretation:
      'Official source facts only. This is not a lead score, title report, appraisal, zoning analysis, seller-intent signal, or beneficial-owner determination.',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getParcelOfficialDossier.mockReset();
  mocks.recordParcelProductEvent.mockReset();
  mocks.recordParcelProductEvent.mockResolvedValue(undefined);
});

describe('ParcelOfficialDossierPanel', () => {
  it('renders a source-dated official dossier without claiming a lead score', async () => {
    mocks.getParcelOfficialDossier.mockResolvedValue(dossier());

    render(<ParcelOfficialDossierPanel bbl="3058920038" />);

    const panel = await screen.findByTestId('parcel-official-dossier');
    expect(panel).toHaveTextContent('464 OVINGTON AVENUE');
    expect(panel).toHaveTextContent('Any NYC tax lot · not a lead score');
    expect(panel).toHaveTextContent('$1,460,000');
    expect(panel).toHaveTextContent('E-839');
    expect(panel).toHaveTextContent('Official source facts only');
    expect(
      screen.getByTestId('parcel-dossier-readiness-status'),
    ).toHaveTextContent('Source review required');
    expect(
      screen.getByTestId('parcel-dossier-action-verify-zoning'),
    ).toHaveAttribute(
      'href',
      'https://zola.planning.nyc.gov/l/lot/3/5892/38',
    );
    expect(
      screen.getByRole('link', { name: 'ZoLa' }),
    ).toHaveAttribute(
      'href',
      'https://zola.planning.nyc.gov/l/lot/3/5892/38',
    );
    expect(mocks.getParcelOfficialDossier).toHaveBeenCalledWith(
      '3058920038',
    );
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
      'official_dossier_opened',
      'official_dossier',
    );
  });

  it('preserves source disagreement instead of fabricating one owner', async () => {
    mocks.getParcelOfficialDossier.mockResolvedValue(
      dossier({
        owner_source_status: 'different',
        acris_owner_name: 'CURRENT DEED GRANTEE LLC',
        pluto_owner_name: 'PLUTO TAX OWNER LLC',
      }),
    );

    render(<ParcelOfficialDossierPanel bbl="3058920038" />);

    expect(
      await screen.findByText('Owner sources differ — verify title'),
    ).toBeVisible();
    expect(screen.getByText('CURRENT DEED GRANTEE LLC')).toBeVisible();
    expect(screen.getByText('PLUTO TAX OWNER LLC')).toBeVisible();
    expect(screen.getByText(/preserved both/i)).toBeVisible();
    expect(
      screen.getByTestId('parcel-dossier-action-verify-title'),
    ).toHaveAttribute(
      'href',
      'https://a836-acris.nyc.gov/DS/DocumentSearch/BBL',
    );
  });

  it('fails gracefully when the official record cannot be loaded', async () => {
    mocks.getParcelOfficialDossier.mockRejectedValue(
      new Error('Official dossier generation is unavailable'),
    );

    render(<ParcelOfficialDossierPanel bbl="3058920038" />);

    expect(
      await screen.findByTestId('parcel-official-dossier-error'),
    ).toHaveTextContent('Official dossier generation is unavailable');
  });
});
