'use client';

const RUN_PREFILL_STORAGE_KEY = 'citylens_run_prefill_v1';
const RUN_PREFILL_TTL_MS = 30 * 60 * 1000;
const MAX_ADDRESS_LENGTH = 300;
const NYC_BBL_PATTERN = /^\d{10}$/;

export type RunPrefill = {
  address: string;
  bbl: string;
  source: 'parcel_intel';
  createdAtMs: number;
};

type RunPrefillInput = Pick<RunPrefill, 'address' | 'bbl'>;

function normalizeRunPrefill(
  value: unknown,
  nowMs: number,
): RunPrefill | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RunPrefill>;
  const address =
    typeof candidate.address === 'string' ? candidate.address.trim() : '';
  const bbl = typeof candidate.bbl === 'string' ? candidate.bbl.trim() : '';

  if (
    candidate.source !== 'parcel_intel' ||
    !address ||
    address.length > MAX_ADDRESS_LENGTH ||
    !/\d/.test(address) ||
    !NYC_BBL_PATTERN.test(bbl) ||
    typeof candidate.createdAtMs !== 'number' ||
    !Number.isFinite(candidate.createdAtMs) ||
    candidate.createdAtMs > nowMs + 60_000 ||
    nowMs - candidate.createdAtMs > RUN_PREFILL_TTL_MS
  ) {
    return null;
  }

  return {
    address,
    bbl,
    source: 'parcel_intel',
    createdAtMs: candidate.createdAtMs,
  };
}

export function queueRunPrefill(
  input: RunPrefillInput,
  nowMs = Date.now(),
): boolean {
  if (typeof window === 'undefined') return false;
  const prefill = normalizeRunPrefill(
    { ...input, source: 'parcel_intel', createdAtMs: nowMs },
    nowMs,
  );
  if (!prefill) return false;

  try {
    window.sessionStorage.setItem(
      RUN_PREFILL_STORAGE_KEY,
      JSON.stringify(prefill),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and delete the pending parcel handoff. The record is tab-scoped,
 * short-lived, and consumed once so parcel identifiers never need to appear
 * in a URL, referrer, or analytics payload.
 */
export function consumeRunPrefill(nowMs = Date.now()): RunPrefill | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(RUN_PREFILL_STORAGE_KEY);
    window.sessionStorage.removeItem(RUN_PREFILL_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    return normalizeRunPrefill(JSON.parse(raw) as unknown, nowMs);
  } catch {
    return null;
  }
}
