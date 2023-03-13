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
  it('renders the acquisition-first decision flow and deeper evidence panel', async () => {
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
        name: /Turn the whole NYC market into a defensible weekly shortlist/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /Open the NYC opportunity map/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Request a working session/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/NYC acquisition operating system · all five boroughs/i),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('acquisition-workspace-preview'),
    ).toHaveTextContent('Historical rank is a screening order—not seller intent');
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /See the market. Commit to the few/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Compare before committing')).toBeInTheDocument();
    expect(screen.getByText('Advance with a reason')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /When a parcel warrants a deeper site read/i,
      }),
    ).toBeInTheDocument();
    // Per-class counts from the Brooklyn demo render as semantic text.
    // The same labels appear in the hero legend, so scope by count.
    expect(screen.getAllByText('unchanged').length).toBeGreaterThan(0);
    expect(screen.getAllByText('demolished').length).toBeGreaterThan(0);

    const demoCards = screen.getAllByTestId('featured-demo-card');
    expect(demoCards.length).toBeGreaterThan(0);

    expect(screen.getByTestId('run-form')).toBeInTheDocument();
  });

  it('keeps the primary acquisition journey intact when no demos load', async () => {
    mocks.fetchFeaturedDemosOnServer.mockResolvedValueOnce([]);

    const tree = await HomePage();
    render(tree);

    expect(
      screen.getByRole('link', { name: /Open the NYC opportunity map/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('acquisition-workspace-preview')).toBeVisible();
    expect(screen.queryByText(/no featured demos found/i)).not.toBeInTheDocument();
  });
});
