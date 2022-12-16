'use client';

import { createAuthClient } from '@neondatabase/auth/next';
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

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
    };
  }).useSession();

  // Cache the most-recently-fetched JWT so successive API calls don't refetch.
  const cachedJwt = useRef<{ token: string; expiresAt: number } | null>(null);

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
    if (!session.data) return null;

    const cached = cachedJwt.current;
    const now = Date.now();
    if (cached && cached.expiresAt - now > 30_000) {
      return cached.token;
    }

    // Better Auth's JWT plugin exposes a /api/auth/token endpoint that returns
    // a short-lived JWT signed with the JWKS at /api/auth/jwks. Both must be
    // enabled in the Neon Auth project for cross-service Bearer auth to work.
    try {
      const res = await fetch('/api/auth/token', {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { token?: string; expiresAt?: string | number } | null;
      const token = body?.token;
      if (typeof token !== 'string' || token.length === 0) return null;
      const expiresAt =
        typeof body?.expiresAt === 'number'
          ? body.expiresAt * (body.expiresAt < 1e12 ? 1000 : 1)
          : Date.parse(String(body?.expiresAt ?? '')) || now + 60_000;
      cachedJwt.current = { token, expiresAt };
      return token;
    } catch {
      return null;
    }
  }, [session.data]);

  const value = useMemo<AuthContextValue>(() => {
    if (session.isPending) {
      return { status: 'loading', user: null, signIn, signOut, getAccessToken };
    }
    const data = session.data;
    if (!data) {
      return { status: 'unauthenticated', user: null, signIn, signOut, getAccessToken };
    }
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName: data.user.name ?? data.user.email ?? data.user.id,
    };
    return { status: 'authenticated', user, signIn, signOut, getAccessToken };
  }, [session.isPending, session.data, signIn, signOut, getAccessToken]);

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
