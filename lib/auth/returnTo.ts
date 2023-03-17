export const DEFAULT_AUTH_DESTINATION = '/parcel-intel';
const AUTH_ENTRY_PATHS = [
  '/sign-in',
  '/sign-up',
  '/sign-out',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
] as const;

export function safeAuthDestination(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTH_DESTINATION,
): string {
  const candidate = value?.trim();
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return fallback;
  }
  return candidate;
}

export function destinationForPathname(
  pathname: string | null | undefined,
): string {
  const destination = safeAuthDestination(pathname);
  return AUTH_ENTRY_PATHS.some(
    (path) => destination === path || destination.startsWith(`${path}/`),
  )
    ? DEFAULT_AUTH_DESTINATION
    : destination;
}

export function authFlowHref(
  path: '/sign-in' | '/sign-up' | '/verify-email',
  destination: string,
  extra?: Record<string, string | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  params.set('next', safeAuthDestination(destination));
  return `${path}?${params.toString()}`;
}
