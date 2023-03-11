import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActions: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getParcelWorkflowActions: mocks.getActions,
  };
});

import { ParcelWorkflowActionsPanel } from './parcel-workflow-actions';

function actionResponse() {
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
});
