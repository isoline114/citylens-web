import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFeaturedDemos: vi.fn(),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, getFeaturedDemos: mocks.getFeaturedDemos };
});

import { PublicDemoGallery } from '@/components/PublicDemoGallery';

beforeEach(() => {
  mocks.getFeaturedDemos.mockReset();
});

describe('PublicDemoGallery', () => {
  it('loads real API-backed demos without fabricating fallback cards', async () => {
    mocks.getFeaturedDemos.mockResolvedValueOnce([
      {
        run_id: 'real-demo-1',
        label: 'Flatbush evidence package',
        address: '100 E 21st St Brooklyn, NY 11226',
        imagery_year: 2024,
        baseline_year: 2017,
        outputs: ['preview', 'change', 'mesh', 'summary'],
      },
    ]);

    render(<PublicDemoGallery />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading real NYC runs');
    expect(await screen.findByText('Flatbush evidence package')).toBeInTheDocument();
    expect(screen.getByTestId('public-evidence-library')).toHaveAttribute('id', 'public-evidence');
    expect(screen.getAllByTestId('featured-demo-card')).toHaveLength(1);
  });

  it('shows an honest retry state when the registry is unavailable', async () => {
    mocks.getFeaturedDemos
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ run_id: 'recovered-demo', label: 'Recovered evidence package' }]);

    render(<PublicDemoGallery />);

    expect(await screen.findByText('Public evidence is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.queryByTestId('featured-demo-card')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(mocks.getFeaturedDemos).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Recovered evidence package')).toBeInTheDocument();
  });
});
