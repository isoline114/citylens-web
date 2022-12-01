function normalizeSegments(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? `/${parts.join('/')}` : '';
}


export function normalizeSiteBasePath(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw || raw === '/') return '';
  return normalizeSegments(raw);
}


export function getSiteBasePath(): string {
  return normalizeSiteBasePath(process.env.NEXT_PUBLIC_SITE_BASE_PATH);
}


export function withSiteBasePath(path: string): string {
  const raw = path.trim();
  if (!raw) return getSiteBasePath() || '/';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;

  const normalizedPath = raw.startsWith('/') ? normalizeSegments(raw) || '/' : normalizeSegments(`/${raw}`) || '/';
  const basePath = getSiteBasePath();
  return basePath ? `${basePath}${normalizedPath}` : normalizedPath;
}


export function publicAssetPath(path: string): string {
  return withSiteBasePath(path);
}
