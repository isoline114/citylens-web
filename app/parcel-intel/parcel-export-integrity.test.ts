import { describe, expect, it } from 'vitest';
import { checkParcelExportIntegrity } from './parcel-export-integrity';

const generatedAt = '2026-07-27T09:55:59.858344Z';

describe('checkParcelExportIntegrity', () => {
  it('accepts one exact generation and the exact visible BBL set', () => {
    expect(
      checkParcelExportIntegrity({
        loadedGeneratedAt: generatedAt,
        sweepGeneratedAt: [generatedAt, generatedAt],
        expectedBbls: ['1000000001', '3000000002'],
        exportRows: [{ bbl: '3000000002' }, { bbl: '1000000001' }],
      }),
    ).toEqual({
      ok: true,
      generatedAt,
      rowCount: 2,
      uniqueBblCount: 2,
    });
  });

  it.each([
    {
      reason: 'generation_missing',
      loadedGeneratedAt: null,
      sweepGeneratedAt: [generatedAt],
    },
    {
      reason: 'generation_missing',
      loadedGeneratedAt: generatedAt,
      sweepGeneratedAt: [null],
    },
    {
      reason: 'mixed_generation',
      loadedGeneratedAt: generatedAt,
      sweepGeneratedAt: [generatedAt, '2026-07-28T00:00:00Z'],
    },
    {
      reason: 'generation_changed',
      loadedGeneratedAt: generatedAt,
      sweepGeneratedAt: ['2026-07-28T00:00:00Z'],
    },
  ] as const)(
    'fails closed for $reason generation receipts',
    ({ reason, loadedGeneratedAt, sweepGeneratedAt }) => {
      expect(
        checkParcelExportIntegrity({
          loadedGeneratedAt,
          sweepGeneratedAt: [...sweepGeneratedAt],
          expectedBbls: ['1000000001'],
          exportRows: [{ bbl: '1000000001' }],
        }),
      ).toEqual({ ok: false, reason });
    },
  );

  it('rejects duplicate output and any changed visible scope', () => {
    expect(
      checkParcelExportIntegrity({
        loadedGeneratedAt: generatedAt,
        sweepGeneratedAt: [generatedAt],
        expectedBbls: ['1000000001'],
        exportRows: [{ bbl: '1000000001' }, { bbl: '1000000001' }],
      }),
    ).toEqual({ ok: false, reason: 'duplicate_bbl' });
    expect(
      checkParcelExportIntegrity({
        loadedGeneratedAt: generatedAt,
        sweepGeneratedAt: [generatedAt],
        expectedBbls: ['1000000001'],
        exportRows: [{ bbl: '3000000002' }],
      }),
    ).toEqual({ ok: false, reason: 'scope_mismatch' });
  });
});
