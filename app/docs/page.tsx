import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Code2,
  Database,
  KeyRound,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { CodeBlock, Endpoint } from '@/components/docs/CodeBlock';

export const metadata: Metadata = {
  title: 'Developer Center — CityLens',
  description:
    'Build on CityLens parcel intelligence and reproducible aerial-change evidence with the REST API.',
};

const API_BASE = 'https://api.citylens.dev';

const TOC = [
  { id: 'start', label: 'Start' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'parcel-intelligence', label: 'Parcel intelligence' },
  { id: 'imagery-runs', label: 'Imagery runs' },
  { id: 'errors', label: 'Errors' },
  { id: 'evidence', label: 'Evidence contract' },
] as const;

const QUICKSTART = `API_BASE=${API_BASE}

# Resolve a currently published demo instead of hard-coding a run id.
SAMPLE_RUN=$(curl -fsS "$API_BASE/v1/demo/featured" \\
  | jq -r '.Featured[0].run_id')

# Inspect the run receipt and its available artifacts.
curl -fsS "$API_BASE/v1/demo/runs/$SAMPLE_RUN" \\
  | jq '{run_id, status, artifacts: [.artifacts[].name]}'

# Read pipeline QA and timing from the summary artifact.
curl -fsSL "$API_BASE/v1/demo/artifacts/$SAMPLE_RUN/run_summary.json" \\
  | jq '{ok, qa: {change_counts: .qa.change_counts, lidar_used: .qa.lidar_used}, performance}'

# Download one real, precomputed output through the stable API proxy.
curl -fsSL "$API_BASE/v1/demo/artifacts/$SAMPLE_RUN/change.geojson" \\
  -o change.geojson`;

