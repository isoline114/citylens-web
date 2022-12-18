import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import '../styles/globals.css';

import { AuthHeaderControls } from '@/components/AuthHeaderControls';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { PlanQuotaBadge } from '@/components/PlanQuotaBadge';
import { Toasts } from '@/components/Toasts';
import { AuthProvider } from '@/lib/auth';
import { AuthTokenBridge } from '@/lib/auth/AuthTokenBridge';
import { publicAssetPath } from '@/lib/site';

const title = 'CityLens';
const description =
  'Urban change detection and 3D reconstruction from any NYC address. Sign up free, get 5 runs per month, download change.geojson and PLY mesh artifacts.';

export const metadata: Metadata = {
  metadataBase: new URL('https://citylens.dev'),
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
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2">
                  <Image src={publicAssetPath('/citylens-mark.png')} alt="CityLens" width={24} height={24} priority />
                  <span className="text-lg font-semibold">CityLens</span>
                </Link>
                <nav className="hidden items-center gap-4 text-sm md:flex">
                  <Link href="/" className="text-slate-700 hover:text-slate-950">
                    Home
                  </Link>
                  <Link href="/runs" className="text-slate-700 hover:text-slate-950">
                    Runs
                  </Link>
                  <Link href="/docs" className="text-slate-700 hover:text-slate-950">
                    Docs
                  </Link>
                </nav>
              </div>

              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-3 text-sm md:hidden">
                  <Link href="/" className="text-slate-700 hover:text-slate-950">
                    Home
                  </Link>
                  <Link href="/runs" className="text-slate-700 hover:text-slate-950">
                    Runs
                  </Link>
                </nav>
                <PlanQuotaBadge />
                <AuthHeaderControls />
              </div>
            </div>
          </header>

          <DemoModeBanner />

          <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
          <SiteFooter />
          <Toasts />
        </AuthProvider>
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
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
          <span>NYC building change detection</span>
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
        <div className="mx-auto max-w-4xl px-4 py-3 text-[11px] leading-5 text-slate-500">
          Imagery: USGS NAIP &middot; Footprints: NYC OpenData (DOITT) &middot; LiDAR: NYS GIS
          &middot; v0.1 · 5-borough preview · &copy; {new Date().getFullYear()} CityLens.
        </div>
      </div>
    </footer>
  );
}
