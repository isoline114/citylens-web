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
import { authFlowHref, safeAuthDestination } from '@/lib/auth/returnTo';

const IS_NEON = selectAuthProvider() === 'neon';

type VerifyEmailClient = {
  emailOtp: {
    verifyEmail: (input: { email: string; otp: string }) => Promise<{
      data?: { status: boolean; user?: { emailVerified: boolean } } | null;
      error?: { message?: string; code?: string } | null;
    }>;
    sendVerificationOtp?: (input: {
      email: string;
      type: 'email-verification';
    }) => Promise<{
      error?: { message?: string } | null;
    }>;
  };
};

const otpClient = neonAuthClient as unknown as VerifyEmailClient;

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell
          eyebrow="Account security"
          title="Loading verification"
          description="Preparing the secure verification form."
        >
          <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
        </AuthPageShell>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = useMemo(
    () => searchParams.get('email') ?? '',
    [searchParams],
  );
  const destination = useMemo(
    () => safeAuthDestination(searchParams.get('next')),
    [searchParams],
  );
  const signInHref = authFlowHref('/sign-in', destination);

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
      <AuthPageShell
        eyebrow="Local workspace"
        title="Verification skipped"
        description="Mock authentication does not require email verification."
      >
        <Link href={signInHref} className={authPrimaryButtonClass}>
          Continue to sign-in
        </Link>
      </AuthPageShell>
    );
  }

  if (verified) {
    return (
      <AuthPageShell
        eyebrow="Account ready"
        title="Email verified"
        description="Your account is ready. Sign in to open your CityLens workspace."
      >
        <button
          type="button"
          className={authPrimaryButtonClass}
          onClick={() => router.push(signInHref)}
        >
          Continue to sign in
        </button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Account security"
      title="Verify your email"
      description="Enter the six-digit code from your email. Codes expire after a few minutes."
      footer={
        <span>
          Already verified?{' '}
          <Link href={signInHref} className={authTextLinkClass}>
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
          setBusy(true);
          try {
            const result = await otpClient.emailOtp.verifyEmail({
              email: trimmedEmail,
              otp: trimmedCode,
            });
            if (result?.error) {
              setError(
                result.error.message ??
                  'Verification failed. Double-check the code and try again.',
              );
              return;
            }
            setVerified(true);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Verification failed.',
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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-800">
            Verification code
          </span>
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
          {busy ? 'Verifying…' : 'Verify email'}
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
            const send = otpClient.emailOtp.sendVerificationOtp;
            if (!send) {
              setInfo(
                'Resend not available. Sign up again to get a fresh code.',
              );
              return;
            }
            const res = await send({
              email: email.trim(),
              type: 'email-verification',
            });
            if (res?.error) {
              setError(res.error.message ?? 'Could not resend the code.');
              return;
            }
            setInfo('A new code is on the way.');
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
