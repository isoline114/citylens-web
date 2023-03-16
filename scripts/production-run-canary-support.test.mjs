import { describe, expect, it } from 'vitest';

import {
  canaryArtifactEntries,
  canaryPayloadIsValueMinimized,
  isTerminalCanaryRun,
  summarizeCanaryAccount,
  summarizeCanaryCreate,
  summarizeCanaryRun,
  summarizeCanaryRunList,
  summarizeCanarySummary,
} from './production-run-canary-support.mjs';

function artifact(name, type, sizeBytes) {
  return {
    name,
    type,
    size_bytes: sizeBytes,
    sha256: 'a'.repeat(64),
    signed_url: `https://storage.example/${name}?private=value`,
    gcs_uri: `gs://private/${name}`,
  };
}

describe('production run canary support', () => {
  it('summarizes account eligibility without identity fields', () => {
    const receipt = summarizeCanaryAccount(200, {
      user: {
        id: 'private-id',
        email: 'private@example.com',
        plan_type: 'free',
        is_admin: false,
      },
      quota: {
        unlimited: false,
        runs_remaining: 4,
        max_concurrent_runs: 1,
      },
    });

    expect(receipt).toEqual({
      status: 200,
      authenticated: true,
      plan_type: 'free',
      is_admin: false,
      unlimited: false,
      runs_remaining: 4,
      max_concurrent_runs: 1,
      eligible: true,
    });
    expect(JSON.stringify(receipt)).not.toContain('private');
  });

  it('summarizes active runs without run ids or request values', () => {
    const receipt = summarizeCanaryRunList(200, {
      items: [
        { run_id: 'private-a', status: 'running' },
        { run_id: 'private-b', status: 'succeeded' },
      ],
      next_cursor: 'private-cursor',
    });

    expect(receipt.active_count).toBe(1);
    expect(receipt.status_counts).toEqual({
      failed: 0,
      queued: 0,
      running: 1,
      succeeded: 1,
      unknown: 0,
    });
    expect(JSON.stringify(receipt)).not.toContain('private');
  });

  it('accepts one well-formed queued create response without retaining its id', () => {
    const receipt = summarizeCanaryCreate(200, {
      run_id: 'private-run-id',
      status: 'queued',
      stage: 'queued',
      progress: 0,
      request: { address: 'private address' },
    });

    expect(receipt).toEqual({
      status: 200,
      accepted: true,
      run_status: 'queued',
      stage: 'queued',
      progress: 0,
    });
    expect(JSON.stringify(receipt)).not.toContain('private');
  });

  it('requires complete strong artifact metadata on successful runs', () => {
    const payload = {
      run_id: 'private-run',
      status: 'succeeded',
      stage: 'complete',
      progress: 100,
      request: { address: 'private address' },
      artifacts: [
        artifact('preview.png', 'image/png', 5_001),
        artifact('change.geojson', 'application/geo+json', 129),
        artifact('mesh.ply', 'model/ply', 1_025),
        artifact('run_summary.json', 'application/json', 513),
      ],
    };

    const receipt = summarizeCanaryRun(200, payload);
    expect(receipt.artifact_metadata_valid).toBe(true);
    expect(receipt.missing_artifacts).toEqual([]);
    expect(receipt.invalid_artifact_metadata).toEqual([]);
    expect(JSON.stringify(receipt)).not.toContain('private');
    expect(canaryArtifactEntries(payload)).toHaveLength(4);
    expect(isTerminalCanaryRun(payload)).toBe(true);
  });

  it('fails artifact metadata when an output is toy-sized or absent', () => {
    const receipt = summarizeCanaryRun(200, {
      status: 'succeeded',
      stage: 'complete',
      progress: 100,
      artifacts: [
        artifact('preview.png', 'image/png', 1),
        artifact('change.geojson', 'application/geo+json', 129),
      ],
    });

    expect(receipt.artifact_metadata_valid).toBe(false);
    expect(receipt.invalid_artifact_metadata).toEqual(['preview.png']);
    expect(receipt.missing_artifacts).toEqual([
      'mesh.ply',
      'run_summary.json',
    ]);
  });

  it('summarizes structured failures without retaining backend messages', () => {
    const receipt = summarizeCanaryRun(200, {
      status: 'failed',
      stage: 'fetch',
      progress: 10,
      error: {
        code: 'SOURCE_UNAVAILABLE',
        stage: 'fetch',
        message: 'private backend response',
        traceback_summary: ['private stack'],
      },
    });

    expect(receipt.error_code).toBe('SOURCE_UNAVAILABLE');
    expect(receipt.error_stage).toBe('fetch');
    expect(JSON.stringify(receipt)).not.toContain('private');
  });

  it('requires QA, performance, runtime, and stage timing receipts', () => {
    expect(
      summarizeCanarySummary({
        qa: { parity_status: 'reference_only' },
        performance: {
          total_runtime_seconds: 182.5,
          stage_timings_seconds: { fetch: 30, segment: 120 },
        },
      }),
    ).toEqual({
      qa_present: true,
      performance_present: true,
      total_runtime_seconds: 182.5,
      stage_timing_count: 2,
      valid: true,
    });
  });

  it('rejects receipts containing sensitive or linkable values', () => {
    expect(
      canaryPayloadIsValueMinimized({
        passed: true,
        case_id: 'brooklyn-reference-v1',
        artifact_count: 4,
      }),
    ).toBe(true);
    expect(
      canaryPayloadIsValueMinimized({
        passed: false,
        run_id: 'private',
      }),
    ).toBe(false);
    expect(
      canaryPayloadIsValueMinimized({
        passed: false,
        artifact_url: 'https://storage.example/private',
      }),
    ).toBe(false);
  });
});
