import Image from 'next/image';
import Link from 'next/link';
import { Boxes, Radar, Workflow } from 'lucide-react';

import { RunForm } from '@/components/RunForm';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Subtle topo texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{ backgroundImage: 'url(/topo-grid.png)', backgroundRepeat: 'repeat' }}
        aria-hidden="true"
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
              API-first • Standard artifacts • Polling runs
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Urban change detection and 3D reconstruction—via API
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Create a run from an address, track progress, and download standard outputs: preview.png,
              change.geojson, mesh.ply, and run_summary.json.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="#create"
                className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create a run
              </Link>
              <Link
                href="/runs"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                View runs
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <Image
              src="/hero-citylens.png"
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
              <Radar className="h-4 w-4" /> Change Detection
            </div>
            <p className="mt-2 text-sm text-slate-600">GeoJSON outputs you can render and download.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Boxes className="h-4 w-4" /> 3D Reconstruction
            </div>
            <p className="mt-2 text-sm text-slate-600">PLY mesh artifacts for downstream workflows.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Workflow className="h-4 w-4" /> API-first Runs
            </div>
            <p className="mt-2 text-sm text-slate-600">Create, poll, and fetch artifacts with an API key.</p>
          </div>
        </div>
      </section>

      <section id="create" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Create a CityLens run</h2>
        <p className="mt-1 text-sm text-slate-600">
          Minimal inputs for creating a run. Remaining required defaults are set automatically.
        </p>
        <div className="mt-6">
          <RunForm />
        </div>
      </section>
    </div>
  );
}
