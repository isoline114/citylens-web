import { describe, expect, it, vi } from 'vitest';

// Avoid importing the real Neon Auth server client (env-driven) — the
// default-parameter path isn't what we exercise here.
vi.mock('./server', () => ({ neonAuth: null, isNeonAuthConfigured: false }));

import { hasValidSession } from './session.server';

describe('hasValidSession', () => {
  it('returns true when Neon Auth is not configured (null client)', async () => {
    await expect(hasValidSession(null)).resolves.toBe(true);
  });

  it('returns true for a present session', async () => {
    const client = {
      getSession: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    };
    await expect(hasValidSession(client)).resolves.toBe(true);
    expect(client.getSession).toHaveBeenCalledTimes(1);
  });

  it('returns false for a missing session', async () => {
    const client = { getSession: vi.fn().mockResolvedValue({ data: null }) };
    await expect(hasValidSession(client)).resolves.toBe(false);
  });

  it('fails CLOSED when the session check throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = {
      getSession: vi.fn().mockRejectedValue(new Error('upstream 503')),
    };
    await expect(hasValidSession(client)).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('fails CLOSED when getSession throws synchronously', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = {
      getSession: () => {
        throw new Error('boom');
      },
    };
    await expect(hasValidSession(client)).resolves.toBe(false);
  });
});
