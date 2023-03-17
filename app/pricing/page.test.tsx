import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PricingPage from './page';

describe('/pricing', () => {
  it('presents the free, acquisitions, and concierge progression', () => {
    render(<PricingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Explore the full market free. Pay for hands-on leverage.',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Explorer' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Acquisitions pilot' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Concierge team pilot' }),
    ).toBeVisible();
    const explorer = screen
      .getByRole('heading', { name: 'Explorer' })
      .closest('article');
    expect(explorer).not.toBeNull();
    expect(
      within(explorer as HTMLElement).getByText(
        'Full 5,000-lead citywide workspace',
      ),
    ).toBeVisible();
    expect(
      within(explorer as HTMLElement).getByText(
        '5 custom imagery runs per month',
      ),
    ).toBeVisible();
    expect(
      within(explorer as HTMLElement).getByRole('link', {
        name: /Create an account/i,
      }),
    ).toHaveAttribute('href', '/sign-up?next=%2Fparcel-intel');
    expect(
      screen.getByText(
        /Every verified account includes the full 5,000-lead citywide workspace/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Request pilot access/i }),
    ).toHaveAttribute('href', '/contact?plan=acquisitions');
  });

  it('keeps pricing informational rather than presenting an automated checkout', () => {
    render(<PricingPage />);

    expect(screen.getByText(/not an automated checkout/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /buy|checkout|subscribe/i }))
      .not.toBeInTheDocument();
  });
});
