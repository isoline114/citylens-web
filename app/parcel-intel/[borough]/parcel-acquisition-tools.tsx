'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Bookmark, Calculator, Printer, Save, Share2, Trash2 } from 'lucide-react';

import type {
  ParcelIntelRow,
  ParcelWorkflowItem,
  ParcelWorkflowStage,
} from '@/lib/api';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

export const WORKFLOW_STAGE_LABELS: Record<ParcelWorkflowStage, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  underwriting: 'Underwriting',
  pursue: 'Pursue',
  pass: 'Pass',
};

export type WorkflowDraft = Pick<
  ParcelWorkflowItem,
  | 'stage'
  | 'notes'
  | 'tags'
  | 'assignee'
  | 'watching'
  | 'decision_reason'
  | 'outcome'
>;

const DECISION_REASONS = [
  ['', 'No disposition reason'],
  ['pursuing', 'Pursuing / next action set'],
  ['owner_unresponsive', 'Owner unresponsive'],
  ['pricing_gap', 'Pricing gap'],
  ['insufficient_capacity', 'Insufficient capacity'],
  ['zoning_constraints', 'Zoning / entitlement constraints'],
  ['ownership_complexity', 'Ownership complexity'],
  ['active_project', 'Already an active project'],
  ['bad_data', 'Data needs correction'],
  ['other', 'Other'],
] as const;

const OUTCOMES: Array<[ParcelWorkflowItem['outcome'], string]> = [
  ['unknown', 'No outcome yet'],
  ['owner_contacted', 'Owner contacted'],
  ['meeting_scheduled', 'Meeting scheduled'],
  ['qualified', 'Qualified after contact'],
  ['offer_submitted', 'Offer submitted'],
  ['under_contract', 'Under contract'],
  ['closed', 'Closed'],
  ['rejected', 'Rejected after diligence'],
  ['lost', 'Lost'],
];

