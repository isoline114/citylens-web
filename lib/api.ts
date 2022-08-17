import { getApiKey } from '@/lib/storage';
import type { CitylensCreateRunPayload } from '@/lib/validation';
import type { CreateRunResponse, RunResponse } from '@/lib/types';

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const apiKey = getApiKey();

  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (apiKey) headers.set('X-API-Key', apiKey);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e: any) {
    throw new ApiError(`Network error while calling ${path}: ${e?.message ?? String(e)}`);
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
