'use client';

import { useCallback, useRef } from 'react';

/**
 * Tiny client wrapper that warms the leaflet+map chunk on hover/focus.
 *
 * The borough page lazy-loads `parcel-intel-map` via `next/dynamic({ ssr: false })`,
 * which means the ~120 KB Leaflet bundle isn't fetched until the user
 * navigates and the page hydrates. Eagerly importing it on hover trims
 * roughly 300-500 ms off the perceived first-paint of the map.
 *
 * Webpack/Turbopack dedupe `import()` results, so calling it multiple
 * times (or after the user actually navigates) is idempotent.
 */
export function BoroughCardPrefetch({ children }: { children: React.ReactNode }) {
  const warmed = useRef(false);

  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    // Fire and forget — Promise resolves whenever the network's done.
    import('./[borough]/parcel-intel-map').catch(() => {
      // The chunk URL can change between deploys; if a stale page tries
      // to prefetch a no-longer-existing chunk, swallow the error so
      // hover doesn't surface a console error to users.
      warmed.current = false;
    });
  }, []);

  return (
    <div onMouseEnter={warm} onFocus={warm}>
      {children}
    </div>
  );
}
