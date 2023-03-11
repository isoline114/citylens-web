# citylens-web

The Parcel Intelligence surface at `/parcel-intel` is one citywide explorer,
not five separate borough workspaces. Borough and eligibility filters update the
same map/list, and selecting a lot opens its overview, underwriting, workflow,
official-source links, provenance, and model explanation in an in-place parcel
panel. Legacy `/parcel-intel/<borough>` links redirect into the citywide route.

Signed-in users also have a private watchlist change center. It compares the
baseline captured when a parcel entered the acquisition workflow with the
current atomic feed and surfaces owner, sale-year, zoning, priority,
opportunity, lien, violation, flood, imagery, portfolio-size, and
environmental-designation changes, plus feed-removal changes. A feed-removal alert asks the user to verify current
official records; it never invents a disposition or seller-intent claim.
The explorer renders its public preview immediately, upgrades authenticated
users with one compact 5,000-row citywide request, and fetches polygon,
explanation, provenance, and underwriting detail only when a parcel is opened.
Full borough payloads are deferred until the user requests a CSV. The explorer
also exposes multi-lot assemblage candidates, a signed-in filter for official
NYC DOF final tax-lien sale history, a filter for parcels with current Class 1
ECB or Class C HPD immediately hazardous records, a signed-in 1% annual-chance
floodplain screen, a signed-in exact-name current-PLUTO legal-owner portfolio
filter, a signed-in PLUTO E-designation/restrictive-declaration screen, and the
accepted model's clearly labeled forward-test hit rate. These instruments are
presented only as current air/noise/hazardous-materials diligence requirements;
neither is described as proof of contamination or as an automatic prohibition. A user
can open a parcel and focus the citywide map on other current candidates with
the same exact normalized legal name. Signed-in users can open Outcome Insights
to see fixed-horizon 30-day contact, 90-day qualification, 180-day offer,
270-day contract, and 365-day close rates. A lead enters a denominator only
when the full observation window has elapsed; late-recorded milestones do not
inflate on-time rates, archived leads remain included, and small cohorts stay
labeled “Collecting.” Each parcel workflow also exposes its value-minimized
decision history. Those user-entered, selected-lead outcomes are kept separate
from historical model accuracy. The portfolio card explicitly does not
infer beneficial ownership or related LLCs. Parcel detail separates DOB Safety,
OATH/ECB, and HPD counts and keeps the adopted 2007 FIRM separate from the 2015
preliminary FIRM. It links each official source and warns that tax-lot overlap
is not building-level flood depth or site-specific diligence. These overlays
are verification context—not ranking inputs, current seller intent, or proof
that an issue remains uncorrected.

The UI consumes `published_sweep@v5` ranking/eligibility evidence. Model
attributions describe historical DOB **activity records** (which can include
filings, trade permits, and renewals tied to one job) and are never presented as
a count of completed buildings or as evidence that an owner intends to sell.

CityLens product frontend. Live at **https://www.citylens.dev**.

