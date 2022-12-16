'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, UserRound } from 'lucide-react';

import { useAuth } from '@/lib/auth';

export function AuthHeaderControls() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status === 'loading') {
    return (
      <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
        Loading…
      </span>
    );
  }

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
