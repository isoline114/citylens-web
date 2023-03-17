import { ArrowRight, Waypoints } from 'lucide-react';

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
      className="self-start rounded-xl border border-sky-200 bg-[linear-gradient(145deg,#f8fbff,#eef8ff)] p-4 lg:col-span-2"
      data-testid="model-lineage-receipt"
      data-status={complete ? 'verified' : 'incomplete'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Waypoints className="h-4 w-4 text-sky-700" />
          Temporal model lineage
        </h3>
        <span
          className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${
            complete
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-amber-50 text-amber-900 ring-amber-200'
          }`}
        >
          {complete ? 'Verified' : 'Inspect'}
        </span>
      </div>

      <ol className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
        <LineageStep
          label="Fit ranking"
          value={years(trainingOrigins)}
          detail="Archived feature origins"
        />
        <LineageArrow />
        <LineageStep
          label="Calibrate"
          value={
            calibrationOrigin !== null && outcome !== null
              ? `${calibrationOrigin} → ${outcome}`
              : 'Unavailable'
          }
          detail="Historical feature/outcome cohort"
        />
        <LineageArrow />
        <LineageStep
          label="Score live"
          value={inferenceSnapshot === 'current' ? 'Current records' : 'Unavailable'}
          detail="No current outcome labels"
        />
      </ol>

      <p className="mt-3 text-[11px] leading-4 text-slate-600">
        Archived snapshots teach the order; current official facts are scored
        at inference. The 2024→2025 result describes the selected rolling
        procedure—not this final refit&apos;s current hit rate.
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
    <li className="rounded-lg bg-white p-2.5 ring-1 ring-inset ring-sky-100">
      <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-sky-700">
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold tabular-nums text-slate-950">
        {value}
      </div>
      <div className="mt-0.5 text-[9px] leading-3 text-slate-500">
        {detail}
      </div>
    </li>
  );
}

function LineageArrow() {
  return (
    <li
      aria-hidden="true"
      className="hidden items-center justify-center text-sky-300 sm:flex"
    >
      <ArrowRight className="h-3.5 w-3.5" />
    </li>
  );
}
