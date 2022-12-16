import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CityLens API docs',
  description: 'Public surface and access rules for the CityLens API.',
};

export default function DocsPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>CityLens API</h1>

      <h2>Public demo endpoints (no auth)</h2>
      <p>These endpoints do not require an account and are safe to share publicly:</p>
      <ul>
        <li>
          <code>GET /v1/demo/featured</code> — list featured demo runs
        </li>
        <li>
          <code>GET /v1/demo/runs/{'{run_id}'}</code> — run detail for a featured demo
        </li>
        <li>
          <code>GET /v1/demo/artifacts/{'{run_id}'}/{'{artifact_name}'}</code> — proxied artifact
        </li>
      </ul>

      <h2>Authenticated endpoints (require sign in)</h2>
      <p>
        Real run creation requires a signed-in user. The browser obtains an access token from the
        configured auth provider (Neon Auth) and the API client attaches{' '}
        <code>Authorization: Bearer &lt;token&gt;</code>:
      </p>
      <ul>
        <li><code>POST /v1/runs</code> — create a new run</li>
        <li><code>GET /v1/runs</code> — list your runs</li>
        <li><code>GET /v1/runs/{'{run_id}'}</code> — run detail</li>
        <li><code>GET /v1/me</code> — current user, plan, and monthly quota</li>
      </ul>

      <h2>Plans &amp; quotas</h2>
      <ul>
        <li>Free plan: 5 real runs per UTC calendar month, 1 concurrent run.</li>
        <li>Admin plan: unlimited.</li>
        <li>
          Monthly quota responses include <code>code: &quot;MONTHLY_QUOTA_EXCEEDED&quot;</code> and
          the current <code>month_key</code>.
        </li>
      </ul>

      <h2>Run options (server-locked)</h2>
      <p>The MVP exposes a fixed set of run options. Discover them with <code>GET /v1/run-options</code>.</p>
      <ul>
        <li><code>imagery_year</code>: 2024</li>
        <li><code>baseline_year</code>: 2017</li>
        <li><code>segmentation_backend</code>: <code>sam2</code></li>
        <li><code>outputs</code>: any non-empty subset of <code>previews</code>, <code>change</code>, <code>mesh</code></li>
        <li><code>aoi_radius_m</code> is fixed server-side; clients must not send it</li>
      </ul>

      <h2>Programmatic API keys</h2>
      <p>
        Per-user programmatic API keys are not yet enabled. Future versions will issue plan-scoped
        API keys with the same monthly quota as their owner. The optional admin API key path
        (<code>X-API-Key</code>) is reserved for internal scripts only and is disabled by default.
      </p>

      <h2>Interactive docs</h2>
      <p>
        <code>/docs</code>, <code>/redoc</code>, and <code>/openapi.json</code> on the engine are
        gated by an <code>X-Docs-Key</code> header. The docs key cannot create runs or access user
        data.
      </p>

      <p className="text-sm text-slate-600">
        Need to sign in? <Link href="/sign-in">Go to sign-in</Link>.
      </p>
    </article>
  );
}
