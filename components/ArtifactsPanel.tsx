'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Check,
  FileCheck2,
  Image as ImageIcon,
  Map,
} from 'lucide-react';

import type { RunResponse, ArtifactRecord } from '@/lib/types';
import { resolveApiUrl } from '@/lib/api';
import { safeJsonStringify } from '@/lib/utils';
import { PreviewImage } from '@/components/PreviewImage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RunSummaryPanel } from '@/components/RunSummaryPanel';

const GeojsonMap = dynamic(
  () => import('@/components/GeojsonMap').then((mod) => mod.GeojsonMap),
  {
    ssr: false,
    loading: () => <div className="text-sm text-slate-600">Loading change.geojson viewer…</div>,
  },
);

const MeshViewer = dynamic(
  () => import('@/components/MeshViewer').then((mod) => mod.MeshViewer),
  {
    ssr: false,
    loading: () => <div className="text-sm text-slate-600">Loading mesh viewer…</div>,
  },
);

const EXPECTED = ['preview.png', 'change.geojson', 'mesh.ply', 'run_summary.json'] as const;

type ExpectedArtifactName = (typeof EXPECTED)[number];
type ArtifactView = 'preview' | 'change' | 'mesh' | 'summary';

const ARTIFACT_VIEWS = [
  {
    id: 'preview',
    name: 'preview.png',
    label: 'Imagery',
    description: 'Rendered aerial evidence',
    icon: ImageIcon,
  },
  {
    id: 'change',
    name: 'change.geojson',
    label: 'Change map',
    description: 'Added, modified, and removed geometry',
    icon: Map,
  },
  {
    id: 'mesh',
    name: 'mesh.ply',
    label: '3D massing',
    description: 'Interactive reconstruction',
    icon: Box,
  },
  {
    id: 'summary',
    name: 'run_summary.json',
    label: 'QA receipt',
    description: 'Lineage, quality, and timing',
    icon: FileCheck2,
  },
] as const satisfies ReadonlyArray<{
  id: ArtifactView;
  name: ExpectedArtifactName;
  label: string;
  description: string;
  icon: typeof ImageIcon;
}>;

function isExpectedArtifactName(v: string): v is ExpectedArtifactName {
  return (EXPECTED as readonly string[]).includes(v);
}

type ArtifactUrlResult = {
  url: string | null;
  error: string | null;
};

