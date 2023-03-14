import { describe, expect, it } from 'vitest';

import {
  formatRunDateTime,
  hasPublishedArtifacts,
  humanizeRunValue,
  presentRunState,
  runAddress,
  shortRunId,
} from './run-presentation';

describe('run presentation', () => {
  it('turns backend states into concise customer-facing language', () => {
    expect(presentRunState('queued')).toMatchObject({
      state: 'queued',
      label: 'Queued',
    });
    expect(presentRunState('running')).toMatchObject({
      state: 'running',
      label: 'Processing',
    });
    expect(presentRunState('succeeded')).toMatchObject({
      state: 'succeeded',
      label: 'Ready',
    });
    expect(presentRunState('failed')).toMatchObject({
      state: 'failed',
      label: 'Needs attention',
    });
  });

  it('extracts the address and shortens only long identifiers', () => {
    expect(
      runAddress({ request: { address: ' 100 E 21st St, Brooklyn ' } }),
    ).toBe('100 E 21st St, Brooklyn');
    expect(shortRunId('run-123')).toBe('run-123');
    expect(shortRunId('01J4VQW3MJ6Y4E6YJ8Q1F6WZ10')).toBe(
      '01J4VQW3…F6WZ10',
    );
  });

  it('humanizes stages and formats valid timestamps', () => {
    expect(humanizeRunValue('baseline_refine')).toBe('Baseline Refine');
    expect(formatRunDateTime('2026-07-27T14:15:00Z')).toMatch(
      /Jul 27, 2026/,
    );
    expect(formatRunDateTime('not-a-date')).toBe('not-a-date');
  });

  it('detects array and keyed artifact collections', () => {
    expect(hasPublishedArtifacts(undefined)).toBe(false);
    expect(hasPublishedArtifacts({ artifacts: [] })).toBe(false);
    expect(
      hasPublishedArtifacts({
        artifacts: [{ name: 'preview.png', signed_url: '/preview.png' }],
      }),
    ).toBe(true);
    expect(
      hasPublishedArtifacts({
        artifacts: {
          preview: { name: 'preview.png', signed_url: '/preview.png' },
        },
      }),
    ).toBe(true);
  });
});
