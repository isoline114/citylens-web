import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Boxes, FileCode, Fingerprint, Layers, MapPin, Radar, ShieldCheck, Sparkles } from 'lucide-react';

import { FeaturedDemoCards } from '@/components/FeaturedDemoCards';
import { RunForm } from '@/components/RunForm';
import type { DemoFeaturedRun } from '@/lib/api';
import { fetchFeaturedDemosOnServer } from '@/lib/api.server';

// Re-render the homepage's SSR HTML at most once per minute so a freshly
// published demo lands on the landing page within ~60s without hammering
// the API on every cold visit.
export const revalidate = 60;

// Brooklyn brownstones / Flatbush — the canonical featured demo. The
// run_id is resolved at request time from the live featured-demos list
// (matched by address) so a `precompute_demo_runs.py` rerun in the
// engine doesn't break the homepage. If the match misses we fall back
// to the first featured demo, then to a static ID. change_counts are
// the latest known values and may go stale between precomputes — the
// failure mode is just stale numbers, not a broken page.
const BROOKLYN_PARITY_ADDRESS_PREFIX = '100 E 21st St';
const BROOKLYN_DEMO_RUN_FALLBACK = 'b7356fa767aa4605b8a77352bccd427e';
const BROOKLYN_CHANGE_COUNTS = { unchanged: 127, modified: 7, demolished: 0, added: 0 } as const;
const BROOKLYN_TOTAL =
  BROOKLYN_CHANGE_COUNTS.unchanged +
  BROOKLYN_CHANGE_COUNTS.modified +
  BROOKLYN_CHANGE_COUNTS.demolished +
  BROOKLYN_CHANGE_COUNTS.added;

