import { describe, expect, it } from 'vitest';

import {
  positiveFormattedCount,
  positiveFormattedCountWithSuffix,
  summarizeProductEvent,
} from './production-auth-smoke-support.mjs';

describe('production authenticated smoke support', () => {
  it('accepts only a positive formatted match count', () => {
    expect(positiveFormattedCount('1,234')).toBe(1234);
    expect(positiveFormattedCount(' 9 ')).toBe(9);
    expect(positiveFormattedCount('0')).toBeNull();
    expect(positiveFormattedCount('—')).toBeNull();
    expect(positiveFormattedCount('12 leads')).toBeNull();
  });

  it('parses only the expected map-status suffix', () => {
    expect(
      positiveFormattedCountWithSuffix('5,000 matches', 'matches'),
    ).toBe(5000);
    expect(
      positiveFormattedCountWithSuffix('5,000 in view', 'in view'),
    ).toBe(5000);
    expect(
      positiveFormattedCountWithSuffix('5,000 mapped parcels', 'matches'),
    ).toBeNull();
    expect(
      positiveFormattedCountWithSuffix('0 matches', 'matches'),
    ).toBeNull();
  });

  it('summarizes the exact value-minimized composer event', () => {
    expect(
      summarizeProductEvent(204, {
        source: 'thesis_composer',
        schema_version: 'citylens/parcel-product-event@v1',
        event: 'thesis_composer_applied',
      }),
    ).toEqual({
      status: 204,
      event: 'thesis_composer_applied',
      source: 'thesis_composer',
      payload_keys: ['event', 'schema_version', 'source'],
      value_minimized: true,
    });
  });

  it('rejects prompt-bearing or otherwise expanded event payloads', () => {
    expect(
      summarizeProductEvent(204, {
        schema_version: 'citylens/parcel-product-event@v1',
        event: 'thesis_composer_applied',
        source: 'thesis_composer',
        prompt: 'private acquisition intent',
      }).value_minimized,
    ).toBe(false);
    expect(
      summarizeProductEvent(200, {
        schema_version: 'citylens/parcel-product-event@v1',
        event: 'thesis_composer_applied',
        source: 'thesis_composer',
      }).value_minimized,
    ).toBe(false);
  });
});
