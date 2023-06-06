'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Equal,
  Flag,
  Printer,
  RefreshCw,
  Save,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';

import type {
  ParcelDecisionAudit,
  ParcelDecisionAuditCheck,
  ParcelIntelRow,
  ParcelWorkflowEvidenceReview,
  ParcelWorkflowEvidenceIssue,
  ParcelWorkflowEvidenceIssueReason,
  ParcelWorkflowEvidenceIssueType,
  ParcelWorkflowEvidenceReviewKey,
  ParcelWorkflowItem,
  ParcelWorkflowStage,
} from '@/lib/api';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2';

export const WORKFLOW_STAGE_LABELS: Record<ParcelWorkflowStage, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  underwriting: 'Underwriting',
  pursue: 'Pursue',
  pass: 'Pass',
};

export type WorkflowDraft = Pick<
  ParcelWorkflowItem,
  | 'stage'
  | 'notes'
  | 'tags'
  | 'assignee'
  | 'watching'
  | 'decision_reason'
  | 'next_action'
  | 'next_action_due_date'
  | 'outcome'
>;

const DECISION_REASONS = [
  ['', 'No disposition reason'],
  ['pursuing', 'Pursuing / next action set'],
  ['owner_unresponsive', 'Owner unresponsive'],
  ['pricing_gap', 'Pricing gap'],
  ['insufficient_capacity', 'Insufficient capacity'],
  ['zoning_constraints', 'Zoning / entitlement constraints'],
  ['ownership_complexity', 'Ownership complexity'],
  ['active_project', 'Already an active project'],
  ['bad_data', 'Data needs correction'],
  ['other', 'Other'],
] as const;

const OUTCOMES: Array<[ParcelWorkflowItem['outcome'], string]> = [
  ['unknown', 'No outcome yet'],
  ['owner_contacted', 'Owner contacted'],
  ['meeting_scheduled', 'Meeting scheduled'],
  ['qualified', 'Qualified after contact'],
  ['offer_submitted', 'Offer submitted'],
  ['under_contract', 'Under contract'],
  ['closed', 'Closed'],
  ['rejected', 'Rejected after diligence'],
  ['lost', 'Lost'],
];

