'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { usePathname, useSelectedLayoutSegments } from 'next/navigation';

import { AuthHeaderControls } from '@/components/AuthHeaderControls';
import { PlanQuotaBadge } from '@/components/PlanQuotaBadge';

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/parcel-intel', label: 'Parcels' },
  { href: '/runs', label: 'Site evidence' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
] as const;

export function CityLensMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="1.5" y="1.5" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M1.5 10.5h17M8 1.5v17" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <rect x="8" y="10.5" width="10.5" height="8" fill="currentColor" />
    </svg>
  );
}

function normalizePathname(pathname: string | null): string {
  if (!pathname) return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function isCurrentRoute(
  pathname: string | null,
  segments: string[],
  href: string,
): boolean {
  const normalizedPathname = normalizePathname(pathname);
  if (href === '/') return segments.length === 0;
  return normalizedPathname.startsWith(href);
}

function navigationClass(current: boolean, mobile: boolean): string {
  if (mobile) {
    return `flex min-h-11 items-center border-l-2 px-3 text-sm ${
      current
        ? 'border-ink font-semibold text-ink'
        : 'border-transparent font-medium text-ink-2 hover:text-ink'
    }`;
  }
  return `inline-flex h-[51px] items-center border-b-2 text-sm transition-colors ${
    current
      ? 'border-ink font-semibold text-ink'
      : 'border-transparent font-medium text-ink-2 hover:text-ink'
  }`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments();

  return (
    <header className="sticky top-0 z-[1000] h-[52px] shrink-0 border-b border-rule bg-white">
      <div className="flex h-full w-full items-center gap-2 px-3.5 sm:px-5 lg:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-7">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-[9px] rounded-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2"
            aria-label="CityLens home"
          >
            <CityLensMark />
            <span className="hidden text-[17px] font-extrabold tracking-[-0.02em] text-ink min-[360px]:inline">
              CityLens
            </span>
          </Link>
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-5 md:flex"
          >
            {navigation.map((item) => {
              const current = isCurrentRoute(pathname, segments, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={navigationClass(current, false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <PlanQuotaBadge />
          <AuthHeaderControls />
        </div>

        <details className="group md:hidden" key={pathname}>
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-sm border border-control text-ink marker:hidden hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select" aria-label="Open navigation">
            <Menu className="h-4 w-4" aria-hidden="true" />
          </summary>
          <nav
            aria-label="Mobile primary navigation"
            className="absolute inset-x-0 top-full border-b border-rule bg-white p-3"
          >
            {navigation.map((item) => {
              const current = isCurrentRoute(pathname, segments, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={navigationClass(current, true)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </details>
      </div>
    </header>
  );
}
