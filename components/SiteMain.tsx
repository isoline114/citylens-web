'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export function SiteMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isParcelWorkspace =
    pathname === '/parcel-intel' || pathname.startsWith('/parcel-intel/');

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={
        isParcelWorkspace
          ? 'mx-auto w-full max-w-[1480px] flex-1 px-4 py-3 outline-none sm:px-6 md:py-6 xl:px-8'
          : 'mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none'
      }
    >
      {children}
    </main>
  );
}
