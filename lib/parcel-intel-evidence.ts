export function normalizePerformanceScope(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value
    .replace(
      /validated rolling procedure:\s*latest untouched test/i,
      'Historical rolling benchmark',
    )
    .replace(/latest untouched test:/i, 'historical rolling benchmark:');
}

export function historicalBenchmarkCopy({
  precisionAt100,
  precisionAt1000,
  baseRate,
  evidenceStatus,
}: {
  precisionAt100: number | null;
  precisionAt1000: number | null;
  baseRate: number | null;
  evidenceStatus: string;
}): string {
  if (precisionAt100 === null || precisionAt1000 === null) {
    return (
      'Historical benchmark hit rates are unavailable for this feed. Treat ' +
      'the rank as a screening order, not a conversion probability.'
    );
  }
  const baseRateCopy =
    baseRate === null
      ? ''
      : `, versus a ${(baseRate * 100).toFixed(
          3,
        )}% eligible-population base rate`;
  const evidenceCopy =
    evidenceStatus === 'unexposed'
      ? 'The versioned benchmark ledger marks this evidence as reserved and unexposed.'
      : 'These outcomes have been inspected during model development and are not an independent current-accuracy estimate.';
  return (
    `In the historical 2024→2025 benchmark, ${(
      precisionAt100 * 100
    ).toFixed(0)}% of the top 100 and ${(precisionAt1000 * 100).toFixed(
      1,
    )}% of the top 1,000 received a DOB new-building filing within one year` +
    `${baseRateCopy}. ${evidenceCopy} This measures filing hazard—not seller ` +
    'intent, acquisition, or closing probability.'
  );
}
