import { beforeEach, describe, expect, it } from 'vitest';

import { consumeRunPrefill, queueRunPrefill } from './run-prefill';

const NOW = 1_785_600_000_000;

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('parcel run prefill', () => {
  it('carries a valid parcel into the run workspace exactly once', () => {
    expect(
      queueRunPrefill(
        { address: ' 224 Clarkson Avenue ', bbl: '3050660023' },
        NOW,
      ),
    ).toBe(true);

    expect(consumeRunPrefill(NOW + 1_000)).toEqual({
      address: '224 Clarkson Avenue',
      bbl: '3050660023',
      source: 'parcel_intel',
      createdAtMs: NOW,
    });
    expect(consumeRunPrefill(NOW + 1_001)).toBeNull();
  });

  it('rejects addresses without a street number and malformed BBLs', () => {
    expect(
      queueRunPrefill({ address: 'Taylor Street', bbl: '3050660023' }, NOW),
    ).toBe(false);
    expect(
      queueRunPrefill({ address: '224 Clarkson Avenue', bbl: 'bad' }, NOW),
    ).toBe(false);
    expect(consumeRunPrefill(NOW)).toBeNull();
  });

  it('drops expired and malformed session records safely', () => {
    expect(
      queueRunPrefill(
        { address: '224 Clarkson Avenue', bbl: '3050660023' },
        NOW,
      ),
    ).toBe(true);
    expect(consumeRunPrefill(NOW + 31 * 60 * 1_000)).toBeNull();

    window.sessionStorage.setItem('citylens_run_prefill_v1', '{bad json');
    expect(consumeRunPrefill(NOW)).toBeNull();
  });
});
