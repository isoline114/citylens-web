'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock').toLowerCase();
const IS_NEON = PROVIDER === 'neon';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!IS_NEON) {
    return (
      <div className="flex flex-col gap-3 max-w-md">
        <h1 className="text-2xl font-semibold">Sign up</h1>
        <p className="text-slate-700 text-sm">
          The mock auth provider does not require sign-up. <Link href="/sign-in">Sign in</Link>{' '}
          with any email to create a temporary local user.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <p className="text-slate-700 text-sm">
        Create a CityLens account. Free plan includes 5 runs per month.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            const trimmedEmail = email.trim();
            if (!trimmedEmail || !password) {
              setError('Email and password are required.');
              return;
            }
            const { neonAuthClient } = await import('@/lib/auth/neonAuth');
            const result = await (
              neonAuthClient as unknown as {
                signUp: {
                  email: (input: { email: string; password: string; name?: string }) => Promise<{
                    error?: { message?: string } | null;
                  }>;
                };
              }
            ).signUp.email({ email: trimmedEmail, password, name: name.trim() || undefined });
            if (result?.error) {
              setError(result.error.message ?? 'Sign up failed. Try again.');
              return;
            }
            router.push('/');
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sign up failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Display name (optional)</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>

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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-slate-500 text-sm">
        Already have an account? <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
