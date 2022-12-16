'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';

const PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock').toLowerCase();
const IS_NEON = PROVIDER === 'neon';

export default function SignInPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'authenticated') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Already signed in</h1>
        <p className="text-slate-700">Signed in as {auth.user.email ?? auth.user.id}.</p>
        <div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => router.push('/')}
          >
            Continue to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-slate-700 text-sm">
        Sign in to create CityLens runs. Free plan includes 5 runs per month.
      </p>

      <form
        className="flex flex-col gap-3"
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
                  signIn: { email: (input: { email: string; password: string }) => Promise<{ error?: { message?: string } | null }> };
                }
              ).signIn.email({ email: trimmedEmail, password });
              if (result?.error) {
                setError(result.error.message ?? 'Sign in failed. Check your email and password.');
                return;
              }
              router.push('/');
            } else {
              await auth.signIn(email.trim() || undefined);
              router.push('/');
            }
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sign in failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email{IS_NEON ? '' : ' (optional, mock provider)'}</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required={IS_NEON}
            autoComplete="email"
          />
        </label>

        {IS_NEON && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Password</span>
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
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
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {IS_NEON && (
        <p className="text-slate-500 text-xs">
          Need an account? <Link href="/sign-up">Sign up</Link>. Sign-up is wired against
          Neon Auth&apos;s <code className="font-mono">authClient.signUp.email</code>.
        </p>
      )}
      {!IS_NEON && (
        <p className="text-slate-500 text-xs">
          Local dev uses a mock auth provider. Set
          <code className="font-mono px-1">NEXT_PUBLIC_AUTH_PROVIDER=neon</code>
          and configure Neon Auth env vars to use the real provider.
        </p>
      )}
    </div>
  );
}
