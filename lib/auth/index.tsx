'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { MockAuthProvider, useMockAuth } from './mockAuth';
import { NeonAuthProvider, useNeonAuth } from './neonAuth';
import type { AuthContextValue } from './types';

export type { AuthContextValue, AuthUser, AuthState, AuthActions } from './types';

const AuthContext = createContext<AuthContextValue | null>(null);

export function selectAuthProvider(
  configuredProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER,
  apiBase = process.env.NEXT_PUBLIC_CITYLENS_API_BASE,
  nodeEnv = process.env.NODE_ENV,
): 'mock' | 'neon' {
  const provider = configuredProvider?.trim().toLowerCase();
  if (provider === 'neon' || provider === 'mock') return provider;

  // A mock session is useful only with the local development API. Defaulting
  // to it while the browser points at a deployed API creates a misleading
  // "signed in" state whose mock JWT is correctly rejected by production,
  // leaving Parcel Intelligence on the 125-row public preview.
  if (nodeEnv === 'production') return 'neon';
  if (apiBase) {
    try {
      const hostname = new URL(apiBase).hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') return 'neon';
    } catch {
      // Relative or malformed development values stay on the explicit local
      // mock default. API configuration validation owns malformed URLs.
    }
  }
  return 'mock';
}

function MockBridge({ children }: { children: ReactNode }) {
  const value = useMockAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function NeonBridge({ children }: { children: ReactNode }) {
  const value = useNeonAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (selectAuthProvider() === 'neon') {
    return (
      <NeonAuthProvider>
        <NeonBridge>{children}</NeonBridge>
      </NeonAuthProvider>
    );
  }
  return (
    <MockAuthProvider>
      <MockBridge>{children}</MockBridge>
    </MockAuthProvider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
