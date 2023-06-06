'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  Database,
  ImageIcon,
  LogIn,
  Map,
  MapPinned,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ProductPageHeader } from '@/components/ProductPageHeader';
import { RunForm } from '@/components/RunForm';
import { useAuth } from '@/lib/auth';
import { consumeRunPrefill, type RunPrefill } from '@/lib/run-prefill';

const EVIDENCE_SURFACES: {
  icon: LucideIcon;
  label: string;
  detail: string;
}[] = [
  { icon: ImageIcon, label: 'Imagery', detail: 'Current site context' },
  { icon: Map, label: 'Change', detail: 'Baseline-aware evidence' },
  { icon: Box, label: '3D massing', detail: 'Site geometry' },
  {
    icon: Database,
    label: 'QA receipt',
    detail: 'Sources, timings, and checks',
  },
];

export function NewRunWorkspace() {
  const auth = useAuth();
  const [prefill, setPrefill] = useState<RunPrefill | null>(null);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      setPrefill(consumeRunPrefill());
    }
  }, [auth.status]);

  if (auth.status === 'loading') {
    return <NewRunSkeleton />;
  }

  const signedIn = auth.status === 'authenticated';

  return (
    <div className="flex flex-col gap-5">
      <ProductPageHeader
        title="Start a new run"
        icon={Sparkles}
        description={
          signedIn
            ? 'Turn one NYC address into a tracked, review-ready evidence package.'
            : 'Sign in to process an NYC address and keep the resulting evidence with your account.'
        }
        actions={
          <Link
            href="/runs"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-control bg-white px-4 text-sm font-semibold text-ink hover:border-control hover:bg-paper-2 hover:text-select"
          >
            <ArrowLeft className="h-4 w-4" />
            Runs
          </Link>
        }
        receipt={
          signedIn ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-ink" />
                Account workspace
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-ink" />
                Status tracked in Runs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-ink" />
                Source and QA receipt included
              </span>
            </div>
          ) : null
        }
      />

      {!signedIn ? (
        <section
          data-testid="new-run-access-gate"
          className="relative overflow-hidden border-t border-rule bg-white p-6 text-ink sm:p-8"
        >
          <div className="relative grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <LogIn className="h-5 w-5" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Sign in before processing.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">
                Runs, progress, failures, and artifacts stay private to the
                account that created them.
              </p>
            </div>
            <div className="flex min-w-56 flex-col gap-2">
              <Link
                href="/sign-in?next=%2Fruns%2Fnew"
                className="btn-primary gap-2"
              >
                Sign in to continue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/runs#public-evidence"
                className="inline-flex h-10 items-center justify-center text-xs font-medium text-ink-2 hover:text-ink"
              >
                Review a public evidence package
              </Link>
            </div>
          </div>
          <div className="relative mt-7 grid grid-cols-2 gap-4 border-t border-rule py-4 sm:grid-cols-4">
            {EVIDENCE_SURFACES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="bg-white p-4">
                <Icon className="h-4 w-4 text-ink" />
                <div className="mt-2 text-sm font-semibold text-ink">{label}</div>
                <div className="mt-0.5 text-xs leading-5 text-ink-3">{detail}</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-start">
          <section
            className="border-t border-rule bg-white p-5 sm:p-7"
            aria-labelledby="new-run-request-heading"
          >
            <div className="mb-5 border-b border-rule pb-4">
              <h2
                id="new-run-request-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-ink"
              >
                Define the evidence package
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Enter the site, choose the review outputs, and start processing.
              </p>
              {prefill && (
                <div
                  data-testid="parcel-run-prefill-receipt"
                  className="mt-4 flex items-start gap-3 border-t border-rule bg-paper-2 px-3.5 py-3 text-ink"
                >
                  <MapPinned className="h-4 w-4" />
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-ink-3">
                      From parcel intelligence · BBL {formatBbl(prefill.bbl)}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium">
                      {formatAddress(prefill.address)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink">
                      Address prefilled for processing; verify it before starting.
                    </span>
                  </span>
                </div>
              )}
            </div>
            <RunForm
              showFeaturedDemos={false}
              submitLabel="Start processing"
              initialAddress={prefill?.address}
            />
          </section>

          <aside className="overflow-hidden border-t border-rule bg-white text-ink lg:sticky lg:top-24">
            <div className="border-b border-rule px-5 py-5">
              <h2 className="mt-1 text-lg font-semibold">
                One request, four review surfaces.
              </h2>
            </div>
            <div className="grid gap-px bg-white">
              {EVIDENCE_SURFACES.map(({ icon: ItemIcon, label, detail }) => {
                return (
                  <div
                    key={label}
                    className="flex items-center gap-3 bg-white px-5 py-4"
                  >
                    <ItemIcon className="h-4 w-4" />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-ink-3">{detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-rule px-5 py-4 text-xs leading-5 text-ink-3">
              Screening evidence supports review; it is not a survey,
              appraisal, title report, or zoning determination.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function NewRunSkeleton() {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-label="Checking run workspace access"
    >
      <div className="h-44 animate-pulse border-t border-rule" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="h-[560px] animate-pulse border-t border-rule" />
        <div className="h-80 animate-pulse rounded-sm bg-white" />
      </div>
    </div>
  );
}
