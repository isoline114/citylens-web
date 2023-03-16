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
