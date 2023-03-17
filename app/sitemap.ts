import type { MetadataRoute } from 'next';

const BASE = 'https://www.citylens.dev';

/**
 * Public, indexable routes only. Authenticated surfaces (/runs, /account)
 * are intentionally absent — they're also disallowed in robots.ts. Parcel
 * intelligence has one canonical citywide route; legacy borough paths
 * redirect into query-filtered views and should not be indexed separately.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/parcel-intel', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/docs', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path === '/' ? '' : path}`,
    changeFrequency,
    priority,
  }));
}
