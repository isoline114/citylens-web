'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Trash2, X } from 'lucide-react';

import { clearApiKey, getApiKey, setApiKey } from '@/lib/storage';
import { cn } from '@/lib/utils';

export function ApiKeyGate() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setApiKeyState(getApiKey());
    const onChanged = () => setApiKeyState(getApiKey());
    const onOpen = () => setOpen(true);
    window.addEventListener('citylens_api_key_changed', onChanged);
    window.addEventListener('citylens_open_api_key', onOpen);
    return () => {
      window.removeEventListener('citylens_api_key_changed', onChanged);
      window.removeEventListener('citylens_open_api_key', onOpen);
    };
  }, []);

  const missing = !apiKey;
  const label = useMemo(() => (missing ? 'Set API key' : 'API key set'), [missing]);

  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium',
          missing
            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
        )}
        onClick={() => setOpen(true)}
        aria-label="Configure API key"
      >
        <KeyRound className="h-4 w-4" />
        <span>{label}</span>
        <span
          className={cn(
            'ml-1 inline-flex h-2 w-2 rounded-full',
            missing ? 'bg-amber-500' : 'bg-emerald-500',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-16 mx-auto w-full max-w-lg px-4">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">API key</div>
                  <div className="text-xs text-slate-600">Stored locally as citylens_api_key (never logged).</div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 px-4 py-4">
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  type="password"
                  placeholder={missing ? 'Paste X-API-Key…' : 'Replace API key…'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => {
                      const next = draft.trim();
                      if (!next) return;
                      setApiKey(next);
                      window.dispatchEvent(new Event('citylens_api_key_changed'));
                      setApiKeyState(next);
                      setDraft('');
                      setOpen(false);
                    }}
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                    onClick={() => {
                      clearApiKey();
                      window.dispatchEvent(new Event('citylens_api_key_changed'));
                      setApiKeyState(null);
                      setDraft('');
                      setOpen(false);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </button>
                </div>

                <div className="text-xs text-slate-600">
                  Requests to <span className="font-mono">/v1/runs*</span> include <span className="font-mono">X-API-Key</span> when set.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
