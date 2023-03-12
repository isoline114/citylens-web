'use client';

import { FormEvent, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

import {
  ApiError,
  submitPilotRequest,
  type PilotBorough,
  type PilotPlan,
  type PilotRequestReceipt,
} from '@/lib/api';

const BOROUGHS: Array<{ value: PilotBorough; label: string }> = [
  { value: 'manhattan', label: 'Manhattan' },
  { value: 'brooklyn', label: 'Brooklyn' },
  { value: 'queens', label: 'Queens' },
  { value: 'bronx', label: 'Bronx' },
  { value: 'staten_island', label: 'Staten Island' },
];

function createIdempotencyKey(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `pilot-${crypto.randomUUID()}`;
  }
  return `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function submissionError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many requests were submitted from this network. Please wait and try again, or email hello@citylens.dev.';
  }
  if (error instanceof ApiError && error.status === 422) {
    return 'Please check the highlighted fields and submit again.';
  }
  return 'We could not securely submit your request. Your entries are still here—please try again or email hello@citylens.dev.';
}

export function PilotRequestForm({
  initialPlan,
}: {
  initialPlan: PilotPlan;
}) {
  const [plan, setPlan] = useState<PilotPlan>(initialPlan);
  const [boroughs, setBoroughs] = useState<PilotBorough[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PilotRequestReceipt | null>(null);
  const idempotencyKey = useRef(createIdempotencyKey());

  const toggleBorough = (borough: PilotBorough) => {
    setBoroughs((current) =>
      current.includes(borough)
        ? current.filter((item) => item !== borough)
        : [...current, borough],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (boroughs.length === 0) {
      setError('Select at least one target borough.');
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitPilotRequest(
        {
          schema_version: 'citylens/pilot-request@v1',
          plan,
          name: String(form.get('name') ?? ''),
          work_email: String(form.get('work_email') ?? ''),
          company: String(form.get('company') ?? ''),
          role: String(form.get('role') ?? ''),
          team_size: String(form.get('team_size') ?? '1') as
            | '1'
            | '2-5'
            | '6-20'
            | '21+',
          target_boroughs: boroughs,
          workflow_summary: String(form.get('workflow_summary') ?? ''),
          consent: true,
          website: String(form.get('website') ?? ''),
        },
        idempotencyKey.current,
      );
      setReceipt(response);
    } catch (submissionFailure) {
      setError(submissionError(submissionFailure));
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div
        className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
        data-testid="pilot-request-success"
        role="status"
      >
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <h3 className="mt-4 text-xl font-semibold text-emerald-950">
          Your request is in the queue.
        </h3>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          We&apos;ll review the workflow and reply personally at the email you
          provided. Keep this reference if you contact us directly:{' '}
          <span className="font-mono font-semibold">{receipt.request_id}</span>.
        </p>
        <Link
          href="/parcel-intel"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-emerald-950 px-4 text-sm font-medium text-white hover:bg-emerald-900"
        >
          Explore Parcel Intelligence
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
      <fieldset>
        <legend className="text-sm font-medium text-slate-900">
          Pilot track
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            {
              value: 'acquisitions' as const,
              label: 'Acquisitions',
              detail: '$399 / user / month',
            },
            {
              value: 'concierge' as const,
              label: 'Concierge team',
              detail: 'From $1,500 / month',
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                plan === option.value
                  ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="plan"
                value={option.value}
                checked={plan === option.value}
                onChange={() => setPlan(option.value)}
              />
              <span className="block text-sm font-semibold text-slate-950">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-600">
                {option.detail}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field
          label="Work email"
          name="work_email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Company"
          name="company"
          autoComplete="organization"
          required
        />
        <Field
          label="Role"
          name="role"
          autoComplete="organization-title"
          placeholder="Acquisitions director"
        />
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-900">Team size</span>
        <select
          name="team_size"
          defaultValue="2-5"
          className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        >
          <option value="1">1 person</option>
          <option value="2-5">2–5 people</option>
          <option value="6-20">6–20 people</option>
          <option value="21+">21+ people</option>
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-slate-900">
          Target boroughs
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOROUGHS.map((borough) => {
            const selected = boroughs.includes(borough.value);
            return (
              <label
                key={borough.value}
                data-testid={`pilot-borough-${borough.value}`}
                className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-medium transition ${
                  selected
                    ? 'border-sky-500 bg-sky-50 text-sky-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  name="target_boroughs"
                  value={borough.value}
                  checked={selected}
                  onChange={() => toggleBorough(borough.value)}
                />
                {borough.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-slate-900">
          What does your acquisition workflow look like today?
        </span>
        <textarea
          name="workflow_summary"
          rows={5}
          minLength={20}
          maxLength={1200}
          required
          placeholder="How you find sites, who reviews them, where diligence slows down, and what would make a pilot valuable…"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </label>

      <div
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
        />
        <span className="text-xs leading-5 text-slate-600">
          I agree that CityLens may use these details to evaluate and respond
          to this pilot request. See the{' '}
          <Link
            className="font-medium text-sky-700 hover:underline"
            href="/privacy"
          >
            privacy notice
          </Link>
          .
        </span>
      </label>

      {error && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'Submitting securely…' : 'Request the working session'}
      </button>

      <p className="text-center text-[11px] leading-5 text-slate-500">
        No payment is collected. Submissions expire after 365 days unless a
        customer relationship or legal requirement calls for a different
        retention period.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        maxLength={type === 'email' ? 254 : 120}
        className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}
