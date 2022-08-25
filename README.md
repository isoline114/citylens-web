# Citylens Web

Frontend for Citylens. This app lets you submit a Citylens run and view its status + standard artifacts.

## Backend contract

This frontend aligns to the Citylens API contract:

- `GET  /v1/health`
- `POST /v1/runs` (request body matches the API schema; the UI injects required defaults)
- `GET  /v1/runs/{run_id}`

Demo mode (precomputed):

- Requires citylens-api v0.2.0+ (demo endpoints).
- If no API key exists in localStorage, the UI enters Demo Mode.
- Demo Mode loads featured demo runs from `GET /v1/demo/featured`.
- Selecting a demo run loads run details from `GET /v1/demo/runs/{run_id}` and renders artifacts like normal.

Artifacts expected (standard filenames):

- `preview.png`
- `change.geojson`
- `mesh.ply`
- `run_summary.json`

Auth:

- Sends `X-API-Key` on requests when set by the user.

## Environment variables

- `NEXT_PUBLIC_CITYLENS_API_BASE`
  - Base URL for the API
  - Default: `http://localhost:8000`

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

## How to use

1) Set API key
- Click **API key** in the header, paste your key, and click **Save**
- It is stored in localStorage as `citylens_api_key`

2) Create a run
- Fill in the form on Home
- Submit to create a run and navigate to the run detail page

3) View artifacts
- The run detail page polls while `status` is `queued` or `running`
- When the API provides `signed_url` for artifacts, the UI shows downloads and renders:
  - `preview.png` inline
  - `change.geojson` on a Leaflet map (OpenStreetMap tiles)
  - `mesh.ply` download link
  - `run_summary.json` as formatted JSON

## Deploy to Vercel

1) Push this folder as its own repo, or deploy the subfolder.
2) In Vercel project settings, set:
- `NEXT_PUBLIC_CITYLENS_API_BASE` = `https://<YOUR_API_BASE>`
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

4) Deploy
- Trigger a deploy and open the Vercel URL

5) Verify end-to-end
- Set API key in the banner
- Create run → watch polling → confirm artifact links render/download
