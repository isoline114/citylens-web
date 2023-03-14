import { ArrowUpRight, Building2, MapPinned, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const authInputClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100';
export const authPrimaryButtonClass =
  'inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
export const authTextLinkClass =
  'font-semibold text-slate-950 underline-offset-4 transition hover:text-sky-700 hover:underline';
export const authAlertClass =
  'rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-900';
export const authStatusClass =
  'rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-950';

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className="mx-auto w-full max-w-4xl py-2 sm:py-6 lg:py-10"
      data-testid="auth-page-shell"
    >
      <div className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_28px_90px_-54px_rgba(15,23,42,0.55)] lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="relative overflow-hidden bg-slate-950 px-6 py-6 text-white sm:px-8 sm:py-7 lg:p-10">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex h-full flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
              <Building2 className="h-3.5 w-3.5" />
              CityLens workspace
            </div>
            <p className="mt-4 max-w-sm text-xl font-semibold tracking-[-0.035em] sm:mt-5 sm:text-3xl">
              Move from parcel signal to a defensible decision.
            </p>
            <p className="mt-3 hidden max-w-sm text-sm leading-6 text-slate-300 sm:block">
              One account keeps your ranked market, evidence, and pursuit work
              connected.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-slate-200 sm:mt-6 sm:text-xs lg:mt-auto lg:grid-cols-1 lg:pt-8">
              <div className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-sky-300" />
                Five-borough map
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Grounded evidence
              </div>
            </div>

            <Link
              href="/parcel-intel"
              className="mt-5 hidden w-fit items-center gap-1.5 text-xs font-semibold text-white underline-offset-4 hover:text-sky-200 hover:underline sm:inline-flex"
            >
              Explore Parcel Intelligence
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            {title}
          </h1>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            {description}
          </div>
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
