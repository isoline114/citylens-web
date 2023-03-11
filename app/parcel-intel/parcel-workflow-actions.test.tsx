import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParcelWorkflowActions } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  getActions: vi.fn(),
  snooze: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelWorkflowActions: mocks.getActions,
    snoozeParcelWorkflowReminder: mocks.snooze,
  };
});

import { ParcelWorkflowActionsPanel } from './parcel-workflow-actions';

function actionResponse(): ParcelWorkflowActions {
  return {
    schema_version: 'citylens/parcel-workflow-actions@v1',
    generated_at: '2026-07-24T14:00:00Z',
    total_records: 3,
    open_records: 2,
    completed_records: 1,
    overdue_count: 1,
    due_today_count: 0,
    due_soon_count: 0,
    scheduled_count: 0,
    unscheduled_count: 1,
    unassigned_count: 1,
    outcome_update_due_count: 1,
    attention_count: 2,
    snoozed_count: 0,
    complete_plan_count: 1,
    plan_coverage_rate: 0.5,
    assigned_count: 1,
    assignee_coverage_rate: 0.5,
    outcome_current_count: 1,
    outcome_current_rate: 0.5,
    items: [
      {
        bbl: '3020960069',
        borough: 'brooklyn',
        address: '100 E 21 STREET',
        stage: 'reviewing',
        outcome: 'unknown',
        assignee: 'Acquisitions',
        next_action: 'Call owner',
        next_action_due_date: '2026-07-22',
        action_state: 'overdue',
        days_overdue: 2,
        days_since_update: 10,
        needs_assignee: false,
        needs_outcome_update: true,
        requires_attention: true,
        reminder_snoozed_until: null,
        is_snoozed: false,
        citywide_rank: 82,
        priority_tier: 'highest',
        opportunity_category: 'ground_up_candidate',
        saved_at: '2026-06-01T14:00:00Z',
        updated_at: '2026-07-14T14:00:00Z',
      },
      {
        bbl: '4012340056',
        borough: 'queens',
        address: null,
        stage: 'new',
        outcome: 'unknown',
        assignee: null,
        next_action: null,
        next_action_due_date: null,
        action_state: 'unscheduled',
        days_overdue: 0,
        days_since_update: 3,
        needs_assignee: true,
        needs_outcome_update: false,
        requires_attention: true,
        reminder_snoozed_until: null,
        is_snoozed: false,
        citywide_rank: 145,
        priority_tier: 'high',
        opportunity_category: 'vacant_site',
        saved_at: '2026-07-20T14:00:00Z',
        updated_at: '2026-07-21T14:00:00Z',
      },
    ],
  };
}

describe('ParcelWorkflowActionsPanel', () => {
  beforeEach(() => {
    mocks.getActions.mockReset();
    mocks.getActions.mockResolvedValue(actionResponse());
    mocks.snooze.mockReset();
    mocks.snooze.mockResolvedValue({
      bbl: '3020960069',
      reminder_snoozed_until: '2026-07-25T14:00:00Z',
      is_snoozed: true,
    });
  });

  it('prioritizes overdue work and opens the parcel workflow', async () => {
    const onSelectParcel = vi.fn();
    render(
      <ParcelWorkflowActionsPanel
        onClose={vi.fn()}
        onSelectParcel={onSelectParcel}
      />,
    );

    expect(
      await screen.findByText('What needs attention next?'),
    ).toBeInTheDocument();
    expect(screen.getByText('100 E 21 STREET')).toBeInTheDocument();
    expect(screen.getByText('2 days overdue · brooklyn')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('workflow-action-3020960069')).getByText(
        'Outcome update due',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Saved rank #82')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open workflow' })[0],
    );
    expect(onSelectParcel).toHaveBeenCalledWith('3020960069');
  });

  it('filters to records without a complete follow-up plan', async () => {
    render(
      <ParcelWorkflowActionsPanel
        onClose={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    await screen.findByText('100 E 21 STREET');
    fireEvent.click(screen.getByRole('button', { name: 'Needs plan 1' }));

    expect(screen.queryByText('100 E 21 STREET')).not.toBeInTheDocument();
    expect(screen.getByText('BBL 4012340056')).toBeInTheDocument();
    expect(
      screen.getByText('Set a concrete next action and due date.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No assignee')).toBeInTheDocument();
  });

  it('snoozes the current reminder identity and refreshes the queue', async () => {
    const next = actionResponse();
    next.attention_count = 1;
    next.snoozed_count = 1;
    next.items[0] = {
      ...next.items[0],
      reminder_snoozed_until: '2026-07-25T14:00:00Z',
      is_snoozed: true,
    };
    mocks.getActions
      .mockResolvedValueOnce(actionResponse())
      .mockResolvedValueOnce(next);

    render(
      <ParcelWorkflowActionsPanel
        onClose={vi.fn()}
        onSelectParcel={vi.fn()}
      />,
    );

    const card = await screen.findByTestId('workflow-action-3020960069');
    fireEvent.click(within(card).getByRole('button', { name: 'Snooze 1 day' }));

    await waitFor(() =>
      expect(mocks.snooze).toHaveBeenCalledWith('3020960069', 1),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Snoozed 1' }));
    expect(
      await screen.findByRole('button', { name: 'Restore reminder' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Snoozed until Jul 25/i)).toBeInTheDocument();
  });
});
