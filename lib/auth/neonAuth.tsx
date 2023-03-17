'use client';

import { createAuthClient } from '@neondatabase/auth/next';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { withSiteBasePath } from '@/lib/site';

import type { AuthContextValue, AuthUser } from './types';

// Singleton Neon Auth client. Talks to /api/auth/[...all] which proxies to
// the Neon Auth managed service via authApiHandler.
const authClient = createAuthClient();

const NeonAuthContext = createContext<AuthContextValue | null>(null);
const subscribeToHydration = () => () => undefined;
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

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
  // The auth SDK owns a client-side external store. A warm store may already
  // contain a session while the server can only render its pending snapshot,
  // especially immediately after sign-in or during client navigation. Keep
  // the first browser render on the same pending branch as SSR, then reveal
  // the SDK state after hydration. This prevents signed-in header/workspace
  // markup from replacing signed-out HTML during hydration.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientHydrationSnapshot,
    serverHydrationSnapshot,
  );
  const sessionRefreshInFlight = useRef(false);
  const lastSessionRefreshAt = useRef(0);
  const anonymousSnapshotValidated = useRef(false);

  // Neon owns the authoritative HttpOnly session cookie, while useSession()
  // keeps a browser-local snapshot. An already-open Parcel Intelligence tab
  // can therefore remain on its anonymous snapshot after the user signs in
  // in another tab. Revalidate a cached anonymous snapshot once after
  // hydration, and revalidate whenever the user returns to the tab. This
  // keeps the 125-row public preview from surviving a real account session.
  useEffect(() => {
    if (!hydrated || session.isPending) return;

    const refreshSession = () => {
      if (
        sessionRefreshInFlight.current ||
        (typeof document !== 'undefined' &&
          document.visibilityState === 'hidden')
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastSessionRefreshAt.current < 2_000) return;
      lastSessionRefreshAt.current = now;
      sessionRefreshInFlight.current = true;
      void refetchSession({
        query: { disableCookieCache: true },
      })
        .catch(() => {
          // The existing snapshot remains authoritative if the network is
          // unavailable. Parcel Intelligence owns its explicit retry state.
        })
        .finally(() => {
          sessionRefreshInFlight.current = false;
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };

    window.addEventListener('focus', refreshSession);
    window.addEventListener('pageshow', refreshSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (sessionData) {
      anonymousSnapshotValidated.current = false;
    } else if (!anonymousSnapshotValidated.current) {
      // Keep this recovery bounded when Neon confirms a genuinely anonymous
      // session. Refetch can toggle its pending state and rerender the
      // provider without creating an anonymous-session request loop.
      anonymousSnapshotValidated.current = true;
      refreshSession();
    }

    return () => {
      window.removeEventListener('focus', refreshSession);
      window.removeEventListener('pageshow', refreshSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hydrated, refetchSession, session.isPending, sessionData]);

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

  const getAccessToken = useCallback(async (options?: {
    forceRefresh?: boolean;
  }): Promise<string | null> => {
    if (!sessionData) return null;

    const sessionToken = sessionData.session.token;
    const forceRefresh = options?.forceRefresh === true;
    if (forceRefresh) {
      cachedJwt.current = null;
    }
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

    if (forceRefresh) {
      // A 401 from the CityLens API means the previously minted JWT is no
      // longer authoritative even when its local `exp` has not elapsed.
      // Refresh the upstream Neon session before minting its replacement.
      try {
        await refetchSession({
          query: { disableCookieCache: true },
        });
      } catch {
        // The token request below is the authoritative result.
      }
    }

    let token = await requestToken();
    if (!token && !forceRefresh) {
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
    if (!hydrated || session.isPending) {
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
  }, [
    hydrated,
    session.isPending,
    sessionData,
    signIn,
    signOut,
    getAccessToken,
  ]);

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
