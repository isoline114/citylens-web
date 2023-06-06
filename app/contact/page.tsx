import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PilotRequestForm } from './pilot-request-form';
import type { PilotPlan } from '@/lib/api';

export const metadata = {
  title: 'Request a Pilot — CityLens',
  description:
    'Request a working-session pilot for an NYC development-site acquisition team.',
  alternates: {
    canonical: '/contact',
  },
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
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Pilot options
      </Link>

      <div className="mt-6 grid overflow-hidden border-t border-rule bg-white lg:grid-cols-[0.88fr_1.12fr]">
        <section className="relative overflow-hidden bg-white p-6 text-ink sm:p-7 md:p-10">
          <div className="relative">
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl md:text-5xl">
              Bring one real acquisition workflow.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink-2 sm:mt-5 sm:text-base sm:leading-7">
              We&apos;ll work from your actual target neighborhoods, screening
              rules, data stack, and live pipeline.
            </p>

            <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-5">
              {[
                {
                  title: 'Workflow review',
                  body: 'Review one live opportunity set and the decisions slowing your team.',
                },
                {
                  title: 'Defined pilot',
                  body: 'Set users, borough coverage, workflow outcomes, and success criteria.',
                },
                {
                  title: 'Private intake',
                  body: 'Your request stays in a private CityLens queue.',
                },
              ].map(({ title, body }) => (
                <div key={title} className="border-t border-rule py-3">
                  <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <p className="mt-1 hidden text-sm leading-6 text-ink-3 sm:block">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 border-t border-rule pt-5 text-xs leading-5 text-ink-3 sm:mt-9 sm:pt-6">
              Prefer email? Write to{' '}
              <a
                className="font-medium text-ink hover:text-ink"
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
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              Tell us enough to make the first call useful.
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-2">
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
