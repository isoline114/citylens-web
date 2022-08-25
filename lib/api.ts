import { getApiKey } from '@/lib/storage';
import type { CitylensCreateRunPayload } from '@/lib/validation';
import type { CreateRunResponse, RunResponse } from '@/lib/types';

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
  const v = process.env.NEXT_PUBLIC_CITYLENS_API_BASE;
  return (v && v.trim().length > 0 ? v : 'http://localhost:8000').replace(/\/+$/, '');
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  opts?: { includeApiKey?: boolean },
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
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
