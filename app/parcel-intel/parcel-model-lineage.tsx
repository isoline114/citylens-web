import { Waypoints } from 'lucide-react';

type ParcelModelLineageProps = {
  trainingOrigins: number[];
  calibrationOrigin: number | null;
  benchmarkOutcomeWindow: string | null;
  inferenceSnapshot: string | null;
  selectionPolicySummary: string;
};

function years(value: number[]): string {
  return value.length > 0 ? value.join(' · ') : 'Unavailable';
}

function outcomeYear(value: string | null): string | null {
  const match = value?.match(/^(\d{4})(?:-\d{4})?$/);
  return match?.[1] ?? null;
}

export function ParcelModelLineage({
  trainingOrigins,
  calibrationOrigin,
  benchmarkOutcomeWindow,
  inferenceSnapshot,
  selectionPolicySummary,
}: ParcelModelLineageProps) {
  const outcome = outcomeYear(benchmarkOutcomeWindow);
  const complete =
    trainingOrigins.length > 0 &&
    calibrationOrigin !== null &&
    outcome !== null &&
    inferenceSnapshot === 'current';

  return (
    <section
      className="self-start border-b border-rule bg-white p-4 lg:col-span-2"
      data-testid="model-lineage-receipt"
      data-status={complete ? 'verified' : 'incomplete'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Waypoints className="h-4 w-4 text-ink" />
          Temporal model lineage
        </h3>
        <span
          className={`px-2 py-1 text-xs font-semibold ${
            complete
              ? 'text-ink'
              : 'text-stale'
          }`}
        >
          {complete ? 'Verified' : 'Inspect'}
        </span>
      </div>

      <ol className="mt-3 divide-y divide-rule">
        <LineageStep
          label="Fit ranking"
          value={years(trainingOrigins)}
          detail="Archived feature origins"
        />
        <LineageStep
          label="Calibrate"
          value={
            calibrationOrigin !== null && outcome !== null
              ? `${calibrationOrigin} → ${outcome}`
              : 'Unavailable'
          }
          detail="Historical feature/outcome cohort"
        />
        <LineageStep
          label="Score live"
          value={inferenceSnapshot === 'current' ? 'Current records' : 'Unavailable'}
          detail="No current outcome labels"
        />
      </ol>

      <p className="mt-3 text-xs leading-4 text-ink-2">
        Archived snapshots teach the order; current official facts are scored
        at inference. The 2024→2025 result describes the selected rolling
        procedure; not this final refit&apos;s current hit rate.
        {selectionPolicySummary}
      </p>
    </section>
  );
}

function LineageStep({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <li className="grid grid-cols-[1fr_1fr] gap-x-3 py-2.5">
      <div className="font-cond text-xs font-semibold text-ink">
        {label}
      </div>
      <div className="text-right font-mono text-xs tabular-nums text-ink">
        {value}
      </div>
      <div className="col-span-2 mt-1 text-xs leading-4 text-ink-3">
        {detail}
      </div>
    </li>
  );
}
