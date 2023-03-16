import { render, screen } from '@testing-library/react';
import { Database } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { ProductPageHeader } from './ProductPageHeader';

describe('ProductPageHeader', () => {
  it('renders one consistent page title, actions, and optional receipt', () => {
    render(
      <ProductPageHeader
        eyebrow="Processing workspace"
        title="Runs"
        description="Monitor active work."
        icon={Database}
        actions={<a href="/create">New run</a>}
        receipt={<span>3 ready</span>}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Runs' }),
    ).toBeVisible();
    expect(screen.getByText('Processing workspace')).toBeVisible();
    expect(screen.getByRole('link', { name: 'New run' })).toHaveAttribute(
      'href',
      '/create',
    );
    expect(screen.getByText('3 ready')).toBeVisible();
  });
});
