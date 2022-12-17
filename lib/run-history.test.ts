import { describe, expect, it } from 'vitest';

import { normalizeServerRuns } from '@/lib/run-history';

describe('normalizeServerRuns', () => {
  it('maps server run records to history rows preserving status and stage', () => {
    const rows = normalizeServerRuns([
      { run_id: 'server-1', status: 'succeeded', stage: 'done' },
      { run_id: 'server-2', status: 'failed', stage: 'failed' },
    ]);

    expect(rows.map((r) => r.runId)).toEqual(['server-1', 'server-2']);
    expect(rows[0]?.status).toBe('succeeded');
    expect(rows[0]?.stage).toBe('done');
    expect(rows[1]?.status).toBe('failed');
  });

  it('drops entries with no usable id', () => {
    const rows = normalizeServerRuns([
      { run_id: '', status: 'succeeded' } as { run_id: string; status: string },
      { run_id: '   ', status: 'succeeded' } as { run_id: string; status: string },
      { run_id: 'good', status: 'succeeded' },
    ]);

    expect(rows.map((r) => r.runId)).toEqual(['good']);
  });
});
