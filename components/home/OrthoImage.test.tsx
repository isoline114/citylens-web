import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OrthoImage } from './OrthoImage';
it('keeps an honest fallback when the external orthoimage fails', () => {
  render(<OrthoImage src="/ortho.jpg" alt="Aerial survey" />);
  fireEvent.error(screen.getByRole('img', { name: 'Aerial survey' }));
  expect(screen.getByRole('status')).toHaveTextContent('aerial image is temporarily unavailable');
});
