/**
 * Minimal, dependency-free client error reporting.
 *
 * No-ops unless `NEXT_PUBLIC_ERROR_REPORTING_DSN` is set. When set, POSTs a
 * small JSON payload to that endpoint via `fetch` with `keepalive: true` so
 * reports survive page unloads. The payload deliberately mirrors the fields
 * an error tracker needs (name/message/stack/digest/url), which makes the
 * upgrade path straightforward: install `@sentry/nextjs`, point its DSN at
 * Sentry, and replace this function's body with `Sentry.captureException` —
 * every call site already routes through here.
 *
 * Must never throw: error reporting can't be allowed to cause errors.
 */
export type ErrorContext = Record<string, unknown>;

export function reportError(error: unknown, context?: ErrorContext): void {
  const dsn = process.env.NEXT_PUBLIC_ERROR_REPORTING_DSN;
  if (!dsn) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const digest =
      typeof (error as { digest?: unknown })?.digest === 'string'
        ? (error as { digest: string }).digest
        : undefined;
    const payload = {
      name: err.name,
      message: err.message,
      // Cap the stack so payloads stay small.
      stack:
        typeof err.stack === 'string'
          ? err.stack.split('\n').slice(0, 20).join('\n')
          : undefined,
      digest,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: new Date().toISOString(),
      context,
    };
    void fetch(dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Reporting endpoint unreachable — nothing sensible to do.
    });
  } catch {
    // Never let reporting throw into product code.
  }
}