export function WorkflowEditor({
  item,
  suggestedNextAction,
  busy,
  onSave,
  onRemove,
}: {
  item: ParcelWorkflowItem | null;
  suggestedNextAction?: string | null;
  busy: boolean;
  onSave: (draft: WorkflowDraft) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [stage, setStage] = useState<ParcelWorkflowStage>(item?.stage ?? 'new');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [tagsText, setTagsText] = useState((item?.tags ?? []).join(', '));
  const [assignee, setAssignee] = useState(item?.assignee ?? '');
  const [watching, setWatching] = useState(item?.watching ?? true);
  const [decisionReason, setDecisionReason] = useState(item?.decision_reason ?? '');
  const [nextAction, setNextAction] = useState(
    item?.next_action ?? suggestedNextAction ?? '',
  );
  const [nextActionDueDate, setNextActionDueDate] = useState(
    item?.next_action_due_date ?? '',
  );
  const [outcome, setOutcome] = useState<ParcelWorkflowItem['outcome']>(
    item?.outcome ?? 'unknown',
  );

  useEffect(() => {
    setStage(item?.stage ?? 'new');
    setNotes(item?.notes ?? '');
    setTagsText((item?.tags ?? []).join(', '));
    setAssignee(item?.assignee ?? '');
    setWatching(item?.watching ?? true);
    setDecisionReason(item?.decision_reason ?? '');
    setNextAction(item?.next_action ?? suggestedNextAction ?? '');
    setNextActionDueDate(item?.next_action_due_date ?? '');
    setOutcome(item?.outcome ?? 'unknown');
  }, [item, suggestedNextAction]);

  return (
    <section className="mt-4 border-t border-rule bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Bookmark className="h-3.5 w-3.5" /> Acquisition workflow
          </h4>
          <p className="mt-0.5 text-xs text-ink">
            {item ? 'Saved to your pipeline' : 'Add this site to your pipeline'}
          </p>
        </div>
        {item && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRemove()}
            className={`rounded-sm p-1.5 text-ink-3 hover:bg-white hover:text-red-700 disabled:opacity-50 ${FOCUS_RING}`}
            aria-label="Remove from pipeline"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink-2">
          Stage
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as ParcelWorkflowStage)}
            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
          >
            {Object.entries(WORKFLOW_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-2">
          Assignee
          <input
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="Name or team"
            maxLength={128}
            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
          />
        </label>
      </div>
      <label className="mt-2 block text-xs font-medium text-ink-2">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Owner context, diligence questions, next action…"
          maxLength={4000}
          rows={3}
          className={`field mt-1 w-full resize-y rounded-sm border border-control bg-white p-2 text-sm ${FOCUS_RING}`}
        />
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
        <label className="text-xs font-medium text-ink-2">
          Next action
          <input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Call owner, review title, prepare offer…"
            maxLength={240}
            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
          />
        </label>
        <label className="text-xs font-medium text-ink-2">
          Due date
          <input
            type="date"
            value={nextActionDueDate}
            onChange={(event) => setNextActionDueDate(event.target.value)}
            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
          />
        </label>
      </div>
      {nextActionDueDate && !nextAction.trim() && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          Add a concrete next action before setting its due date.
        </p>
      )}
      <label className="mt-2 block text-xs font-medium text-ink-2">
        Tags
        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="corner, assemblage, call-first"
          className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
        />
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink-2">
          Disposition reason
          <select
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
          >
            {DECISION_REASONS.map(([value, label]) => (
              <option key={value || 'none'} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-2">
          Outcome
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as ParcelWorkflowItem['outcome'])}
            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm ${FOCUS_RING}`}
          >
            {OUTCOMES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={watching}
            onChange={(event) => setWatching(event.target.checked)}
          />
          <Bell className="h-3.5 w-3.5" /> Watch for data changes
        </label>
        <button
          type="button"
          disabled={busy || Boolean(nextActionDueDate && !nextAction.trim())}
          onClick={() =>
            void onSave({
              stage,
              notes: notes.trim(),
              tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
              assignee: assignee.trim() || null,
              watching,
              decision_reason: decisionReason || null,
              next_action: nextAction.trim() || null,
              next_action_due_date: nextActionDueDate || null,
              outcome,
            })
          }
          className={`inline-flex h-9 items-center gap-1.5 rounded-sm bg-ink px-3 text-xs font-medium text-white hover:bg-ink disabled:opacity-50 ${FOCUS_RING}`}
        >
          <Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : item ? 'Save changes' : 'Add to pipeline'}
        </button>
      </div>
    </section>
  );
}

export const REVIEWABLE_EVIDENCE_KEYS: ParcelWorkflowEvidenceReviewKey[] = [
  'acquisition_eligibility',
  'current_project_clearance',
  'property_facts',
  'ownership',
  'current_diligence',
  'transit_access',
];

function evidenceReviewIsCurrent(
  review: ParcelWorkflowEvidenceReview | undefined,
  check: ParcelDecisionAuditCheck,
  feedGeneratedAt: string | null,
): boolean {
  return Boolean(
    review &&
      review.check_status === check.status &&
      review.source === check.source &&
      review.source_as_of === check.as_of &&
      review.feed_generated_at === feedGeneratedAt,
  );
}

function reviewDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recorded';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

const EVIDENCE_STATUS_STYLES: Record<ParcelDecisionAuditCheck['status'], string> = {
  verified: 'text-ink',
  review: 'text-ink-2',
  excluded: 'text-ink-2',
  unavailable: 'text-stale',
  informational: 'text-ink-2',
};

const EVIDENCE_ISSUE_REASON_OPTIONS: Array<
  [ParcelWorkflowEvidenceIssueReason, string]
> = [
  ['incorrect_value', 'Incorrect value'],
  ['outdated_source', 'Outdated source'],
  ['wrong_parcel_match', 'Wrong parcel match'],
  ['duplicate_or_merged_lot', 'Duplicate or merged lot'],
  ['privacy_or_safety', 'Privacy or safety concern'],
  ['other', 'Other evidence issue'],
];

function evidenceIssueIsCurrent(
  issue: ParcelWorkflowEvidenceIssue | undefined,
  check: ParcelDecisionAuditCheck,
  feedGeneratedAt: string | null,
): boolean {
  return Boolean(
    issue &&
      issue.check_status === check.status &&
      issue.source === check.source &&
      issue.source_as_of === check.as_of &&
      issue.feed_generated_at === feedGeneratedAt,
  );
}

export function EvidenceReviewChecklist({
  audit,
  item,
  busyKey,
  issueBusyKey,
  focusOnMount = false,
  onReview,
  onClear,
  onReportIssue,
  onWithdrawIssue,
}: {
  audit?: ParcelDecisionAudit;
  item: ParcelWorkflowItem;
  busyKey: ParcelWorkflowEvidenceReviewKey | null;
  issueBusyKey: ParcelWorkflowEvidenceReviewKey | null;
  focusOnMount?: boolean;
  onReview: (
    checkKey: ParcelWorkflowEvidenceReviewKey,
    check: ParcelDecisionAuditCheck,
  ) => Promise<void>;
  onClear: (checkKey: ParcelWorkflowEvidenceReviewKey) => Promise<void>;
  onReportIssue: (
    checkKey: ParcelWorkflowEvidenceReviewKey,
    check: ParcelDecisionAuditCheck,
    input: {
      issue_type: ParcelWorkflowEvidenceIssueType;
      reason_code: ParcelWorkflowEvidenceIssueReason;
      note: string;
    },
  ) => Promise<boolean>;
  onWithdrawIssue: (
    checkKey: ParcelWorkflowEvidenceReviewKey,
  ) => Promise<void>;
}) {
  const feedGeneratedAt = audit?.evidence_generated_at ?? null;
  const checks = REVIEWABLE_EVIDENCE_KEYS.map((key) => ({
    key,
    check: audit?.checks.find((candidate) => candidate.key === key),
    review: item.evidence_reviews?.[key],
    issue: item.evidence_issues?.[key],
  })).filter(
    (
      value,
    ): value is {
      key: ParcelWorkflowEvidenceReviewKey;
      check: ParcelDecisionAuditCheck;
      review: ParcelWorkflowEvidenceReview | undefined;
      issue: ParcelWorkflowEvidenceIssue | undefined;
    } => Boolean(value.check),
  );
  const currentCount = checks.filter(({ check, review }) =>
    evidenceReviewIsCurrent(review, check, feedGeneratedAt),
  ).length;
  const staleCount = checks.filter(
    ({ check, review }) =>
      Boolean(review) &&
      !evidenceReviewIsCurrent(review, check, feedGeneratedAt),
  ).length;
  const isTerminal =
    item.stage === 'pass' ||
    ['closed', 'rejected', 'lost'].includes(item.outcome);
  const [expanded, setExpanded] = useState(
    focusOnMount || staleCount > 0,
  );
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [issueFormKey, setIssueFormKey] =
    useState<ParcelWorkflowEvidenceReviewKey | null>(null);
  const [issueType, setIssueType] =
    useState<ParcelWorkflowEvidenceIssueType>('correction');
  const [issueReason, setIssueReason] =
    useState<ParcelWorkflowEvidenceIssueReason>('incorrect_value');
  const [issueNote, setIssueNote] = useState('');
  const openIssueCount = checks.filter(
    ({ issue }) => issue?.status === 'submitted',
  ).length;

  useEffect(() => {
    if (staleCount > 0) setExpanded(true);
  }, [staleCount]);

  useEffect(() => {
    if (!focusOnMount) return;
    setExpanded(true);
    toggleRef.current?.focus();
  }, [focusOnMount]);

  if (checks.length === 0) return null;

  return (
    <section
      className="mt-3 overflow-hidden border-t border-rule bg-white"
      data-testid="evidence-review-checklist"
    >
      <div className="px-3 py-3 text-ink">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="evidence-review-items"
          aria-label={`Evidence review ledger, ${currentCount} of ${checks.length} current${staleCount ? `, ${staleCount} stale` : ''}`}
          data-testid="evidence-review-toggle"
          className={`flex w-full items-start justify-between gap-3 rounded-sm text-left ${FOCUS_RING}`}
        >
          <span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-ink" />
              Evidence review ledger
            </span>
            <span className="mt-1 block max-w-md text-[11px] leading-4 text-ink-2">
              Mark the exact cited version you considered. CityLens flags the
              marker when its status, source, source date, or feed version changes.
            </span>
          </span>
          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {openIssueCount > 0 && (
              <span
                className="rounded-sm bg-white px-2 py-1 text-[10px] font-semibold tabular-nums text-stale ring-1 ring-inset ring-stale-wash/20"
                data-testid="open-evidence-issue-count"
              >
                {openIssueCount} source {openIssueCount === 1 ? 'issue' : 'issues'}
              </span>
            )}
            <span
              className="rounded-sm bg-white px-2 py-1 text-[10px] font-semibold tabular-nums text-ink ring-1 ring-inset ring-rule"
              aria-label={`${currentCount} of ${checks.length} evidence versions reviewed`}
            >
              {currentCount}/{checks.length} current
            </span>
            <ChevronDown
              className={`h-4 w-4 text-ink-2  ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>
        <div
          className="mt-2 h-1.5 overflow-hidden bg-paper-2"
          role="progressbar"
          aria-label="Current evidence versions reviewed"
          aria-valuemin={0}
          aria-valuemax={checks.length}
          aria-valuenow={currentCount}
        >
          <div
            className="h-full bg-ink transition-[width]"
            style={{
              width: `${checks.length > 0 ? (currentCount / checks.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {expanded && (
        <div id="evidence-review-items">
          {isTerminal && (
            <p
              className="border-b border-rule bg-white px-3 py-2 text-[11px] leading-4 text-stale"
              role="status"
            >
              Reopen this workflow record before changing evidence-review
              markers.
            </p>
          )}
          <ul className="divide-y divide-rule">
            {checks.map(({ key, check, review, issue }) => {
              const isCurrent = evidenceReviewIsCurrent(
                review,
                check,
                feedGeneratedAt,
              );
              const isStale = Boolean(review && !isCurrent);
              const isBusy = busyKey === key;
              const issueIsCurrent = evidenceIssueIsCurrent(
                issue,
                check,
                feedGeneratedAt,
              );
              const issueIsOpen = issue?.status === 'submitted';
              const isIssueBusy = issueBusyKey === key;
              const issueFormOpen = issueFormKey === key;
              return (
                <li
                  key={key}
                  className="px-3 py-3"
                  data-testid={`evidence-review-${key}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink">
                          {check.label}
                        </span>
                        <span
                          className={`text-xs font-medium ${EVIDENCE_STATUS_STYLES[check.status]}`}
                        >
                          {check.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs leading-4 text-ink-3">
                        {check.source}
                        {check.as_of
                          ? ` · as of ${check.as_of}`
                          : ' · date unavailable'}
                      </p>
                      {isCurrent && review ? (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-ink">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Exact version reviewed{' '}
                          {reviewDateLabel(review.reviewed_at)}
                        </p>
                      ) : isStale && review ? (
                        <div className="mt-1.5 border-t border-rule bg-white px-2 py-1.5">
                          <p className="flex items-center gap-1 text-[11px] font-semibold text-stale">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Source changed · review the current version again
                          </p>
                          <p className="mt-0.5 font-mono text-xs leading-4 text-stale">
                            Prior marker: {review.source}
                            {review.source_as_of
                              ? ` · as of ${review.source_as_of}`
                              : ' · date unavailable'}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-ink-3">
                          Not yet marked reviewed for this cited version.
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {isCurrent ? (
                        <button
                          type="button"
                          disabled={isTerminal || busyKey !== null}
                          onClick={() => void onClear(key)}
                          aria-label={`Undo review of ${check.label}`}
                          className={`inline-flex h-8 items-center gap-1 rounded-sm border border-control bg-white px-2 text-[10px] font-semibold text-ink-2 hover:border-control hover:text-ink disabled:opacity-50 ${FOCUS_RING}`}
                        >
                          <Undo2 className="h-3 w-3" />
                          Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isTerminal || busyKey !== null}
                          onClick={() => void onReview(key, check)}
                          aria-label={`Mark ${check.label} version reviewed`}
                          className={`inline-flex min-h-8 items-center gap-1 rounded-sm bg-ink px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-ink disabled:opacity-50 ${FOCUS_RING}`}
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {isBusy
                            ? 'Saving…'
                            : isStale
                              ? 'Review current'
                              : 'Mark reviewed'}
                        </button>
                      )}
                      {!issueIsOpen && (
                        <button
                          type="button"
                          disabled={issueBusyKey !== null}
                          onClick={() => {
                            setIssueFormKey(issueFormOpen ? null : key);
                            setIssueType('correction');
                            setIssueReason('incorrect_value');
                            setIssueNote('');
                          }}
                          aria-expanded={issueFormOpen}
                          aria-label={`Report a source issue for ${check.label}`}
                          className={`inline-flex min-h-7 items-center gap-1 rounded-sm px-2 text-[10px] font-semibold text-ink-3 hover:bg-white hover:text-stale disabled:opacity-50 ${FOCUS_RING}`}
                        >
                          <Flag className="h-3 w-3" />
                          Report issue
                        </button>
                      )}
                    </div>
                  </div>

                  {issue && (
                    <div
                      className={`mt-2 rounded-sm border px-2.5 py-2 ${
                        issue.status === 'submitted'
                          ? 'border-rule bg-white text-stale'
                          : issue.status === 'resolved'
                            ? 'border-rule bg-paper-2 text-ink'
                            : 'border-rule bg-paper-2 text-ink-2'
                      }`}
                      data-testid={`evidence-issue-${key}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-cond flex items-center gap-1 text-[13px] font-semibold">
                            <Flag className="h-3 w-3" />
                            {issue.status === 'submitted'
                              ? 'CityLens review pending'
                              : issue.status === 'resolved'
                                ? 'Issue resolved'
                                : issue.status === 'dismissed'
                                  ? 'Issue reviewed · no source change'
                                  : 'Issue withdrawn'}
                          </div>
                          <p className="mt-1 text-[11px] leading-4">
                            {issue.issue_type === 'suppression_review'
                              ? 'Suppression review'
                              : 'Correction request'}{' '}
                            · {issue.reason_code.replaceAll('_', ' ')}
                            {!issueIsCurrent && issue.status === 'submitted'
                              ? ' · reported citation is no longer current'
                              : ''}
                          </p>
                        </div>
                        {issue.status === 'submitted' && (
                          <button
                            type="button"
                            disabled={issueBusyKey !== null}
                            onClick={() => void onWithdrawIssue(key)}
                            aria-label={`Withdraw source issue for ${check.label}`}
                            className={`rounded-sm border border-control bg-white px-2 py-1 text-[10px] font-semibold hover:bg-white disabled:opacity-50 ${FOCUS_RING}`}
                          >
                            {isIssueBusy ? 'Withdrawing…' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                      {issue.resolution_note && (
                        <p className="mt-1.5 border-t border-current/10 pt-1.5 text-[11px] leading-4">
                          {issue.resolution_note}
                        </p>
                      )}
                      <p className="mt-1.5 text-[10px] leading-4">
                        The cited source remains visible unless a governed source
                        update is published.
                      </p>
                    </div>
                  )}

                  {issueFormOpen && !issueIsOpen && (
                    <form
                      className="mt-2 border-t border-rule bg-white p-3"
                      data-testid={`evidence-issue-form-${key}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (issueNote.trim().length < 20) return;
                        void onReportIssue(key, check, {
                          issue_type: issueType,
                          reason_code: issueReason,
                          note: issueNote.trim(),
                        }).then((saved) => {
                          if (saved) {
                            setIssueFormKey(null);
                            setIssueNote('');
                          }
                        });
                      }}
                    >
                      <div className="flex items-start gap-2 text-stale">
                        <Flag className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold">
                            Report this exact source version
                          </div>
                          <p className="mt-0.5 font-mono text-xs leading-4 text-stale">
                            This creates a private governance request. It does not
                            immediately edit, hide, or clear the official value.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="font-sans text-[13px] font-medium text-ink">
                          Request
                          <select
                            value={issueType}
                            onChange={(event) =>
                              setIssueType(
                                event.target
                                  .value as ParcelWorkflowEvidenceIssueType,
                              )
                            }
                            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-xs font-normal normal-case tracking-normal text-ink ${FOCUS_RING}`}
                          >
                            <option value="correction">Correction review</option>
                            <option value="suppression_review">
                              Suppression review
                            </option>
                          </select>
                        </label>
                        <label className="font-sans text-[13px] font-medium text-ink">
                          Reason
                          <select
                            value={issueReason}
                            onChange={(event) =>
                              setIssueReason(
                                event.target
                                  .value as ParcelWorkflowEvidenceIssueReason,
                              )
                            }
                            className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-xs font-normal normal-case tracking-normal text-ink ${FOCUS_RING}`}
                          >
                            {EVIDENCE_ISSUE_REASON_OPTIONS.map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                      <label className="font-sans mt-2 block text-[13px] font-medium text-ink">
                        What should CityLens verify?
                        <textarea
                          value={issueNote}
                          onChange={(event) =>
                            setIssueNote(event.target.value.slice(0, 1000))
                          }
                          minLength={20}
                          maxLength={1000}
                          required
                          rows={3}
                          placeholder="Describe the mismatch and the source your team used. Do not include sensitive personal information."
                          className={`field mt-1 w-full resize-y rounded-sm border border-control bg-white px-2.5 py-2 text-xs font-normal normal-case tracking-normal text-ink placeholder:text-ink-3 ${FOCUS_RING}`}
                        />
                      </label>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-stale">
                          {issueNote.trim().length}/1000 · minimum 20 characters
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIssueFormKey(null);
                              setIssueNote('');
                            }}
                            className={`rounded-sm px-2.5 py-1.5 text-[10px] font-semibold text-stale hover:bg-white ${FOCUS_RING}`}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={
                              issueBusyKey !== null ||
                              issueNote.trim().length < 20
                            }
                            className={`btn-primary gap-1 text-xs disabled:opacity-50 ${FOCUS_RING}`}
                          >
                            {isIssueBusy ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            {isIssueBusy ? 'Submitting…' : 'Submit for review'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="border-t border-rule bg-paper-2 px-3 py-2 text-[10px] leading-4 text-ink-2">
            “Reviewed” records consideration of a cited version only. It does
            not resolve risk, clear title or zoning, verify seller intent, or
            complete legal, engineering, environmental, or financial diligence.
          </p>
        </div>
      )}
    </section>
  );
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export type LandBasisAssumptions = {
  valuePerSellableSqft: number;
  hardCostPerGrossSqft: number;
  efficiencyPct: number;
  softCostPct: number;
  profitMarginPct: number;
};

export type LandBasisScenario = {
  key: 'downside' | 'base' | 'upside';
  label: string;
  assumptionSummary: string;
  assumptions: LandBasisAssumptions;
  grossSqft: number;
  sellableSqft: number;
  revenue: number;
  hardCost: number;
  softCost: number;
  targetProfit: number;
  landBasis: number;
  landBasisPerLotSqft: number | null;
  landBasisPerGrossSqft: number | null;
};

const DEFAULT_LAND_BASIS_ASSUMPTIONS: LandBasisAssumptions = {
  valuePerSellableSqft: 900,
  hardCostPerGrossSqft: 400,
  efficiencyPct: 80,
  softCostPct: 20,
  profitMarginPct: 15,
};

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function calculateLandBasisScenario({
  key,
  label,
  assumptionSummary,
  assumptions,
  grossSqft,
  lotSqft,
}: {
  key: LandBasisScenario['key'];
  label: string;
  assumptionSummary: string;
  assumptions: LandBasisAssumptions;
  grossSqft: number;
  lotSqft: number;
}): LandBasisScenario {
  const normalizedGrossSqft = clamp(
    grossSqft,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const normalizedLotSqft = clamp(
    lotSqft,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const normalizedAssumptions = {
    valuePerSellableSqft: clamp(
      assumptions.valuePerSellableSqft,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    hardCostPerGrossSqft: clamp(
      assumptions.hardCostPerGrossSqft,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    efficiencyPct: clamp(assumptions.efficiencyPct, 0, 100),
    softCostPct: clamp(assumptions.softCostPct, 0, 100),
    profitMarginPct: clamp(assumptions.profitMarginPct, 0, 100),
  };
  const sellableSqft =
    normalizedGrossSqft * (normalizedAssumptions.efficiencyPct / 100);
  const revenue =
    sellableSqft * normalizedAssumptions.valuePerSellableSqft;
  const hardCost =
    normalizedGrossSqft * normalizedAssumptions.hardCostPerGrossSqft;
  const softCost = hardCost * (normalizedAssumptions.softCostPct / 100);
  const targetProfit = revenue * (normalizedAssumptions.profitMarginPct / 100);
  const landBasis = Math.max(
    revenue - hardCost - softCost - targetProfit,
    0,
  );

  return {
    key,
    label,
    assumptionSummary,
    assumptions: normalizedAssumptions,
    grossSqft: normalizedGrossSqft,
    sellableSqft,
    revenue,
    hardCost,
    softCost,
    targetProfit,
    landBasis,
    landBasisPerLotSqft:
      normalizedLotSqft > 0 ? landBasis / normalizedLotSqft : null,
    landBasisPerGrossSqft:
      normalizedGrossSqft > 0 ? landBasis / normalizedGrossSqft : null,
  };
}

export function buildLandBasisScenarios({
  grossSqft,
  lotSqft,
  base,
}: {
  grossSqft: number;
  lotSqft: number;
  base: LandBasisAssumptions;
}): LandBasisScenario[] {
  return [
    calculateLandBasisScenario({
      key: 'downside',
      label: 'Downside',
      assumptionSummary:
        'Value −15% · hard cost +15% · efficiency −5 pts · soft cost +3 pts · margin +3 pts',
      grossSqft,
      lotSqft,
      assumptions: {
        valuePerSellableSqft: base.valuePerSellableSqft * 0.85,
        hardCostPerGrossSqft: base.hardCostPerGrossSqft * 1.15,
        efficiencyPct: base.efficiencyPct - 5,
        softCostPct: base.softCostPct + 3,
        profitMarginPct: base.profitMarginPct + 3,
      },
    }),
    calculateLandBasisScenario({
      key: 'base',
      label: 'Base',
      assumptionSummary: 'Uses your editable base assumptions',
      grossSqft,
      lotSqft,
      assumptions: base,
    }),
    calculateLandBasisScenario({
      key: 'upside',
      label: 'Upside',
      assumptionSummary:
        'Value +10% · hard cost −5% · efficiency +3 pts · soft cost −2 pts · same margin',
      grossSqft,
      lotSqft,
      assumptions: {
        valuePerSellableSqft: base.valuePerSellableSqft * 1.1,
        hardCostPerGrossSqft: base.hardCostPerGrossSqft * 0.95,
        efficiencyPct: base.efficiencyPct + 3,
        softCostPct: base.softCostPct - 2,
        profitMarginPct: base.profitMarginPct,
      },
    }),
  ];
}

export function LandBasisCalculator({
  row,
  defaultOpen = false,
  onAssumptionsChange,
}: {
  row: ParcelIntelRow;
  defaultOpen?: boolean;
  onAssumptionsChange?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [valuePerSqft, setValuePerSqft] = useState(
    DEFAULT_LAND_BASIS_ASSUMPTIONS.valuePerSellableSqft,
  );
  const [hardCostPerSqft, setHardCostPerSqft] = useState(
    DEFAULT_LAND_BASIS_ASSUMPTIONS.hardCostPerGrossSqft,
  );
  const [efficiencyPct, setEfficiencyPct] = useState(
    DEFAULT_LAND_BASIS_ASSUMPTIONS.efficiencyPct,
  );
  const [softCostPct, setSoftCostPct] = useState(
    DEFAULT_LAND_BASIS_ASSUMPTIONS.softCostPct,
  );
  const [profitMarginPct, setProfitMarginPct] = useState(
    DEFAULT_LAND_BASIS_ASSUMPTIONS.profitMarginPct,
  );
  const grossSqft = Math.max(row.max_floor_area_sqft ?? 0, 0);
  const lotSqft = Math.max(row.lot_area_sqft ?? 0, 0);
  const scenarios = useMemo(
    () =>
      buildLandBasisScenarios({
        grossSqft,
        lotSqft,
        base: {
          valuePerSellableSqft: valuePerSqft,
          hardCostPerGrossSqft: hardCostPerSqft,
          efficiencyPct,
          softCostPct,
          profitMarginPct,
        },
      }),
    [
      efficiencyPct,
      grossSqft,
      hardCostPerSqft,
      lotSqft,
      profitMarginPct,
      softCostPct,
      valuePerSqft,
    ],
  );
  const baseScenario = scenarios[1];
  const rangeLow = Math.min(...scenarios.map((scenario) => scenario.landBasis));
  const rangeHigh = Math.max(...scenarios.map((scenario) => scenario.landBasis));
  const assumptionsAdjusted =
    valuePerSqft !==
      DEFAULT_LAND_BASIS_ASSUMPTIONS.valuePerSellableSqft ||
    hardCostPerSqft !==
      DEFAULT_LAND_BASIS_ASSUMPTIONS.hardCostPerGrossSqft ||
    efficiencyPct !== DEFAULT_LAND_BASIS_ASSUMPTIONS.efficiencyPct ||
    softCostPct !== DEFAULT_LAND_BASIS_ASSUMPTIONS.softCostPct ||
    profitMarginPct !== DEFAULT_LAND_BASIS_ASSUMPTIONS.profitMarginPct;
  const resetAssumptions = () => {
    setValuePerSqft(
      DEFAULT_LAND_BASIS_ASSUMPTIONS.valuePerSellableSqft,
    );
    setHardCostPerSqft(
      DEFAULT_LAND_BASIS_ASSUMPTIONS.hardCostPerGrossSqft,
    );
    setEfficiencyPct(DEFAULT_LAND_BASIS_ASSUMPTIONS.efficiencyPct);
    setSoftCostPct(DEFAULT_LAND_BASIS_ASSUMPTIONS.softCostPct);
    setProfitMarginPct(DEFAULT_LAND_BASIS_ASSUMPTIONS.profitMarginPct);
  };
  const scenarioStyles: Record<
    LandBasisScenario['key'],
    {
      border: string;
      badge: string;
      Icon: typeof ArrowDownRight;
    }
  > = {
    downside: {
      border: 'border-rule bg-white',
      badge: 'bg-white text-stale',
      Icon: ArrowDownRight,
    },
    base: {
      border: 'border-rule bg-paper-2/70 ring-1 ring-rule',
      badge: 'text-ink',
      Icon: Equal,
    },
    upside: {
      border: 'border-rule bg-paper-2/70',
      badge: 'text-ink',
      Icon: ArrowUpRight,
    },
  };

  return (
    <section className="mt-4 overflow-hidden border-t border-rule bg-paper-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${FOCUS_RING}`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><Calculator className="h-4 w-4" /> Development sensitivity
        </span>
        <span className="whitespace-nowrap text-right text-xs font-semibold text-ink">
          {grossSqft > 0 && baseScenario
            ? `${compactCurrency(rangeLow)}–${compactCurrency(rangeHigh)}`
            : 'Capacity unavailable'}
        </span>
      </button>
      {open && (
        <div className="border-t border-rule p-3" data-testid="land-basis-sensitivity">
          {row.mandatory_inclusionary_housing === true && (
            <div
              className="mb-3 border-t border-rule bg-paper-2 p-3 text-xs leading-5 text-ink"
              role="alert"
              data-testid="mih-underwriting-warning"
            >
              <strong>MIH scenario required.</strong> This parcel overlaps a
              current adopted MIH mapped area. The quick estimate below does not
              model affordable-housing set-asides, option-specific economics, or
              any payment alternative. Do not rely on the land-basis result until
              those requirements are verified and modeled.
            </div>
          )}

          {grossSqft > 0 && baseScenario ? (
            <>
              <div
                className="relative overflow-hidden rounded-sm bg-white p-4 text-ink"
                data-testid="land-basis-range"
              >

                <div className="relative">
                  <div className="font-cond text-[13px] font-semibold text-ink">
                    Illustrative acquisition range
                  </div>
                  <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                    <div className="tabular-nums text-2xl font-semibold tracking-tight">
                      {compactCurrency(rangeLow)}–{compactCurrency(rangeHigh)}
                    </div>
                    <div className="rounded-sm bg-white px-2.5 py-1 text-[11px] text-ink-2">
                      Base {compactCurrency(baseScenario.landBasis)}
                    </div>
                  </div>
                  <p className="mt-2 max-w-xl text-[11px] leading-4 text-ink-2">
                    A sensitivity range, not a valuation. The three cases use the
                    same current zoning-capacity input and your explicit base
                    assumptions.
                  </p>
                </div>
              </div>

              <section
                className="mt-3 border-t border-rule bg-white p-3"
                data-testid="underwriting-assumption-editor"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h5 className="text-[13px] font-semibold text-ink">
                      Test your base case
                    </h5>
                    <p className="mt-0.5 max-w-lg text-[11px] leading-4 text-ink-2">
                      Start with the market value or construction cost you know
                      best. Defaults are illustrative, not current comps or bids.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        assumptionsAdjusted
                          ? 'text-ink'
                          : 'text-ink-2'
                      }`}
                      data-testid="underwriting-assumption-state"
                    >
                      {assumptionsAdjusted
                        ? 'Adjusted in this session'
                        : 'Illustrative defaults'}
                    </span>
                    {assumptionsAdjusted && (
                      <button
                        type="button"
                        onClick={resetAssumptions}
                        className={`inline-flex h-7 items-center gap-1 rounded-sm border border-control bg-white px-2 text-[10px] font-semibold text-ink-2 hover:bg-paper-2 ${FOCUS_RING}`}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    [
                      'Value / sellable SF',
                      valuePerSqft,
                      setValuePerSqft,
                      0,
                      undefined,
                      25,
                    ],
                    [
                      'Hard cost / gross SF',
                      hardCostPerSqft,
                      setHardCostPerSqft,
                      0,
                      undefined,
                      25,
                    ],
                    [
                      'Sellable efficiency %',
                      efficiencyPct,
                      setEfficiencyPct,
                      0,
                      100,
                      1,
                    ],
                    [
                      'Soft costs %',
                      softCostPct,
                      setSoftCostPct,
                      0,
                      100,
                      1,
                    ],
                    [
                      'Target margin %',
                      profitMarginPct,
                      setProfitMarginPct,
                      0,
                      100,
                      1,
                    ],
                  ].map(
                    ([
                      label,
                      value,
                      setter,
                      minimum,
                      maximum,
                      step,
                    ]) => (
                      <label
                        key={String(label)}
                        className="text-xs font-medium text-ink-2"
                      >
                        {String(label)}
                        <input
                          type="number"
                          min={Number(minimum)}
                          max={
                            maximum === undefined
                              ? undefined
                              : Number(maximum)
                          }
                          step={Number(step)}
                          value={Number(value)}
                          onChange={(event) => {
                            (setter as (next: number) => void)(
                              Number(event.target.value),
                            );
                            onAssumptionsChange?.();
                          }}
                          className={`field mt-1 h-9 w-full rounded-sm border border-control bg-white px-2 text-sm text-ink ${FOCUS_RING}`}
                        />
                      </label>
                    ),
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-rule p-3 ring-1 ring-inset ring-rule">
                  <div>
                    <div className="font-cond text-[13px] font-semibold text-ink">
                      Indicative maximum land basis · base case
                    </div>
                    <div className="mt-0.5 text-xl font-semibold text-ink">
                      {currency(baseScenario.landBasis)}
                    </div>
                  </div>
                  <div className="text-right text-[10px] leading-4 text-ink-2">
                    <div>{grossSqft.toLocaleString()} gross buildable SF</div>
                    <div>
                      {baseScenario.sellableSqft.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{' '}
                      sellable SF
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-3 divide-y divide-rule">
                {scenarios.map((scenario) => {
                  const style = scenarioStyles[scenario.key];
                  const Icon = style.Icon;
                  return (
                    <section
                      key={scenario.key}
                      className="border-b border-rule py-3"
                      data-testid={`land-basis-scenario-${scenario.key}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold ${style.badge}`}
                        >
                          <Icon className="h-3 w-3" />
                          {scenario.label}
                        </span>
                      </div>
                      <div className="mt-2 text-lg font-semibold tracking-tight text-ink">
                        {currency(scenario.landBasis)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-2">
                        {scenario.landBasisPerLotSqft === null
                          ? 'Lot-area basis unavailable'
                          : `${currency(scenario.landBasisPerLotSqft)} / lot SF`}
                        {' · '}
                        {scenario.landBasisPerGrossSqft === null
                          ? 'capacity basis unavailable'
                          : `${currency(scenario.landBasisPerGrossSqft)} / gross SF`}
                      </div>
                      <p className="mt-2 border-t border-ink/10 pt-2 text-[10px] leading-4 text-ink-2">
                        {scenario.assumptionSummary}
                      </p>
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-sm border border-dashed border-rule bg-white p-4 text-sm text-stale">
              Current mapped development capacity is unavailable. Verify zoning
              and lot geometry before running a land-basis sensitivity.
            </div>
          )}

          <details className="mt-3 border-t border-rule bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-ink">
              Formula, scope, and omissions
            </summary>
            <div className="mt-2 space-y-2 text-[11px] leading-5 text-ink-2">
              <p>
                Residual land basis = sellable revenue − hard costs − soft
                costs − target profit. Revenue uses sellable SF; hard costs use
                gross buildable SF. Negative residuals are displayed as $0.
              </p>
              <p>
                Capacity comes from the displayed current parcel record. This
                screen excludes financing, taxes, carrying costs,
                affordable-housing requirements, demolition, tenant
                relocation, environmental remediation, assemblage execution,
                and site-specific zoning or entitlement adjustments.
              </p>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

export function ParcelBriefActions({ row }: { row: ParcelIntelRow }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className={`inline-flex h-8 items-center gap-1.5 rounded-sm border border-control bg-white px-2.5 text-xs font-medium hover:bg-paper-2 ${FOCUS_RING}`}
      >
        <Printer className="h-3.5 w-3.5" /> Print brief
      </button>
      <button
        type="button"
        onClick={async () => {
          const url = new URL(window.location.href);
          url.searchParams.set('bbl', row.bbl);
          await navigator.clipboard?.writeText(url.toString());
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className={`inline-flex h-8 items-center gap-1.5 rounded-sm border border-control bg-white px-2.5 text-xs font-medium hover:bg-paper-2 ${FOCUS_RING}`}
      >
        <Share2 className="h-3.5 w-3.5" /> {copied ? 'Link copied' : 'Share brief'}
      </button>
    </div>
  );
}
