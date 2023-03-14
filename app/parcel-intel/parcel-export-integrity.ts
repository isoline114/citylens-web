export type ParcelExportIntegrityFailure =
  | 'generation_missing'
  | 'mixed_generation'
  | 'generation_changed'
  | 'duplicate_bbl'
  | 'scope_mismatch';

export type ParcelExportIntegrityResult =
  | {
      ok: true;
      generatedAt: string;
      rowCount: number;
      uniqueBblCount: number;
    }
  | {
      ok: false;
      reason: ParcelExportIntegrityFailure;
    };

type Input = {
  loadedGeneratedAt: string | null;
  sweepGeneratedAt: Array<string | null>;
  expectedBbls: string[];
  exportRows: Array<{ bbl: string }>;
};

/**
 * Bind a browser export to the exact map snapshot and visible decision scope.
 *
 * The API sweep is intentionally fetched at export time, so publication can
 * advance between initial map load and download. Never emit a plausible but
 * mixed-generation file: require one verified generation and the exact BBL
 * set the user saw before creating the CSV.
 */
export function checkParcelExportIntegrity({
  loadedGeneratedAt,
  sweepGeneratedAt,
  expectedBbls,
  exportRows,
}: Input): ParcelExportIntegrityResult {
  if (
    !loadedGeneratedAt ||
    sweepGeneratedAt.length === 0 ||
    sweepGeneratedAt.some((value) => !value)
  ) {
    return { ok: false, reason: 'generation_missing' };
  }

  const generations = new Set(sweepGeneratedAt as string[]);
  if (generations.size !== 1) {
    return { ok: false, reason: 'mixed_generation' };
  }
  const [exportGeneratedAt] = generations;
  if (exportGeneratedAt !== loadedGeneratedAt) {
    return { ok: false, reason: 'generation_changed' };
  }

  const exportedBbls = exportRows.map((row) => row.bbl);
  const exportedSet = new Set(exportedBbls);
  if (exportedSet.size !== exportedBbls.length) {
    return { ok: false, reason: 'duplicate_bbl' };
  }
  const expectedSet = new Set(expectedBbls);
  if (
    expectedSet.size !== expectedBbls.length ||
    expectedSet.size !== exportedSet.size ||
    [...expectedSet].some((bbl) => !exportedSet.has(bbl))
  ) {
    return { ok: false, reason: 'scope_mismatch' };
  }

  return {
    ok: true,
    generatedAt: exportGeneratedAt,
    rowCount: exportRows.length,
    uniqueBblCount: exportedSet.size,
  };
}
