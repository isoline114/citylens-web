import { getApiKey } from '@/lib/storage';
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
  opts?: { includeApiKey?: boolean },
): Promise<T> {
  const url = joinApiUrl(getBaseUrl(), path);
  const includeApiKey = opts?.includeApiKey ?? true;
  const apiKey = includeApiKey ? getApiKey() : null;

  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (apiKey) headers.set('X-API-Key', apiKey);

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
  return requestJson('/v1/health');
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

export async function getFeaturedDemos(): Promise<DemoFeaturedRun[]> {
  const raw = await requestJson<unknown>('/v1/demo/featured', undefined, { includeApiKey: false });
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

export async function getDemoRun(runId: string): Promise<RunResponse> {
  return requestJson<RunResponse>(`/v1/demo/runs/${encodeURIComponent(runId)}`, undefined, { includeApiKey: false });
}
