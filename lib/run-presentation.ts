import type { RunListItem, RunResponse } from '@/lib/types';

export type RunState = 'queued' | 'running' | 'succeeded' | 'failed' | 'unknown';

export type RunStatePresentation = {
  state: RunState;
  label: string;
  summary: string;
};

export function presentRunState(status: unknown): RunStatePresentation {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (value === 'queued') {
    return {
      state: 'queued',
      label: 'Queued',
      summary: 'Waiting for an available worker',
    };
  }
  if (value === 'running') {
    return {
      state: 'running',
      label: 'Processing',
      summary: 'Building the parcel evidence package',
    };
  }
  if (value === 'succeeded') {
    return {
      state: 'succeeded',
      label: 'Ready',
      summary: 'Outputs are ready to review',
    };
  }
  if (value === 'failed') {
    return {
      state: 'failed',
      label: 'Needs attention',
      summary: 'Processing stopped before completion',
    };
  }
  return {
    state: 'unknown',
    label: value ? humanizeRunValue(value) : 'Checking',
    summary: 'Waiting for a current processing receipt',
  };
}

export function runAddress(run: RunListItem | RunResponse | undefined): string | null {
  const request = run?.request;
  if (!request || typeof request !== 'object') return null;
  const address = (request as { address?: unknown }).address;
  return typeof address === 'string' && address.trim().length > 0
    ? address.trim()
    : null;
}

export function humanizeRunValue(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '—';
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatRunDateTime(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function shortRunId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`;
}

export function hasPublishedArtifacts(run: RunResponse | undefined): boolean {
  const artifacts = run?.artifacts;
  if (Array.isArray(artifacts)) return artifacts.length > 0;
  return Boolean(
    artifacts &&
      typeof artifacts === 'object' &&
      Object.keys(artifacts).length > 0,
  );
}
