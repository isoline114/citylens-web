import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL ?? '';
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET ?? '';

export const isNeonAuthConfigured = Boolean(baseUrl && cookieSecret);

export const neonAuth = isNeonAuthConfigured
  ? createNeonAuth({
      baseUrl,
      cookies: { secret: cookieSecret },
    })
  : null;
