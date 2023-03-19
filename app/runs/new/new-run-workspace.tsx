'use client';

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
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ProductPageHeader } from '@/components/ProductPageHeader';
import { RunForm } from '@/components/RunForm';
import { useAuth } from '@/lib/auth';

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

  if (auth.status === 'loading') {
    return <NewRunSkeleton />;
  }

  const signedIn = auth.status === 'authenticated';

  return (
    <div className="flex flex-col gap-5">
      <ProductPageHeader
        eyebrow="Processing workspace"
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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:border-sky-300 hover:bg-sky-50 hover:text-sky-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Runs
          </Link>
        }
        receipt={
          signedIn ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Account workspace
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-sky-600" />
                Status tracked in Runs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-violet-600" />
                Source and QA receipt included
              </span>
            </div>
          ) : null
        }
      />

      {!signedIn ? (
        <section
          data-testid="new-run-access-gate"
          className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)] sm:p-8"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="relative grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sky-300">
                <LogIn className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Sign in before processing.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Runs, progress, failures, and artifacts stay private to the
                account that created them.
              </p>
            </div>
            <div className="flex min-w-56 flex-col gap-2">
              <Link
                href="/sign-in?next=%2Fruns%2Fnew"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-sky-50"
              >
                Sign in to continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/runs#public-evidence"
                className="inline-flex h-10 items-center justify-center text-xs font-medium text-slate-300 hover:text-white"
              >
                Review a public evidence package
              </Link>
            </div>
          </div>
          <div className="relative mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {EVIDENCE_SURFACES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="bg-slate-950/80 p-4">
                <Icon className="h-4 w-4 text-sky-300" />
                <div className="mt-2 text-sm font-semibold text-white">{label}</div>
                <div className="mt-0.5 text-xs leading-5 text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-start">
          <section
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.4)] sm:p-7"
            aria-labelledby="new-run-request-heading"
          >
            <div className="mb-5 border-b border-slate-200 pb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
                Processing request
              </div>
              <h2
                id="new-run-request-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
              >
                Define the evidence package
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Enter the site, choose the review outputs, and start processing.
              </p>
            </div>
            <RunForm
              showFeaturedDemos={false}
              submitLabel="Start processing"
            />
          </section>

          <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-[0_18px_55px_-38px_rgba(15,23,42,0.55)] lg:sticky lg:top-24">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
                Evidence package
              </div>
              <h2 className="mt-1 text-lg font-semibold">
                One request, four review surfaces.
              </h2>
            </div>
            <div className="grid gap-px bg-white/10">
              {EVIDENCE_SURFACES.map(({ icon: ItemIcon, label, detail }) => {
                return (
                  <div
                    key={label}
                    className="flex items-center gap-3 bg-slate-950 px-5 py-4"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-300">
                      <ItemIcon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-slate-400">{detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-400">
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
      <div className="h-44 animate-pulse rounded-[1.75rem] bg-slate-100" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="h-[560px] animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-80 animate-pulse rounded-3xl bg-slate-900" />
      </div>
    </div>
  );
}
