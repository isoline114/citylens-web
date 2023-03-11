import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelIntelRow } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as 'unauthenticated' | 'authenticated',
  listParcelWorkflow: vi.fn(),
  saveParcelWorkflow: vi.fn(),
  removeParcelWorkflow: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    status: mocks.authStatus,
    user: mocks.authStatus === 'authenticated' ? { id: 'user-1' } : null,
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    listParcelWorkflow: mocks.listParcelWorkflow,
    saveParcelWorkflow: mocks.saveParcelWorkflow,
    removeParcelWorkflow: mocks.removeParcelWorkflow,
  };
});

import {
  externalParcelLinks,
  ParcelIntelPropertyPanel,
} from './parcel-intel-property-panel';

const parcel: ParcelIntelRow = {
  bbl: '3050660023',
  address: '224 Clarkson Avenue',
  borough: 'brooklyn',
  score_calibrated: 0.94,
  score_calibrated_p10: 0.8,
  score_calibrated_p90: 0.98,
  priority_rank: 1,
  priority_tier: 'highest',
  lot_area_sqft: 30000,
  allowed_far: 4.8,
  max_floor_area_sqft: 144000,
  unused_floor_area_sqft: 120000,
  far_utilization_pct: 16.7,
  zoning_district_1: 'R7-1',
  land_use: '06',
  year_built: 1928,
  num_floors: 1,
  lat: 40.655,
  lng: -73.952,
  last_sale_price: 1400000,
  last_sale_year: 2025,
  years_held: 1,
  has_recent_sale_5yr: true,
  is_landmark: false,
  is_historic_district: false,
  block_id: '305066',
  block_rank: 1,
  owner_name: 'Example Owner LLC',
  top_features: [],
  redev_status: 'active',
  opportunity_category: 'active_project',
  property_facts_as_of: '2026-07-19',
  ownership_as_of: '2026-07-15',
  project_activity_as_of: '2026-07-19',
};

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
  mocks.listParcelWorkflow.mockReset();
  mocks.listParcelWorkflow.mockResolvedValue([]);
  mocks.saveParcelWorkflow.mockReset();
  mocks.removeParcelWorkflow.mockReset();
});

