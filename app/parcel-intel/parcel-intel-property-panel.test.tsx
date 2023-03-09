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

  it('does not emit city-system links for malformed BBLs', () => {
    expect(externalParcelLinks({ ...parcel, bbl: 'bad', lat: null, lng: null })).toEqual([]);
  });
});
