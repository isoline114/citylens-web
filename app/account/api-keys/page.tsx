import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, KeyRound } from 'lucide-react';

import { ApiKeyList } from '@/components/api-keys/ApiKeyList';

export const metadata: Metadata = {
  title: 'API keys · CityLens',
  description:
    'Generate and revoke programmatic API keys for the CityLens REST API. Each key inherits your plan and monthly quota.',
};

export default function ApiKeysPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-2 sm:py-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
            <KeyRound className="h-4 w-4" />
            Developer access
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            API keys
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create revocable Bearer keys for scripts, notebooks, and
            integrations. Usage follows your account quota.
          </p>
        </div>
        <Link
          href="/docs#auth"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Authentication docs
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      <ApiKeyList />
    </div>
  );
}
