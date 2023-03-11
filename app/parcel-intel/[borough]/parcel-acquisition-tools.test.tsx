import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowEditor } from './parcel-acquisition-tools';

describe('WorkflowEditor', () => {
  it('requires a concrete action before saving a due date', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkflowEditor
        item={null}
        busy={false}
        onSave={onSave}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Due date'), {
      target: { value: '2026-07-30' },
    });
    expect(
      screen.getByText('Add a concrete next action before setting its due date.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to pipeline' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Next action'), {
      target: { value: 'Call owner' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to pipeline' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          next_action: 'Call owner',
          next_action_due_date: '2026-07-30',
        }),
      ),
    );
  });
});
