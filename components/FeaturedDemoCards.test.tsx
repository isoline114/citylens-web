import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeaturedDemoCards } from '@/components/FeaturedDemoCards';

describe('FeaturedDemoCards', () => {
  it('renders a card for each demo with title, address, and year range', () => {
    render(
      <FeaturedDemoCards
        demos={[
          {
            run_id: 'demo-1',
            label: 'Brooklyn brownstones — Flatbush',
            address: '100 E 21st St Brooklyn, NY 11226',
            imagery_year: 2024,
            baseline_year: 2017,
            outputs: ['previews', 'change', 'mesh'],
          },
        ]}
      />,
    );
    const cards = screen.getAllByTestId('featured-demo-card');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('Brooklyn brownstones — Flatbush')).toBeInTheDocument();
    expect(screen.getByText('100 E 21st St Brooklyn, NY 11226')).toBeInTheDocument();
    expect(screen.getByText(/2017 → 2024/)).toBeInTheDocument();
    expect(screen.getByText(/previews · change · mesh/)).toBeInTheDocument();
  });

  it('links to /runs/{run_id}?demo=1', () => {
    render(
      <FeaturedDemoCards
        demos={[{ run_id: 'demo-2', label: 'Test', address: 'x' }]}
      />,
    );
    const link = screen.getAllByTestId('featured-demo-card')[0];
    expect(link).toHaveAttribute('href', '/runs/demo-2?demo=1');
  });

  it('renders product-safe fallback when no demos', () => {
    render(<FeaturedDemoCards demos={[]} />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    // Must NOT include the legacy crawler-hostile copy
    expect(screen.queryByText(/No featured demos found/i)).not.toBeInTheDocument();
  });

  it('caps the visible card grid at 6', () => {
    const demos = Array.from({ length: 10 }, (_, i) => ({
      run_id: `demo-${i}`,
      label: `Demo ${i}`,
      address: `Addr ${i}`,
    }));
    render(<FeaturedDemoCards demos={demos} />);
    expect(screen.getAllByTestId('featured-demo-card')).toHaveLength(6);
  });

  it('supports a focused evidence-library presentation', () => {
    const demos = Array.from({ length: 3 }, (_, i) => ({
      run_id: `demo-${i}`,
      label: `Demo ${i}`,
    }));
    render(
      <FeaturedDemoCards
        demos={demos}
        sectionId="public-evidence"
        eyebrow="Public evidence library"
        title="Inspect the evidence."
        description="Real outputs."
        limit={2}
      />,
    );

    expect(screen.getByTestId('public-evidence-library')).toHaveAttribute(
      'id',
      'public-evidence',
    );
    expect(screen.getByText('Public evidence library')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inspect the evidence.' })).toBeInTheDocument();
    expect(screen.getAllByTestId('featured-demo-card')).toHaveLength(2);
  });

  it('skips demos missing both run_id and id', () => {
    render(
      <FeaturedDemoCards
        demos={[
          { run_id: 'demo-ok', label: 'Has ID' },
          { label: 'Has no ID' } as never,
        ]}
      />,
    );
    expect(screen.getAllByTestId('featured-demo-card')).toHaveLength(1);
    expect(screen.getByText('Has ID')).toBeInTheDocument();
  });
});
