import type { MetadataRoute } from 'next';

const BASE = 'https://www.citylens.dev';

const BOROUGH_SLUGS = [
  'manhattan',
  'brooklyn',
  'queens',
  'bronx',
  'staten_island',
] as const;

/**
 * Public, indexable routes only. Authenticated surfaces (/runs, /account)
 * are intentionally absent — they're also disallowed in robots.ts. The
 * borough workspaces are listed because the PAGE is public (it renders the
 * sign-in gate); the parcel data behind it stays server-gated.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/parcel-intel', priority: 0.9, changeFrequency: 'weekly' },
    ...BOROUGH_SLUGS.map((slug) => ({
      path: `/parcel-intel/${slug}`,
      priority: 0.8,
      changeFrequency: 'weekly' as const,
    })),
    { path: '/docs', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/sign-in', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/sign-up', priority: 0.3, changeFrequency: 'monthly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path === '/' ? '' : path}`,
    changeFrequency,
    priority,
  }));
}
