'use client';

import { useEffect, useState } from 'react';

import { getApiKey } from '@/lib/storage';

export function DemoModeBanner() {
  const [apiKeyPresent, setApiKeyPresent] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setApiKeyPresent(Boolean(getApiKey()));
    sync();
    window.addEventListener('citylens_api_key_changed', sync);
    return () => window.removeEventListener('citylens_api_key_changed', sync);
  }, []);

  // Avoid a hydration flash: don’t render until we’ve checked localStorage.
  if (apiKeyPresent === null) return null;
  if (apiKeyPresent) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-2 text-sm text-amber-900">
        Demo mode (precomputed) — set an API key to run new jobs.
      </div>
    </div>
  );
}
