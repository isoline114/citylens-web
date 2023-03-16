import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';

import { PilotRequestForm } from './pilot-request-form';
import type { PilotPlan } from '@/lib/api';

export const metadata = {
  title: 'Request a Pilot — CityLens',
  description:
    'Request a working-session pilot for an NYC development-site acquisition team.',
};

function selectedPlan(value: string | undefined): PilotPlan {
  return value === 'concierge' ? 'concierge' : 'acquisitions';
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const initialPlan = selectedPlan(plan);

  return (
    <div className="mx-auto max-w-6xl py-8 md:py-14">
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Pilot options
      </Link>

      <div className="mt-6 grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)] lg:grid-cols-[0.88fr_1.12fr]">
        <section className="relative overflow-hidden bg-slate-950 p-6 text-white sm:p-7 md:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
              Design-partner intake
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl md:text-5xl">
              Bring one real acquisition workflow.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:mt-5 sm:text-base sm:leading-7">
              We&apos;ll work from your actual target neighborhoods, screening
              rules, data stack, and live pipeline—not a generic product tour.
            </p>

            <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-5">
              {[
                {
                  icon: Clock3,
                  title: 'Workflow review',
                  body: 'Review one live opportunity set and the decisions slowing your team.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Defined pilot',
                  body: 'Set users, borough coverage, workflow outcomes, and success criteria.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Private intake',
                  body: 'Your request stays in a private CityLens queue.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <p className="mt-1 hidden text-sm leading-6 text-slate-400 sm:block">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400 sm:mt-9 sm:pt-6">
              Prefer email? Write to{' '}
              <a
                className="font-medium text-sky-300 hover:text-sky-200"
                href={`mailto:hello@citylens.dev?subject=${encodeURIComponent(
                  `CityLens ${initialPlan} pilot`,
                )}`}
              >
                hello@citylens.dev
              </a>
              .
            </p>
          </div>
        </section>

        <section className="p-6 md:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
              Request a pilot
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Tell us enough to make the first call useful.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We&apos;ll review the request and reply personally. No payment is
              collected here.
            </p>
          </div>
          <PilotRequestForm initialPlan={initialPlan} />
        </section>
      </div>
    </div>
  );
}
