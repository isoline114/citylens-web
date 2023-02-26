import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportError } from './error-reporting';

describe('reportError', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('no-ops when NEXT_PUBLIC_ERROR_REPORTING_DSN is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ERROR_REPORTING_DSN', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    reportError(new Error('boom'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs a minimal JSON payload to the DSN when set', () => {
    vi.stubEnv('NEXT_PUBLIC_ERROR_REPORTING_DSN', 'https://errors.example.com/report');
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);

    const err = new Error('boom') as Error & { digest?: string };
    err.digest = 'abc123';
    reportError(err, { boundary: 'app/error' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://errors.example.com/report');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body);
    expect(body.name).toBe('Error');
    expect(body.message).toBe('boom');
    expect(body.digest).toBe('abc123');
    expect(body.context).toEqual({ boundary: 'app/error' });
  });

  it('never throws, even when fetch itself throws synchronously', () => {
    vi.stubEnv('NEXT_PUBLIC_ERROR_REPORTING_DSN', 'https://errors.example.com/report');
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch exploded');
    });
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });

  it('wraps non-Error values', () => {
    vi.stubEnv('NEXT_PUBLIC_ERROR_REPORTING_DSN', 'https://errors.example.com/report');
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);
    reportError('string failure');
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.message).toBe('string failure');
  });
});
