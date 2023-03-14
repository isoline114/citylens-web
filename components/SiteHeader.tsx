'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AuthHeaderControls } from '@/components/AuthHeaderControls';
import { PlanQuotaBadge } from '@/components/PlanQuotaBadge';
import { publicAssetPath } from '@/lib/site';

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/runs', label: 'Runs' },
  { href: '/parcel-intel', label: 'Parcels' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
] as const;

function normalizePathname(pathname: string | null): string {
  if (!pathname) return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function isCurrentRoute(pathname: string | null, href: string): boolean {
  const normalizedPathname = normalizePathname(pathname);
  return href === '/'
    ? normalizedPathname === href
    : normalizedPathname.startsWith(href);
}

function navigationClass(current: boolean, mobile: boolean): string {
  if (mobile) {
    return `shrink-0 border-b-2 px-0.5 pb-2 pt-1 text-sm font-medium transition-colors ${
      current
        ? 'border-sky-500 text-slate-950'
        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950'
    }`;
  }
  return `rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    current
      ? 'bg-slate-100 text-slate-950'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
  }`;
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200/90 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 xl:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label="CityLens home"
          >
            <Image
              src={publicAssetPath('/citylens-mark.png')}
              alt=""
              width={24}
              height={24}
              priority
            />
            <span className="text-lg font-semibold tracking-[-0.02em]">
              CityLens
            </span>
          </Link>
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {navigation.map((item) => {
              const current = isCurrentRoute(pathname, item.href);
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

        <div className="ml-auto flex max-w-full shrink-0 items-center gap-1.5 sm:gap-2">
          <PlanQuotaBadge />
          <AuthHeaderControls />
        </div>

        <nav
          aria-label="Mobile primary navigation"
          className="flex w-full items-center gap-5 overflow-x-auto pt-0.5 md:hidden"
        >
          {navigation.map((item) => {
            const current = isCurrentRoute(pathname, item.href);
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
      </div>
    </header>
  );
}
