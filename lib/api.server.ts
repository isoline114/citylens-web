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

import {
  parseFeaturedDemosResponse,
  type DemoFeaturedRun,
  type ParcelIntelIndex,
  type ParcelIntelSweepResponse,
} from '@/lib/api';

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
 * Parcel-intel SSR runs on behalf of the signed-in product, but it cannot use
 * the browser's short-lived session token. In production Vercel supplies a
 * dedicated CityLens API key so these requests receive the full commercial
 * feed. Keeping the header construction here makes the public index and the
 * borough sweep follow the same contract while preserving local/CI behavior
 * when the key is intentionally absent.
 */
function parcelIntelHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = process.env.CITYLENS_SERVER_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
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

/**
 * Fetch /v1/parcel-intel/index server-side. Powers the borough picker
 * at /parcel-intel — 5 borough cards SSR'd into the HTML.
 *
 * Like featured demos, this short-circuits when
 * `CITYLENS_DISABLE_SSR_PARCEL_INTEL=1` is set so Playwright e2e
 * fixtures can intercept via `page.route` instead of being baked.
 *
 * Sweep cadence is monthly — `revalidate: 300` (5 min) is plenty fresh
 * and lets `npm run build` produce a static prerender.
 *
 * Timeout: 6s. Tight enough to keep page render snappy, generous
 * enough that a Cloud Run cold start (typical 3-5s) doesn't bake an
 * empty page into ISR. The empty fallback is genuinely a fallback,
 * not an "engine is mid-cold-start" misfire.
 */
export async function fetchParcelIntelIndexOnServer(): Promise<ParcelIntelIndex> {
  const empty: ParcelIntelIndex = {
    boroughs: [],
    generated_at: null,
    model_metadata: {},
    data_sources: {},
  };
  if (process.env.CITYLENS_DISABLE_SSR_PARCEL_INTEL === '1') return empty;

  const url = `${serverApiBase()}/v1/parcel-intel/index`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: parcelIntelHeaders(),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return empty;
    return (await res.json()) as ParcelIntelIndex;
  } catch {
    return empty;
  }
}

/**
 * Fetch /v1/parcel-intel/sweep server-side for a specific borough.
 * Used by the borough list page to SSR the table on first paint.
 *
 * Returns null on failure so the page can render an explicit empty state
 * (rather than a 500). Pages should treat null and `rows.length === 0`
 * the same way.
 *
 * Timeout: 8s — sweep responses are 5-10x larger than index, so we
 * give them more headroom on cold engine instances.
 */
export async function fetchParcelIntelSweepOnServer(
  borough: string,
  top: number = 100,
): Promise<ParcelIntelSweepResponse | null> {
  if (process.env.CITYLENS_DISABLE_SSR_PARCEL_INTEL === '1') return null;

  const params = new URLSearchParams({ borough, top: String(top) });
  const url = `${serverApiBase()}/v1/parcel-intel/sweep?${params.toString()}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: parcelIntelHeaders(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ParcelIntelSweepResponse;
  } catch {
    return null;
  }
}
