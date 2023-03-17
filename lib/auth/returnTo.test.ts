import { describe, expect, it } from 'vitest';

import {
  authFlowHref,
  DEFAULT_AUTH_DESTINATION,
  destinationForPathname,
  safeAuthDestination,
} from './returnTo';

describe('auth return destinations', () => {
  it('defaults first-use journeys to Parcel Intelligence', () => {
    expect(safeAuthDestination(null)).toBe(DEFAULT_AUTH_DESTINATION);
    expect(DEFAULT_AUTH_DESTINATION).toBe('/parcel-intel');
  });

  it('preserves internal paths and rejects external or ambiguous redirects', () => {
    expect(safeAuthDestination('/runs/new?source=pricing')).toBe(
      '/runs/new?source=pricing',
    );
    expect(safeAuthDestination('https://example.test')).toBe(
      '/parcel-intel',
    );
    expect(safeAuthDestination('//example.test')).toBe('/parcel-intel');
    expect(safeAuthDestination('/\\example.test')).toBe('/parcel-intel');
  });

  it('builds encoded handoff links without losing verification context', () => {
    expect(
      authFlowHref('/verify-email', '/parcel-intel', {
        email: 'buyer@example.com',
      }),
    ).toBe(
      '/verify-email?email=buyer%40example.com&next=%2Fparcel-intel',
    );
    expect(authFlowHref('/sign-in', '/runs/new')).toBe(
      '/sign-in?next=%2Fruns%2Fnew',
    );
  });

  it('keeps header sign-in on the current product surface, not an auth loop', () => {
    expect(destinationForPathname('/runs/new')).toBe('/runs/new');
    expect(destinationForPathname('/parcel-intel')).toBe('/parcel-intel');
    expect(destinationForPathname('/sign-up')).toBe('/parcel-intel');
    expect(destinationForPathname('/verify-email')).toBe('/parcel-intel');
  });
});
