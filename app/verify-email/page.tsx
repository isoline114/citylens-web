'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { neonAuthClient } from '@/lib/auth/neonAuth';

const PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock').toLowerCase();
const IS_NEON = PROVIDER === 'neon';

type VerifyEmailClient = {
  emailOtp: {
    verifyEmail: (input: { email: string; otp: string }) => Promise<{
      data?: { status: boolean; user?: { emailVerified: boolean } } | null;
      error?: { message?: string; code?: string } | null;
    }>;
    sendVerificationOtp?: (input: { email: string; type: 'email-verification' }) => Promise<{
      error?: { message?: string } | null;
    }>;
  };
};

const otpClient = neonAuthClient as unknown as VerifyEmailClient;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-600">Loading…</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get('email') ?? '', [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (initialEmail && !email) setEmail(initialEmail);
  }, [initialEmail, email]);

  if (!IS_NEON) {
    return (
      <div className="flex flex-col gap-3 max-w-md">
        <h1 className="text-2xl font-semibold">Verify email</h1>
        <p className="text-slate-700 text-sm">
          The mock auth provider doesn&apos;t require email verification.{' '}
          <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">
            Go to sign-in
          </Link>
          .
        </p>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <h1 className="text-2xl font-semibold">Email verified</h1>
        <p className="text-slate-700 text-sm">
          Your email is now verified. Sign in to continue.
        </p>
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
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="text-slate-700 text-sm">
        Enter the verification code we emailed you. Codes are usually 6 digits and expire after a few minutes.
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
          setBusy(true);
          try {
            const result = await otpClient.emailOtp.verifyEmail({
              email: trimmedEmail,
              otp: trimmedCode,
            });
            if (result?.error) {
              setError(result.error.message ?? 'Verification failed. Double-check the code and try again.');
              return;
            }
            setVerified(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed.');
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
          <span className="text-sm font-medium">Verification code</span>
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
          {busy ? 'Verifying…' : 'Verify email'}
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
            const send = otpClient.emailOtp.sendVerificationOtp;
            if (!send) {
              setInfo('Resend not available. Sign up again to get a fresh code.');
              return;
            }
            const res = await send({ email: email.trim(), type: 'email-verification' });
            if (res?.error) {
              setError(res.error.message ?? 'Could not resend the code.');
              return;
            }
            setInfo('A new code is on the way.');
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
        Already verified?{' '}
        <Link href="/sign-in" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
