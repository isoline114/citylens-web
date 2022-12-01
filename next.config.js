function normalizeSiteBasePath(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '/') return '';
  const parts = raw.split('/').filter(Boolean);
  return parts.length > 0 ? `/${parts.join('/')}` : '';
}

const basePath = normalizeSiteBasePath(process.env.NEXT_PUBLIC_SITE_BASE_PATH);
const apiBase = String(process.env.NEXT_PUBLIC_CITYLENS_API_BASE ?? '').trim();

if (process.env.NODE_ENV === 'production' && !apiBase) {
  throw new Error('NEXT_PUBLIC_CITYLENS_API_BASE is required in production builds.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath,
};

module.exports = nextConfig;
