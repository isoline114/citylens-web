'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { neonAuthClient } from '@/lib/auth/neonAuth';

const PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock').toLowerCase();
const IS_NEON = PROVIDER === 'neon';

type ResetClient = {
  emailOtp: {
    resetPassword: (input: { email: string; otp: string; password: string }) => Promise<{
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
    <Suspense fallback={<div className="text-sm text-slate-600">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get('email') ?? '', [searchParams]);

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
      <div className="flex flex-col gap-3 max-w-md">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-slate-700 text-sm">
          The mock auth provider doesn&apos;t persist passwords.{' '}
          <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">
            Go to sign-in
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p className="text-slate-700 text-sm">Sign in with your new password.</p>
        <button
          type="button"
          className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => router.push('/sign-in')}
        >
          Continue to sign-in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="text-slate-700 text-sm">
        Enter the 6-digit code from the email we just sent, then choose a new password.
      </p>

      <form
        className="flex flex-col gap-3"
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
              setError(res.error.message ?? 'Reset failed. Double-check the code and try again.');
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
          <span className="text-sm font-medium">Reset code</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm tracking-widest outline-none focus:ring-2 focus:ring-slate-200"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">New password</span>
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
          <span className="text-sm font-medium">Confirm new password</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800" role="status">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      <button
        type="button"
        disabled={resendBusy || !email.trim()}
        className="text-sm text-slate-700 underline-offset-2 hover:underline disabled:text-slate-400"
        onClick={async () => {
          setError(null);
          setInfo(null);
          setResendBusy(true);
          try {
            const res = await otpClient.forgetPassword.emailOtp({ email: email.trim() });
            if (res?.error) {
              setError(res.error.message ?? 'Could not resend the code.');
              return;
            }
            setInfo('A new reset code is on the way.');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not resend the code.');
          } finally {
            setResendBusy(false);
          }
        }}
      >
        {resendBusy ? 'Resending…' : 'Resend code'}
      </button>

      <p className="text-slate-500 text-sm">
        Remembered it?{' '}
        <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
