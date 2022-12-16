import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    status: 'unauthenticated' as 'unauthenticated' | 'authenticated' | 'loading',
    user: null as { id: string; email: string | null } | null,
  },
  getRuns: vi.fn(),
  getRecentRuns: vi.fn(),
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
  return { ...actual, getRecentRuns: mocks.getRecentRuns };
});

import RunsPage from './page';

beforeEach(() => {
  mocks.getRuns.mockReset();
  mocks.getRecentRuns.mockReset();
  mocks.getRecentRuns.mockReturnValue([]);
  mocks.authState.status = 'unauthenticated';
  mocks.authState.user = null;
});

describe('/runs (signed out)', () => {
  it('leads with sign-in / sign-up / featured-demos CTAs and explains the model', () => {
    render(<RunsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /your runs/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create a free account' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View featured demos' }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/public demo runs are available without sign-in/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/account runs are private to you/i),
    ).toBeInTheDocument();
  });

  it('does not call /v1/runs while signed out', () => {
    render(<RunsPage />);
    expect(mocks.getRuns).not.toHaveBeenCalled();
  });

  it('hides the local-history accordion entirely when there is no local history', () => {
    mocks.getRecentRuns.mockReturnValue([]);
    render(<RunsPage />);
    expect(screen.queryByText(/Browser-local run history/i)).not.toBeInTheDocument();
  });

  it('keeps the local-history accordion as a quiet fallback when entries exist', () => {
    mocks.getRecentRuns.mockReturnValue([
      { runId: 'old-run-1', createdAtMs: 1700000000000, lastKnownStatus: 'succeeded' },
    ]);
    render(<RunsPage />);
    // Renders inside <details>, so the summary text is what's surfaced
    expect(screen.getByText(/Browser-local run history/i)).toBeInTheDocument();
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

    // Empty-state copy fires after the (resolved) fetch completes
    await screen.findByText(/No runs yet — create your first run\./i);
    expect(screen.getByRole('link', { name: 'Create a run' })).toBeInTheDocument();
  });
});
