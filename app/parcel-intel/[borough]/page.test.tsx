import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

import BoroughParcelIntelPage from './page';

beforeEach(() => {
  mocks.redirect.mockReset();
  mocks.notFound.mockClear();
});

describe('legacy borough parcel routes', () => {
  it('redirects borough and parcel deep links into the canonical explorer', async () => {
    await BoroughParcelIntelPage({
      params: Promise.resolve({ borough: 'queens' }),
      searchParams: Promise.resolve({ bbl: '4093500029' }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/parcel-intel?borough=queens&bbl=4093500029',
    );
  });

  it('retains a not-found response for invalid borough slugs', async () => {
    await expect(
      BoroughParcelIntelPage({
        params: Promise.resolve({ borough: 'not-a-borough' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('not-found');
  });
});
