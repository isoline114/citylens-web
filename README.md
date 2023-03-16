# citylens-web

The public homepage is acquisition-first: it presents CityLens as one
five-borough decision flow from market scan to parcel evidence, shortlist
comparison, and private workflow. The historical ranking, current eligibility
gate, diligence overlays, and team decision remain separate in both copy and
interface. Aerial change detection and LiDAR reconstruction are positioned as
deeper site evidence after a parcel warrants investigation, not as a competing
homepage product. The primary explorer CTA and illustrative decision workspace
remain useful when featured aerial demos are unavailable.

The Parcel Intelligence surface at `/parcel-intel` is one citywide explorer,
not five separate borough workspaces. Borough and eligibility filters update the
same map/list, and selecting a lot opens its overview, underwriting, workflow,
official-source links, provenance, and model explanation in an in-place parcel
panel. Legacy `/parcel-intel/<borough>` links redirect into the citywide route.
The selected-parcel header exposes address identity honestly: numbered NYC PAD
addresses are labeled as BBL-matched enrichment, while street-only records are
marked as unnumbered tax lots. Address provenance never implies a rank or
eligibility change.
The explorer header also publishes a compact qualification receipt from the
active feed manifest. It reports the evaluated, screened-out, below-cutoff,
and surfaced candidate counts; current private ZAP project-to-BBL coverage;
published project leakage; source freshness; and PAD/PLUTO address provenance.
The receipt fails conservative when those release checks are absent or failed.
It is an auditable feed-eligibility statement—not model accuracy, seller
intent, transaction probability, or completed parcel diligence.
The selected overview also offers up to three deterministic **decision peers**
from the currently loaded governed inventory. Peers must already pass the
acquisition screen and are ordered from displayed zoning, opportunity,
borough, lot-area, built-utilization, and unused-FAR-proxy facts. The UI shows
the concrete match reasons, never exposes an invented similarity/confidence
score, and labels the set as screening peers rather than valuation or sale
comps. Users can open a peer in place or launch a focused 1:1 evidence
comparison; public users match only within the 125-row preview, while a
verified authenticated workspace matches across all 5,000 published leads.
Users can place up to three fully loaded parcels into an evidence comparison
desk without leaving the explorer. The desk keeps current acquisition posture,
capacity, ownership/sale context, official project activity, surfaced diligence
flags, and source-specific dates side by side. It does not collapse those
different evidence layers into a new score or claim to be an appraisal, site
plan, zoning opinion, or buy/pass recommendation. Authenticated comparison
opens are measured only as a coarse event without parcel IDs or compared
values. Users can explicitly export the compared rows through the existing
whitelisted CSV contract or copy a Markdown evidence brief for team review.
Both exports include current official-project links, server-owned decision
posture, recommended diligence, and source dates; neither includes workflow
notes, assignees, contacts, or hidden API fields. A signed-in user can
deliberately select one compared parcel, confirm a concrete next diligence
action and optional due date, and advance it directly into the private
pipeline. The API creates or restores the canonical save-time snapshot but
returns an existing active workflow unchanged. CityLens never chooses the
winner, silently saves the shortlist, or overwrites an existing stage, action,
assignee, or note. The aggregate adoption ledger can count only that a
canonical workflow originated from comparison; it receives no parcel
identifier, action, due date, or compared value.
Signed-in users can save and restore private explorer views containing the
borough scope, query, priority, site type, multiple required evidence signals,
owner-portfolio focus, and map overlay. Site type and evidence are independent:
users can, for example, require an uncommitted site that is both long-held and
within 800 meters of current MTA service. Multiple signals use transparent AND
semantics and never alter model score or rank or imply seller intent. Legacy
single-opportunity saved views migrate when restored. Private signal state and
owner focus are removed immediately when a session ends. Saved views
intentionally do not expose alert-frequency controls because scheduled
saved-search delivery is not yet available. After the complete inventory is
verified, a new or refreshed view stores only its exact sorted BBL membership
with the immutable feed generation. On a later feed, the private
acquisition-thesis monitor shows which ranked leads entered or left those same
visible conditions, lets the user inspect each change, and advances the
baseline only when the user marks the current set reviewed. It fails
conservative if membership disagrees within one generation and never labels
membership change as seller intent, a new model prediction, feasibility, or
transaction evidence. The API refuses a stale browser that tries to move a
baseline backward, while the client reloads the newer canonical baseline.
Once the complete authenticated inventory is loaded, any saved view can be
compared with the current working screen against that same inventory. The
comparison reports shared, current-only, and saved-only membership, the shared
share of the union, PLUTO field coverage, and bounded descriptive medians.
Saved views store conditions rather than frozen counts, so both sides refresh
with the current feed. This is screen sensitivity—not ranking accuracy,
relative lead quality, feasibility, seller intent, or transaction evidence.
The Signals workspace also includes bounded evidence recipes for assemblage,
long-held transit proximity, concentrated exact-name ownership, and recent
aerial change. Recipes are ordinary visible filters—not generated conclusions
or a separate model—and show their live count before application. An applied
screen gets a compact aggregate summary with match share, median unused-FAR
proxy, and geographic concentration. Those aggregates describe the currently
loaded inventory and never claim feasibility, owner response, or transaction
probability.
The adjacent Site criteria workspace adds reusable minimum PLUTO lot-area and
unused-FAR-proxy thresholds. It uses production-informed square-foot presets,
excludes missing values from a minimum screen, persists the thresholds in
private saved views, and labels both measures as preliminary PLUTO screens—not
surveyed area, zoning capacity, or feasible development yield.
Authenticated users can also open the constrained acquisition-thesis composer.
It deterministically translates plain language into only those same visible
borough, priority, site-type, positive-evidence, minimum-lot-area, and
minimum-unused-FAR controls. The thesis text stays in browser memory and is
never submitted or saved. Before application, a review receipt shows every
recognized filter, any disclosed safe default, every unsupported concept, any
conflict, and the exact match count against the verified full inventory.
Conflicts and empty interpretations fail closed. Unsupported financial,
program, zoning, contact, seller-intent, range, and negative-exclusion wording
is never converted into invented data or hidden criteria.
Every active screen also exposes a collapsible audit. It removes one condition
at a time while holding the others fixed, reports the marginal result lift,
shows scoped PLUTO coverage for numeric fields, and lets the user relax that
condition directly. The audit is a sensitivity explanation, not a causal
attribution, feasibility opinion, or replacement score.
For signed-in sessions, CityLens records only whether the audit was opened or
a condition was relaxed. It never records the criterion, threshold, query,
parcel, owner, result count, or relaxed value.

