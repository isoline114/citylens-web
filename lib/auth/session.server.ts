import { neonAuth } from './server';

/**
 * Minimal structural type for the Neon Auth server client — just what the
 * session check needs. Injectable so tests can exercise the fail-closed
 * contract without mocking the whole `@neondatabase/auth` package.
 */
export type SessionClient = {
  getSession: () => Promise<{ data: unknown }>;
};

/**
 * Read the Neon Auth session server-side. `getSession()` reads the signed,
 * TTL-cached session cookie (`NEON_AUTH_COOKIE_SECRET`), so on cache hits
 * this is local — no upstream round-trip.
 *
 * Contract:
 * - `client` null/undefined (Neon unconfigured — dev/CI mock provider):
 *   returns true so callers fall through to their client-side gate.
 * - Fails CLOSED: any error from the session check → false, so we never
 *   SSR protected data on an unverifiable request.
 */
export async function hasValidSession(
  client: SessionClient | null = neonAuth,
): Promise<boolean> {
  if (!client) return true;
  try {
    const { data: session } = await client.getSession();
    return Boolean(session);
  } catch (err) {
    console.warn('auth: server session check failed; failing closed', err);
    return false;
  }
}
