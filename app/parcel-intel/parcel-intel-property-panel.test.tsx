import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ParcelHistoricalBenchmarkReceipt,
  ParcelHistoricalBoroughCohortEvidence,
  ParcelIntelRow,
  ParcelWorkflowItem,
} from '@/lib/api';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as 'unauthenticated' | 'authenticated',
  getParcelWorkflow: vi.fn(),
  listParcelWorkflowEvents: vi.fn(),
  recordParcelProductEvent: vi.fn(),
  saveParcelWorkflow: vi.fn(),
  removeParcelWorkflow: vi.fn(),
  reviewParcelWorkflowEvidence: vi.fn(),
  clearParcelWorkflowEvidenceReview: vi.fn(),
  submitParcelWorkflowEvidenceIssue: vi.fn(),
  withdrawParcelWorkflowEvidenceIssue: vi.fn(),
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
    getParcelWorkflow: mocks.getParcelWorkflow,
    listParcelWorkflowEvents: mocks.listParcelWorkflowEvents,
    recordParcelProductEvent: mocks.recordParcelProductEvent,
    saveParcelWorkflow: mocks.saveParcelWorkflow,
    removeParcelWorkflow: mocks.removeParcelWorkflow,
    reviewParcelWorkflowEvidence: mocks.reviewParcelWorkflowEvidence,
    clearParcelWorkflowEvidenceReview:
      mocks.clearParcelWorkflowEvidenceReview,
    submitParcelWorkflowEvidenceIssue:
      mocks.submitParcelWorkflowEvidenceIssue,
    withdrawParcelWorkflowEvidenceIssue:
      mocks.withdrawParcelWorkflowEvidenceIssue,
  };
});

vi.mock('./parcel-official-dossier', () => ({
  ParcelOfficialDossierPanel: ({ bbl }: { bbl: string }) => (
    <div data-testid="official-dossier-stub">Official dossier {bbl}</div>
  ),
}));

import {
  buildParcelDecisionBrief,
  externalParcelLinks,
  ParcelIntelPropertyPanel,
} from './parcel-intel-property-panel';

const parcel: ParcelIntelRow = {
  bbl: '3050660023',
  address: '224 Clarkson Avenue',
  address_source: 'nyc_pluto',
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

const historicalReceipt: ParcelHistoricalBenchmarkReceipt = {
  schema: 'citylens_historical_benchmark_receipt@v1',
  target: 'dob_nb_job_filing',
  feature_origin: 2024,
  outcome_window: '2025-2025',
  evaluation_scope: 'rolling_origin_latest_out_of_time',
  evaluation_rows: 768514,
  observed_positive_rows: 956,
  base_rate: 956 / 768514,
  auc: 0.9232830323176429,
  pr_auc: 0.054015618548797745,
  top_100: {
    k: 100,
    evaluated_rows: 100,
    observed_hits: 34,
    precision: 0.34,
    precision_95ci: [0.25461520797348164, 0.43722271145275377],
  },
  top_1000: {
    k: 1000,
    evaluated_rows: 1000,
    observed_hits: 104,
    precision: 0.104,
    precision_95ci: [0.08657102809826807, 0.12445976462229157],
  },
  interval: {
    method: 'wilson_score_observed_top_k',
    confidence_level: 0.95,
    scope: 'fixed_historical_ranked_list',
    limitations:
      'Observed outcome uncertainty only; not model selection, spatial dependence, or current outcomes.',
  },
  evidence_status: 'development_exposed',
  not_current_accuracy: true,
  not_parcel_confidence: true,
};

const historicalBrooklynCohort: ParcelHistoricalBoroughCohortEvidence = {
  borough: 'brooklyn',
  target: 'dob_nb_job_filing',
  feature_origin: 2024,
  outcome_window: '2025-2025',
  evaluation_scope: 'rolling_origin_latest_out_of_time',
  ranking_scope: 'historical_within_borough_model_order',
  cohort: {
    evaluation_rows: 245853,
    observed_positive_rows: 240,
    base_rate: 240 / 245853,
    top_100: {
      k: 100,
      evaluated_rows: 100,
      observed_hits: 10,
      precision: 0.1,
      precision_95ci: [0.0552291370606751, 0.17436566150491345],
    },
  },
  interval: {
    method: 'wilson_score_observed_top_k',
    confidence_level: 0.95,
    scope: 'fixed_historical_borough_ranked_list',
    limitations:
      'Fixed historical borough list; not current or parcel confidence.',
  },
  evidence_status: 'development_exposed',
  not_current_accuracy: true,
  not_parcel_confidence: true,
};

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
  mocks.getParcelWorkflow.mockReset();
  mocks.getParcelWorkflow.mockResolvedValue(null);
  mocks.listParcelWorkflowEvents.mockReset();
  mocks.listParcelWorkflowEvents.mockResolvedValue([]);
  mocks.recordParcelProductEvent.mockReset();
  mocks.recordParcelProductEvent.mockResolvedValue(undefined);
  mocks.saveParcelWorkflow.mockReset();
  mocks.removeParcelWorkflow.mockReset();
  mocks.reviewParcelWorkflowEvidence.mockReset();
  mocks.clearParcelWorkflowEvidenceReview.mockReset();
  mocks.submitParcelWorkflowEvidenceIssue.mockReset();
  mocks.withdrawParcelWorkflowEvidenceIssue.mockReset();
});

