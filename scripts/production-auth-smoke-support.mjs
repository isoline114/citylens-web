const PRODUCT_EVENT_KEYS = [
  'event',
  'schema_version',
  'source',
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
