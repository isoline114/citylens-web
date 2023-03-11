import { describe, expect, it } from 'vitest';

import { redactAnalyticsUrl } from '@/lib/analytics';

describe('analytics privacy boundary', () => {
  it('removes query parameters and hashes from pageview URLs', () => {
    expect(
      redactAnalyticsUrl({
        type: 'pageview',
        url: 'https://www.citylens.dev/parcel-intel?borough=brooklyn&bbl=3020960069#panel',
      }),
    ).toEqual({
      type: 'pageview',
      url: 'https://www.citylens.dev/parcel-intel',
    });
  });

  it('preserves a URL that has no identifying navigation state', () => {
    const event = { type: 'pageview' as const, url: '/parcel-intel' };
    expect(redactAnalyticsUrl(event)).toBe(event);
  });

  it('also redacts custom-event URLs without changing event type', () => {
    expect(
      redactAnalyticsUrl({
        type: 'event',
        url: '/parcel-intel?bbl=3020960069',
      }),
    ).toEqual({ type: 'event', url: '/parcel-intel' });
  });
});