export default function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-2 sm:py-6">
      <header
        className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 px-5 py-7 text-white shadow-[0_30px_90px_-52px_rgba(15,23,42,0.8)] sm:px-8 sm:py-10"
        data-testid="developer-center-hero"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
        />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-200">
              <Code2 className="h-3.5 w-3.5" />
              Developer platform · v0.1
            </div>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Build acquisition workflows on a source-aware city model.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              Screen the five-borough parcel market, explain exact tax lots,
              and request reproducible aerial-change evidence through one REST
              API. Receipts expose access scope, source lineage, and output
              state so clients do not have to infer them.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="#start"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <Sparkles className="h-4 w-4 text-sky-700" />
                Run the quickstart
              </a>
              <Link
                href="/account/api-keys"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <KeyRound className="h-4 w-4 text-sky-300" />
                API keys
              </Link>
              <a
                href={`${API_BASE}/v1/health`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Service status
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
            {[
              ['5,000', 'published leads'],
              ['125', 'public preview'],
              ['5', 'NYC boroughs'],
              ['4', 'run artifacts'],
            ].map(([value, label]) => (
              <div key={label} className="bg-slate-950/80 px-4 py-3.5">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  {label}
                </dt>
                <dd className="mt-1 text-xl font-semibold text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <nav
        aria-label="Developer center sections"
        className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
      >
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {TOC.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="flex min-h-10 items-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <nav
            aria-label="Developer center sections"
            className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Developer center
            </div>
            <ul className="space-y-1">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-10 items-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            <div className="font-semibold text-slate-950">Canonical base URL</div>
            <code className="mt-2 block break-all text-[11px] text-sky-800">
              {API_BASE}
            </code>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <DocSection
            id="start"
            eyebrow="Public first request"
            title="Resolve a live demo, then inspect its receipt."
            summary="The demo registry can change when outputs are regenerated. Resolve the current run id at request time; do not copy one from a screenshot or an old response."
          >
            <CodeBlock language="bash" label="four-command quickstart">
              {QUICKSTART}
            </CodeBlock>
            <Callout tone="info" title="Stable browser delivery">
              Demo artifact URLs are relative API proxy paths—not signed GCS
              URLs. Join them to <code>{API_BASE}</code>, or call the documented
              proxy path directly as above.
            </Callout>
          </DocSection>

          <DocSection
            id="authentication"
            eyebrow="Access"
            title="Use public routes, a browser session, or a revocable API key."
            summary="The product UI manages its own short-lived JWT. External scripts should use a user API key and keep it out of browser bundles, source control, logs, and URLs."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <AccessCard
                icon={Database}
                label="Public"
                title="Aggregates and demos"
                body="Health, run options, featured demos, demo artifacts, and the parcel preview require no credential."
              />
              <AccessCard
                icon={ShieldCheck}
                label="Browser"
                title="Managed session"
                body="CityLens signs UI requests with a short-lived bearer JWT. A visible identity is not treated as proof of API access."
              />
              <AccessCard
                icon={KeyRound}
                label="Recommended for code"
                title="User API key"
                body="Mint a clk_live_ key in Account → API keys. It inherits the account plan and can be revoked without changing the login password."
              />
            </div>
            <CodeBlock language="bash" label="bearer API key">
{`curl -fsS ${API_BASE}/v1/me \\
  -H "Authorization: Bearer clk_live_…" \\
  | jq '{user, quota}'`}
            </CodeBlock>
          </DocSection>

          <DocSection
            id="parcel-intelligence"
            eyebrow="Primary data product"
            title="Treat inventory scope as a response contract."
            summary="Public access returns a bounded 25-per-borough preview. Any valid user credential returns the complete published citywide inventory, currently 5,000 unique tax lots."
          >
            <CodeBlock language="bash" label="authenticated citywide map">
{`curl -fsS "${API_BASE}/v1/parcel-intel/map?top_per_borough=1000" \\
  -H "Authorization: Bearer clk_live_…" \\
  | jq '{access_scope, returned_count, available_count, inventory_complete}'`}
            </CodeBlock>
            <CodeBlock language="json" label="full-inventory receipt">
{`{
  "access_scope": "authenticated_full",
  "returned_count": 5000,
  "available_count": 5000,
  "inventory_complete": true
}`}
            </CodeBlock>
            <Callout tone="warning" title="Never infer access from row count alone">
              Require <code>access_scope</code>, <code>returned_count</code>,{' '}
              <code>available_count</code>, and{' '}
              <code>inventory_complete</code> to agree. An anonymous 125-row
              response is valid <code>public_preview</code>, not a truncated
              full inventory.
            </Callout>
            <div className="grid gap-3 md:grid-cols-2">
              <ContractRoute
                method="GET"
                path="/v1/parcel-intel/index"
                access="public"
                body="Aggregate generation, selection-policy, source-freshness, and borough receipts."
              />
              <ContractRoute
                method="GET"
                path="/v1/parcel-intel/map"
                access="tiered"
                body="Compact mappable rows: public preview or complete authenticated inventory."
              />
              <ContractRoute
                method="GET"
                path="/v1/parcel-intel/parcel/{bbl}"
                access="tiered"
                body="One ranked parcel plus its decision audit. Public access is limited to preview leads."
              />
              <ContractRoute
                method="GET"
                path="/v1/parcel-intel/screening/{bbl}"
                access="bearer"
                body="Explains published, below-cutoff, screened-out, or not-evaluated status for an exact BBL."
              />
              <ContractRoute
                method="POST"
                path="/v1/parcel-intel/resolve-address"
                access="bearer"
                body="Maps an official NYC street address to zero, one, or multiple candidate BBLs without guessing."
              />
              <ContractRoute
                method="GET"
                path="/v1/parcel-intel/official-parcel/{bbl}"
                access="bearer"
                body="Current, source-specific PLUTO and ACRIS facts. This dossier does not alter rank."
              />
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Workflow, evidence-review, saved-view, and product-event routes
              remain pilot application contracts. Contact CityLens before
              building an external integration against them.
            </p>
          </DocSection>

          <DocSection
            id="imagery-runs"
            eyebrow="Aerial evidence"
            title="Create a run, poll its state, then fetch named artifacts."
            summary="Run options are intentionally locked. Discover the accepted values first, submit only public fields, and read QA or timing from run_summary.json."
          >
            <Endpoint
              id="endpoint-run-options"
              method="GET"
              path="/v1/run-options"
              auth="public"
              title="Discover the accepted request schema"
              description={
                <>
                  The server currently fixes the imagery year, baseline year,
                  SAM2 backend, outputs, and 250-meter AOI.
                </>
              }
              request={{
                language: 'bash',
                body: `curl -fsS ${API_BASE}/v1/run-options | jq`,
              }}
              response={{
                language: 'json',
                body: `{
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
}`,
              }}
            />
            <Endpoint
              id="endpoint-create-run"
              method="POST"
              path="/v1/runs"
              auth="bearer"
              title="Queue one imagery run"
              description={
                <>
                  Reserves quota and returns immediately. Poll the returned run
                  id; do not hold the create request open.
                </>
              }
              request={{
                language: 'bash',
                body: `curl -fsS ${API_BASE}/v1/runs \\
  -H "Authorization: Bearer clk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "100 E 21st St Brooklyn, NY 11226",
    "outputs": ["previews", "change", "mesh"]
  }'`,
              }}
              response={{
                language: 'json',
                body: `{
  "run_id": "…",
  "status": "queued",
  "stage": "queued",
  "progress": 0,
  "artifacts": []
}`,
              }}
              notes={
                <>
                  Do not send internal fields such as <code>aoi_radius_m</code>,{' '}
                  <code>sam2_cfg</code>, or local input paths.
                </>
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              <ContractRoute
                method="GET"
                path="/v1/runs?limit&cursor"
                access="bearer"
                body="Owned runs, newest first, with an opaque next cursor."
              />
              <ContractRoute
                method="GET"
                path="/v1/runs/{run_id}"
                access="bearer"
                body="Owned run state and artifact metadata. Other users' ids return 404."
              />
              <ContractRoute
                method="GET"
                path="/v1/demo/featured"
                access="public"
                body="The current allowlisted precomputed demonstrations."
              />
              <ContractRoute
                method="GET"
                path="/v1/demo/artifacts/{run_id}/{name}"
                access="public"
                body="Streams an allowlisted demo artifact through the API."
              />
            </div>
            <Callout tone="info" title="Where QA actually lives">
              A run detail returns artifact metadata. Pipeline diagnostics and
              stage timings live inside the downloadable{' '}
              <code>run_summary.json</code> artifact under <code>qa</code> and{' '}
              <code>performance</code>.
            </Callout>
          </DocSection>

          <DocSection
            id="errors"
            eyebrow="Failure handling"
            title="Branch on status and structured product codes."
            summary="Policy and quota failures expose detail.code. Generic authentication, ownership, and infrastructure errors may use a plain detail message. Failed asynchronous runs carry a structured error object on the run."
          >
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[640px] divide-y divide-slate-200 text-sm">
                <caption className="sr-only">
                  CityLens API response codes and recommended client behavior
                </caption>
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">HTTP / state</th>
                    <th className="px-4 py-3">Stable code</th>
                    <th className="px-4 py-3">Client action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <ErrRow
                    state="400"
                    code="INVALID_RUN_OPTION"
                    action="Refresh /v1/run-options and correct the request."
                  />
                  <ErrRow
                    state="401"
                    code="—"
                    action="Replace or refresh the bearer credential."
                  />
                  <ErrRow
                    state="404"
                    code="—"
                    action="Treat an unknown or unowned run id as unavailable."
                  />
                  <ErrRow
                    state="429"
                    code="MONTHLY_QUOTA_EXCEEDED"
                    action="Read quota from /v1/me and wait for the next UTC month or change plan."
                  />
                  <ErrRow
                    state="429"
                    code="CONCURRENT_LIMIT_EXCEEDED"
                    action="Wait for the active run to reach a terminal state."
                  />
                  <ErrRow
                    state="run.error"
                    code="LIDAR_NO_COVERAGE / WORKER_FAILED"
                    action="Show the run's message and stage; do not render empty viewers."
                  />
                </tbody>
              </table>
            </div>
          </DocSection>

          <DocSection
            id="evidence"
            eyebrow="Interpretation"
            title="Keep provenance, model quality, and commercial outcomes separate."
            summary="CityLens exposes evidence needed to audit a response. Those receipts narrow uncertainty; they do not turn a screening product into a title report, zoning opinion, appraisal, or prediction of seller behavior."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <EvidenceCard
                icon={Database}
                title="Source receipt"
                body="Generation ids, source dates, input hashes, and official links identify the evidence used."
              />
              <EvidenceCard
                icon={Boxes}
                title="Pipeline QA"
                body="Mask overlap, mesh coverage, change counts, and stage timings describe technical output—not acquisition accuracy."
              />
              <EvidenceCard
                icon={MapPinned}
                title="Parcel rank"
                body="A rank orders the published screen. It is not seller intent, transaction probability, or a parcel-level confidence score."
              />
            </div>
            <Callout tone="warning" title="Reproducibility boundary">
              Matching input hashes prove that two runs used the same bytes.
              Byte-identical outputs additionally require the same code,
              model, configuration, and deterministic runtime; compare output
              hashes rather than assuming equivalence.
            </Callout>
          </DocSection>

          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Planning an integration?
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Bring the intended workflow, request volume, and evidence
                requirements—not just an endpoint list.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              Discuss an integration
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function DocSection({
  id,
  eyebrow,
  title,
  summary,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_50px_-44px_rgba(15,23,42,0.5)] sm:px-6 sm:py-6"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        {summary}
      </p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function AccessCard({
  icon: Icon,
  label,
  title,
  body,
}: {
  icon: typeof Database;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-800 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-4 w-4" />
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 ring-1 ring-slate-200">
          {label}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
    </article>
  );
}

function ContractRoute({
  method,
  path,
  access,
  body,
}: {
  method: 'GET' | 'POST';
  path: string;
  access: 'public' | 'tiered' | 'bearer';
  body: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold ${
            method === 'GET'
              ? 'bg-sky-100 text-sky-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {method}
        </span>
        <code className="min-w-0 break-all text-xs font-semibold text-slate-900">
          {path}
        </code>
        <span className="ml-auto rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
          {access}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{body}</p>
    </article>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'warning';
  title: string;
  children: ReactNode;
}) {
  const warning = tone === 'warning';
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        warning
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : 'border-sky-200 bg-sky-50 text-sky-950'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        {warning ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {title}
      </div>
      <div className="mt-1.5 text-xs leading-5 opacity-90">{children}</div>
    </div>
  );
}

function EvidenceCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Database;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-sky-700" />
      <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
    </article>
  );
}

function ErrRow({
  state,
  code,
  action,
}: {
  state: string;
  code: string;
  action: string;
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-mono text-xs text-slate-900">{state}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-700">{code}</td>
      <td className="px-4 py-3 text-xs leading-5 text-slate-600">{action}</td>
    </tr>
  );
}
