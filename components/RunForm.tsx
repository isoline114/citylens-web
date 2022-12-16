'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { createRun, ApiError, getFeaturedDemos, type DemoFeaturedRun } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  buildCitylensCreateRunPayload,
  citylensCreateRunSchema,
  type CitylensCreateRunInput,
} from '@/lib/validation';
import { rememberRecentRun } from '@/lib/storage';

const DEFAULTS: CitylensCreateRunInput = {
  address: '',
  imagery_year: 2024,
  baseline_year: 2017,
  segmentation_backend: 'sam2',
  outputs: ['previews', 'change', 'mesh'],
  notes: undefined,
};

export type RunFormProps = {
  /** Optional pre-fetched featured demos (e.g. from a Server Component). When
   *  provided, the form skips its own client-side fetch and uses these
   *  immediately, so SSR HTML already shows the populated dropdown. */
  initialFeatured?: DemoFeaturedRun[];
};

export function RunForm({ initialFeatured }: RunFormProps = {}) {
  const router = useRouter();
  const auth = useAuth();
  const [form, setForm] = useState<CitylensCreateRunInput>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  // Tri-state demo loading: 'loading' | 'loaded' | 'error'. Initialize as
  // 'loaded' if the parent passed pre-fetched demos (so we never render the
  // empty/error state during the initial paint). Otherwise start in
  // 'loading' so SSR/cold-mount shows a neutral skeleton, never the
  // crawler-hostile "no demos" message.
  const [featured, setFeatured] = useState<DemoFeaturedRun[]>(initialFeatured ?? []);
  const hasInitial = Array.isArray(initialFeatured) && initialFeatured.length > 0;
  const [featuredStatus, setFeaturedStatus] = useState<'loading' | 'loaded' | 'error'>(
    hasInitial ? 'loaded' : 'loading',
  );
  const [selectedDemoRunId, setSelectedDemoRunId] = useState<string>('');

  const signedIn = auth.status === 'authenticated';

  useEffect(() => {
    // Skip the client fetch only if the server already gave us a populated
    // list. If SSR fetched 0 demos (rare — API outage, network policy, e2e
    // test environment without internet) fall back to the client path so
    // we still discover demos at runtime and so Playwright route mocks
    // still apply during e2e.
    if (hasInitial) return;
    let alive = true;
    setFeaturedStatus('loading');
    getFeaturedDemos()
      .then((rows) => {
        if (!alive) return;
        setFeatured(rows);
        setFeaturedStatus('loaded');
      })
      .catch(() => {
        if (!alive) return;
        setFeaturedStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [hasInitial]);

  const canSubmit = useMemo(() => signedIn && !submitting, [signedIn, submitting]);

  function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  function demoRunId(d: DemoFeaturedRun): string | null {
    const id = (typeof d.run_id === 'string' ? d.run_id : undefined) ?? (typeof d.id === 'string' ? d.id : undefined);
    return id && id.trim().length > 0 ? id : null;
  }

  function demoLabel(d: DemoFeaturedRun): string {
    const id = demoRunId(d) ?? 'unknown';
    const title = typeof d.title === 'string' ? d.title : undefined;
    const label = typeof d.label === 'string' ? d.label : undefined;
    const address = typeof d.address === 'string' ? d.address : undefined;
    return (title ?? label ?? address ?? id).trim();
  }

  function setField<K extends keyof CitylensCreateRunInput>(
    key: K,
    value: CitylensCreateRunInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleOutput(value: 'previews' | 'change' | 'mesh') {
    setForm((prev) => {
      const set = new Set(prev.outputs);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, outputs: Array.from(set) as CitylensCreateRunInput['outputs'] };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!signedIn) {
      router.push('/sign-in');
      return;
    }

    const parsed = citylensCreateRunSchema.safeParse({
      ...form,
      address: form.address.trim(),
      notes: form.notes?.trim() ? form.notes.trim() : undefined,
    });

    if (!parsed.success) {
      toast.error('Invalid request', {
        description: parsed.error.issues.map((i) => i.message).join(' · '),
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildCitylensCreateRunPayload(parsed.data);
      const { runId } = await createRun(payload);
      rememberRecentRun(runId);
      toast.success('Run created', { description: runId });
      router.push(`/runs/${encodeURIComponent(runId)}`);
    } catch (err: unknown) {
      const apiErr = err instanceof ApiError ? err : null;
      const status = apiErr?.status;
      if (status === 401) {
        toast.error('Sign in required', {
          description: 'Your session expired. Sign in to create runs.',
        });
        router.push('/sign-in');
      } else if (status === 429) {
        const detail = readQuotaDetail(apiErr?.body);
        const description = quotaDescription(detail);
        toast.error('Monthly quota reached', { description });
      } else if (apiErr) {
        toast.error('Failed to create run', { description: apiErr.message });
      } else {
        toast.error('Failed to create run', { description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Featured demos</span>
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          value={selectedDemoRunId}
          onChange={(e) => {
            const nextRunId = e.target.value;
            setSelectedDemoRunId(nextRunId);
            if (!nextRunId) return;

            const chosen = featured.find((d) => demoRunId(d) === nextRunId);
            const req: Record<string, unknown> =
              chosen?.request && typeof chosen.request === 'object'
                ? (chosen.request as Record<string, unknown>)
                : {};

            const nextAddress =
              (typeof chosen?.address === 'string' ? chosen.address : undefined) ??
              (typeof req.address === 'string' ? (req.address as string) : undefined);

            setForm((prev) => ({
              ...prev,
              address: nextAddress ?? prev.address,
            }));

            router.push(`/runs/${encodeURIComponent(nextRunId)}?demo=1`);
          }}
          aria-label="Select a featured demo run"
        >
          <option value="">
            {featuredStatus === 'loading' ? 'Loading demos…' : 'Select a demo run…'}
          </option>
          {featured
            .map((d) => ({ d, id: demoRunId(d) }))
            .filter((x): x is { d: DemoFeaturedRun; id: string } => Boolean(x.id))
            .map(({ d, id }) => (
              <option key={id} value={id}>
                {demoLabel(d)}
              </option>
            ))}
        </select>
        {featuredStatus === 'error' && (
          <div className="text-xs text-slate-600">
            Featured demos are temporarily unavailable. You can still sign in to create a run.
          </div>
        )}
        {featuredStatus === 'loaded' && featured.length === 0 && (
          <div className="text-xs text-slate-600">
            Featured demos are temporarily unavailable. You can still sign in to create a run.
          </div>
        )}
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium">Address</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="350 5th Ave, New York, NY"
            required
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Imagery year</span>
          <div
            data-testid="imagery-year-chip"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            2024
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Baseline year</span>
          <div
            data-testid="baseline-year-chip"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            2017
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Segmentation</span>
          <div
            data-testid="segmentation-chip"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            SAM2
          </div>
          <div className="text-xs text-slate-500">Public MVP supports SAM2 only.</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Outputs</div>
        <div className="flex flex-wrap gap-3">
          {(['previews', 'change', 'mesh'] as const).map((o) => {
            const checked = form.outputs.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOutput(o)}
                />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
        <div className="text-xs text-slate-500">At least one output is required.</div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Notes (optional)</span>
        <textarea
          className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          value={form.notes ?? ''}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Anything you want to remember about this run"
        />
      </label>

      <div className="flex items-center gap-3">
        {signedIn ? (
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create run'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign up — free
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Sign in
            </Link>
            <span className="text-xs text-slate-600">
              Free account: 5 runs/month. Public demos above need no account.
            </span>
          </div>
        )}
      </div>
    </form>
  );
}

type QuotaDetail = {
  message?: string;
  monthly_run_limit?: number;
  runs_remaining?: number;
  runs_used?: number;
  month_key?: string;
  plan_type?: string;
  code?: string;
};

function readQuotaDetail(body: unknown): QuotaDetail | null {
  if (!body || typeof body !== 'object') return null;
  const detail = (body as { detail?: unknown }).detail;
  if (!detail || typeof detail !== 'object') return null;
  return detail as QuotaDetail;
}

function quotaDescription(detail: QuotaDetail | null): string {
  if (!detail) return 'Try again later or upgrade your plan.';
  if (detail.message) return detail.message;
  if (typeof detail.monthly_run_limit === 'number') {
    return `Free plan includes ${detail.monthly_run_limit} runs per month.`;
  }
  return 'Monthly quota reached.';
}
