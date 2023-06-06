'use client';

import {
  Check,
  CircleSlash2,
  Eye,
  HelpCircle,
  LoaderCircle,
  RotateCcw,
  ClipboardCheck,
  Target,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  getParcelLeadReview,
  saveParcelLeadReview,
  type ParcelLeadReview,
  type ParcelLeadReviewReason,
  type ParcelLeadReviewVerdict,
} from '@/lib/api';

type Props = {
  bbl: string;
  feedGeneration: string | null;
  onOpenAudit?: () => void;
};

type ReviewLoadState = 'loading' | 'ready' | 'error';

const VERDICTS: Array<{
  value: ParcelLeadReviewVerdict;
  label: string;
  Icon: typeof Target;
  selectedClass: string;
}> = [
  {
    value: 'pursue',
    label: 'Pursue',
    Icon: Target,
    selectedClass: 'border-ink bg-paper-2 text-ink font-semibold',
  },
  {
    value: 'watch',
    label: 'Watch',
    Icon: Eye,
    selectedClass: 'border-ink bg-paper-2 text-ink font-semibold',
  },
  {
    value: 'pass',
    label: 'Pass',
    Icon: CircleSlash2,
    selectedClass: 'border-ink bg-paper-2 text-ink font-semibold',
  },
  {
    value: 'unclear',
    label: 'Unclear',
    Icon: HelpCircle,
    selectedClass: 'border-ink bg-paper-2 text-ink font-semibold',
  },
];

const REASONS: Record<
  ParcelLeadReviewVerdict,
  Array<{ value: ParcelLeadReviewReason; label: string }>
> = {
  pursue: [
    { value: 'strong_capacity', label: 'Strong capacity' },
    { value: 'strategic_location', label: 'Strategic location' },
    { value: 'ownership_opportunity', label: 'Ownership opportunity' },
    { value: 'market_signal', label: 'Market signal' },
    { value: 'other', label: 'Other' },
  ],
  watch: [
    { value: 'needs_diligence', label: 'Needs diligence' },
    { value: 'timing_uncertain', label: 'Timing uncertain' },
    {
      value: 'ownership_or_assembly_complexity',
      label: 'Ownership / assemblage',
    },
    { value: 'source_conflict', label: 'Source conflict' },
    { value: 'missing_facts', label: 'Missing facts' },
    { value: 'other', label: 'Other' },
  ],
  pass: [
    {
      value: 'active_or_completed_project',
      label: 'Already active / completed',
    },
    { value: 'insufficient_capacity', label: 'Insufficient capacity' },
    {
      value: 'zoning_or_site_constraint',
      label: 'Zoning / site constraint',
    },
    {
      value: 'ownership_or_assembly_complexity',
      label: 'Ownership / assemblage',
    },
    { value: 'pricing_or_basis', label: 'Pricing / basis' },
    { value: 'data_quality_issue', label: 'Data quality issue' },
    { value: 'not_development_site', label: 'Not a development site' },
    { value: 'other', label: 'Other' },
  ],
  unclear: [
    { value: 'needs_diligence', label: 'Needs diligence' },
    { value: 'source_conflict', label: 'Source conflict' },
    { value: 'missing_facts', label: 'Missing facts' },
    { value: 'other', label: 'Other' },
  ],
};

const SOURCE_AUDIT_REASONS = new Set<ParcelLeadReviewReason>([
  'active_or_completed_project',
  'data_quality_issue',
  'source_conflict',
]);

function sameReview(
  review: ParcelLeadReview | null,
  verdict: ParcelLeadReviewVerdict | null,
  reason: ParcelLeadReviewReason | null,
): boolean {
  return Boolean(
    review &&
      verdict === review.verdict &&
      reason !== null &&
      review.reason_codes.length === 1 &&
      review.reason_codes[0] === reason,
  );
}

