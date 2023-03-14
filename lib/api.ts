import type { CitylensCreateRunPayload } from '@/lib/validation';
import type { CreateRunResponse, RunListItem, RunResponse, RunsListResponse } from '@/lib/types';

export type DemoFeaturedRun = {
  run_id?: string;
  id?: string;
  title?: string;
  label?: string;
  address?: string;
  imagery_year?: number;
  baseline_year?: number;
  segmentation_backend?: string;
  outputs?: string[];
  request?: Record<string, unknown>;
} & Record<string, unknown>;

export type RunsQuery = {
  limit?: number;
  cursor?: string | null;
};

export type RunsPage = {
  items: RunListItem[];
  nextCursor: string | null;
};

export type RunOptions = {
  imagery_years: number[];
  baseline_years: number[];
  segmentation_backends: string[];
  outputs: string[];
  defaults: {
    imagery_year: number;
    baseline_year: number;
    segmentation_backend: string;
    outputs: string[];
    aoi_radius_m: number;
  };
};

export type MeResponse = {
  user: {
    id: string;
    email: string | null;
    plan_type: string;
    is_admin: boolean;
  };
  quota: {
    month_key: string;
    monthly_run_limit: number | null;
    runs_used: number;
    runs_remaining: number | null;
    unlimited: boolean;
    max_concurrent_runs: number | null;
  };
};

export type PilotPlan = 'acquisitions' | 'concierge';
export type PilotBorough =
  | 'manhattan'
  | 'brooklyn'
  | 'queens'
  | 'bronx'
  | 'staten_island';

export type PilotRequestPayload = {
  schema_version: 'citylens/pilot-request@v1';
  plan: PilotPlan;
  name: string;
  work_email: string;
  company: string;
  role: string;
  team_size: '1' | '2-5' | '6-20' | '21+';
  target_boroughs: PilotBorough[];
  workflow_summary: string;
  consent: true;
  website: string;
};

export type PilotRequestReceipt = {
  schema_version: 'citylens/pilot-request-receipt@v1';
  request_id: string;
  status: 'received';
  created_at: string;
};

export type ParcelProductEventName =
  | 'parcel_opened'
  | 'official_dossier_opened'
  | 'screening_lookup_completed'
  | 'comparison_opened'
  | 'saved_view_applied'
  | 'decision_audit_opened'
  | 'underwriting_opened'
  | 'underwriting_assumptions_changed'
  | 'screen_audit_opened'
  | 'screen_criterion_relaxed'
  | 'saved_view_comparison_opened'
  | 'saved_thesis_changes_opened';

export type ParcelProductEventSource =
  | 'direct'
  | 'official_dossier'
  | 'screening_lookup'
  | 'map'
  | 'ranking'
  | 'action_queue'
  | 'watchlist'
  | 'comparison'
  | 'saved_views'
  | 'decision_posture'
  | 'audit_tab'
  | 'underwrite_tab'
  | 'base_assumptions'
  | 'screen_summary'
  | 'screen_audit'
  | 'decision_peers';

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

export class ApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.body = opts?.body;
  }
}

type TokenGetter = (options?: {
  forceRefresh?: boolean;
}) => Promise<string | null> | string | null;
let tokenGetter: TokenGetter | null = null;

export function setAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

async function resolveAuthToken(options?: {
  forceRefresh?: boolean;
}): Promise<string | null> {
  if (!tokenGetter) return null;
  const result = tokenGetter(options);
  return result instanceof Promise ? result : result;
}

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') return '';
  const v = process.env.NEXT_PUBLIC_CITYLENS_API_BASE;
  if (v && v.trim().length > 0) return v.replace(/\/+$/, '');
  return 'http://localhost:8000';
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

export function joinApiUrl(base: string, value: string): string {
  const raw = value.trim();
  if (!raw) return base || '/';
  if (isAbsoluteUrl(raw)) return raw;

  if (!base) {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  const target = new URL(base);
  const hashIndex = raw.indexOf('#');
  const hash = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const queryIndex = withoutHash.indexOf('?');
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  const basePath = target.pathname.replace(/\/+$/, '');
  const relativePath = pathname.trim();
  const joinedPath =
    relativePath.length === 0
      ? basePath || '/'
      : `${basePath}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`.replace(/\/{2,}/g, '/');

  target.pathname = joinedPath || '/';
  target.search = query ? `?${query}` : '';
  target.hash = hash ? `#${hash}` : '';
  return target.toString();
}

export function resolveApiUrl(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  const raw = value.trim();
  return isAbsoluteUrl(raw) ? raw : joinApiUrl(getBaseUrl(), raw);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  opts?: { includeAuth?: boolean },
): Promise<T> {
  const url = joinApiUrl(getBaseUrl(), path);
  const includeAuth = opts?.includeAuth ?? true;

  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');

  if (includeAuth) {
    const token = await resolveAuthToken();
    if (!token) {
      throw new ApiError('Sign in required', { status: 401 });
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const send = async (): Promise<Response> => {
    try {
      return await fetch(url, { ...init, headers });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ApiError(`Network error while calling ${path}: ${msg}`);
    }
  };

  let res = await send();
  if (includeAuth && res.status === 401) {
    // A JWT can be revoked or become invalid before its embedded expiry. Do
    // not let every Parcel Intelligence recovery attempt reuse that rejected
    // token and strand a visibly signed-in user on the 125-row public map.
    // Auth is rejected before route handlers run, so one credential-refresh
    // replay is safe for the JSON mutations supported by this client.
    const refreshedToken = await resolveAuthToken({ forceRefresh: true });
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      res = await send();
    }
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');

  if (!res.ok) {
    const base = `Request failed (${res.status}) ${path}`;
    const message =
      typeof body === 'string'
        ? `${base}: ${body || res.statusText}`
        : `${base}: ${res.statusText}`;
    throw new ApiError(message, { status: res.status, body });
  }

  return body as T;
}

function parseRunsResponse(raw: unknown): RunsPage {
  if (Array.isArray(raw)) {
    return { items: raw as RunListItem[], nextCursor: null };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as RunsListResponse & Record<string, unknown>;
    const items = obj.items ?? obj.runs;
    if (Array.isArray(items)) {
      return {
        items: items as RunListItem[],
        nextCursor:
          typeof obj.next_cursor === 'string'
            ? obj.next_cursor
            : typeof obj.nextCursor === 'string'
              ? obj.nextCursor
              : null,
      };
    }
  }

  return { items: [], nextCursor: null };
}

export async function health(): Promise<unknown> {
  return requestJson('/v1/health', undefined, { includeAuth: false });
}

export async function createRun(req: CitylensCreateRunPayload): Promise<{ runId: string; raw: CreateRunResponse | unknown }> {
  const raw = await requestJson<CreateRunResponse | string>('/v1/runs', {
    method: 'POST',
    body: JSON.stringify(req),
  });

  if (typeof raw === 'string') {
    const runId = raw.trim();
    if (!runId) throw new ApiError('Create run response was empty');
    return { runId, raw };
  }

  const runId = (raw?.run_id ?? raw?.runId ?? raw?.id) as string | undefined;
  if (!runId) {
    throw new ApiError('Create run response did not include a run id (expected run_id)');
  }
  return { runId, raw };
}

export async function getRun(runId: string): Promise<RunResponse> {
  return requestJson<RunResponse>(`/v1/runs/${encodeURIComponent(runId)}`);
}

export async function getRuns(query?: RunsQuery): Promise<RunsPage> {
  const params = new URLSearchParams();
  if (typeof query?.limit === 'number' && Number.isFinite(query.limit) && query.limit > 0) {
    params.set('limit', String(Math.floor(query.limit)));
  }
  if (typeof query?.cursor === 'string' && query.cursor.trim().length > 0) {
    params.set('cursor', query.cursor.trim());
  }

  const suffix = params.toString().length > 0 ? `?${params.toString()}` : '';
  const raw = await requestJson<unknown>(`/v1/runs${suffix}`);
  return parseRunsResponse(raw);
}

export async function getMe(): Promise<MeResponse> {
  return requestJson<MeResponse>('/v1/me');
}

export async function submitPilotRequest(
  payload: PilotRequestPayload,
  idempotencyKey: string,
): Promise<PilotRequestReceipt> {
  return requestJson<PilotRequestReceipt>(
    '/v1/pilot-requests',
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
    { includeAuth: false },
  );
}

export async function getRunOptions(): Promise<RunOptions> {
  return requestJson<RunOptions>('/v1/run-options', undefined, { includeAuth: false });
}

/**
 * Normalize the various shapes the /v1/demo/featured endpoint can return
 * (array, {featured: []}, {runs: []}, or category-keyed objects) into a
 * deduplicated DemoFeaturedRun[]. Exported for reuse by server-side
 * loaders that fetch the endpoint without going through requestJson.
 */
export function parseFeaturedDemosResponse(raw: unknown): DemoFeaturedRun[] {
  if (Array.isArray(raw)) return raw as DemoFeaturedRun[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const featured = obj['featured'];
    const runs = obj['runs'];
    if (Array.isArray(featured)) return featured as DemoFeaturedRun[];
    if (Array.isArray(runs)) return runs as DemoFeaturedRun[];

    // Flatten category-keyed objects like { "Featured": [...], "Change Detection": [...] }
    const flat: DemoFeaturedRun[] = [];
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object') flat.push(item as DemoFeaturedRun);
        }
      }
    }
    if (flat.length > 0) {
      // Deduplicate by run_id/id
      const seen = new Set<string>();
      const out: DemoFeaturedRun[] = [];
      for (const d of flat) {
        const id = (typeof d.run_id === 'string' && d.run_id) || (typeof d.id === 'string' ? d.id : undefined);
        const key = id ?? JSON.stringify(d);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(d);
      }
      return out;
    }
  }
  return [];
}

