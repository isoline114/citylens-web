'use client';

import Link from 'next/link';
import { KeyRound, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';
import {
  authFlowHref,
  destinationForPathname,
} from '@/lib/auth/returnTo';

export function AuthHeaderControls() {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // For SSR + first paint, render the "Sign in" CTA as the default. Crawlers
  // can't run client effects so they'd otherwise see a permanent "Loading…"
  // chip, which makes the page look like it's stuck. Once auth resolves on
  // the client, this flips to the signed-in state with the user's email.
  if (auth.status !== 'authenticated') {
    return (
      <Link
        href={authFlowHref(
          '/sign-in',
          destinationForPathname(pathname),
        )}
        className="btn"
      >
        Sign in
      </Link>
    );
  }

  const emailLabel = auth.user.email ?? auth.user.displayName ?? auth.user.id;
  return (
    <div className="flex items-center justify-end gap-1.5 sm:gap-2">
      {/* Email chip is informational; below `sm` we hide it to keep the
       *  signed-in cluster from wrapping. The badge + actions still make
       *  it obvious you're signed in. */}
      <span
        className="hidden max-w-[200px] truncate text-xs text-ink-3 xl:inline"
        title={emailLabel}
      >
        {emailLabel}
      </span>
      {/* Below `sm` the actions collapse to 36px icon buttons so the signed-in
       *  cluster fits a 320px viewport with WCAG text spacing applied. */}
      <Link
        href="/account/api-keys"
        className="btn w-9 px-0 sm:w-auto sm:px-3"
        title="API keys"
        aria-label="API keys"
      >
        <KeyRound className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline lg:hidden">Keys</span>
        <span className="hidden lg:inline">API keys</span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await auth.signOut();
          router.push('/');
        }}
        className="btn w-9 px-0 sm:w-auto sm:px-3"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
