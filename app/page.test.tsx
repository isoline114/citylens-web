import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/RunForm', () => ({
  RunForm: () => <div data-testid="run-form">Run form</div>,
}));

import HomePage from './page';

describe('HomePage smoke test', () => {
  it('renders the main landing content', () => {
    render(<HomePage />);

    expect(screen.getByText(/Urban change detection and 3D reconstruction/i)).toBeInTheDocument();
    expect(screen.getByTestId('run-form')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View runs' })).toBeInTheDocument();
  });
});
