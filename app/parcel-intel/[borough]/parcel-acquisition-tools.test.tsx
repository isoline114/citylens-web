import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ParcelIntelRow } from '@/lib/api';
import {
  LandBasisCalculator,
  WorkflowEditor,
} from './parcel-acquisition-tools';

describe('WorkflowEditor', () => {
  it('prefills a server-recommended diligence action without saving it automatically', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkflowEditor
        item={null}
        suggestedNextAction="Verify the official project record before outreach."
        busy={false}
        onSave={onSave}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Next action')).toHaveValue(
      'Verify the official project record before outreach.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

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

describe('LandBasisCalculator', () => {
  it('warns that a mapped MIH parcel needs an affordability scenario', () => {
    render(
      <LandBasisCalculator
        row={
          {
            max_floor_area_sqft: 20_000,
            mandatory_inclusionary_housing: true,
          } as ParcelIntelRow
        }
        defaultOpen
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('MIH scenario required');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'does not model affordable-housing set-asides',
    );
  });
});
