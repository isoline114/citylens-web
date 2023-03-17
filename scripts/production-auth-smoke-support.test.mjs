import { describe, expect, it } from 'vitest';
import {
  constants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
} from 'node:crypto';

import {
  encryptBrowserDiagnostics,
  positiveFormattedCount,
  positiveFormattedCountWithSuffix,
  summarizeParcelCsv,
  summarizeBrowserErrors,
  summarizeProductEvent,
  summarizeRunListResponse,
  summarizeWorkflowAnalyticsResponse,
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
        exception_type: 'Other',
        message_shape: 'other',
        runtime_source: 'unknown',
        checkpoint: 'unknown',
        fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/),
      },
      {
        surface: 'desktop',
        category: 'chunk_load',
        exception_type: 'Other',
        message_shape: 'resource_load',
        runtime_source: 'unknown',
        checkpoint: 'unknown',
        fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/),
      },
    ]);
    expect(JSON.stringify(receipt)).not.toMatch(
      /private|example|resizeobserver|loading chunk/i,
    );
  });

  it('classifies structured page errors without retaining messages or stacks', () => {
    const receipt = summarizeBrowserErrors([
      {
        surface: 'desktop',
        name: 'TypeError',
        message:
          "Cannot read properties of undefined (reading 'privateValue')",
        stack:
          'TypeError at privateFunction (https://citylens.dev/_next/static/chunks/private.js:1:2)',
        checkpoint: 'run_history_navigation',
      },
    ]);

    expect(receipt).toEqual([
      {
        surface: 'desktop',
        category: 'unclassified',
        exception_type: 'TypeError',
        message_shape: 'property_read',
        runtime_source: 'framework',
        checkpoint: 'run_history_navigation',
        fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/),
      },
    ]);
    expect(JSON.stringify(receipt)).not.toMatch(
      /privatevalue|privatefunction|private\\.js/i,
    );
  });

  it('encrypts opt-in diagnostics without retaining plaintext in the envelope', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const publicKeyBase64 = publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64');
    const envelope = encryptBrowserDiagnostics(
      [
        {
          surface: 'desktop',
          checkpoint: 'parcel_workspace',
          name: 'Error',
          message: 'private diagnostic sentinel',
          stack: 'private stack sentinel',
        },
      ],
      publicKeyBase64,
    );

    expect(envelope).toMatchObject({
      schema: 'citylens/encrypted-browser-diagnostic@v1',
      algorithm: 'RSA-OAEP-256+A256GCM',
      error_count: 1,
    });
    expect(JSON.stringify(envelope)).not.toMatch(/private|sentinel|stack/i);

    const key = privateDecrypt(
      {
        key: privateKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(envelope.encrypted_key, 'base64'),
    );
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(envelope.schema, 'utf8'));
    decipher.setAuthTag(Buffer.from(envelope.auth_tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    expect(JSON.parse(plaintext)).toEqual({
      schema: 'citylens/encrypted-browser-diagnostic@v1',
      errors: [
        {
          surface: 'desktop',
          checkpoint: 'parcel_workspace',
          name: 'Error',
          message: 'private diagnostic sentinel',
          stack: 'private stack sentinel',
        },
      ],
    });
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

  it('summarizes maturity-safe workflow analytics without retaining private values', () => {
    const receipt = summarizeWorkflowAnalyticsResponse(200, {
      schema_version: 'citylens/parcel-workflow-analytics@v3',
      generated_at: '2026-07-29T12:00:00Z',
      measurement_status: 'collecting',
      measurement_label: 'Collecting observation time',
      total_records: 3,
      active_records: 2,
      archived_records: 1,
      event_history_records: 3,
      valid_saved_at_records: 3,
      minimum_cohort_size: 30,
      minimum_rate_denominator: 10,
      funnel: {
        contacted_per_saved: {
          numerator: 1,
          denominator: 3,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        qualified_per_contacted: {
          numerator: 0,
          denominator: 1,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        offer_per_qualified: {
          numerator: 0,
          denominator: 0,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        contract_per_offer: {
          numerator: 0,
          denominator: 0,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
        close_per_contract: {
          numerator: 0,
          denominator: 0,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
      },
      maturity_windows: [
        {
          milestone: 'owner_contacted',
          eligible_records: 0,
          reached_within_horizon: 0,
          pending_records: 3,
          rate: null,
          confidence_interval: null,
          sufficient_denominator: false,
        },
      ],
      cohorts: [
        {
          value: 'private rank cohort',
          contacted_rate_denominator: 0,
          contacted_rate: null,
          contacted_confidence_interval: null,
          qualified_rate_denominator: 0,
          qualified_rate: null,
          qualified_confidence_interval: null,
          close_rate_denominator: 0,
          close_rate: null,
          close_confidence_interval: null,
        },
      ],
      warnings: ['private workflow warning'],
      private_workflow_rows: [
        {
          bbl: '3000000001',
          address: 'Private workflow address',
          assignee: 'Private person',
        },
      ],
    });

    expect(receipt).toEqual({
      status: 200,
      schema_version_valid: true,
      shape_valid: true,
      cohort_state: 'collecting',
      has_saved_leads: true,
      maturity_boundary_safe: true,
      value_minimized: true,
    });
    expect(JSON.stringify(receipt)).not.toMatch(
      /private|address|assignee|3000000001|rank cohort/i,
    );
  });

  it('rejects premature workflow rates and malformed aggregate totals', () => {
    expect(
      summarizeWorkflowAnalyticsResponse(200, {
        schema_version: 'citylens/parcel-workflow-analytics@v3',
        measurement_status: 'usable',
        measurement_label: 'Usable evidence',
        total_records: 8,
        active_records: 8,
        archived_records: 1,
        event_history_records: 9,
        valid_saved_at_records: 8,
        minimum_cohort_size: 30,
        minimum_rate_denominator: 10,
        funnel: {
          contacted_per_saved: {
            numerator: 1,
            denominator: 8,
            rate: 0.125,
            confidence_interval: {
              confidence_level: 0.95,
              lower: 0.02,
              upper: 0.47,
            },
            sufficient_denominator: false,
          },
          qualified_per_contacted: {
            numerator: 0,
            denominator: 1,
            rate: null,
            confidence_interval: null,
            sufficient_denominator: false,
          },
          offer_per_qualified: {
            numerator: 0,
            denominator: 0,
            rate: null,
            confidence_interval: null,
            sufficient_denominator: false,
          },
          contract_per_offer: {
            numerator: 0,
            denominator: 0,
            rate: null,
            confidence_interval: null,
            sufficient_denominator: false,
          },
          close_per_contract: {
            numerator: 0,
            denominator: 0,
            rate: null,
            confidence_interval: null,
            sufficient_denominator: false,
          },
        },
        maturity_windows: [
          {
            eligible_records: 4,
            reached_within_horizon: 2,
            pending_records: 4,
            rate: 0.5,
            confidence_interval: {
              confidence_level: 0.95,
              lower: 0.15,
              upper: 0.85,
            },
            sufficient_denominator: true,
          },
        ],
        cohorts: [],
        warnings: [],
      }),
    ).toEqual({
      status: 200,
      schema_version_valid: true,
      shape_valid: false,
      cohort_state: 'usable',
      has_saved_leads: true,
      maturity_boundary_safe: false,
      value_minimized: true,
    });
  });
});