Signed-in users also have a private Evidence change center. It compares the
baseline captured when a parcel entered the acquisition workflow with the
current atomic feed and compares exact source-bound review markers with the
current decision-audit citations. Multiple stale markers are grouped into one
parcel card with reviewed/current status, source, date, review time, and
specific change reasons. The center includes active reviewed workflows even
when ordinary watch alerts are off. It surfaces owner, sale-year, zoning,
priority, opportunity, lien, violation, flood, imagery, portfolio-size,
environmental-designation, MIH mapped-area, meaningful transit-complex or
access-tier, and feed-removal changes. For current-generation feeds, it
distinguishes source-backed project/constraint/data exclusions from leads that
remain eligible below the published cutoff. It shows human-readable reason
codes, source dates, exact official-record links, and a conservative next
action. An absent ledger record remains explicitly unresolved; the client
never invents a disposition, seller-intent claim, or completed-diligence
state. Distance-only centroid noise does not create a transit alert.
The same center keeps private correction and suppression-review requests
visible while they await CityLens governance review. A request is attached to
one exact status/source/source-date/feed citation and never implies that the
underlying official value was edited or hidden.
The explorer resolves the browser session before selecting an inventory tier.
Signed-out users receive one public 125-row request; authenticated users receive
one compact 5,000-row citywide request without first racing the public preview.
It fetches polygon, explanation, provenance, and underwriting detail only when
a parcel is opened.
The upgrade is fail-closed: authenticated map reads bypass the public HTTP
cache and must carry an internally consistent full-inventory receipt from the
API. Until that receipt is verified, the interface labels the loaded count as
incomplete, keeps full-inventory saved-view actions disabled, and offers an
authenticated retry or account reconnection instead of presenting the 125-row
preview as the complete workspace. A visible browser session alone is not
treated as data authorization: the production receipt separately proves that
the session minted a JWT and that the API returned the complete 5,000-row
inventory. A bounded recovery loop retries a transient session/JWT race and
rechecks when the browser returns online or regains focus, so one early public
response cannot strand a valid signed-in user at 125 rows.
For a canonical 10-digit BBL that is absent after that full inventory receipt
is verified, the signed-in explorer offers an explicit screening lookup
instead of silently returning zero results. The resulting private receipt
distinguishes a published lead, an eligible parcel below the 5,000 cutoff, a
source-backed exclusion, and a parcel outside the evaluated ledger. It
translates governed reason codes, links official project records, and shows
source dates without revealing the private bulk ledger, owner identity, score,
or model rank. Public preview users see a sign-in boundary rather than a
partial-data conclusion.
For a non-BBL address that is absent from that same complete 5,000-row
inventory, the explorer offers a deliberate official tax-lot lookup. The
address is sent only in an authenticated POST body; it is never placed in the
URL or browser analytics. The engine returns exact PAD/PLUTO BBL candidates
from a private resolver that is independent of lead membership. One exact lot
can proceed to the existing screening receipt, while multiple lots require an
explicit user choice and no match remains an honest no-match. The UI never
fuzzy-matches an address or silently guesses a tax lot.
After an authenticated BBL or exact address match is selected, the explorer
loads a separate official parcel dossier for that tax lot—even when it is not
one of the 5,000 ranked leads. The dossier shows source-dated PLUTO physical,
mapped-zoning, assessment, flood, and environmental facts beside
source-specific ACRIS deed/recorded-owner facts and official NYC links.
PLUTO/ACRIS owner disagreement remains visible. The panel explicitly says it
is not a lead score, title report, appraisal, zoning calculation, feasibility
study, beneficial-owner determination, or seller-intent signal. The existing
screening receipt follows it and separately explains whether the parcel was
published, below cutoff, excluded, or not evaluated.
The dossier also includes a non-scoring evidence-readiness layer. Six source
groups—tax-lot identity, recorded ownership, latest deed, physical record,
zoning references, and mapped constraints—are labeled `available`, `partial`,
`review`, or `missing`. Contradictory evidence is not conflated with
single-source coverage. The panel gives a bounded official-record verification
sequence and explicitly says that coverage is not correctness, predictive
confidence, investment suitability, or completed diligence.
The browser mints the API Bearer JWT through the same-origin
`/api/auth/token` route using the authoritative HttpOnly Neon session cookie.
The Neon client helper remains only a fallback: a cached visual session is not
accepted as proof of data access.
The selected-parcel panel also has a Decision Audit tab. It separates the
historical next-year DOB filing signal from current acquisition gates,
post-score diligence overlays, source dates, and user-entered workflow
evidence. Historical top-100/top-1,000 precision is shown as cohort-level
forward-test performance, never as seller intent or a parcel transaction
probability. A source-bound benchmark receipt now shows the exact historical
hits (`34/100` and `104/1,000`), eligible cohort/base-rate denominator,
observed 95% Wilson ranges, and development-exposed status. Its copy states
that the ranges omit model-selection uncertainty, spatial dependence, dataset
shift, and current acquisition outcomes; they are not parcel confidence. The
audit also renders the API-owned decision-readiness state:
current blockers, items requiring review, checks that passed the current
screening gates, and one conservative next diligence action. Signed-in users
can carry that action into the private workflow as an editable draft; it is
never saved automatically and does not alter model rank.
The Overview tab synthesizes that same immutable audit contract into a compact
acquisition decision brief: why the parcel surfaced, why it survived current
gates, what evidence remains unresolved, and the next decision. Each lane
retains its source and date, and the interface deliberately refuses to collapse
them into a confidence score, buy/pass recommendation, or parcel-level
probability. Missing or older atomic audit evidence fails conservative instead
of being presented as a cleared gate.
Once a parcel is saved, its Workflow tab also exposes a source-bound evidence
review ledger for the current acquisition gate, project clearance, PLUTO
facts, ownership provenance, diligence overlays, and transit context. A user
may mark only the exact status/source/source-date/feed version returned by the
server. The UI shows current progress, automatically labels prior markers
stale when any part of that citation identity changes, and permits an explicit
undo. “Reviewed” means that cited version was considered; it never means risk
was resolved, a record was cleared, or legal, zoning, title, environmental,
engineering, financial, or seller-intent diligence was completed.
Each evidence row also supports an inline, bounded “Report issue” flow for
signed-in users. Users choose correction or suppression review, provide a
structured reason and a 20–1,000 character note, then see pending and resolved
status in the same ledger. Open requests may be withdrawn but cannot be
overwritten; the UI continues to show the cited official fact until the engine
publishes a governed source update.
The Underwrite tab replaces a single-point residual with an editable
downside/base/upside development sensitivity. Every case exposes value, hard
cost, efficiency, soft-cost, and target-margin assumptions; outputs include
total residual land basis plus per-lot-SF and per-gross-SF comparisons. The
range is explicitly illustrative, stays in the browser session, preserves the
current parcel capacity input across cases, floors negative residuals at zero,
and lists financing, tax, carrying, affordable-housing, demolition, tenancy,
environmental, assemblage, and entitlement omissions. It is a screening
comparison, not an appraisal or valuation.
After a signed-in user changes an assumption, the parcel panel offers a
deliberate handoff into the canonical diligence workflow. That handoff stores
the parcel snapshot and a conservative validation action, while all values,
costs, efficiencies, margins, and calculated residuals remain session-only.
An existing workflow is opened unchanged rather than duplicated or silently
overwritten.
The methodology disclosure separately renders the exact live production
cohort's awaiting, collecting, or mature state from the public-safe engine
contract. Pre-observation nulls are described as unavailable—not `0%`;
in-progress hit rates are labeled lower bounds; final precision and confidence
intervals appear only after the complete 365-day horizon. If the engine cannot
match the status to the active feed generation, the UI shows an explicit
unavailable warning rather than falling back to historical metrics.
Full borough payloads are deferred until the user requests a CSV. The explorer
separates acquisition site type from combinable evidence screens, including
multi-lot assemblage candidates, a signed-in filter for official
NYC DOF final tax-lien sale history, a filter for parcels with current Class 1
ECB or Class C HPD immediately hazardous records, a signed-in 1% annual-chance
floodplain screen, a signed-in exact-name current-PLUTO legal-owner portfolio
filter, a signed-in PLUTO E-designation/restrictive-declaration screen, a
signed-in current NYC Planning MIH mapped-area screen, an official MTA
subway/SIR proximity screen, recent aerial change, held-ten-years-or-more
tenure, and the accepted model's clearly labeled forward-test hit rate. Every
selected evidence screen must match; none changes the accepted ranking.
Environmental instruments are
presented only as current air/noise/hazardous-materials diligence requirements;
none is described as proof of contamination or as an automatic prohibition.
The MIH card and underwriting warning explicitly treat an overlap as a dated
spatial reference—not a legal applicability determination or affordability
pro forma—and link the official map, current Appendix F, and HPD guidance.
The MTA card reports the nearest station complex, straight-line meters,
daytime routes, ADA status, and 400/800 m complex counts. It explicitly does
not claim an entrance-level walking route, travel time, service frequency, or
zoning effect, and it links the dated official MTA source. A user
can open a parcel and focus the citywide map on other current candidates with
the same exact normalized legal name. Signed-in users can open Outcome Insights
to see fixed-horizon 30-day contact, 90-day qualification, 180-day offer,
270-day contract, and 365-day close rates. A lead enters a denominator only
when the full observation window has elapsed; late-recorded milestones do not
inflate on-time rates, archived leads remain included, and small cohorts stay
labeled “Collecting.” Each parcel workflow also exposes its value-minimized
decision history. Those user-entered, selected-lead outcomes are kept separate
from historical model accuracy. Outcome Insights also provides a private,
one-click evidence export. The versioned JSON contains
immutable saved-rank context, maturity-safe fixed-horizon labels, and an
integrity digest while excluding notes, tags, assignees, contacts, addresses,
owner names, reminders, and custom free text. Pending or legacy
uninstrumented observations stay null and cannot become training negatives.
Workflow creates, updates, restores, and archives are measured by the engine
inside the canonical workflow transaction rather than through a second browser
telemetry request. The web reports only value-minimized parcel-open events, so
a successfully saved lead cannot disappear from activation reporting merely
because a best-effort analytics request was dropped.
The same citywide explorer includes a private Action Queue that prioritizes
overdue and near-term follow-ups, exposes open
leads without a complete action/date plan, identifies missing assignees, and
asks for outcome updates after 30 days. The explorer button shows the private
server-derived attention count before the queue opens. The queue reports plan,
assignee, and outcome-review coverage and lets a user snooze the current
commitment for one or seven days. Snoozes are bound by the API to the current
action identity, so editing the action, date, assignee, stage, or outcome
resurfaces it instead of hiding changed work. Each parcel workflow owns its
concrete next action and due date; terminal records leave the queue
automatically. These are in-product reminders, not email or webhook delivery.
The
portfolio card explicitly does not
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
  parcel overview, decision audit, underwriting, workflow, and
  model-attribution panels. Free plan includes 5 runs per month.
