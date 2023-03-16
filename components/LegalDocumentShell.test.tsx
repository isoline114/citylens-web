import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LegalDocumentShell, LegalSection } from './LegalDocumentShell';

describe('LegalDocumentShell', () => {
  it('provides one scannable trust document with anchored sections', () => {
    render(
      <LegalDocumentShell
        eyebrow="Trust center"
        title="Test policy"
        summary="A concise policy summary."
        effectiveDate="July 29, 2026"
        navigation={[{ id: 'scope', label: 'Scope' }]}
      >
        <LegalSection id="scope" title="Scope">
          <p>Policy content.</p>
        </LegalSection>
      </LegalDocumentShell>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Test policy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Test policy sections' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scope' })).toHaveAttribute(
      'href',
      '#scope',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Scope' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Effective July 29, 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /hello@citylens.dev/i }),
    ).toHaveAttribute('href', 'mailto:hello@citylens.dev');
  });
});
