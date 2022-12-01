import { describe, expect, it } from 'vitest';

import { mergeRunHistory } from '@/lib/run-history';

describe('run history helpers', () => {
  it('merges server and local rows without duplicating ids', () => {
    const rows = mergeRunHistory(
      [
        { run_id: 'server-1', status: 'succeeded', stage: 'done' },
        { run_id: 'shared', status: 'running', stage: 'segment' },
      ],
      [
        { runId: 'local-1', createdAtMs: 1, lastKnownStatus: 'queued' },
        { runId: 'shared', createdAtMs: 2, lastKnownStatus: 'failed' },
      ],
    );

    expect(rows.map((r) => r.runId)).toEqual(['server-1', 'shared', 'local-1']);
    expect(rows[0]?.source).toBe('server');
    expect(rows[2]?.source).toBe('local');
  });
});
