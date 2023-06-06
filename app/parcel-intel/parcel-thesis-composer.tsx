'use client';

import {
  ArrowRight,
  Check,
  CircleAlert,
  RotateCcw,
  ShieldCheck,
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
      className="border-b border-rule bg-white"
      aria-labelledby="parcel-thesis-composer-title"
      data-testid="parcel-thesis-composer"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="parcel-thesis-composer-body"
        className="flex w-full scroll-mt-24 items-center justify-between gap-4 px-4 py-3 text-left outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-select md:px-6"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                id="parcel-thesis-composer-title"
                className="text-sm font-semibold text-ink"
              >
                Compose an acquisition thesis
              </span>
              <span className="text-xs text-ink-3">
                Local + auditable
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-ink-3">
              Describe the screen in plain language; review every supported
              filter before applying it.
            </span>
          </span>
        </span>
        <span aria-hidden="true" className="text-ink-3">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div
          id="parcel-thesis-composer-body"
          className="border-t border-rule px-4 py-4 md:px-6"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="min-w-0 bg-white p-4">
              <label
                htmlFor={inputId}
                className="font-cond text-[13px] font-semibold text-ink-3"
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
                className="mt-2 min-h-28 w-full resize-y rounded-sm border border-control bg-white px-3 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-ink-3 focus:border-select focus:ring-2 focus:ring-select"
              />
              <div
                id={guidanceId}
                className="mt-2 flex flex-col gap-2 text-xs leading-5 text-ink-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="inline-flex items-start gap-1.5">
                  <ShieldCheck
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink"
                    aria-hidden="true"
                  />
                  CityLens processes this text in your browser and does not
                  send or save it.
                </span>
                <span>{draft.length}/400</span>
              </div>

              <div className="mt-3">
                <div className="font-cond text-[13px] font-semibold text-ink-3">
                  Try a governed example
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((example, index) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => updateDraft(example)}
                      className="rounded-sm border border-control bg-white px-2.5 py-1 text-xs font-medium text-ink hover:border-rule hover:bg-paper-2 hover:text-select"
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
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Review filters
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {(draft || composition) && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-sm border border-control bg-white px-3 text-xs font-semibold text-ink hover:bg-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div
              className="min-w-0 border-l border-rule bg-white p-4 text-ink"
              data-testid="thesis-review-receipt"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="mt-1 text-sm font-semibold">
                    Visible filters only
                  </h3>
                </div>
                <div className="border-l border-rule px-3 py-2 text-right tabular-nums">
                  <div className="font-cond text-[13px] text-ink-3">
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
                <div className="mt-5 border-b border-dashed border-rule bg-white p-4 text-xs leading-5 text-ink-3">
                  Nothing is applied automatically. Review translates only
                  supported wording into the same controls shown below the
                  composer.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="font-cond text-[13px] font-semibold text-ink-3">
                      Recognized
                    </div>
                    <div className="mt-1.5 divide-y divide-rule">
                      {composition.criteria.map((criterion) => (
                        <span
                          key={criterion.id}
                          className={`flex items-center justify-between gap-2 py-2 text-xs font-medium ${
                            criterion.source === 'safe_default'
                              ? 'text-stale'
                              : 'text-ink'
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          {criterion.label}: {criterion.valueLabel}
                          {criterion.source === 'safe_default' && (
                            <span className="font-cond text-[13px] text-stale">
                              default
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {composition.unsupported.length > 0 && (
                    <div
                      className="border-b border-rule py-3"
                      data-testid="thesis-unsupported"
                    >
                      <div className="font-cond flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        <CircleAlert
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Not applied
                      </div>
                      <ul className="mt-2 space-y-2 text-xs leading-4 text-ink">
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
                      className="border-b border-rule py-3 text-xs leading-4 text-red-700"
                    >
                      <strong className="block text-ink">
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
                        className="border-b border-rule bg-white p-3 text-xs leading-4 text-ink"
                      >
                        Add a supported borough, priority, site type, evidence
                        signal, minimum lot area, or minimum unused-FAR proxy.
                      </div>
                    )}

                  {!inventoryReady && (
                    <div className="border-b border-rule bg-paper-2 p-3 text-xs leading-4 text-ink">
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
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-ink px-4 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-white disabled:text-ink-3"
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
