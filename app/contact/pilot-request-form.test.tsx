import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submitPilotRequest: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    submitPilotRequest: mocks.submitPilotRequest,
  };
});

import { ApiError } from '@/lib/api';
import { PilotRequestForm } from './pilot-request-form';

beforeEach(() => {
  mocks.submitPilotRequest.mockReset();
  mocks.submitPilotRequest.mockResolvedValue({
    schema_version: 'citylens/pilot-request-receipt@v1',
    request_id: 'pr_0123456789abcdef0123456789abcdef',
    status: 'received',
    created_at: '2026-07-24T20:00:00Z',
  });
});

function fillValidRequest() {
  fireEvent.change(screen.getByLabelText('Your name'), {
    target: { value: 'Jordan Lee' },
  });
  fireEvent.change(screen.getByLabelText('Work email'), {
    target: { value: 'jordan@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Company'), {
    target: { value: 'Example Development' },
  });
  fireEvent.change(screen.getByLabelText('Role'), {
    target: { value: 'Acquisitions director' },
  });
  fireEvent.click(screen.getByLabelText('Brooklyn'));
  fireEvent.click(screen.getByLabelText('Queens'));
  fireEvent.change(
    screen.getByLabelText(
      'What does your acquisition workflow look like today?',
    ),
    {
      target: {
        value:
          'We need a shared development-site review and outreach workflow.',
      },
    },
  );
  fireEvent.click(
    screen.getByLabelText(/I agree that CityLens may use these details/i),
  );
}

describe('PilotRequestForm', () => {
  it('submits a bounded request and shows a durable receipt', async () => {
    render(<PilotRequestForm initialPlan="concierge" />);
    expect(screen.getByLabelText(/Concierge team/i)).toBeChecked();
    fillValidRequest();

    fireEvent.click(
      screen.getByRole('button', { name: 'Request the working session' }),
    );

    await waitFor(() =>
      expect(mocks.submitPilotRequest).toHaveBeenCalledTimes(1),
    );
    const [payload, idempotencyKey] =
      mocks.submitPilotRequest.mock.calls[0];
    expect(payload).toEqual({
      schema_version: 'citylens/pilot-request@v1',
      plan: 'concierge',
      name: 'Jordan Lee',
      work_email: 'jordan@example.com',
      company: 'Example Development',
      role: 'Acquisitions director',
      team_size: '2-5',
      target_boroughs: ['brooklyn', 'queens'],
      workflow_summary:
        'We need a shared development-site review and outreach workflow.',
      consent: true,
      website: '',
    });
    expect(idempotencyKey).toMatch(/^pilot-[A-Za-z0-9-]{12,}$/);
    expect(JSON.stringify(payload)).not.toMatch(
      /client_ip|user_agent|referrer|page_url|utm_/i,
    );
    expect(await screen.findByTestId('pilot-request-success')).toHaveTextContent(
      'pr_0123456789abcdef0123456789abcdef',
    );
  });

  it('requires a borough before calling the API', async () => {
    render(<PilotRequestForm initialPlan="acquisitions" />);
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Request the working session' })
        .closest('form')!,
    );

    expect(
      await screen.findByText('Select at least one target borough.'),
    ).toBeInTheDocument();
    expect(mocks.submitPilotRequest).not.toHaveBeenCalled();
  });

  it('keeps the form usable when the public endpoint throttles', async () => {
    mocks.submitPilotRequest.mockRejectedValue(
      new ApiError('Rate limit exceeded', { status: 429 }),
    );
    render(<PilotRequestForm initialPlan="acquisitions" />);
    fillValidRequest();

    fireEvent.click(
      screen.getByRole('button', { name: 'Request the working session' }),
    );

    expect(
      await screen.findByText(/Too many requests were submitted/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveValue(
      'jordan@example.com',
    );
    expect(
      screen.getByRole('button', { name: 'Request the working session' }),
    ).toBeEnabled();
  });
});
