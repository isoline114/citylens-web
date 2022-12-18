import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchFeaturedDemosOnServer: vi.fn(),
}));

vi.mock('@/components/RunForm', () => ({
  RunForm: () => <div data-testid="run-form">Run form</div>,
}));

vi.mock('@/lib/api.server', () => ({
  fetchFeaturedDemosOnServer: mocks.fetchFeaturedDemosOnServer,
}));

import HomePage from './page';

beforeEach(() => {
  mocks.fetchFeaturedDemosOnServer.mockReset();
});

describe('HomePage', () => {
  it('renders the outcome-oriented hero copy and the real-output panel', async () => {
    mocks.fetchFeaturedDemosOnServer.mockResolvedValueOnce([
      { run_id: 'demo-1', label: 'Brooklyn brownstones', address: '100 E 21st St' },
      { run_id: 'demo-2', label: 'Hudson Yards' },
    ]);

    // HomePage is an async Server Component; resolve its element tree first.
    const tree = await HomePage();
    render(tree);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Building-level urban change detection/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /view featured demo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a run' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /api docs/i })).toBeInTheDocument();

    expect(screen.getByText(/NYC, 5 boroughs/i)).toBeInTheDocument();

    // "What you get per run" — real-output panel
    expect(
      screen.getByRole('heading', { level: 2, name: /what you get per run/i }),
    ).toBeInTheDocument();
    // Per-class counts from the Brooklyn demo render as semantic text.
    // The same labels appear in the hero legend, so scope by count.
    expect(screen.getAllByText('unchanged').length).toBeGreaterThan(0);
    expect(screen.getAllByText('demolished').length).toBeGreaterThan(0);

    const demoCards = screen.getAllByTestId('featured-demo-card');
    expect(demoCards.length).toBeGreaterThan(0);

    expect(screen.getByTestId('run-form')).toBeInTheDocument();
  });

  it('omits the "View featured demo" CTA gracefully when no demos load', async () => {
    mocks.fetchFeaturedDemosOnServer.mockResolvedValueOnce([]);

    const tree = await HomePage();
    render(tree);

    expect(screen.queryByRole('link', { name: /view featured demo/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/no featured demos found/i)).not.toBeInTheDocument();
  });
});
