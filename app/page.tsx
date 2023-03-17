import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  FileCode,
  Fingerprint,
  GitCompareArrows,
  MapPin,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { FeaturedDemoCards } from '@/components/FeaturedDemoCards';
import { SiteEvidencePreviewImage } from '@/components/SiteEvidencePreviewImage';
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
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 text-white shadow-[0_34px_100px_-48px_rgba(15,23,42,0.8)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.13),transparent_32%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,.28) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.28) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
          }}
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-1 items-center gap-9 p-6 md:p-9 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-200">
              <Building2 className="h-3.5 w-3.5" />
              NYC acquisition operating system · all five boroughs
            </div>

            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-[3.7rem] lg:leading-[1.02]">
              Turn the whole NYC market into a defensible weekly shortlist.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg md:leading-8">
              Scan one citywide opportunity map, remove stale project leads,
              compare current evidence, and move only the parcels worth team
              time into diligence.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/parcel-intel"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-sky-50"
              >
                Open the NYC opportunity map
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact?plan=acquisitions"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/10"
              >
                Request a working session
              </Link>
            </div>
            <div className="mt-6 hidden flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400 sm:flex">
              {[
                'Public market preview',
                'Source-dated decisions',
                'No black-box buy/pass score',
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <AcquisitionWorkspacePreview />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section aria-labelledby="how-it-works" className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              One decision flow
            </div>
            <h2 id="how-it-works" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              See the market. Commit to the few.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              CityLens keeps historical screening, current eligibility,
              diligence, and the team&apos;s decision visibly separate.
            </p>
          </div>
        </div>

        <p className="text-xs font-medium text-slate-500 sm:hidden">
          Swipe through the decision flow.
        </p>
        <ol
          className="grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
          aria-label="CityLens acquisition decision flow"
          tabIndex={0}
          data-testid="home-decision-flow"
        >
          <Step
            n={1}
            accent="sky"
            icon={<MapPin className="h-4 w-4" />}
            title="Scan one citywide market"
            body="Rank current development-site leads across all five boroughs on one map."
            visual={
              <div className="font-mono text-[13px] text-slate-700">
                <span className="text-sky-700">All NYC</span>
                <span className="text-slate-600"> · one map</span>
              </div>
            }
          />
          <Step
            n={2}
            accent="amber"
            icon={<SearchCheck className="h-4 w-4" />}
            title="Open the current evidence"
            body="Keep historical rank separate from projects, capacity, ownership, constraints, and source dates."
            visual={
              <div className="font-mono text-[12px] text-slate-700">
                <span className="text-amber-700">Rank</span>
                <span className="text-slate-600"> ≠ seller intent</span>
              </div>
            }
          />
          <Step
            n={3}
            accent="emerald"
            icon={<GitCompareArrows className="h-4 w-4" />}
            title="Compare before committing"
            body="Compare two or three parcels and export their source-dated evidence."
            visual={
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <ArtifactPill label="2–3 parcels" />
                <ArtifactPill label="evidence desk" />
              </div>
            }
          />
          <Step
            n={4}
            accent="violet"
            icon={<Sparkles className="h-4 w-4" />}
            title="Advance with a reason"
            body="Save, assign, underwrite, pursue, or pass with a dated record."
            visual={
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <ArtifactPill label="review" />
                <ArtifactPill label="pursue / pass" />
              </div>
            }
          />
        </ol>
      </section>

      {/* ---------- Aerial evidence — three real artifacts ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Advanced site evidence
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              When a parcel warrants a deeper site read.
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Escalate from parcel records to dated aerial change and LiDAR
              reconstruction. Real output below from the Brooklyn demo.
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

        <p className="mt-4 text-xs font-medium text-slate-500 md:hidden">
          Swipe to inspect all three outputs.
        </p>
        <div
          className="mt-4 grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 md:mt-6 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:pb-0"
          role="region"
          aria-label="CityLens site evidence outputs"
          tabIndex={0}
          data-testid="home-evidence-output-strip"
        >
          {/* preview.png card */}
          <div className="snap-start overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
              <SiteEvidencePreviewImage src={brooklynPreviewUrl} />
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
          <div className="flex snap-start flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
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
          <div className="flex snap-start flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
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
              Site-evidence runs stay reproducible.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Each advanced run records hashes for its imagery, footprint, and
              LiDAR inputs, keeping every artifact tied to its source.
            </p>
          </div>
          <div
            className="grid snap-x snap-mandatory auto-cols-[84%] grid-flow-col gap-3 overflow-x-auto pb-2 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:pb-0"
            role="region"
            aria-label="Reproducible site-evidence safeguards"
            tabIndex={0}
            data-testid="home-trust-strip"
          >
            <TrustCard
              icon={<Fingerprint className="h-4 w-4" />}
              title="Hashed inputs"
              body="Imagery, footprints, and LiDAR are fingerprinted in run_summary.json."
            />
            <TrustCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Fixed run contract"
              body="Year, baseline, and model options are governed by the server."
            />
            <TrustCard
              icon={<FileCode className="h-4 w-4" />}
              title="QA travels with artifacts"
              body="Segmentation, change, and mesh checks stay with every run."
            />
          </div>
        </div>
      </section>

      <div id="featured-demos">
        <FeaturedDemoCards demos={featured} />
      </div>

      {/* ---------- Closing action ---------- */}
      <section
        id="create"
        data-testid="home-closing-cta"
        className="relative overflow-hidden rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm md:p-8"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
              Move from market to site
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Start with the citywide shortlist. Escalate only the parcel that earns it.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Open the 5,000-lead workspace, or create dated aerial and 3D
              evidence for a specific NYC address.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href="/parcel-intel"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open parcel intelligence
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/runs/new"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-sky-300 bg-white px-5 text-sm font-semibold text-slate-950 transition hover:border-sky-400 hover:bg-sky-100"
            >
              Create site evidence
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function AcquisitionWorkspacePreview() {
  const dots = [
    ['18%', '72%', 'bg-rose-400'],
    ['25%', '61%', 'bg-amber-300'],
    ['31%', '78%', 'bg-rose-400'],
    ['39%', '49%', 'bg-sky-300'],
    ['44%', '65%', 'bg-rose-400'],
    ['49%', '34%', 'bg-amber-300'],
    ['54%', '56%', 'bg-rose-400'],
    ['59%', '44%', 'bg-sky-300'],
    ['63%', '70%', 'bg-rose-400'],
    ['68%', '27%', 'bg-amber-300'],
    ['72%', '50%', 'bg-rose-400'],
    ['77%', '37%', 'bg-sky-300'],
    ['82%', '61%', 'bg-rose-400'],
  ] as const;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur"
      aria-label="Illustrative CityLens acquisition workspace"
      data-testid="acquisition-workspace-preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
            Citywide decision desk
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            Market → parcel → comparison → workflow
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-300/25">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Current-source gates
        </span>
      </div>

      <div className="grid md:grid-cols-[0.92fr_1.08fr]">
        <div className="relative min-h-64 overflow-hidden border-b border-white/10 bg-slate-900/70 md:border-b-0 md:border-r">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(22deg, transparent 45%, rgba(148,163,184,.28) 46%, rgba(148,163,184,.28) 48%, transparent 49%), linear-gradient(112deg, transparent 47%, rgba(148,163,184,.18) 48%, rgba(148,163,184,.18) 50%, transparent 51%)',
              backgroundSize: '70px 58px, 86px 72px',
            }}
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border-[24px] border-sky-500/10"
            aria-hidden="true"
          />
          <div className="absolute left-3 top-3 flex gap-1 rounded-lg border border-white/10 bg-slate-950/70 p-1 text-[9px] font-medium text-slate-300 backdrop-blur">
            <span className="rounded bg-white px-2 py-1 text-slate-950">
              Priority
            </span>
            <span className="px-2 py-1">Borough</span>
            <span className="px-2 py-1">Opportunity</span>
          </div>
          {dots.map(([left, top, color], index) => (
            <span
              key={`${left}-${top}`}
              className={`absolute h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_0_2px_rgba(15,23,42,.85)] ${
                index === 8
                  ? 'ring-4 ring-white/35'
                  : ''
              }`}
              style={{ left, top }}
              aria-hidden="true"
            />
          ))}
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 text-[10px] text-slate-300 backdrop-blur">
            <span>All five boroughs</span>
            <span className="font-medium text-white">One ranked market</span>
          </div>
        </div>

        <div className="bg-white p-4 text-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-700">
                Current decision posture
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight">
                Review current evidence
              </div>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                Historical rank is a screening order—not seller intent.
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">
              NYC #82
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <PreviewMetric label="Current project gate" value="Passed" tone="emerald" />
            <PreviewMetric label="Unused floor area" value="5,000 sqft" />
            <PreviewMetric label="Ownership" value="Source-dated" />
            <PreviewMetric label="Diligence" value="2 reviews" tone="amber" />
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Evidence trail
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[9px] text-slate-500">
              {['PLUTO facts', 'ACRIS owner', 'DOB / ZAP'].map((source) => (
                <span
                  key={source}
                  className="rounded-md bg-white px-1.5 py-1.5 ring-1 ring-inset ring-slate-200"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-3 py-2.5 ring-1 ring-inset ring-sky-200">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                Recommended next diligence
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-sky-950">
                Verify official records before outreach
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-sky-700" />
          </div>
        </div>
      </div>

      <p className="border-t border-white/10 px-4 py-2 text-[9px] leading-4 text-slate-400">
        Illustrative product preview. CityLens surfaces screening evidence; it
        does not issue appraisals or buy/pass recommendations.
      </p>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'emerald' | 'amber';
}) {
  const toneClass = {
    slate: 'bg-slate-50 text-slate-950 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200',
  }[tone];
  return (
    <div className={`rounded-lg p-2.5 ring-1 ring-inset ${toneClass}`}>
      <div className="text-[8px] uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-[11px] font-semibold">{value}</div>
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
  violet: {
    bar: 'bg-violet-500',
    iconBg: 'bg-violet-50 text-violet-700 ring-violet-200',
    chipNum: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
} as const;

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
    <li className="relative flex snap-start flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
    <div className="snap-start rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
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
