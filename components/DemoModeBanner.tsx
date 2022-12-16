'use client';

import { useAuth } from '@/lib/auth';

export function DemoModeBanner() {
  const auth = useAuth();

  if (auth.status === 'loading') return null;
  if (auth.status === 'authenticated') return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-2 text-sm text-amber-900">
        Demo mode (precomputed) — sign in to create new runs.
      </div>
    </div>
  );
}
