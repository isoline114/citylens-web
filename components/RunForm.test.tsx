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
  mocks.getFeaturedDemos.mockResolvedValue([]);
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

  it('shows a sign-in CTA when unauthenticated and does not call createRun', async () => {
    mocks.authState.status = 'unauthenticated';
    mocks.authState.user = null;

    render(<RunForm />);
    expect(screen.getByRole('link', { name: 'Sign in to create a run' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create run' })).not.toBeInTheDocument();
    expect(mocks.createRun).not.toHaveBeenCalled();
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
    // The public payload must NOT include aoi_radius_m or sam2_*; the server injects them.
    expect(mocks.createRun.mock.calls[0]?.[0]).not.toHaveProperty('aoi_radius_m');
    expect(mocks.createRun.mock.calls[0]?.[0]).not.toHaveProperty('sam2_cfg');
    expect(mocks.rememberRecentRun).toHaveBeenCalledWith('run-123');
    expect(mocks.push).toHaveBeenCalledWith('/runs/run-123');
  });
});
