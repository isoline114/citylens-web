'use client';

import { track } from '@vercel/analytics';
import type { BeforeSendEvent } from '@vercel/analytics/next';

/**
 * Thin wrapper over Vercel Analytics custom events.
 *
 * - Keeps payloads small and PII-free by contract: pass only coarse
 *   product dimensions (borough, counts, flags) — never addresses, BBLs,
 *   emails, or free-text input.
 * - Custom events require a supported Vercel plan. Canonical parcel-adoption
 *   measurement uses the authenticated first-party aggregate API instead.
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

export function redactAnalyticsUrl(event: BeforeSendEvent): BeforeSendEvent {
  const redactedUrl = event.url.replace(/[?#].*$/, '');
  return redactedUrl === event.url ? event : { ...event, url: redactedUrl };
}