export async function getFeaturedDemos(): Promise<DemoFeaturedRun[]> {
  const raw = await requestJson<unknown>('/v1/demo/featured', undefined, { includeAuth: false });
  return parseFeaturedDemosResponse(raw);
}

export async function getDemoRun(runId: string): Promise<RunResponse> {
  return requestJson<RunResponse>(`/v1/demo/runs/${encodeURIComponent(runId)}`, undefined, { includeAuth: false });
}

// ---------- API keys ----------

export type ApiKeyRecord = {
  key_id: string;
  label: string;
  key_prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type CreatedApiKeyRecord = ApiKeyRecord & {
  /** Plaintext key — shown once on create, never again. */
  plaintext_key: string;
};

export async function createApiKey(label: string): Promise<CreatedApiKeyRecord> {
  return requestJson<CreatedApiKeyRecord>('/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const raw = await requestJson<{ items?: ApiKeyRecord[] }>('/v1/api-keys');
  return Array.isArray(raw?.items) ? raw.items : [];
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await requestJson<unknown>(`/v1/api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
}

// ---------- Parcel Intelligence ----------

export type TopFeature = {
  /** Internal feature name (e.g. "lot_area", "zoning_district"). */
  name: string;
  /** Heterogeneous: numeric for singletons, label for one-hot groups, bool for flags. */
  value: string | number | boolean | null;
  /** Signed log-odds contribution. Positive raises the score; negative lowers it. */
  contribution_logit: number;
  /** Share of the row's total absolute attribution. ``[0, 1]``. */
  contribution_pct: number;
};

export type ParcelDecisionAuditStatus =
  | 'verified'
  | 'review'
  | 'excluded'
  | 'unavailable'
  | 'informational';

export type ParcelDecisionAuditCheck = {
  key: string;
  layer:
    | 'model_signal'
    | 'eligibility_gate'
    | 'current_diligence'
    | 'source_freshness';
  label: string;
  status: ParcelDecisionAuditStatus;
  summary: string;
  source: string;
  as_of: string | null;
  affects_model_rank: boolean;
  affects_acquisition_eligibility: boolean;
};

export type ParcelDecisionReadiness = {
  status:
    | 'blocked'
    | 'incomplete'
    | 'review_required'
    | 'initial_review_ready'
    | 'limited_preview';
  label: string;
  recommended_action: string;
  blockers: string[];
  review_items: string[];
  cleared_items: string[];
  disclaimer: string;
};

export type ParcelHistoricalTopKReceipt = {
  k: 100 | 1000;
  evaluated_rows: number;
  observed_hits: number;
  precision: number;
  precision_95ci: [number, number];
};

export type ParcelHistoricalBenchmarkReceipt = {
  schema: 'citylens_historical_benchmark_receipt@v1';
  target: string;
  feature_origin: number;
  outcome_window: string;
  evaluation_scope: string;
  evaluation_rows: number;
  observed_positive_rows: number;
  base_rate: number;
  auc: number;
  pr_auc: number;
  top_100: ParcelHistoricalTopKReceipt;
  top_1000: ParcelHistoricalTopKReceipt;
  interval: {
    method: 'wilson_score_observed_top_k';
    confidence_level: 0.95;
    scope: 'fixed_historical_ranked_list';
    limitations: string;
  };
  evidence_status:
    | 'unexposed'
    | 'development_exposed'
    | 'retired'
    | 'unclassified';
  not_current_accuracy: true;
  not_parcel_confidence: true;
};

export type ParcelDecisionAudit = {
  schema_version: 'citylens/parcel-decision-audit@v1';
  /** Exact published feed version used to assemble the cited audit checks. */
  evidence_generated_at?: string | null;
  overall_status:
    | 'screened'
    | 'screened_with_flags'
    | 'excluded'
    | 'incomplete';
  overall_label: string;
  /** Added server-side in July 2026; optional for older cached parcel responses. */
  readiness?: ParcelDecisionReadiness;
  validation: {
    target: string;
    evaluation_scope: string;
    precision_at_100: number | null;
    precision_at_1000: number | null;
    base_rate: number | null;
    historical_benchmark_receipt?: ParcelHistoricalBenchmarkReceipt | null;
    prospective_validated: boolean;
    disclaimer: string;
  };
  checks: ParcelDecisionAuditCheck[];
  limitations: string[];
};

export type ParcelIntelRow = {
  bbl: string;
  address: string | null;
  /** Official source used for the displayed tax-lot address. */
  address_source?: 'nyc_pad' | 'nyc_pluto' | 'model_sweep' | null;
  borough: string | null;
  score_calibrated: number | null;
  score_calibrated_p10: number | null;
  score_calibrated_p90: number | null;
  priority_rank?: number | null;
  priority_tier?: 'highest' | 'high' | 'medium' | 'watch';
  /** Original order from the historical redevelopment-similarity model. */
  model_rank?: number | null;
  /** Rank among parcels that pass current acquisition eligibility gates. */
  acquisition_rank?: number | null;
  citywide_rank?: number | null;
  acquisition_eligible?: boolean | null;
  acquisition_status?:
    | 'eligible'
    | 'active_project'
    | 'completed_project'
    | 'constrained'
    | 'incomplete_data'
    | null;
  acquisition_exclusion_reasons?: string[];
  lot_area_sqft: number | null;
  allowed_far: number | null;
  max_floor_area_sqft: number | null;
  unused_floor_area_sqft: number | null;
  far_utilization_pct: number | null;
  zoning_district_1: string | null;
  land_use: string | null;
  year_built: number | null;
  num_floors: number | null;
  // Tax-lot centroid in WGS84. Some parcels (condo billing units,
  // transit ROW) lack polygon geometry — those have null lat/lng.
  lat: number | null;
  lng: number | null;
  /** Current NYC tax-lot GeoJSON geometry, used to outline the selected site. */
  parcel_geometry?: Record<string, unknown> | null;
  last_sale_price: number | null;
  last_sale_year: number | null;
  years_held: number | null;
  has_recent_sale_5yr: boolean;
  /** Historical NYC DOF final tax-lien sale record; not current debt status. */
  tax_lien_sale_date?: string | null;
  tax_lien_sale_year?: number | null;
  tax_lien_water_debt_only?: boolean | null;
  tax_lien_data_as_of?: string | null;
  /** Current official violation snapshots; authenticated diligence only. */
  dob_safety_active_count?: number;
  dob_safety_latest_issue_date?: string | null;
  ecb_active_count?: number;
  ecb_class_1_count?: number;
  /** Signed agency-reported balance; credits can make this negative. */
  ecb_balance_due?: number;
  ecb_latest_issue_date?: string | null;
  hpd_open_count?: number;
  hpd_class_c_count?: number;
  hpd_latest_inspection_date?: string | null;
  critical_violation_count?: number | null;
  violation_data_as_of?: string | null;
  /** PLUTO parcel intersection with FEMA 1% annual-chance floodplains. */
  firm07_floodplain?: boolean | null;
  pfirm15_floodplain?: boolean | null;
  floodplain_1pct?: boolean | null;
  floodplain_data_as_of?: string | null;
  /**
   * Current PLUTO E-designation or restrictive-declaration notice. It can
   * concern hazardous materials, air, or noise and is not contamination proof.
   */
  environmental_review_required?: boolean | null;
  environmental_designation_number?: string | null;
  environmental_designation_kind?:
    | 'e_designation'
    | 'restrictive_declaration'
    | 'other'
    | null;
  environmental_designation_data_as_of?: string | null;
  /**
   * Positive-area overlap with a current adopted NYC Planning MIH mapped
   * area. Authenticated current diligence only; not a zoning determination.
   */
  mandatory_inclusionary_housing?: boolean | null;
  mih_options?: string[] | null;
  mih_area_count?: number | null;
  mih_data_as_of?: string | null;
  /**
   * Current MTA station-complex proximity from the tax-lot centroid.
   * Distance is great-circle, not a walking route, entrance distance, travel
   * time, frequency, or zoning determination.
   */
  nearest_transit_complex_id?: string | null;
  nearest_transit_station_name?: string | null;
  nearest_transit_station_distance_m?: number | null;
  nearest_transit_routes?: string[] | null;
  nearest_transit_ada_status?: 'full' | 'partial' | 'none' | null;
  transit_station_count_400m?: number | null;
  transit_station_count_800m?: number | null;
  transit_access_tier?:
    | 'very_close'
    | 'walkable'
    | 'limited'
    | 'distant'
    | null;
  transit_data_as_of?: string | null;
  is_landmark: boolean;
  is_historic_district: boolean;
  block_id: string | null;
  block_rank: number | null;
  /** Current deed owner from the ACRIS sidecar, when published. */
  owner_name?: string | null;
  owner_name_source?: 'acris' | 'pluto' | null;
  /** NYC PLUTO owner category; public/tax-exempt classes are not ranked. */
  owner_type?: string | null;
  /** Conservative legal-entity classification from the current PLUTO name. */
  owner_entity_type?:
    | 'unknown'
    | 'individual'
    | 'llc'
    | 'corp'
    | 'partnership'
    | 'trust'
    | 'estate'
    | 'government'
    | 'religious'
    | 'nonprofit'
    | 'hdfc'
    | null;
  /**
   * Exact normalized current-PLUTO legal-name portfolio. This is diligence
   * context only: it does not infer beneficial ownership or related LLCs.
   */
  owner_portfolio_id?: string | null;
  owner_portfolio_match_method?: 'exact_normalized_pluto_owner_name' | null;
  owner_portfolio_lot_count?: number | null;
  owner_portfolio_borough_count?: number | null;
  owner_portfolio_total_lot_area_sqft?: number | null;
  owner_portfolio_candidate_count?: number | null;
  owner_portfolio_data_as_of?: string | null;
  /** Detected building-change observations from the published CityLens index. */
  change_added_count?: number;
  change_demolished_count?: number;
  change_modified_count?: number;
  /** Imagery epoch of the latest detected physical change. */
  change_latest_imagery_year?: number | null;
  /** True when aerial change activity was observed in recent imagery. */
  recent_change?: boolean | null;
  /** Top-K SHAP attributions for the parcel. Empty when SHAP is unavailable. */
  top_features: TopFeature[];
  /**
   * Validation status against the latest PLUTO snapshot + current DOB:
   *   - "still_vacant"  — clean redev candidate (default).
   *   - "active"        — recent non-terminated project activity or year_built bump.
   *   - "already_built" — completed project or current PLUTO build-out evidence.
   */
  redev_status: 'still_vacant' | 'active' | 'already_built';
  latest_nb_filing_year?: number | null;
  latest_nb_status?: string | null;
  latest_project_filing_year?: number | null;
  latest_project_status?: string | null;
  latest_project_type?:
    | 'new_building'
    | 'alt_co_new_building'
    | 'demolition'
    | 'land_use_entitlement'
    | null;
  latest_project_job_number?: string | null;
  latest_project_url?: string | null;
  opportunity_category?:
    | 'vacant_site'
    | 'ground_up_candidate'
    | 'conversion_or_overbuilt'
    | 'active_project'
    | 'completed_project';
  property_facts_current?: boolean;
  property_facts_as_of?: string | null;
  ownership_as_of?: string | null;
  project_activity_as_of?: string | null;
  land_use_activity_as_of?: string | null;
  data_warnings?: string[];
  assemblage_id?: string | null;
  assemblage_lot_count?: number | null;
  assemblage_combined_lot_area_sqft?: number | null;
  assemblage_combined_buildable_sqft?: number | null;
  assemblage_member_bbls?: string[];
  observed_imagery_year?: number | null;
  /** Server-built separation of model, eligibility, diligence, and freshness evidence. */
  decision_audit?: ParcelDecisionAudit;
};

export type ParcelIntelBorough = {
  slug: string;
  display_name: string;
  count: number;
  top_score: number | null;
};

export type ParcelProspectiveValidationMetric = {
  eligible_parcels: number;
  observed_nb_filing_hits: number | null;
  observed_precision_lower_bound: number | null;
  final_precision: number | null;
  final_precision_95ci: [number, number] | null;
};

export type ParcelProspectiveValidationStatus = {
  schema: 'citylens-parcel-intel/prospective-validation-status@v1';
  cohort_id: string;
  source_generation: string;
  label_definition: 'dob_nb_job_filing';
  measurement_status:
    | 'awaiting_post_issue_data'
    | 'collecting'
    | 'mature';
  issued_at: string;
  observation_starts_on: string;
  observed_through: string;
  matures_at: string;
  elapsed_days: number;
  maturity_fraction: number;
  metrics: {
    top_100: ParcelProspectiveValidationMetric;
    top_1000: ParcelProspectiveValidationMetric;
  };
  historical_benchmark: {
    scope: string | null;
    evaluation_window: string | null;
    precision_at_100: number | null;
    precision_at_1000: number | null;
    not_current_cohort_accuracy: true;
  };
  official_sources: Array<{
    dataset_id: 'ic3t-wcy2' | 'w9ak-ipjd';
    rows_updated_at: string;
  }>;
  report_reference: {
    observation_id: string;
    sha256: string;
  };
  interpretation: string;
};

export type ParcelProspectiveValidationHealth = {
  status: 'current' | 'stale' | 'unavailable';
  reason:
    | 'current'
    | 'observation_lag_exceeded'
    | 'status_missing_or_invalid';
  observation_lag_days: number | null;
  max_observation_lag_days: 8;
  next_monitor_due_on: string | null;
  oldest_official_source_updated_at: string | null;
};

export type ParcelIntelIndex = {
  boroughs: ParcelIntelBorough[];
  generated_at: string | null;
  feed_generation?: string | null;
  model_metadata: Record<string, unknown>;
  data_sources?: Record<string, unknown>;
  quality_gate?: Record<string, unknown>;
  prospective_validation?: ParcelProspectiveValidationStatus | null;
  prospective_validation_health?: ParcelProspectiveValidationHealth | null;
  age_days?: number | null;
  stale?: boolean;
};

export type ParcelIntelSweepResponse = {
  borough: string;
  rows: ParcelIntelRow[];
  generated_at: string | null;
  model_metadata: Record<string, unknown>;
  data_sources?: Record<string, unknown>;
  quality_gate?: Record<string, unknown>;
};

export type ParcelIntelMapRow = Pick<
  ParcelIntelRow,
  | 'bbl'
  | 'address'
  | 'borough'
  | 'score_calibrated'
  | 'priority_rank'
  | 'priority_tier'
  | 'model_rank'
  | 'acquisition_rank'
  | 'citywide_rank'
  | 'acquisition_eligible'
  | 'acquisition_status'
  | 'lot_area_sqft'
  | 'unused_floor_area_sqft'
  | 'far_utilization_pct'
  | 'zoning_district_1'
  | 'lat'
  | 'lng'
  | 'last_sale_price'
  | 'last_sale_year'
  | 'years_held'
  | 'tax_lien_sale_year'
  | 'critical_violation_count'
  | 'floodplain_1pct'
  | 'environmental_review_required'
  | 'mandatory_inclusionary_housing'
  | 'nearest_transit_station_name'
  | 'nearest_transit_station_distance_m'
  | 'nearest_transit_routes'
  | 'nearest_transit_ada_status'
  | 'transit_station_count_800m'
  | 'transit_access_tier'
  | 'owner_name'
  | 'owner_entity_type'
  | 'owner_portfolio_id'
  | 'owner_portfolio_lot_count'
  | 'owner_portfolio_borough_count'
  | 'owner_portfolio_candidate_count'
  | 'recent_change'
  | 'opportunity_category'
  | 'assemblage_lot_count'
>;

export type ParcelIntelMapResponse = {
  rows: ParcelIntelMapRow[];
  generated_at: string | null;
  feed_generation?: string | null;
  access_scope: 'public_preview' | 'authenticated_full';
  requested_top_per_borough: number;
  returned_count: number;
  available_count: number;
  inventory_complete: boolean;
};

export type ParcelScreeningStatus = {
  schema_version: 'citylens/parcel-screening-status@v1';
  bbl: string;
  borough:
    | 'manhattan'
    | 'brooklyn'
    | 'queens'
    | 'bronx'
    | 'staten_island';
  result:
    | 'published_lead'
    | 'qualified_below_cutoff'
    | 'screened_out'
    | 'not_evaluated';
  evaluated: boolean;
  published: boolean;
  acquisition_eligible: boolean | null;
  acquisition_status:
    | 'eligible'
    | 'active_project'
    | 'completed_project'
    | 'constrained'
    | 'incomplete_data'
    | null;
  exclusion_reasons: string[];
  latest_project_filing_year: number | null;
  latest_project_status: string | null;
  latest_project_type:
    | 'new_building'
    | 'alt_co_new_building'
    | 'demolition'
    | 'land_use_entitlement'
    | null;
  latest_project_job_number: string | null;
  latest_project_url: string | null;
  property_facts_as_of: string | null;
  ownership_as_of: string | null;
  project_activity_as_of: string | null;
  land_use_activity_as_of: string | null;
  feed_generation: string | null;
  feed_generated_at: string | null;
  interpretation: string;
};

export type ParcelAddressCandidate = {
  bbl: string;
  borough:
    | 'manhattan'
    | 'brooklyn'
    | 'queens'
    | 'bronx'
    | 'staten_island';
};

export type ParcelAddressResolution = {
  schema_version: 'citylens/parcel-address-resolve-response@v1';
  match_status: 'unique' | 'ambiguous' | 'not_found';
  match_method: 'exact_normalized_official_address';
  candidate_count: number;
  truncated: boolean;
  candidates: ParcelAddressCandidate[];
  unit_designator_ignored: boolean;
  locality_ignored: boolean;
  source_name: string;
  source_dataset_id: 'bc8t-ecyu';
  source_retrieved_at: string;
  resolver_generation: string;
  address_normalization_schema: 'citylens/address-normalization@v1';
  interpretation: string;
};

export type ParcelOfficialDossier = {
  schema_version: 'citylens/parcel-official-dossier@v1';
  bbl: string;
  borough:
    | 'manhattan'
    | 'brooklyn'
    | 'queens'
    | 'bronx'
    | 'staten_island';
  address: string | null;
  pluto_owner_name: string | null;
  acris_owner_name: string | null;
  owner_source_status:
    | 'match'
    | 'different'
    | 'pluto_only'
    | 'acris_only'
    | 'unavailable';
  last_sale_date: string | null;
  last_sale_price: number | null;
  years_held: number | null;
  lot_area_sqft: number | null;
  building_area_sqft: number | null;
  units: number | null;
  num_floors: number | null;
  year_built: number | null;
  land_use: string | null;
  building_class: string | null;
  zoning_district_1: string | null;
  zoning_district_2: string | null;
  built_far: number | null;
  residential_far: number | null;
  commercial_far: number | null;
  facility_far: number | null;
  assessed_land: number | null;
  assessed_building: number | null;
  assessed_total: number | null;
  firm_2007_floodplain: boolean;
  pfirm_2015_floodplain: boolean;
  environmental_review_required: boolean;
  environmental_designation_kind: string | null;
  environmental_designation_number: string | null;
  property_facts_dataset_id: '64uk-42ks';
  property_facts_retrieved_at: string;
  ownership_dataset_ids: {
    master: string;
    legals: string;
    parties: string;
  };
  ownership_features_updated_at: string;
  dossier_generation: string;
  official_links: {
    zola: string;
    acris: string;
    dob_bis: string;
  };
  interpretation: string;
};

export type ParcelWorkflowStage =
  | 'new'
  | 'reviewing'
  | 'contacted'
  | 'underwriting'
  | 'pursue'
  | 'pass';

export type ParcelWorkflowEvidenceReviewKey =
  | 'acquisition_eligibility'
  | 'current_project_clearance'
  | 'property_facts'
  | 'ownership'
  | 'current_diligence'
  | 'transit_access';

export type ParcelWorkflowEvidenceReview = {
  check_key: ParcelWorkflowEvidenceReviewKey;
  label: string;
  check_status: ParcelDecisionAuditStatus;
  source: string;
  source_as_of: string | null;
  feed_generated_at: string | null;
  reviewed_at: string;
};

export type ParcelWorkflowEvidenceIssueType =
  | 'correction'
  | 'suppression_review';

export type ParcelWorkflowEvidenceIssueReason =
  | 'incorrect_value'
  | 'outdated_source'
  | 'wrong_parcel_match'
  | 'duplicate_or_merged_lot'
  | 'privacy_or_safety'
  | 'other';

export type ParcelWorkflowEvidenceIssue = {
  issue_id: string;
  check_key: ParcelWorkflowEvidenceReviewKey;
  label: string;
  issue_type: ParcelWorkflowEvidenceIssueType;
  reason_code: ParcelWorkflowEvidenceIssueReason;
  note: string;
  status: 'submitted' | 'withdrawn' | 'resolved' | 'dismissed';
  check_status: ParcelDecisionAuditStatus;
  source: string;
  source_as_of: string | null;
  feed_generated_at: string | null;
  submitted_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type ParcelWorkflowSnapshot = {
  feed_generated_at: string | null;
  property_facts_as_of: string | null;
  citywide_rank: number | null;
  acquisition_rank: number | null;
  priority_tier: 'highest' | 'high' | 'medium' | 'watch' | null;
  opportunity_category:
    | 'vacant_site'
    | 'ground_up_candidate'
    | 'conversion_or_overbuilt'
    | 'active_project'
    | 'completed_project'
    | null;
  score_calibrated: number | null;
  zoning_district_1: string | null;
  land_use: string | null;
  year_built: number | null;
  allowed_far: number | null;
  unused_floor_area_sqft: number | null;
  owner_name: string | null;
  owner_entity_type: ParcelIntelRow['owner_entity_type'];
  owner_portfolio_lot_count: number | null;
  last_sale_year: number | null;
  latest_nb_filing_year: number | null;
  latest_nb_status: string | null;
  redev_status: 'still_vacant' | 'active' | 'already_built' | null;
  observed_imagery_year: number | null;
  tax_lien_sale_year: number | null;
  critical_violation_count: number | null;
  floodplain_1pct: boolean | null;
  environmental_review_required: boolean | null;
  environmental_designation_number: string | null;
  environmental_designation_kind:
    | 'e_designation'
    | 'restrictive_declaration'
    | 'other'
    | null;
  mandatory_inclusionary_housing: boolean | null;
  nearest_transit_complex_id: string | null;
  nearest_transit_station_name: string | null;
  nearest_transit_station_distance_m: number | null;
  transit_access_tier:
    | 'very_close'
    | 'walkable'
    | 'limited'
    | 'distant'
    | null;
  transit_data_as_of: string | null;
  recent_change: boolean | null;
};

export type ParcelWorkflowItem = {
  bbl: string;
  borough: string;
  stage: ParcelWorkflowStage;
  notes: string;
  tags: string[];
  assignee: string | null;
  watching: boolean;
  decision_reason: string | null;
  next_action: string | null;
  next_action_due_date: string | null;
  outcome:
    | 'unknown'
    | 'owner_contacted'
    | 'meeting_scheduled'
    | 'qualified'
    | 'offer_submitted'
    | 'under_contract'
    | 'closed'
    | 'rejected'
    | 'lost';
  snapshot: ParcelWorkflowSnapshot;
  saved_at: string;
  updated_at: string;
  /** Optional during rolling deploys from the pre-review workflow contract. */
  evidence_reviews?: Partial<
    Record<ParcelWorkflowEvidenceReviewKey, ParcelWorkflowEvidenceReview>
  >;
  /** Optional during rolling deploys from the pre-issue workflow contract. */
  evidence_issues?: Partial<
    Record<ParcelWorkflowEvidenceReviewKey, ParcelWorkflowEvidenceIssue>
  >;
};

export type ParcelWorkflowAdvanceResponse = {
  status: 'created' | 'restored' | 'existing';
  item: ParcelWorkflowItem;
};

export type ParcelWorkflowEvent = {
  event_id: string;
  schema_version: 'citylens/parcel-workflow-event@v1';
  bbl: string;
  event_type: 'created' | 'updated' | 'archived' | 'restored';
  occurred_at: string;
  from_stage: ParcelWorkflowStage | null;
  to_stage: ParcelWorkflowStage | null;
  from_outcome: ParcelWorkflowItem['outcome'] | null;
  to_outcome: ParcelWorkflowItem['outcome'] | null;
  from_decision_reason: string | null;
  to_decision_reason: string | null;
  changed_fields: string[];
};

export type ParcelWorkflowRate = {
  numerator: number;
  denominator: number;
  rate: number | null;
  confidence_interval: ParcelWorkflowConfidenceInterval | null;
  sufficient_denominator: boolean;
};

export type ParcelWorkflowConfidenceInterval = {
  confidence_level: 0.95;
  lower: number;
  upper: number;
};

export type ParcelWorkflowCohort = {
  dimension: 'borough' | 'rank_band' | 'opportunity';
  value: string;
  total: number;
  contacted: number;
  qualified: number;
  offer_submitted: number;
  under_contract: number;
  closed: number;
  rejected: number;
  lost: number;
  contacted_rate_denominator: number;
  qualified_rate_denominator: number;
  close_rate_denominator: number;
  contacted_rate: number | null;
  contacted_confidence_interval: ParcelWorkflowConfidenceInterval | null;
  qualified_rate: number | null;
  qualified_confidence_interval: ParcelWorkflowConfidenceInterval | null;
  close_rate: number | null;
  close_confidence_interval: ParcelWorkflowConfidenceInterval | null;
};

export type ParcelWorkflowMaturityWindow = {
  milestone:
    | 'owner_contacted'
    | 'qualified'
    | 'offer_submitted'
    | 'under_contract'
    | 'closed';
  label: string;
  horizon_days: number;
  eligible_records: number;
  reached_within_horizon: number;
  pending_records: number;
  rate: number | null;
  confidence_interval: ParcelWorkflowConfidenceInterval | null;
  sufficient_denominator: boolean;
};

export type ParcelWorkflowAnalytics = {
  schema_version: 'citylens/parcel-workflow-analytics@v3';
  generated_at: string;
  measurement_status: 'collecting' | 'directional' | 'usable';
  measurement_label: string;
  total_records: number;
  active_records: number;
  archived_records: number;
  event_history_records: number;
  rank_snapshot_records: number;
  valid_saved_at_records: number;
  oldest_followup_days: number | null;
  median_followup_days: number | null;
  minimum_cohort_size: number;
  minimum_rate_denominator: number;
  stage_counts: Record<string, number>;
  outcome_counts: Record<string, number>;
  decision_reason_counts: Record<string, number>;
  funnel: {
    saved: number;
    contacted: number;
    meeting_scheduled: number;
    qualified: number;
    offer_submitted: number;
    under_contract: number;
    closed: number;
    rejected: number;
    lost: number;
    contacted_per_saved: ParcelWorkflowRate;
    qualified_per_contacted: ParcelWorkflowRate;
    offer_per_qualified: ParcelWorkflowRate;
    contract_per_offer: ParcelWorkflowRate;
    close_per_contract: ParcelWorkflowRate;
  };
  maturity_windows: ParcelWorkflowMaturityWindow[];
  cohorts: ParcelWorkflowCohort[];
  warnings: string[];
};

export type ParcelWorkflowOutcomeLabel = {
  milestone:
    | 'owner_contacted'
    | 'qualified'
    | 'offer_submitted'
    | 'under_contract'
    | 'closed';
  horizon_days: number;
  state: 'pending' | 'positive' | 'negative' | 'unavailable_history';
  eligible: boolean;
  value: boolean | null;
  reached_at: string | null;
  days_to_milestone: number | null;
};

export type ParcelWorkflowOutcomeExportRow = {
  bbl: string;
  borough: string;
  saved_at: string;
  archived_at: string | null;
  followup_days: number;
  stage: ParcelWorkflowStage;
  outcome: ParcelWorkflowItem['outcome'];
  decision_reason_category: string | null;
  event_history_observed: boolean;
  event_count: number;
  feed_generated_at: string | null;
  property_facts_as_of: string | null;
  citywide_rank: number | null;
  acquisition_rank: number | null;
  priority_tier: ParcelWorkflowSnapshot['priority_tier'];
  opportunity_category: ParcelWorkflowSnapshot['opportunity_category'];
  saved_model_score: number | null;
  labels: ParcelWorkflowOutcomeLabel[];
};

export type ParcelWorkflowOutcomeExport = {
  schema_version: 'citylens/parcel-workflow-outcome-export@v1';
  methodology_schema_version:
    'citylens/parcel-workflow-analytics-methodology@v2';
  generated_at: string;
  input_record_count: number;
  exported_record_count: number;
  excluded_invalid_saved_at_count: number;
  event_history_observed_count: number;
  rank_snapshot_count: number;
  rows_sha256: string;
  label_semantics: string;
  score_semantics: string;
  privacy_contract: string;
  excluded_private_fields: string[];
  rows: ParcelWorkflowOutcomeExportRow[];
};

export type ParcelWorkflowActionState =
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'scheduled'
  | 'unscheduled';

export type ParcelWorkflowActionItem = {
  bbl: string;
  borough: string;
  address: string | null;
  stage: ParcelWorkflowStage;
  outcome: ParcelWorkflowItem['outcome'];
  assignee: string | null;
  next_action: string | null;
  next_action_due_date: string | null;
  action_state: ParcelWorkflowActionState;
  days_overdue: number;
  days_since_update: number;
  needs_assignee: boolean;
  needs_outcome_update: boolean;
  requires_attention: boolean;
  reminder_snoozed_until: string | null;
  is_snoozed: boolean;
  citywide_rank: number | null;
  priority_tier: ParcelIntelRow['priority_tier'] | null;
  opportunity_category: ParcelIntelRow['opportunity_category'] | null;
  saved_at: string;
  updated_at: string;
};

export type ParcelWorkflowActions = {
  schema_version: 'citylens/parcel-workflow-actions@v1';
  generated_at: string;
  total_records: number;
  open_records: number;
  completed_records: number;
  overdue_count: number;
  due_today_count: number;
  due_soon_count: number;
  scheduled_count: number;
  unscheduled_count: number;
  unassigned_count: number;
  outcome_update_due_count: number;
  attention_count: number;
  snoozed_count: number;
  complete_plan_count: number;
  plan_coverage_rate: number | null;
  assigned_count: number;
  assignee_coverage_rate: number | null;
  outcome_current_count: number;
  outcome_current_rate: number | null;
  items: ParcelWorkflowActionItem[];
};

export type ParcelWorkflowAlert = {
  bbl: string;
  borough: string;
  code:
    | 'removed_from_current_feed'
    | 'screened_out_of_current_feed'
    | 'eligible_below_published_cutoff'
    | 'owner_changed'
    | 'newer_sale_record'
    | 'zoning_changed'
    | 'opportunity_changed'
    | 'priority_tier_changed'
    | 'material_rank_move'
    | 'tax_lien_history_changed'
    | 'critical_violations_changed'
    | 'flood_overlay_changed'
    | 'environmental_review_changed'
    | 'mih_overlay_changed'
    | 'transit_access_changed'
    | 'imagery_change_signal_changed'
    | 'owner_portfolio_size_changed'
    | 'reviewed_evidence_changed'
    | 'evidence_issue_submitted';
  severity: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  field: string;
  before: unknown;
  after: unknown;
  current_disposition?:
    | 'published'
    | 'eligible_below_cutoff'
    | 'screened_out'
    | 'not_evaluated'
    | null;
  reason_codes?: string[];
  recommended_action?: string | null;
  source_evidence?: {
    source: string;
    as_of: string | null;
    url: string | null;
    supports: string;
  }[];
  evidence_changes?: {
    check_key: ParcelWorkflowEvidenceReviewKey;
    label: string;
    reviewed_at: string;
    reviewed_status: ParcelDecisionAuditCheck['status'];
    reviewed_source: string;
    reviewed_source_as_of: string | null;
    reviewed_feed_generated_at: string | null;
    current_status: ParcelDecisionAuditCheck['status'] | null;
    current_source: string | null;
    current_source_as_of: string | null;
    current_feed_generated_at: string | null;
    change_reasons: (
      | 'status'
      | 'source'
      | 'source_as_of'
      | 'feed_generation'
      | 'current_evidence_unavailable'
    )[];
  }[];
  evidence_issue?: ParcelWorkflowEvidenceIssue | null;
  review_recordable?: boolean | null;
  parcel_available?: boolean;
};

export type ParcelWorkflowAlerts = {
  schema_version:
    | 'citylens/parcel-workflow-alerts@v1'
    | 'citylens/parcel-workflow-alerts@v2'
    | 'citylens/parcel-workflow-alerts@v3'
    | 'citylens/parcel-workflow-alerts@v4';
  generated_at: string;
  feed_generated_at: string | null;
  watched_count: number;
  changed_lead_count: number;
  alert_count: number;
  removed_from_feed_count: number;
  resolved_exit_count?: number;
  unresolved_exit_count?: number;
  screened_out_count?: number;
  eligible_below_cutoff_count?: number;
  reviewed_lead_count?: number;
  stale_review_count?: number;
  issue_lead_count?: number;
  open_issue_count?: number;
  severity_counts: Record<'urgent' | 'high' | 'medium' | 'low', number>;
  alerts: ParcelWorkflowAlert[];
  warnings: string[];
};

export type ParcelSavedSearchFilters = {
  query: string;
  priority: 'all' | 'highest' | 'high_or_better';
  /**
   * Compatibility field for saved views created before compound screening.
   * New views send "all" and persist site_type + signals independently.
   */
  opportunity:
    | 'all'
    | 'uncommitted'
    | 'assemblage'
    | 'tax_lien'
    | 'violations'
    | 'floodplain'
    | 'environmental_review'
    | 'mih'
    | 'transit_800m'
    | 'portfolio'
    | 'vacant_site'
    | 'ground_up_candidate'
    | 'conversion_or_overbuilt'
    | 'active_project';
  site_type?:
    | 'all'
    | 'uncommitted'
    | 'vacant_site'
    | 'ground_up_candidate'
    | 'conversion_or_overbuilt'
    | 'active_project';
  signals?: Array<
    | 'assemblage'
    | 'tax_lien'
    | 'violations'
    | 'floodplain'
    | 'environmental_review'
    | 'mih'
    | 'transit_800m'
    | 'portfolio'
    | 'recent_change'
    | 'long_held'
  >;
  min_lot_area_sqft?: number | null;
  min_unused_floor_area_sqft?: number | null;
  owner_portfolio_id: string | null;
  overlay: 'priority' | 'opportunity' | 'borough';
};

export type ParcelSavedSearch = {
  schema_version:
    | 'citylens/parcel-saved-view@v2'
    | 'citylens/parcel-saved-view@v3';
  search_id: string;
  name: string;
  borough:
    | 'all'
    | 'manhattan'
    | 'brooklyn'
    | 'queens'
    | 'bronx'
    | 'staten_island';
  filters: ParcelSavedSearchFilters;
  alert_frequency: 'off';
  snapshot?: {
    schema_version: 'citylens/parcel-saved-view-snapshot@v1';
    feed_generation: string;
    feed_generated_at: string;
    match_count: number;
    matched_bbls: string[];
  } | null;
  created_at: string;
  updated_at: string;
};

export async function getParcelIntelIndex(): Promise<ParcelIntelIndex> {
  return requestJson<ParcelIntelIndex>('/v1/parcel-intel/index', undefined, {
    includeAuth: false,
  });
}

export async function getParcelIntelSweep(
  borough: string,
  top: number = 1000,
  opts?: { includeAuth?: boolean },
): Promise<ParcelIntelSweepResponse> {
  const includeAuth = opts?.includeAuth ?? false;
  const params = new URLSearchParams({ borough, top: String(top) });
  return requestJson<ParcelIntelSweepResponse>(
    `/v1/parcel-intel/sweep?${params.toString()}`,
    includeAuth ? { cache: 'no-store' } : undefined,
    { includeAuth },
  );
}

export async function getParcelIntelMap(
  topPerBorough: number = 1000,
  opts?: { includeAuth?: boolean },
): Promise<ParcelIntelMapResponse> {
  const includeAuth = opts?.includeAuth ?? false;
  const params = new URLSearchParams({
    top_per_borough: String(topPerBorough),
  });
  return requestJson<ParcelIntelMapResponse>(
    `/v1/parcel-intel/map?${params.toString()}`,
    includeAuth ? { cache: 'no-store' } : undefined,
    { includeAuth },
  );
}

export async function getParcelIntelParcel(
  bbl: string,
  opts?: { includeAuth?: boolean },
): Promise<ParcelIntelRow> {
  return requestJson<ParcelIntelRow>(
    `/v1/parcel-intel/parcel/${encodeURIComponent(bbl)}`,
    undefined,
    { includeAuth: opts?.includeAuth ?? false },
  );
}

export async function getParcelScreeningStatus(
  bbl: string,
): Promise<ParcelScreeningStatus> {
  return requestJson<ParcelScreeningStatus>(
    `/v1/parcel-intel/screening/${encodeURIComponent(bbl)}`,
    { cache: 'no-store' },
  );
}

export async function resolveParcelAddress(
  address: string,
): Promise<ParcelAddressResolution> {
  return requestJson<ParcelAddressResolution>(
    '/v1/parcel-intel/resolve-address',
    {
      method: 'POST',
      body: JSON.stringify({
        schema_version: 'citylens/parcel-address-resolve-request@v1',
        address,
      }),
      cache: 'no-store',
    },
  );
}

export async function getParcelOfficialDossier(
  bbl: string,
): Promise<ParcelOfficialDossier> {
  return requestJson<ParcelOfficialDossier>(
    `/v1/parcel-intel/official-parcel/${encodeURIComponent(bbl)}`,
    { cache: 'no-store' },
  );
}

export async function listParcelWorkflow(): Promise<ParcelWorkflowItem[]> {
  return requestJson<ParcelWorkflowItem[]>('/v1/parcel-intel/workflow');
}

export async function getParcelWorkflow(
  bbl: string,
): Promise<ParcelWorkflowItem | null> {
  return requestJson<ParcelWorkflowItem | null>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}`,
    { cache: 'no-store' },
  );
}

export async function recordParcelProductEvent(
  event: ParcelProductEventName,
  source: ParcelProductEventSource,
): Promise<void> {
  await requestJson<unknown>(
    '/v1/parcel-intel/product-events',
    {
      method: 'POST',
      body: JSON.stringify({
        schema_version: 'citylens/parcel-product-event@v1',
        event,
        source,
      }),
      cache: 'no-store',
    },
  );
}

export async function getParcelWorkflowAnalytics(): Promise<ParcelWorkflowAnalytics> {
  return requestJson<ParcelWorkflowAnalytics>(
    '/v1/parcel-intel/workflow/analytics',
  );
}

export async function getParcelWorkflowOutcomeExport(): Promise<ParcelWorkflowOutcomeExport> {
  return requestJson<ParcelWorkflowOutcomeExport>(
    '/v1/parcel-intel/workflow/outcomes/export',
  );
}

export async function getParcelWorkflowActions(): Promise<ParcelWorkflowActions> {
  return requestJson<ParcelWorkflowActions>(
    '/v1/parcel-intel/workflow/actions',
  );
}

export async function snoozeParcelWorkflowReminder(
  bbl: string,
  days: 0 | 1 | 3 | 7 | 14,
): Promise<{
  bbl: string;
  reminder_snoozed_until: string | null;
  is_snoozed: boolean;
}> {
  return requestJson(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/reminder`,
    { method: 'POST', body: JSON.stringify({ days }) },
  );
}

export async function getParcelWorkflowAlerts(): Promise<ParcelWorkflowAlerts> {
  return requestJson<ParcelWorkflowAlerts>(
    '/v1/parcel-intel/workflow/alerts',
  );
}

export async function listParcelWorkflowEvents(
  bbl: string,
): Promise<ParcelWorkflowEvent[]> {
  return requestJson<ParcelWorkflowEvent[]>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/events`,
  );
}

export async function saveParcelWorkflow(
  bbl: string,
  item: Omit<
    ParcelWorkflowItem,
    'bbl' | 'saved_at' | 'updated_at' | 'snapshot' | 'evidence_reviews'
  >,
): Promise<ParcelWorkflowItem> {
  return requestJson<ParcelWorkflowItem>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}`,
    { method: 'PUT', body: JSON.stringify(item) },
  );
}

export async function advanceParcelWorkflow(
  bbl: string,
  input: {
    borough: 'manhattan' | 'brooklyn' | 'queens' | 'bronx' | 'staten_island';
    next_action: string;
    next_action_due_date: string | null;
  },
): Promise<ParcelWorkflowAdvanceResponse> {
  return requestJson<ParcelWorkflowAdvanceResponse>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/advance`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
}

export async function reviewParcelWorkflowEvidence(
  bbl: string,
  checkKey: ParcelWorkflowEvidenceReviewKey,
  input: {
    expected_check_status: ParcelDecisionAuditStatus;
    expected_source: string;
    expected_source_as_of: string | null;
    expected_feed_generated_at: string | null;
  },
): Promise<ParcelWorkflowItem> {
  return requestJson<ParcelWorkflowItem>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/evidence-reviews/${encodeURIComponent(checkKey)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
}

export async function clearParcelWorkflowEvidenceReview(
  bbl: string,
  checkKey: ParcelWorkflowEvidenceReviewKey,
): Promise<ParcelWorkflowItem> {
  return requestJson<ParcelWorkflowItem>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/evidence-reviews/${encodeURIComponent(checkKey)}`,
    {
      method: 'DELETE',
      cache: 'no-store',
    },
  );
}

export async function submitParcelWorkflowEvidenceIssue(
  bbl: string,
  checkKey: ParcelWorkflowEvidenceReviewKey,
  input: {
    issue_type: ParcelWorkflowEvidenceIssueType;
    reason_code: ParcelWorkflowEvidenceIssueReason;
    note: string;
    expected_check_status: ParcelDecisionAuditStatus;
    expected_source: string;
    expected_source_as_of: string | null;
    expected_feed_generated_at: string | null;
  },
): Promise<ParcelWorkflowItem> {
  return requestJson<ParcelWorkflowItem>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/evidence-issues/${encodeURIComponent(checkKey)}`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
}

export async function withdrawParcelWorkflowEvidenceIssue(
  bbl: string,
  checkKey: ParcelWorkflowEvidenceReviewKey,
): Promise<ParcelWorkflowItem> {
  return requestJson<ParcelWorkflowItem>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}/evidence-issues/${encodeURIComponent(checkKey)}`,
    {
      method: 'DELETE',
      cache: 'no-store',
    },
  );
}

export async function removeParcelWorkflow(bbl: string): Promise<void> {
  await requestJson<unknown>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}`,
    { method: 'DELETE' },
  );
}

export async function listParcelSavedSearches(): Promise<ParcelSavedSearch[]> {
  return requestJson<ParcelSavedSearch[]>('/v1/parcel-intel/saved-searches');
}

export async function saveParcelSearch(
  searchId: string,
  item: Pick<
    ParcelSavedSearch,
    'name' | 'borough' | 'filters' | 'alert_frequency' | 'snapshot'
  >,
): Promise<ParcelSavedSearch> {
  return requestJson<ParcelSavedSearch>(
    `/v1/parcel-intel/saved-searches/${encodeURIComponent(searchId)}`,
    { method: 'PUT', body: JSON.stringify(item) },
  );
}

export async function removeParcelSavedSearch(searchId: string): Promise<void> {
  await requestJson<unknown>(
    `/v1/parcel-intel/saved-searches/${encodeURIComponent(searchId)}`,
    { method: 'DELETE' },
  );
}
