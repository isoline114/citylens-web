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
  last_sale_price: number | null;
  last_sale_year: number | null;
  years_held: number | null;
  has_recent_sale_5yr: boolean;
  is_landmark: boolean;
  is_historic_district: boolean;
  block_id: string | null;
  block_rank: number | null;
  /** Current deed owner from the ACRIS sidecar, when published. */
  owner_name?: string | null;
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
   * Validation status against the latest PLUTO snapshot + DOB labels:
   *   - "still_vacant"  — clean redev candidate (default).
   *   - "active"        — NB-permitted 2019-2024 OR year_built bumped post-2018.
   *   - "already_built" — completed; publisher should have filtered out before us.
   */
  redev_status: 'still_vacant' | 'active' | 'already_built';
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
};

export type ParcelIntelSweepResponse = {
  borough: string;
  rows: ParcelIntelRow[];
  generated_at: string | null;
  model_metadata: Record<string, unknown>;
};

export async function getParcelIntelIndex(): Promise<ParcelIntelIndex> {
  return requestJson<ParcelIntelIndex>('/v1/parcel-intel/index', undefined, {
    includeAuth: false,
  });
}

export async function getParcelIntelSweep(
  borough: string,
  top: number = 1000,
): Promise<ParcelIntelSweepResponse> {
  const params = new URLSearchParams({ borough, top: String(top) });
  return requestJson<ParcelIntelSweepResponse>(
    `/v1/parcel-intel/sweep?${params.toString()}`,
    undefined,
    { includeAuth: false },
  );
}