function pickUrl(a?: ArtifactRecord): ArtifactUrlResult {
  if (!a) return { url: null, error: null };
  const u = (a.signed_url ?? a.url) as string | undefined;
  try {
    return { url: resolveApiUrl(u), error: null };
  } catch (e: unknown) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function normalizeArtifacts(run?: RunResponse): Record<ExpectedArtifactName, ArtifactRecord | undefined> {
  const rawArtifacts = run?.artifacts;
  const map = (
    Array.isArray(rawArtifacts)
      ? Object.fromEntries(
          rawArtifacts
            .filter((artifact): artifact is ArtifactRecord => Boolean(artifact))
            .map((artifact, index) => [String(index), artifact]),
        )
      : (rawArtifacts ?? {})
  ) as Record<string, ArtifactRecord>;

  const direct = {
    'preview.png': map['preview.png'],
    'change.geojson': map['change.geojson'],
    'mesh.ply': map['mesh.ply'],
    'run_summary.json': map['run_summary.json'],
  } as const;

  const missing = EXPECTED.filter((k) => !direct[k]);
  if (missing.length === 0) return { ...direct };

  // Some backends may key artifacts by id but include the filename in a `name` field.
  const byName: Partial<Record<ExpectedArtifactName, ArtifactRecord>> = {};
  for (const v of Object.values(map)) {
    const n = typeof v?.name === 'string' ? v.name : undefined;
    if (n && isExpectedArtifactName(n) && !byName[n]) byName[n] = v;
  }

  return {
    'preview.png': direct['preview.png'] ?? byName['preview.png'],
    'change.geojson': direct['change.geojson'] ?? byName['change.geojson'],
    'mesh.ply': direct['mesh.ply'] ?? byName['mesh.ply'],
    'run_summary.json': direct['run_summary.json'] ?? byName['run_summary.json'],
  };
}

export function ArtifactsPanel({ run }: { run?: RunResponse }) {
  const artifacts = useMemo(() => normalizeArtifacts(run), [run]);
  const preview = pickUrl(artifacts['preview.png']);
  const change = pickUrl(artifacts['change.geojson']);
  const mesh = pickUrl(artifacts['mesh.ply']);
  const summary = pickUrl(artifacts['run_summary.json']);
  const previewUrl = preview.url;
  const changeUrl = change.url;
  const meshUrl = mesh.url;
  const summaryUrl = summary.url;
  const artifactConfigError = preview.error ?? change.error ?? mesh.error ?? summary.error ?? null;
  const availableCount = [previewUrl, changeUrl, meshUrl, summaryUrl].filter(
    Boolean,
  ).length;

  const [activeView, setActiveView] = useState<ArtifactView>('preview');
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<Record<string, unknown> | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    setActiveView('preview');
  }, [run?.run_id]);

  useEffect(() => {
    setSummaryText(null);
    setSummaryData(null);
    setSummaryErr(null);
    setSummaryLoading(false);
  }, [summaryUrl, run?.run_id]);

  async function loadSummary() {
    if (!summaryUrl || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryErr(null);
    try {
      const res = await fetch(summaryUrl);
      if (!res.ok) {
        throw new Error(`run_summary.json fetch failed (${res.status})`);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        setSummaryData(
          (json && typeof json === 'object'
            ? (json as Record<string, unknown>)
            : null) ?? null,
        );
        setSummaryText(safeJsonStringify(json, 2));
      } else {
        const txt = await res.text();
        setSummaryText(txt);
      }
    } catch (e: unknown) {
      setSummaryErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSummaryLoading(false);
    }
  }

  function selectView(view: ArtifactView) {
    setActiveView(view);
    if (
      view === 'summary' &&
      summaryUrl &&
      !summaryData &&
      !summaryText &&
      !summaryErr
    ) {
      void loadSummary();
    }
  }

  function handleTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: ArtifactView,
  ) {
    const currentIndex = ARTIFACT_VIEWS.findIndex(
      (view) => view.id === current,
    );
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % ARTIFACT_VIEWS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex =
        (currentIndex - 1 + ARTIFACT_VIEWS.length) % ARTIFACT_VIEWS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = ARTIFACT_VIEWS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const next = ARTIFACT_VIEWS[nextIndex];
    selectView(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`artifact-tab-${next.id}`)?.focus();
    });
  }

  if (!run) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">Artifacts</div>
        <div className="p-4 text-sm text-slate-600">Run data not loaded yet.</div>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-testid="artifacts-panel"
      aria-labelledby="evidence-workspace-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
        <div>
          <div
            id="evidence-workspace-title"
            className="text-sm font-semibold text-slate-950"
          >
            Evidence workspace
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Inspect each output without leaving the run.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
          data-testid="artifact-availability-receipt"
        >
          <Check className="h-3.5 w-3.5" />
          {availableCount} of {EXPECTED.length} available
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {artifactConfigError && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Frontend config error: {artifactConfigError}
          </div>
        )}

        <div
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          role="tablist"
          aria-label="Run evidence"
          aria-orientation="horizontal"
        >
          {ARTIFACT_VIEWS.map((view) => {
            const Icon = view.icon;
            const active = activeView === view.id;
            const available = Boolean(pickUrl(artifacts[view.name]).url);
            return (
              <button
                key={view.id}
                type="button"
                id={`artifact-tab-${view.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`artifact-panel-${view.id}`}
                aria-label={`${view.label}: ${view.description}`}
                data-testid={`artifact-tab-${view.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectView(view.id)}
                onKeyDown={(event) => handleTabKeyDown(event, view.id)}
                className={`min-w-0 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  active
                    ? 'border-slate-900 bg-slate-950 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      active
                        ? 'bg-white/10 text-sky-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      available ? 'bg-emerald-400' : 'bg-slate-300'
                    }`}
                    aria-label={available ? 'Available' : 'Unavailable'}
                  />
                </span>
                <span className="mt-2 block truncate text-sm font-semibold">
                  {view.label}
                </span>
                <span
                  className={`mt-0.5 block truncate font-mono text-[10px] ${
                    active ? 'text-slate-300' : 'text-slate-500'
                  }`}
                  data-testid={`artifact-${view.id}-name`}
                >
                  {view.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          {activeView === 'preview' && (
            <div
              id="artifact-panel-preview"
              role="tabpanel"
              aria-labelledby="artifact-tab-preview"
              data-testid="artifact-preview"
            >
              {previewUrl ? (
                <ErrorBoundary title="preview.png" message="The preview image could not be rendered.">
                  <PreviewImage src={previewUrl} alt="preview.png" />
                </ErrorBoundary>
              ) : (
                <ArtifactUnavailable name="preview.png" />
              )}
            </div>
          )}

          {activeView === 'change' && (
            <div
              id="artifact-panel-change"
              role="tabpanel"
              aria-labelledby="artifact-tab-change"
              data-testid="artifact-change"
            >
              {changeUrl ? (
                <ErrorBoundary title="change.geojson" message="The change map could not be rendered.">
                  <GeojsonMap url={changeUrl} />
                </ErrorBoundary>
              ) : (
                <ArtifactUnavailable name="change.geojson" />
              )}
            </div>
          )}

          {activeView === 'mesh' && (
            <div
              id="artifact-panel-mesh"
              role="tabpanel"
              aria-labelledby="artifact-tab-mesh"
              data-testid="artifact-mesh"
            >
              {meshUrl ? (
                <ErrorBoundary
                  title="mesh.ply"
                  message="The mesh viewer could not be rendered. Download the file to inspect it locally."
                  testId="mesh-boundary-error"
                >
                  <MeshViewer url={meshUrl} />
                </ErrorBoundary>
              ) : (
                <ArtifactUnavailable name="mesh.ply" />
              )}
            </div>
          )}

          {activeView === 'summary' && (
            <div
              id="artifact-panel-summary"
              role="tabpanel"
              aria-labelledby="artifact-tab-summary"
              data-testid="artifact-summary"
            >
              <RunSummaryPanel
                summaryUrl={summaryUrl}
                summary={summaryData}
                rawText={summaryText}
                loading={summaryLoading}
                error={summaryErr}
                onLoad={() => void loadSummary()}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ArtifactUnavailable({ name }: { name: ExpectedArtifactName }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
      {name} is not available for this run.
    </div>
  );
}
