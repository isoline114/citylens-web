'use client';

import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import type { ParcelIntelMapRow } from '@/lib/api';

import {
  filterExplorerRows,
  type ExplorerFilters,
} from './parcel-intel-explorer-support';
import {
  composeParcelThesis,
  filtersFromThesisComposition,
  type ThesisComposition,
} from './parcel-thesis-composer-support';

const EXAMPLES = [
  'High-priority long-held vacant sites in Brooklyn near transit with 10k+ sf lots',
  'Queens assemblage opportunities with at least 25,000 sf unused FAR',
  'Highest-priority vacant sites in the Bronx with recent aerial change',
] as const;

type Props = {
  currentFilters: ExplorerFilters;
  inventoryRows: ParcelIntelMapRow[];
  inventoryReady: boolean;
  onApply: (filters: ExplorerFilters) => void;
};

export function ParcelThesisComposer({
  currentFilters,
  inventoryRows,
  inventoryReady,
  onApply,
}: Props) {
  const inputId = useId();
  const guidanceId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [composition, setComposition] = useState<ThesisComposition | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState('');

  const reviewedFilters = useMemo(
    () =>
      composition
        ? filtersFromThesisComposition(currentFilters, composition)
        : null,
    [composition, currentFilters],
  );
  const matchCount = useMemo(
    () =>
      inventoryReady && reviewedFilters
        ? filterExplorerRows(inventoryRows, reviewedFilters).length
        : null,
    [inventoryReady, inventoryRows, reviewedFilters],
  );

  const updateDraft = (value: string) => {
    setDraft(value);
    setComposition(null);
    setAnnouncement('');
  };

  const review = () => {
    const next = composeParcelThesis(draft);
    const nextFilters = filtersFromThesisComposition(currentFilters, next);
    const nextMatchCount = inventoryReady
      ? filterExplorerRows(inventoryRows, nextFilters).length
      : null;
    setComposition(next);
    if (next.conflicts.length > 0) {
      setAnnouncement(
        `Review blocked. ${next.conflicts.length} conflicting ${
          next.conflicts.length === 1 ? 'criterion was' : 'criteria were'
        } recognized.`,
      );
      return;
    }
    if (next.explicitCriterionCount === 0) {
      setAnnouncement(
        'No supported criterion was recognized. Add a borough, priority, site type, evidence signal, or minimum site criterion.',
      );
      return;
    }
    setAnnouncement(
      `${next.explicitCriterionCount} explicit ${
        next.explicitCriterionCount === 1 ? 'criterion' : 'criteria'
      } ready for review${
        nextMatchCount === null
          ? '.'
          : `; ${nextMatchCount.toLocaleString()} current leads match.`
      }`,
    );
  };

  const apply = () => {
    if (
      !composition?.canApply ||
      !reviewedFilters ||
      !inventoryReady ||
      matchCount === null
    ) {
      return;
    }
    onApply(reviewedFilters);
    setAnnouncement(
      `Applied ${composition.explicitCriterionCount} reviewed ${
        composition.explicitCriterionCount === 1 ? 'criterion' : 'criteria'
      }. ${matchCount.toLocaleString()} current leads match.`,
    );
  };

  const reset = () => {
    setDraft('');
    setComposition(null);
    setAnnouncement('Acquisition thesis cleared.');
  };

  return (
    <section
      className="border-b border-sky-200 bg-[linear-gradient(110deg,#f8fafc_0%,#eff6ff_48%,#ecfdf5_100%)]"
      aria-labelledby="parcel-thesis-composer-title"
      data-testid="parcel-thesis-composer"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="parcel-thesis-composer-body"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left outline-none hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 md:px-6"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sky-300 shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                id="parcel-thesis-composer-title"
                className="text-sm font-semibold text-slate-950"
              >
                Compose an acquisition thesis
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Local + auditable
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-600">
              Describe the screen in plain language; review every supported
              filter before applying it.
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="parcel-thesis-composer-body"
          className="border-t border-sky-100 px-4 py-4 md:px-6"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm backdrop-blur">
              <label
                htmlFor={inputId}
                className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700"
              >
                Acquisition thesis
              </label>
              <textarea
                id={inputId}
                value={draft}
                onChange={(event) => updateDraft(event.target.value)}
                maxLength={400}
                rows={4}
                aria-describedby={guidanceId}
                placeholder="Example: High-priority long-held vacant sites in Brooklyn near transit with 10k+ sf lots"
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
              <div
                id={guidanceId}
                className="mt-2 flex flex-col gap-2 text-[11px] leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="inline-flex items-start gap-1.5">
                  <ShieldCheck
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                  CityLens processes this text in your browser and does not
                  send or save it.
                </span>
                <span>{draft.length}/400</span>
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Try a governed example
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((example, index) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => updateDraft(example)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                    >
                      Example {index + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={review}
                  disabled={draft.trim().length < 3}
                  data-testid="thesis-review"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Review filters
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {(draft || composition) && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div
              className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm"
              data-testid="thesis-review-receipt"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                    Review receipt
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">
                    Visible filters only
                  </h3>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                  <div className="text-[9px] uppercase tracking-wide text-slate-400">
                    Current matches
                  </div>
                  <div
                    className="mt-0.5 text-lg font-semibold"
                    data-testid="thesis-match-count"
                  >
                    {matchCount === null ? '—' : matchCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {!composition ? (
                <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-xs leading-5 text-slate-300">
                  Nothing is applied automatically. Review translates only
                  supported wording into the same controls shown below the
                  composer.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Recognized
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {composition.criteria.map((criterion) => (
                        <span
                          key={criterion.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            criterion.source === 'safe_default'
                              ? 'border-amber-300/35 bg-amber-300/10 text-amber-100'
                              : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          {criterion.label}: {criterion.valueLabel}
                          {criterion.source === 'safe_default' && (
                            <span className="text-[9px] uppercase tracking-wide text-amber-300">
                              default
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {composition.unsupported.length > 0 && (
                    <div
                      className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3"
                      data-testid="thesis-unsupported"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                        <CircleAlert
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Not applied
                      </div>
                      <ul className="mt-2 space-y-2 text-[11px] leading-4 text-amber-50">
                        {composition.unsupported.map((concept) => (
                          <li key={concept.id}>
                            <strong>{concept.label}.</strong>{' '}
                            {concept.guidance}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {composition.conflicts.length > 0 && (
                    <div
                      role="alert"
                      className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-3 text-[11px] leading-4 text-rose-100"
                    >
                      <strong className="block text-rose-200">
                        Resolve before applying
                      </strong>
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {composition.conflicts.map((conflict) => (
                          <li key={conflict}>{conflict}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {composition.explicitCriterionCount === 0 &&
                    composition.conflicts.length === 0 && (
                      <div
                        role="alert"
                        className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-[11px] leading-4 text-amber-100"
                      >
                        Add a supported borough, priority, site type, evidence
                        signal, minimum lot area, or minimum unused-FAR proxy.
                      </div>
                    )}

                  {!inventoryReady && (
                    <div className="rounded-xl border border-sky-300/25 bg-sky-300/10 p-3 text-[11px] leading-4 text-sky-100">
                      Waiting for the verified full inventory before applying
                      or counting this screen.
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={apply}
                disabled={
                  !composition?.canApply ||
                  !inventoryReady ||
                  matchCount === null
                }
                data-testid="thesis-apply"
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-xs font-semibold text-slate-950 shadow-sm hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
              >
                {composition?.canApply
                  ? `Apply ${composition.explicitCriterionCount} reviewed ${
                      composition.explicitCriterionCount === 1
                        ? 'criterion'
                        : 'criteria'
                    }`
                  : 'Review a supported thesis first'}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="thesis-announcement"
          >
            {announcement}
          </div>
        </div>
      )}
    </section>
  );
}
