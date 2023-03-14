import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    status: 'unauthenticated' as 'unauthenticated' | 'authenticated' | 'loading',
    user: null as { id: string; email: string | null } | null,
  },
  getRuns: vi.fn(),
  getRecentRuns: vi.fn(),
  forgetRecentRuns: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    signIn: () => undefined,
    signOut: () => undefined,
    getAccessToken: async () => null,
  }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, getRuns: mocks.getRuns };
});

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return {
    ...actual,
    getRecentRuns: mocks.getRecentRuns,
    forgetRecentRuns: mocks.forgetRecentRuns,
  };
});

import RunsPage from './page';

beforeEach(() => {
  mocks.getRuns.mockReset();
  mocks.getRecentRuns.mockReset();
  mocks.forgetRecentRuns.mockReset();
  mocks.getRecentRuns.mockReturnValue([]);
  mocks.forgetRecentRuns.mockReturnValue(0);
  mocks.authState.status = 'unauthenticated';
  mocks.authState.user = null;
});

describe('/runs (signed out)', () => {
  it('leads with sign-in / sign-up / featured-demos CTAs', () => {
    render(<RunsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /^runs$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to continue' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fruns',
    );
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore a public demo' })).toBeInTheDocument();
  });

  it('does not call /v1/runs while signed out', () => {
    render(<RunsPage />);
    expect(mocks.getRuns).not.toHaveBeenCalled();
  });

  it('does not render any localStorage-derived run rows', () => {
    mocks.getRecentRuns.mockReturnValue([
      { runId: 'old-run-1', createdAtMs: 1700000000000, lastKnownStatus: 'succeeded' },
    ]);
    render(<RunsPage />);
    expect(screen.queryByText('old-run-1')).not.toBeInTheDocument();
    expect(screen.queryByText(/Browser-local run history/i)).not.toBeInTheDocument();
  });
});

describe('/runs (signed in, empty)', () => {
  beforeEach(() => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u-test', email: 't@example.com' };
  });

  it('shows a clean empty-state with a primary "Create a run" CTA', async () => {
    mocks.getRuns.mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<RunsPage />);

    await screen.findByText(/Create your first evidence package/i);
    expect(screen.getByRole('link', { name: 'Create a run' })).toBeInTheDocument();
  });

  it('clears stale localStorage recent-runs on mount (one-time backfill)', async () => {
    mocks.getRecentRuns.mockReturnValue([
      { runId: 'stale-1', createdAtMs: 1, lastKnownStatus: 'succeeded' },
      { runId: 'stale-2', createdAtMs: 2, lastKnownStatus: 'failed' },
    ]);
    mocks.getRuns.mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<RunsPage />);

    await waitFor(() => {
      expect(mocks.forgetRecentRuns).toHaveBeenCalledWith(['stale-1', 'stale-2']);
    });
  });
});

describe('/runs (signed in, with server runs)', () => {
  beforeEach(() => {
    mocks.authState.status = 'authenticated';
    mocks.authState.user = { id: 'u-test', email: 't@example.com' };
  });

  it('renders only server-returned runs, ignoring any localStorage entries', async () => {
    mocks.getRecentRuns.mockReturnValue([
      { runId: 'leaked-local', createdAtMs: 1, lastKnownStatus: 'succeeded' },
    ]);
    mocks.getRuns.mockResolvedValueOnce({
      items: [
        { run_id: 'real-server-1', status: 'succeeded', stage: 'done' },
        { run_id: 'real-server-2', status: 'failed', stage: 'failed' },
      ],
      nextCursor: null,
    });
    render(<RunsPage />);

    await screen.findByText('real-server-1');
    expect(screen.getByText('real-server-2')).toBeInTheDocument();
    expect(screen.getAllByText('Untitled processing run')).toHaveLength(2);
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
    // localStorage orphans must not bleed into the rendered list
    expect(screen.queryByText('leaked-local')).not.toBeInTheDocument();
    // Stage line is only rendered when stage is present (no `source: …` fallback)
    expect(screen.queryByText(/source: local/i)).not.toBeInTheDocument();
  });
});
