import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function ProductPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  receipt,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: LucideIcon;
  actions?: ReactNode;
  receipt?: ReactNode;
}) {
  return (
    <header
      className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_58%,#eef8ff_100%)] px-5 py-6 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.6)] sm:px-7 sm:py-7"
      data-testid="product-page-header"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
              <Icon className="h-3.5 w-3.5" />
            </span>
            {eyebrow}
          </div>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            {description}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {receipt ? (
        <div className="relative mt-5 border-t border-slate-200/80 pt-4">
          {receipt}
        </div>
      ) : null}
    </header>
  );
}
