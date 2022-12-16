'use client';

import { setAuthTokenGetter } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Wires the active AuthProvider into the global API client so non-demo
 * fetches can attach `Authorization: Bearer <token>`. Mounted once near the
 * top of the React tree.
 *
 * The registration runs during render rather than in a useEffect so that
 * the very first SWR fetch on the page (which kicks off in a child's effect
 * pass) sees the current getter. Effects fire bottom-up, so a useEffect
 * here would race the SWR fetcher's effect and lose.
 */
export function AuthTokenBridge() {
  const auth = useAuth();
  setAuthTokenGetter(auth.getAccessToken);
  return null;
}
