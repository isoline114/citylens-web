import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParcelAddressResolution } from '@/lib/api';
import { ParcelAddressResolver } from './parcel-address-resolver';

const mocks = vi.hoisted(() => ({
  resolveParcelAddress: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    resolveParcelAddress: mocks.resolveParcelAddress,
  };
});

vi.mock('./parcel-screening-lookup', () => ({
  ParcelScreeningLookup: ({ bbl }: { bbl: string }) => (
    <div data-testid="screening-stub">Screening {bbl}</div>
  ),
}));

vi.mock('./parcel-official-dossier', () => ({
  ParcelOfficialDossierPanel: ({ bbl }: { bbl: string }) => (
    <div data-testid="official-dossier-stub">Dossier {bbl}</div>
  ),
}));

function resolution(
  overrides: Partial<ParcelAddressResolution> = {},
): ParcelAddressResolution {
  return {
    schema_version: 'citylens/parcel-address-resolve-response@v1',
    match_status: 'unique',
    match_method: 'exact_normalized_official_address',
    candidate_count: 1,
    truncated: false,
    candidates: [{ bbl: '3058920038', borough: 'brooklyn' }],
    unit_designator_ignored: false,
    locality_ignored: true,
    source_name: 'NYC Property Address Directory with PLUTO fallback',
    source_dataset_id: 'bc8t-ecyu',
    source_retrieved_at: '2026-07-26T23:37:33Z',
    resolver_generation: '20260727T000234316462Z-1824ab6b25f2',
    address_normalization_schema: 'citylens/address-normalization@v1',
    interpretation: 'One official tax lot matched.',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.resolveParcelAddress.mockReset();
});

describe('ParcelAddressResolver', () => {
  it('resolves a unique official address and prepares its screening receipt', async () => {
    mocks.resolveParcelAddress.mockResolvedValue(resolution());
    const user = userEvent.setup();
    render(
      <ParcelAddressResolver address="464 Ovington Ave, Brooklyn, NY" />,
    );

    expect(screen.getByText(/complete NYC address directory/i)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /resolve official tax lots/i }),
    );

    expect(await screen.findByText('One official tax lot found')).toBeVisible();
    expect(screen.getByText('3058920038')).toBeVisible();
    expect(screen.getByText(/NYC PAD · Jul 26, 2026/i)).toBeVisible();
    expect(screen.getByTestId('screening-stub')).toHaveTextContent(
      'Screening 3058920038',
    );
    expect(screen.getByTestId('official-dossier-stub')).toHaveTextContent(
      'Dossier 3058920038',
    );
    expect(mocks.resolveParcelAddress).toHaveBeenCalledWith(
      '464 Ovington Ave, Brooklyn, NY',
    );
  });

  it('preserves ambiguity until the user chooses a BBL', async () => {
    mocks.resolveParcelAddress.mockResolvedValue(
      resolution({
        match_status: 'ambiguous',
        candidate_count: 2,
        candidates: [
          { bbl: '3058920038', borough: 'brooklyn' },
          { bbl: '3058920039', borough: 'brooklyn' },
        ],
        interpretation:
          'The official directory maps this address to two tax lots.',
      }),
    );
    const user = userEvent.setup();
    render(<ParcelAddressResolver address="464 Ovington Avenue" />);

    await user.click(
      screen.getByRole('button', { name: /resolve official tax lots/i }),
    );

    expect(
      await screen.findByText('2 official tax lots share this address'),
    ).toBeVisible();
    expect(screen.queryByTestId('screening-stub')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /3058920039/i }));
    expect(screen.getByTestId('screening-stub')).toHaveTextContent(
      'Screening 3058920039',
    );
    expect(screen.getByTestId('official-dossier-stub')).toHaveTextContent(
      'Dossier 3058920039',
    );
  });

  it('reports not-found without fabricating a nearby parcel', async () => {
    mocks.resolveParcelAddress.mockResolvedValue(
      resolution({
        match_status: 'not_found',
        candidate_count: 0,
        candidates: [],
        interpretation:
          'No exact match was found; CityLens did not substitute another address.',
      }),
    );
    const user = userEvent.setup();
    render(<ParcelAddressResolver address="999 Missing Street" />);

    await user.click(
      screen.getByRole('button', { name: /resolve official tax lots/i }),
    );

    expect(
      await screen.findByText('No exact official tax-lot match'),
    ).toBeVisible();
    expect(screen.getByText(/did not substitute/i)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /verify in NYC ZoLa/i }),
    ).toHaveAttribute('href', 'https://zola.planning.nyc.gov/');
    expect(screen.queryByTestId('screening-stub')).not.toBeInTheDocument();
  });

  it('offers a stable retry after an API failure', async () => {
    mocks.resolveParcelAddress.mockRejectedValueOnce(
      new Error('Resolver temporarily unavailable'),
    );
    mocks.resolveParcelAddress.mockResolvedValueOnce(resolution());
    const user = userEvent.setup();
    render(<ParcelAddressResolver address="464 Ovington Avenue" />);

    await user.click(
      screen.getByRole('button', { name: /resolve official tax lots/i }),
    );
    expect(
      await screen.findByText('Resolver temporarily unavailable'),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /retry official lookup/i }),
    );
    expect(await screen.findByText('One official tax lot found')).toBeVisible();
  });
});
