import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authStatus: 'unauthenticated' as
    | 'loading'
    | 'unauthenticated'
    | 'authenticated',
  searchValue: null as string | null,
  swrResult: {
    data: undefined as Record<string, unknown> | undefined,
    error: undefined as unknown,
    isLoading: false,
    mutate: vi.fn(),
  },
  getDemoRun: vi.fn(),
  getRun: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ runId: 'private-run-123' }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'demo' ? mocks.searchValue : null),
  }),
}));

vi.mock('swr', () => ({
  default: vi.fn(() => mocks.swrResult),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    status: mocks.authStatus,
    user: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(),
  }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getDemoRun: mocks.getDemoRun,
    getRun: mocks.getRun,
  };
});

vi.mock('@/components/RunStatusCard', () => ({
  RunStatusCard: () => <div data-testid="status-card" />,
}));

vi.mock('@/components/ArtifactsPanel', () => ({
  ArtifactsPanel: () => <div data-testid="artifacts-panel" />,
}));

import RunDetailPage from './page';

beforeEach(() => {
  mocks.authStatus = 'unauthenticated';
  mocks.searchValue = null;
  mocks.swrResult.data = undefined;
  mocks.swrResult.error = undefined;
  mocks.swrResult.isLoading = false;
  mocks.swrResult.mutate.mockReset();
  mocks.getDemoRun.mockReset();
  mocks.getRun.mockReset();
});

describe('run detail access and output states', () => {
  it('gates a private deep link instead of treating it as a missing demo', () => {
    render(<RunDetailPage />);

    expect(screen.getByTestId('private-run-access-gate')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sign in to continue' }),
    ).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fruns%2Fprivate-run-123',
    );
    expect(screen.queryByTestId('status-card')).not.toBeInTheDocument();
  });

  it('shows an explicit pending-output state for active work', () => {
    mocks.authStatus = 'authenticated';
    mocks.swrResult.data = {
      run_id: 'private-run-123',
      status: 'running',
      stage: 'segment',
      progress: 38,
      request: { address: '100 E 21st St, Brooklyn' },
    };

    render(<RunDetailPage />);

    expect(
      screen.getByRole('heading', { name: '100 E 21st St, Brooklyn' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('artifacts-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('artifacts-panel')).not.toBeInTheDocument();
  });

  it('does not render four empty artifact viewers after failure', () => {
    mocks.authStatus = 'authenticated';
    mocks.swrResult.data = {
      run_id: 'private-run-123',
      status: 'failed',
      stage: 'fetch_inputs',
      progress: 4,
    };

    render(<RunDetailPage />);

    expect(screen.getByTestId('artifacts-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('artifacts-panel')).not.toBeInTheDocument();
  });

  it('renders the artifact workspace when outputs were published', () => {
    mocks.searchValue = '1';
    mocks.swrResult.data = {
      run_id: 'private-run-123',
      status: 'succeeded',
      progress: 100,
      artifacts: [{ name: 'preview.png', signed_url: '/preview.png' }],
    };

    render(<RunDetailPage />);

    expect(screen.getByText('Public demo')).toBeInTheDocument();
    expect(screen.getByTestId('artifacts-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('artifacts-unavailable')).not.toBeInTheDocument();
  });
});
