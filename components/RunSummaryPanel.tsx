'use client';

import { Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { safeJsonStringify } from '@/lib/utils';

type SummaryQA = {
  reference_case_id?: string;
  baseline_footprints_used?: boolean;
  lidar_used?: boolean;
  mask_iou?: number;
  /** Legacy XOR-mask metric. Kept here for backward compat with older
   *  run_summary.json blobs but intentionally not surfaced in the UI —
   *  the metric compares against an XOR baseline that punishes the
   *  per-footprint classifier for correctly ignoring registration noise.
   *  See research/repo_state_audit.md. */
  change_polygon_f1?: number;
  /** Per-class counts produced by stage_change. Replaces the misleading
   *  `change_polygon_f1` cell in the UI. */
  change_counts?: Record<string, number>;
  mesh_footprint_iou?: number;
  parity_status?: string;
  // Input audit trail — written by the worker on every run.
  orthophoto_sha256?: string;
  baseline_sha256?: string;
  lidar_sha256?: string;
} & Record<string, unknown>;

type SummaryPerformance = {
  total_runtime_seconds?: number;
  stage_timings_seconds?: Record<string, unknown>;
} & Record<string, unknown>;

type RunSummary = {
  qa?: SummaryQA;
  performance?: SummaryPerformance;
} & Record<string, unknown>;

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return '—';
}

function formatChangeCounts(counts: Record<string, number> | undefined): string {
  if (!counts || typeof counts !== 'object') return '—';
  const order = ['unchanged', 'modified', 'demolished', 'added'];
  const parts = order
    .filter((k) => typeof counts[k] === 'number')
    .map((k) => `${counts[k]} ${k}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function shortSha(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12) return '—';
  return `${value.slice(0, 12)}…`;
}

function formatSeconds(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}s`;
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{formatValue(value)}</div>
    </div>
  );
}

export function RunSummaryPanel({
  summaryUrl,
  summary,
  rawText,
  loading,
  error,
  onLoad,
}: {
  summaryUrl?: string | null;
  summary?: RunSummary | null;
  rawText?: string | null;
  loading?: boolean;
  error?: string | null;
  onLoad?: () => void;
}) {
  const qa = summary?.qa;
  const performance = summary?.performance;
  const stageTimings = performance?.stage_timings_seconds;
  const stageEntries =
    stageTimings && typeof stageTimings === 'object' ? Object.entries(stageTimings).filter(([, v]) => typeof v === 'number') : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white" data-testid="run-summary-panel">
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
          {summaryUrl && onLoad && (
            <button
              type="button"
              data-testid="run-summary-load"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              onClick={onLoad}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading
                ? 'Loading'
                : error
                  ? 'Retry'
                  : summary || rawText
                    ? 'Refresh'
                    : 'Load'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {!summaryUrl ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <AlertTriangle className="h-4 w-4" />
            <span>No artifact URL available for run_summary.json yet.</span>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading run summary…</span>
          </div>
        ) : error ? (
          <div className="text-sm text-rose-700">{error}</div>
        ) : summary ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-sm font-medium text-slate-900">QA</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Metric label="Reference case" value={qa?.reference_case_id} />
                <Metric label="Baseline footprints used" value={qa?.baseline_footprints_used} />
                <Metric label="LiDAR used" value={qa?.lidar_used} />
                <Metric label="Mask IoU" value={qa?.mask_iou} />
                <Metric label="Change classes" value={formatChangeCounts(qa?.change_counts)} />
                <Metric label="Mesh footprint IoU" value={qa?.mesh_footprint_iou} />
                <Metric label="Parity status" value={qa?.parity_status} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                Audit trail
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600">
                  reproducible
                </span>
              </div>
              <p className="mb-2 text-xs text-slate-600">
                Every run records a SHA-256 of each input asset so any output can
                be traced back to the exact bytes the pipeline saw.
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Metric label="Orthophoto sha256" value={shortSha(qa?.orthophoto_sha256)} />
                <Metric label="Baseline sha256" value={shortSha(qa?.baseline_sha256)} />
                <Metric label="LiDAR sha256" value={shortSha(qa?.lidar_sha256)} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-slate-900">Performance</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Metric label="Total runtime" value={performance?.total_runtime_seconds === undefined ? '—' : formatSeconds(performance.total_runtime_seconds)} />
                <Metric
                  label="Stage timings"
                  value={stageEntries.length > 0 ? `${stageEntries.length} stage timings recorded` : '—'}
                />
              </div>
              {stageEntries.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Stage</th>
                        <th className="px-3 py-2">Seconds</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {stageEntries
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([stage, seconds]) => (
                          <tr key={stage}>
                            <td className="px-3 py-2 font-medium text-slate-900">{stage}</td>
                            <td className="px-3 py-2 text-slate-700">{formatSeconds(seconds)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <CheckCircle2 className="h-4 w-4" />
                Raw JSON
              </div>
              <pre className="mt-3 max-h-80 overflow-auto text-xs text-slate-800">
                {safeJsonStringify(summary, 2)}
              </pre>
            </div>
          </div>
        ) : rawText ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-sm text-slate-800">{rawText}</pre>
        ) : (
          <div className="text-sm text-slate-600">Click Load to view QA and performance metrics.</div>
        )}
      </div>
    </div>
  );
}
