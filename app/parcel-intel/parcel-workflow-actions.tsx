'use client';

import { formatAddress, formatBbl } from '@/lib/parcel-format';
import { useEffect, useMemo, useState } from 'react';
import {
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react';

import {
  getParcelWorkflowActions,
  snoozeParcelWorkflowReminder,
  type ParcelWorkflowActionItem,
  type ParcelWorkflowActions,
} from '@/lib/api';

type ActionFilter =
  | 'attention'
  | 'all'
  | 'urgent'
  | 'unplanned'
  | 'outcomes'
  | 'snoozed';

const STATE_STYLES: Record<ParcelWorkflowActionItem['action_state'], string> = {
  overdue: 'border-rule bg-white text-ink',
  due_today: 'border-rule bg-white text-ink',
  due_soon: 'border-rule bg-paper-2 text-ink',
  scheduled: 'border-rule bg-white text-ink',
  unscheduled: 'border-rule bg-white text-ink-3',
};

function dueLabel(item: ParcelWorkflowActionItem): string {
  if (item.action_state === 'overdue') {
    return `${item.days_overdue} day${item.days_overdue === 1 ? '' : 's'} overdue`;
  }
  if (item.action_state === 'due_today') return 'Due today';
  if (!item.next_action_due_date) return 'No due date';
  return `Due ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${item.next_action_due_date}T00:00:00Z`))}`;
}

function addressLabel(item: ParcelWorkflowActionItem): string {
  return formatAddress(item.address) || `BBL ${formatBbl(item.bbl)}`;
}

function coverageLabel(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

function snoozeLabel(item: ParcelWorkflowActionItem): string | null {
  if (!item.is_snoozed || !item.reminder_snoozed_until) return null;
  return `Snoozed until ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(item.reminder_snoozed_until))}`;
}

export function ParcelWorkflowActionsPanel({
  onClose,
  onSelectParcel,
  onDataChange,
}: {
  onClose: () => void;
  onSelectParcel: (bbl: string) => void;
  onDataChange?: (data: ParcelWorkflowActions) => void;
}) {
  const [data, setData] = useState<ParcelWorkflowActions | null>(null);
  const [filter, setFilter] = useState<ActionFilter>('attention');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mutationError, setMutationError] = useState(false);
  const [busyBbl, setBusyBbl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getParcelWorkflowActions()
      .then((next) => {
        if (!cancelled) {
          setData(next);
          onDataChange?.(next);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onDataChange, reloadKey]);

  const visibleItems = useMemo(() => {
    const items = data?.items ?? [];
    if (filter === 'attention') {
      return items.filter((item) => item.requires_attention && !item.is_snoozed);
    }
    if (filter === 'urgent') {
      return items.filter(
        (item) =>
          !item.is_snoozed &&
          ['overdue', 'due_today', 'due_soon'].includes(item.action_state),
      );
    }
    if (filter === 'unplanned') {
      return items.filter(
        (item) =>
          !item.is_snoozed &&
          (item.action_state === 'unscheduled' || item.needs_assignee),
      );
    }
    if (filter === 'outcomes') {
      return items.filter(
        (item) => !item.is_snoozed && item.needs_outcome_update,
      );
    }
    if (filter === 'snoozed') {
      return items.filter((item) => item.is_snoozed);
    }
    return items;
  }, [data, filter]);

  const updateSnooze = async (
    item: ParcelWorkflowActionItem,
    days: 0 | 1 | 7,
  ) => {
    if (busyBbl) return;
    setBusyBbl(item.bbl);
    setMutationError(false);
    try {
      await snoozeParcelWorkflowReminder(item.bbl, days);
      const next = await getParcelWorkflowActions();
      setData(next);
      onDataChange?.(next);
    } catch {
      setMutationError(true);
    } finally {
      setBusyBbl(null);
    }
  };

  return (
    <section
      id="parcel-action-queue"
      className="border-b border-rule bg-white px-4 py-5 text-ink md:px-7"
      aria-label="Acquisition action queue"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="mt-1 text-xl font-semibold">
            What needs attention next?
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-3">
            Private follow-up commitments across your saved leads. Overdue work comes
            first; missing owners and stale outcome records stay visible instead of
            silently weakening the pipeline.
          </p>
        </div>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Close action queue"
          className="self-end rounded-sm border border-control p-2 text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:self-auto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-3" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Building your follow-up queue…
        </div>
      ) : error || !data ? (
        <div
          className="mt-5 flex flex-col gap-3 border-b border-rule bg-white p-4 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            The action queue is temporarily unavailable.
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-sm border border-rule px-2.5 py-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="workflow-actions-announcer"
          >
            {visibleItems.length.toLocaleString()}{' '}
            {visibleItems.length === 1 ? 'lead' : 'leads'} in the {filter}{' '}
            action queue.
          </div>
          {mutationError && (
            <div className="mt-4 border-b border-rule bg-white p-3 text-sm text-ink" role="alert">
              The reminder could not be updated. Retry, or open the parcel workflow.
            </div>
          )}
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: 'Needs attention',
                value: data.attention_count.toLocaleString(),
                detail: `${data.snoozed_count} snoozed`,
              },
              {
                label: 'Plan coverage',
                value: coverageLabel(data.plan_coverage_rate),
                detail: `${data.complete_plan_count} of ${data.open_records} open`,
              },
              {
                label: 'Assignee coverage',
                value: coverageLabel(data.assignee_coverage_rate),
                detail: `${data.assigned_count} of ${data.open_records} open`,
              },
              {
                label: 'Outcome current',
                value: coverageLabel(data.outcome_current_rate),
                detail: `${data.outcome_current_count} of ${data.open_records} open`,
              },
              {
                label: 'Overdue',
                value: data.overdue_count.toLocaleString(),
                detail: `${data.due_today_count + data.due_soon_count} due within 7 days`,
              },
            ].map(({ label, value, detail }) => (
              <div
                key={label}
                className="border-b border-rule px-3 py-3"
              >
                <div className="font-cond text-[13px] text-ink-3">
                  {label}
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
                <div className="mt-1 text-xs text-ink-3">
                  {detail}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Action queue filters">
            {([
              ['attention', `Attention ${data.attention_count}`],
              ['all', `All ${data.open_records}`],
              [
                'urgent',
                `Due soon ${data.overdue_count + data.due_today_count + data.due_soon_count}`,
              ],
              ['unplanned', `Needs plan ${data.unscheduled_count}`],
              ['outcomes', `Needs outcome ${data.outcome_update_due_count}`],
              ['snoozed', `Snoozed ${data.snoozed_count}`],
            ] as Array<[ActionFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
                  filter === value
                    ? 'border-ink bg-paper-2 text-ink'
                    : 'border-control text-ink-3 hover:bg-paper-2 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <div className="mt-4 border-b border-rule bg-paper-2 p-4 text-sm text-ink">
              {data.open_records === 0
                ? 'No open acquisition leads yet. Save a parcel and assign its first action.'
                : 'No leads match this queue view.'}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-rule">
              {visibleItems.map((item) => (
                <article
                  key={item.bbl}
                  className={`py-4 ${STATE_STYLES[item.action_state]} ${
                    item.is_snoozed ? 'bg-paper-2' : ''
                  }`}
                  data-testid={`workflow-action-${item.bbl}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-ink-3">
                        {dueLabel(item)} · {item.borough.replaceAll('_', ' ')}
                      </div>
                      {snoozeLabel(item) && (
                        <div className="font-cond mt-1 text-[13px] font-semibold text-ink-3">
                          {snoozeLabel(item)}
                        </div>
                      )}
                      <h4 className={`mt-1 break-words text-sm font-semibold text-ink ${!item.address ? 'font-mono' : ''}`}>
                        {addressLabel(item)}
                      </h4>
                      <p className="mt-1 text-xs leading-5">
                        {item.next_action || 'Set a concrete next action and due date.'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectParcel(item.bbl)}
                        className="rounded-sm border border-control px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-paper-2"
                      >
                        Open workflow
                      </button>
                      {item.requires_attention &&
                        (item.is_snoozed ? (
                          <button
                            type="button"
                            disabled={busyBbl !== null}
                            onClick={() => void updateSnooze(item, 0)}
                            className="rounded-sm border border-control px-2.5 py-1.5 text-xs text-ink hover:bg-paper-2 disabled:opacity-50"
                          >
                            {busyBbl === item.bbl
                              ? 'Updating…'
                              : 'Restore reminder'}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busyBbl !== null}
                              onClick={() => void updateSnooze(item, 1)}
                              className="rounded-sm border border-control px-2.5 py-1.5 text-xs text-ink hover:bg-paper-2 disabled:opacity-50"
                            >
                              {busyBbl === item.bbl
                                ? 'Updating…'
                                : 'Snooze 1 day'}
                            </button>
                            <button
                              type="button"
                              disabled={busyBbl !== null}
                              onClick={() => void updateSnooze(item, 7)}
                              className="rounded-sm border border-control px-2.5 py-1.5 text-xs text-ink hover:bg-paper-2 disabled:opacity-50"
                            >
                              Snooze 7 days
                            </button>
                          </>
                        ))}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span className="px-2 py-1 capitalize">
                      {item.stage}
                    </span>
                    {item.citywide_rank && (
                      <span className="px-2 py-1">
                        Saved rank #{item.citywide_rank}
                      </span>
                    )}
                    {item.assignee ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1">
                        <UserRound className="h-3 w-3" />
                        {item.assignee}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1">
                        <CircleAlert className="h-3 w-3" />
                        No assignee
                      </span>
                    )}
                    {item.needs_outcome_update && (
                      <span className="px-2 py-1">
                        Outcome update due
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="mt-3 font-mono text-xs text-ink-3">Private workflow as of {data.generated_at}</p>
          <p className="mt-3 text-xs text-ink-3">
            Outcome updates become due after 30 days without a recorded outcome.
            Terminal records are removed from this queue automatically.
          </p>
        </>
      )}
    </section>
  );
}
