function normalizeSiteBasePath(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '/') return '';
  const parts = raw.split('/').filter(Boolean);
  return parts.length > 0 ? `/${parts.join('/')}` : '';
}

const basePath = normalizeSiteBasePath(process.env.NEXT_PUBLIC_SITE_BASE_PATH);
const apiBase = String(process.env.NEXT_PUBLIC_CITYLENS_API_BASE ?? '').trim();

if (process.env.NODE_ENV === 'production' && !apiBase) {
  console.warn(
    'NEXT_PUBLIC_CITYLENS_API_BASE is not set. API calls will use same-origin requests ' +
    '(requires a reverse proxy or Next.js rewrites to forward /v1/* to the API backend).',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath,
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
