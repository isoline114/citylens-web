import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelScreeningStatus } from '@/lib/api';
import {
  canonicalParcelBbl,
  ParcelScreeningLookup,
} from './parcel-screening-lookup';

const mocks = vi.hoisted(() => ({
  getParcelScreeningStatus: vi.fn(),
  recordParcelProductEvent: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelScreeningStatus: mocks.getParcelScreeningStatus,
    recordParcelProductEvent: mocks.recordParcelProductEvent,
  };
});

function receipt(
  overrides: Partial<ParcelScreeningStatus> = {},
): ParcelScreeningStatus {
  return {
    schema_version: 'citylens/parcel-screening-status@v1',
    bbl: '3058920038',
    borough: 'brooklyn',
    result: 'screened_out',
    evaluated: true,
    published: false,
    acquisition_eligible: false,
    acquisition_status: 'active_project',
    exclusion_reasons: ['approved_land_use_project'],
    latest_project_filing_year: 2023,
    latest_project_status: 'Approved',
    latest_project_type: 'land_use_entitlement',
    latest_project_job_number: '2023K0205',
    latest_project_url:
      'https://zap.planning.nyc.gov/projects/2023K0205',
    property_facts_as_of: '2026-07-19',
    ownership_as_of: '2026-07-15',
    project_activity_as_of: '2026-07-19',
    land_use_activity_as_of: '2026-07-25',
    feed_generation: 'generation-1',
    feed_generated_at: '2026-07-26T18:00:00Z',
    interpretation:
      'This parcel was evaluated but excluded from the acquisition inventory.',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getParcelScreeningStatus.mockReset();
  mocks.recordParcelProductEvent.mockReset();
  mocks.recordParcelProductEvent.mockResolvedValue(undefined);
});

describe('canonicalParcelBbl', () => {
  it('accepts canonical BBLs with harmless separators only', () => {
    expect(canonicalParcelBbl('3058920038')).toBe('3058920038');
    expect(canonicalParcelBbl('3-05892-0038')).toBe('3058920038');
    expect(canonicalParcelBbl('3058920038 owner')).toBeNull();
    expect(canonicalParcelBbl('999')).toBeNull();
  });
});

describe('ParcelScreeningLookup', () => {
  it('keeps the private screening receipt behind sign-in', () => {
    render(
      <ParcelScreeningLookup bbl="3058920038" isAuthenticated={false} />,
    );

    expect(
      screen.getByText(/not in this public preview/i),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /sign in to inspect/i }),
    ).toHaveAttribute('href', '/sign-in?next=%2Fparcel-intel');
    expect(mocks.getParcelScreeningStatus).not.toHaveBeenCalled();
  });

  it('explains a source-backed exclusion without leaking model rank', async () => {
    mocks.getParcelScreeningStatus.mockResolvedValue(receipt());
    const user = userEvent.setup();
    render(
      <ParcelScreeningLookup bbl="3058920038" isAuthenticated />,
    );

    await user.click(
      screen.getByRole('button', { name: /check current screening/i }),
    );

    const result = await screen.findByTestId('parcel-screening-receipt');
    expect(result).toHaveTextContent(
      'Excluded from the current acquisition inventory',
    );
    expect(result).toHaveTextContent('Approved land-use project');
    expect(result).toHaveTextContent('2023K0205');
    expect(
      screen.getByRole('link', { name: /open official record/i }),
    ).toHaveAttribute(
      'href',
      'https://zap.planning.nyc.gov/projects/2023K0205',
    );
    expect(result).not.toHaveTextContent(/rank|score/i);
    expect(mocks.recordParcelProductEvent).toHaveBeenCalledWith(
      'screening_lookup_completed',
      'screening_lookup',
    );
  });

  it.each([
    [
      'qualified_below_cutoff',
      'This parcel passed screening but is outside the top 5,000',
    ],
    ['not_evaluated', 'Outside the current candidate ledger'],
  ] as const)('renders the %s result explicitly', async (result, title) => {
    mocks.getParcelScreeningStatus.mockResolvedValue(
      receipt({
        result,
        evaluated: result !== 'not_evaluated',
        acquisition_eligible:
          result === 'qualified_below_cutoff' ? true : null,
        acquisition_status:
          result === 'qualified_below_cutoff' ? 'eligible' : null,
        exclusion_reasons: [],
        latest_project_job_number: null,
        latest_project_url: null,
      }),
    );
    const user = userEvent.setup();
    render(
      <ParcelScreeningLookup bbl="3058920038" isAuthenticated />,
    );

    await user.click(
      screen.getByRole('button', { name: /check current screening/i }),
    );

    expect(await screen.findByText(title)).toBeVisible();
  });

  it('supports a visible retry when the receipt cannot load', async () => {
    mocks.getParcelScreeningStatus.mockRejectedValueOnce(
      new Error('Screening ledger unavailable'),
    );
    mocks.getParcelScreeningStatus.mockResolvedValueOnce(receipt());
    const user = userEvent.setup();
    render(
      <ParcelScreeningLookup bbl="3058920038" isAuthenticated />,
    );

    await user.click(
      screen.getByRole('button', { name: /check current screening/i }),
    );
    expect(
      await screen.findByText('Screening ledger unavailable'),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /retry screening check/i }),
    );
    expect(
      await screen.findByText(
        'Excluded from the current acquisition inventory',
      ),
    ).toBeVisible();
  });
});
