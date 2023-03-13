import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  refetch: vi.fn(),
  signOut: vi.fn(),
  session: {
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
        name: 'User One',
      },
      session: {
        token: 'opaque-session-1',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      },
    },
    isPending: false,
  },
}));

vi.mock('@neondatabase/auth/next', () => ({
  createAuthClient: () => ({
    useSession: () => ({
      ...mocks.session,
      refetch: mocks.refetch,
    }),
    token: mocks.token,
    signOut: mocks.signOut,
  }),
}));

import { NeonAuthProvider, useNeonAuth } from './neonAuth';
import type { AuthContextValue } from './types';

function Probe({
  onValue,
}: {
  onValue: (value: AuthContextValue) => void;
}) {
  onValue(useNeonAuth());
  return null;
}

describe('NeonAuthProvider access token recovery', () => {
  beforeEach(() => {
    mocks.token.mockReset();
    mocks.refetch.mockReset();
    mocks.signOut.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
  });

  it('uses the official token client and caches the minted JWT', async () => {
    mocks.token.mockResolvedValue({
      data: { token: 'header.payload.signature' },
      error: null,
    });
    let auth: AuthContextValue | null = null;
    render(
      <NeonAuthProvider>
        <Probe onValue={(value) => { auth = value; }} />
      </NeonAuthProvider>,
    );

    let first: string | null = null;
    let second: string | null = null;
    await act(async () => {
      first = await auth?.getAccessToken() ?? null;
      second = await auth?.getAccessToken() ?? null;
    });

    expect(first).toBe('header.payload.signature');
    expect(second).toBe('header.payload.signature');
    expect(mocks.token).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it('force-validates the session and retries one failed JWT mint', async () => {
    mocks.token
      .mockResolvedValueOnce({ data: null, error: { status: 401 } })
      .mockResolvedValueOnce({
        data: { token: 'recovered.payload.signature' },
        error: null,
      });
    let auth: AuthContextValue | null = null;
    render(
      <NeonAuthProvider>
        <Probe onValue={(value) => { auth = value; }} />
      </NeonAuthProvider>,
    );

    let token: string | null = null;
    await act(async () => {
      token = await auth?.getAccessToken() ?? null;
    });

    expect(token).toBe('recovered.payload.signature');
    expect(mocks.refetch).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
    expect(mocks.token).toHaveBeenCalledTimes(2);
  });
});
