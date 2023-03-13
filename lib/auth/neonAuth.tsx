'use client';

import { createAuthClient } from '@neondatabase/auth/next';
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { withSiteBasePath } from '@/lib/site';

import type { AuthContextValue, AuthUser } from './types';

// Singleton Neon Auth client. Talks to /api/auth/[...all] which proxies to
// the Neon Auth managed service via authApiHandler.
const authClient = createAuthClient();

const NeonAuthContext = createContext<AuthContextValue | null>(null);

export function NeonAuthProvider({ children }: { children: ReactNode }) {
  // useSession is provided by the Neon Auth client.
  const session = (authClient as unknown as {
    useSession: () => {
      data:
        | {
            user: { id: string; email: string; emailVerified: boolean; name?: string | null };
            session: { token: string; expiresAt: Date };
          }
        | null;
      isPending: boolean;
      refetch: (queryParams?: {
        query?: { disableCookieCache?: boolean };
      }) => Promise<void>;
    };
  }).useSession();
  const sessionData = session.data;
  const refetchSession = session.refetch;

  // Cache the most-recently-fetched JWT so successive API calls don't refetch.
  // Bind it to the opaque Neon session token so switching accounts can never
  // reuse a JWT minted for the previous browser session.
  const cachedJwt = useRef<{
    token: string;
    expiresAt: number;
    sessionToken: string;
  } | null>(null);

  const signIn = useCallback(async () => {
    // Neon Auth requires a real email+password form. The /sign-in page calls
    // `neonAuthClient.signIn.email({ email, password })` directly. Anything else
    // that needs to start a sign-in flow should route the user there.
    if (typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
  }, []);

  const signOut = useCallback(async () => {
    cachedJwt.current = null;
    await (authClient as unknown as {
      signOut: () => Promise<unknown>;
    }).signOut();
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!sessionData) return null;

    const sessionToken = sessionData.session.token;
    const cached = cachedJwt.current;
    const now = Date.now();
    if (
      cached &&
      cached.sessionToken === sessionToken &&
      cached.expiresAt - now > 30_000
    ) {
      return cached.token;
    }

    const requestToken = async (): Promise<string | null> => {
      // Read the JWT from CityLens' same-origin auth endpoint first. In a real
      // browser session the Neon client can have a valid cached `session_data`
      // cookie while its `token()` helper returns no credential. That state is
      // enough to render "signed in", but it leaves API calls on the 125-row
      // public Parcel Intelligence preview. The endpoint is already owned by
      // our `/api/auth/[...path]` handler and sees the authoritative HttpOnly
      // session cookie.
      try {
        const response = await fetch(withSiteBasePath('/api/auth/token'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });
        if (response.ok) {
          const payload = (await response.json()) as { token?: unknown };
          if (
            typeof payload.token === 'string' &&
            payload.token.split('.').length === 3
          ) {
            return payload.token;
          }
        }
      } catch {
        // Fall through to the SDK call, which remains useful for alternate
        // Neon client configurations and keeps this recovery path portable.
      }

      try {
        const response = await authClient.token();
        const token = response.data?.token;
        return typeof token === 'string' && token.split('.').length === 3
          ? token
          : null;
      } catch {
        return null;
      }
    };

    let token = await requestToken();
    if (!token) {
      // A signed session_data cookie can briefly outlive or lag the upstream
      // session token. Force one upstream session validation and retry JWT
      // minting before declaring the API credential unavailable.
      try {
        await refetchSession({
          query: { disableCookieCache: true },
        });
      } catch {
        // The retry below is the authoritative result.
      }
      token = await requestToken();
    }
    if (!token) {
      cachedJwt.current = null;
      return null;
    }

    cachedJwt.current = {
      token,
      expiresAt: extractJwtExpMs(token) ?? now + 60_000,
      sessionToken,
    };
    return token;
  }, [sessionData, refetchSession]);

  const value = useMemo<AuthContextValue>(() => {
    if (session.isPending) {
      return { status: 'loading', user: null, signIn, signOut, getAccessToken };
    }
    const data = sessionData;
    if (!data) {
      return { status: 'unauthenticated', user: null, signIn, signOut, getAccessToken };
    }
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName: data.user.name ?? data.user.email ?? data.user.id,
    };
    return { status: 'authenticated', user, signIn, signOut, getAccessToken };
  }, [session.isPending, sessionData, signIn, signOut, getAccessToken]);

  return <NeonAuthContext.Provider value={value}>{children}</NeonAuthContext.Provider>;
}

export function useNeonAuth(): AuthContextValue {
  const ctx = useContext(NeonAuthContext);
  if (!ctx) {
    throw new Error('useNeonAuth must be used inside NeonAuthProvider');
  }
  return ctx;
}

export { authClient as neonAuthClient };

function extractJwtExpMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded) as { exp?: number };
    if (typeof parsed?.exp === 'number') return parsed.exp * 1000;
  } catch {
    // fall through
  }
  return null;
}
