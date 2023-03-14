import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  status: 'unauthenticated' as
    | 'unauthenticated'
    | 'authenticated'
    | 'loading',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    status: mocks.status,
    user: null,
    signIn: () => undefined,
    signOut: () => undefined,
    getAccessToken: async () => null,
  }),
}));

import { DemoModeBanner } from './DemoModeBanner';

describe('DemoModeBanner', () => {
  beforeEach(() => {
    mocks.pathname = '/';
    mocks.status = 'unauthenticated';
  });

  it('describes precomputed reconstruction mode on the reconstruction product', () => {
    render(<DemoModeBanner />);

    expect(screen.getByText(/demo mode \(precomputed\)/i)).toBeVisible();
  });

  it('does not mislabel Parcel Intelligence as a precomputed demo', () => {
    mocks.pathname = '/parcel-intel';

    render(<DemoModeBanner />);

    expect(screen.queryByText(/demo mode \(precomputed\)/i)).not.toBeInTheDocument();
  });

  it('stays hidden for legacy Parcel Intelligence child routes', () => {
    mocks.pathname = '/parcel-intel/queens';

    render(<DemoModeBanner />);

    expect(screen.queryByText(/demo mode \(precomputed\)/i)).not.toBeInTheDocument();
  });

  it.each(['/pricing', '/docs', '/contact', '/account/api-keys'])(
    'does not put reconstruction-demo messaging on %s',
    (pathname) => {
      mocks.pathname = pathname;

      render(<DemoModeBanner />);

      expect(
        screen.queryByText(/demo mode \(precomputed\)/i),
      ).not.toBeInTheDocument();
    },
  );

  it('keeps demo context on a public run detail', () => {
    mocks.pathname = '/runs/demo-brooklyn-reference';

    render(<DemoModeBanner />);

    expect(screen.getByText(/demo mode \(precomputed\)/i)).toBeVisible();
  });
});