- **Auth**: email + password via Neon Auth. The browser obtains a
  short-lived JWT and includes it as `Authorization: Bearer <token>` on
  authenticated API calls. Normal users do not configure API keys.
- **Pilot intake**: `/contact` submits a bounded, retry-safe request to the
  engine rather than relying on a mail client. The browser sends no IP,
  referrer, page URL, campaign identifier, or user-agent field. A durable
  receipt is shown after acceptance, validation/rate-limit failures preserve
  the entered form, and `hello@citylens.dev` remains the manual fallback.

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
- `GET  /v1/parcel-intel/index` — public citywide metadata plus a
  generation-bound, parcel-free prospective validation status and
  API-derived weekly-monitor freshness state. The UI withholds stale live
  metrics behind an overdue warning instead of presenting them as current
  accuracy.
- `POST /v1/parcel-intel/resolve-address` — Bearer-authenticated,
  rate-limited exact official-address-to-BBL resolution; private/no-store and
  never returns the submitted address
- `GET  /v1/parcel-intel/official-parcel/{bbl}` — Bearer-authenticated,
  rate-limited, source-dated official dossier for one current NYC PLUTO tax
  lot; private/no-store and independent of lead membership
- `GET  /v1/demo/featured`, `GET /v1/demo/runs/{run_id}` — public demo endpoints
- `POST /v1/runs` — Bearer auth required (the engine narrowly validates the public
  request shape; sam2/aoi defaults are server-injected)
