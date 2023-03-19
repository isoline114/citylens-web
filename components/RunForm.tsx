'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  createRun,
  ApiError,
  getFeaturedDemos,
  getRunOptions,
  type DemoFeaturedRun,
  type RunOptions,
} from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
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
  /** Keep public demo discovery on the homepage while allowing the account
   *  workspace to focus only on a new processing request. */
  showFeaturedDemos?: boolean;
  submitLabel?: string;
  /** Optional session-scoped address carried from parcel qualification. */
  initialAddress?: string;
};

const OUTPUT_OPTIONS = [
  {
    value: 'previews',
    label: 'Imagery preview',
    description: 'Review-ready context image',
  },
  {
    value: 'change',
    label: 'Change evidence',
    description: 'Mapped building change',
  },
  {
    value: 'mesh',
    label: '3D massing',
    description: 'Downloadable site geometry',
  },
] as const;

export function RunForm({
  initialFeatured,
  showFeaturedDemos = true,
  submitLabel = 'Create run',
  initialAddress,
}: RunFormProps = {}) {
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
  // Server-locked run options (imagery/baseline year, backend). Fetched on
  // mount so the locked chips reflect what the server will actually enforce;
  // on any error we keep the hardcoded fallbacks below.
  const [runOptions, setRunOptions] = useState<RunOptions | null>(null);

  const signedIn = auth.status === 'authenticated';

  useEffect(() => {
    const address = initialAddress?.trim();
    if (!address) return;
    setForm((current) =>
      current.address.trim() ? current : { ...current, address },
    );
  }, [initialAddress]);

  useEffect(() => {
    let alive = true;
    getRunOptions()
      .then((opts) => {
        if (alive && opts?.defaults) setRunOptions(opts);
      })
      .catch(() => {
        // Fall back to the hardcoded defaults — chips still render.
      });
    return () => {
      alive = false;
    };
  }, []);

  const lockedImageryYear = runOptions?.defaults?.imagery_year ?? DEFAULTS.imagery_year;
  const lockedBaselineYear = runOptions?.defaults?.baseline_year ?? DEFAULTS.baseline_year;
  const lockedBackend = (
    runOptions?.defaults?.segmentation_backend ?? DEFAULTS.segmentation_backend
  ).toUpperCase();

  useEffect(() => {
    // Skip the client fetch only if the server already gave us a populated
    // list. If SSR fetched 0 demos (rare — API outage, network policy, e2e
    // test environment without internet) fall back to the client path so
    // we still discover demos at runtime and so Playwright route mocks
    // still apply during e2e.
    if (!showFeaturedDemos || hasInitial) return;
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
  }, [hasInitial, showFeaturedDemos]);

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
      // No PII in the payload — deliberately not the address or run id.
      trackEvent('run_created');
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
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      data-testid="run-form"
    >
      {showFeaturedDemos && (
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
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium">Address</span>
          <input
            data-testid="run-address-input"
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
            {lockedImageryYear}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Baseline year</span>
          <div
            data-testid="baseline-year-chip"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {lockedBaselineYear}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Segmentation</span>
          <div
            data-testid="segmentation-chip"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {lockedBackend}
          </div>
          <div className="text-xs text-slate-500">
            Server-locked for reproducibility.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Outputs</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {OUTPUT_OPTIONS.map((option) => {
            const checked = form.outputs.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3 text-sm transition-colors ${
                  checked
                    ? 'border-sky-300 bg-sky-50 text-sky-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOutput(option.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.description}
                  </span>
                </span>
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
          placeholder="Purpose, assumptions, or review owner"
        />
      </label>

      <div className="flex items-center gap-3">
        {signedIn ? (
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Starting…' : submitLabel}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up?next=%2Fruns%2Fnew"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign up — free
            </Link>
            <Link
              href="/sign-in?next=%2Fruns%2Fnew"
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
