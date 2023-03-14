import { describe, expect, it } from 'vitest';

import {
  positiveFormattedCount,
  positiveFormattedCountWithSuffix,
  summarizeParcelCsv,
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

  it('summarizes an RFC 4180 parcel export without retaining identities', () => {
    expect(
      summarizeParcelCsv(
        [
          'Address,BBL,Owner',
          '"12 Example Ave, Unit 2",1000000001,"Owner ""One"""',
          '"14 Example Ave\nRear",3000000002,Owner Two',
        ].join('\r\n'),
      ),
    ).toEqual({
      row_count: 2,
      unique_bbl_count: 2,
      bbl_column_present: true,
      column_count: 3,
      consistent_column_count: true,
    });
  });

  it('rejects malformed or identity-incomplete parcel exports', () => {
    expect(
      summarizeParcelCsv('Address,Owner\nOne,Owner One,Unexpected'),
    ).toEqual({
      row_count: 1,
      unique_bbl_count: 0,
      bbl_column_present: false,
      column_count: 2,
      consistent_column_count: false,
    });
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
