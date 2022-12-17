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

// Brooklyn brownstones / Flatbush — the canonical featured demo. Used to
// surface real product output on the homepage hero + "what you get" panel.
// If this run is ever rebuilt the change_counts may shift; the failure
// mode is just stale numbers, not a broken page.
const BROOKLYN_DEMO_RUN_ID = '5f079d78d89c4387a9c0ddd5e3507b5e';
const BROOKLYN_PREVIEW_URL = `/v1/demo/artifacts/${BROOKLYN_DEMO_RUN_ID}/preview.png`;
const BROOKLYN_DETAIL_URL = `/runs/${BROOKLYN_DEMO_RUN_ID}?demo=1`;
const BROOKLYN_CHANGE_COUNTS = { unchanged: 134, modified: 0, demolished: 0, added: 2 } as const;

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
              Building-level urban change detection from aerial imagery.
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Type any NYC address. CityLens pulls the latest orthophoto, fuses it
              with NYC&apos;s baseline footprints and NYS LiDAR, and returns a
              classified <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">change.geojson</code>,
              a LOD1 <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">mesh.ply</code>,
              and a rendered preview — with a per-input audit trail.
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
                className="inline-flex h-10 items-center justify-center text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                API docs →
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              Public demos don&apos;t require sign-in. Creating a custom run requires a free account.
            </p>
          </div>

          <Link
            href={BROOKLYN_DETAIL_URL}
            className="group relative block overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm"
            aria-label="Open the Brooklyn featured demo"
          >
            <Image
              src={BROOKLYN_PREVIEW_URL}
              alt="CityLens change-detection preview for 100 E 21st St, Brooklyn — gray = unchanged buildings, green = added, yellow = modified, red = demolished."
              width={1024}
              height={703}
              priority
              unoptimized
              className="h-auto w-full transition-opacity group-hover:opacity-95"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-3 text-xs text-slate-50">
              <div>
                <div className="font-semibold">100 E 21st St — Brooklyn</div>
                <div className="text-slate-300">
                  136 buildings classified · 2017 → 2024 · LOD1 mesh
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 ring-1 ring-white/20">
                Live demo →
              </span>
            </div>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Radar className="h-4 w-4" /> Change detection
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Per-building classification: unchanged / modified / demolished / added,
              each with confidence and a baseline-IoU score.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Boxes className="h-4 w-4" /> 3D reconstruction
            </div>
            <p className="mt-2 text-sm text-slate-600">
              LOD1 PLY meshes from NYS LiDAR, vertex-colored by change type — drop straight into
              three.js, Unreal, Blender, or QGIS.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileCode className="h-4 w-4" /> Reproducible API
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Every run records a SHA-256 of each input asset — defensible audit trail for
              insurance, diligence, or permitting workflows.
            </p>
          </div>
        </div>
      </section>

      {/* "What you get per run" — three real artifacts from the Brooklyn demo */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">What you get per run</h2>
            <p className="mt-1 text-sm text-slate-600">
              Three artifacts, every run, on a fixed 250m AOI. Real output below from
              the Brooklyn demo.
            </p>
          </div>
          <Link
            href={BROOKLYN_DETAIL_URL}
            className="text-sm font-medium text-slate-900 hover:underline"
          >
            View full demo →
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* preview.png card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
              <Image
                src={BROOKLYN_PREVIEW_URL}
                alt=""
                fill
                unoptimized
                className="object-cover opacity-90"
              />
            </div>
            <div className="p-3">
              <div className="text-xs font-mono text-slate-500">preview.png</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                Change-classified overlay
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Aerial imagery with per-building fills + outlines, ready to share.
              </p>
            </div>
          </div>

          {/* change.geojson card */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-mono text-slate-500">change.geojson</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              Per-feature classification
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              <ChangeRow color="#8c8c8c" label="unchanged" count={BROOKLYN_CHANGE_COUNTS.unchanged} />
              <ChangeRow color="#ffc800" label="modified" count={BROOKLYN_CHANGE_COUNTS.modified} />
              <ChangeRow color="#dc1e1e" label="demolished" count={BROOKLYN_CHANGE_COUNTS.demolished} />
              <ChangeRow color="#00c83c" label="added" count={BROOKLYN_CHANGE_COUNTS.added} />
            </ul>
            <p className="mt-3 text-xs text-slate-600">
              Each feature carries area, height, IoU, confidence, and 2017 NYC OpenData
              provenance.
            </p>
          </div>

          {/* mesh.ply card */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-mono text-slate-500">mesh.ply</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              LOD1 extruded buildings
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <Stat label="vertices" value="3.9k" />
              <Stat label="faces" value="5.6k" />
              <Stat label="height source" value="LiDAR p95" />
              <Stat label="vertex colors" value="change palette" />
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Drop into three.js / Blender / Unreal. Vertex-colored so the change
              palette renders without extra work.
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

function ChangeRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-700">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-slate-300"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span className="font-mono font-semibold text-slate-900">{count}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xs font-semibold text-slate-900">{value}</div>
    </div>
  );
}
