import { describe, expect, it } from 'vitest';
import {
  historicalBenchmarkCopy,
  normalizePerformanceScope,
} from './parcel-intel-evidence';

describe('parcel intelligence evaluation evidence', () => {
  it('downgrades legacy untouched-test language before rendering it', () => {
    expect(
      normalizePerformanceScope(
        'Rolling origin: PLUTO 2018/2020/2022 training; latest untouched test: 2024 features → 2025 DOB NB filings',
      ),
    ).toBe(
      'Rolling origin: PLUTO 2018/2020/2022 training; historical rolling benchmark: 2024 features → 2025 DOB NB filings',
    );
  });

  it('describes exposed historical outcomes without calling them current accuracy', () => {
    const copy = historicalBenchmarkCopy({
      precisionAt100: 0.34,
      precisionAt1000: 0.104,
      baseRate: 0.001243959,
      evidenceStatus: 'development_exposed',
    });

    expect(copy).toContain('34% of the top 100');
    expect(copy).toContain('10.4% of the top 1,000');
    expect(copy).toContain('inspected during model development');
    expect(copy).toContain('not an independent current-accuracy estimate');
    expect(copy).not.toContain('untouched');
  });

  it('fails conservatively when benchmark metrics are unavailable', () => {
    expect(
      historicalBenchmarkCopy({
        precisionAt100: null,
        precisionAt1000: null,
        baseRate: null,
        evidenceStatus: 'unclassified',
      }),
    ).toContain('screening order, not a conversion probability');
  });
});
