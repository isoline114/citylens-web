import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CityLens API docs',
  description: 'Public surface, authentication model, and quota policy for the CityLens API.',
};

export default function DocsPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>CityLens API</h1>

      <p>
        CityLens exposes a small REST API for change detection and 3D
        reconstruction from aerial imagery. Public demo endpoints serve
        precomputed runs without sign-in. Real run creation is account-backed
        and quota-limited.
      </p>

      <h2>Authentication model</h2>
      <p>There are three distinct credential surfaces. Each protects a different thing:</p>
      <ul>
        <li>
          <strong>User login</strong> — email + password via{' '}
          <Link href="/sign-up">/sign-up</Link>. After sign-in, the browser
          issues a short-lived JWT (signed and verified via JWKS) and includes
          it as <code>Authorization: Bearer &lt;token&gt;</code> on every
          request to <code>/v1/runs*</code> and <code>/v1/me</code>. Normal
          users do not need to manage API keys themselves.
        </li>
        <li>
          <strong>Programmatic API keys</strong> — not yet enabled for normal
          users. Future plan-aware keys will inherit their owner&apos;s monthly
          quota. The optional admin <code>X-API-Key</code> path is reserved for
          internal scripts (e.g. demo precomputation) and is disabled by
          default.
        </li>
        <li>
          <strong>Docs access key</strong> — gates the engine&apos;s
          interactive <code>/docs</code>, <code>/redoc</code>, and{' '}
          <code>/openapi.json</code> via an <code>X-Docs-Key</code> header.
          This key cannot create runs or read user data.
        </li>
      </ul>

      <h2>Public demo endpoints (no auth)</h2>
      <p>Safe to share publicly. These do not count toward any quota.</p>
      <ul>
        <li><code>GET /v1/demo/featured</code> — list featured demo runs</li>
        <li><code>GET /v1/demo/runs/{'{run_id}'}</code> — run detail for a featured demo</li>
        <li><code>GET /v1/demo/artifacts/{'{run_id}'}/{'{artifact_name}'}</code> — proxied artifact</li>
        <li><code>GET /v1/run-options</code> — supported run options</li>
        <li><code>GET /v1/health</code> — service health</li>
      </ul>

      <h2>Authenticated endpoints (require sign-in)</h2>
      <ul>
        <li><code>POST /v1/runs</code> — create a new run</li>
        <li><code>GET /v1/runs</code> — list your runs</li>
        <li><code>GET /v1/runs/{'{run_id}'}</code> — run detail</li>
        <li><code>GET /v1/me</code> — current user, plan, and monthly quota</li>
      </ul>

      <h2>Free plan and quotas</h2>
      <ul>
        <li><strong>Free plan</strong>: 5 real runs per UTC calendar month, 1 concurrent run.</li>
        <li><strong>Admin</strong>: unlimited (set per-account, not self-serve).</li>
        <li>
          Public demo views never count against your monthly quota.
        </li>
        <li>
          Failed runs (e.g. addresses outside LiDAR coverage, worker timeouts)
          refund their slot the next time you view the run.
        </li>
        <li>
          When you exceed the monthly limit, the API returns{' '}
          <code>429</code> with{' '}
          <code>detail.code = &quot;MONTHLY_QUOTA_EXCEEDED&quot;</code> and the
          current <code>month_key</code>.
        </li>
      </ul>

      <h2>Run options (server-locked)</h2>
      <p>
        The MVP exposes a fixed set of run parameters. Discover them with{' '}
        <code>GET /v1/run-options</code>.
      </p>
      <ul>
        <li><code>imagery_year</code>: 2024</li>
        <li><code>baseline_year</code>: 2017</li>
        <li><code>segmentation_backend</code>: <code>sam2</code></li>
        <li>
          <code>outputs</code>: any non-empty subset of <code>previews</code>,{' '}
          <code>change</code>, <code>mesh</code>
        </li>
        <li>
          <code>aoi_radius_m</code> is fixed server-side; clients must not
          send it.
        </li>
      </ul>

      <p className="text-sm text-slate-600">
        Need to sign in? <Link href="/sign-in">Go to sign-in</Link>. Forgot
        your password? <Link href="/forgot-password">Reset it</Link>.
      </p>
    </article>
  );
}
