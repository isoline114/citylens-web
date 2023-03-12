'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Calculator,
  Equal,
  Printer,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';

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
  | 'next_action'
  | 'next_action_due_date'
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
  suggestedNextAction,
  busy,
  onSave,
  onRemove,
}: {
  item: ParcelWorkflowItem | null;
  suggestedNextAction?: string | null;
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
  const [nextAction, setNextAction] = useState(
    item?.next_action ?? suggestedNextAction ?? '',
  );
  const [nextActionDueDate, setNextActionDueDate] = useState(
    item?.next_action_due_date ?? '',
  );
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
    setNextAction(item?.next_action ?? suggestedNextAction ?? '');
    setNextActionDueDate(item?.next_action_due_date ?? '');
    setOutcome(item?.outcome ?? 'unknown');
  }, [item, suggestedNextAction]);

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
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
        <label className="text-xs font-medium text-slate-700">
          Next action
          <input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Call owner, review title, prepare offer…"
            maxLength={240}
            className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Due date
          <input
            type="date"
            value={nextActionDueDate}
            onChange={(event) => setNextActionDueDate(event.target.value)}
            className={`mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
          />
        </label>
      </div>
      {nextActionDueDate && !nextAction.trim() && (
        <p className="mt-1 text-xs text-rose-700" role="alert">
          Add a concrete next action before setting its due date.
        </p>
      )}
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
          disabled={busy || Boolean(nextActionDueDate && !nextAction.trim())}
          onClick={() =>
            void onSave({
              stage,
              notes: notes.trim(),
              tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
              assignee: assignee.trim() || null,
              watching,
              decision_reason: decisionReason || null,
              next_action: nextAction.trim() || null,
              next_action_due_date: nextActionDueDate || null,
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

function compactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export type LandBasisAssumptions = {
  valuePerSellableSqft: number;
  hardCostPerGrossSqft: number;
  efficiencyPct: number;
  softCostPct: number;
  profitMarginPct: number;
};

export type LandBasisScenario = {
  key: 'downside' | 'base' | 'upside';
  label: string;
  assumptionSummary: string;
  assumptions: LandBasisAssumptions;
  grossSqft: number;
  sellableSqft: number;
  revenue: number;
  hardCost: number;
  softCost: number;
  targetProfit: number;
  landBasis: number;
  landBasisPerLotSqft: number | null;
  landBasisPerGrossSqft: number | null;
};

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function calculateLandBasisScenario({
  key,
  label,
  assumptionSummary,
  assumptions,
  grossSqft,
  lotSqft,
}: {
  key: LandBasisScenario['key'];
  label: string;
  assumptionSummary: string;
  assumptions: LandBasisAssumptions;
  grossSqft: number;
  lotSqft: number;
}): LandBasisScenario {
  const normalizedGrossSqft = clamp(
    grossSqft,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const normalizedLotSqft = clamp(
    lotSqft,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const normalizedAssumptions = {
    valuePerSellableSqft: clamp(
      assumptions.valuePerSellableSqft,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    hardCostPerGrossSqft: clamp(
      assumptions.hardCostPerGrossSqft,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    efficiencyPct: clamp(assumptions.efficiencyPct, 0, 100),
    softCostPct: clamp(assumptions.softCostPct, 0, 100),
    profitMarginPct: clamp(assumptions.profitMarginPct, 0, 100),
  };
  const sellableSqft =
    normalizedGrossSqft * (normalizedAssumptions.efficiencyPct / 100);
  const revenue =
    sellableSqft * normalizedAssumptions.valuePerSellableSqft;
  const hardCost =
    normalizedGrossSqft * normalizedAssumptions.hardCostPerGrossSqft;
  const softCost = hardCost * (normalizedAssumptions.softCostPct / 100);
  const targetProfit = revenue * (normalizedAssumptions.profitMarginPct / 100);
  const landBasis = Math.max(
    revenue - hardCost - softCost - targetProfit,
    0,
  );

  return {
    key,
    label,
    assumptionSummary,
    assumptions: normalizedAssumptions,
    grossSqft: normalizedGrossSqft,
    sellableSqft,
    revenue,
    hardCost,
    softCost,
    targetProfit,
    landBasis,
    landBasisPerLotSqft:
      normalizedLotSqft > 0 ? landBasis / normalizedLotSqft : null,
    landBasisPerGrossSqft:
      normalizedGrossSqft > 0 ? landBasis / normalizedGrossSqft : null,
  };
}

export function buildLandBasisScenarios({
  grossSqft,
  lotSqft,
  base,
}: {
  grossSqft: number;
  lotSqft: number;
  base: LandBasisAssumptions;
}): LandBasisScenario[] {
  return [
    calculateLandBasisScenario({
      key: 'downside',
      label: 'Downside',
      assumptionSummary:
        'Value −15% · hard cost +15% · efficiency −5 pts · soft cost +3 pts · margin +3 pts',
      grossSqft,
      lotSqft,
      assumptions: {
        valuePerSellableSqft: base.valuePerSellableSqft * 0.85,
        hardCostPerGrossSqft: base.hardCostPerGrossSqft * 1.15,
        efficiencyPct: base.efficiencyPct - 5,
        softCostPct: base.softCostPct + 3,
        profitMarginPct: base.profitMarginPct + 3,
      },
    }),
    calculateLandBasisScenario({
      key: 'base',
      label: 'Base',
      assumptionSummary: 'Uses the editable assumptions below',
      grossSqft,
      lotSqft,
      assumptions: base,
    }),
    calculateLandBasisScenario({
      key: 'upside',
      label: 'Upside',
      assumptionSummary:
        'Value +10% · hard cost −5% · efficiency +3 pts · soft cost −2 pts · same margin',
      grossSqft,
      lotSqft,
      assumptions: {
        valuePerSellableSqft: base.valuePerSellableSqft * 1.1,
        hardCostPerGrossSqft: base.hardCostPerGrossSqft * 0.95,
        efficiencyPct: base.efficiencyPct + 3,
        softCostPct: base.softCostPct - 2,
        profitMarginPct: base.profitMarginPct,
      },
    }),
  ];
}

export function LandBasisCalculator({
  row,
  defaultOpen = false,
  onAssumptionsChange,
}: {
  row: ParcelIntelRow;
  defaultOpen?: boolean;
  onAssumptionsChange?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [valuePerSqft, setValuePerSqft] = useState(900);
  const [hardCostPerSqft, setHardCostPerSqft] = useState(400);
  const [efficiencyPct, setEfficiencyPct] = useState(80);
  const [softCostPct, setSoftCostPct] = useState(20);
  const [profitMarginPct, setProfitMarginPct] = useState(15);
  const grossSqft = Math.max(row.max_floor_area_sqft ?? 0, 0);
  const lotSqft = Math.max(row.lot_area_sqft ?? 0, 0);
  const scenarios = useMemo(
    () =>
      buildLandBasisScenarios({
        grossSqft,
        lotSqft,
        base: {
          valuePerSellableSqft: valuePerSqft,
          hardCostPerGrossSqft: hardCostPerSqft,
          efficiencyPct,
          softCostPct,
          profitMarginPct,
        },
      }),
    [
      efficiencyPct,
      grossSqft,
      hardCostPerSqft,
      lotSqft,
      profitMarginPct,
      softCostPct,
      valuePerSqft,
    ],
  );
  const baseScenario = scenarios[1];
  const rangeLow = Math.min(...scenarios.map((scenario) => scenario.landBasis));
  const rangeHigh = Math.max(...scenarios.map((scenario) => scenario.landBasis));
  const scenarioStyles: Record<
    LandBasisScenario['key'],
    {
      border: string;
      badge: string;
      Icon: typeof ArrowDownRight;
    }
  > = {
    downside: {
      border: 'border-amber-200 bg-amber-50/70',
      badge: 'bg-amber-100 text-amber-900',
      Icon: ArrowDownRight,
    },
    base: {
      border: 'border-sky-300 bg-sky-50/70 ring-1 ring-sky-200',
      badge: 'bg-sky-100 text-sky-900',
      Icon: Equal,
    },
    upside: {
      border: 'border-emerald-200 bg-emerald-50/70',
      badge: 'bg-emerald-100 text-emerald-900',
      Icon: ArrowUpRight,
    },
  };

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${FOCUS_RING}`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <Calculator className="h-4 w-4" /> Development sensitivity
        </span>
        <span className="whitespace-nowrap text-right text-xs font-semibold text-slate-950">
          {grossSqft > 0 && baseScenario
            ? `${compactCurrency(rangeLow)}–${compactCurrency(rangeHigh)}`
            : 'Capacity unavailable'}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 p-3" data-testid="land-basis-sensitivity">
          {row.mandatory_inclusionary_housing === true && (
            <div
              className="mb-3 rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-3 text-xs leading-5 text-fuchsia-950"
              role="alert"
              data-testid="mih-underwriting-warning"
            >
              <strong>MIH scenario required.</strong> This parcel overlaps a
              current adopted MIH mapped area. The quick estimate below does not
              model affordable-housing set-asides, option-specific economics, or
              any payment alternative. Do not rely on the land-basis result until
              those requirements are verified and modeled.
            </div>
          )}

          {grossSqft > 0 && baseScenario ? (
            <>
              <div
                className="relative overflow-hidden rounded-xl bg-slate-950 p-4 text-white"
                data-testid="land-basis-range"
              >
                <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-sky-500/20 blur-2xl" />
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                    Illustrative acquisition range
                  </div>
                  <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                    <div className="text-2xl font-semibold tracking-tight">
                      {compactCurrency(rangeLow)}–{compactCurrency(rangeHigh)}
                    </div>
                    <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-200">
                      Base {compactCurrency(baseScenario.landBasis)}
                    </div>
                  </div>
                  <p className="mt-2 max-w-xl text-[11px] leading-4 text-slate-300">
                    A sensitivity range, not a valuation. The three cases use the
                    same current zoning-capacity input and the explicit assumption
                    changes shown below.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {scenarios.map((scenario) => {
                  const style = scenarioStyles[scenario.key];
                  const Icon = style.Icon;
                  return (
                    <section
                      key={scenario.key}
                      className={`rounded-xl border p-3 ${style.border}`}
                      data-testid={`land-basis-scenario-${scenario.key}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${style.badge}`}
                        >
                          <Icon className="h-3 w-3" />
                          {scenario.label}
                        </span>
                      </div>
                      <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                        {currency(scenario.landBasis)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-600">
                        {scenario.landBasisPerLotSqft === null
                          ? 'Lot-area basis unavailable'
                          : `${currency(scenario.landBasisPerLotSqft)} / lot SF`}
                        {' · '}
                        {scenario.landBasisPerGrossSqft === null
                          ? 'capacity basis unavailable'
                          : `${currency(scenario.landBasisPerGrossSqft)} / gross SF`}
                      </div>
                      <dl className="mt-3 space-y-1 border-t border-slate-900/10 pt-2 text-[10px] text-slate-600">
                        <div className="flex justify-between gap-2">
                          <dt>Value / sellable SF</dt>
                          <dd className="font-medium text-slate-900">
                            {currency(
                              scenario.assumptions.valuePerSellableSqft,
                            )}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Hard cost / gross SF</dt>
                          <dd className="font-medium text-slate-900">
                            {currency(
                              scenario.assumptions.hardCostPerGrossSqft,
                            )}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Efficiency</dt>
                          <dd className="font-medium text-slate-900">
                            {scenario.assumptions.efficiencyPct.toFixed(0)}%
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Soft costs</dt>
                          <dd className="font-medium text-slate-900">
                            {scenario.assumptions.softCostPct.toFixed(0)}%
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Target margin</dt>
                          <dd className="font-medium text-slate-900">
                            {scenario.assumptions.profitMarginPct.toFixed(0)}%
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-[10px] leading-4 text-slate-500">
                        {scenario.assumptionSummary}
                      </p>
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Current mapped development capacity is unavailable. Verify zoning
              and lot geometry before running a land-basis sensitivity.
            </div>
          )}

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-800">
                Base assumptions
              </h5>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                Edit the base case; downside and upside deltas recalculate
                automatically.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
              Session only
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Value / sellable SF', valuePerSqft, setValuePerSqft, 0, undefined],
              ['Hard cost / gross SF', hardCostPerSqft, setHardCostPerSqft, 0, undefined],
              ['Sellable efficiency %', efficiencyPct, setEfficiencyPct, 0, 100],
              ['Soft costs %', softCostPct, setSoftCostPct, 0, 100],
              ['Target margin %', profitMarginPct, setProfitMarginPct, 0, 100],
            ].map(([label, value, setter, minimum, maximum]) => (
              <label key={String(label)} className="mt-2 text-xs text-slate-600">
                {String(label)}
                <input
                  type="number"
                  min={Number(minimum)}
                  max={
                    maximum === undefined ? undefined : Number(maximum)
                  }
                  value={Number(value)}
                  onChange={(event) => {
                    (setter as (next: number) => void)(
                      Number(event.target.value),
                    );
                    onAssumptionsChange?.();
                  }}
                  className={`mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-sm ${FOCUS_RING}`}
                />
              </label>
            ))}
          </div>

          {baseScenario && (
            <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
              <div className="text-xs text-slate-500">
                Indicative maximum land basis · base case
              </div>
              <div className="mt-0.5 text-xl font-semibold text-slate-950">
                {currency(baseScenario.landBasis)}
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Uses {grossSqft.toLocaleString()} gross buildable SF and{' '}
                {baseScenario.sellableSqft.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                sellable SF.
              </div>
            </div>
          )}

          <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-800">
              Formula, scope, and omissions
            </summary>
            <div className="mt-2 space-y-2 text-[11px] leading-5 text-slate-600">
              <p>
                Residual land basis = sellable revenue − hard costs − soft
                costs − target profit. Revenue uses sellable SF; hard costs use
                gross buildable SF. Negative residuals are displayed as $0.
              </p>
              <p>
                Capacity comes from the displayed current parcel record. This
                screen excludes financing, taxes, carrying costs,
                affordable-housing requirements, demolition, tenant
                relocation, environmental remediation, assemblage execution,
                and site-specific zoning or entitlement adjustments.
              </p>
            </div>
          </details>
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
