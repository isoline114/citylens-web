'use client';

import { track } from '@vercel/analytics';

/**
 * Thin wrapper over Vercel Analytics custom events.
 *
 * - Keeps payloads small and PII-free by contract: pass only coarse
 *   product dimensions (borough, counts, flags) — never addresses, BBLs,
 *   emails, or free-text input.
 * - Never throws: analytics must not be able to break the product.
 */
export type AnalyticsProps = Record<string, string | number | boolean>;

export function trackEvent(name: string, props?: AnalyticsProps): void {
  try {
    track(name, props);
  } catch {
    // Swallow — analytics failures are not product failures.
  }
}
