import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import '../styles/globals.css';

import { DemoModeBanner } from '@/components/DemoModeBanner';
import { SafeAnalytics } from '@/components/SafeAnalytics';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteMain } from '@/components/SiteMain';
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
      <body
        className="flex min-h-screen flex-col bg-white text-slate-950"
        suppressHydrationWarning
      >
        <AuthProvider>
          <AuthTokenBridge />
          <a
            href="#main-content"
            className="fixed left-4 top-3 z-[1100] -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
          >
            Skip to content
          </a>
          <SiteHeader />

          <DemoModeBanner />

          <SiteMain>{children}</SiteMain>
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
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-8">
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
          <Link href="/parcel-intel" className="hover:text-slate-900">
            Parcels
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
        <div className="mx-auto max-w-[1480px] px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-6 xl:px-8">
          Screening intelligence—not legal, zoning, appraisal, brokerage, or
          investment advice. &copy; {new Date().getFullYear()} CityLens.
        </div>
      </div>
    </footer>
  );
}