- `GET  /v1/runs`, `GET /v1/runs/{run_id}` — Bearer auth required
- `GET  /v1/me` — Bearer auth required; returns user + monthly quota state
- `PUT|DELETE /v1/parcel-intel/workflow/{bbl}/evidence-reviews/{check_key}` —
  Bearer auth required; writes or removes a source-bound review marker on an
  active workflow record using optimistic citation-version checks
- `POST|DELETE /v1/parcel-intel/workflow/{bbl}/evidence-issues/{check_key}` —
  Bearer auth required; submits or withdraws a private source-bound correction
  or suppression-review request without editing the cited parcel fact
- `POST /v1/pilot-requests` — public, rate-limited design-partner intake with
  an opaque `Idempotency-Key`; returns a durable receipt and is never cached

Standard artifact filenames the UI renders:
- `preview.png` (inline image)
- `change.geojson` (Leaflet map with added / demolished / modified legend)
- `mesh.ply` (react-three-fiber 3D viewer + download)
- `run_summary.json` (QA + performance panel)

## Privacy-preserving adoption measurement

Authenticated Parcel Intelligence interactions send only the strict
`citylens/parcel-product-event@v1` event/source pair to the engine. The client
never includes a BBL, address, owner, URL, notes, tags, assignee, contact,
underwriting value, cost, margin, efficiency, or free text. Parcel opens,
official-dossier opens, comparison-desk opens, decision-audit opens,
Underwrite-tab opens, first assumption adjustments, and saved-view applies are
coarse directional events. Official-dossier opens contain no BBL, address,
owner, source fact, readiness state, lead membership, or result.
Comparison-desk, decision-peer entry, and saved-screen-comparison events contain no parcel
identifiers, saved-view identity, filters, criteria, thresholds, search text,
result counts, overlap/union measures, or compared values.
Opening a saved-thesis change set records only the fixed event/source pair,
once per view per browser session; it contains no view ID, BBL, generation,
filters, membership, entered/exited counts, address, owner, value, or note.
Applying a reviewed constrained thesis records only the fixed
`thesis_composer_applied:thesis_composer` pair. It contains no thesis text,
recognized or unsupported criterion, safe default, threshold, geography,
match count, parcel, address, owner, value, or source fact.
Decision-audit opens identify only whether the posture card or Audit tab was
used; underwriting events identify only whether the Underwrite tab opened or
any base assumption was changed. The event does not include which parcel or
view was used or what assumption changed.
Delivery is best-effort and cannot block parcel diligence, scenario editing,
saved-view restoration, or workflow saves. Canonical saved-view
create/update/delete and thesis-baseline create/advance counts are recorded
transactionally by the engine rather than inferred from browser telemetry.

