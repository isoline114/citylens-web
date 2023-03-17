import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('publishes only canonical public product and trust routes', () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      'https://www.citylens.dev',
      'https://www.citylens.dev/parcel-intel',
      'https://www.citylens.dev/docs',
      'https://www.citylens.dev/pricing',
      'https://www.citylens.dev/contact',
      'https://www.citylens.dev/privacy',
      'https://www.citylens.dev/terms',
    ]);
    expect(urls).not.toContain('https://www.citylens.dev/sign-in');
    expect(urls).not.toContain('https://www.citylens.dev/sign-up');
  });
});
