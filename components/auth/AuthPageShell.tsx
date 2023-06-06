import Link from 'next/link';
import type { ReactNode } from 'react';

export const authInputClass = 'field';
export const authPrimaryButtonClass = 'btn-primary w-full';
export const authTextLinkClass = 'font-medium text-select underline-offset-4 hover:underline';
export const authAlertClass = 'text-sm text-red-700';
export const authStatusClass = 'border-t border-rule py-3 text-sm text-ink-2';

export function AuthPageShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-lg py-6 sm:py-10" data-testid="auth-page-shell">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        <div className="mt-2 text-sm leading-6 text-ink-2">{description}</div>
      </header>
      <div className="mt-6 border-t border-rule pt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-rule pt-5 text-sm text-ink-2">{footer}</div> : null}
      <div className="mt-6 border-t border-rule pt-4">
        <Link href="/parcel-intel" className="text-sm font-medium text-select hover:underline">Explore Parcel Intelligence</Link>
      </div>
    </section>
  );
}
