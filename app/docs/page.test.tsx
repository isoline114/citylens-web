import { fireEvent, render, screen, within } from '@testing-library/react';
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
    fireEvent.click(
      screen.getByTestId('docs-section-parcel-intelligence-toggle'),
    );
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
      .closest('details');
    expect(evidence).not.toBeNull();
    fireEvent.click(
      within(evidence as HTMLElement).getByTestId(
        'docs-section-evidence-toggle',
      ),
    );
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

  it('keeps the quickstart open and the reference compact by default', () => {
    render(<DocsPage />);

    expect(screen.getByTestId('docs-section-start')).toHaveAttribute('open');
    for (const id of [
      'authentication',
      'parcel-intelligence',
      'imagery-runs',
      'errors',
      'evidence',
    ]) {
      expect(screen.getByTestId(`docs-section-${id}`)).not.toHaveAttribute(
        'open',
      );
    }

    fireEvent.click(screen.getByTestId('docs-section-authentication-toggle'));
    expect(screen.getByTestId('docs-section-authentication')).toHaveAttribute(
      'open',
    );
    expect(screen.getByText('User API key')).toBeVisible();
  });

  it('opens a collapsed reference section from the section navigator', () => {
    render(<DocsPage />);

    fireEvent.click(
      screen.getByRole('link', { name: 'Parcel intelligence' }),
    );
    expect(
      screen.getByTestId('docs-section-parcel-intelligence'),
    ).toHaveAttribute('open');
  });
});
