import Image from 'next/image';
import Link from 'next/link';
import { Boxes, FileCode, Radar } from 'lucide-react';

import { FeaturedDemoCards } from '@/components/FeaturedDemoCards';
import { RunForm } from '@/components/RunForm';
import { fetchFeaturedDemosOnServer } from '@/lib/api.server';
import { publicAssetPath } from '@/lib/site';

// Re-render the homepage's SSR HTML at most once per minute so a freshly
// published demo lands on the landing page within ~60s without hammering
// the API on every cold visit.
export const revalidate = 60;

export default async function HomePage() {
  const featured = await fetchFeaturedDemosOnServer();

  return (
    <div className="relative">
      {/* Subtle topo texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{ backgroundImage: `url(${publicAssetPath('/topo-grid.png')})`, backgroundRepeat: 'repeat' }}
        aria-hidden="true"
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
              Public demos • Free account: 5 runs/month • Real geospatial outputs
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Detect urban change and generate geospatial &amp; 3D artifacts from aerial imagery.
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Browse precomputed featured demos, or sign up for a free account to run CityLens on
              any NYC address. Each run produces a change-detection GeoJSON, a 3D PLY mesh, and a
              ready-to-share preview.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {featured.length > 0 && (
                <Link
                  href="#featured-demos"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  View featured demo
                </Link>
              )}
              <Link
                href="#create"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Create a run
              </Link>
              <Link
                href="/docs"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Read API docs
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              Public demos do not require sign-in. Creating a custom run requires a free account.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <Image
              src={publicAssetPath('/hero-citylens.png')}
              alt="CityLens preview"
              width={1200}
              height={800}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Radar className="h-4 w-4" /> Change detection
            </div>
            <p className="mt-2 text-sm text-slate-600">
              GeoJSON polygons over a baseline year, ready to render or join with your own layers.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Boxes className="h-4 w-4" /> 3D reconstruction
            </div>
            <p className="mt-2 text-sm text-slate-600">
              PLY meshes for downstream rendering, simulation, or AR/VR workflows.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileCode className="h-4 w-4" /> Real API
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Account-backed REST API with monthly quotas. Free plan: 5 runs/month.
            </p>
          </div>
        </div>
      </section>

      <div id="featured-demos" className="mt-6">
        <FeaturedDemoCards demos={featured} />
      </div>

      <section id="create" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Create a CityLens run</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick a featured demo above, or sign in with a free account to run CityLens on any NYC
          address. We inject pipeline defaults — you only pick the address and outputs.
        </p>
        <div className="mt-6">
          <RunForm initialFeatured={featured} />
        </div>
      </section>
    </div>
  );
}
