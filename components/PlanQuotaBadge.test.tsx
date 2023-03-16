import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  push: vi.fn(),
  signOut: vi.fn(),
  auth: {
    status: 'authenticated' as const,
    user: {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User One',
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/parcel-intel',
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    ...mocks.auth,
    signOut: mocks.signOut,
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getMe: mocks.getMe,
  };
});

import { PlanQuotaBadge } from './PlanQuotaBadge';

describe('PlanQuotaBadge', () => {
  beforeEach(() => {
    mocks.getMe.mockReset();
    mocks.push.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue(undefined);
  });

  it('renders the verified plan receipt', async () => {
    mocks.getMe.mockResolvedValue({
      user: {
        user_id: 'user-1',
        email: 'user@example.com',
        plan_type: 'free',
        is_admin: false,
      },
      quota: {
        unlimited: false,
        runs_used: 2,
        monthly_run_limit: 5,
        runs_remaining: 3,
        period: '2026-07',
      },
    });

    render(<PlanQuotaBadge />);

    expect(await screen.findByTestId('plan-quota-badge')).toHaveTextContent(
      'Free plan: 2/5 runs this month',
    );
  });

  it('offers an explicit reconnect when the API rejects the browser credential', async () => {
    mocks.getMe.mockRejectedValue(
      new ApiError('Sign in required', { status: 401 }),
    );

    render(<PlanQuotaBadge />);

    const reconnect = await screen.findByTestId('account-data-reconnect');
    expect(reconnect).toHaveTextContent('Reconnect data');
    fireEvent.click(reconnect);

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith(
      '/sign-in?next=%2Fparcel-intel',
    );
  });

  it('does not mislabel an ordinary network failure as an expired credential', async () => {
    mocks.getMe.mockRejectedValue(new Error('Network unavailable'));

    render(<PlanQuotaBadge />);

    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledOnce());
    expect(
      screen.queryByTestId('account-data-reconnect'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('plan-quota-badge')).not.toBeInTheDocument();
  });
});
