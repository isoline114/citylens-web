import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as
    | 'loading'
    | 'unauthenticated'
    | 'authenticated',
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    status: mocks.authStatus,
    user:
      mocks.authStatus === 'authenticated'
        ? { id: 'operator', email: 'operator@example.test' }
        : null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(),
  }),
}));

vi.mock('@/components/RunForm', () => ({
  RunForm: ({
    showFeaturedDemos,
    submitLabel,
    initialAddress,
  }: {
    showFeaturedDemos?: boolean;
    submitLabel?: string;
    initialAddress?: string;
  }) => (
    <div
      data-testid="run-form-stub"
      data-show-featured={String(showFeaturedDemos)}
      data-submit-label={submitLabel}
      data-initial-address={initialAddress ?? ''}
    />
  ),
}));

import { NewRunWorkspace } from './new-run-workspace';
import { consumeRunPrefill, queueRunPrefill } from '@/lib/run-prefill';

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
  window.sessionStorage.clear();
});

describe('NewRunWorkspace', () => {
  it('holds the form until account access is resolved', () => {
    mocks.authStatus = 'loading';
    render(<NewRunWorkspace />);

    expect(
      screen.getByRole('status', {
        name: 'Checking run workspace access',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('run-form-stub')).not.toBeInTheDocument();
  });

  it('gates private processing with a return-to sign-in route', () => {
    render(<NewRunWorkspace />);

    expect(screen.getByTestId('new-run-access-gate')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sign in to continue' }),
    ).toHaveAttribute('href', '/sign-in?next=%2Fruns%2Fnew');
    expect(
      screen.getByRole('link', { name: 'Review a public evidence package' }),
    ).toHaveAttribute('href', '/runs#public-evidence');
    expect(screen.getByText('Imagery')).toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
    expect(screen.getByText('3D massing')).toBeInTheDocument();
    expect(screen.getByText('QA receipt')).toBeInTheDocument();
    expect(screen.queryByTestId('run-form-stub')).not.toBeInTheDocument();
  });

  it('preserves a pending parcel handoff while the user is signed out', () => {
    queueRunPrefill({
      address: '224 Clarkson Avenue',
      bbl: '3050660023',
    });

    render(<NewRunWorkspace />);

    expect(screen.getByTestId('new-run-access-gate')).toBeInTheDocument();
    expect(consumeRunPrefill()).toMatchObject({
      address: '224 Clarkson Avenue',
      bbl: '3050660023',
    });
  });

  it('renders the focused account processing request', () => {
    mocks.authStatus = 'authenticated';
    render(<NewRunWorkspace />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Start a new run',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('run-form-stub')).toHaveAttribute(
      'data-show-featured',
      'false',
    );
    expect(screen.getByTestId('run-form-stub')).toHaveAttribute(
      'data-submit-label',
      'Start processing',
    );
    expect(screen.getByText('QA receipt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute(
      'href',
      '/runs',
    );
  });

  it('receives a parcel handoff without exposing it in the route', async () => {
    mocks.authStatus = 'authenticated';
    queueRunPrefill({
      address: '224 Clarkson Avenue',
      bbl: '3050660023',
    });

    render(<NewRunWorkspace />);

    await waitFor(() =>
      expect(screen.getByTestId('run-form-stub')).toHaveAttribute(
        'data-initial-address',
        '224 Clarkson Avenue',
      ),
    );
    const receipt = screen.getByTestId('parcel-run-prefill-receipt');
    expect(receipt).toHaveTextContent('BBL 3050660023');
    expect(receipt).toHaveTextContent('224 Clarkson Avenue');
    expect(window.location.search).toBe('');
  });
});
