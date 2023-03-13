function normalizeSiteBasePath(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '/') return '';
  const parts = raw.split('/').filter(Boolean);
  return parts.length > 0 ? `/${parts.join('/')}` : '';
}

const basePath = normalizeSiteBasePath(process.env.NEXT_PUBLIC_SITE_BASE_PATH);
const apiBase = String(process.env.NEXT_PUBLIC_CITYLENS_API_BASE ?? '').trim();
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value:
      "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  },
  {
    key: 'Permissions-Policy',
    value: 'browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=()',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '0',
  },
];

if (process.env.NODE_ENV === 'production' && !apiBase) {
  console.warn(
    'NEXT_PUBLIC_CITYLENS_API_BASE is not set. API calls will use same-origin requests ' +
    '(requires a reverse proxy or Next.js rewrites to forward /v1/* to the API backend).',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'citylens.dev' }],
        destination: 'https://www.citylens.dev/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    if (!apiBase) return [];
    return [
      {
        source: '/v1/:path*',
        destination: `${apiBase}/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
