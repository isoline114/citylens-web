import { ArrowUpRight, Mail } from 'lucide-react';
import type { ReactNode } from 'react';

type NavigationItem = {
  id: string;
  label: string;
};

export function LegalDocumentShell({
  title,
  summary,
  effectiveDate,
  navigation,
  children,
}: {
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
      <header className="relative overflow-hidden border-t border-rule bg-white px-5 py-7 text-ink sm:px-8 sm:py-9">
        <div className="relative max-w-3xl">
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-2 sm:text-base">
            {summary}
          </p>
          <div className="mt-5 border-t border-rule pt-3 font-mono text-xs text-ink-3">
            Effective {effectiveDate}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label={`${title} sections`}
            className="border-t border-rule py-2"
          >
            <div className="font-cond px-3 pb-1.5 pt-2 text-[13px] font-semibold text-ink-3">
              On this page
            </div>
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {navigation.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-9 items-center rounded-sm px-3 py-2 text-xs font-medium leading-4 text-ink-2 transition hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
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

      <section className="mt-5 flex flex-col gap-3 border-t border-rule bg-paper-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Questions about this document?
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink-2">
            Contact CityLens for access, correction, or policy questions.
          </p>
        </div>
        <a
          href="mailto:hello@citylens.dev"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2"
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
      className="scroll-mt-24 border-t border-rule bg-white px-5 py-5 sm:px-6"
    >
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-ink-2 [&_a]:font-semibold [&_a]:text-select [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
