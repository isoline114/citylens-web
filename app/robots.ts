import type { MetadataRoute } from 'next';

const BASE = 'https://www.citylens.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated / transactional surfaces — nothing indexable here.
        disallow: [
          '/runs',
          '/account',
          '/sign-out',
          '/verify-email',
          '/forgot-password',
          '/reset-password',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
