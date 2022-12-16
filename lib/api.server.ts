/**
 * Server-only API helpers — used by Next.js Server Components / Route Handlers
 * that need to fetch CityLens API data during SSR. Browser code should use
 * `lib/api.ts` instead (it goes through the auth-aware client).
 *
 * Why a separate module:
 * - SSR can't rely on same-origin relative URLs the way browser fetches do.
 *   The Next.js rewrites in `next.config.js` only apply to incoming HTTP
 *   requests, not to `fetch()` calls made from server code.
 * - Server-side calls go directly to the API host so we get a fresh, typed,
 *   cacheable response on first paint.
 */

import { parseFeaturedDemosResponse, type DemoFeaturedRun } from '@/lib/api';

/**
 * Production API URL for server-side fetches. Order of preference:
 *   1. CITYLENS_API_INTERNAL_URL  — for split deployments (e.g. private VPC)
 *   2. NEXT_PUBLIC_CITYLENS_API_BASE — what the browser is configured to use
 *   3. https://api.citylens.dev — sane production default
 */
function serverApiBase(): string {
  const internal = process.env.CITYLENS_API_INTERNAL_URL;
  if (internal && internal.trim()) return internal.trim().replace(/\/+$/, '');
  const pub = process.env.NEXT_PUBLIC_CITYLENS_API_BASE;
  if (pub && pub.trim()) return pub.trim().replace(/\/+$/, '');
  return 'https://api.citylens.dev';
}

/**
 * Fetch /v1/demo/featured server-side with Next caching. Designed to be
 * called from async Server Components on the homepage so the SSR HTML
 * already includes featured demos — no client-side flash of "no demos".
 *
 * Failures degrade gracefully to an empty array; the caller decides how to
 * render the empty/error state in a product-safe way.
 *
 * Environment overrides:
 * - `CITYLENS_DISABLE_SSR_DEMOS=1` — short-circuit to []. Useful for
 *   Playwright e2e where the test relies on `page.route` mocks of the
 *   browser fetch (which Server-side fetches bypass).
 */
export async function fetchFeaturedDemosOnServer(): Promise<DemoFeaturedRun[]> {
  if (process.env.CITYLENS_DISABLE_SSR_DEMOS === '1') return [];

  const url = `${serverApiBase()}/v1/demo/featured`;
  try {
    const res = await fetch(url, {
      // Re-validate every 60s so a freshly-published demo lands in the
      // homepage SSR cache within a minute, without hammering the API.
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
      // Hard ceiling so a stuck upstream can't block the page render.
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return [];
    const raw = await res.json().catch(() => null);
    return parseFeaturedDemosResponse(raw);
  } catch {
    return [];
  }
}
