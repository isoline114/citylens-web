import Link from 'next/link';

import { ProductPageHeader } from '@/components/ProductPageHeader';
import { PRODUCT_ACCESS_COPY } from '@/lib/product-access';

export const metadata = {
  title: 'Pilot Pricing — CityLens',
  description: 'Pilot plans for NYC development-site acquisition teams.',
  alternates: {
    canonical: '/pricing',
  },
};

type Plan = {
  name: string;
  price: string;
  pricePrefix?: string;
  suffix?: string;
  description: string;
  cta: string;
  href: string;
  primary?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Explorer',
    price: 'Free',
    description: 'Use the complete product on your own acquisition work.',
    cta: 'Create an account',
    href: '/sign-up?next=%2Fparcel-intel',
  },
  {
    name: 'Acquisitions pilot',
    price: '$399',
    suffix: 'per user / month',
    description: 'Add a rollout partner to a live acquisition process.',
    cta: 'Request pilot access',
    href: '/contact?plan=acquisitions',
    primary: true,
  },
  {
    name: 'Concierge team pilot',
    pricePrefix: 'From',
    price: '$1,500',
    suffix: 'per month',
    description: 'Add reviewed opportunities and direct implementation support.',
    cta: 'Talk to CityLens',
    href: '/contact?plan=concierge',
  },
];

const NONE = '—';

// Values run in plan order: Explorer, Acquisitions pilot, Concierge team pilot.
// "Everything in ..." inheritance means every row an earlier plan includes
// is also included (not dashed) in the later plans.
type Row = { label: string; values: [string, string, string] };
const groups: { name: string; rows: Row[] }[] = [
  {
    name: 'Data and workspace',
    rows: [
      {
        label: PRODUCT_ACCESS_COPY.authenticatedWorkspace,
        values: ['Included', 'Included', 'Included'],
      },
      {
        label: 'Current evidence, parcel briefs, and exports',
        values: ['Included', 'Included', 'Included'],
      },
      {
        label: 'Saved pursuits, comparisons, and watches',
        values: ['Included', 'Included', 'Included'],
      },
      {
        label: PRODUCT_ACCESS_COPY.monthlyRuns,
        values: ['Included', 'Included', 'Included'],
      },
    ],
  },
  {
    name: 'People and support',
    rows: [
      {
        label: 'Acquisition-workflow setup',
        values: ['Self-serve', 'Guided', 'Team setup'],
      },
      {
        label: 'Monthly pipeline and evidence review',
        values: [NONE, 'Monthly', 'Monthly'],
      },
      {
        label: 'Reviewed opportunity briefs',
        values: [NONE, NONE, 'Included'],
      },
      {
        label: 'Bespoke data and API integration support',
        values: [NONE, NONE, 'Included'],
      },
      {
        label: 'Priority support and pilot roadmap access',
        values: [NONE, 'Included', 'Included'],
      },
    ],
  },
];

function PlanPrice({ plan }: { plan: Plan }) {
  return (
    <span className="mt-1.5 block text-[30px] font-extrabold leading-none tracking-[-0.02em] text-ink">
      {plan.pricePrefix ? (
        <span className="text-[13px] font-medium tracking-normal text-ink-3">
          {plan.pricePrefix}
        </span>
      ) : null}
      {plan.pricePrefix ? ' ' : null}
      {plan.price}
      {plan.suffix ? (
        <span className="text-[13px] font-medium tracking-normal text-ink-3">
          {' '}
          {plan.suffix}
        </span>
      ) : null}
    </span>
  );
}

function PlanCta({ plan }: { plan: Plan }) {
  return (
    <Link href={plan.href} className={plan.primary ? 'btn-primary' : 'btn'}>
      {plan.cta}
    </Link>
  );
}

function Value({ value }: { value: string }) {
  return (
    <span className={value === NONE ? 'text-ink-3' : 'font-semibold text-ink'}>
      {value === NONE ? (
        <>
          <span aria-hidden="true">{NONE}</span>
          <span className="sr-only">Not included</span>
        </>
      ) : (
        value
      )}
    </span>
  );
}

export default function PricingPage() {
  return (
    <div className="flex flex-col gap-8 py-2 sm:py-6">
      <ProductPageHeader
        title="The full citywide workspace is free with a verified account."
        description={
          <>
            <p>{PRODUCT_ACCESS_COPY.freeAccountSummary}</p>
            <p className="mt-2">
              Paid pilots add people: help setting up your acquisition
              workflow, a monthly review of your pipeline, and reviewed
              opportunity briefs. Pilot pricing is set in a written order.
            </p>
          </>
        }
        receipt={`${PRODUCT_ACCESS_COPY.publicPreview} for signed-out visitors`}
      />

      <section aria-label="CityLens plans">
        <div className="hidden min-[700px]:block">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              CityLens plans compared by what each includes
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-[34%] border-b border-ink pb-3 align-bottom"
                >
                  <span className="label-cond">Plan</span>
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.name}
                    scope="col"
                    className="border-b border-ink px-3.5 pb-3 align-bottom font-normal"
                  >
                    <h2 className="text-[17px] font-bold text-ink">{plan.name}</h2>
                    <PlanPrice plan={plan} />
                    <span className="mb-3 mt-2 block max-w-[30ch] text-[13px] font-normal text-ink-2">
                      {plan.description}
                    </span>
                    <PlanCta plan={plan} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows key={group.name} group={group} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 min-[700px]:hidden">
          {plans.map((plan, planIndex) => (
            <article
              key={plan.name}
              aria-label={`${plan.name} plan`}
              className="border-t-2 border-ink pt-3"
            >
              <h2 className="text-[17px] font-bold text-ink">{plan.name}</h2>
              <PlanPrice plan={plan} />
              <p className="mb-3 mt-2 text-[13px] text-ink-2">
                {plan.description}
              </p>
              <PlanCta plan={plan} />
              {groups.map((group) => (
                <section key={group.name} className="mt-4">
                  <h3 className="label-cond">{group.name}</h3>
                  <dl>
                    {group.rows.map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 border-b border-rule py-[7px] text-[13.5px]"
                      >
                        <dt className="text-ink-2">{row.label}</dt>
                        <dd className="text-right">
                          <Value value={row.values[planIndex]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </article>
          ))}
        </div>
      </section>

      <p className="max-w-[90ch] text-xs leading-5 text-ink-3">
        Pilot pricing is finalized in a written order; this page is not an
        automated checkout. CityLens supports screening and workflow. It is not
        legal, zoning, appraisal, brokerage or investment advice.
      </p>
    </div>
  );
}

function GroupRows({ group }: { group: { name: string; rows: Row[] } }) {
  return (
    <>
      <tr>
        <th
          colSpan={4}
          scope="colgroup"
          className="label-cond border-b border-ink-3 pb-2 pt-6 text-left"
        >
          {group.name}
        </th>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.label}>
          <th
            scope="row"
            className="border-b border-rule py-[11px] pr-3.5 align-top font-medium text-ink"
          >
            {row.label}
          </th>
          {row.values.map((value, index) => (
            <td
              key={plans[index].name}
              className="border-b border-rule px-3.5 py-[11px] align-top"
            >
              <Value value={value} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
