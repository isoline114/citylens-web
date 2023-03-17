const PRODUCT_EVENT_KEYS = [
  'event',
  'schema_version',
  'source',
];
const RUN_STATUS_KEYS = [
  'failed',
  'queued',
  'running',
  'succeeded',
  'unknown',
];
const RUN_LIST_RECEIPT_KEYS = [
  'item_count',
  'next_cursor_present',
  'shape_valid',
  'status',
  'status_counts',
  'value_minimized',
];
const WORKFLOW_ANALYTICS_RECEIPT_KEYS = [
  'cohort_state',
  'has_saved_leads',
  'maturity_boundary_safe',
  'schema_version_valid',
  'shape_valid',
  'status',
  'value_minimized',
];
const WORKFLOW_MEASUREMENT_STATES = [
  'collecting',
  'directional',
  'usable',
];

export function positiveFormattedCount(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll(',', '');
  if (!/^\d+$/.test(normalized)) return null;
  const count = Number(normalized);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

export function positiveFormattedCountWithSuffix(value, suffix) {
  if (
    typeof value !== 'string' ||
    typeof suffix !== 'string' ||
    !value.trim().endsWith(suffix)
  ) {
    return null;
  }
  return positiveFormattedCount(
    value.trim().slice(0, -suffix.length).trim(),
  );
}

function browserErrorCategory(message, stack = '') {
  const value = `${String(message ?? '')}\n${String(stack ?? '')}`;
  if (/resizeobserver/i.test(value)) return 'resize_observer';
  if (/hydration|hydrating|server rendered html/i.test(value)) {
    return 'react_hydration';
  }
  if (/chunkloaderror|loading chunk|failed to fetch dynamically imported/i.test(value)) {
    return 'chunk_load';
  }
  if (/leaflet|map container|removelayer/i.test(value)) return 'map_runtime';
  if (/webgl|canvas|three(?:\\.module)?/i.test(value)) return 'viewer_runtime';
  if (/networkerror|failed to fetch|load failed/i.test(value)) {
    return 'network_runtime';
  }
  return 'unclassified';
}

function browserErrorShape(message) {
  const value = String(message ?? '');
  if (/cannot read propert(?:y|ies).*reading/i.test(value)) {
    return 'property_read';
  }
  if (/cannot set propert(?:y|ies)|assignment to/i.test(value)) {
    return 'property_write';
  }
  if (/is not a function/i.test(value)) return 'not_callable';
  if (/is not defined/i.test(value)) return 'not_defined';
  if (/failed to execute/i.test(value)) return 'dom_operation';
  if (/network|fetch|load/i.test(value)) return 'resource_load';
  if (/abort/i.test(value)) return 'aborted';
  return 'other';
}

function browserRuntimeSource(message, stack) {
  const value = `${String(message ?? '')}\n${String(stack ?? '')}`;
  if (/leaflet|markercluster|supercluster/i.test(value)) return 'map';
  if (/three(?:\.module)?|webgl|canvas/i.test(value)) return 'viewer';
  if (/better-auth|neon|firebase|auth\/token/i.test(value)) return 'auth';
  if (/react-dom|react-server|next\/dist|_next\/static/i.test(value)) {
    return 'framework';
  }
  return 'unknown';
}

function browserExceptionType(value) {
  const normalized = String(value ?? '');
  return [
    'DOMException',
    'Error',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
  ].includes(normalized)
    ? normalized
    : 'Other';
}

function browserCheckpoint(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9_-]{1,48}$/.test(normalized)
    ? normalized
    : 'unknown';
}

export function summarizeBrowserErrors(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(0, 3).map((entry) => {
    const structured =
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? entry
        : {};
    const rawMessage =
      typeof entry === 'string' ? entry : String(structured.message ?? '');
    const stack = String(structured.stack ?? '');
    const normalized = rawMessage
      .replace(/^\[mobile\]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      surface:
        structured.surface === 'mobile' ||
        /^\[mobile\]/i.test(rawMessage)
          ? 'mobile'
          : 'desktop',
      category: browserErrorCategory(normalized, stack),
      exception_type: browserExceptionType(structured.name),
      message_shape: browserErrorShape(normalized),
      runtime_source: browserRuntimeSource(normalized, stack),
      checkpoint: browserCheckpoint(structured.checkpoint),
      fingerprint: createHash('sha256')
        .update(normalized)
        .digest('hex')
        .slice(0, 12),
    };
  });
}

