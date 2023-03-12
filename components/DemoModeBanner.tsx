'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function DemoModeBanner() {
  const auth = useAuth();
  const pathname = usePathname();

  if (auth.status === 'loading') return null;
  if (auth.status === 'authenticated') return null;
  // Parcel Intelligence has its own public-preview disclosure inside the
  // explorer. The global reconstruction-demo banner is unrelated to that
  // product and makes its live city-data surface look synthetic.
  if (pathname === '/parcel-intel' || pathname.startsWith('/parcel-intel/')) {
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
