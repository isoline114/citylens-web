import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function ProductPageHeader({
  title,
  description,
  actions,
  receipt,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  receipt?: ReactNode;
  /** Retired props: accepted so existing callers compile, never rendered. */
  eyebrow?: string;
  icon?: LucideIcon;
}) {
  return (
    <header data-testid="product-page-header">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[32px]">
            {title}
          </h1>
          <div className="mt-2 max-w-[60ch] text-[15px] leading-6 text-ink-2">
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
        <div className="mt-4 font-mono text-xs text-ink-3">{receipt}</div>
      ) : null}
    </header>
  );
}
