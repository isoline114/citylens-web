import type { Metadata } from 'next';
import Link from 'next/link';

import { CodeBlock, Endpoint } from '@/components/docs/CodeBlock';

export const metadata: Metadata = {
  title: 'CityLens API · Docs',
  description:
    'Reference for the CityLens REST API: authentication, run options, endpoints, error codes, and the per-input audit trail every run produces.',
};

const API_BASE = 'https://www.citylens.dev';
const SAMPLE_RUN = '5f079d78d89c4387a9c0ddd5e3507b5e';

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'auth', label: 'Authentication' },
  { id: 'quotas', label: 'Plans & quotas' },
  { id: 'run-options', label: 'Run options (locked)' },
  { id: 'endpoints', label: 'Endpoint reference' },
  { id: 'errors', label: 'Errors' },
  { id: 'audit-trail', label: 'Audit trail' },
];

export default function DocsPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* Sidebar TOC */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <nav aria-label="Documentation table of contents" className="text-sm">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            On this page
          </div>
          <ul className="space-y-1">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 space-y-12">
        {/* Hero */}
        <section id="overview" className="scroll-mt-24">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              v0.1 · stable
            </span>
            <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
              {API_BASE}
            </code>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            CityLens API
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-700">
            A small, opinionated REST API for urban building change detection
            and 3D reconstruction from aerial imagery. Each run produces a
            classified <code>change.geojson</code>, a LOD1{' '}
            <code>mesh.ply</code>, a rendered preview, and a reproducible
            audit trail of input SHA-256s. NYC-only for now (5 boroughs);
            extending to additional regions is on the roadmap.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="#quickstart"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Quickstart
            </Link>
            <Link
              href="#endpoints"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Endpoint reference
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Sign up · 5 free runs / month
            </Link>
          </div>
        </section>

        {/* Quickstart */}
        <section id="quickstart" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">Quickstart</h2>
          <p className="text-sm text-slate-700">
            Three commands, no sign-in required. Pulls a featured demo run and
            downloads its change.geojson and mesh.ply.
          </p>
          <CodeBlock language="bash" label="curl">
{`# 1. List featured demo runs (public)
curl -s ${API_BASE}/v1/demo/featured | jq '.Featured[0]'

# 2. Get the demo run detail
curl -s ${API_BASE}/v1/demo/runs/${SAMPLE_RUN} | jq '{run_id, status, qa: .qa.change_counts}'

# 3. Download artifacts (signed URLs, no auth)
curl -L ${API_BASE}/v1/demo/artifacts/${SAMPLE_RUN}/change.geojson -o change.geojson
curl -L ${API_BASE}/v1/demo/artifacts/${SAMPLE_RUN}/mesh.ply       -o mesh.ply`}
          </CodeBlock>
          <p className="text-xs text-slate-600">
            To create a real run on a new address, you need a free account.
            Sign up at <Link href="/sign-up" className="underline">/sign-up</Link>{' '}
            and follow the authenticated flow below.
          </p>
        </section>

        {/* Authentication */}
        <section id="auth" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">Authentication</h2>
          <p className="text-sm text-slate-700">
            CityLens has three credential surfaces. Each protects a different
            thing — they don&apos;t overlap and don&apos;t substitute for each
            other.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <AuthCard
              kind="user"
              title="User login"
              body={
                <>
                  Email + password via{' '}
                  <Link href="/sign-up" className="underline">/sign-up</Link>.
                  Browser exchanges credentials for a short-lived JWT,
                  attached as <code>Authorization: Bearer …</code> on every{' '}
                  <code>/v1/runs*</code> and <code>/v1/me</code> call.
                </>
              }
            />
            <AuthCard
              kind="api-key"
              title="Programmatic API keys"
              body={
                <>
                  Mint Bearer keys (prefix <code>clk_live_</code>) at{' '}
                  <Link href="/account/api-keys" className="underline">/account/api-keys</Link>.
                  Each key inherits your plan + monthly quota; revoke any time. Send as{' '}
                  <code>Authorization: Bearer clk_live_…</code> — same header as user JWTs.
                </>
              }
            />
            <AuthCard
              kind="docs-key"
              title="Docs access key"
              body={
                <>
                  Gates the engine&apos;s interactive <code>/docs</code>,{' '}
                  <code>/redoc</code>, and <code>/openapi.json</code> via{' '}
                  <code>X-Docs-Key</code>. Cannot create runs or read user
                  data.
                </>
              }
            />
          </div>
          <CodeBlock language="bash" label="bearer auth example">
{`# Get a token by signing in (browser does this automatically).
# Then attach it on protected routes:
curl -s ${API_BASE}/v1/me \\
  -H "Authorization: Bearer $TOKEN" | jq '{email, plan_type, quota}'`}
          </CodeBlock>
          <CodeBlock language="bash" label="user api key example">
{`# Mint a key at /account/api-keys, then use it from any script:
curl -s ${API_BASE}/v1/me \\
  -H "Authorization: Bearer clk_live_…" | jq '{user, quota}'

# API keys are interchangeable with JWTs — they hit the same routes
# and use the same plan/quota state. Revoke any time from the dashboard.`}
          </CodeBlock>
        </section>

        {/* Quotas */}
        <section id="quotas" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">Plans & quotas</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[560px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Monthly runs</th>
                  <th className="px-3 py-2">Concurrent</th>
                  <th className="px-3 py-2">Demo views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Free</td>
                  <td className="px-3 py-2 text-slate-700">5 / UTC month</td>
                  <td className="px-3 py-2 text-slate-700">1</td>
                  <td className="px-3 py-2 text-slate-700">unlimited, never count</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Admin</td>
                  <td className="px-3 py-2 text-slate-700">unlimited</td>
                  <td className="px-3 py-2 text-slate-700">unlimited</td>
                  <td className="px-3 py-2 text-slate-700">unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="ml-5 list-disc space-y-1 text-sm text-slate-700">
            <li>
              Failed runs (e.g. addresses outside LiDAR coverage, worker
              timeouts) refund their slot the next time you view the run.
            </li>
            <li>
              When you exceed the monthly limit the API returns{' '}
              <code>429</code> with{' '}
              <code>detail.code = &quot;MONTHLY_QUOTA_EXCEEDED&quot;</code>{' '}
              and the current <code>month_key</code>.
            </li>
            <li>
              Inspect your live quota at any time with{' '}
              <code>GET /v1/me</code>.
            </li>
          </ul>
        </section>

        {/* Run options */}
        <section id="run-options" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">
            Run options (server-locked)
          </h2>
          <p className="text-sm text-slate-700">
            The MVP exposes a fixed set of run parameters. Anything else is
            rejected with <code>400 INVALID_RUN_OPTION</code>. Discover the
            current schema at <code>GET /v1/run-options</code> — the response
            below is live as of this writing.
          </p>
          <CodeBlock language="json" label="GET /v1/run-options">
{`{
  "imagery_years": [2024],
  "baseline_years": [2017],
  "segmentation_backends": ["sam2"],
  "outputs": ["change", "mesh", "previews"],
  "defaults": {
    "imagery_year": 2024,
    "baseline_year": 2017,
    "segmentation_backend": "sam2",
    "outputs": ["previews", "change", "mesh"],
    "aoi_radius_m": 250
  }
}`}
          </CodeBlock>
          <p className="text-xs text-slate-600">
            <code>aoi_radius_m</code> is server-fixed at 250m. Clients must
            not send it. Geographic scope is currently NYC&apos;s five
            boroughs (the GDB footprint baseline + NYS LiDAR coverage).
          </p>
        </section>

        {/* Endpoints */}
        <section id="endpoints" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl font-semibold text-slate-950">
            Endpoint reference
          </h2>

          <Endpoint
            id="endpoint-health"
            method="GET"
            path="/v1/health"
            auth="public"
            title="Service health"
            description={<>Liveness probe. Returns the deployed version.</>}
            request={{ language: 'bash', body: `curl -s ${API_BASE}/v1/health` }}
            response={{
              language: 'json',
              body: `{ "ok": true, "version": "0.1.0" }`,
            }}
          />

          <Endpoint
            id="endpoint-demo-featured"
            method="GET"
            path="/v1/demo/featured"
            auth="public"
            title="List featured demo runs"
            description={
              <>
                Returns precomputed runs grouped by category (currently just{' '}
                <code>Featured</code>). Safe to share publicly. Used by the
                home-page demo carousel.
              </>
            }
            request={{ language: 'bash', body: `curl -s ${API_BASE}/v1/demo/featured | jq` }}
            response={{
              language: 'json',
              body: `{
  "Featured": [
    {
      "run_id": "${SAMPLE_RUN}",
      "label": "Brooklyn brownstones — Flatbush",
      "address": "100 E 21st St Brooklyn, NY 11226",
      "imagery_year": 2024,
      "baseline_year": 2017,
      "segmentation_backend": "sam2",
      "outputs": ["previews", "change", "mesh"]
    }
    /* … */
  ]
}`,
            }}
          />

          <Endpoint
            id="endpoint-demo-run"
            method="GET"
            path="/v1/demo/runs/{run_id}"
            auth="public"
            title="Get a demo run detail"
            description={
              <>
                Full run document for one of the precomputed featured runs:
                request, status, artifacts (with public signed URLs), QA
                metrics, and the per-input audit trail.
              </>
            }
            request={{
              language: 'bash',
              body: `curl -s ${API_BASE}/v1/demo/runs/${SAMPLE_RUN} | jq '.qa.change_counts'`,
            }}
            response={{
              language: 'json',
              body: `{
  "run_id": "${SAMPLE_RUN}",
  "status": "succeeded",
  "stage": "done",
  "progress": 100,
  "request": { "address": "100 E 21st St Brooklyn, NY 11226", … },
  "artifacts": [
    { "name": "change.geojson", "signed_url": "/v1/demo/artifacts/${SAMPLE_RUN}/change.geojson", … },
    { "name": "mesh.ply",       "signed_url": "/v1/demo/artifacts/${SAMPLE_RUN}/mesh.ply",       … },
    { "name": "preview.png",    "signed_url": "/v1/demo/artifacts/${SAMPLE_RUN}/preview.png",    … }
  ],
  "qa": {
    "change_counts": { "unchanged": 134, "modified": 0, "demolished": 0, "added": 2 },
    "orthophoto_sha256": "1d7b3564…",
    "baseline_sha256":   "c66eb293…",
    "lidar_sha256":      "3ae465d8…"
  }
}`,
            }}
          />

          <Endpoint
            id="endpoint-demo-artifact"
            method="GET"
            path="/v1/demo/artifacts/{run_id}/{name}"
            auth="public"
            title="Download a demo artifact"
            description={
              <>
                Streams the GCS-backed artifact via a server-side proxy. No
                auth required for demo artifacts. <code>name</code> is one of{' '}
                <code>change.geojson</code>, <code>mesh.ply</code>,{' '}
                <code>preview.png</code>, <code>run_summary.json</code>.
              </>
            }
            request={{
              language: 'bash',
              body: `curl -L ${API_BASE}/v1/demo/artifacts/${SAMPLE_RUN}/mesh.ply -o mesh.ply`,
            }}
          />

          <Endpoint
            id="endpoint-run-options"
            method="GET"
            path="/v1/run-options"
            auth="public"
            title="Discover run-option schema"
            description={
              <>
                The fixed set of values the server will accept on{' '}
                <code>POST /v1/runs</code>. Useful for clients that want to
                build their own form.
              </>
            }
            request={{ language: 'bash', body: `curl -s ${API_BASE}/v1/run-options | jq` }}
          />

          <Endpoint
            id="endpoint-me"
            method="GET"
            path="/v1/me"
            auth="bearer"
            title="Current user, plan, and live quota"
            description={
              <>Returns the signed-in user, their plan, and the current month&apos;s usage.</>
            }
            request={{
              language: 'bash',
              body: `curl -s ${API_BASE}/v1/me \\
  -H "Authorization: Bearer $TOKEN"`,
            }}
            response={{
              language: 'json',
              body: `{
  "user":  { "id": "…", "email": "you@example.com", "plan_type": "free", "is_admin": false },
  "quota": {
    "month_key": "2026-04",
    "monthly_run_limit": 5,
    "runs_used": 1,
    "runs_remaining": 4,
    "unlimited": false,
    "max_concurrent_runs": 1
  }
}`,
            }}
          />

          <Endpoint
            id="endpoint-create-run"
            method="POST"
            path="/v1/runs"
            auth="bearer"
            title="Create a new run"
            description={
              <>
                Reserves a monthly quota slot and triggers the Cloud Run
                worker. Returns immediately with a <code>run_id</code> —
                poll <code>GET /v1/runs/{'{run_id}'}</code> for status.
                Trigger failures refund the slot automatically.
              </>
            }
            request={{
              language: 'bash',
              body: `curl -s ${API_BASE}/v1/runs \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "100 E 21st St Brooklyn, NY 11226",
    "outputs": ["previews", "change", "mesh"]
  }'`,
            }}
            response={{
              language: 'json',
              body: `{
  "run_id": "9f3a…",
  "status": "queued",
  "stage": "queued",
  "progress": 0,
  "created_at": "2026-04-30T18:25:57.370891Z"
}`,
            }}
            notes={
              <>
                Body fields outside the locked schema (e.g.{' '}
                <code>imagery_year: 2023</code>, <code>aoi_radius_m</code>,{' '}
                <code>sam2_cfg</code>) return <code>400 INVALID_RUN_OPTION</code>.
              </>
            }
          />

          <Endpoint
            id="endpoint-list-runs"
            method="GET"
            path="/v1/runs"
            auth="bearer"
            title="List your runs"
            description={
              <>Returns runs owned by the calling user, newest first. Demo runs are never returned here.</>
            }
            request={{
              language: 'bash',
              body: `curl -s ${API_BASE}/v1/runs \\
  -H "Authorization: Bearer $TOKEN"`,
            }}
          />

          <Endpoint
            id="endpoint-run-detail"
            method="GET"
            path="/v1/runs/{run_id}"
            auth="bearer"
            title="Get one of your runs"
            description={
              <>
                Same shape as the demo run detail. Returns <code>404</code> if
                the run isn&apos;t owned by the signed-in user.
              </>
            }
            request={{
              language: 'bash',
              body: `curl -s ${API_BASE}/v1/runs/$RUN_ID \\
  -H "Authorization: Bearer $TOKEN"`,
            }}
          />
        </section>

        {/* Errors */}
        <section id="errors" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">Errors</h2>
          <p className="text-sm text-slate-700">
            All errors come back with a stable <code>detail.code</code> string
            so clients can branch on outcomes without parsing messages.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[640px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">HTTP</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <ErrRow
                  code="INVALID_RUN_OPTION"
                  http="400"
                  when="POST /v1/runs body contains a field or value outside the locked schema."
                />
                <ErrRow
                  code="—"
                  http="401"
                  when="Missing or invalid Authorization header on a protected route."
                />
                <ErrRow
                  code="—"
                  http="404"
                  when="run_id not owned by the signed-in user, or doesn't exist."
                />
                <ErrRow
                  code="MONTHLY_QUOTA_EXCEEDED"
                  http="429"
                  when="Free plan has used all 5 runs for the current UTC calendar month."
                />
                <ErrRow
                  code="CONCURRENT_LIMIT_EXCEEDED"
                  http="429"
                  when="Free plan already has a queued or running job."
                />
                <ErrRow
                  code="LIDAR_NO_COVERAGE"
                  http="run.error"
                  when="Address is outside the configured LAS index layer. Slot is refunded."
                />
                <ErrRow
                  code="WORKER_FAILED"
                  http="run.error"
                  when="Generic worker failure (timeout, transient infra). Slot is refunded on view."
                />
              </tbody>
            </table>
          </div>
          <CodeBlock language="json" label="429 example">
{`{
  "detail": {
    "code": "MONTHLY_QUOTA_EXCEEDED",
    "message": "Free plan limit of 5 runs/month reached.",
    "plan_type": "free",
    "monthly_run_limit": 5,
    "runs_used": 5,
    "runs_remaining": 0,
    "month_key": "2026-04"
  }
}`}
          </CodeBlock>
        </section>

        {/* Audit trail */}
        <section id="audit-trail" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">Audit trail</h2>
          <p className="text-sm text-slate-700">
            Every CityLens run is byte-level reproducible. The QA block on
            each run records SHA-256s of every input asset the pipeline read,
            the geocoded XY of the address, the LiDAR tile id, the county
            footprint sources, and the SAM2 model mode. Two runs with the
            same QA hashes produce identical outputs.
          </p>
          <CodeBlock language="json" label="run.qa fields">
{`{
  "orthophoto_sha256":      "1d7b35644d882b9271927defe60fa7be2c18929d…",
  "baseline_sha256":        "c66eb2931eacf28752d4468e65ef63b24e13a23d…",
  "lidar_sha256":           "3ae465d8b6373ee114ee215f84350511578e5468…",
  "reference_case_id":      "100_e_21st_st_brooklyn_ny_11226",
  "baseline_footprints_used": true,
  "lidar_used":             true,
  "sam2_used":              true,
  "sam2_mode":              "prompted",
  "preview_source":         "change_classified",
  "change_counts":          { "unchanged": 134, "modified": 0, "demolished": 0, "added": 2 }
}`}
          </CodeBlock>
          <p className="text-xs text-slate-600">
            Useful when CityLens output is an input to a downstream legal,
            compliance, or insurance workflow — every claim about a building
            traces back to specific bytes from a known publisher and date.
          </p>
        </section>

        {/* Footer */}
        <section className="border-t border-slate-200 pt-6 text-sm text-slate-600">
          Need to sign in? <Link href="/sign-in" className="underline">/sign-in</Link>.
          Forgot your password?{' '}
          <Link href="/forgot-password" className="underline">/forgot-password</Link>.
          See an issue with the docs? Open one at{' '}
          <a
            href="https://github.com/joshvern/citylens-web/issues"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            joshvern/citylens-web
          </a>
          .
        </section>
      </div>
    </div>
  );
}

function AuthCard({
  kind,
  title,
  body,
}: {
  kind: 'user' | 'api-key' | 'docs-key';
  title: string;
  body: React.ReactNode;
}) {
  const tag =
    kind === 'user'
      ? { label: 'normal users', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
      : kind === 'api-key'
        ? { label: 'reserved', classes: 'bg-amber-50 text-amber-800 ring-amber-200' }
        : { label: 'ops only', classes: 'bg-slate-100 text-slate-700 ring-slate-200' };
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <span
          className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ring-1 ring-inset ${tag.classes}`}
        >
          {tag.label}
        </span>
      </div>
      <div className="mt-2 text-sm text-slate-700">{body}</div>
    </div>
  );
}

function ErrRow({ code, http, when }: { code: string; http: string; when: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-xs text-slate-900">{code}</td>
      <td className="px-3 py-2 text-slate-700">{http}</td>
      <td className="px-3 py-2 text-slate-700">{when}</td>
    </tr>
  );
}
