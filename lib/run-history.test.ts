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

  it('filters demo run ids out of the local-only pool', () => {
    // Regression: rememberRecentRun used to fire on every demo-detail
    // load, putting demo run ids into localStorage. The signed-in /runs
    // view then merged those local-only ids back in as `source: local`
    // rows. Passing the known demo set must drop them.
    const rows = mergeRunHistory(
      [{ run_id: 'server-1', status: 'succeeded', stage: 'done' }],
      [
        { runId: 'demo-1', createdAtMs: 1, lastKnownStatus: 'succeeded' },
        { runId: 'local-1', createdAtMs: 2, lastKnownStatus: 'queued' },
      ],
      { demoRunIds: ['demo-1'] },
    );

    expect(rows.map((r) => r.runId)).toEqual(['server-1', 'local-1']);
    // Non-demo recent runs are preserved.
    expect(rows.find((r) => r.runId === 'local-1')?.source).toBe('local');
    // The demo entry must not appear under any source.
    expect(rows.find((r) => r.runId === 'demo-1')).toBeUndefined();
  });

  it('does not affect server rows even if a server run id is in the demo set', () => {
    // Defensive: the demo-id filter only acts on the local pool. If a
    // server-side row ever shares an id with a demo run (unlikely but
    // possible during seeding), the server row must still render.
    const rows = mergeRunHistory(
      [{ run_id: 'demo-1', status: 'succeeded', stage: 'done' }],
      [{ runId: 'demo-1', createdAtMs: 1, lastKnownStatus: 'succeeded' }],
      { demoRunIds: ['demo-1'] },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe('server');
  });
});
