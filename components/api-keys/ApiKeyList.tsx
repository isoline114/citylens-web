'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

import {
  ApiError,
  type ApiKeyRecord,
  type CreatedApiKeyRecord,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Status = 'idle' | 'loading' | 'error';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ApiKeyList() {
  const auth = useAuth();
  const signedIn = auth.status === 'authenticated';

  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreatedApiKeyRecord | null>(
    null,
  );
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    async function load() {
      setStatus('loading');
      setError(null);
      try {
        const items = await listApiKeys();
        if (cancelled) return;
        setKeys(items);
        setStatus('idle');
      } catch (e: unknown) {
        if (cancelled) return;
        setError(messageFor(e));
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    setCreateError(null);
    setCopyOk(false);
    try {
      const created = await createApiKey(label.trim());
      setJustCreated(created);
      setLabel('');
      // Refresh the list (the new key shows up minus the plaintext)
      const items = await listApiKeys();
      setKeys(items);
    } catch (e: unknown) {
      setCreateError(messageFor(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    const target = keys.find((k) => k.key_id === keyId);
    const confirmed = window.confirm(
      `Revoke "${target?.label ?? keyId}"? Existing scripts using this key will start receiving 401.`,
    );
    if (!confirmed) return;
    try {
      await revokeApiKey(keyId);
      setKeys((prev) => prev.filter((k) => k.key_id !== keyId));
    } catch (e: unknown) {
      setError(messageFor(e));
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1800);
    } catch {
      // Some browsers / iframes deny clipboard access; fall back to a
      // visible select-all hint via the input itself.
    }
  }

  if (!signedIn) {
    return (
      <section
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        data-testid="api-key-access-gate"
      >
        <div
          className="absolute inset-y-0 left-0 w-1 bg-sky-500"
          aria-hidden="true"
        />
        <div className="flex max-w-2xl gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Sign in to manage API keys
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Keys belong to your account and inherit its plan, quota, and audit
              trail.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/sign-in?next=%2Faccount%2Fapi-keys"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-up?next=%2Faccount%2Fapi-keys"
                className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Create a key
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Use a label that identifies the integration.
            </p>
          </div>
        </div>
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={handleCreate}
        >
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. acquisition-notebook"
            maxLength={128}
            required
            aria-label="Key label"
            className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !label.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate key
          </button>
        </form>
        {createError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-900">
            {createError}
          </div>
        )}
      </section>

      {/* One-time plaintext display */}
      {justCreated && (
        <section
          className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm sm:p-6"
          data-testid="api-key-plaintext-block"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-950">
            <ShieldCheck className="h-4 w-4" />
            Copy this key now
          </h2>
          <p className="mt-1 text-sm leading-5 text-emerald-900">
            It is shown once. Store it in a password manager or secret store.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-xl bg-slate-950 px-3.5 py-3 font-mono text-xs text-emerald-200">
              {justCreated.plaintext_key}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(justCreated.plaintext_key)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-950 hover:bg-emerald-100"
            >
              <Copy className="h-4 w-4" />
              {copyOk ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            className="mt-4 text-xs font-semibold text-emerald-950 underline underline-offset-4"
            onClick={() => setJustCreated(null)}
          >
            I&apos;ve saved it — dismiss
          </button>
        </section>
      )}

      {/* List of existing keys */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4 text-sm font-medium sm:px-6">
          <div>Active keys ({keys.length})</div>
          {status === 'loading' && (
            <div className="text-xs text-slate-500">Loading…</div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
              {error}
            </div>
          )}
          {keys.length === 0 && status !== 'loading' ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-600">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <KeyRound className="h-4 w-4" />
              </span>
              No active keys yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {keys.map((key) => (
                <li
                  key={key.key_id}
                  className="flex items-center justify-between gap-3 py-3"
                  data-testid="api-key-row"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {key.label}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">
                      {key.key_prefix}…
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Created {formatDate(key.created_at)}
                      {key.last_used_at
                        ? ` · last used ${formatDate(key.last_used_at)}`
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.key_id)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <QuickTest />
    </div>
  );
}

function QuickTest() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Terminal className="h-4 w-4" />
        Verify a key
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Call the account endpoint from your terminal.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-[12px] leading-relaxed text-slate-100">
        <code>{`curl -s https://api.citylens.dev/v1/me \\
  -H "Authorization: Bearer clk_live_…" | jq '{user, quota}'`}</code>
      </pre>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        A <code className="rounded bg-slate-200 px-1">401</code> means the key
        is invalid or revoked.
      </p>
    </section>
  );
}

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) {
      return (
        'API keys are not enabled for this environment yet. ' +
        'Contact support if you expected this to work.'
      );
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}