[`citylens-web`](https://github.com/joshvern/citylens-web) is the user-facing
Next.js app for CityLens. It pairs with:

- [`citylens-engine`](https://github.com/joshvern/citylens-engine) — FastAPI
  on Cloud Run plus the worker job; owns auth, quotas, and run artifact
  storage.
- [`citylens-core`](https://github.com/joshvern/citylens-core) — reusable
  Python pipeline library (segmentation, change detection, mesh).

## Product surface

- **Public, no sign-in**: featured demo runs (real precomputed CityLens
  output), the run-options API, the docs page, and the `/parcel-intel`
  citywide map preview (NYC redevelopment-candidate rankings).
- **Account-backed**: creating new runs, viewing your run history, the
  monthly-quota dashboard, and the complete `/parcel-intel` explorer with
  parcel overview, underwriting, workflow, and model-attribution panels. Free
  plan includes 5 runs per month.
- **Auth**: email + password via Neon Auth. The browser obtains a
  short-lived JWT and includes it as `Authorization: Bearer <token>` on
  authenticated API calls. Normal users do not configure API keys.

## Architecture (this repo)

```
app/
  page.tsx                    # async Server Component — SSRs featured demos
  runs/                       # signed-in run history + run detail
  sign-in/, sign-up/, sign-out/, verify-email/, forgot-password/, reset-password/
  api/auth/[...path]/route.ts # Neon Auth handler proxy
  docs/                       # user-facing API docs page
components/
  RunForm.tsx                 # accepts SSR-prefetched featured demos
  FeaturedDemoCards.tsx       # visual demo grid (server-renderable)
  PlanQuotaBadge.tsx          # /v1/me usage display
  AuthHeaderControls.tsx      # sign-in / signed-in pill
lib/
  api.ts                      # browser API client (Bearer + parsing helpers)
  api.server.ts               # Server-side fetcher for SSR demo data
  auth/                       # AuthProvider abstraction (mock + neon adapters)
  validation.ts               # Zod schema for the public run payload
```

## Backend contract

This frontend aligns to the CityLens API contract served by `citylens-engine`:

- `GET  /v1/health` — public
- `GET  /v1/run-options` — public
- `GET  /v1/demo/featured`, `GET /v1/demo/runs/{run_id}` — public demo endpoints
- `POST /v1/runs` — Bearer auth required (the engine narrowly validates the public
  request shape; sam2/aoi defaults are server-injected)
- `GET  /v1/runs`, `GET /v1/runs/{run_id}` — Bearer auth required
- `GET  /v1/me` — Bearer auth required; returns user + monthly quota state

Standard artifact filenames the UI renders:
- `preview.png` (inline image)
- `change.geojson` (Leaflet map with added / demolished / modified legend)
- `mesh.ply` (react-three-fiber 3D viewer + download)
- `run_summary.json` (QA + performance panel)

## Environment variables

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_CITYLENS_API_BASE` | Base URL for the API (e.g. `https://api.citylens.dev`). Required in prod. |
| `NEXT_PUBLIC_AUTH_PROVIDER` | `neon` in prod, `mock` in dev/CI (default). |
| `NEON_AUTH_BASE_URL` | Neon Auth managed URL (provisioned by the Vercel ↔ Neon integration). |
| `NEON_AUTH_COOKIE_SECRET` | ≥32 chars; signs Neon Auth session cookies. |
| `CITYLENS_API_INTERNAL_URL` | Optional override for the SSR-side API URL (e.g. private VPC). |
| `NEXT_PUBLIC_ERROR_REPORTING_DSN` | Optional browser-safe error ingestion endpoint; reporting is disabled when unset. |
| `NEXT_PUBLIC_SITE_BASE_PATH` | Optional path prefix when hosted under a subpath. |

## Local development

```bash
npm install
npm run dev
```

Local dev defaults to the `mock` auth provider so the build runs with no real
Neon Auth keys. Set `NEXT_PUBLIC_AUTH_PROVIDER=neon` (and the `NEON_AUTH_*`
env vars) to exercise the production auth flow against your Neon project.

## Tests

```bash
npm run lint     # ESLint flat config (eslint-config-next 16)
npm test         # vitest
npm run test:e2e # Playwright (requires host browser libs)
npm run build    # Next.js production build (Turbopack)
```

CI runs lint + build + vitest + Playwright on every PR. See
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deployment (Vercel)

`vercel link` against the existing project, then push to `main`. Vercel
auto-deploys to https://www.citylens.dev. Required env vars
(Production / Preview / Development) are listed above. The Neon Auth
integration provisions `NEON_AUTH_BASE_URL` and `NEXT_PUBLIC_STACK_*` automatically
on linking; `NEON_AUTH_COOKIE_SECRET` and `NEXT_PUBLIC_AUTH_PROVIDER=neon`
must be added manually.

## Icons

`public/icon.png` is the source-of-truth. Regenerate derived icons whenever
it changes:

```bash
npm run generate:icons
```

## Reference / parity test address

`100 E 21st St Brooklyn, NY 11226` — known-good NYS LiDAR-covered address;
useful for smoke-testing the worker pipeline.
