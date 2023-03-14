'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function DemoModeBanner() {
  const auth = useAuth();
  const pathname = usePathname();

  if (auth.status === 'loading') return null;
  if (auth.status === 'authenticated') return null;
  // Keep reconstruction-demo context on the surfaces where a user can
  // actually inspect or choose a run. Product, account, legal, and API pages
  // should not inherit an unrelated beta-looking banner.
  const isReconstructionSurface =
    pathname === '/' || pathname === '/runs' || pathname.startsWith('/runs/');
  if (!isReconstructionSurface) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-2 text-sm text-amber-900">
        Demo mode (precomputed) — sign in to create new runs.
      </div>
    </div>
  );
}
