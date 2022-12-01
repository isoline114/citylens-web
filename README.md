# Citylens Web

Frontend for Citylens. This repo is independently runnable under the shared
`/home/josh/citylens` root, with its own Node/npm toolchain and repo-local
TypeScript settings. It lets you submit a Citylens run and view its status +
standard artifacts.

## Backend contract

This frontend aligns to the Citylens API contract:

- `GET  /v1/health`
- `POST /v1/runs` (request body matches the API schema; the UI injects required defaults)
- `GET  /v1/runs`
- `GET  /v1/runs/{run_id}`

Demo mode (precomputed):

- Requires citylens-api v0.2.0+ (demo endpoints).
- If no API key exists in localStorage, the UI enters Demo Mode.
- Demo Mode loads featured demo runs from `GET /v1/demo/featured`.
- Selecting a demo run loads run details from `GET /v1/demo/runs/{run_id}` and renders artifacts like normal.
- Demo artifact URLs may be relative API proxy paths like `/v1/demo/artifacts/<run_id>/<artifact_name>`; the frontend resolves them against `NEXT_PUBLIC_CITYLENS_API_BASE`.

Artifacts expected (standard filenames):

- `preview.png`
- `change.geojson`
- `mesh.ply`
- `run_summary.json`

Auth:

- Sends `X-API-Key` on requests when set by the user.

This repo is part of the active modular product stack. `Urban3D-DeepRecon` remains a
reference-only repo for legacy Streamlit behavior and algorithm extraction.

## Workspace expectations

- Open `citylens-web` directly in VS Code when working only on the frontend.
- If you use a multi-root workspace at `/home/josh/citylens`, add `citylens-web`
  as its own root folder rather than relying on the parent folder alone.
- In VS Code, use the repo-local TypeScript version for this folder so editor
  diagnostics match the project dependencies.
- If `tsconfig.json` is highlighted in red, check the Problems panel first; the
  file itself is valid when `tsc` passes from the repo root.

The fixed parity/acceptance case for the modular stack is:

- `100 E 21st St Brooklyn, NY 11226`

## Environment variables

- `NEXT_PUBLIC_CITYLENS_API_BASE`
  - Base URL for the API
  - Local default: `http://localhost:8000`
  - Required in production builds
- `NEXT_PUBLIC_SITE_BASE_PATH`
  - Optional path prefix when the site is hosted under a subpath such as `/citylens-web`
  - Default: unset / root-mounted

## Volta (recommended)

This repo includes Volta pinning in `package.json` to keep Node/npm consistent.

Install Volta:

```bash
curl https://get.volta.sh | bash
```

Then install Node 20:

```bash
volta install node@20
```

## Local development

```bash
cd citylens-web
npm install
npm run dev
```

Open http://localhost:3000

If you are working in VS Code, keep the workspace pointed at this repo or use a
proper multi-root workspace that includes it explicitly. That avoids editor
confusion when other CityLens repos have their own toolchains.

## How to use

1) Set API key
- Click **API key** in the header, paste your key, and click **Save**
- It is stored in localStorage as `citylens_api_key`

2) Create a run
- Fill in the form on Home
- Submit to create a run and navigate to the run detail page

3) View artifacts
- The run detail page polls while `status` is `queued` or `running`
- When the API provides artifact URLs, the UI shows downloads and renders:
  - `preview.png` inline
  - `change.geojson` on a Leaflet map when coordinates are geospatial; pixel-space GeoJSON is shown with an explicit message instead of a misleading map
  - `mesh.ply` in a react-three-fiber 3D viewer plus download link
  - `change.geojson` with added/removed styling and a legend
  - `run_summary.json` with QA/performance panels plus formatted JSON

## Deploy to Vercel

1) Push this folder as its own repo, or deploy the subfolder.
2) In Vercel project settings, set:
- `NEXT_PUBLIC_CITYLENS_API_BASE` = `https://<YOUR_API_BASE>`
- `NEXT_PUBLIC_SITE_BASE_PATH` = `/your-subpath` only if the site is not hosted at `/`
3) Deploy.

## Icons

`public/icon.png` is the source-of-truth icon.

When `public/icon.png` changes, regenerate derived icons:

```bash
npm run generate:icons
```

## Runbook (local + Vercel)

### Local

1) Start the API (citylens-engine)
- Run your API on `http://localhost:8000`

2) Configure the web app
- Set `NEXT_PUBLIC_CITYLENS_API_BASE=http://localhost:8000`

3) Start the web app

```bash
cd citylens-web
npm install
npm run dev
```

4) Use the UI
- Open http://localhost:3000
- Click **API key** in the header to set your `X-API-Key`
- Create a run
- Open the run detail page and wait for artifacts

### Vercel

1) Deploy the API (citylens-engine)
- Deploy to your hosting (e.g. Cloud Run) and obtain the public API base URL

2) Create a Vercel project for `citylens-web`
- Import the repo (or deploy the subfolder if using a monorepo)

3) Set environment variables in Vercel
- `NEXT_PUBLIC_CITYLENS_API_BASE` = `https://<YOUR_API_BASE>`
- `NEXT_PUBLIC_SITE_BASE_PATH` = `/your-subpath` only if the Vercel app is mounted below `/`

4) Deploy
- Trigger a deploy and open the Vercel URL

5) Verify end-to-end
- Set API key in the banner
- Create run → watch polling → confirm artifact links render/download

### Browser smoke tests

Run the Playwright smoke suite against the local dev server:

```bash
npm run test:e2e
```

The smoke suite covers:

- Demo mode landing and demo run detail rendering
- Authenticated run detail rendering
- 3D mesh viewer, GeoJSON legend, and run summary QA panel presence

Note: local Playwright execution requires host browser libraries. In this container,
Chromium launch is blocked by missing native packages such as `libnspr4.so`.

## Editor notes

- Use the workspace TypeScript version, not a global installation.
- If VS Code does not show TypeScript commands, open a `.ts` or `.tsx` file in
  this repo first, then use the Command Palette.
- Opening `citylens-web` directly is the least ambiguous setup.
