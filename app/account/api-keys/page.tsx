import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, KeyRound } from 'lucide-react';

import { ApiKeyList } from '@/components/api-keys/ApiKeyList';
import { ProductPageHeader } from '@/components/ProductPageHeader';

export const metadata: Metadata = {
  title: 'API keys · CityLens',
  description:
    'Generate and revoke programmatic API keys for the CityLens REST API. Each key inherits your plan and monthly quota.',
};

export default function ApiKeysPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-2 sm:py-6">
      <ProductPageHeader
        eyebrow="Developer access"
        title="API keys"
        icon={KeyRound}
        description="Create revocable Bearer keys for scripts, notebooks, and integrations. Usage follows your account quota."
        actions={
          <Link
            href="/docs#auth"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
          >
            Authentication docs
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      <ApiKeyList />
    </div>
  );
}
