import Link from 'next/link';

export const metadata = {
  title: 'Contact — CityLens',
  description: 'Request a CityLens design-partner or acquisitions pilot.',
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const subject = encodeURIComponent(`CityLens ${plan ?? 'acquisitions'} pilot`);
  return (
    <main className="mx-auto max-w-3xl py-10 md:py-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Design partners</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Bring one real acquisition workflow.</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          We&apos;ll use a short working session to understand your target neighborhoods,
          screening rules, current data stack, and what makes a lead worth a call. The best
          pilots start with a live pipeline—not a generic product tour.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={`mailto:hello@citylens.dev?subject=${subject}`} className="inline-flex h-11 items-center rounded-md bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800">
            Email hello@citylens.dev
          </a>
          <Link href="/parcel-intel" className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50">
            Explore the product first
          </Link>
        </div>
      </div>
    </main>
  );
}
