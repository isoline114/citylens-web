import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    status: 'authenticated' as 'unauthenticated' | 'authenticated' | 'loading',
    user: { id: 'u-test', email: 't@example.com' } as {
      id: string;
      email: string | null;
    } | null,
  },
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  confirmSpy: vi.fn(),
  clipboard: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    signIn: () => undefined,
    signOut: () => undefined,
    getAccessToken: async () => null,
  }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    listApiKeys: mocks.listApiKeys,
    createApiKey: mocks.createApiKey,
    revokeApiKey: mocks.revokeApiKey,
  };
});

import { ApiKeyList } from './ApiKeyList';

beforeEach(() => {
  mocks.listApiKeys.mockReset();
  mocks.createApiKey.mockReset();
  mocks.revokeApiKey.mockReset();
  mocks.confirmSpy.mockReset();
  mocks.clipboard.mockReset();
  mocks.authState.status = 'authenticated';
  mocks.authState.user = { id: 'u-test', email: 't@example.com' };
  vi.spyOn(window, 'confirm').mockImplementation(mocks.confirmSpy);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mocks.clipboard },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
});

describe('ApiKeyList (signed out)', () => {
  it('shows a sign-in nudge and does not call the API', async () => {
    mocks.authState.status = 'unauthenticated';
    mocks.authState.user = null;
    render(<ApiKeyList />);
    expect(screen.getByText(/sign in to manage api keys/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Faccount%2Fapi-keys',
    );
    expect(screen.queryByText(/verify a key/i)).not.toBeInTheDocument();
    expect(mocks.listApiKeys).not.toHaveBeenCalled();
  });
});

describe('ApiKeyList (signed in)', () => {
  it('renders existing keys', async () => {
    mocks.listApiKeys.mockResolvedValueOnce([
      {
        key_id: 'k1',
        label: 'prod-server',
        key_prefix: 'clk_live_abcd',
        created_at: '2026-04-01T00:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
    ]);

    render(<ApiKeyList />);
    await waitFor(() => {
      expect(screen.getAllByTestId('api-key-row')).toHaveLength(1);
    });
    expect(screen.getByText('prod-server')).toBeInTheDocument();
    expect(screen.getByText('clk_live_abcd…')).toBeInTheDocument();
    expect(screen.getByText('Verify a key')).toBeInTheDocument();
    expect(
      screen.getByText(/api\.citylens\.dev\/v1\/me/),
    ).toBeInTheDocument();
  });

  it('creates a key, surfaces the plaintext once, and refreshes the list', async () => {
    const user = userEvent.setup();
    mocks.listApiKeys.mockResolvedValueOnce([]);
    mocks.createApiKey.mockResolvedValueOnce({
      key_id: 'k-new',
      label: 'nightly-ingest',
      key_prefix: 'clk_live_zyxw',
      created_at: '2026-04-30T12:00:00Z',
      last_used_at: null,
      revoked_at: null,
      plaintext_key: 'clk_live_zyxwSECRET-VALUE-ONLY-SHOWN-ONCE',
    });
    mocks.listApiKeys.mockResolvedValueOnce([
      {
        key_id: 'k-new',
        label: 'nightly-ingest',
        key_prefix: 'clk_live_zyxw',
        created_at: '2026-04-30T12:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
    ]);

    render(<ApiKeyList />);
    await waitFor(() => expect(mocks.listApiKeys).toHaveBeenCalledTimes(1));

    await user.type(
      screen.getByPlaceholderText(/acquisition-notebook/i),
      'nightly-ingest',
    );
    await user.click(screen.getByRole('button', { name: /generate key/i }));

    // Plaintext block appears with the plaintext
    const plaintextBlock = await screen.findByTestId('api-key-plaintext-block');
    expect(plaintextBlock).toHaveTextContent(
      'clk_live_zyxwSECRET-VALUE-ONLY-SHOWN-ONCE',
    );

    // List refreshed from server (second call)
    expect(mocks.listApiKeys).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('nightly-ingest')).toBeInTheDocument();
  });

  it('asks for confirmation before revoking and removes the row on success', async () => {
    const user = userEvent.setup();
    mocks.listApiKeys.mockResolvedValueOnce([
      {
        key_id: 'k1',
        label: 'prod-server',
        key_prefix: 'clk_live_abcd',
        created_at: '2026-04-01T00:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
    ]);
    mocks.confirmSpy.mockReturnValueOnce(true);
    mocks.revokeApiKey.mockResolvedValueOnce(undefined);

    render(<ApiKeyList />);
    await screen.findByText('prod-server');

    await user.click(screen.getByRole('button', { name: /revoke/i }));

    expect(mocks.confirmSpy).toHaveBeenCalled();
    expect(mocks.revokeApiKey).toHaveBeenCalledWith('k1');
    await waitFor(() => {
      expect(screen.queryByText('prod-server')).not.toBeInTheDocument();
    });
  });

  it('does not call revoke when the user cancels the confirm dialog', async () => {
    const user = userEvent.setup();
    mocks.listApiKeys.mockResolvedValueOnce([
      {
        key_id: 'k1',
        label: 'prod-server',
        key_prefix: 'clk_live_abcd',
        created_at: '2026-04-01T00:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
    ]);
    mocks.confirmSpy.mockReturnValueOnce(false);

    render(<ApiKeyList />);
    await screen.findByText('prod-server');

    await user.click(screen.getByRole('button', { name: /revoke/i }));

    expect(mocks.confirmSpy).toHaveBeenCalled();
    expect(mocks.revokeApiKey).not.toHaveBeenCalled();
    expect(screen.getByText('prod-server')).toBeInTheDocument();
  });
});
