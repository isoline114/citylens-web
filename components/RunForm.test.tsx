import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createRun: vi.fn(),
  getFeaturedDemos: vi.fn(),
  rememberRecentRun: vi.fn(),
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
    getApiKey: () => 'test-key',
    rememberRecentRun: mocks.rememberRecentRun,
  };
});

import { RunForm } from '@/components/RunForm';

beforeEach(() => {
  mocks.push.mockReset();
  mocks.createRun.mockReset();
  mocks.getFeaturedDemos.mockReset();
  mocks.rememberRecentRun.mockReset();
  mocks.createRun.mockResolvedValue({ runId: 'run-123', raw: { run_id: 'run-123' } });
  mocks.getFeaturedDemos.mockResolvedValue([]);
});

describe('RunForm', () => {
  it('uses a sam2-only contract and submits a run payload', async () => {
    const user = userEvent.setup();
    render(<RunForm />);

    expect(screen.getByText('SAM2 only')).toBeInTheDocument();
    expect(screen.queryByText('unet')).not.toBeInTheDocument();
    expect(screen.queryByText('smp')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Address'), '350 5th Ave, New York, NY');
    await user.click(screen.getByRole('button', { name: 'Create run' }));

    await waitFor(() => expect(mocks.createRun).toHaveBeenCalled());
    expect(mocks.createRun.mock.calls[0]?.[0]).toMatchObject({
      address: '350 5th Ave, New York, NY',
      segmentation_backend: 'sam2',
      aoi_radius_m: 250,
    });
    expect(mocks.rememberRecentRun).toHaveBeenCalledWith('run-123');
    expect(mocks.push).toHaveBeenCalledWith('/runs/run-123');
  });
});
