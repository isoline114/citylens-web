'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  AuthPageShell,
  authAlertClass,
  authInputClass,
  authPrimaryButtonClass,
  authStatusClass,
  authTextLinkClass,
} from '@/components/auth/AuthPageShell';
import { selectAuthProvider } from '@/lib/auth';
import { neonAuthClient } from '@/lib/auth/neonAuth';

const IS_NEON = selectAuthProvider() === 'neon';

type ResetClient = {
  emailOtp: {
    resetPassword: (input: {
      email: string;
      otp: string;
      password: string;
    }) => Promise<{
      data?: { success: boolean } | null;
      error?: { message?: string; code?: string } | null;
    }>;
  };
  forgetPassword: {
    emailOtp: (input: { email: string }) => Promise<{
      error?: { message?: string } | null;
    }>;
  };
};

const otpClient = neonAuthClient as unknown as ResetClient;

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell
          eyebrow="Account recovery"
          title="Loading password reset"
          description="Preparing the secure reset form."
        >
          <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
        </AuthPageShell>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = useMemo(
    () => searchParams.get('email') ?? '',
    [searchParams],
  );

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (initialEmail && !email) setEmail(initialEmail);
  }, [initialEmail, email]);

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

  if (done) {
    return (
      <AuthPageShell
        eyebrow="Account ready"
        title="Password updated"
        description="Your new password is active."
      >
        <button
          type="button"
          className={authPrimaryButtonClass}
          onClick={() => router.push('/sign-in')}
        >
          Continue to sign in
        </button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Enter your six-digit reset code, then set a password with at least eight characters."
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
          setInfo(null);
          const trimmedEmail = email.trim();
          const trimmedCode = code.trim();
          if (!trimmedEmail || !trimmedCode) {
            setError('Email and code are required.');
            return;
          }
          if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
          }
          if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
          }
          setBusy(true);
          try {
            const res = await otpClient.emailOtp.resetPassword({
              email: trimmedEmail,
              otp: trimmedCode,
              password,
            });
            if (res?.error) {
              setError(
                res.error.message ??
                  'Reset failed. Double-check the code and try again.',
              );
              return;
            }
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Reset failed.');
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
          <span className="text-sm font-medium text-slate-800">Reset code</span>
          <input
            className={`${authInputClass} tracking-[0.3em]`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-800">
            New password
          </span>
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
            Confirm new password
          </span>
          <input
            className={authInputClass}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>

        {error && (
          <div className={authAlertClass} role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className={authStatusClass} role="status">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={authPrimaryButtonClass}
        >
          {busy ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      <button
        type="button"
        disabled={resendBusy || !email.trim()}
        className="mt-4 text-sm font-semibold text-slate-700 underline-offset-4 hover:text-sky-700 hover:underline disabled:text-slate-400"
        onClick={async () => {
          setError(null);
          setInfo(null);
          setResendBusy(true);
          try {
            const res = await otpClient.forgetPassword.emailOtp({
              email: email.trim(),
            });
            if (res?.error) {
              setError(res.error.message ?? 'Could not resend the code.');
              return;
            }
            setInfo('A new reset code is on the way.');
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Could not resend the code.',
            );
          } finally {
            setResendBusy(false);
          }
        }}
      >
        {resendBusy ? 'Resending…' : 'Resend code'}
      </button>
    </AuthPageShell>
  );
}
