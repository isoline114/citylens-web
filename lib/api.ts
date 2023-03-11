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

type TokenGetter = () => Promise<string | null> | string | null;
let tokenGetter: TokenGetter | null = null;

export function setAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

async function resolveAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  const result = tokenGetter();
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

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ApiError(`Network error while calling ${path}: ${msg}`);
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

export type ParcelIntelRow = {
  bbl: string;
  address: string | null;
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
};

export type ParcelIntelBorough = {
  slug: string;
  display_name: string;
  count: number;
  top_score: number | null;
};

export type ParcelIntelIndex = {
  boroughs: ParcelIntelBorough[];
  generated_at: string | null;
  model_metadata: Record<string, unknown>;
  data_sources?: Record<string, unknown>;
  quality_gate?: Record<string, unknown>;
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
};

export type ParcelWorkflowStage =
  | 'new'
  | 'reviewing'
  | 'contacted'
  | 'underwriting'
  | 'pursue'
  | 'pass';

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
  sufficient_denominator: boolean;
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
  contacted_rate: number | null;
  qualified_rate: number | null;
  close_rate: number | null;
};

export type ParcelWorkflowAnalytics = {
  schema_version: 'citylens/parcel-workflow-analytics@v1';
  generated_at: string;
  measurement_status: 'collecting' | 'directional' | 'usable';
  measurement_label: string;
  total_records: number;
  active_records: number;
  archived_records: number;
  event_history_records: number;
  rank_snapshot_records: number;
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
  cohorts: ParcelWorkflowCohort[];
  warnings: string[];
};

export type ParcelWorkflowAlert = {
  bbl: string;
  borough: string;
  code:
    | 'removed_from_current_feed'
    | 'owner_changed'
    | 'newer_sale_record'
    | 'zoning_changed'
    | 'opportunity_changed'
    | 'priority_tier_changed'
    | 'material_rank_move'
    | 'tax_lien_history_changed'
    | 'critical_violations_changed'
    | 'flood_overlay_changed'
    | 'imagery_change_signal_changed'
    | 'owner_portfolio_size_changed';
  severity: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  field: string;
  before: unknown;
  after: unknown;
};

export type ParcelWorkflowAlerts = {
  schema_version: 'citylens/parcel-workflow-alerts@v1';
  generated_at: string;
  feed_generated_at: string | null;
  watched_count: number;
  changed_lead_count: number;
  alert_count: number;
  removed_from_feed_count: number;
  severity_counts: Record<'urgent' | 'high' | 'medium' | 'low', number>;
  alerts: ParcelWorkflowAlert[];
  warnings: string[];
};

export type ParcelSavedSearchFilters = {
  landUseFilter: 'all' | 'residential' | 'commercial' | 'industrial' | 'vacant';
  priorityFilter: 'all' | 'highest' | 'high_or_better' | 'medium_or_better';
  opportunityFilter:
    | 'all'
    | 'ground_up'
    | 'vacant_site'
    | 'ground_up_candidate'
    | 'conversion_or_overbuilt'
    | 'active_project';
  hideLandmarked: boolean;
  recentSaleOnly: boolean;
  recentChangeOnly: boolean;
  pipelineOnly: boolean;
  zoningFamilies: Array<'R' | 'C' | 'M' | 'Other'>;
  sortKey:
    | 'score_calibrated'
    | 'lot_area_sqft'
    | 'last_sale_price'
    | 'years_held'
    | 'year_built'
    | 'num_floors'
    | 'allowed_far'
    | 'far_utilization_pct';
  direction: 'asc' | 'desc';
};

export type ParcelSavedSearch = {
  search_id: string;
  name: string;
  borough: string;
  filters: ParcelSavedSearchFilters;
  alert_frequency: 'off' | 'daily' | 'weekly';
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
  const params = new URLSearchParams({ borough, top: String(top) });
  return requestJson<ParcelIntelSweepResponse>(
    `/v1/parcel-intel/sweep?${params.toString()}`,
    undefined,
    { includeAuth: opts?.includeAuth ?? false },
  );
}

export async function getParcelIntelMap(
  topPerBorough: number = 1000,
  opts?: { includeAuth?: boolean },
): Promise<ParcelIntelMapResponse> {
  const params = new URLSearchParams({
    top_per_borough: String(topPerBorough),
  });
  return requestJson<ParcelIntelMapResponse>(
    `/v1/parcel-intel/map?${params.toString()}`,
    undefined,
    { includeAuth: opts?.includeAuth ?? false },
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

export async function listParcelWorkflow(): Promise<ParcelWorkflowItem[]> {
  return requestJson<ParcelWorkflowItem[]>('/v1/parcel-intel/workflow');
}

export async function getParcelWorkflowAnalytics(): Promise<ParcelWorkflowAnalytics> {
  return requestJson<ParcelWorkflowAnalytics>(
    '/v1/parcel-intel/workflow/analytics',
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
  item: Omit<ParcelWorkflowItem, 'bbl' | 'saved_at' | 'updated_at'>,
): Promise<ParcelWorkflowItem> {
  return requestJson<ParcelWorkflowItem>(
    `/v1/parcel-intel/workflow/${encodeURIComponent(bbl)}`,
    { method: 'PUT', body: JSON.stringify(item) },
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
  item: Pick<ParcelSavedSearch, 'name' | 'borough' | 'filters' | 'alert_frequency'>,
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
