import Link from 'next/link';
import { ArrowRight, Building2, Check, ShieldCheck } from 'lucide-react';

import { ProductPageHeader } from '@/components/ProductPageHeader';
import { PRODUCT_ACCESS_COPY } from '@/lib/product-access';

export const metadata = {
  title: 'Pilot Pricing — CityLens',
  description: 'Pilot plans for NYC development-site acquisition teams.',
  alternates: {
    canonical: '/pricing',
  },
};

const plans = [
  {
    name: 'Explorer',
    kicker: 'Start here',
    price: 'Free',
    description: 'Use the complete product on your own acquisition work.',
    features: [
      PRODUCT_ACCESS_COPY.authenticatedWorkspace,
      'Current evidence, parcel briefs, and exports',
      'Saved pursuits, comparisons, and watches',
      PRODUCT_ACCESS_COPY.monthlyRuns,
    ],
    cta: 'Create an account',
    href: '/sign-up?next=%2Fparcel-intel',
  },
  {
    name: 'Acquisitions pilot',
    kicker: 'Best for active teams',
    price: '$399',
    suffix: '/ user / month',
    description: 'Add a rollout partner to a live acquisition process.',
    features: [
      'Everything in Explorer',
      'Guided acquisition-workflow setup',
      'Monthly pipeline and evidence review',
      'Priority support and pilot roadmap access',
    ],
    cta: 'Request pilot access',
    href: '/contact?plan=acquisitions',
    featured: true,
  },
  {
    name: 'Concierge team pilot',
    kicker: 'Hands-on rollout',
    price: 'From $1,500',
    suffix: '/ month',
    description: 'Add reviewed opportunities and direct implementation support.',
    features: [
      'Everything in Acquisitions pilot',
      'Reviewed opportunity briefs',
      'Team workflow setup',
      'Bespoke data and API integration support',
    ],
    cta: 'Talk to CityLens',
    href: '/contact?plan=concierge',
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-2 sm:py-6">
      <ProductPageHeader
        eyebrow="Design-partner plans"
        title="Explore the full market free. Pay for hands-on leverage."
        icon={Building2}
        description={PRODUCT_ACCESS_COPY.freeAccountSummary}
        receipt={
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600">
            {[
              PRODUCT_ACCESS_COPY.publicPreview,
              PRODUCT_ACCESS_COPY.authenticatedWorkspace,
              'Paid pilots add guided rollout',
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {item}
              </span>
            ))}
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3" aria-label="CityLens plans">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`relative flex flex-col overflow-hidden rounded-3xl border p-6 shadow-[0_22px_65px_-48px_rgba(15,23,42,0.7)] ${
              plan.featured
                ? 'border-slate-800 bg-slate-950 text-white'
                : 'border-slate-200 bg-white text-slate-950'
            }`}
          >
            {plan.featured ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-500/20 blur-3xl"
              />
            ) : null}
            <div className="relative flex h-full flex-col">
              <div
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  plan.featured ? 'text-sky-300' : 'text-sky-700'
                }`}
              >
                {plan.kicker}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{plan.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">
                  {plan.price}
                </span>
                {plan.suffix ? (
                  <span
                    className={`text-xs ${
                      plan.featured ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {plan.suffix}
                  </span>
                ) : null}
              </div>
              <p
                className={`mt-3 min-h-12 text-sm leading-6 ${
                  plan.featured ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {plan.description}
              </p>
              <ul
                className={`mt-5 space-y-2.5 text-sm ${
                  plan.featured ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.featured ? 'text-emerald-300' : 'text-emerald-600'
                      }`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                  plan.featured
                    ? 'bg-white text-slate-950 hover:-translate-y-0.5 hover:bg-sky-50'
                    : 'border border-slate-300 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-400'
                }`}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <p className="mx-auto max-w-4xl text-center text-xs leading-5 text-slate-500">
        Pilot pricing is finalized in a written order; this page is not an
        automated checkout. CityLens supports screening and workflow—not
        legal, zoning, appraisal, brokerage, or investment advice.
      </p>
    </div>
  );
}
