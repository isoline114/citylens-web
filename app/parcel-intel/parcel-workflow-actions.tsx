'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
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
  overdue: 'border-rose-400/35 bg-rose-400/10 text-rose-100',
  due_today: 'border-amber-400/35 bg-amber-400/10 text-amber-100',
  due_soon: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  scheduled: 'border-white/10 bg-white/5 text-slate-200',
  unscheduled: 'border-violet-400/30 bg-violet-400/10 text-violet-100',
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
  return item.address || `BBL ${item.bbl}`;
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
      className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:px-7"
      aria-label="Acquisition action queue"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">
            <CalendarClock className="h-4 w-4" />
            Acquisition action queue
          </div>
          <h3 className="mt-1 text-xl font-semibold">
            What needs attention next?
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Private follow-up commitments across your saved leads. Overdue work comes
            first; missing owners and stale outcome records stay visible instead of
            silently weakening the pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close action queue"
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-300" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Building your follow-up queue…
        </div>
      ) : error || !data ? (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            The action queue is temporarily unavailable.
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {mutationError && (
            <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">
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
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className="mt-1 text-xl font-semibold">{value}</div>
                <div className="mt-1 text-[11px] text-slate-400">
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
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  filter === value
                    ? 'border-white bg-white text-slate-950'
                    : 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              {data.open_records === 0
                ? 'No open acquisition leads yet. Save a parcel and assign its first action.'
                : 'No leads match this queue view.'}
            </div>
          ) : (
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {visibleItems.map((item) => (
                <article
                  key={item.bbl}
                  className={`rounded-xl border p-4 ${STATE_STYLES[item.action_state]} ${
                    item.is_snoozed ? 'opacity-70' : ''
                  }`}
                  data-testid={`workflow-action-${item.bbl}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">
                        {dueLabel(item)} · {item.borough.replaceAll('_', ' ')}
                      </div>
                      {snoozeLabel(item) && (
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                          {snoozeLabel(item)}
                        </div>
                      )}
                      <h4 className="mt-1 truncate text-sm font-semibold text-white">
                        {addressLabel(item)}
                      </h4>
                      <p className="mt-1 text-xs leading-5 opacity-90">
                        {item.next_action || 'Set a concrete next action and due date.'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectParcel(item.bbl)}
                        className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                      >
                        Open workflow
                      </button>
                      {item.requires_attention &&
                        (item.is_snoozed ? (
                          <button
                            type="button"
                            disabled={busyBbl !== null}
                            onClick={() => void updateSnooze(item, 0)}
                            className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-50"
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
                              className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-50"
                            >
                              {busyBbl === item.bbl
                                ? 'Updating…'
                                : 'Snooze 1 day'}
                            </button>
                            <button
                              type="button"
                              disabled={busyBbl !== null}
                              onClick={() => void updateSnooze(item, 7)}
                              className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-50"
                            >
                              Snooze 7 days
                            </button>
                          </>
                        ))}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded bg-black/15 px-2 py-1 capitalize">
                      {item.stage}
                    </span>
                    {item.citywide_rank && (
                      <span className="rounded bg-black/15 px-2 py-1">
                        Saved rank #{item.citywide_rank}
                      </span>
                    )}
                    {item.assignee ? (
                      <span className="inline-flex items-center gap-1 rounded bg-black/15 px-2 py-1">
                        <UserRound className="h-3 w-3" />
                        {item.assignee}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-black/15 px-2 py-1">
                        <CircleAlert className="h-3 w-3" />
                        No assignee
                      </span>
                    )}
                    {item.needs_outcome_update && (
                      <span className="rounded bg-black/15 px-2 py-1">
                        Outcome update due
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Outcome updates become due after 30 days without a recorded outcome.
            Terminal records are removed from this queue automatically.
          </p>
        </>
      )}
    </section>
  );
}
