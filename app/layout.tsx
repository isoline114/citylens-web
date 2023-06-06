import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Barlow_Semi_Condensed, IBM_Plex_Mono, Libre_Franklin } from 'next/font/google';
import '../styles/globals.css';

import { SafeAnalytics } from '@/components/SafeAnalytics';
import { CityLensMark, SiteHeader } from '@/components/SiteHeader';
import { SiteFooterBoundary, SiteMain } from '@/components/SiteMain';
import { Toasts } from '@/components/Toasts';
import { AuthProvider } from '@/lib/auth';
import { AuthTokenBridge } from '@/lib/auth/AuthTokenBridge';
import { publicAssetPath } from '@/lib/site';

// Block & Lot type system: Franklin for reading and interface, a condensed
// face for map labels and table heads only, mono only for identifiers.
const franklin = Libre_Franklin({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const condensed = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-cond',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

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
    icon: [
      { url: publicAssetPath('/favicon.ico') },
      { url: publicAssetPath('/citylens-mark.svg'), type: 'image/svg+xml' },
      { url: publicAssetPath('/icon.png'), type: 'image/png' },
    ],
    apple: [{ url: publicAssetPath('/apple-touch-icon.png') }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${franklin.variable} ${condensed.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-screen flex-col bg-white font-sans text-ink antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
          <AuthTokenBridge />
          <a
            href="#main-content"
            className="fixed left-4 top-3 z-[1100] -translate-y-20 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-select focus:ring-offset-2"
          >
            Skip to content
          </a>
          <SiteHeader />

          <SiteMain>{children}</SiteMain>
          <SiteFooterBoundary><SiteFooter /></SiteFooterBoundary>
          <Toasts />
        </AuthProvider>
        <SafeAnalytics />
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-rule bg-paper-2">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-6 text-sm text-ink-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between xl:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-[9px] text-ink">
            <CityLensMark className="h-[18px] w-[18px]" />
            <span className="text-base font-extrabold tracking-[-0.02em]">CityLens</span>
          </span>
          <span>NYC development-site research</span>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-x-5 gap-y-1"
        >
          <Link href="/" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Home
          </Link>
          <Link href="/runs" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Runs
          </Link>
          <Link href="/parcel-intel" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Parcels
          </Link>
          <Link href="/docs" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            API docs
          </Link>
          <Link href="/pricing" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Pricing
          </Link>
          <Link href="/contact" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Contact
          </Link>
          <Link href="/privacy" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/account/api-keys" className="inline-flex min-h-9 items-center hover:text-ink hover:underline">
            API keys
          </Link>
          <a
            href="https://api.citylens.dev/v1/health"
            className="inline-flex min-h-9 items-center hover:text-ink hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Status
          </a>
        </nav>
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto max-w-[1480px] px-4 py-3 text-xs leading-5 text-ink-3 sm:px-6 xl:px-8">
          CityLens supports screening and workflow. It is not legal, zoning,
          appraisal, brokerage or investment advice. &copy;{' '}
          {new Date().getFullYear()} CityLens.
        </div>
      </div>
    </footer>
  );
}
