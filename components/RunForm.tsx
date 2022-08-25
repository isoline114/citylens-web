'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { createRun, ApiError, getFeaturedDemos, type DemoFeaturedRun } from '@/lib/api';
import {
  buildCitylensCreateRunPayload,
  citylensCreateRunSchema,
  type CitylensCreateRunInput,
} from '@/lib/validation';
import { getApiKey, rememberRecentRun } from '@/lib/storage';

const DEFAULTS: CitylensCreateRunInput = {
  address: '',
  imagery_year: 2024,
  baseline_year: 2017,
  segmentation_backend: 'sam2',
  outputs: ['previews', 'change', 'mesh'],
  notes: undefined,
};

export function RunForm() {
  const router = useRouter();
  const [form, setForm] = useState<CitylensCreateRunInput>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [apiKeyPresent, setApiKeyPresent] = useState(false);
  const [featured, setFeatured] = useState<DemoFeaturedRun[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [selectedDemoRunId, setSelectedDemoRunId] = useState<string>('');

  useEffect(() => {
    const sync = () => setApiKeyPresent(Boolean(getApiKey()));
    sync();
    window.addEventListener('citylens_api_key_changed', sync);
    return () => window.removeEventListener('citylens_api_key_changed', sync);
  }, []);

  useEffect(() => {
    let alive = true;
    setFeaturedLoading(true);
    setFeaturedError(null);
    getFeaturedDemos()
      .then((rows) => {
        if (!alive) return;
        setFeatured(rows);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setFeaturedError(errorMessage(e));
      })
      .finally(() => {
        if (!alive) return;
        setFeaturedLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const canSubmit = useMemo(() => apiKeyPresent && !submitting, [apiKeyPresent, submitting]);

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

  function coerceNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim().length > 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }

  function normalizeOutputs(v: unknown): CitylensCreateRunInput['outputs'] | undefined {
    if (!Array.isArray(v)) return undefined;
    const allowed = ['previews', 'change', 'mesh'] as const;
    const isAllowed = (x: unknown): x is CitylensCreateRunInput['outputs'][number] =>
      typeof x === 'string' && (allowed as readonly string[]).includes(x);

    const next = (v as unknown[]).filter(isAllowed);
    return next.length > 0
      ? (Array.from(new Set(next)) as CitylensCreateRunInput['outputs'])
      : undefined;
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

    const apiKey = getApiKey();
    if (!apiKey) {
      toast.error('Demo mode', { description: 'Set an API key to run new jobs.' });
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
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 401) {
        toast.error('Unauthorized (401)', {
          description: 'Your API key was rejected. Click “API key” in the header to replace it.',
        });
        window.dispatchEvent(new Event('citylens_open_api_key'));
      } else if (status === 429) {
        toast.error('Quota exceeded (429)', {
          description: 'Too many requests. Please wait and try again.',
        });
      } else if (err instanceof ApiError) {
        toast.error('Failed to create run', { description: err.message });
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
            const nextImageryYear =
              coerceNumber(chosen?.imagery_year ?? req.imagery_year ?? req['imageryYear']) ??
              DEFAULTS.imagery_year;
            const nextBaselineYear =
              coerceNumber(chosen?.baseline_year ?? req.baseline_year ?? req['baselineYear']) ??
              DEFAULTS.baseline_year;
            const nextBackendRaw =
              (typeof chosen?.segmentation_backend === 'string' ? chosen.segmentation_backend : undefined) ??
              (typeof req.segmentation_backend === 'string' ? (req.segmentation_backend as string) : undefined);
            const nextBackend =
              nextBackendRaw === 'unet' || nextBackendRaw === 'smp' || nextBackendRaw === 'sam2'
                ? (nextBackendRaw as CitylensCreateRunInput['segmentation_backend'])
                : DEFAULTS.segmentation_backend;

            const nextOutputs =
              normalizeOutputs(chosen?.outputs ?? req.outputs) ??
              DEFAULTS.outputs;

            setForm((prev) => ({
              ...prev,
              address: nextAddress ?? prev.address,
              imagery_year: nextImageryYear,
              baseline_year: nextBaselineYear,
              segmentation_backend: nextBackend,
              outputs: nextOutputs,
            }));

            router.push(`/runs/${encodeURIComponent(nextRunId)}?demo=1`);
          }}
          aria-label="Select a featured demo run"
        >
          <option value="">{featuredLoading ? 'Loading demos…' : 'Select a demo run…'}</option>
          {featured
            .map((d) => ({ d, id: demoRunId(d) }))
            .filter((x): x is { d: DemoFeaturedRun; id: string } => Boolean(x.id))
            .map(({ d, id }) => (
              <option key={id} value={id}>
                {demoLabel(d)}
              </option>
            ))}
        </select>
        {featuredError && <div className="text-xs text-rose-700">Failed to load demos: {featuredError}</div>}
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Imagery year</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="number"
            min={1990}
            max={2100}
            value={form.imagery_year}
            onChange={(e) => setField('imagery_year', Number(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Baseline year</span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            type="number"
            min={1990}
            max={2100}
            value={form.baseline_year}
            onChange={(e) => setField('baseline_year', Number(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Segmentation backend</span>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            value={form.segmentation_backend}
            onChange={(e) =>
              setField(
                'segmentation_backend',
                e.target.value as CitylensCreateRunInput['segmentation_backend'],
              )
            }
          >
            <option value="unet">unet</option>
            <option value="smp">smp</option>
            <option value="sam2">sam2</option>
          </select>
        </label>
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
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create run'}
        </button>
        {!apiKeyPresent && <div className="text-sm text-slate-600">Demo mode: set an API key to create runs.</div>}
      </div>
    </form>
  );
}
