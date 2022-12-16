'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { AuthContextValue, AuthUser } from './types';

const STORAGE_KEY = 'citylens_mock_auth_user';

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (typeof parsed?.id !== 'string' || parsed.id.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function encodeMockToken(user: AuthUser): string {
  const payload = {
    sub: user.id,
    email: user.email ?? undefined,
    email_verified: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const json = JSON.stringify(payload);
  const b64 = typeof window === 'undefined' ? Buffer.from(json).toString('base64') : window.btoa(json);
  return `mock.${b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}

const MockAuthContext = createContext<AuthContextValue | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(readStoredUser());
    setHydrated(true);
    const onStorage = () => setUser(readStoredUser());
    window.addEventListener('citylens_mock_auth_changed', onStorage);
    return () => window.removeEventListener('citylens_mock_auth_changed', onStorage);
  }, []);

  const signIn = useCallback((email?: string) => {
    const id = `mock-${Math.random().toString(36).slice(2, 10)}`;
    const next: AuthUser = {
      id,
      email: email && email.length > 0 ? email : `${id}@mock.local`,
      displayName: email ?? id,
    };
    writeStoredUser(next);
    setUser(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('citylens_mock_auth_changed'));
    }
  }, []);

  const signOut = useCallback(() => {
    writeStoredUser(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('citylens_mock_auth_changed'));
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    if (!user) return null;
    return encodeMockToken(user);
  }, [user]);

  const value: AuthContextValue = !hydrated
    ? { status: 'loading', user: null, signIn, signOut, getAccessToken }
    : user
      ? { status: 'authenticated', user, signIn, signOut, getAccessToken }
      : { status: 'unauthenticated', user: null, signIn, signOut, getAccessToken };

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>;
}

export function useMockAuth(): AuthContextValue {
  const ctx = useContext(MockAuthContext);
  if (!ctx) {
    throw new Error('useMockAuth must be used inside MockAuthProvider');
  }
  return ctx;
}
