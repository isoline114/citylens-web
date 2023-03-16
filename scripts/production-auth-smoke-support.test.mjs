import { describe, expect, it } from 'vitest';

import {
  positiveFormattedCount,
  positiveFormattedCountWithSuffix,
  summarizeParcelCsv,
  summarizeBrowserErrors,
  summarizeProductEvent,
  summarizeRunListResponse,
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

  it('classifies browser errors without retaining message values', () => {
    const receipt = summarizeBrowserErrors([
      '[mobile] ResizeObserver loop completed with undelivered notifications.',
      'ChunkLoadError: Loading chunk 123 failed at https://private.example/path',
    ]);

    expect(receipt).toEqual([
      {
        surface: 'mobile',
        category: 'resize_observer',
        fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/),
      },
      {
        surface: 'desktop',
        category: 'chunk_load',
        fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/),
      },
    ]);
    expect(JSON.stringify(receipt)).not.toMatch(
      /private|example|resizeobserver|loading chunk/i,
    );
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

  it('summarizes run history without retaining customer identities or values', () => {
    const receipt = summarizeRunListResponse(200, {
      items: [
        {
          run_id: 'private-run-123',
          address: '12 Private Street',
          status: 'succeeded',
          error: { message: 'private backend detail' },
          artifacts: [{ url: 'https://storage.example/private-object' }],
        },
        {
          run_id: 'private-run-456',
          address: '14 Private Street',
          status: 'running',
        },
        {
          run_id: 'private-run-789',
          status: 'future-state',
        },
      ],
      next_cursor: 'private-cursor-value',
    });

    expect(receipt).toEqual({
      status: 200,
      shape_valid: true,
      item_count: 3,
      next_cursor_present: true,
      status_counts: {
        failed: 0,
        queued: 0,
        running: 1,
        succeeded: 1,
        unknown: 1,
      },
      value_minimized: true,
    });
    expect(JSON.stringify(receipt)).not.toMatch(
      /private|street|storage|cursor-value|backend/i,
    );
  });

  it('rejects malformed run-list shapes while keeping the receipt value-minimized', () => {
    expect(
      summarizeRunListResponse(502, {
        items: 'not-an-array',
        next_cursor: { private: true },
      }),
    ).toEqual({
      status: 502,
      shape_valid: false,
      item_count: 0,
      next_cursor_present: false,
      status_counts: {
        failed: 0,
        queued: 0,
        running: 0,
        succeeded: 0,
        unknown: 0,
      },
      value_minimized: true,
    });
  });
});
