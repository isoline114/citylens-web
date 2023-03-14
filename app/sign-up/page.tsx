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
import { selectAuthProvider } from '@/lib/auth';

const IS_NEON = selectAuthProvider() === 'neon';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!IS_NEON) {
    return (
      <AuthPageShell
        eyebrow="Local workspace"
        title="No account needed"
        description="Mock authentication creates a temporary local user without registration."
      >
        <Link href="/sign-in" className={authPrimaryButtonClass}>
          Continue to local sign-in
        </Link>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Start free"
      title="Create your account"
      description="Explore the full parcel workspace and run five imagery analyses each month."
      footer={
        <span>
          Already have an account?{' '}
          <Link href="/sign-in" className={authTextLinkClass}>
            Sign in
          </Link>
        </span>
      }
    >
      <form
        className="flex flex-col gap-4"
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
                  email: (input: {
                    email: string;
                    password: string;
                    name?: string;
                  }) => Promise<{
                    error?: { message?: string } | null;
                  }>;
                };
              }
            ).signUp.email({
              email: trimmedEmail,
              password,
              name: name.trim() || undefined,
            });
            if (result?.error) {
              setError(result.error.message ?? 'Sign up failed. Try again.');
              return;
            }
            // Account created. Whether or not email verification is required
            // for sign-in, route to /verify-email so the user knows where to
            // enter the code that was just emailed.
            router.push(
              `/verify-email?email=${encodeURIComponent(trimmedEmail)}`,
            );
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sign up failed.');
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
            required
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-800">Password</span>
          <input
            className={authInputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-800">
            Display name{' '}
            <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            className={authInputClass}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>

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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthPageShell>
  );
}