describe('ParcelIntelPropertyPanel', () => {
  it('keeps parcel facts and external records in a compact overview panel', () => {
    const onClose = vi.fn();
    render(<ParcelIntelPropertyPanel row={parcel} onClose={onClose} />);

    expect(screen.getByText('224 Clarkson Avenue')).toBeInTheDocument();
    expect(screen.getByText('Example Owner LLC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ACRIS/i })).toHaveAttribute(
      'href',
      expect.stringContaining('block=5066'),
    );
    expect(screen.getByText('Why it surfaced')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows underwriting in place and gates workflow actions when signed out', () => {
    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Underwrite' }));
    expect(screen.getByText('Indicative maximum land basis')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }));
    expect(screen.getByText('Sign in to manage this opportunity')).toBeInTheDocument();
    expect(mocks.listParcelWorkflow).not.toHaveBeenCalled();
  });

  it('explains and links acquisition-blocking ZAP entitlement activity', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          acquisition_status: 'active_project',
          acquisition_eligible: false,
          acquisition_exclusion_reasons: ['approved_land_use_project'],
          latest_project_type: 'land_use_entitlement',
          latest_project_status: 'Completed — approved',
          latest_project_job_number: '2023K0205',
          latest_project_url: 'https://zap.planning.nyc.gov/projects/2023K0205',
          land_use_activity_as_of: '2026-07-22',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/NYC Planning records completed — approved/i)).toBeInTheDocument();
    expect(screen.getByText(/Project 2023K0205/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open official project record/i })).toHaveAttribute(
      'href',
      'https://zap.planning.nyc.gov/projects/2023K0205',
    );
    expect(screen.getByText('ZAP 2026-07-22')).toBeInTheDocument();
  });

  it('labels final tax-lien sale history as diligence rather than current debt', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          tax_lien_sale_date: '2025-06-01',
          tax_lien_sale_year: 2025,
          tax_lien_water_debt_only: false,
          tax_lien_data_as_of: '2026-07-23',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/2025 final tax-lien sale record/i)).toBeInTheDocument();
    expect(screen.getByText(/does not prove a balance remains unpaid/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official source data/i })).toHaveAttribute(
      'href',
      'https://data.cityofnewyork.us/d/9rz4-mjek',
    );
  });

  it('renders official current violation diligence without changing rank semantics', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          dob_safety_active_count: 4,
          dob_safety_latest_issue_date: '2026-07-20',
          ecb_active_count: 3,
          ecb_class_1_count: 2,
          ecb_balance_due: -3125,
          ecb_latest_issue_date: '2026-07-18',
          hpd_open_count: 7,
          hpd_class_c_count: 1,
          hpd_latest_inspection_date: '2026-07-19',
          critical_violation_count: 3,
          violation_data_as_of: '2026-07-23',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Open violation snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/3 immediate-hazard records/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Class 1 immediately hazardous/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Class C immediately hazardous/i)).toBeInTheDocument();
    expect(screen.getByText(/not ranking inputs/i)).toBeInTheDocument();
    expect(screen.getByText(/data retrieved 2026-07-23/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /DOB Safety source/i })).toHaveAttribute(
      'href',
      'https://data.cityofnewyork.us/d/855j-jady',
    );
    expect(screen.getByRole('link', { name: /OATH \/ ECB source/i })).toHaveAttribute(
      'href',
      'https://data.cityofnewyork.us/d/6bgk-3dad',
    );
    expect(screen.getByRole('link', { name: /HPD source/i })).toHaveAttribute(
      'href',
      'https://data.cityofnewyork.us/d/wvxf-dwi5',
    );
  });

  it('keeps adopted and preliminary floodplain screens distinct', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          firm07_floodplain: false,
          pfirm15_floodplain: true,
          floodplain_1pct: true,
          floodplain_data_as_of: '2026-07-23',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/1% annual-chance floodplain screen/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Mapped overlap')).toBeInTheDocument();
    expect(screen.getByText('Adopted map')).toBeInTheDocument();
    expect(screen.getByText('Preliminary planning map')).toBeInTheDocument();
    expect(screen.getByText(/does not prove that an existing building/i)).toBeInTheDocument();
    expect(screen.getByText(/PLUTO retrieved 2026-07-23/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official PLUTO source/i })).toHaveAttribute(
      'href',
      'https://data.cityofnewyork.us/d/64uk-42ks',
    );
  });

  it('distinguishes restrictive declarations without claiming contamination', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          environmental_review_required: true,
          environmental_designation_number: 'R-14',
          environmental_designation_kind: 'restrictive_declaration',
          environmental_designation_data_as_of: '2026-07-23',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Environmental designation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/PLUTO lists restrictive declaration R-14/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Neither is proof of contamination/i)).toBeInTheDocument();
    expect(screen.getByText(/PLUTO retrieved 2026-07-23/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /NYC OER guidance/i })).toHaveAttribute(
      'href',
      'https://www.nyc.gov/site/oer/remediation/e-designation.page',
    );
  });

  it('shows conservative current-owner portfolio context and can focus it', () => {
    const onViewOwnerPortfolio = vi.fn();
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          owner_entity_type: 'llc',
          owner_portfolio_id: 'portfolio-123',
          owner_portfolio_match_method: 'exact_normalized_pluto_owner_name',
          owner_portfolio_lot_count: 9,
          owner_portfolio_borough_count: 3,
          owner_portfolio_total_lot_area_sqft: 72000,
          owner_portfolio_candidate_count: 4,
          owner_portfolio_data_as_of: '2026-07-23',
        }}
        onClose={vi.fn()}
        onViewOwnerPortfolio={onViewOwnerPortfolio}
      />,
    );

    expect(
      screen.getByText(/Current PLUTO owner portfolio/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Related LLCs are not inferred/i)).toBeInTheDocument();
    expect(screen.getByText(/same-name entities still require/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PLUTO source/i })).toHaveAttribute(
      'href',
      'https://data.cityofnewyork.us/d/64uk-42ks',
    );
    fireEvent.click(
      screen.getByRole('button', { name: /View current candidate holdings/i }),
    );
    expect(onViewOwnerPortfolio).toHaveBeenCalledWith('portfolio-123');
  });

  it('loads the authenticated acquisition workflow into the parcel panel', async () => {
    mocks.authStatus = 'authenticated';
    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    await waitFor(() => expect(mocks.listParcelWorkflow).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }));
    expect(screen.getByRole('button', { name: /Add to pipeline/i })).toBeInTheDocument();
  });

  it('explains model factors without presenting activity records as completed buildings', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          top_features: [
            {
              name: 'prior_nb_activity_record_count',
              value: 15,
              contribution_logit: 0.8,
              contribution_pct: 0.32,
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Model attribution'));
    expect(screen.getByText('Historical new-building activity records')).toBeInTheDocument();
    expect(screen.getByText('Observed value: 15')).toBeInTheDocument();
    expect(screen.getByText(/not a count of completed buildings/i)).toBeInTheDocument();
    expect(screen.getByText(/Contributions explain this model score/i)).toBeInTheDocument();
  });

  it('separates historical model, current gates, diligence, and workflow evidence', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          acquisition_eligible: true,
          acquisition_status: 'eligible',
          property_facts_current: true,
          decision_audit: {
            schema_version: 'citylens/parcel-decision-audit@v1',
            overall_status: 'screened_with_flags',
            overall_label: 'Eligible lead with diligence flags',
            validation: {
              target: 'dob_nb_job_filing',
              evaluation_scope: '2024 PLUTO to 2025 DOB NB filings',
              precision_at_100: 0.34,
              precision_at_1000: 0.104,
              base_rate: 0.0012439591,
              prospective_validated: false,
              disclaimer:
                'Historical next-year DOB new-building filing performance is not seller intent, transaction probability, or acquisition conversion.',
            },
            checks: [
              {
                key: 'historical_model',
                layer: 'model_signal',
                label: 'Historical redevelopment signal',
                status: 'informational',
                summary: 'Historical screening order, not a parcel probability.',
                source: 'Accepted model bundle',
                as_of: '2025-2025',
                affects_model_rank: true,
                affects_acquisition_eligibility: false,
              },
              {
                key: 'acquisition_eligibility',
                layer: 'eligibility_gate',
                label: 'Current acquisition gate',
                status: 'verified',
                summary: 'This lead passed current project and ownership gates.',
                source: 'CityLens deterministic acquisition policy',
                as_of: '2026-07-24',
                affects_model_rank: false,
                affects_acquisition_eligibility: true,
              },
              {
                key: 'current_diligence',
                layer: 'current_diligence',
                label: 'Current diligence overlays',
                status: 'review',
                summary: 'Review before underwriting: 1% floodplain overlap.',
                source: 'NYC PLUTO/FEMA',
                as_of: '2026-07-24',
                affects_model_rank: false,
                affects_acquisition_eligibility: false,
              },
            ],
            limitations: [
              'The historical target is not owner willingness to sell.',
            ],
          },
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Audit' }));

    expect(screen.getByText('Eligible lead with diligence flags')).toBeInTheDocument();
    expect(screen.getByText('34.0%')).toBeInTheDocument();
    expect(screen.getByText('10.4%')).toBeInTheDocument();
    expect(screen.getByText('0.12%')).toBeInTheDocument();
    expect(screen.getByText('Model input')).toBeInTheDocument();
    expect(screen.getByText('Eligibility gate')).toBeInTheDocument();
    expect(screen.getByText('Diligence only · no rank effect')).toBeInTheDocument();
    expect(screen.getByText(/not seller intent/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to add private notes/i)).toBeInTheDocument();
  });

  it('does not emit city-system links for malformed BBLs', () => {
    expect(externalParcelLinks({ ...parcel, bbl: 'bad', lat: null, lng: null })).toEqual([]);
  });
});