export function ParcelLeadReviewCard({
  bbl,
  feedGeneration,
  onOpenAudit,
}: Props) {
  const [loadState, setLoadState] =
    useState<ReviewLoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [review, setReview] = useState<ParcelLeadReview | null>(null);
  const [verdict, setVerdict] =
    useState<ParcelLeadReviewVerdict | null>(null);
  const [reason, setReason] =
    useState<ParcelLeadReviewReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reasonOptions = useMemo(
    () => (verdict ? REASONS[verdict] : []),
    [verdict],
  );

  useEffect(() => {
    if (!feedGeneration) {
      setLoadState('error');
      setMessage('This ranking has no verifiable generation receipt.');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    setMessage(null);
    void getParcelLeadReview(bbl)
      .then((state) => {
        if (cancelled) return;
        if (state.current_feed_generation !== feedGeneration) {
          setLoadState('error');
          setMessage('The ranking changed. Reload before reviewing this lead.');
          return;
        }
        setReview(state.review);
        setVerdict(state.review?.verdict ?? null);
        setReason(state.review?.reason_codes[0] ?? null);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
        setMessage('Lead review is temporarily unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [bbl, feedGeneration, reloadKey]);

  const selectVerdict = (next: ParcelLeadReviewVerdict) => {
    setVerdict(next);
    setReason(
      review?.verdict === next ? review.reason_codes[0] ?? null : null,
    );
    setMessage(null);
  };

  const submit = async () => {
    if (!feedGeneration || !verdict || !reason || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveParcelLeadReview(bbl, {
        expected_feed_generation: feedGeneration,
        verdict,
        reason_codes: [reason],
      });
      setReview(saved);
      setVerdict(saved.verdict);
      setReason(saved.reason_codes[0] ?? null);
      setMessage('Review recorded');
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'The ranking changed. Reload before reviewing this lead.'
          : 'Could not record the review. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="my-4 border border-rule bg-white"
      data-testid="parcel-lead-review"
      data-state={loadState}
    >
      <div className="flex items-start justify-between gap-3 border-b border-rule px-3 py-2.5">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <ClipboardCheck className="h-3.5 w-3.5 text-ink-3" />
            Your lead call
          </h4>
          <p className="mt-0.5 text-xs leading-4 text-ink-3">
            Private · tied to this ranking · never changes rank
          </p>
        </div>
        {review && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
            <Check className="h-3 w-3" />
            Recorded
          </span>
        )}
      </div>

      {loadState === 'loading' ? (
        <div
          className="flex items-center gap-2 px-3 py-4 text-xs text-ink-3"
          role="status"
        >
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Checking your review…
        </div>
      ) : loadState === 'error' ? (
        <div className="flex items-center justify-between gap-3 px-3 py-3 text-xs text-red-700">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-sm border border-rule bg-white px-2.5 font-semibold hover:bg-white"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : (
        <div className="p-3">
          <div
            className="flex flex-wrap gap-1.5"
            aria-label="Lead review verdict"
          >
            {VERDICTS.map(({ value, label, Icon, selectedClass }) => {
              const selected = verdict === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectVerdict(value)}
                  className={`inline-flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? selectedClass
                      : 'border-control bg-white text-ink-3 hover:border-rule hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>

          {verdict && (
            <div className="mt-3">
              <div className="font-cond text-[13px] font-semibold text-ink-3">
                Primary reason
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {reasonOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={reason === option.value}
                    onClick={() => {
                      setReason(option.value);
                      setMessage(null);
                    }}
                    className={`rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                      reason === option.value
                        ? 'border-ink bg-ink text-white'
                        : 'border-control bg-white text-ink-3 hover:border-rule hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-2.5">
            <span
              className={`text-xs leading-4 ${
                message === 'Review recorded'
                  ? 'font-semibold text-ink'
                  : 'text-ink-3'
              }`}
              aria-live="polite"
            >
              {message ??
                'Relevance evidence stays separate from pipeline outcomes.'}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                saving ||
                !verdict ||
                !reason ||
                sameReview(review, verdict, reason)
              }
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm bg-ink px-3 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {review ? 'Update' : 'Record'}
            </button>
          </div>
          {review &&
            onOpenAudit &&
            review.reason_codes.some((code) =>
              SOURCE_AUDIT_REASONS.has(code),
            ) && (
              <div className="mt-2 flex items-center justify-between gap-3 bg-paper-2 px-2.5 py-2 text-xs leading-4 text-ink ">
                <span>Check the cited current record before escalation.</span>
                <button
                  type="button"
                  onClick={onOpenAudit}
                  className="shrink-0 font-semibold text-select underline decoration-rule underline-offset-2 hover:decoration-rule"
                >
                  Open source audit
                </button>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
