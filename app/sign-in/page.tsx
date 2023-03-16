'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AuthPageShell,
  authAlertClass,
  authInputClass,
  authPrimaryButtonClass,
  authTextLinkClass,
} from '@/components/auth/AuthPageShell';
import { selectAuthProvider, useAuth } from '@/lib/auth';

// Keep the sign-in form aligned with the provider selected by AuthProvider.
// This matters in local development: when localhost points at the deployed
// API, selectAuthProvider intentionally chooses Neon even if the provider env
// var is omitted. A separate env-only check here used to render a mock form
// backed by a Neon context, making local sign-in appear to succeed while the
// Parcel Intelligence request remained on the public inventory.
const IS_NEON = selectAuthProvider() === 'neon';

function requestedDestination(): string {
  if (typeof window === 'undefined') return '/';
  const requested = new URLSearchParams(window.location.search).get('next');
  return requested?.startsWith('/') && !requested.startsWith('//')
    ? requested
    : '/';
}

export default function SignInPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'authenticated') {
    return (
      <AuthPageShell
        eyebrow="Account ready"
        title="You’re signed in."
        description={
          <>
            Continue as{' '}
            <span className="font-medium text-slate-900">
              {auth.user.email ?? auth.user.id}
            </span>
            .
          </>
        }
      >
        <button
          type="button"
          className={authPrimaryButtonClass}
          onClick={() => router.push(requestedDestination())}
        >
          Continue to CityLens
        </button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Welcome back"
      title="Sign in"
      description="Open your parcel workspace, saved pursuits, and processing history."
      footer={
        IS_NEON ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              New to CityLens?{' '}
              <Link href="/sign-up" className={authTextLinkClass}>
                Create an account
              </Link>
            </span>
            <Link href="/forgot-password" className={authTextLinkClass}>
              Reset password
            </Link>
          </div>
        ) : null
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            if (IS_NEON) {
              const trimmedEmail = email.trim();
              if (!trimmedEmail || !password) {
                setError('Email and password are required.');
                return;
              }
              const { neonAuthClient } = await import('@/lib/auth/neonAuth');
              const result = await (
                neonAuthClient as unknown as {
                  signIn: {
                    email: (input: {
                      email: string;
                      password: string;
                    }) => Promise<{ error?: { message?: string } | null }>;
                  };
                }
              ).signIn.email({ email: trimmedEmail, password });
              if (result?.error) {
                const msg = result.error.message ?? '';
                const code = (result.error as { code?: string })?.code ?? '';
                const looksLikeVerificationGate =
                  /not verified|verify your email|email.*verif/i.test(msg) ||
                  code === 'EMAIL_NOT_VERIFIED';
                if (looksLikeVerificationGate) {
                  router.push(
                    `/verify-email?email=${encodeURIComponent(trimmedEmail)}`,
                  );
                  return;
                }
                setError(
                  msg || 'Sign in failed. Check your email and password.',
                );
                return;
              }
              // Neon has accepted the credentials and written the
              // authoritative HttpOnly session cookie, but the client-side
              // session hook can still hold its pre-sign-in anonymous value
              // for one render. A full navigation forces both the server and
              // browser auth clients to rehydrate from that cookie before a
              // protected surface chooses its data tier. Without this
              // boundary, Parcel Intelligence can briefly start its
              // 125-parcel public request after a successful sign-in.
              window.location.assign(requestedDestination());
              return;
            } else {
              await auth.signIn(email.trim() || undefined);
              router.push(requestedDestination());
            }
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sign in failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-800">Email</span>
          <input
            className={authInputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required={IS_NEON}
            autoComplete="email"
          />
        </label>

        {IS_NEON && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">Password</span>
            <input
              className={authInputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={8}
            />
          </label>
        )}

        {error && (
          <div className={authAlertClass} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={authPrimaryButtonClass}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {!IS_NEON && (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Local dev uses a mock auth provider. Set{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-slate-700">
            NEXT_PUBLIC_AUTH_PROVIDER=neon
          </code>{' '}
          to use the configured production provider.
        </p>
      )}
    </AuthPageShell>
  );
}