export function encryptBrowserDiagnostics(entries, publicKeyBase64) {
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    typeof publicKeyBase64 !== 'string' ||
    publicKeyBase64.trim().length === 0
  ) {
    return null;
  }

  const schema = 'citylens/encrypted-browser-diagnostic@v1';
  const payload = Buffer.from(
    JSON.stringify({
      schema,
      errors: entries.slice(0, 3).map((entry) => ({
        surface: entry?.surface === 'mobile' ? 'mobile' : 'desktop',
        checkpoint: browserCheckpoint(entry?.checkpoint),
        name: String(entry?.name ?? ''),
        message: String(entry?.message ?? ''),
        stack: String(entry?.stack ?? ''),
      })),
    }),
    'utf8',
  );
  const publicKey = createPublicKey({
    key: Buffer.from(publicKeyBase64.trim(), 'base64'),
    format: 'der',
    type: 'spki',
  });
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(schema, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(payload),
    cipher.final(),
  ]);

  return {
    schema,
    algorithm: 'RSA-OAEP-256+A256GCM',
    error_count: Math.min(entries.length, 3),
    encrypted_key: publicEncrypt(
      {
        key: publicKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      key,
    ).toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function parseCsvRecords(value) {
  if (typeof value !== 'string' || value.length === 0) return [];
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (character === '\r' && value[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export function summarizeParcelCsv(value) {
  const records = parseCsvRecords(value);
  const header = records[0] ?? [];
  const rows = records.slice(1);
  const bblIndex = header.indexOf('BBL');
  const bbls =
    bblIndex < 0
      ? []
      : rows
          .map((row) => row[bblIndex])
          .filter((bbl) => typeof bbl === 'string' && /^\d{10}$/.test(bbl));
  return {
    row_count: rows.length,
    unique_bbl_count: new Set(bbls).size,
    bbl_column_present: bblIndex >= 0,
    column_count: header.length,
    consistent_column_count:
      header.length > 0 &&
      rows.every((row) => row.length === header.length),
  };
}

export function summarizeProductEvent(status, payload) {
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const payloadKeys = Object.keys(record).sort();
  const valueMinimized =
    status === 204 &&
    payloadKeys.length === PRODUCT_EVENT_KEYS.length &&
    payloadKeys.every((key, index) => key === PRODUCT_EVENT_KEYS[index]) &&
    record.schema_version === 'citylens/parcel-product-event@v1' &&
    record.event === 'thesis_composer_applied' &&
    record.source === 'thesis_composer';

  return {
    status,
    event:
      typeof record.event === 'string' ? record.event : null,
    source:
      typeof record.source === 'string' ? record.source : null,
    payload_keys: payloadKeys,
    value_minimized: valueMinimized,
  };
}

export function summarizeRunListResponse(status, payload) {
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const items = Array.isArray(record.items) ? record.items : [];
  const nextCursor = record.next_cursor;
  const shapeValid =
    Array.isArray(record.items) &&
    items.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item),
    ) &&
    (nextCursor === null || typeof nextCursor === 'string');
  const statusCounts = {
    failed: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    unknown: 0,
  };

  for (const item of items) {
    const runStatus =
      item && typeof item === 'object'
        ? String(item.status ?? '').toLowerCase()
        : '';
    if (RUN_STATUS_KEYS.includes(runStatus) && runStatus !== 'unknown') {
      statusCounts[runStatus] += 1;
    } else {
      statusCounts.unknown += 1;
    }
  }

  const receipt = {
    status,
    shape_valid: shapeValid,
    item_count: items.length,
    next_cursor_present:
      typeof nextCursor === 'string' && nextCursor.length > 0,
    status_counts: statusCounts,
    value_minimized: false,
  };
  const receiptKeys = Object.keys(receipt).sort();
  const statusKeys = Object.keys(statusCounts).sort();
  receipt.value_minimized =
    receiptKeys.length === RUN_LIST_RECEIPT_KEYS.length &&
    receiptKeys.every(
      (key, index) => key === RUN_LIST_RECEIPT_KEYS[index],
    ) &&
    statusKeys.length === RUN_STATUS_KEYS.length &&
    statusKeys.every((key, index) => key === RUN_STATUS_KEYS[index]);

  return receipt;
}

export function summarizeWorkflowAnalyticsResponse(status, payload) {
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const totalRecords = record.total_records;
  const activeRecords = record.active_records;
  const archivedRecords = record.archived_records;
  const eventHistoryRecords = record.event_history_records;
  const validSavedAtRecords = record.valid_saved_at_records;
  const minimumRateDenominator = record.minimum_rate_denominator;
  const maturityWindows = Array.isArray(record.maturity_windows)
    ? record.maturity_windows
    : [];
  const cohorts = Array.isArray(record.cohorts) ? record.cohorts : [];
  const funnel =
    record.funnel &&
    typeof record.funnel === 'object' &&
    !Array.isArray(record.funnel)
      ? record.funnel
      : {};
  const measurementStatus = WORKFLOW_MEASUREMENT_STATES.includes(
    record.measurement_status,
  )
    ? record.measurement_status
    : null;
  const nonnegativeInteger = (value) =>
    Number.isSafeInteger(value) && value >= 0;
  const positiveInteger = (value) =>
    Number.isSafeInteger(value) && value > 0;
  const rateIsValid = (value) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1;
  const confidenceIntervalIsValid = (value) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.confidence_level === 0.95 &&
    rateIsValid(value.lower) &&
    rateIsValid(value.upper) &&
    value.lower <= value.upper;
  const estimateIsMaturitySafe = (
    denominator,
    rate,
    confidenceInterval,
    sufficientDenominator,
  ) => {
    if (!nonnegativeInteger(denominator)) return false;
    const sufficient = denominator >= minimumRateDenominator;
    if (
      typeof sufficientDenominator === 'boolean' &&
      sufficientDenominator !== sufficient
    ) {
      return false;
    }
    return sufficient
      ? rateIsValid(rate) &&
          confidenceIntervalIsValid(confidenceInterval)
      : rate === null && confidenceInterval === null;
  };
  const funnelBoundarySafe = [
    'contacted_per_saved',
    'qualified_per_contacted',
    'offer_per_qualified',
    'contract_per_offer',
    'close_per_contract',
  ].every((key) => {
    const estimate = funnel[key];
    return (
      estimate &&
      typeof estimate === 'object' &&
      !Array.isArray(estimate) &&
      nonnegativeInteger(estimate.numerator) &&
      estimate.numerator <= estimate.denominator &&
      estimateIsMaturitySafe(
        estimate.denominator,
        estimate.rate,
        estimate.confidence_interval,
        estimate.sufficient_denominator,
      )
    );
  });
  const cohortBoundarySafe = cohorts.every((cohort) => {
    if (!cohort || typeof cohort !== 'object' || Array.isArray(cohort)) {
      return false;
    }
    return [
      [
        cohort.contacted_rate_denominator,
        cohort.contacted_rate,
        cohort.contacted_confidence_interval,
      ],
      [
        cohort.qualified_rate_denominator,
        cohort.qualified_rate,
        cohort.qualified_confidence_interval,
      ],
      [
        cohort.close_rate_denominator,
        cohort.close_rate,
        cohort.close_confidence_interval,
      ],
    ].every(([denominator, rate, confidenceInterval]) =>
      estimateIsMaturitySafe(
        denominator,
        rate,
        confidenceInterval,
        undefined,
      ),
    );
  });

  const maturityWindowBoundarySafe =
    Array.isArray(record.maturity_windows) &&
    maturityWindows.every((window) => {
      if (!window || typeof window !== 'object' || Array.isArray(window)) {
        return false;
      }
      if (
        !nonnegativeInteger(window.eligible_records) ||
        !nonnegativeInteger(window.reached_within_horizon) ||
        !nonnegativeInteger(window.pending_records) ||
        window.reached_within_horizon > window.eligible_records
      ) {
        return false;
      }
      if (window.sufficient_denominator === true) {
        return (
          window.eligible_records >= minimumRateDenominator &&
          rateIsValid(window.rate) &&
          confidenceIntervalIsValid(window.confidence_interval)
        );
      }
      return (
        window.sufficient_denominator === false &&
        window.rate === null &&
        window.confidence_interval === null
      );
    });
  const maturityBoundarySafe =
    funnelBoundarySafe &&
    cohortBoundarySafe &&
    maturityWindowBoundarySafe;
  const schemaVersionValid =
    record.schema_version === 'citylens/parcel-workflow-analytics@v3';
  const shapeValid =
    status === 200 &&
    schemaVersionValid &&
    measurementStatus !== null &&
    typeof record.measurement_label === 'string' &&
    record.measurement_label.trim().length > 0 &&
    nonnegativeInteger(totalRecords) &&
    nonnegativeInteger(activeRecords) &&
    nonnegativeInteger(archivedRecords) &&
    activeRecords + archivedRecords === totalRecords &&
    nonnegativeInteger(eventHistoryRecords) &&
    eventHistoryRecords <= totalRecords &&
    nonnegativeInteger(validSavedAtRecords) &&
    validSavedAtRecords <= totalRecords &&
    positiveInteger(record.minimum_cohort_size) &&
    positiveInteger(minimumRateDenominator) &&
    Array.isArray(record.cohorts) &&
    Array.isArray(record.warnings) &&
    maturityBoundarySafe;
  const receipt = {
    status,
    schema_version_valid: schemaVersionValid,
    shape_valid: shapeValid,
    cohort_state:
      nonnegativeInteger(totalRecords) && totalRecords === 0
        ? 'empty'
        : measurementStatus,
    has_saved_leads:
      nonnegativeInteger(totalRecords) ? totalRecords > 0 : null,
    maturity_boundary_safe: maturityBoundarySafe,
    value_minimized: false,
  };
  const receiptKeys = Object.keys(receipt).sort();
  receipt.value_minimized =
    receiptKeys.length === WORKFLOW_ANALYTICS_RECEIPT_KEYS.length &&
    receiptKeys.every(
      (key, index) => key === WORKFLOW_ANALYTICS_RECEIPT_KEYS[index],
    );

  return receipt;
}
import {
  constants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
