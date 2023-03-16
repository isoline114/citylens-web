import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DocsPage from './page';

describe('DocsPage', () => {
  it('documents the canonical, current demo and parcel contracts', () => {
    render(<DocsPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Build acquisition workflows on a source-aware city model.',
      }),
    ).toBeVisible();
    expect(screen.getAllByText('https://api.citylens.dev').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/resolve a currently published demo/i),
    ).toBeVisible();
    expect(screen.getByText(/authenticated_full/)).toBeVisible();
    expect(
      screen.getByText(/"returned_count": 5000/),
    ).toBeVisible();
    expect(
      screen.getByText(/demo artifact URLs are relative API proxy paths/i),
    ).toBeVisible();
  });

  it('keeps accuracy, provenance, and technical QA claims separate', () => {
    render(<DocsPage />);

    const evidence = screen
      .getByRole('heading', {
        level: 2,
        name: 'Keep provenance, model quality, and commercial outcomes separate.',
      })
      .closest('section');
    expect(evidence).not.toBeNull();
    expect(
      within(evidence as HTMLElement).getByText(
        /not seller intent, transaction probability, or a parcel-level confidence score/i,
      ),
    ).toBeVisible();
    expect(
      within(evidence as HTMLElement).getByText(
        /matching input hashes prove that two runs used the same bytes/i,
      ),
    ).toBeVisible();
  });

  it('does not retain retired quickstart or artifact-delivery claims', () => {
    const { container } = render(<DocsPage />);
    const text = container.textContent ?? '';

    expect(text).not.toContain('5f079d78d89c4387a9c0ddd5e3507b5e');
    expect(text).not.toMatch(/signed URLs/i);
    expect(text).not.toMatch(/same QA hashes produce identical outputs/i);
    expect(text).not.toMatch(/attached as Authorization: Bearer/i);
  });
});
