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
const description = 'API-first urban change detection and 3D reconstruction from open geospatial data.';

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
          <Toasts />
        </AuthProvider>
      </body>
    </html>
  );
}
