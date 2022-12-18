import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Boxes, FileCode, Radar } from 'lucide-react';

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

      {/* ---------- Hero ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              v0.1 · NYC, 5 boroughs · public demos free
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.5rem] md:leading-[1.1]">
              Building-level urban change detection from aerial imagery.
            </h1>
            <p className="max-w-prose text-[15px] leading-7 text-slate-600">
              Type any NYC address. CityLens pulls the latest orthophoto, fuses it
              with NYC&apos;s baseline footprints and NYS LiDAR, and returns a
              classified <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">change.geojson</code>,
              a LOD1 <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">mesh.ply</code>,
              and a rendered preview — with a per-input audit trail.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {featured.length > 0 && (
                <Link
                  href="#featured-demos"
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                >
                  View featured demo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="#create"
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Create a run
              </Link>
              <Link
                href="/docs"
                className="inline-flex h-11 items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-900"
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
            className="group relative block overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-md ring-1 ring-black/5"
            aria-label="Open the Brooklyn featured demo"
          >
            <Image
              src={BROOKLYN_PREVIEW_URL}
              alt="CityLens change-detection preview for 100 E 21st St, Brooklyn — gray = unchanged buildings, green = added, yellow = modified, red = demolished."
              width={1024}
              height={703}
              priority
              unoptimized
              className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {/* Top-right palette legend over the imagery */}
            <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-slate-950/70 p-2 text-[10px] text-slate-100 shadow-sm backdrop-blur-sm">
              <div className="font-medium uppercase tracking-wider text-slate-300">2024 vs 2017</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <LegendDot color="#8c8c8c" label="unchanged" />
                <LegendDot color="#ffc800" label="modified" />
                <LegendDot color="#dc1e1e" label="demolished" />
                <LegendDot color="#00c83c" label="added" />
              </div>
            </div>
            {/* Bottom caption */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent px-4 pb-3 pt-8 text-xs text-slate-50">
              <div>
                <div className="text-sm font-semibold">100 E 21st St — Brooklyn</div>
                <div className="mt-0.5 text-slate-300">
                  136 buildings classified · 2017 → 2024 · LOD1 mesh
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/25 backdrop-blur-sm">
                Live demo
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ---------- Feature row (lifted out of the hero card so it breathes) ---------- */}
      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <FeatureCard
          accent="sky"
          icon={<Radar className="h-4 w-4" />}
          title="Change detection"
          body={
            <>
              Per-building classification: unchanged / modified / demolished / added,
              each with a confidence score and baseline-IoU.
            </>
          }
          href="/docs#endpoint-demo-run"
        />
        <FeatureCard
          accent="amber"
          icon={<Boxes className="h-4 w-4" />}
          title="3D reconstruction"
          body={
            <>
              LOD1 PLY meshes from NYS LiDAR, vertex-colored by change type — drop straight
              into three.js, Unreal, Blender, or QGIS.
            </>
          }
          href="/docs#endpoint-demo-artifact"
        />
        <FeatureCard
          accent="emerald"
          icon={<FileCode className="h-4 w-4" />}
          title="Reproducible API"
          body={
            <>
              Every run records SHA-256s of each input asset — defensible audit trail for
              insurance, diligence, and permitting workflows.
            </>
          }
          href="/docs#audit-trail"
        />
      </section>

      {/* ---------- "What you get per run" — three real artifacts ---------- */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">What you get per run</h2>
            <p className="mt-1 text-sm text-slate-600">
              Three artifacts, every run, on a fixed 250m AOI. Real output below from
              the Brooklyn demo.
            </p>
          </div>
          <Link
            href={BROOKLYN_DETAIL_URL}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:underline"
          >
            View full demo
            <ArrowRight className="h-4 w-4" />
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
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">preview.png</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                Change-classified overlay
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Aerial imagery with per-building fills and outlines, ready to share.
              </p>
            </div>
          </div>

          {/* change.geojson card */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">change.geojson</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              Per-feature classification
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              <ChangeRow color="#8c8c8c" label="unchanged" count={BROOKLYN_CHANGE_COUNTS.unchanged} />
              <ChangeRow color="#ffc800" label="modified" count={BROOKLYN_CHANGE_COUNTS.modified} />
              <ChangeRow color="#dc1e1e" label="demolished" count={BROOKLYN_CHANGE_COUNTS.demolished} />
              <ChangeRow color="#00c83c" label="added" count={BROOKLYN_CHANGE_COUNTS.added} />
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Each feature carries area, height, IoU, confidence, and 2017 NYC OpenData
              provenance.
            </p>
          </div>

          {/* mesh.ply card */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">mesh.ply</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              LOD1 extruded buildings
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <Stat label="vertices" value="3.9k" />
              <Stat label="faces" value="5.6k" />
              <Stat label="height source" value="LiDAR p95" />
              <Stat label="vertex colors" value="change palette" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Drop into three.js / Blender / Unreal. Vertex-colored so the change
              palette renders without extra work.
            </p>
          </div>
        </div>
      </section>

      <div id="featured-demos" className="mt-6">
        <FeaturedDemoCards demos={featured} />
      </div>

      <section id="create" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight">Create a CityLens run</h2>
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

// Color-accented feature card. The accent shows up as a left bar +
// matching icon background, giving the three cards a clear visual
// rhythm without leaving the slate-on-white palette.
const ACCENTS = {
  sky: {
    bar: 'bg-sky-500',
    iconBg: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  amber: {
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  emerald: {
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
} as const;

function FeatureCard({
  accent,
  icon,
  title,
  body,
  href,
}: {
  accent: keyof typeof ACCENTS;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  href: string;
}) {
  const a = ACCENTS[accent];
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${a.bar}`} aria-hidden="true" />
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset ${a.iconBg}`}
      >
        {icon}
      </span>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="text-sm leading-6 text-slate-600">{body}</p>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-slate-700 group-hover:text-slate-950">
        Learn more <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-slate-200">{label}</span>
    </span>
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
