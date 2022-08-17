'use client';

import { useMemo, useState } from 'react';
import { Download, FileJson, Image as ImageIcon } from 'lucide-react';

import type { RunResponse, ArtifactRecord } from '@/lib/types';
import { safeJsonStringify } from '@/lib/utils';
import { PreviewImage } from '@/components/PreviewImage';
import { GeojsonMap } from '@/components/GeojsonMap';

const EXPECTED = ['preview.png', 'change.geojson', 'mesh.ply', 'run_summary.json'] as const;

function pickUrl(a?: ArtifactRecord): string | null {
  if (!a) return null;
  const u = (a.signed_url ?? a.url) as string | undefined;
  return u && u.trim().length > 0 ? u : null;
}

function normalizeArtifacts(run?: RunResponse): Record<(typeof EXPECTED)[number], ArtifactRecord | undefined> {
  const map = (run?.artifacts ?? {}) as Record<string, ArtifactRecord>;

  const direct = {
    'preview.png': map['preview.png'],
    'change.geojson': map['change.geojson'],
    'mesh.ply': map['mesh.ply'],
    'run_summary.json': map['run_summary.json'],
  } as const;

  const missing = EXPECTED.filter((k) => !direct[k]);
  if (missing.length === 0) return { ...direct };

  // Some backends may key artifacts by id but include the filename in a `name` field.
  const byName: Record<string, ArtifactRecord | undefined> = {};
  for (const v of Object.values(map)) {
    const n = typeof v?.name === 'string' ? v.name : undefined;
    if (n && EXPECTED.includes(n as any) && !byName[n]) byName[n] = v;
  }

  return {
    'preview.png': direct['preview.png'] ?? byName['preview.png'],
    'change.geojson': direct['change.geojson'] ?? byName['change.geojson'],
    'mesh.ply': direct['mesh.ply'] ?? byName['mesh.ply'],
    'run_summary.json': direct['run_summary.json'] ?? byName['run_summary.json'],
  };
}

export function ArtifactsPanel({ run }: { run?: RunResponse }) {
  if (!run) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">Artifacts</div>
        <div className="p-4 text-sm text-slate-600">Run data not loaded yet.</div>
      </div>
    );
  }

  const artifacts = useMemo(() => normalizeArtifacts(run), [run]);
  const previewUrl = pickUrl(artifacts['preview.png']);
  const changeUrl = pickUrl(artifacts['change.geojson']);
  const meshUrl = pickUrl(artifacts['mesh.ply']);
  const summaryUrl = pickUrl(artifacts['run_summary.json']);

  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);

  async function loadSummary() {
    if (!summaryUrl) return;
    setSummaryErr(null);
    setSummaryText(null);
    try {
      const res = await fetch(summaryUrl);
      if (!res.ok) throw new Error(`run_summary.json fetch failed (${res.status})`);
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        setSummaryText(safeJsonStringify(json, 2));
      } else {
        const txt = await res.text();
        setSummaryText(txt);
      }
    } catch (e: any) {
      setSummaryErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-medium">Artifacts</div>
        <div className="text-xs text-slate-600">Expected: {EXPECTED.join(', ')}</div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Preview */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4" /> preview.png
            </div>
            {previewUrl && (
              <a
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
          </div>
          {previewUrl ? (
            <PreviewImage src={previewUrl} alt="preview.png" />
          ) : (
            <div className="text-sm text-slate-600">No signed_url available for preview.png yet.</div>
          )}
        </div>

        {/* GeoJSON */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileJson className="h-4 w-4" /> change.geojson
            </div>
            {changeUrl && (
              <a
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                href={changeUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
          </div>
          {changeUrl ? (
            <GeojsonMap url={changeUrl} />
          ) : (
            <div className="text-sm text-slate-600">No signed_url available for change.geojson yet.</div>
          )}
        </div>

        {/* Mesh */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-medium">mesh.ply</div>
          {meshUrl ? (
            <a
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              href={meshUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" /> Download
            </a>
          ) : (
            <div className="text-sm text-slate-600">No signed_url available yet.</div>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-medium">run_summary.json</div>
            <div className="flex items-center gap-2">
              {summaryUrl && (
                <a
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                  href={summaryUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
              )}
              {summaryUrl && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={loadSummary}
                >
                  Load
                </button>
              )}
            </div>
          </div>
          <div className="p-4">
            {!summaryUrl ? (
              <div className="text-sm text-slate-600">No signed_url available for run_summary.json yet.</div>
            ) : summaryErr ? (
              <div className="text-sm text-rose-700">{summaryErr}</div>
            ) : summaryText ? (
              <details open>
                <summary className="cursor-pointer text-sm font-medium text-slate-900">View JSON</summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                  {summaryText}
                </pre>
              </details>
            ) : (
              <div className="text-sm text-slate-600">Click Load to view formatted JSON.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
