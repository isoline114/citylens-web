import { isNeonAuthConfigured, neonAuth } from '@/lib/auth/server';

function configError(): Response {
  return new Response(
    JSON.stringify({
      error: 'NEON_AUTH_NOT_CONFIGURED',
      message:
        'Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ chars) to enable real auth, or use NEXT_PUBLIC_AUTH_PROVIDER=mock for local development.',
    }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
}

const handler = isNeonAuthConfigured && neonAuth ? neonAuth.handler() : null;

export const GET = handler ? handler.GET : async () => configError();
export const POST = handler ? handler.POST : async () => configError();
