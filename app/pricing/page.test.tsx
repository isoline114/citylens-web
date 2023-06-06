import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PricingPage from './page';

const PLAN_NAMES = ['Explorer', 'Acquisitions pilot', 'Concierge team pilot'];

describe('/pricing', () => {
  it('presents the free, acquisitions, and concierge progression as a rate card', () => {
    render(<PricingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'The full citywide workspace is free with a verified account.',
      }),
    ).toBeVisible();

    const table = screen.getByRole('table', {
      name: /CityLens plans compared/i,
    });
    const head = table.querySelector('thead') as HTMLElement;
    // Plan label column plus one header per plan.
    expect(within(head).getAllByRole('columnheader')).toHaveLength(4);
    // Two grouped sections: Data and workspace, People and support.
    expect(
      within(table).getByRole('columnheader', { name: 'Data and workspace' }),
    ).toHaveAttribute('scope', 'colgroup');
    expect(
      within(table).getByRole('columnheader', { name: 'People and support' }),
    ).toHaveAttribute('scope', 'colgroup');
    PLAN_NAMES.forEach((name) => {
      expect(
        within(table).getByRole('heading', { name }),
      ).toBeVisible();
    });
    expect(
      within(table).getByRole('rowheader', {
        name: 'Full 5,000-lead citywide workspace',
      }),
    ).toBeVisible();
    expect(
      within(table).getByRole('rowheader', {
        name: '5 custom imagery runs per month',
      }),
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: /Free/ }),
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: /\$399/ }),
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: /From \$1,500/ }),
    ).toBeVisible();
    expect(
      within(table).getByRole('link', { name: /Create an account/i }),
    ).toHaveAttribute('href', '/sign-up?next=%2Fparcel-intel');
    expect(
      within(table).getByRole('link', { name: /Request pilot access/i }),
    ).toHaveAttribute('href', '/contact?plan=acquisitions');
    expect(
      within(table).getByRole('link', { name: /Talk to CityLens/i }),
    ).toHaveAttribute('href', '/contact?plan=concierge');

    expect(
      screen.getByText(
        /Every verified account includes the full 5,000-lead citywide workspace/i,
      ),
    ).toBeVisible();
  });

  it('keeps inheritance: later plans include what Explorer includes, and unmet rows are marked not included', () => {
    render(<PricingPage />);
    const table = screen.getByRole('table', {
      name: /CityLens plans compared/i,
    });
    const row = (name: string) =>
      within(table).getByRole('rowheader', { name }).closest('tr') as HTMLElement;

    const workspace = within(row('Full 5,000-lead citywide workspace'));
    expect(workspace.getAllByText('Included')).toHaveLength(3);

    const briefs = within(row('Reviewed opportunity briefs'));
    expect(briefs.getAllByText('Not included')).toHaveLength(2);
    expect(briefs.getAllByText('Included')).toHaveLength(1);
  });

  it('renders one stacked article per plan for narrow screens with the same links', () => {
    render(<PricingPage />);

    PLAN_NAMES.forEach((name) => {
      const article = screen.getByRole('article', { name: `${name} plan` });
      expect(
        within(article).getByRole('heading', { level: 2, name }),
      ).toBeInTheDocument();
    });
    const explorer = screen.getByRole('article', { name: 'Explorer plan' });
    expect(
      within(explorer).getByText('Full 5,000-lead citywide workspace'),
    ).toBeInTheDocument();
    expect(
      within(explorer).getByText('5 custom imagery runs per month'),
    ).toBeInTheDocument();
    expect(
      within(explorer).getByRole('link', { name: /Create an account/i }),
    ).toHaveAttribute('href', '/sign-up?next=%2Fparcel-intel');
    expect(
      within(
        screen.getByRole('article', { name: 'Acquisitions pilot plan' }),
      ).getByRole('link', { name: /Request pilot access/i }),
    ).toHaveAttribute('href', '/contact?plan=acquisitions');
  });

  it('keeps pricing informational rather than presenting an automated checkout', () => {
    render(<PricingPage />);

    expect(screen.getByText(/not an automated checkout/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /buy|checkout|subscribe/i }))
      .not.toBeInTheDocument();
  });
});