Vercel pageview analytics use `SafeAnalytics` to strip query parameters and
fragments before collection, so parcel-selection state such as `?bbl=...` is
not included in pageview URLs. Vercel custom events are not the canonical
adoption source because they are plan-dependent; the engine's bounded,
90-day aggregate counters are.

## Environment variables

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_CITYLENS_API_BASE` | Base URL for the API (e.g. `https://api.citylens.dev`). Required in prod. |
| `NEXT_PUBLIC_AUTH_PROVIDER` | Set explicitly to `neon` for production or any local web session targeting a deployed API. Use `mock` only with the local API; when omitted, deployed API origins and production builds default safely to `neon`. |
| `NEON_AUTH_BASE_URL` | Neon Auth managed URL (provisioned by the Vercel ↔ Neon integration). |
| `NEON_AUTH_COOKIE_SECRET` | ≥32 chars; signs Neon Auth session cookies. |
| `CITYLENS_API_INTERNAL_URL` | Optional override for the SSR-side API URL (e.g. private VPC). |
| `NEXT_PUBLIC_ERROR_REPORTING_DSN` | Optional browser-safe error ingestion endpoint; reporting is disabled when unset. |
| `NEXT_PUBLIC_SITE_BASE_PATH` | Optional path prefix when hosted under a subpath. |

