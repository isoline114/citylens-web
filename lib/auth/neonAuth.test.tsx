import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

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
    } as {
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
      };
      session: {
        token: string;
        expiresAt: Date;
      };
    } | null,
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

function StatusProbe() {
  return <span>{useNeonAuth().status}</span>;
}

describe('NeonAuthProvider access token recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.token.mockReset();
    mocks.refetch.mockReset();
    mocks.signOut.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
    mocks.session.data = {
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
    };
    mocks.session.isPending = false;
  });

  it('keeps the server and first client auth render hydration-safe', async () => {
    const markup = renderToString(
      <NeonAuthProvider>
        <StatusProbe />
      </NeonAuthProvider>,
    );
    expect(markup).toContain('loading');

    const container = document.createElement('div');
    container.innerHTML = markup;
    const recoverableErrors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | null = null;
    await act(async () => {
      root = hydrateRoot(
        container,
        <NeonAuthProvider>
          <StatusProbe />
        </NeonAuthProvider>,
        {
          onRecoverableError: (error) => recoverableErrors.push(error),
        },
      );
    });

    expect(recoverableErrors).toEqual([]);
    expect(container).toHaveTextContent('authenticated');
    await act(async () => {
      root?.unmount();
    });
  });

  it('uses the same-origin auth endpoint and caches the minted JWT', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ token: 'header.payload.signature' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
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
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/token', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it('invalidates a cached JWT and refreshes Neon when the API rejects it', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'stale.payload.signature' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'fresh.payload.signature' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    let auth: AuthContextValue | null = null;
    render(
      <NeonAuthProvider>
        <Probe onValue={(value) => { auth = value; }} />
      </NeonAuthProvider>,
    );

    let stale: string | null = null;
    let fresh: string | null = null;
    await act(async () => {
      stale = await auth?.getAccessToken() ?? null;
      fresh = await auth?.getAccessToken({ forceRefresh: true }) ?? null;
    });

    expect(stale).toBe('stale.payload.signature');
    expect(fresh).toBe('fresh.payload.signature');
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(mocks.refetch).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('force-validates the session and retries one failed JWT mint', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: null }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: 'recovered.payload.signature' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    mocks.token
      .mockResolvedValue({ data: null, error: { status: 401 } });
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
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mocks.token).toHaveBeenCalledTimes(1);
  });

  it('revalidates a cached anonymous snapshot after hydration', async () => {
    mocks.session.data = null;

    render(
      <NeonAuthProvider>
        <StatusProbe />
      </NeonAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(mocks.refetch).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
  });

  it('revalidates the browser session when the user returns to the tab', async () => {
    render(
      <NeonAuthProvider>
        <StatusProbe />
      </NeonAuthProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(mocks.refetch).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
  });
});
