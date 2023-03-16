import { ArrowUpRight, FileCheck2, Mail, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

type NavigationItem = {
  id: string;
  label: string;
};

export function LegalDocumentShell({
  eyebrow,
  title,
  summary,
  effectiveDate,
  navigation,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  effectiveDate: string;
  navigation: NavigationItem[];
  children: ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full max-w-5xl py-2 sm:py-6"
      data-testid="legal-document-shell"
    >
      <header className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 px-5 py-7 text-white shadow-[0_28px_80px_-52px_rgba(15,23,42,0.75)] sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            {summary}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-300">
            <FileCheck2 className="h-3.5 w-3.5 text-emerald-300" />
            Effective {effectiveDate}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label={`${title} sections`}
            className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              On this page
            </div>
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {navigation.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-9 items-center rounded-lg px-3 py-2 text-xs font-medium leading-4 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 space-y-3">{children}</article>
      </div>

      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Questions about this document?
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Contact CityLens for access, correction, or policy questions.
          </p>
        </div>
        <a
          href="mailto:hello@citylens.dev"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          <Mail className="h-4 w-4" />
          hello@citylens.dev
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </section>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_45px_-40px_rgba(15,23,42,0.42)] sm:px-6"
    >
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 [&_a]:font-semibold [&_a]:text-sky-800 [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
