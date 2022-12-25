# citylens-web

CityLens product frontend. Next.js 16 (App Router) on Vercel; React 19. Live at https://www.citylens.dev. Talks to the engine API at `NEXT_PUBLIC_CITYLENS_API_BASE` (https://api.citylens.dev in prod).

## Quick commands

```bash
npm install
npm run dev               # next dev on :3000 (mock auth by default)
npm run build             # next build (Turbopack)
npm run lint              # eslint flat config (eslint-config-next 16)
npm test                  # vitest run
npm run test:watch        # vitest
npm run test:e2e          # playwright (auto-starts the dev/start server)
npm run generate:icons    # rebuild derived icons from public/icon.png
```

Node 20.11.1 pinned via `engines` + Volta. Production deploy is `git push` to `main` — Vercel auto-deploys.

## Layout

- [app/](app/) — App Router routes
  - [app/page.tsx](app/page.tsx) — homepage; async Server Component, SSRs `/v1/demo/featured` via [lib/api.server.ts](lib/api.server.ts)
  - [app/runs/](app/runs/) — signed-in run history + run detail
  - [app/parcel-intel/](app/parcel-intel/) — borough picker (public, statically prerendered + 5-min ISR) and `/parcel-intel/[borough]` workspace (auth-gated; map+list+detail; SSR'd initial data → client component for sort/filter/SHAP UI). Borough cards prefetch the leaflet chunk on hover via `BoroughCardPrefetch`.
  - [app/api/auth/[...path]/route.ts](app/api/auth/) — Neon Auth handler proxy
  - [app/sign-in/](app/sign-in/), `sign-up`, `sign-out`, `verify-email`, `forgot-password`, `reset-password`, `account`, `docs`
- [components/](components/) — `RunForm`, `FeaturedDemoCards`, `GeojsonMap`, `MeshViewer`, `ArtifactsPanel`, `RunSummaryPanel`, `PlanQuotaBadge`, `AuthHeaderControls`
- [lib/](lib/)
  - [api.ts](lib/api.ts) — browser API client (Bearer + parsing helpers)
  - [api.server.ts](lib/api.server.ts) — server-side fetcher used by SSR
  - [auth/](lib/auth/) — `AuthProvider` abstraction; `mockAuth` (dev/CI) and `neonAuth` (prod) adapters
  - [validation.ts](lib/validation.ts) — Zod schema for the public run payload
- [tests/e2e/](tests/e2e/) — Playwright specs
- Co-located `*.test.ts(x)` next to the unit under test (vitest + jsdom)
- [playwright.config.ts](playwright.config.ts), [vitest.config.ts](vitest.config.ts), [vitest.setup.tsx](vitest.setup.tsx)

## Conventions

- Auth: pluggable. `NEXT_PUBLIC_AUTH_PROVIDER=mock` (default in dev/CI) or `neon` (prod). The browser obtains a short-lived JWT and sends `Authorization: Bearer <token>` on authenticated calls. User API keys (`clk_live_…`) are an engine feature, not configured here.
- API contract is owned by `citylens-engine`. This repo only validates the public run payload via [lib/validation.ts](lib/validation.ts) — server still injects sam2/aoi/year defaults.
- `CITYLENS_DISABLE_SSR_DEMOS=1` short-circuits the homepage SSR fetch to `[]`. Required in CI and Playwright (set in [.github/workflows/ci.yml](.github/workflows/ci.yml) and [playwright.config.ts](playwright.config.ts)) so `page.route` mocks intercept the client-side fetch instead of the server bake.
- E2E tests use `page.route` to mock `/v1/*`. Server-side fetches bypass that — keep new demo data behind the client-side path or it'll bake stale data into the prerender.
- Vercel envs: `NEXT_PUBLIC_CITYLENS_API_BASE`, `NEXT_PUBLIC_AUTH_PROVIDER`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥32 chars). Neon Auth integration auto-provisions `NEON_AUTH_BASE_URL` and `NEXT_PUBLIC_STACK_*` on `vercel link`; the cookie secret + provider switch must be set manually.
- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)): `npm ci` → `playwright install --with-deps chromium` → lint → build → vitest → playwright on every PR.
- 3D viewer uses `@react-three/fiber` + `three`; map is `react-leaflet`. Both are client-only — wrap in `dynamic(..., { ssr: false })` if rendered above the fold.
- **Parcel-intel pages**: `/parcel-intel` is public + statically prerendered + ISR(300). `/parcel-intel/[borough]` is server-rendered on demand and renders a sign-in gate when `auth.status !== 'authenticated'` (covers the `loading` state too — don't briefly leak data during auth resolution). The map is `next/dynamic({ ssr: false })` with a static SVG placeholder skeleton so first paint feels instant. SHAP `top_features` for each parcel are passthrough data from the engine and render in a collapsible "Model attribution" section below the rule-based "Why we rank it" reasons in `parcel-intel-explain.ts`.
- `CITYLENS_DISABLE_SSR_PARCEL_INTEL=1` short-circuits parcel-intel SSR fetches to empty/null fallbacks for Playwright e2e (mirrors the `CITYLENS_DISABLE_SSR_DEMOS=1` pattern).
- The parcel-intel SSR fetch timeouts are 6s (index) / 8s (sweep) — generous enough to survive a Cloud Run cold start. Tighter timeouts caused empty pages to be baked into ISR after a deploy.