## Local development

Use Node `20.19.0` and npm `10.8.2`; both are pinned through Volta in
`package.json`.

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
npm audit --audit-level=high
```

Playwright builds and owns an isolated production server (port `3100` by
default) and never reuses an unknown development server. Override with
`PLAYWRIGHT_PORT=<port> npm run test:e2e` when needed. CI uses its own
production server on port `3000`.

CI fails on high/critical npm advisories, then runs lint + build + vitest +
Playwright on every PR. See
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).
The separate
[`production-auth-smoke.yml`](.github/workflows/production-auth-smoke.yml)
uses a dedicated least-privilege Neon smoke user every six hours. It signs in
through the production UI and fails unless the rendered explorer and observed
API receipt both reach exactly 5,000 authenticated, mappable parcels with no
browser errors. It then performs a full document reload and requires a second
complete 5,000-row receipt from the returning authenticated session. It
separately records successful API-credential minting, so a stale session
cannot pass by rendering the 125-row public preview. It also
verifies the auditable historical benchmark receipt and its limitations, the
live Ovington exact-BBL dossier, source-grounded evidence readiness,
official-address resolution, current screening receipt, and the governed
acquisition-thesis flow. The v6 receipt records the returning-session result
as a boolean without storing the credential or account identity. The thesis
check requires a reviewed, positive-match
receipt, the expected visible filters, and an accepted
`thesis_composer_applied:thesis_composer` API response whose JSON keys are
exactly `event`, `schema_version`, and `source`. Its v6 report stores only
booleans plus that response status/event/source/key receipt—never the thesis,
parsed criteria, thresholds, geography, match count, or parcel identity.
Its email and password live only in the
`CITYLENS_WEB_SMOKE_EMAIL` and `CITYLENS_WEB_SMOKE_PASSWORD` GitHub Actions
secrets; reports contain neither value, JWTs, parcel identifiers, nor owner
data.

`@neondatabase/auth` currently pins an older Better Auth line internally.
`package.json` intentionally overrides Better Auth and its passkey/core
packages to the reviewed patched `1.6.25` release. Do not remove those
overrides until the upstream Neon package carries a non-vulnerable line and
the complete auth route, unit, build, browser, and `npm audit` gates pass.
The development-tooling graph also overrides legacy `minimatch` and
`brace-expansion` copies to the audited `10.2.5` and `5.0.8` releases. This
closes the unbounded-expansion advisory without forcing ESLint 10 ahead of the
Next lint plugins' declared peer support. Keep this override only while a
clean `npm ci`, lint, build, Vitest, Playwright, and `npm audit` all pass;
remove it once the upstream ESLint plugin graph resolves the patched matcher
natively.

The production Next.js config disables `X-Powered-By` and applies the
clickjacking, MIME-sniffing, referrer, browser-capability, and narrow CSP
baseline to every route. The CSP deliberately restricts base/object/frame/form
behavior without constraining scripts, Firebase authentication, map tiles,
analytics, or API artifact resources. The engine's secret-free production
verifier checks these headers on `https://www.citylens.dev/parcel-intel`.

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