export default async function HomePage() {
  const featured = await fetchFeaturedDemosOnServer();

  const brooklynRunId = resolveBrooklynRunId(featured);
  const brooklynPreviewUrl = `/v1/demo/artifacts/${brooklynRunId}/preview.png`;
  const brooklynDetailUrl = `/runs/${brooklynRunId}?demo=1`;

  return (
    <div className="flex flex-col gap-10 pb-4">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Layered backdrop: soft slate gradient + sky/emerald glow blobs.
            Scoped to the hero card only; replaces the old (barely visible)
            global topo-grid texture. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-sky-50/60"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-20 -top-24 -z-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-20 -z-10 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 items-center gap-10 p-6 md:grid-cols-[1.05fr_1fr] md:p-8">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              NYC acquisition intelligence · all 5 boroughs
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-950 md:text-[3.25rem] md:leading-[1.05]">
              Find NYC development sites before the broker call.
            </h1>

            <p className="max-w-prose text-base leading-7 text-slate-600 md:text-lg md:leading-8">
              CityLens ranks every tax lot, refreshes current zoning and project activity,
              explains why each lead matters, and gives your team a pipeline for deciding
              what to call on, underwrite, pursue, or pass.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/parcel-intel"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Explore parcel opportunities
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {featured.length > 0 && (
                <Link
                  href="#featured-demos"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  See aerial evidence
                </Link>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Create a free account to open the full ranked workspace and acquisition pipeline.
            </p>
          </div>

          {/* Hero preview — framed with offset shadow stack + colored glow.
              The change-classified output is the killer demo, so we lean
              into a more "alive" presentation. */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-br from-sky-200/40 via-emerald-200/30 to-amber-200/30 blur-2xl"
              aria-hidden="true"
            />
            <Link
              href={brooklynDetailUrl}
              className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-0.5"
              aria-label="Open the Brooklyn featured demo"
            >
              <Image
                src={brooklynPreviewUrl}
                alt="CityLens change-detection preview for 100 E 21st St, Brooklyn — gray = unchanged buildings, green = added, yellow = modified, red = demolished."
                width={1024}
                height={703}
                priority
                unoptimized
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {/* Top-right palette legend over the imagery */}
              <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-slate-950/75 p-2.5 text-[10px] text-slate-100 shadow-md ring-1 ring-white/10 backdrop-blur-md">
                <div className="font-medium uppercase tracking-wider text-slate-300">2024 vs 2017</div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  <LegendDot color="#8c8c8c" label="unchanged" />
                  <LegendDot color="#ffc800" label="modified" />
                  <LegendDot color="#dc1e1e" label="demolished" />
                  <LegendDot color="#00c83c" label="added" />
                </div>
              </div>
              {/* Bottom caption */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-transparent px-4 pb-3.5 pt-10 text-xs text-slate-50">
                <div>
                  <div className="text-sm font-semibold tracking-tight">100 E 21st St — Brooklyn</div>
                  <div className="mt-0.5 text-slate-300">
                    {BROOKLYN_TOTAL} buildings classified · 2017 → 2024 · LOD1 mesh
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/25 backdrop-blur-sm">
                  Live demo
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
            {/* Floating provenance chip — anchors the trust message visually */}
            <div className="absolute -bottom-3 left-4 hidden items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-md ring-1 ring-black/[0.03] backdrop-blur sm:inline-flex">
              <Fingerprint className="h-3.5 w-3.5 text-emerald-600" />
              SHA-256 audit trail per run
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works — 3-step strip ---------- */}
      <section aria-labelledby="how-it-works" className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              How it works
            </div>
            <h2 id="how-it-works" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Discover. Qualify. Pursue.
            </h2>
          </div>
        </div>

        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Step
            n={1}
            accent="sky"
            icon={<MapPin className="h-4 w-4" />}
            title="Start with ranked opportunities"
            body="Scan priority development-site leads across all five boroughs instead of assembling a list by hand."
            visual={
              <div className="font-mono text-[13px] text-slate-700">
                <span className="text-slate-400">#1</span>{' '}
                <span className="text-sky-700">Highest priority</span> · Brooklyn
              </div>
            }
          />
          <Step
            n={2}
            accent="amber"
            icon={<Layers className="h-4 w-4" />}
            title="Verify current facts"
            body="Review current PLUTO capacity, DOB activity, ACRIS ownership, constraints, and dated aerial observations in one brief."
            visual={
              <div className="flex items-center gap-1.5">
                <FuseChip label="PLUTO" tone="bg-sky-100 text-sky-800 ring-sky-200" />
                <span className="text-slate-300">+</span>
                <FuseChip label="DOB" tone="bg-amber-100 text-amber-800 ring-amber-200" />
                <span className="text-slate-300">+</span>
                <FuseChip label="ACRIS" tone="bg-emerald-100 text-emerald-800 ring-emerald-200" />
              </div>
            }
          />
          <Step
            n={3}
            accent="emerald"
            icon={<Sparkles className="h-4 w-4" />}
            title="Move the lead forward"
            body="Save it, assign a stage, add notes and tags, watch for changes, and run a quick maximum-land-basis screen."
            visual={
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <ArtifactPill label="reviewing" />
                <ArtifactPill label="underwriting" />
                <ArtifactPill label="pursue" />
              </div>
            }
          />
        </ol>
      </section>

      {/* ---------- Feature row ---------- */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Run output
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">What you get per run</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Three artifacts, every run, on a fixed 250m AOI. Real output below from the
              Brooklyn demo.
            </p>
          </div>
          <Link
            href={brooklynDetailUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:underline"
          >
            View full demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* preview.png card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
              <Image
                src={brooklynPreviewUrl}
                alt=""
                fill
                unoptimized
                className="object-cover opacity-95"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/70 to-transparent" />
              <div className="absolute bottom-2 left-2 rounded-md bg-slate-950/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-100 ring-1 ring-white/10 backdrop-blur-sm">
                preview.png
              </div>
            </div>
            <div className="p-4">
              <div className="text-sm font-semibold text-slate-900">
                Change-classified overlay
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Aerial imagery with per-building fills and outlines, ready to share.
              </p>
            </div>
          </div>

          {/* change.geojson card — now with a proportional stack-bar */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              change.geojson
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              Per-feature classification
            </div>

            {/* Stack-bar visualization of change_counts */}
            <div className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full ring-1 ring-slate-200">
              <StackSeg width={(BROOKLYN_CHANGE_COUNTS.unchanged / BROOKLYN_TOTAL) * 100} color="#8c8c8c" />
              <StackSeg width={(BROOKLYN_CHANGE_COUNTS.modified / BROOKLYN_TOTAL) * 100} color="#ffc800" />
              <StackSeg width={(BROOKLYN_CHANGE_COUNTS.demolished / BROOKLYN_TOTAL) * 100} color="#dc1e1e" />
              <StackSeg width={(BROOKLYN_CHANGE_COUNTS.added / BROOKLYN_TOTAL) * 100} color="#00c83c" />
            </div>

            <ul className="mt-3 space-y-1.5 text-xs">
              <ChangeRow color="#8c8c8c" label="unchanged" count={BROOKLYN_CHANGE_COUNTS.unchanged} />
              <ChangeRow color="#ffc800" label="modified" count={BROOKLYN_CHANGE_COUNTS.modified} />
              <ChangeRow color="#dc1e1e" label="demolished" count={BROOKLYN_CHANGE_COUNTS.demolished} />
              <ChangeRow color="#00c83c" label="added" count={BROOKLYN_CHANGE_COUNTS.added} />
            </ul>

            {/* Tiny syntax-highlighted snippet of a feature's properties */}
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-2.5 font-mono text-[10.5px] leading-relaxed text-slate-200 ring-1 ring-slate-900/20">
              <code>
                <span className="text-slate-400">{'{'}</span>
                {'\n  '}
                <span className="text-sky-300">&quot;kind&quot;</span>
                <span className="text-slate-400">: </span>
                <span className="text-amber-300">&quot;modified&quot;</span>
                <span className="text-slate-400">,</span>
                {'\n  '}
                <span className="text-sky-300">&quot;iou&quot;</span>
                <span className="text-slate-400">: </span>
                <span className="text-emerald-300">0.74</span>
                <span className="text-slate-400">,</span>
                {'\n  '}
                <span className="text-sky-300">&quot;height_m&quot;</span>
                <span className="text-slate-400">: </span>
                <span className="text-emerald-300">12.4</span>
                {'\n'}
                <span className="text-slate-400">{'}'}</span>
              </code>
            </pre>
          </div>

          {/* mesh.ply card */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              mesh.ply
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              LOD1 extruded buildings
            </div>

            {/* Inline isometric-ish "mesh thumbnail" rendered with CSS so it
                stays light-weight and vector-crisp; signals the 3D output
                without asking the visitor to load three.js up front. */}
            <div className="mt-3.5 flex h-24 items-center justify-center rounded-md bg-gradient-to-br from-slate-900 to-slate-800 ring-1 ring-slate-900/30">
              <MeshThumb />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <Stat label="vertices" value="3.9k" />
              <Stat label="faces" value="5.6k" />
              <Stat label="height source" value="LiDAR p95" />
              <Stat label="vertex colors" value="change palette" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Drop into three.js / Blender / Unreal. Vertex-colored so the change palette
              renders without extra work.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Trust / provenance stripe ---------- */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-950 p-6 text-slate-100 shadow-sm md:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_2fr] md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Built for diligence
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Every input is hashed. Every run is reproducible.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              CityLens records the SHA-256 of every orthophoto tile, footprint snapshot,
              and LiDAR tile. Re-run the same address tomorrow and you get a byte-for-byte
              audit trail back to the source data.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TrustCard
              icon={<Fingerprint className="h-4 w-4" />}
              title="SHA-256 per input"
              body="Imagery, footprints, LiDAR — all hashed and embedded in run_summary.json."
            />
            <TrustCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Server-locked options"
              body="Imagery 2024, baseline 2017, SAM2. Clients can't drift the contract."
            />
            <TrustCard
              icon={<FileCode className="h-4 w-4" />}
              title="QA metrics included"
              body="mask_iou, change_polygon_f1, mesh_footprint_iou — included in every run."
            />
          </div>
        </div>
      </section>

      <div id="featured-demos">
        <FeaturedDemoCards demos={featured} />
      </div>

      {/* ---------- Create a run ---------- */}
      <section
        id="create"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Try it
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Create a CityLens run</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              Pick a featured demo above, or sign in with a free account to run CityLens on
              any NYC address. We inject pipeline defaults — you only pick the address and
              outputs.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
            Free plan · 5 runs/month
          </span>
        </div>
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
    chipNum: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  amber: {
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-700 ring-amber-200',
    chipNum: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  emerald: {
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    chipNum: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
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
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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

function Step({
  n,
  accent,
  icon,
  title,
  body,
  visual,
}: {
  n: number;
  accent: keyof typeof ACCENTS;
  icon: React.ReactNode;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <li className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${a.bar}`} aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-xs font-semibold ring-1 ring-inset ${a.chipNum}`}
        >
          {n}
        </span>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset ${a.iconBg}`}
        >
          {icon}
        </span>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
      </div>
      <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
        {visual}
      </div>
    </li>
  );
}

function FuseChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  );
}

function ArtifactPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white px-2 py-1 text-slate-700 ring-1 ring-inset ring-slate-200">
      {label}
    </span>
  );
}

function TrustCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
        {icon}
      </span>
      <div className="mt-3 text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-300">{body}</p>
    </div>
  );
}

function StackSeg({ width, color }: { width: number; color: string }) {
  if (width <= 0) return null;
  return (
    <span
      className="block h-full"
      style={{ width: `${width}%`, backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

// Pure-CSS isometric rooftop cluster — three offset extruded "buildings"
// approximating a vertex-colored LOD1 mesh. Doesn't try to be accurate;
// signals "3D output" at a glance without loading three.js.
function MeshThumb() {
  return (
    <div
      className="relative h-16 w-32"
      style={{
        transform: 'rotateX(55deg) rotateZ(-35deg)',
        transformStyle: 'preserve-3d',
      }}
      aria-hidden="true"
    >
      <span
        className="absolute left-2 top-2 block h-10 w-10 rounded-sm shadow-md ring-1 ring-black/30"
        style={{ backgroundColor: '#8c8c8c' }}
      />
      <span
        className="absolute left-12 top-0 block h-12 w-9 rounded-sm shadow-md ring-1 ring-black/30"
        style={{ backgroundColor: '#ffc800' }}
      />
      <span
        className="absolute left-20 top-4 block h-8 w-10 rounded-sm shadow-md ring-1 ring-black/30"
        style={{ backgroundColor: '#00c83c' }}
      />
    </div>
  );
}

function resolveBrooklynRunId(featured: DemoFeaturedRun[]): string {
  const match = featured.find(
    (d) => typeof d.address === 'string' && d.address.startsWith(BROOKLYN_PARITY_ADDRESS_PREFIX),
  );
  const matchId = match && typeof match.run_id === 'string' ? match.run_id : null;
  if (matchId) return matchId;
  const firstId =
    featured.length > 0 && typeof featured[0].run_id === 'string' ? featured[0].run_id : null;
  return firstId ?? BROOKLYN_DEMO_RUN_FALLBACK;
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
