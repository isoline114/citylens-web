'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { neonAuthClient } from '@/lib/auth/neonAuth';

const PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock').toLowerCase();
const IS_NEON = PROVIDER === 'neon';

type ForgotClient = {
  forgetPassword: {
    emailOtp: (input: { email: string }) => Promise<{
      data?: { success: boolean } | null;
      error?: { message?: string; code?: string } | null;
    }>;
  };
};

const otpClient = neonAuthClient as unknown as ForgotClient;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!IS_NEON) {
    return (
      <div className="flex flex-col gap-3 max-w-md">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="text-slate-700 text-sm">
          The mock auth provider doesn&apos;t persist passwords.{' '}
          <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">
            Go to sign-in
          </Link>
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-slate-700 text-sm">
          If an account exists for <span className="font-mono">{email}</span>, a 6-digit reset code is on its way.
          Enter it on the next page along with a new password.
        </p>
        <button
          type="button"
          className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
        >
          Continue to reset
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="text-slate-700 text-sm">
        Enter your email. We&apos;ll send a code you can use to reset your password.
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const trimmed = email.trim();
          if (!trimmed) {
            setError('Email is required.');
            return;
          }
          setBusy(true);
          try {
            const res = await otpClient.forgetPassword.emailOtp({ email: trimmed });
            if (res?.error) {
              setError(res.error.message ?? 'Could not send the reset code.');
              return;
            }
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the reset code.');
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
          {busy ? 'Sending…' : 'Send reset code'}
        </button>
      </form>

      <p className="text-slate-500 text-sm">
        Remembered it?{' '}
        <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
