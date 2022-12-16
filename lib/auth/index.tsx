'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { MockAuthProvider, useMockAuth } from './mockAuth';
import { NeonAuthProvider, useNeonAuth } from './neonAuth';
import type { AuthContextValue } from './types';

export type { AuthContextValue, AuthUser, AuthState, AuthActions } from './types';

const AuthContext = createContext<AuthContextValue | null>(null);

function selectedProvider(): 'mock' | 'neon' {
  const provider = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock').toLowerCase();
  return provider === 'neon' ? 'neon' : 'mock';
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
  if (selectedProvider() === 'neon') {
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
