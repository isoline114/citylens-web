import type { Metadata } from 'next';
import Link from 'next/link';

import { ApiKeyList } from '@/components/api-keys/ApiKeyList';

export const metadata: Metadata = {
  title: 'API keys · CityLens',
  description:
    'Generate and revoke programmatic API keys for the CityLens REST API. Each key inherits your plan and monthly quota.',
};

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-sm text-slate-600">
          Mint a Bearer key to call CityLens from a script, a notebook, or a CI job. Keys
          inherit your plan limits — every run made with a key counts against your monthly
          quota the same as a dashboard run. See{' '}
          <Link href="/docs#auth" className="underline">the docs</Link> for examples.
        </p>
      </header>

      <ApiKeyList />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Quick test</h2>
        <p className="mt-1 text-xs text-slate-600">
          After you create a key, verify it from your terminal:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-[12px] leading-relaxed text-slate-100">
          <code>{`# Replace clk_live_… with the plaintext from the create response.
curl -s https://www.citylens.dev/v1/me \\
  -H "Authorization: Bearer clk_live_…" | jq '{user, quota}'`}</code>
        </pre>
        <p className="mt-3 text-xs text-slate-600">
          You should see your email, plan, and current monthly usage. If you get{' '}
          <code className="rounded bg-slate-100 px-1 text-[11px]">401</code>, the key was either
          revoked or never enabled — generate a new one.
        </p>
      </section>
    </div>
  );
}
