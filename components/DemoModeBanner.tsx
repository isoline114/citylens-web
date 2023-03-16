'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function DemoModeBanner() {
  const auth = useAuth();
  const pathname = usePathname();

  if (auth.status === 'loading') return null;
  if (auth.status === 'authenticated') return null;
  // Keep the global notice only where public demos are discovered. Run
  // detail pages already carry their own explicit public/private state, and
  // the new-run route is an account gate rather than a demo surface.
  const isReconstructionSurface = pathname === '/' || pathname === '/runs';
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
