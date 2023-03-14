import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

export const metadata = {
  title: 'Pilot Pricing — CityLens',
  description: 'Pilot plans for NYC development-site acquisition teams.',
};

const plans = [
  {
    name: 'Explorer',
    price: 'Free',
    description: 'Evaluate the data and aerial-change workflow.',
    features: ['Public parcel preview', '5 custom imagery runs / month', 'CSV sample and API docs'],
    cta: 'Create an account',
    href: '/sign-up',
  },
  {
    name: 'Acquisitions pilot',
    price: '$399',
    suffix: '/ user / month',
    description: 'For professionals building and managing a site pipeline.',
    features: ['Full five-borough ranked workspace', 'Saved sites, stages, notes and watches', 'Current-fact provenance and parcel briefs', 'Saved views and exports'],
    cta: 'Request pilot access',
    href: '/contact?plan=acquisitions',
    featured: true,
  },
  {
    name: 'Concierge team pilot',
    price: 'From $1,500',
    suffix: '/ month',
    description: 'For teams that want reviewed opportunities and direct onboarding.',
    features: ['Everything in Acquisitions', 'Reviewed opportunity briefs', 'Team workflow setup', 'Data/API integration support'],
    cta: 'Talk to CityLens',
    href: '/contact?plan=concierge',
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl py-8 md:py-12">
      <div className="max-w-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Design-partner pricing</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Pay for a better acquisition process—not another database.</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Pilot plans are intentionally simple while we measure time saved, sites pursued,
          owner conversations, and underwriting outcomes with early NYC development teams.
        </p>
      </div>
      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className={`rounded-2xl border p-6 shadow-sm ${plan.featured ? 'border-sky-400 bg-sky-50/40 ring-1 ring-sky-200' : 'border-slate-200 bg-white'}`}>
            <h2 className="text-lg font-semibold text-slate-950">{plan.name}</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
              {plan.suffix && <span className="text-xs text-slate-500">{plan.suffix}</span>}
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>
              ))}
            </ul>
            <Link href={plan.href} className={`mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium ${plan.featured ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}>
              {plan.cta}<ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </section>
      <p className="mt-6 text-xs leading-5 text-slate-500">
        Pilot pricing is non-binding and subject to a written order. Authenticated evaluation
        accounts may temporarily receive pilot features during the design-partner period; this
        page is not an automated checkout or entitlement system. CityLens is a screening and
        workflow product, not zoning, legal, appraisal, brokerage, or investment advice.
      </p>
    </div>
  );
}
