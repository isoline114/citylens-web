import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import '../styles/globals.css';

import { AuthHeaderControls } from '@/components/AuthHeaderControls';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { PlanQuotaBadge } from '@/components/PlanQuotaBadge';
import { SafeAnalytics } from '@/components/SafeAnalytics';
import { Toasts } from '@/components/Toasts';
import { AuthProvider } from '@/lib/auth';
import { AuthTokenBridge } from '@/lib/auth/AuthTokenBridge';
import { publicAssetPath } from '@/lib/site';

const title = 'CityLens';
const description =
  'Find, qualify, and pursue NYC development-site opportunities with current parcel facts, ownership context, aerial evidence, and acquisition workflow.';

export const metadata: Metadata = {
  // Canonical host is www — matches the production deployment and sitemap.
  metadataBase: new URL('https://www.citylens.dev'),
  title,
  description,
  openGraph: {
    title,
    description,
    images: [publicAssetPath('/opengraph-image.png')],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [publicAssetPath('/opengraph-image.png')],
  },
  icons: {
    icon: [{ url: publicAssetPath('/favicon.ico') }, { url: publicAssetPath('/icon.png'), type: 'image/png' }],
    apple: [{ url: publicAssetPath('/apple-touch-icon.png') }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-950" suppressHydrationWarning>
        <AuthProvider>
          <AuthTokenBridge />
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-5">
                <Link href="/" className="flex shrink-0 items-center gap-2">
                  <Image src={publicAssetPath('/citylens-mark.png')} alt="CityLens" width={24} height={24} priority />
                  <span className="text-lg font-semibold">CityLens</span>
                </Link>
                <nav className="hidden items-center gap-4 text-sm md:flex lg:gap-5">
                  <Link href="/" className="text-slate-700 hover:text-slate-950">
                    Home
                  </Link>
                  <Link href="/runs" className="text-slate-700 hover:text-slate-950">
                    Runs
                  </Link>
                  <Link href="/parcel-intel" className="text-slate-700 hover:text-slate-950">
                    Parcels
                  </Link>
                  <Link href="/pricing" className="text-slate-700 hover:text-slate-950">
                    Pricing
                  </Link>
                  <Link href="/docs" className="text-slate-700 hover:text-slate-950">
                    Docs
                  </Link>
                </nav>
              </div>

              <div className="ml-auto flex max-w-full shrink-0 items-center gap-1.5 sm:gap-2">
                <PlanQuotaBadge />
                <AuthHeaderControls />
              </div>

              <nav className="flex w-full items-center gap-4 overflow-x-auto pt-1 text-sm md:hidden">
                <Link href="/" className="shrink-0 text-slate-700 hover:text-slate-950">
                  Home
                </Link>
                <Link href="/runs" className="shrink-0 text-slate-700 hover:text-slate-950">
                  Runs
                </Link>
                <Link href="/parcel-intel" className="shrink-0 text-slate-700 hover:text-slate-950">
                  Parcels
                </Link>
                <Link href="/pricing" className="shrink-0 text-slate-700 hover:text-slate-950">
                  Pricing
                </Link>
                <Link href="/docs" className="shrink-0 text-slate-700 hover:text-slate-950">
                  Docs
                </Link>
              </nav>
            </div>
          </header>

          <DemoModeBanner />

          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <SiteFooter />
          <Toasts />
        </AuthProvider>
        <SafeAnalytics />
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Image
            src={publicAssetPath('/citylens-mark.png')}
            alt=""
            width={16}
            height={16}
            aria-hidden
          />
          <span className="font-medium text-slate-900">CityLens</span>
          <span className="text-slate-400">·</span>
          <span>NYC development-site intelligence</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/" className="hover:text-slate-900">
            Home
          </Link>
          <Link href="/runs" className="hover:text-slate-900">
            Runs
          </Link>
          <Link href="/docs" className="hover:text-slate-900">
            API docs
          </Link>
          <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/contact" className="hover:text-slate-900">Contact</Link>
          <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          <Link href="/account/api-keys" className="hover:text-slate-900">
            API keys
          </Link>
          <a
            href="https://api.citylens.dev/v1/health"
            className="hover:text-slate-900"
            rel="noopener noreferrer"
            target="_blank"
          >
            Status
          </a>
        </nav>
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 text-[11px] leading-5 text-slate-500">
          Imagery: USGS NAIP &middot; Footprints: NYC OpenData (DOITT) &middot; LiDAR: NYS GIS
          &middot; v0.1 · 5-borough preview · &copy; {new Date().getFullYear()} CityLens.
        </div>
      </div>
    </footer>
  );
}
