export const REQUIRED_CANARY_ARTIFACTS = Object.freeze([
  'preview.png',
  'change.geojson',
  'mesh.ply',
  'run_summary.json',
]);

export const CANARY_ARTIFACT_CONTRACT = Object.freeze({
  'preview.png': {
    contentType: 'image/png',
    minimumBytes: 5_000,
  },
  'change.geojson': {
    contentType: 'application/geo+json',
    minimumBytes: 128,
  },
  'mesh.ply': {
    contentType: 'model/ply',
    minimumBytes: 1_024,
  },
  'run_summary.json': {
    contentType: 'application/json',
    minimumBytes: 512,
  },
});

const TERMINAL_RUN_STATUSES = new Set(['succeeded', 'failed']);
const KNOWN_PLAN_TYPES = new Set(['admin', 'free']);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function finiteNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function finitePositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function summarizeCanaryAccount(status, payload) {
  const body = record(payload);
  const user = record(body.user);
  const quota = record(body.quota);
  const planType = String(user.plan_type ?? '').toLowerCase();
  const unlimited = quota.unlimited === true;
  const remaining =
    quota.runs_remaining === null
      ? null
      : finiteNonNegativeInteger(quota.runs_remaining);
  const receipt = {
    status,
    authenticated: status === 200 && typeof user.id === 'string',
    plan_type: KNOWN_PLAN_TYPES.has(planType) ? planType : 'other',
    is_admin: user.is_admin === true,
    unlimited,
    runs_remaining: remaining,
    max_concurrent_runs:
      quota.max_concurrent_runs === null
        ? null
        : finiteNonNegativeInteger(quota.max_concurrent_runs),
    eligible:
      status === 200 &&
      typeof user.id === 'string' &&
      (unlimited || (remaining !== null && remaining > 0)),
  };
  return receipt;
}

export function summarizeCanaryRunList(status, payload) {
  const body = record(payload);
  const items = Array.isArray(body.items) ? body.items : [];
  const statusCounts = {
    failed: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    unknown: 0,
  };
  for (const item of items) {
    const value = String(record(item).status ?? '').toLowerCase();
    if (value in statusCounts && value !== 'unknown') {
      statusCounts[value] += 1;
    } else {
      statusCounts.unknown += 1;
    }
  }
  return {
    status,
    shape_valid:
      status === 200 &&
      Array.isArray(body.items) &&
      items.every(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          !Array.isArray(item),
      ),
    item_count: items.length,
    active_count: statusCounts.queued + statusCounts.running,
    status_counts: statusCounts,
  };
}

export function summarizeCanaryCreate(status, payload) {
  const body = record(payload);
  const runStatus = String(body.status ?? '').toLowerCase();
  return {
    status,
    accepted:
      status === 200 &&
      typeof body.run_id === 'string' &&
      body.run_id.length > 0 &&
      (runStatus === 'queued' || runStatus === 'running'),
    run_status:
      runStatus === 'queued' || runStatus === 'running'
        ? runStatus
        : 'unknown',
    stage: typeof body.stage === 'string' ? body.stage : null,
    progress: finiteNonNegativeInteger(body.progress),
  };
}

function normalizedArtifacts(payload) {
  const artifacts = Array.isArray(record(payload).artifacts)
    ? record(payload).artifacts
    : [];
  return new Map(
    artifacts
      .map((artifact) => record(artifact))
      .filter((artifact) => typeof artifact.name === 'string')
      .map((artifact) => [artifact.name, artifact]),
  );
}

export function summarizeCanaryRun(status, payload) {
  const body = record(payload);
  const runStatus = String(body.status ?? '').toLowerCase();
  const artifacts = normalizedArtifacts(body);
  const missingArtifacts = REQUIRED_CANARY_ARTIFACTS.filter(
    (name) => !artifacts.has(name),
  );
  const invalidMetadata = [];
  for (const name of REQUIRED_CANARY_ARTIFACTS) {
    const artifact = artifacts.get(name);
    if (!artifact) continue;
    const contract = CANARY_ARTIFACT_CONTRACT[name];
    const mediaType = String(artifact.type ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const valid =
      mediaType === contract.contentType &&
      Number.isSafeInteger(artifact.size_bytes) &&
      artifact.size_bytes >= contract.minimumBytes &&
      typeof artifact.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(artifact.sha256) &&
      typeof artifact.signed_url === 'string' &&
      artifact.signed_url.startsWith('https://');
    if (!valid) invalidMetadata.push(name);
  }
  const error = record(body.error);
  return {
    status,
    run_status: TERMINAL_RUN_STATUSES.has(runStatus)
      ? runStatus
      : runStatus === 'queued' || runStatus === 'running'
        ? runStatus
        : 'unknown',
    stage: typeof body.stage === 'string' ? body.stage : null,
    progress: finiteNonNegativeInteger(body.progress),
    artifact_count: artifacts.size,
    required_artifact_count: REQUIRED_CANARY_ARTIFACTS.length,
    missing_artifacts: missingArtifacts,
    invalid_artifact_metadata: invalidMetadata,
    artifact_metadata_valid:
      runStatus === 'succeeded' &&
      missingArtifacts.length === 0 &&
      invalidMetadata.length === 0,
    error_code:
      runStatus === 'failed' && typeof error.code === 'string'
        ? error.code
        : null,
    error_stage:
      runStatus === 'failed' && typeof error.stage === 'string'
        ? error.stage
        : null,
  };
}

export function canaryArtifactEntries(payload) {
  const artifacts = normalizedArtifacts(payload);
  return REQUIRED_CANARY_ARTIFACTS.map((name) => {
    const artifact = artifacts.get(name);
    return {
      name,
      url:
        artifact && typeof artifact.signed_url === 'string'
          ? artifact.signed_url
          : null,
    };
  });
}

export function isTerminalCanaryRun(payload) {
  return TERMINAL_RUN_STATUSES.has(
    String(record(payload).status ?? '').toLowerCase(),
  );
}

export function summarizeCanarySummary(payload) {
  const body = record(payload);
  const qa = record(body.qa);
  const performance = record(body.performance);
  const timings = record(performance.stage_timings_seconds);
  const totalRuntime = finitePositiveNumber(
    performance.total_runtime_seconds,
  );
  return {
    qa_present: Object.keys(qa).length > 0,
    performance_present: Object.keys(performance).length > 0,
    total_runtime_seconds: totalRuntime,
    stage_timing_count: Object.values(timings).filter(
      (value) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0,
    ).length,
    valid:
      Object.keys(qa).length > 0 &&
      Object.keys(performance).length > 0 &&
      totalRuntime !== null &&
      Object.keys(timings).length > 0,
  };
}

export function canaryPayloadIsValueMinimized(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const serialized = JSON.stringify(payload).toLowerCase();
  return ![
    'run_id',
    'address',
    'email',
    'token',
    'signed_url',
    'gcs_uri',
    'gcs_object',
    'http://',
    'https://',
  ].some((forbidden) => serialized.includes(forbidden));
}