export function WorkflowEditor({
  item,
  busy,
  onSave,
  onRemove,
}: {
  item: ParcelWorkflowItem | null;
  busy: boolean;
  onSave: (draft: WorkflowDraft) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [stage, setStage] = useState<ParcelWorkflowStage>(item?.stage ?? 'new');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [tagsText, setTagsText] = useState((item?.tags ?? []).join(', '));
  const [assignee, setAssignee] = useState(item?.assignee ?? '');
  const [watching, setWatching] = useState(item?.watching ?? true);
  const [decisionReason, setDecisionReason] = useState(item?.decision_reason ?? '');
  const [outcome, setOutcome] = useState<ParcelWorkflowItem['outcome']>(
    item?.outcome ?? 'unknown',
  );

  useEffect(() => {
    setStage(item?.stage ?? 'new');
    setNotes(item?.notes ?? '');
    setTagsText((item?.tags ?? []).join(', '));
    setAssignee(item?.assignee ?? '');
    setWatching(item?.watching ?? true);
    setDecisionReason(item?.decision_reason ?? '');
    setOutcome(item?.outcome ?? 'unknown');
  }, [item]);

  return (
    <section className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-900">
            <Bookmark className="h-3.5 w-3.5" /> Acquisition workflow
          </h4>
          <p className="mt-0.5 text-xs text-sky-800">
            {item ? 'Saved to your pipeline' : 'Add this site to your pipeline'}
          </p>
        </div>
        {item && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRemove()}
            className={`rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-700 disabled:opacity-50 ${FOCUS_RING}`}
            aria-label="Remove from pipeline"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-700">
          Stage
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as ParcelWorkflowStage)}
            className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
          >
            {Object.entries(WORKFLOW_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Assignee
          <input
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="Name or team"
            maxLength={128}
            className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
          />
        </label>
      </div>
      <label className="mt-2 block text-xs font-medium text-slate-700">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Owner context, diligence questions, next action…"
          maxLength={4000}
          rows={3}
          className={`mt-1 w-full resize-y rounded-md border border-slate-300 bg-white p-2 text-sm ${FOCUS_RING}`}
        />
      </label>
      <label className="mt-2 block text-xs font-medium text-slate-700">
        Tags
        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="corner, assemblage, call-first"
          className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
        />
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-700">
          Disposition reason
          <select
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
          >
            {DECISION_REASONS.map(([value, label]) => (
              <option key={value || 'none'} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Outcome
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as ParcelWorkflowItem['outcome'])}
            className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
          >
            {OUTCOMES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={watching}
            onChange={(event) => setWatching(event.target.checked)}
          />
          <Bell className="h-3.5 w-3.5" /> Watch for data changes
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onSave({
              stage,
              notes: notes.trim(),
              tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
              assignee: assignee.trim() || null,
              watching,
              decision_reason: decisionReason || null,
              outcome,
            })
          }
          className={`inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 ${FOCUS_RING}`}
        >
          <Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : item ? 'Save changes' : 'Add to pipeline'}
        </button>
      </div>
    </section>
  );
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function LandBasisCalculator({
  row,
  defaultOpen = false,
}: {
  row: ParcelIntelRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [valuePerSqft, setValuePerSqft] = useState(900);
  const [hardCostPerSqft, setHardCostPerSqft] = useState(400);
  const [efficiencyPct, setEfficiencyPct] = useState(80);
  const [softCostPct, setSoftCostPct] = useState(20);
  const [profitMarginPct, setProfitMarginPct] = useState(15);
  const grossSqft = Math.max(row.max_floor_area_sqft ?? 0, 0);
  const sellableSqft = grossSqft * (Math.max(Math.min(efficiencyPct, 100), 0) / 100);
  const estimate = useMemo(() => {
    const revenue = sellableSqft * valuePerSqft;
    const hardCost = grossSqft * hardCostPerSqft;
    const softCost = hardCost * (softCostPct / 100);
    const targetProfit = revenue * (profitMarginPct / 100);
    return Math.max(revenue - hardCost - softCost - targetProfit, 0);
  }, [grossSqft, sellableSqft, valuePerSqft, hardCostPerSqft, softCostPct, profitMarginPct]);

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between px-3 py-2.5 text-left ${FOCUS_RING}`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <Calculator className="h-4 w-4" /> Quick land-basis screen
        </span>
        <span className="text-xs font-semibold text-slate-950">
          {grossSqft > 0 ? currency(estimate) : 'Capacity unavailable'}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Value / sellable SF', valuePerSqft, setValuePerSqft],
              ['Hard cost / gross SF', hardCostPerSqft, setHardCostPerSqft],
              ['Sellable efficiency %', efficiencyPct, setEfficiencyPct],
              ['Soft costs %', softCostPct, setSoftCostPct],
              ['Target margin %', profitMarginPct, setProfitMarginPct],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="text-xs text-slate-600">
                {String(label)}
                <input
                  type="number"
                  min="0"
                  value={Number(value)}
                  onChange={(event) => (setter as (next: number) => void)(Number(event.target.value))}
                  className={`mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-inset ring-slate-200">
            <div className="text-xs text-slate-500">Indicative maximum land basis</div>
            <div className="mt-0.5 text-xl font-semibold text-slate-950">{currency(estimate)}</div>
            <div className="mt-1 text-xs text-slate-500">
              Uses {grossSqft.toLocaleString()} gross buildable SF and{' '}
              {sellableSqft.toLocaleString(undefined, { maximumFractionDigits: 0 })} sellable SF.
              Screening only; excludes financing,
              taxes, affordable-housing requirements, demolition and site-specific zoning adjustments.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ParcelBriefActions({ row }: { row: ParcelIntelRow }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50 ${FOCUS_RING}`}
      >
        <Printer className="h-3.5 w-3.5" /> Print brief
      </button>
      <button
        type="button"
        onClick={async () => {
          const url = new URL(window.location.href);
          url.searchParams.set('bbl', row.bbl);
          await navigator.clipboard?.writeText(url.toString());
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50 ${FOCUS_RING}`}
      >
        <Share2 className="h-3.5 w-3.5" /> {copied ? 'Link copied' : 'Share brief'}
      </button>
    </div>
  );
}
