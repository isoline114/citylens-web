'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Key, LogIn, LogOut, UserRound } from 'lucide-react';

import { useAuth } from '@/lib/auth';

export function AuthHeaderControls() {
  const auth = useAuth();
  const router = useRouter();

  // For SSR + first paint, render the "Sign in" CTA as the default. Crawlers
  // can't run client effects so they'd otherwise see a permanent "Loading…"
  // chip, which makes the page look like it's stuck. Once auth resolves on
  // the client, this flips to the signed-in state with the user's email.
  if (auth.status !== 'authenticated') {
    return (
      <Link
        href="/sign-in"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        <LogIn className="h-4 w-4" />
        <span>Sign in</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
        <UserRound className="h-4 w-4" />
        <span className="max-w-[160px] truncate" title={auth.user.email ?? auth.user.id}>
          {auth.user.email ?? auth.user.displayName ?? auth.user.id}
        </span>
      </span>
      <Link
        href="/account/api-keys"
        className="hidden h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 sm:inline-flex"
        title="API keys"
      >
        <Key className="h-4 w-4" />
        <span className="hidden md:inline">API keys</span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await auth.signOut();
          router.push('/');
        }}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign out</span>
      </button>
    </div>
  );
}
