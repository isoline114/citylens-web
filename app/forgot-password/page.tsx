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
import { neonAuthClient } from '@/lib/auth/neonAuth';

const IS_NEON = selectAuthProvider() === 'neon';

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
      <AuthPageShell
        eyebrow="Local workspace"
        title="No password to reset"
        description="Mock authentication does not persist passwords."
      >
        <Link href="/sign-in" className={authPrimaryButtonClass}>
          Return to sign-in
        </Link>
      </AuthPageShell>
    );
  }

  if (sent) {
    return (
      <AuthPageShell
        eyebrow="Reset requested"
        title="Check your email"
        description={
          <>
            If an account exists for{' '}
            <span className="font-medium text-slate-900">{email}</span>, its
            six-digit reset code is on the way.
          </>
        }
      >
        <button
          type="button"
          className={authPrimaryButtonClass}
          onClick={() =>
            router.push(`/reset-password?email=${encodeURIComponent(email)}`)
          }
        >
          Enter reset code
        </button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your account email and we’ll send a six-digit reset code."
      footer={
        <span>
          Remembered it?{' '}
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
          const trimmed = email.trim();
          if (!trimmed) {
            setError('Email is required.');
            return;
          }
          setBusy(true);
          try {
            const res = await otpClient.forgetPassword.emailOtp({
              email: trimmed,
            });
            if (res?.error) {
              setError(res.error.message ?? 'Could not send the reset code.');
              return;
            }
            setSent(true);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : 'Could not send the reset code.',
            );
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
          {busy ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
    </AuthPageShell>
  );
}
