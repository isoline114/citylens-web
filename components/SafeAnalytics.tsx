import { SafeAnalyticsClient } from '@/components/SafeAnalyticsClient';

type AnalyticsEnvironment = {
  VERCEL?: string;
  VERCEL_ENV?: string;
};

export function isVercelAnalyticsEnabled(
  environment: AnalyticsEnvironment = {
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
) {
  return environment.VERCEL === '1' || Boolean(environment.VERCEL_ENV);
}

export function SafeAnalytics() {
  if (!isVercelAnalyticsEnabled()) {
    return null;
  }

  return <SafeAnalyticsClient />;
}
