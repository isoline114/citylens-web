import { describe, expect, it } from 'vitest';

import { isVercelAnalyticsEnabled } from '@/components/SafeAnalytics';

describe('isVercelAnalyticsEnabled', () => {
  it('enables analytics on Vercel deployments', () => {
    expect(isVercelAnalyticsEnabled({ VERCEL: '1' })).toBe(true);
    expect(isVercelAnalyticsEnabled({ VERCEL_ENV: 'production' })).toBe(true);
  });

  it('keeps local production builds free of unavailable Vercel scripts', () => {
    expect(isVercelAnalyticsEnabled({})).toBe(false);
  });
});