describe('ParcelIntelPropertyPanel', () => {
  it('keeps the parcel workspace modes in an accessible sticky navigator', () => {
    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    const tabs = screen.getByRole('navigation', {
      name: 'Parcel workspace sections',
    });
    expect(tabs).toHaveAttribute('data-testid', 'parcel-workspace-tabs');
    expect(tabs).toHaveClass('sticky', 'top-0');
    expect(
      screen.getByRole('button', { name: 'Overview' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports a bounded comparison action independently of authentication', () => {
    const onToggleCompare = vi.fn();
    const { rerender } = render(
      <ParcelIntelPropertyPanel
        row={parcel}
        onClose={vi.fn()}
        onToggleCompare={onToggleCompare}
      />,
    );

    const compare = screen.getByTestId('parcel-compare-toggle');
    expect(compare).toHaveTextContent('Compare');
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(compare);
    expect(onToggleCompare).toHaveBeenCalledOnce();

    rerender(
      <ParcelIntelPropertyPanel
        row={parcel}
        onClose={vi.fn()}
        compareLimitReached
        onToggleCompare={onToggleCompare}
      />,
    );
    expect(screen.getByTestId('parcel-compare-toggle')).toBeDisabled();
    expect(screen.getByTestId('parcel-compare-toggle')).toHaveAttribute(
      'title',
      'Remove a parcel before adding another comparison',
    );

    rerender(
      <ParcelIntelPropertyPanel
        row={parcel}
        onClose={vi.fn()}
        isCompared
        compareLimitReached
        onToggleCompare={onToggleCompare}
      />,
    );
    expect(screen.getByTestId('parcel-compare-toggle')).toHaveTextContent(
      'Compared',
    );
    expect(screen.getByTestId('parcel-compare-toggle')).toBeEnabled();
  });

  it('keeps parcel facts and external records in a compact overview panel', () => {
    const onClose = vi.fn();
    render(<ParcelIntelPropertyPanel row={parcel} onClose={onClose} />);

    expect(
      screen.getByRole('region', { name: '224 Clarkson Avenue' }),
    ).toBeInTheDocument();
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

  it('shows official address provenance and flags genuinely unnumbered lots', () => {
    const { rerender } = render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          address: '70-25 Queens Midtown Expressway',
          address_source: 'nyc_pad',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('PAD · BBL matched')).toBeInTheDocument();
    expect(screen.queryByText('Unnumbered tax lot')).not.toBeInTheDocument();

    rerender(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          address: 'Taylor Street',
          address_source: 'nyc_pluto',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Unnumbered tax lot')).toBeInTheDocument();
    expect(screen.queryByText('PAD · BBL matched')).not.toBeInTheDocument();
  });

  it('shows underwriting in place and gates workflow actions when signed out', () => {
    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Underwrite' }));
    expect(
      screen.getByText(/Indicative maximum land basis/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Value / sellable SF'), {
      target: { value: '1000' },
    });
    expect(mocks.recordParcelProductEvent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }));
    expect(screen.getByText('Sign in to manage this opportunity')).toBeInTheDocument();
    expect(mocks.getParcelWorkflow).not.toHaveBeenCalled();
  });

  it('records only the first underwriting open and adjustment per parcel', async () => {
    mocks.authStatus = 'authenticated';
    const { rerender } = render(
      <ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Underwrite' }));
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
        'underwriting_opened',
        'underwrite_tab',
      ),
    );

    fireEvent.change(screen.getByLabelText('Value / sellable SF'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('Hard cost / gross SF'), {
      target: { value: '425' },
    });
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
        'underwriting_assumptions_changed',
        'base_assumptions',
      ),
    );
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Underwrite' }));
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(2);

    rerender(
      <ParcelIntelPropertyPanel
        row={{ ...parcel, bbl: '3050660026', address: 'Other parcel' }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Underwrite' }));
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenLastCalledWith(
        'underwriting_opened',
        'underwrite_tab',
      ),
    );
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(mocks.recordParcelProductEvent.mock.calls)).not.toMatch(
      /3050660023|3050660026|address|owner|value|cost|margin|1000|425/i,
    );
  });

  it('turns an adjusted screen into a bounded diligence workflow without saving financial inputs', async () => {
    mocks.authStatus = 'authenticated';
    mocks.saveParcelWorkflow.mockResolvedValue({
      bbl: parcel.bbl,
      borough: 'brooklyn',
      stage: 'reviewing',
      notes: '',
      tags: [],
      assignee: null,
      watching: true,
      decision_reason: null,
      next_action:
        'Validate current zoning capacity, market evidence, and cost assumptions.',
      next_action_due_date: null,
      outcome: 'unknown',
      snapshot: {} as ParcelWorkflowItem['snapshot'],
      saved_at: '2026-07-29T14:00:00Z',
      updated_at: '2026-07-29T14:00:00Z',
    } satisfies ParcelWorkflowItem);

    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Underwrite' }));
    const saveForDiligence = await screen.findByRole('button', {
      name: 'Save for diligence',
    });
    expect(saveForDiligence).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Value / sellable SF'), {
      target: { value: '1000' },
    });
    await waitFor(() => expect(saveForDiligence).toBeEnabled());
    fireEvent.click(saveForDiligence);

    await waitFor(() =>
      expect(mocks.saveParcelWorkflow).toHaveBeenCalledWith(parcel.bbl, {
        borough: 'brooklyn',
        stage: 'reviewing',
        notes: '',
        tags: [],
        assignee: null,
        watching: true,
        decision_reason: null,
        next_action:
          'Validate current zoning capacity, market evidence, and cost assumptions.',
        next_action_due_date: null,
        outcome: 'unknown',
      }),
    );
    const request = mocks.saveParcelWorkflow.mock.calls[0]?.[1];
    expect(JSON.stringify(request)).not.toMatch(
      /1000|900|400|value_per|hard_cost|sellable|margin/i,
    );
    expect(await screen.findByText('Saved to your pipeline')).toBeVisible();
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

  it('shows MIH overlap as a dated diligence screen with official references', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          mandatory_inclusionary_housing: true,
          mih_options: ['Option 1', 'Deep Affordability Option'],
          mih_area_count: 2,
          mih_data_as_of: '2026-07-24',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('mih-diligence')).toHaveTextContent(
      'Mandatory Inclusionary Housing screen',
    );
    expect(screen.getByText('Mapped overlap')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Deep Affordability Option')).toBeInTheDocument();
    expect(screen.getByText(/not a tax-lot legal determination/i)).toBeInTheDocument();
    expect(screen.getByText(/official layer retrieved 2026-07-24/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Zoning Resolution Appendix F/i }),
    ).toHaveAttribute(
      'href',
      'https://zr.planning.nyc.gov/index.php/node/21424',
    );
  });

  it('shows dated MTA proximity without claiming walk time or service quality', () => {
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          nearest_transit_complex_id: '628',
          nearest_transit_station_name: 'Church Av',
          nearest_transit_station_distance_m: 420,
          nearest_transit_routes: ['B', 'Q'],
          nearest_transit_ada_status: 'full',
          transit_station_count_400m: 0,
          transit_station_count_800m: 2,
          transit_access_tier: 'walkable',
          transit_data_as_of: '2026-07-24',
        }}
        onClose={vi.fn()}
      />,
    );

    const card = screen.getByTestId('transit-diligence');
    expect(card).toHaveTextContent('Subway / SIR access screen');
    expect(card).toHaveTextContent('Church Av');
    expect(card).toHaveTextContent('420 m');
    expect(card).toHaveTextContent('not a walking route');
    expect(card).toHaveTextContent('MTA data retrieved 2026-07-24');
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Official MTA station data/i }),
    ).toHaveAttribute(
      'href',
      'https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f',
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

    await waitFor(() =>
      expect(mocks.getParcelWorkflow).toHaveBeenCalledWith(parcel.bbl),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }));
    expect(screen.getByRole('button', { name: /Add to pipeline/i })).toBeInTheDocument();
  });

  it('opens a ranked lead official dossier as a separate non-scoring workspace', async () => {
    mocks.authStatus = 'authenticated';
    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    const dossierButton = screen.getByRole('button', {
      name: 'Official dossier',
    });
    fireEvent.click(dossierButton);

    expect(screen.getByTestId('official-dossier-stub')).toHaveTextContent(
      `Official dossier ${parcel.bbl}`,
    );
    expect(screen.getByTestId('ranked-parcel-official-dossier')).toHaveTextContent(
      'Non-scoring PLUTO and ACRIS evidence for this exact BBL.',
    );
    expect(dossierButton).toHaveAttribute('aria-pressed', 'true');
    const back = screen.getByRole('button', {
      name: 'Back to parcel workspace',
    });
    await waitFor(() => expect(back).toHaveFocus());

    fireEvent.click(back);
    expect(screen.queryByTestId('official-dossier-stub')).not.toBeInTheDocument();
    expect(dossierButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('turns an official dossier into a bounded verification task without copying source facts', async () => {
    mocks.authStatus = 'authenticated';
    mocks.saveParcelWorkflow.mockResolvedValue({
      bbl: parcel.bbl,
      borough: 'brooklyn',
      stage: 'reviewing',
      notes: '',
      tags: [],
      assignee: null,
      watching: true,
      decision_reason: null,
      next_action:
        'Verify recorded ownership, deed history, mapped zoning, and parcel constraints in the cited official sources.',
      next_action_due_date: null,
      outcome: 'unknown',
      snapshot: {} as ParcelWorkflowItem['snapshot'],
      saved_at: '2026-07-29T18:00:00Z',
      updated_at: '2026-07-29T18:00:00Z',
    } satisfies ParcelWorkflowItem);

    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Official dossier' }),
    );
    expect(
      screen.getByTestId('official-dossier-workflow-handoff'),
    ).toHaveTextContent('Viewing it never marks evidence reviewed.');

    const saveVerificationTask = await screen.findByRole('button', {
      name: 'Save verification task',
    });
    await waitFor(() => expect(saveVerificationTask).toBeEnabled());
    fireEvent.click(saveVerificationTask);

    await waitFor(() =>
      expect(mocks.saveParcelWorkflow).toHaveBeenCalledWith(parcel.bbl, {
        borough: 'brooklyn',
        stage: 'reviewing',
        notes: '',
        tags: [],
        assignee: null,
        watching: true,
        decision_reason: null,
        next_action:
          'Verify recorded ownership, deed history, mapped zoning, and parcel constraints in the cited official sources.',
        next_action_due_date: null,
        outcome: 'unknown',
      }),
    );
    const request = mocks.saveParcelWorkflow.mock.calls[0]?.[1];
    expect(JSON.stringify(request)).not.toMatch(
      /example owner|224 clarkson|3050660023|pluto|acris|source date/i,
    );
    expect(await screen.findByText('Saved to your pipeline')).toBeVisible();
    expect(
      screen.queryByTestId('ranked-parcel-official-dossier'),
    ).not.toBeInTheDocument();
  });

  it('binds workflow evidence review to the exact server citation version', async () => {
    mocks.authStatus = 'authenticated';
    const item = {
      bbl: parcel.bbl,
      borough: 'brooklyn',
      stage: 'reviewing',
      notes: '',
      tags: [],
      assignee: null,
      watching: true,
      decision_reason: 'pursuing',
      next_action: 'Verify official records.',
      next_action_due_date: null,
      outcome: 'unknown',
      snapshot: {} as ParcelWorkflowItem['snapshot'],
      saved_at: '2026-07-24T09:40:00Z',
      updated_at: '2026-07-24T09:40:00Z',
      evidence_reviews: {},
    } as ParcelWorkflowItem;
    const auditedParcel: ParcelIntelRow = {
      ...parcel,
      decision_audit: {
        schema_version: 'citylens/parcel-decision-audit@v1',
        evidence_generated_at: '2026-07-24T02:43:29Z',
        overall_status: 'screened',
        overall_label: 'Eligible lead after current gates',
        readiness: {
          status: 'initial_review_ready',
          label: 'Ready for an initial acquisition review',
          recommended_action: 'Verify official records.',
          blockers: [],
          review_items: [],
          cleared_items: [],
          disclaimer: 'Not a purchase recommendation.',
        },
        validation: {
          target: 'dob_nb_job_filing',
          evaluation_scope: 'Historical rolling-origin evaluation',
          precision_at_100: 0.34,
          precision_at_1000: 0.104,
          base_rate: 0.0012,
          prospective_validated: false,
          disclaimer: 'Historical screening order only.',
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
      },
    };
    const reviewedItem: ParcelWorkflowItem = {
      ...item,
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
    };
    const issueItem: ParcelWorkflowItem = {
      ...item,
      evidence_issues: {
        property_facts: {
          issue_id: 'pei_0123456789abcdef0123456789abcdef',
          check_key: 'property_facts',
          label: 'Current property facts',
          issue_type: 'correction',
          reason_code: 'incorrect_value',
          note: 'The displayed lot area conflicts with a current signed survey.',
          status: 'submitted',
          check_status: 'verified',
          source: 'NYC PLUTO',
          source_as_of: '2026-07-24',
          feed_generated_at: '2026-07-24T02:43:29Z',
          submitted_at: '2026-07-25T10:00:00Z',
          updated_at: '2026-07-25T10:00:00Z',
          resolved_at: null,
          resolution_note: null,
        },
      },
    };
    mocks.getParcelWorkflow.mockResolvedValue(item);
    mocks.reviewParcelWorkflowEvidence.mockResolvedValue(reviewedItem);
    mocks.clearParcelWorkflowEvidenceReview.mockResolvedValue(item);
    mocks.submitParcelWorkflowEvidenceIssue.mockResolvedValue(issueItem);
    mocks.withdrawParcelWorkflowEvidenceIssue.mockResolvedValue(item);

    render(
      <ParcelIntelPropertyPanel row={auditedParcel} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(mocks.getParcelWorkflow).toHaveBeenCalledWith(parcel.bbl),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Audit' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Review 1 source version',
      }),
    );
    const evidenceToggle = screen.getByTestId('evidence-review-toggle');
    await waitFor(() => expect(evidenceToggle).toHaveFocus());
    expect(evidenceToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mark Current property facts version reviewed',
      }),
    );

    await waitFor(() =>
      expect(mocks.reviewParcelWorkflowEvidence).toHaveBeenCalledWith(
        parcel.bbl,
        'property_facts',
        {
          expected_check_status: 'verified',
          expected_source: 'NYC PLUTO',
          expected_source_as_of: '2026-07-24',
          expected_feed_generated_at: '2026-07-24T02:43:29Z',
        },
      ),
    );
    expect(
      await screen.findByText(/Exact version reviewed/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Undo review of Current property facts',
      }),
    );
    await waitFor(() =>
      expect(mocks.clearParcelWorkflowEvidenceReview).toHaveBeenCalledWith(
        parcel.bbl,
        'property_facts',
      ),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Report a source issue for Current property facts',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('What should CityLens verify?'),
      {
        target: {
          value:
            'The displayed lot area conflicts with a current signed survey.',
        },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit for review' }),
    );
    await waitFor(() =>
      expect(mocks.submitParcelWorkflowEvidenceIssue).toHaveBeenCalledWith(
        parcel.bbl,
        'property_facts',
        {
          issue_type: 'correction',
          reason_code: 'incorrect_value',
          note:
            'The displayed lot area conflicts with a current signed survey.',
          expected_check_status: 'verified',
          expected_source: 'NYC PLUTO',
          expected_source_as_of: '2026-07-24',
          expected_feed_generated_at: '2026-07-24T02:43:29Z',
        },
      ),
    );
    expect(
      await screen.findByText('CityLens review pending'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Withdraw source issue for Current property facts',
      }),
    );
    await waitFor(() =>
      expect(mocks.withdrawParcelWorkflowEvidenceIssue).toHaveBeenCalledWith(
        parcel.bbl,
        'property_facts',
      ),
    );
  });

  it('guards loading and saves a canonical lead from the parcel header', async () => {
    mocks.authStatus = 'authenticated';
    let resolveWorkflow: (item: ParcelWorkflowItem | null) => void =
      () => undefined;
    mocks.getParcelWorkflow.mockReturnValue(
      new Promise<ParcelWorkflowItem | null>((resolve) => {
        resolveWorkflow = resolve;
      }),
    );
    const saved: ParcelWorkflowItem = {
      bbl: parcel.bbl,
      borough: 'brooklyn',
      stage: 'new',
      notes: '',
      tags: [],
      assignee: null,
      watching: true,
      decision_reason: null,
      next_action: null,
      next_action_due_date: null,
      outcome: 'unknown',
      snapshot: {
        feed_generated_at: '2026-07-24T09:15:49Z',
        property_facts_as_of: '2026-07-24',
        citywide_rank: 1,
        acquisition_rank: 1,
        priority_tier: 'highest',
        opportunity_category: 'ground_up_candidate',
        score_calibrated: 0.94,
        zoning_district_1: 'R7-1',
        land_use: '06',
        year_built: 1928,
        allowed_far: 4.8,
        unused_floor_area_sqft: 120000,
        owner_name: 'Example Owner LLC',
        owner_entity_type: null,
        owner_portfolio_lot_count: null,
        last_sale_year: 2025,
        latest_nb_filing_year: null,
        latest_nb_status: null,
        redev_status: 'active',
        observed_imagery_year: null,
        tax_lien_sale_year: null,
        critical_violation_count: null,
        floodplain_1pct: null,
        environmental_review_required: null,
        environmental_designation_number: null,
        environmental_designation_kind: null,
        mandatory_inclusionary_housing: null,
        nearest_transit_complex_id: null,
        nearest_transit_station_name: null,
        nearest_transit_station_distance_m: null,
        transit_access_tier: null,
        transit_data_as_of: null,
        recent_change: null,
      },
      saved_at: '2026-07-24T09:40:00Z',
      updated_at: '2026-07-24T09:40:00Z',
    };
    mocks.saveParcelWorkflow.mockResolvedValue(saved);

    render(<ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />);

    const quickSave = screen.getByTestId('workflow-quick-save');
    expect(quickSave).toBeDisabled();
    expect(quickSave).toHaveTextContent('Checking pipeline');
    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }));
    expect(screen.getByText('Checking pipeline status…')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add to pipeline' }),
    ).not.toBeInTheDocument();

    resolveWorkflow(null);
    await waitFor(() => expect(quickSave).toBeEnabled());
    expect(quickSave).toHaveTextContent('Save lead');
    fireEvent.click(quickSave);

    await waitFor(() =>
      expect(mocks.saveParcelWorkflow).toHaveBeenCalledWith(parcel.bbl, {
        borough: 'brooklyn',
        stage: 'new',
        notes: '',
        tags: [],
        assignee: null,
        watching: true,
        decision_reason: null,
        next_action: null,
        next_action_due_date: null,
        outcome: 'unknown',
      }),
    );
    expect(await screen.findByText('Saved to your pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-quick-save')).toHaveTextContent(
      'In pipeline · Open',
    );
    expect(mocks.recordParcelProductEvent).not.toHaveBeenCalled();
  });

  it('does not apply a completed save to a different parcel', async () => {
    mocks.authStatus = 'authenticated';
    let resolveSave: (item: ParcelWorkflowItem) => void = () => undefined;
    mocks.saveParcelWorkflow.mockReturnValue(
      new Promise<ParcelWorkflowItem>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { rerender } = render(
      <ParcelIntelPropertyPanel row={parcel} onClose={vi.fn()} />,
    );
    const quickSave = await screen.findByTestId('workflow-quick-save');
    await waitFor(() => expect(quickSave).toBeEnabled());
    fireEvent.click(quickSave);

    const otherParcel = {
      ...parcel,
      bbl: '3020960070',
      address: '102 E 21 STREET',
    };
    rerender(
      <ParcelIntelPropertyPanel row={otherParcel} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(mocks.getParcelWorkflow).toHaveBeenCalledWith(otherParcel.bbl),
    );

    resolveSave({
      bbl: parcel.bbl,
      borough: 'brooklyn',
      stage: 'new',
      notes: '',
      tags: [],
      assignee: null,
      watching: true,
      decision_reason: null,
      next_action: null,
      next_action_due_date: null,
      outcome: 'unknown',
      snapshot: {
        feed_generated_at: '2026-07-24T09:15:49Z',
        property_facts_as_of: '2026-07-24',
        citywide_rank: 1,
        acquisition_rank: 1,
        priority_tier: 'highest',
        opportunity_category: 'ground_up_candidate',
        score_calibrated: 0.94,
        zoning_district_1: 'R7-1',
        land_use: '06',
        year_built: 1928,
        allowed_far: 4.8,
        unused_floor_area_sqft: 120000,
        owner_name: 'Example Owner LLC',
        owner_entity_type: null,
        owner_portfolio_lot_count: null,
        last_sale_year: 2025,
        latest_nb_filing_year: null,
        latest_nb_status: null,
        redev_status: 'active',
        observed_imagery_year: null,
        tax_lien_sale_year: null,
        critical_violation_count: null,
        floodplain_1pct: null,
        environmental_review_required: null,
        environmental_designation_number: null,
        environmental_designation_kind: null,
        mandatory_inclusionary_housing: null,
        nearest_transit_complex_id: null,
        nearest_transit_station_name: null,
        nearest_transit_station_distance_m: null,
        transit_access_tier: null,
        transit_data_as_of: null,
        recent_change: null,
      },
      saved_at: '2026-07-24T09:40:00Z',
      updated_at: '2026-07-24T09:40:00Z',
    });

    await waitFor(() =>
      expect(screen.getByTestId('workflow-quick-save')).toHaveTextContent(
        'Save lead',
      ),
    );
    expect(screen.queryByText('Saved to your pipeline')).not.toBeInTheDocument();
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
          model_rank: 28,
          acquisition_eligible: true,
          acquisition_status: 'eligible',
          property_facts_current: true,
          decision_audit: {
            schema_version: 'citylens/parcel-decision-audit@v1',
            overall_status: 'screened_with_flags',
            overall_label: 'Eligible lead with diligence flags',
            readiness: {
              status: 'review_required',
              label: 'Diligence review required before advancing',
              recommended_action:
                'Resolve the listed diligence items before advancing to owner outreach or detailed underwriting.',
              blockers: [],
              review_items: [
                'Review floodplain exposure and site-specific mitigation requirements.',
              ],
              cleared_items: [
                'Current project and acquisition eligibility gates passed.',
              ],
              disclaimer:
                'Decision readiness is not a purchase recommendation or seller-intent score.',
            },
            validation: {
              target: 'dob_nb_job_filing',
              evaluation_scope: '2024 PLUTO to 2025 DOB NB filings',
              precision_at_100: 0.34,
              precision_at_1000: 0.104,
              base_rate: 0.0012439591,
              historical_benchmark_receipt: historicalReceipt,
              historical_borough_cohort: historicalBrooklynCohort,
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
                source: 'accepted_model_bundle.rolling_validation',
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

    const posture = screen.getByTestId('parcel-decision-posture');
    const brief = screen.getByTestId('parcel-decision-brief');
    expect(brief).toHaveTextContent('Why it surfaced');
    expect(brief).toHaveTextContent('Historical model #28');
    expect(brief).toHaveTextContent('Why it survived');
    expect(brief).toHaveTextContent('1 current gate cleared');
    expect(brief).toHaveTextContent('What remains');
    expect(brief).toHaveTextContent('1 open evidence item');
    expect(brief).toHaveTextContent(
      'NYC PLUTO/FEMA · as of July 24, 2026',
    );
    expect(brief).toHaveTextContent(
      'CityLens rolling-origin validation using NYC PLUTO and DOB filings · as of 2025',
    );
    expect(brief).not.toHaveTextContent(
      'accepted_model_bundle.rolling_validation',
    );
    expect(brief).toHaveTextContent('Next decision');
    expect(posture).toHaveTextContent('no composite confidence score');
    expect(posture).toHaveTextContent('Diligence review required before advancing');
    expect(posture).toHaveTextContent('Review 1');
    expect(posture).toHaveTextContent('Cleared 1');
    expect(posture).toHaveTextContent('not a buy/pass recommendation');
    expect(screen.getByTestId('parcel-decision-next-action')).toHaveTextContent(
      'Unlock full screen',
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Inspect evidence/i }),
    );
    expect(mocks.recordParcelProductEvent).not.toHaveBeenCalled();

    expect(screen.getByText('Eligible lead with diligence flags')).toBeInTheDocument();
    expect(screen.getByText('34.0%')).toBeInTheDocument();
    expect(screen.getByText('10.4%')).toBeInTheDocument();
    expect(screen.getByText('0.12%')).toBeInTheDocument();
    const benchmarkReceipt = screen.getByTestId(
      'historical-benchmark-receipt',
    );
    expect(benchmarkReceipt).toHaveTextContent(
      '2024 features → 2025 DOB filings',
    );
    expect(screen.getByText(/34\/100 hits/)).toBeInTheDocument();
    expect(screen.getByText(/104\/1,000 hits/)).toBeInTheDocument();
    expect(benchmarkReceipt).toHaveTextContent('Development-exposed evidence');
    expect(benchmarkReceipt).toHaveTextContent('spatial dependence');
    const boroughCohort = screen.getByTestId(
      'historical-borough-cohort',
    );
    expect(boroughCohort).toHaveTextContent('Brooklyn historical cohort');
    expect(boroughCohort).toHaveTextContent('10/100');
    expect(boroughCohort).toHaveTextContent('95% 5.5%–17.4%');
    expect(boroughCohort).toHaveTextContent(
      'not this parcel’s probability, current accuracy, seller intent, or acquisition outcome',
    );
    expect(screen.getByText('Citywide historical filing benchmark')).toBeInTheDocument();
    expect(screen.getByText('Model input')).toBeInTheDocument();
    expect(screen.getByText('Eligibility gate')).toBeInTheDocument();
    expect(screen.getByText('Diligence only · no rank effect')).toBeInTheDocument();
    expect(screen.getByText(/not seller intent/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to add private notes/i)).toBeInTheDocument();
    expect(
      screen.getByTestId('parcel-decision-readiness'),
    ).toHaveTextContent('Diligence review required before advancing');
    expect(screen.getByTestId('parcel-decision-readiness')).toHaveTextContent(
      'Review floodplain exposure',
    );
    expect(screen.getByTestId('parcel-decision-readiness')).toHaveTextContent(
      'not a purchase recommendation',
    );
  });

  it('fails conservative when an older decision audit has no atomic checks', () => {
    const brief = buildParcelDecisionBrief({
      ...parcel,
      decision_audit: {
        schema_version: 'citylens/parcel-decision-audit@v1',
        overall_status: 'incomplete',
        overall_label: 'Evidence incomplete',
        readiness: {
          status: 'incomplete',
          label: 'Evidence incomplete',
          recommended_action:
            'Reload the cited source evidence before advancing.',
          blockers: [],
          review_items: [],
          cleared_items: [],
          disclaimer: 'Not a purchase recommendation.',
        },
        validation: {
          target: 'dob_nb_job_filing',
          evaluation_scope: 'Historical cohort only',
          precision_at_100: null,
          precision_at_1000: null,
          base_rate: null,
          prospective_validated: false,
          disclaimer: 'No parcel probability.',
        },
        checks: [],
        limitations: [],
      },
    });

    expect(brief).not.toBeNull();
    expect(brief?.lanes.find((lane) => lane.key === 'eligibility')).toMatchObject(
      {
        headline: 'Evidence incomplete',
        tone: 'slate',
      },
    );
    expect(
      brief?.lanes.find((lane) => lane.key === 'open_questions'),
    ).toMatchObject({
      headline: 'Evidence review required',
      detail: 'Reload the cited source evidence before advancing.',
      tone: 'amber',
    });
    expect(JSON.stringify(brief)).not.toContain('0 current gates cleared');
  });

  it('keeps diligence blockers separate from a cleared acquisition gate', () => {
    const brief = buildParcelDecisionBrief({
      ...parcel,
      acquisition_eligible: true,
      decision_audit: {
        schema_version: 'citylens/parcel-decision-audit@v1',
        overall_status: 'screened_with_flags',
        overall_label: 'Eligible lead with a diligence blocker',
        readiness: {
          status: 'blocked',
          label: 'Resolve the blocker before advancing',
          recommended_action: 'Verify the current environmental instrument.',
          blockers: ['Environmental review is unresolved.'],
          review_items: [],
          cleared_items: ['Current acquisition gate passed.'],
          disclaimer: 'Not a purchase recommendation.',
        },
        validation: {
          target: 'dob_nb_job_filing',
          evaluation_scope: 'Historical cohort only',
          precision_at_100: null,
          precision_at_1000: null,
          base_rate: null,
          prospective_validated: false,
          disclaimer: 'No parcel probability.',
        },
        checks: [
          {
            key: 'acquisition_eligibility',
            layer: 'eligibility_gate',
            label: 'Current acquisition gate',
            status: 'verified',
            summary: 'The deterministic publication gate passed.',
            source: 'CityLens acquisition policy',
            as_of: '2026-07-26',
            affects_model_rank: false,
            affects_acquisition_eligibility: true,
          },
          {
            key: 'current_diligence',
            layer: 'current_diligence',
            label: 'Environmental review',
            status: 'excluded',
            summary: 'An environmental instrument requires review.',
            source: 'NYC PLUTO',
            as_of: '2026-07-26',
            affects_model_rank: false,
            affects_acquisition_eligibility: false,
          },
        ],
        limitations: [],
      },
    });

    expect(brief?.lanes.find((lane) => lane.key === 'eligibility')).toMatchObject(
      {
        headline: '1 current gate cleared',
        tone: 'emerald',
      },
    );
    expect(
      brief?.lanes.find((lane) => lane.key === 'open_questions'),
    ).toMatchObject({
      headline: '1 open evidence item',
      detail: 'Environmental review is unresolved.',
      tone: 'rose',
    });
  });

  it('records one value-minimized decision-audit entry per parcel', async () => {
    mocks.authStatus = 'authenticated';
    const row = {
      ...parcel,
      bbl: '3050660024',
      decision_audit: {
        schema_version: 'citylens/parcel-decision-audit@v1' as const,
        overall_status: 'screened' as const,
        overall_label: 'Initial review ready',
        readiness: {
          status: 'initial_review_ready' as const,
          label: 'Initial review ready',
          recommended_action: 'Review the source records before advancing.',
          blockers: [],
          review_items: [],
          cleared_items: ['Current acquisition gate passed.'],
          disclaimer: 'Not a purchase recommendation.',
        },
        validation: {
          target: 'dob_nb_job_filing',
          evaluation_scope: '2024 PLUTO to 2025 DOB NB filings',
          precision_at_100: 0.34,
          precision_at_1000: 0.104,
          base_rate: 0.0012439591,
          prospective_validated: false,
          disclaimer: 'Historical performance only.',
        },
        checks: [],
        limitations: [],
      },
    };
    const { rerender } = render(
      <ParcelIntelPropertyPanel row={row} onClose={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Inspect evidence/i }),
    );
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
        'decision_audit_opened',
        'decision_posture',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Audit' }));
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(1);

    rerender(
      <ParcelIntelPropertyPanel
        row={{ ...row, bbl: '3050660025', decision_audit: undefined }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Audit' }));
    await waitFor(() =>
      expect(mocks.recordParcelProductEvent).toHaveBeenLastCalledWith(
        'decision_audit_opened',
        'audit_tab',
      ),
    );
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mocks.recordParcelProductEvent.mock.calls)).not.toMatch(
      /3050660024|3050660025|address|owner|notes/i,
    );
  });

  it('opens the governed workflow from the decision brief when signed in', () => {
    mocks.authStatus = 'authenticated';
    mocks.getParcelWorkflow.mockReturnValue(new Promise(() => {}));
    render(
      <ParcelIntelPropertyPanel
        row={{
          ...parcel,
          decision_audit: {
            schema_version: 'citylens/parcel-decision-audit@v1',
            overall_status: 'screened',
            overall_label: 'Eligible lead after current gates',
            readiness: {
              status: 'initial_review_ready',
              label: 'Ready for an initial acquisition review',
              recommended_action:
                'Verify the linked official records, then assign an owner/title review.',
              blockers: [],
              review_items: [],
              cleared_items: ['Current acquisition gate passed.'],
              disclaimer: 'Not a purchase recommendation.',
            },
            validation: {
              target: 'dob_nb_job_filing',
              evaluation_scope: 'Historical cohort only',
              precision_at_100: null,
              precision_at_1000: null,
              base_rate: null,
              prospective_validated: false,
              disclaimer: 'No parcel probability.',
            },
            checks: [],
            limitations: [],
          },
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('parcel-decision-next-action'));
    expect(
      screen.getByText('Checking pipeline status…'),
    ).toBeInTheDocument();
  });

  it('does not emit city-system links for malformed BBLs', () => {
    expect(externalParcelLinks({ ...parcel, bbl: 'bad', lat: null, lng: null })).toEqual([]);
  });
});
