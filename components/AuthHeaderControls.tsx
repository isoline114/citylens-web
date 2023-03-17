'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Key, LogIn, LogOut, UserRound } from 'lucide-react';

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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        <LogIn className="h-4 w-4" />
        <span>Sign in</span>
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
        className="hidden h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 xl:inline-flex"
        title={emailLabel}
      >
        <UserRound className="h-4 w-4" />
        <span className="max-w-[180px] truncate">{emailLabel}</span>
      </span>
      <Link
        href="/account/api-keys"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50 lg:w-auto lg:gap-2 lg:px-3"
        title="API keys"
        aria-label="API keys"
      >
        <Key className="h-4 w-4" />
        <span className="hidden lg:inline">API keys</span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await auth.signOut();
          router.push('/');
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50 lg:w-auto lg:gap-2 lg:px-3"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden lg:inline">Sign out</span>
      </button>
    </div>
  );
}
