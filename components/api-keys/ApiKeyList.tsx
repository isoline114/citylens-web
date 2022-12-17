'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, Trash2 } from 'lucide-react';

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
  const [justCreated, setJustCreated] = useState<CreatedApiKeyRecord | null>(null);
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
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        Sign in to manage API keys.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create form */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Create a new API key</h2>
        <p className="mt-1 text-xs text-slate-600">
          Pick a label so you remember where this key is used (e.g. <em>laptop</em>,{' '}
          <em>github-action</em>, <em>jupyter</em>).
        </p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleCreate}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. laptop"
            maxLength={128}
            required
            className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !label.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate key
          </button>
        </form>
        {createError && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {createError}
          </div>
        )}
      </section>

      {/* One-time plaintext display */}
      {justCreated && (
        <section
          className="rounded-lg border border-emerald-300 bg-emerald-50 p-4"
          data-testid="api-key-plaintext-block"
        >
          <h2 className="text-sm font-semibold text-emerald-900">
            Copy your key — this is the only time you&apos;ll see it
          </h2>
          <p className="mt-1 text-xs text-emerald-800">
            Store it in a password manager or a secret store. CityLens cannot recover it for you;
            if it&apos;s lost, revoke and create a new one.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-200">
              {justCreated.plaintext_key}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(justCreated.plaintext_key)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              <Copy className="h-4 w-4" />
              {copyOk ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            className="mt-3 text-xs font-medium text-emerald-900 underline"
            onClick={() => setJustCreated(null)}
          >
            I&apos;ve saved it — dismiss
          </button>
        </section>
      )}

      {/* List of existing keys */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-medium">
          <div>Active keys ({keys.length})</div>
          {status === 'loading' && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {error}
            </div>
          )}
          {keys.length === 0 && status !== 'loading' ? (
            <div className="text-sm text-slate-600">
              You don&apos;t have any active API keys yet. Generate one above.
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
                    <div className="text-sm font-medium text-slate-900">{key.label}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">
                      {key.key_prefix}…
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Created {formatDate(key.created_at)}
                      {key.last_used_at ? ` · last used ${formatDate(key.last_used_at)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.key_id)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
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
    </div>
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
