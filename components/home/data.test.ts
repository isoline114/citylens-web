import { describe, expect, it } from 'vitest';
import type { ParcelIntelIndex } from '@/lib/api';
import { receipts } from './data';
describe('homepage source receipt', () => {
  it('recomputes age from retrieval dates at request time', () => {
    const index = { data_sources: { dob: { source: 'DOB', retrieved_at: '2026-10-01', age_days: 1, max_age_days: 8, stale: false } } } as unknown as ParcelIntelIndex;
    expect(receipts(index, Date.parse('2026-10-19'))[0]).toMatchObject({ ageDays: 18, status: 'Past limit' });
  });
  it('keeps missing freshness unchecked and imagery without an age not applicable', () => {
    const index = { data_sources: { unknown: {}, imagery: { freshness_status: 'not_applicable' } } } as unknown as ParcelIntelIndex;
    expect(receipts(index, Date.now()).map(row => row.status)).toEqual(['Unchecked', 'Not applicable']);
    expect(receipts(null, Date.now())).toEqual([]);
  });
});
