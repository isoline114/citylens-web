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
import { CodeBlock } from '@/components/docs/CodeBlock';

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
        className="relative overflow-hidden border-t border-rule bg-white p-6 sm:p-8"
        data-testid="api-key-access-gate"
      >
        <div
          className="absolute inset-y-0 left-0 w-1 bg-white"
          aria-hidden="true"
        />
        <div className="flex max-w-2xl gap-4">
          <KeyRound className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Sign in to manage API keys
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-2">
              Keys belong to your account and inherit its plan, quota, and audit
              trail.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/sign-in?next=%2Faccount%2Fapi-keys"
                className="inline-flex h-10 items-center gap-2 rounded-sm bg-ink px-4 text-sm font-semibold text-white hover:bg-ink"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-up?next=%2Faccount%2Fapi-keys"
                className="inline-flex h-10 items-center rounded-sm border border-control bg-white px-4 text-sm font-semibold text-ink hover:bg-paper-2"
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
      <section className="border-t border-rule bg-white p-5 sm:p-6">
        <div className="flex gap-3">
          <KeyRound className="h-4 w-4" />
          <div>
            <h2 className="text-base font-semibold text-ink">
              Create a key
            </h2>
            <p className="mt-1 text-sm leading-5 text-ink-2">
              Use a label that identifies the integration.
            </p>
          </div>
        </div>
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={handleCreate}
        >
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-ink">
            Key label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. acquisition-notebook"
            maxLength={128}
            required
            aria-label="Key label"
            className="field h-11 flex-1 rounded-sm border border-control bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-select focus:ring-4 focus:ring-select"
            disabled={creating}
          />
          {createError && <span className="text-sm font-normal text-red-700" role="alert">{createError}</span>}
          </label>
          <button
            type="submit"
            disabled={creating || !label.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-ink px-4 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate key
          </button>
        </form>
      </section>

      {/* One-time plaintext display */}
      {justCreated && (
        <section
          className="border-t border-rule bg-paper-2 p-5 sm:p-6"
          data-testid="api-key-plaintext-block"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <ShieldCheck className="h-4 w-4" />
            Copy this key now
          </h2>
          <p className="mt-1 text-sm leading-5 text-ink">
            It is shown once. Store it in a password manager or secret store.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto border-b border-rule px-3.5 py-3 font-mono text-xs text-ink">
              {justCreated.plaintext_key}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(justCreated.plaintext_key)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-control bg-white px-4 text-sm font-semibold text-ink hover:bg-paper-2"
            >
              <Copy className="h-4 w-4" />
              {copyOk ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            className="mt-4 text-xs font-semibold text-select underline underline-offset-4"
            onClick={() => setJustCreated(null)}
          >
            I&apos;ve saved it. Dismiss
          </button>
        </section>
      )}

      {/* List of existing keys */}
      <section className="overflow-hidden border-t border-rule bg-white">
        <div className="flex items-center justify-between border-b border-rule bg-white px-5 py-4 text-sm font-medium sm:px-6">
          <div>Active keys ({keys.length})</div>
          {status === 'loading' && (
            <div className="text-xs text-ink-3">Loading…</div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          {error && (
            <div className="mb-4 border-t border-rule py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {keys.length === 0 && status !== 'loading' ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-ink-2">
              <KeyRound className="h-4 w-4" />
              No active keys yet.
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {keys.map((key) => (
                <li
                  key={key.key_id}
                  className="flex items-center justify-between gap-3 py-3"
                  data-testid="api-key-row"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">
                      {key.label}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-ink-3">
                      {key.key_prefix}…
                    </div>
                    <div className="mt-1 text-xs text-ink-3">
                      Created {formatDate(key.created_at)}
                      {key.last_used_at
                        ? ` · last used ${formatDate(key.last_used_at)}`
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.key_id)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-red-700 hover:bg-white"
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
    <section className="border-t border-rule bg-paper-2 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Terminal className="h-4 w-4" />
        Verify a key
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Call the account endpoint from your terminal.
      </p>
      <div className="mt-4"><CodeBlock language="bash">{`curl -s https://api.citylens.dev/v1/me \\
  -H "Authorization: Bearer clk_live_…" | jq '{user, quota}'`}</CodeBlock></div>
      <p className="mt-3 text-xs leading-5 text-ink-3">
        A <code className="rounded-sm bg-paper-2 px-1">401</code> means the key
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
