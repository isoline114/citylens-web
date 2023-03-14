import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthPageShell } from './AuthPageShell';

describe('AuthPageShell', () => {
  it('provides one concise account frame with product context and footer actions', () => {
    render(
      <AuthPageShell
        eyebrow="Welcome back"
        title="Sign in"
        description="Open your workspace."
        footer={<a href="/sign-up">Create an account</a>}
      >
        <form aria-label="Sign in form">
          <button type="submit">Continue</button>
        </form>
      </AuthPageShell>,
    );

    expect(screen.getByTestId('auth-page-shell')).toBeInTheDocument();
    expect(
      screen.getByText(/move from parcel signal to a defensible decision/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /explore parcel intelligence/i }),
    ).toHaveAttribute('href', '/parcel-intel');
    expect(
      screen.getByRole('link', { name: /create an account/i }),
    ).toHaveAttribute('href', '/sign-up');
  });
});
