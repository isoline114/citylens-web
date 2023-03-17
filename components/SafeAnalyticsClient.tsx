'use client';

import { Analytics } from '@vercel/analytics/next';

import { redactAnalyticsUrl } from '@/lib/analytics';

export function SafeAnalyticsClient() {
  return <Analytics beforeSend={redactAnalyticsUrl} />;
}
