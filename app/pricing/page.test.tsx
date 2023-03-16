import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PricingPage from './page';

describe('/pricing', () => {
  it('presents the free, acquisitions, and concierge progression', () => {
    render(<PricingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Pay for a better acquisition process—not another database.',
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
    expect(screen.getByText('Full 5,000-lead citywide workspace')).toBeVisible();
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
