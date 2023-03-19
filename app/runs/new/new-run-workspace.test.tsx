import { render, screen } from '@testing-library/react';
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
  }: {
    showFeaturedDemos?: boolean;
    submitLabel?: string;
  }) => (
    <div
      data-testid="run-form-stub"
      data-show-featured={String(showFeaturedDemos)}
      data-submit-label={submitLabel}
    />
  ),
}));

import { NewRunWorkspace } from './new-run-workspace';

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
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
});
