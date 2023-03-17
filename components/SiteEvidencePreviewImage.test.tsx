import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteEvidencePreviewImage } from './SiteEvidencePreviewImage';

describe('SiteEvidencePreviewImage', () => {
  it('replaces a failed demo image with a deliberate fallback', () => {
    render(<SiteEvidencePreviewImage src="/missing-preview.png" />);

    fireEvent.error(screen.getByTestId('home-site-evidence-image'));

    expect(
      screen.getByRole('img', {
        name: 'Site-evidence preview unavailable',
      }),
    ).toBeVisible();
    expect(screen.queryByTestId('home-site-evidence-image')).not.toBeInTheDocument();
  });
});
