import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createRun: vi.fn(),
  getFeaturedDemos: vi.fn(),
  rememberRecentRun: vi.fn(),
  authState: {
    status: 'authenticated' as 'authenticated' | 'unauthenticated' | 'loading',
    user: { id: 'u-test', email: 'test@example.com' } as { id: string; email: string | null } | null,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    createRun: mocks.createRun,
    getFeaturedDemos: mocks.getFeaturedDemos,
  };
});

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return {
    ...actual,
    rememberRecentRun: mocks.rememberRecentRun,
  };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    signIn: () => undefined,
    signOut: () => undefined,
    getAccessToken: async () => 'tok-123',
  }),
}));

import { RunForm } from '@/components/RunForm';

beforeEach(() => {
  mocks.push.mockReset();
  mocks.createRun.mockReset();
  mocks.getFeaturedDemos.mockReset();
  mocks.rememberRecentRun.mockReset();
  mocks.createRun.mockResolvedValue({ runId: 'run-123', raw: { run_id: 'run-123' } });
  // Default to a never-resolving fetch so we can assert the loading-state
  // contract: the empty/error message must NEVER appear before the fetch
  // resolves. Individual tests can override.
  mocks.getFeaturedDemos.mockReturnValue(new Promise(() => {}));
  mocks.authState.status = 'authenticated';
  mocks.authState.user = { id: 'u-test', email: 'test@example.com' };
});

describe('RunForm', () => {
  it('renders fixed run-option chips', () => {
    render(<RunForm />);
    expect(screen.getByTestId('imagery-year-chip')).toHaveTextContent('2024');
    expect(screen.getByTestId('baseline-year-chip')).toHaveTextContent('2017');
    expect(screen.getByTestId('segmentation-chip')).toHaveTextContent('SAM2');
    expect(screen.queryByText('unet')).not.toBeInTheDocument();
  });

  it('shows sign-up + sign-in CTAs when unauthenticated and does not call createRun', () => {
    mocks.authState.status = 'unauthenticated';
    mocks.authState.user = null;

    render(<RunForm />);
    expect(screen.getByRole('link', { name: 'Sign up — free' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create run' })).not.toBeInTheDocument();
    expect(mocks.createRun).not.toHaveBeenCalled();
    // Free-account callout is visible
    expect(screen.getByText(/Free account: 5 runs\/month/i)).toBeInTheDocument();
  });

  it('submits a run and routes to its detail page when authenticated', async () => {
    const user = userEvent.setup();
    render(<RunForm />);

    await user.type(screen.getByLabelText('Address'), '350 5th Ave, New York, NY');
    await user.click(screen.getByRole('button', { name: 'Create run' }));

    await waitFor(() => expect(mocks.createRun).toHaveBeenCalled());
    expect(mocks.createRun.mock.calls[0]?.[0]).toMatchObject({
      address: '350 5th Ave, New York, NY',
      imagery_year: 2024,
      baseline_year: 2017,
      segmentation_backend: 'sam2',
    });
    expect(mocks.createRun.mock.calls[0]?.[0]).not.toHaveProperty('aoi_radius_m');
    expect(mocks.createRun.mock.calls[0]?.[0]).not.toHaveProperty('sam2_cfg');
    expect(mocks.rememberRecentRun).toHaveBeenCalledWith('run-123');
    expect(mocks.push).toHaveBeenCalledWith('/runs/run-123');
  });

  describe('featured demo states', () => {
    it('does not render the empty-state copy while the fetch is still pending', () => {
      // mocks.getFeaturedDemos default is a never-resolving Promise — the
      // demo selector should show "Loading demos…" and never the
      // crawler-hostile fallback during this window.
      render(<RunForm />);
      expect(screen.getByRole('combobox', { name: /featured demo/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Loading demos…' })).toBeInTheDocument();
      expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/No featured demos found/i)).not.toBeInTheDocument();
    });

    it('renders demo options when SSR-prefetched demos are passed in', () => {
      render(
        <RunForm
          initialFeatured={[
            { run_id: 'demo-a', label: 'Brooklyn brownstones — Flatbush', address: '100 E 21st St' },
            { run_id: 'demo-b', label: 'Manhattan mid-rise — East Village' },
          ]}
        />,
      );
      // No fetch should fire — the prop shortcut means we use what was passed.
      expect(mocks.getFeaturedDemos).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'Brooklyn brownstones — Flatbush' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Manhattan mid-rise — East Village' })).toBeInTheDocument();
    });

    it('renders product-safe error copy when the fetch rejects', async () => {
      mocks.getFeaturedDemos.mockRejectedValueOnce(new Error('boom'));
      render(<RunForm />);
      await waitFor(() =>
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument(),
      );
      // Old crawler-hostile copy must not appear
      expect(screen.queryByText(/No featured demos found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Failed to load demos/i)).not.toBeInTheDocument();
    });

    it('renders the same product-safe copy when fetch resolves to []', async () => {
      mocks.getFeaturedDemos.mockResolvedValueOnce([]);
      render(<RunForm />);
      await waitFor(() =>
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument(),
      );
    });

    it('falls back to a client-side fetch when SSR returned an empty list', async () => {
      // SSR returning [] is treated as a hint, not authoritative — could
      // mean the API was unreachable from the server during ISR. Try the
      // client path so Playwright e2e mocks still apply and so real users
      // recover when the API is reachable from the browser even if not
      // from the Next server.
      mocks.getFeaturedDemos.mockResolvedValueOnce([
        { run_id: 'fallback-1', label: 'Fallback demo' },
      ]);
      render(<RunForm initialFeatured={[]} />);
      await waitFor(() => expect(mocks.getFeaturedDemos).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('option', { name: 'Fallback demo' })).toBeInTheDocument();
    });
  });
});
