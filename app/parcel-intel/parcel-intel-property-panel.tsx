'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Columns3,
  Database,
  ExternalLink,
  FileSearch,
  Gauge,
  Info,
  LockKeyhole,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  ApiError,
  clearParcelWorkflowEvidenceReview,
  getParcelWorkflow,
  listParcelWorkflowEvents,
  recordParcelProductEvent,
  removeParcelWorkflow,
  reviewParcelWorkflowEvidence,
  saveParcelWorkflow,
  submitParcelWorkflowEvidenceIssue,
  withdrawParcelWorkflowEvidenceIssue,
  type ParcelDecisionAudit,
  type ParcelDecisionAuditCheck,
  type ParcelIntelMapRow,
  type ParcelIntelRow,
  type ParcelWorkflowEvidenceReviewKey,
  type ParcelWorkflowEvidenceIssueReason,
  type ParcelWorkflowEvidenceIssueType,
  type ParcelWorkflowEvent,
  type ParcelWorkflowItem,
  type TopFeature,
} from '@/lib/api';
import {
  EvidenceReviewChecklist,
  LandBasisCalculator,
  ParcelBriefActions,
  WorkflowEditor,
  type WorkflowDraft,
} from './[borough]/parcel-acquisition-tools';
import { explainParcel } from './[borough]/parcel-intel-explain';
import {
  BOROUGH_LABELS,
  BOROUGH_SHORT_LABELS,
  opportunityLabel,
  priorityLabel,
} from './parcel-intel-explorer-support';
import {
  ParcelDecisionPeers,
  type ParcelDecisionPeer,
} from './parcel-decision-peers';

type PanelTab = 'overview' | 'audit' | 'underwrite' | 'workflow';

type Props = {
  row: ParcelIntelRow;
  onClose: () => void;
  onViewOwnerPortfolio?: (ownerPortfolioId: string) => void;
  isCompared?: boolean;
  compareLimitReached?: boolean;
  onToggleCompare?: () => void;
  decisionPeers?: ParcelDecisionPeer[];
  peerInventoryComplete?: boolean;
  onOpenPeer?: (bbl: string) => void;
  onComparePeer?: (peer: ParcelIntelMapRow) => Promise<void>;
};

type ExternalParcelLink = { label: string; href: string };

type ParcelDecisionBriefLane = {
  key: 'signal' | 'eligibility' | 'open_questions' | 'next_decision';
  eyebrow: string;
  headline: string;
  detail: string;
  source: string;
  tone: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'slate';
};

const BRIEF_SOURCE_LABELS: Record<string, string> = {
  'accepted_model_bundle.rolling_validation':
    'CityLens rolling-origin validation using NYC PLUTO and DOB filings',
};

export type ParcelDecisionBrief = {
  label: string;
  lanes: ParcelDecisionBriefLane[];
  evidenceAsOf: string | null;
};

const MODEL_FEATURE_LABELS: Record<string, string> = {
  allowed_far: 'Allowed development density',
  assessbldg_per_lot: 'Assessed building value',
  assessland_per_lot: 'Assessed land value',
  assesstot_per_lot: 'Total assessed value',
  bldg_class: 'Building class',
  block_prior_nb_activity_record_count: 'Nearby new-building activity records',
  block_prior_structural_activity_record_count: 'Nearby structural activity records',
  block_redev_share: 'Nearby redevelopment share',
  borough: 'Borough',
  floors_bucket: 'Existing floor count',
  land_use: 'Land-use class',
  lot_area: 'Lot size',
  prior_alt_activity_record_count: 'Historical alteration activity records',
  prior_nb_activity_record_count: 'Historical new-building activity records',
  prior_recent_nb_activity_record_count: 'Recent new-building activity records',
  prior_structural_activity_record_count: 'Structural activity records',
  units: 'Existing residential units',
  year_bucket: 'Year built',
  years_held: 'Years held',
  years_since_last_structural_activity: 'Years since latest structural activity',
  zoning_district: 'Zoning district',
  zoning_family: 'Zoning family',
};

function modelFeatureLabel(name: string): string {
  return MODEL_FEATURE_LABELS[name] ?? name.replaceAll('_', ' ');
}

function modelFeatureValue(feature: TopFeature): string {
  const { value } = feature;
  if (value === null) return 'Value unavailable';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (feature.name === 'lot_area') return `${formatNumber(value)} sqft`;
    if (feature.name === 'block_redev_share') return `${Math.round(value * 100)}%`;
    if (feature.name.startsWith('assess')) return formatCurrency(value);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function ownerEntityLabel(
  value: ParcelIntelRow['owner_entity_type'],
): string {
  return {
    llc: 'LLC',
    corp: 'corporation',
    partnership: 'partnership',
    trust: 'trust',
    hdfc: 'HDFC',
    nonprofit: 'nonprofit',
    religious: 'religious organization',
    government: 'government',
    estate: 'estate',
    individual: 'individual',
    unknown: 'legal entity',
  }[value ?? 'unknown'];
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function formatIsoDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return value ?? null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))),
  );
}

function formatRate(value: number | null): string {
  if (value === null) return 'Not reported';
  const percentage = value * 100;
  return `${percentage < 1 ? percentage.toFixed(2) : percentage.toFixed(1)}%`;
}

const AUDIT_STATUS_STYLES: Record<
  ParcelDecisionAuditCheck['status'],
  { label: string; className: string }
> = {
  verified: {
    label: 'Verified in feed',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  review: {
    label: 'Review required',
    className: 'bg-amber-50 text-amber-900 ring-amber-200',
  },
  excluded: {
    label: 'Excluded',
    className: 'bg-rose-50 text-rose-800 ring-rose-200',
  },
  unavailable: {
    label: 'Unavailable',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  informational: {
    label: 'Context only',
    className: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
};

const AUDIT_LAYER_LABELS: Record<ParcelDecisionAuditCheck['layer'], string> = {
  model_signal: 'Historical model signal',
  eligibility_gate: 'Current acquisition gate',
  current_diligence: 'Current diligence only',
  source_freshness: 'Source provenance',
};

const READINESS_STYLES: Record<
  NonNullable<ParcelDecisionAudit['readiness']>['status'],
  string
> = {
  blocked: 'border-rose-200 bg-rose-50 text-rose-950',
  incomplete: 'border-amber-200 bg-amber-50 text-amber-950',
  review_required: 'border-amber-200 bg-amber-50 text-amber-950',
  initial_review_ready: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  limited_preview: 'border-sky-200 bg-sky-50 text-sky-950',
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function briefSource(
  check: ParcelDecisionAuditCheck | undefined,
  fallback: string,
): string {
  if (!check) return fallback;
  const source = BRIEF_SOURCE_LABELS[check.source] ?? check.source;
  const sameYear = /^(\d{4})-\1$/.exec(check.as_of ?? '');
  const yearRange = /^(\d{4})-(\d{4})$/.exec(check.as_of ?? '');
  const asOf = sameYear
    ? sameYear[1]
    : yearRange
      ? `${yearRange[1]}–${yearRange[2]}`
      : formatIsoDate(check.as_of);
  return `${source}${asOf ? ` · as of ${asOf}` : ''}`;
}

export function buildParcelDecisionBrief(
  row: ParcelIntelRow,
): ParcelDecisionBrief | null {
  const audit = row.decision_audit;
  const readiness = audit?.readiness;
  if (!audit || !readiness) return null;

  const modelCheck = audit.checks.find(
    (check) => check.layer === 'model_signal',
  );
  const eligibilityChecks = audit.checks.filter(
    (check) => check.layer === 'eligibility_gate',
  );
  const verifiedEligibility = eligibilityChecks.filter(
    (check) => check.status === 'verified',
  );
  const unresolvedChecks = audit.checks.filter(
    (check) =>
      (check.layer === 'current_diligence' ||
        check.layer === 'source_freshness') &&
      (check.status === 'review' ||
        check.status === 'excluded' ||
        check.status === 'unavailable'),
  );
  const firstOpenQuestion =
    readiness.blockers[0] ??
    readiness.review_items[0] ??
    unresolvedChecks[0]?.summary ??
    null;

  const eligibilityBlocked =
    audit.overall_status === 'excluded' ||
    eligibilityChecks.some((check) => check.status === 'excluded');
  const eligibilityNeedsReview = eligibilityChecks.some(
    (check) =>
      check.status === 'review' ||
      check.status === 'excluded' ||
      check.status === 'unavailable',
  );
  const eligibilityEvidence =
    eligibilityChecks.find((check) => check.status !== 'verified') ??
    eligibilityChecks.at(-1);
  const unresolvedEvidence = unresolvedChecks[0];
  const eligibilityHeadline = eligibilityBlocked
    ? 'Current gate blocked'
    : eligibilityChecks.length === 0
      ? audit.overall_label
      : eligibilityNeedsReview
        ? 'Current gate needs review'
        : `${pluralize(
            verifiedEligibility.length,
            'current gate',
          )} cleared`;
  const eligibilityTone: ParcelDecisionBriefLane['tone'] = eligibilityBlocked
    ? 'rose'
    : eligibilityChecks.length === 0
      ? 'slate'
      : eligibilityNeedsReview
        ? 'amber'
        : 'emerald';
  const modelRank =
    typeof row.model_rank === 'number'
      ? `Historical model #${row.model_rank.toLocaleString()}`
      : 'Historical model context';
  const openQuestionCount =
    readiness.blockers.length > 0
      ? readiness.blockers.length
      : readiness.review_items.length > 0
        ? readiness.review_items.length
        : unresolvedChecks.length;
  const openHeadline =
    openQuestionCount > 0
      ? pluralize(openQuestionCount, 'open evidence item')
      : readiness.status === 'blocked'
        ? 'Decision blocker present'
        : readiness.status === 'limited_preview'
          ? 'Protected evidence withheld'
          : readiness.status === 'incomplete' ||
              readiness.status === 'review_required'
            ? 'Evidence review required'
            : 'No feed-level exception';

  return {
    label: readiness.label,
    evidenceAsOf: audit.evidence_generated_at?.slice(0, 10) ?? null,
    lanes: [
      {
        key: 'signal',
        eyebrow: 'Why it surfaced',
        headline: `${modelRank} · ${opportunityLabel(
          row.opportunity_category,
        )}`,
        detail:
          modelCheck?.summary ??
          'Historical redevelopment evidence supplied the screening order; it is not a parcel probability.',
        source: briefSource(modelCheck, 'Accepted historical model bundle'),
        tone: 'violet',
      },
      {
        key: 'eligibility',
        eyebrow: 'Why it survived',
        headline: eligibilityHeadline,
        detail: eligibilityEvidence?.summary ?? audit.overall_label,
        source: briefSource(
          eligibilityEvidence,
          'CityLens deterministic acquisition policy',
        ),
        tone: eligibilityTone,
      },
      {
        key: 'open_questions',
        eyebrow: 'What remains',
        headline: openHeadline,
        detail:
          firstOpenQuestion ??
          (readiness.status === 'initial_review_ready'
            ? 'No unresolved exception appears in the cited feed. Official records and professional diligence are still required.'
            : readiness.recommended_action),
        source: briefSource(
          unresolvedEvidence,
          'Current cited feed and decision audit',
        ),
        tone:
          readiness.blockers.length > 0
            ? 'rose'
            : openQuestionCount > 0 ||
                readiness.status === 'limited_preview' ||
                readiness.status === 'incomplete' ||
                readiness.status === 'review_required'
              ? 'amber'
              : 'slate',
      },
      {
        key: 'next_decision',
        eyebrow: 'Next decision',
        headline: readiness.label,
        detail: readiness.recommended_action,
        source: `CityLens decision-readiness policy${
          audit.evidence_generated_at
            ? ` · evidence ${audit.evidence_generated_at.slice(0, 10)}`
            : ''
        }`,
        tone: 'sky',
      },
    ],
  };
}

function parseBbl(
  bbl: string,
): { borough: string; block: string; lot: string } | null {
  const match = /^([1-5])(\d{5})(\d{4})$/.exec(bbl.trim());
  if (!match) return null;
  return {
    borough: match[1],
    block: String(Number(match[2])),
    lot: String(Number(match[3])),
  };
}

export function externalParcelLinks(row: ParcelIntelRow): ExternalParcelLink[] {
  const links: ExternalParcelLink[] = [];
  const parts = parseBbl(row.bbl);
  if (parts) {
    const { borough, block, lot } = parts;
    links.push(
      {
        label: 'ACRIS',
        href: `https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${borough}&block=${block}&lot=${lot}`,
      },
      {
        label: 'ZoLa',
        href: `https://zola.planning.nyc.gov/l/lot/${borough}/${block}/${lot}`,
      },
      {
        label: 'DOB BIS',
        href: `https://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?allborough=${borough}&allblock=${block}&alllot=${lot}&go5=+GO+`,
      },
    );
  }
  if (typeof row.lat === 'number' && typeof row.lng === 'number') {
    links.push(
      {
        label: 'Google Maps',
        href: `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`,
      },
      {
        label: 'Street View',
        href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${row.lat},${row.lng}`,
      },
    );
  }
  return links;
}

function ParcelDecisionAuditPanel({
  audit,
  workflowItem,
  signedIn,
  onOpenWorkflow,
}: {
  audit: ParcelDecisionAudit | undefined;
  workflowItem: ParcelWorkflowItem | null;
  signedIn: boolean;
  onOpenWorkflow: () => void;
}) {
  if (!audit) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-4 w-4" />
          Decision audit unavailable
        </div>
        <p className="mt-1 text-xs leading-5">
          This parcel response predates the evidence-audit contract. Reload the
          parcel or verify the source records directly.
        </p>
      </div>
    );
  }

  const overallStyle = {
    screened: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    screened_with_flags: 'border-amber-200 bg-amber-50 text-amber-950',
    excluded: 'border-rose-200 bg-rose-50 text-rose-950',
    incomplete: 'border-slate-300 bg-slate-100 text-slate-950',
  }[audit.overall_status];
  const readiness = audit.readiness;
  const readinessStyle = readiness ? READINESS_STYLES[readiness.status] : '';
  const benchmark = audit.validation.historical_benchmark_receipt ?? null;
  const benchmarkCards = benchmark
    ? [
        {
          label: 'Top 100',
          value: formatRate(benchmark.top_100.precision),
          detail: `${benchmark.top_100.observed_hits}/${benchmark.top_100.evaluated_rows} hits · 95% ${formatRate(benchmark.top_100.precision_95ci[0])}–${formatRate(benchmark.top_100.precision_95ci[1])}`,
        },
        {
          label: 'Top 1,000',
          value: formatRate(benchmark.top_1000.precision),
          detail: `${benchmark.top_1000.observed_hits.toLocaleString()}/${benchmark.top_1000.evaluated_rows.toLocaleString()} hits · 95% ${formatRate(benchmark.top_1000.precision_95ci[0])}–${formatRate(benchmark.top_1000.precision_95ci[1])}`,
        },
        {
          label: 'Eligible base rate',
          value: formatRate(benchmark.base_rate),
          detail: `${benchmark.observed_positive_rows.toLocaleString()}/${benchmark.evaluation_rows.toLocaleString()} filings`,
        },
      ]
    : [
        {
          label: 'Top 100',
          value: formatRate(audit.validation.precision_at_100),
          detail: null,
        },
        {
          label: 'Top 1,000',
          value: formatRate(audit.validation.precision_at_1000),
          detail: null,
        },
        {
          label: 'Base rate',
          value: formatRate(audit.validation.base_rate),
          detail: null,
        },
      ];

  return (
    <div data-testid="parcel-decision-audit">
      <section className={`rounded-xl border p-4 ${overallStyle}`}>
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
              Decision evidence audit
            </div>
            <h4 className="mt-1 text-base font-semibold">{audit.overall_label}</h4>
            <p className="mt-1 text-xs leading-5 opacity-80">
              This status organizes available evidence. It is not a purchase
              recommendation, appraisal, seller-intent score, or completed diligence.
            </p>
          </div>
        </div>
      </section>

      {readiness && (
        <section
          className={`mt-3 rounded-xl border p-4 ${readinessStyle}`}
          data-testid="parcel-decision-readiness"
        >
          <div className="flex items-start gap-2">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
                Next diligence decision
              </div>
              <h4 className="mt-1 text-sm font-semibold">{readiness.label}</h4>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {readiness.recommended_action}
              </p>
            </div>
          </div>

          {(readiness.blockers.length > 0 ||
            readiness.review_items.length > 0 ||
            readiness.cleared_items.length > 0) && (
            <div className="mt-3 space-y-2 border-t border-current/10 pt-3 text-xs leading-5">
              {readiness.blockers.map((item) => (
                <div key={`blocked-${item}`} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
              {readiness.review_items.map((item) => (
                <div key={`review-${item}`} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
              {readiness.cleared_items.map((item) => (
                <div key={`cleared-${item}`} className="flex items-start gap-2 opacity-80">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {signedIn && (
            <button
              type="button"
              onClick={onOpenWorkflow}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-medium text-white hover:bg-slate-800"
            >
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              {workflowItem ? 'Review workflow' : 'Use this as the first action'}
            </button>
          )}
          <p className="mt-3 text-[10px] leading-4 opacity-70">
            {readiness.disclaimer}
          </p>
        </section>
      )}

      <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <Gauge className="h-3.5 w-3.5" />
          Historical filing benchmark
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {benchmarkCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-950">
                {card.value}
              </div>
              {card.detail && (
                <div className="mt-1 text-[10px] leading-4 text-slate-500">
                  {card.detail}
                </div>
              )}
            </div>
          ))}
        </div>
        {benchmark && (
          <div
            data-testid="historical-benchmark-receipt"
            className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-[11px] leading-4 text-violet-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                2024 features → 2025 DOB filings
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-violet-200">
                {benchmark.evidence_status === 'development_exposed'
                  ? 'Development-exposed evidence'
                  : benchmark.evidence_status.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-1.5 text-violet-900/80">
              Observed 95% ranges use a Wilson interval around each fixed
              historical top-k list. {benchmark.interval.limitations}
            </p>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-4 text-slate-600">
          {audit.validation.evaluation_scope}
        </p>
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sky-50 p-2 text-[11px] leading-4 text-sky-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {audit.validation.disclaimer}
        </p>
      </section>

      <section className="mt-3 space-y-2" aria-label="Decision audit checks">
        {audit.checks.map((check) => {
          const status = AUDIT_STATUS_STYLES[check.status];
          const Icon =
            check.status === 'verified'
              ? BadgeCheck
              : check.status === 'excluded'
                ? XCircle
                : check.status === 'review'
                  ? CircleAlert
                  : Database;
          return (
            <article
              key={check.key}
              className="rounded-xl border border-slate-200 bg-white p-3"
              data-testid={`decision-audit-${check.key}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {AUDIT_LAYER_LABELS[check.layer]}
                    </div>
                    <h5 className="mt-0.5 text-xs font-semibold text-slate-950">
                      {check.label}
                    </h5>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {check.summary}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                <span>{check.source}</span>
                {check.as_of && <span>As of {check.as_of}</span>}
                {check.affects_model_rank ? (
                  <span className="font-semibold text-violet-700">Model input</span>
                ) : check.affects_acquisition_eligibility ? (
                  <span className="font-semibold text-emerald-700">
                    Eligibility gate
                  </span>
                ) : (
                  <span>Diligence only · no rank effect</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-900">
          <BriefcaseBusiness className="h-3.5 w-3.5" />
          User workflow evidence
        </div>
        {signedIn ? (
          workflowItem ? (
            <div className="mt-2 text-xs leading-5 text-violet-950">
              <span className="font-semibold capitalize">{workflowItem.stage}</span>
              {' · '}
              <span className="capitalize">
                {workflowItem.outcome.replaceAll('_', ' ')}
              </span>
              <div className="mt-1 text-violet-800">
                {workflowItem.next_action
                  ? `${workflowItem.next_action}${
                      workflowItem.next_action_due_date
                        ? ` · due ${workflowItem.next_action_due_date}`
                        : ' · no due date'
                    }`
                  : 'No next action has been recorded.'}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs leading-5 text-violet-800">
              This parcel is not yet in your acquisition workflow. User-entered
              disposition evidence remains separate from model and source evidence.
            </p>
          )
        ) : (
          <p className="mt-2 text-xs leading-5 text-violet-800">
            Sign in to add private notes, actions, and outcomes. Those fields never
            alter the historical model rank.
          </p>
        )}
      </section>

      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-800">
          What this audit cannot prove
        </summary>
        <ul className="mt-2 space-y-1.5 pl-4 text-[11px] leading-4 text-slate-600">
          {audit.limitations.map((limitation) => (
            <li key={limitation} className="list-disc">
              {limitation}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ParcelAcquisitionBrief({
  row,
  audit,
  isAuthenticated,
  onOpenAudit,
  onOpenWorkflow,
}: {
  row: ParcelIntelRow;
  audit: ParcelDecisionAudit;
  isAuthenticated: boolean;
  onOpenAudit: () => void;
  onOpenWorkflow: () => void;
}) {
  const readiness = audit.readiness;
  const brief = buildParcelDecisionBrief(row);
  if (!readiness || !brief) return null;

  const counts = [
    ['Blocked', readiness.blockers.length],
    ['Review', readiness.review_items.length],
    ['Cleared', readiness.cleared_items.length],
  ] as const;
  const laneStyles = {
    violet:
      'border-violet-300/20 bg-violet-400/[0.08] text-violet-100',
    emerald:
      'border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-400/[0.08] text-amber-100',
    sky: 'border-sky-300/20 bg-sky-400/[0.08] text-sky-100',
    rose: 'border-rose-300/20 bg-rose-400/[0.08] text-rose-100',
    slate: 'border-white/10 bg-white/[0.05] text-slate-100',
  } as const;
  const laneIcons = {
    signal: Gauge,
    eligibility: ShieldCheck,
    open_questions: CircleAlert,
    next_decision: ClipboardCheck,
  } as const;

  return (
    <section
      className="mb-3 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_42%),linear-gradient(145deg,#020617,#0f172a)] text-white shadow-lg ring-1 ring-inset ring-white/10"
      data-testid="parcel-decision-posture"
    >
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Acquisition decision brief
            </div>
            <h4 className="mt-1 text-sm font-semibold text-white">
              {brief.label}
            </h4>
            <p className="mt-1 text-[11px] leading-4 text-slate-300">
              Four evidence lanes kept separate—no composite confidence score.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-1 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-white/10">
            Source-bound
          </span>
        </div>

        <div
          className="mt-3 grid gap-2 sm:grid-cols-2"
          data-testid="parcel-decision-brief"
        >
          {brief.lanes.map((lane) => {
            const Icon = laneIcons[lane.key];
            return (
              <article
                key={lane.key}
                className={`rounded-xl border p-2.5 ${laneStyles[lane.tone]}`}
                data-testid={`parcel-decision-brief-${lane.key}`}
              >
                <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">
                  <Icon className="h-3 w-3" />
                  {lane.eyebrow}
                </div>
                <div className="mt-1 text-xs font-semibold leading-4">
                  {lane.headline}
                </div>
                <p className="mt-1 line-clamp-3 text-[10px] leading-4 opacity-75">
                  {lane.detail}
                </p>
                <p
                  className="mt-2 border-t border-current/10 pt-1.5 text-[9px] leading-[1.35] opacity-65"
                  title={lane.source}
                >
                  {lane.source}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
          {counts.map(([label, count]) => (
            <span
              key={label}
              className="rounded-full bg-white/[0.07] px-2 py-1 text-[10px] font-semibold text-slate-300 ring-1 ring-inset ring-white/10"
            >
              {label} {count}
            </span>
          ))}
          {brief.evidenceAsOf && (
            <span className="text-[10px] text-slate-400">
              Evidence {formatIsoDate(brief.evidenceAsOf)}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenAudit}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 text-[10px] font-semibold text-white hover:bg-white/[0.12]"
          >
            Inspect evidence
            <FileSearch className="h-3 w-3" />
          </button>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onOpenWorkflow}
              data-testid="parcel-decision-next-action"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-white px-2.5 text-[10px] font-semibold text-slate-950 hover:bg-sky-50"
            >
              Plan next action
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(
                `/parcel-intel?bbl=${row.bbl}`,
              )}`}
              data-testid="parcel-decision-next-action"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-white px-2.5 text-[10px] font-semibold text-slate-950 hover:bg-sky-50"
            >
              Unlock full screen
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">
          {readiness.disclaimer} The brief is not a buy/pass recommendation.
        </p>
      </div>
    </section>
  );
}

export function ParcelIntelPropertyPanel({
  row,
  onClose,
  onViewOwnerPortfolio,
  isCompared = false,
  compareLimitReached = false,
  onToggleCompare,
  decisionPeers = [],
  peerInventoryComplete = false,
  onOpenPeer,
  onComparePeer,
}: Props) {
  const auth = useAuth();
  const [tab, setTab] = useState<PanelTab>('overview');
  const [workflowItem, setWorkflowItem] = useState<ParcelWorkflowItem | null>(null);
  const [workflowEvents, setWorkflowEvents] = useState<ParcelWorkflowEvent[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [evidenceReviewBusyKey, setEvidenceReviewBusyKey] =
    useState<ParcelWorkflowEvidenceReviewKey | null>(null);
  const [evidenceIssueBusyKey, setEvidenceIssueBusyKey] =
    useState<ParcelWorkflowEvidenceReviewKey | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowLoadState, setWorkflowLoadState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [workflowContextBbl, setWorkflowContextBbl] = useState<string | null>(
    null,
  );
  const [workflowReloadKey, setWorkflowReloadKey] = useState(0);
  const [underwritingAdjusted, setUnderwritingAdjusted] = useState(false);
  const activeBblRef = useRef(row.bbl);
  const workflowMutationIdRef = useRef(0);
  const trackedDecisionAuditOpensRef = useRef(new Set<string>());
  const trackedUnderwritingOpensRef = useRef(new Set<string>());
  const trackedUnderwritingAdjustmentsRef = useRef(new Set<string>());
  const effectiveWorkflowLoadState =
    workflowContextBbl === row.bbl
      ? workflowLoadState
      : auth.status === 'authenticated'
        ? 'loading'
        : 'idle';
  const visibleWorkflowError =
    workflowContextBbl === row.bbl ? workflowError : null;
  const reasons = useMemo(() => explainParcel(row), [row]);
  const links = useMemo(() => externalParcelLinks(row), [row]);
  const hasNumberedAddress = /\d/.test(row.address ?? '');
  const hasViolationSnapshot =
    (row.dob_safety_active_count ?? 0) +
      (row.ecb_active_count ?? 0) +
      (row.hpd_open_count ?? 0) >
    0;
  const hasFloodplainScreen =
    typeof row.firm07_floodplain === 'boolean' &&
    typeof row.pfirm15_floodplain === 'boolean';
  const environmentalDesignationLabel =
    row.environmental_designation_kind === 'restrictive_declaration'
      ? 'restrictive declaration'
      : row.environmental_designation_kind === 'e_designation'
        ? 'E-designation'
        : 'environmental designation';

  const openDecisionAudit = (
    source: 'decision_posture' | 'audit_tab',
  ) => {
    setTab('audit');
    if (
      auth.status !== 'authenticated' ||
      trackedDecisionAuditOpensRef.current.has(row.bbl)
    ) {
      return;
    }
    trackedDecisionAuditOpensRef.current.add(row.bbl);
    void recordParcelProductEvent(
      'decision_audit_opened',
      source,
    ).catch(() => {
      // Aggregate adoption telemetry is best-effort and never blocks diligence.
    });
  };

  const openUnderwriting = () => {
    setTab('underwrite');
    if (
      auth.status !== 'authenticated' ||
      trackedUnderwritingOpensRef.current.has(row.bbl)
    ) {
      return;
    }
    trackedUnderwritingOpensRef.current.add(row.bbl);
    void recordParcelProductEvent(
      'underwriting_opened',
      'underwrite_tab',
    ).catch(() => {
      // Aggregate adoption telemetry is best-effort and never blocks underwriting.
    });
  };

  const trackFirstUnderwritingAdjustment = () => {
    setUnderwritingAdjusted(true);
    if (
      auth.status !== 'authenticated' ||
      trackedUnderwritingAdjustmentsRef.current.has(row.bbl)
    ) {
      return;
    }
    trackedUnderwritingAdjustmentsRef.current.add(row.bbl);
    void recordParcelProductEvent(
      'underwriting_assumptions_changed',
      'base_assumptions',
    ).catch(() => {
      // Values stay local; aggregate telemetry never blocks scenario editing.
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    activeBblRef.current = row.bbl;
    workflowMutationIdRef.current += 1;
    setTab('overview');
    setWorkflowItem(null);
    setWorkflowEvents([]);
    setWorkflowBusy(false);
    setEvidenceReviewBusyKey(null);
    setEvidenceIssueBusyKey(null);
    setUnderwritingAdjusted(false);
    setWorkflowError(null);
    setWorkflowContextBbl(row.bbl);
    if (auth.status !== 'authenticated') {
      setWorkflowLoadState('idle');
      return;
    }
    setWorkflowLoadState('loading');
    let cancelled = false;
    void getParcelWorkflow(row.bbl)
      .then((item) => {
        if (!cancelled) {
          setWorkflowItem(item);
          setWorkflowLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkflowError(
            'Pipeline status could not be loaded. Saving is disabled to protect existing work.',
          );
          setWorkflowLoadState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status, row.bbl, workflowReloadKey]);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !workflowItem) {
      setWorkflowEvents([]);
      return;
    }
    let cancelled = false;
    void listParcelWorkflowEvents(row.bbl)
      .then((events) => {
        if (!cancelled) setWorkflowEvents(events);
      })
      .catch(() => {
        if (!cancelled) setWorkflowEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status, row.bbl, workflowItem]);

  const saveWorkflow = async (
    draft: WorkflowDraft,
    options?: {
      openAfterSave?: boolean;
    },
  ) => {
    if (effectiveWorkflowLoadState !== 'ready') return;
    const bbl = row.bbl;
    const mutationId = workflowMutationIdRef.current + 1;
    workflowMutationIdRef.current = mutationId;
    setWorkflowBusy(true);
    setWorkflowError(null);
    try {
      const saved = await saveParcelWorkflow(bbl, {
        borough: row.borough ?? 'unknown',
        ...draft,
      });
      if (
        workflowMutationIdRef.current !== mutationId ||
        activeBblRef.current !== bbl
      ) {
        return;
      }
      setWorkflowItem(saved);
      if (options?.openAfterSave) setTab('workflow');
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowError('Could not save this parcel. Please retry.');
      }
    } finally {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowBusy(false);
      }
    }
  };

  const quickSaveWorkflow = () =>
    saveWorkflow(
      {
        stage: 'new',
        notes: '',
        tags: [],
        assignee: null,
        watching: true,
        decision_reason: null,
        next_action: null,
        next_action_due_date: null,
        outcome: 'unknown',
      },
      { openAfterSave: true },
    );

  const continueUnderwritingDiligence = () => {
    if (workflowItem) {
      setTab('workflow');
      return;
    }
    void saveWorkflow(
      {
        stage: 'reviewing',
        notes: '',
        tags: [],
        assignee: null,
        watching: true,
        decision_reason: null,
        next_action:
          row.mandatory_inclusionary_housing === true
            ? 'Validate MIH requirements, current zoning capacity, market evidence, and cost assumptions.'
            : 'Validate current zoning capacity, market evidence, and cost assumptions.',
        next_action_due_date: null,
        outcome: 'unknown',
      },
      { openAfterSave: true },
    );
  };

  const removeWorkflow = async () => {
    const bbl = row.bbl;
    const mutationId = workflowMutationIdRef.current + 1;
    workflowMutationIdRef.current = mutationId;
    setWorkflowBusy(true);
    setWorkflowError(null);
    try {
      await removeParcelWorkflow(bbl);
      if (
        workflowMutationIdRef.current !== mutationId ||
        activeBblRef.current !== bbl
      ) {
        return;
      }
      setWorkflowItem(null);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowError('Could not remove this parcel. Please retry.');
      }
    } finally {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowBusy(false);
      }
    }
  };

  const reviewEvidence = async (
    checkKey: ParcelWorkflowEvidenceReviewKey,
    check: ParcelDecisionAuditCheck,
  ) => {
    if (!workflowItem || effectiveWorkflowLoadState !== 'ready') return;
    const bbl = row.bbl;
    const mutationId = workflowMutationIdRef.current + 1;
    workflowMutationIdRef.current = mutationId;
    setWorkflowBusy(true);
    setEvidenceReviewBusyKey(checkKey);
    setWorkflowError(null);
    try {
      const updated = await reviewParcelWorkflowEvidence(bbl, checkKey, {
        expected_check_status: check.status,
        expected_source: check.source,
        expected_source_as_of: check.as_of,
        expected_feed_generated_at:
          row.decision_audit?.evidence_generated_at ?? null,
      });
      if (
        workflowMutationIdRef.current !== mutationId ||
        activeBblRef.current !== bbl
      ) {
        return;
      }
      setWorkflowItem(updated);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch (error) {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowError(
          error instanceof ApiError && error.status === 409
            ? 'The cited evidence changed. Close and reopen this parcel before reviewing the current version.'
            : 'Could not record this evidence review. Please retry.',
        );
      }
    } finally {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowBusy(false);
        setEvidenceReviewBusyKey(null);
      }
    }
  };

  const clearEvidenceReview = async (
    checkKey: ParcelWorkflowEvidenceReviewKey,
  ) => {
    if (!workflowItem || effectiveWorkflowLoadState !== 'ready') return;
    const bbl = row.bbl;
    const mutationId = workflowMutationIdRef.current + 1;
    workflowMutationIdRef.current = mutationId;
    setWorkflowBusy(true);
    setEvidenceReviewBusyKey(checkKey);
    setWorkflowError(null);
    try {
      const updated = await clearParcelWorkflowEvidenceReview(bbl, checkKey);
      if (
        workflowMutationIdRef.current !== mutationId ||
        activeBblRef.current !== bbl
      ) {
        return;
      }
      setWorkflowItem(updated);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowError('Could not undo this evidence review. Please retry.');
      }
    } finally {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowBusy(false);
        setEvidenceReviewBusyKey(null);
      }
    }
  };

  const reportEvidenceIssue = async (
    checkKey: ParcelWorkflowEvidenceReviewKey,
    check: ParcelDecisionAuditCheck,
    input: {
      issue_type: ParcelWorkflowEvidenceIssueType;
      reason_code: ParcelWorkflowEvidenceIssueReason;
      note: string;
    },
  ): Promise<boolean> => {
    if (!workflowItem || effectiveWorkflowLoadState !== 'ready') return false;
    const bbl = row.bbl;
    const mutationId = workflowMutationIdRef.current + 1;
    workflowMutationIdRef.current = mutationId;
    setWorkflowBusy(true);
    setEvidenceIssueBusyKey(checkKey);
    setWorkflowError(null);
    try {
      const updated = await submitParcelWorkflowEvidenceIssue(
        bbl,
        checkKey,
        {
          ...input,
          expected_check_status: check.status,
          expected_source: check.source,
          expected_source_as_of: check.as_of,
          expected_feed_generated_at:
            row.decision_audit?.evidence_generated_at ?? null,
        },
      );
      if (
        workflowMutationIdRef.current !== mutationId ||
        activeBblRef.current !== bbl
      ) {
        return false;
      }
      setWorkflowItem(updated);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
      return true;
    } catch (error) {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowError(
          error instanceof ApiError && error.status === 409
            ? 'The cited evidence changed or already has an open request. Reload the parcel before trying again.'
            : 'Could not submit this source issue. Please retry.',
        );
      }
      return false;
    } finally {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowBusy(false);
        setEvidenceIssueBusyKey(null);
      }
    }
  };

  const withdrawEvidenceIssue = async (
    checkKey: ParcelWorkflowEvidenceReviewKey,
  ) => {
    if (!workflowItem || effectiveWorkflowLoadState !== 'ready') return;
    const bbl = row.bbl;
    const mutationId = workflowMutationIdRef.current + 1;
    workflowMutationIdRef.current = mutationId;
    setWorkflowBusy(true);
    setEvidenceIssueBusyKey(checkKey);
    setWorkflowError(null);
    try {
      const updated = await withdrawParcelWorkflowEvidenceIssue(
        bbl,
        checkKey,
      );
      if (
        workflowMutationIdRef.current !== mutationId ||
        activeBblRef.current !== bbl
      ) {
        return;
      }
      setWorkflowItem(updated);
      window.dispatchEvent(new Event('citylens:workflow-updated'));
    } catch {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowError(
          'Could not withdraw this source issue. It may already have been resolved.',
        );
      }
    } finally {
      if (
        workflowMutationIdRef.current === mutationId &&
        activeBblRef.current === bbl
      ) {
        setWorkflowBusy(false);
        setEvidenceIssueBusyKey(null);
      }
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-white"
      data-testid="parcel-property-panel"
      role="region"
      aria-labelledby="parcel-property-panel-title"
    >
      <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4">
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Close parcel panel and return to ranked parcels"
          className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to ranked parcels
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-sky-700">
              {BOROUGH_LABELS[row.borough ?? ''] ?? row.borough} · BBL {row.bbl}
            </div>
            <h3
              id="parcel-property-panel-title"
              className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
            >
              {row.address ?? 'Address unavailable'}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200">
                {opportunityLabel(row.opportunity_category)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {priorityLabel(row.priority_tier)} priority
              </span>
              {row.acquisition_eligible && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  Acquisition screened
                </span>
              )}
              {row.address_source === 'nyc_pad' && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200"
                  title="NYC Property Address Directory address matched to this tax-lot BBL"
                >
                  <MapPin className="h-3 w-3" />
                  PAD · BBL matched
                </span>
              )}
              {!hasNumberedAddress && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
                  Unnumbered tax lot
                </span>
              )}
              {row.recent_change && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  Recent physical change
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white">
            {row.citywide_rank
              ? `NYC #${row.citywide_rank}`
              : row.priority_rank
                ? `${BOROUGH_SHORT_LABELS[row.borough ?? ''] ?? 'BR'} #${row.priority_rank}`
              : 'Ranked'}
          </span>
        </div>
        {(onToggleCompare || auth.status === 'authenticated') && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onToggleCompare && (
              <button
                type="button"
                data-testid="parcel-compare-toggle"
                aria-pressed={isCompared}
                aria-label={
                  isCompared
                    ? `Remove ${row.address ?? row.bbl} from comparison`
                    : `Add ${row.address ?? row.bbl} to comparison`
                }
                disabled={!isCompared && compareLimitReached}
                title={
                  !isCompared && compareLimitReached
                    ? 'Remove a parcel before adding another comparison'
                    : undefined
                }
                onClick={onToggleCompare}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCompared
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
                {isCompared ? 'Compared' : 'Compare'}
              </button>
            )}
            {auth.status === 'authenticated' && (
              <>
                <button
                  type="button"
                  data-testid="workflow-quick-save"
                  disabled={workflowBusy || effectiveWorkflowLoadState !== 'ready'}
                  onClick={() => {
                    if (workflowItem) {
                      setTab('workflow');
                      return;
                    }
                    void quickSaveWorkflow();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {effectiveWorkflowLoadState === 'idle' ||
                  effectiveWorkflowLoadState === 'loading' ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : effectiveWorkflowLoadState === 'error' ? (
                    <CircleAlert className="h-3.5 w-3.5" />
                  ) : workflowItem ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  )}
                  {effectiveWorkflowLoadState === 'idle' ||
                  effectiveWorkflowLoadState === 'loading'
                    ? 'Checking pipeline…'
                    : effectiveWorkflowLoadState === 'error'
                      ? 'Pipeline unavailable'
                      : workflowItem
                        ? 'In pipeline · Open'
                        : 'Save lead'}
                </button>
                <span className="text-[11px] leading-4 text-slate-500">
                  {workflowItem
                    ? 'Saved facts stay fixed; workflow updates never rewrite the original rank.'
                    : 'Creates the canonical save-time snapshot, then opens follow-up planning.'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <nav
        aria-label="Parcel workspace sections"
        data-testid="parcel-workspace-tabs"
        className="sticky top-0 z-20 grid shrink-0 grid-cols-2 border-b border-slate-200 bg-slate-50/95 p-1.5 shadow-sm backdrop-blur sm:static sm:grid-cols-4 sm:bg-slate-50 sm:shadow-none"
      >
        {(
          [
            ['overview', FileSearch, 'Overview'],
            ['audit', ShieldCheck, 'Audit'],
            ['underwrite', Building2, 'Underwrite'],
            ['workflow', BriefcaseBusiness, 'Workflow'],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              if (value === 'audit') {
                openDecisionAudit('audit_tab');
                return;
              }
              if (value === 'underwrite') {
                openUnderwriting();
                return;
              }
              setTab(value);
            }}
            aria-pressed={tab === value}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === value
                ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {visibleWorkflowError && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <span>{visibleWorkflowError}</span>
            {effectiveWorkflowLoadState === 'error' && (
              <button
                type="button"
                onClick={() => setWorkflowReloadKey((value) => value + 1)}
                className="shrink-0 rounded-md border border-rose-300 bg-white px-2 py-1 font-semibold hover:bg-rose-100"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {tab === 'overview' && (
          <div>
            {row.decision_audit?.readiness && (
              <ParcelAcquisitionBrief
                row={row}
                audit={row.decision_audit}
                isAuthenticated={auth.status === 'authenticated'}
                onOpenAudit={() => openDecisionAudit('decision_posture')}
                onOpenWorkflow={() => setTab('workflow')}
              />
            )}
            {row.acquisition_status === 'active_project' && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-950">
                      Existing project activity detected
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      {row.latest_project_type === 'land_use_entitlement'
                        ? `NYC Planning records ${row.latest_project_status?.toLowerCase() || 'active'} land-use entitlement activity`
                        : `Recent DOB ${row.latest_project_type === 'alt_co_new_building'
                            ? 'ALT-CO new-building'
                            : row.latest_project_type === 'demolition'
                              ? 'demolition'
                              : 'New Building'} activity`}{' '}
                      suggests this site is already committed. Treat it as market context,
                      not an acquisition lead.
                      {row.latest_project_job_number
                        ? ` Project ${row.latest_project_job_number}.`
                        : ''}
                    </p>
                    {row.latest_project_url && (
                      <a
                        href={row.latest_project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2"
                      >
                        Open official project record
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {(row.acquisition_status === 'constrained' ||
              row.acquisition_status === 'incomplete_data') && (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                <div className="font-semibold text-slate-950">
                  Not included in the acquisition ranking
                </div>
                <div className="mt-1">
                  {(row.acquisition_exclusion_reasons ?? [])
                    .map((reason) => reason.replaceAll('_', ' '))
                    .join(' · ') || 'Additional diligence is required.'}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {row.owner_name?.trim() && (
                <FactCard
                  label={row.owner_name_source === 'pluto' ? 'Owner (PLUTO)' : 'Owner'}
                  value={row.owner_name}
                  wide
                />
              )}
              <FactCard label="Lot area" value={`${formatNumber(row.lot_area_sqft)} sf`} />
              <FactCard label="Allowed FAR" value={String(row.allowed_far ?? '—')} />
              <FactCard
                label="Unused floor area"
                value={`${formatNumber(row.unused_floor_area_sqft)} sf`}
              />
              <FactCard
                label="Built utilization"
                value={
                  typeof row.far_utilization_pct === 'number'
                    ? `${row.far_utilization_pct.toFixed(0)}%`
                    : '—'
                }
              />
              <FactCard
                label="Last sale"
                value={`${formatCurrency(row.last_sale_price)}${
                  row.last_sale_year ? ` · ${row.last_sale_year}` : ''
                }`}
              />
              <FactCard
                label="Held"
                value={
                  typeof row.years_held === 'number'
                    ? `${row.years_held} ${row.years_held === 1 ? 'year' : 'years'}`
                    : '—'
                }
              />
              <FactCard label="Zoning" value={row.zoning_district_1 ?? '—'} />
              <FactCard
                label="Existing building"
                value={row.year_built && row.year_built > 0 ? String(row.year_built) : 'None recorded'}
              />
            </dl>

            {decisionPeers.length > 0 && onOpenPeer && onComparePeer && (
              <ParcelDecisionPeers
                peers={decisionPeers}
                fullInventory={peerInventoryComplete}
                onOpen={onOpenPeer}
                onCompare={onComparePeer}
              />
            )}

            {row.owner_portfolio_id &&
              (row.owner_portfolio_lot_count ?? 0) >= 2 && (
                <section className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-950">
                        Current PLUTO owner portfolio
                      </h4>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-lg font-semibold text-indigo-950">
                            {formatNumber(row.owner_portfolio_lot_count)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700">
                            Tax lots
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-indigo-950">
                            {formatNumber(row.owner_portfolio_borough_count)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700">
                            Boroughs
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-indigo-950">
                            {formatNumber(row.owner_portfolio_candidate_count)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700">
                            Current leads
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-indigo-900">
                        {formatNumber(row.owner_portfolio_total_lot_area_sqft)} sf
                        across current tax lots ·{' '}
                        {ownerEntityLabel(row.owner_entity_type)}
                      </p>
                      <p className="mt-2 text-[11px] leading-4 text-indigo-800">
                        Exact normalized PLUTO legal name only. Related LLCs are
                        not inferred, and same-name entities still require
                        ownership verification.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {onViewOwnerPortfolio && (
                          <button
                            type="button"
                            onClick={() =>
                              onViewOwnerPortfolio(row.owner_portfolio_id as string)
                            }
                            className="inline-flex h-8 items-center rounded-lg bg-indigo-950 px-3 text-xs font-medium text-white hover:bg-indigo-800"
                          >
                            View current candidate holdings
                          </button>
                        )}
                        <a
                          href="https://data.cityofnewyork.us/d/64uk-42ks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 hover:text-indigo-950"
                        >
                          PLUTO source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="mt-2 text-[10px] text-indigo-700">
                        Data retrieved{' '}
                        {row.owner_portfolio_data_as_of ?? 'date unavailable'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

            {row.tax_lien_sale_year && (
              <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-950">
                      {row.tax_lien_sale_year} final tax-lien sale record
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      NYC DOF included this tax lot in its final{' '}
                      {formatIsoDate(row.tax_lien_sale_date) ??
                        `${row.tax_lien_sale_year}`}{' '}
                      lien-sale list
                      {row.tax_lien_water_debt_only
                        ? ' for a water-debt-only record'
                        : ''}
                      . This historical distress signal does not prove a balance remains
                      unpaid, that foreclosure occurred, or that the property is for
                      sale. Verify current payoff and status before outreach.
                    </p>
                    {row.tax_lien_data_as_of && (
                      <p className="mt-1 text-[11px] text-amber-800">
                        Official dataset retrieved {row.tax_lien_data_as_of}.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      <a
                        href="https://www.nyc.gov/site/finance/property/property-lien-sales.page"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2"
                      >
                        NYC DOF guidance
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://data.cityofnewyork.us/d/9rz4-mjek"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2"
                      >
                        Official source data
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {hasViolationSnapshot && (
              <section className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-950">
                      Open violation snapshot
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-rose-900">
                      Current official agency statuses joined by BBL. Counts are
                      diligence flags, not ranking inputs or evidence that this
                      property is available.
                    </p>
                  </div>
                  {(row.critical_violation_count ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white">
                      {formatNumber(row.critical_violation_count)} immediate-hazard{' '}
                      {(row.critical_violation_count ?? 0) === 1
                        ? 'record'
                        : 'records'}
                    </span>
                  )}
                </div>

                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-rose-100 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      DOB Safety active
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">
                      {formatNumber(row.dob_safety_active_count)}
                    </dd>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      Latest issue{' '}
                      {formatIsoDate(row.dob_safety_latest_issue_date) ?? 'unavailable'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-100 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      OATH / ECB active
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">
                      {formatNumber(row.ecb_active_count)}
                    </dd>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      {formatNumber(row.ecb_class_1_count)} Class 1
                      immediately hazardous · reported balance{' '}
                      {formatCurrency(row.ecb_balance_due)}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      Latest issue {formatIsoDate(row.ecb_latest_issue_date) ?? 'unavailable'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-100 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      HPD open
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">
                      {formatNumber(row.hpd_open_count)}
                    </dd>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      {formatNumber(row.hpd_class_c_count)} Class C immediately
                      hazardous
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-600">
                      Latest inspection{' '}
                      {formatIsoDate(row.hpd_latest_inspection_date) ?? 'unavailable'}
                    </div>
                  </div>
                </dl>

                <p className="mt-3 text-[11px] leading-4 text-rose-900">
                  A building can have multiple records. Verify current status,
                  correction, hearing, and payment details in the agency systems
                  before underwriting or outreach
                  {row.violation_data_as_of
                    ? ` · data retrieved ${row.violation_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {[
                    ['DOB Safety source', 'https://data.cityofnewyork.us/d/855j-jady'],
                    ['OATH / ECB source', 'https://data.cityofnewyork.us/d/6bgk-3dad'],
                    ['HPD source', 'https://data.cityofnewyork.us/d/wvxf-dwi5'],
                  ].map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-950 underline decoration-rose-300 underline-offset-2"
                    >
                      {label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {hasFloodplainScreen && (
              <section
                className={`mt-3 rounded-xl border p-3 ${
                  row.floodplain_1pct
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        row.floodplain_1pct ? 'text-sky-950' : 'text-slate-800'
                      }`}
                    >
                      1% annual-chance floodplain screen
                    </h4>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        row.floodplain_1pct ? 'text-sky-900' : 'text-slate-600'
                      }`}
                    >
                      {row.floodplain_1pct
                        ? 'PLUTO flags some portion of this tax lot inside at least one mapped 1% annual-chance floodplain.'
                        : 'PLUTO does not flag this tax lot in either of the two parcel-level 1% annual-chance floodplain fields.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      row.floodplain_1pct
                        ? 'bg-sky-700 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300'
                    }`}
                  >
                    {row.floodplain_1pct ? 'Mapped overlap' : 'No PLUTO flag'}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/80 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      FEMA 2007 FIRM
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {row.firm07_floodplain ? 'Tax-lot overlap' : 'Not flagged'}
                    </dd>
                    <div className="mt-1 text-[11px] text-slate-600">
                      Adopted map
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/80 bg-white p-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      FEMA 2015 PFIRM
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {row.pfirm15_floodplain ? 'Tax-lot overlap' : 'Not flagged'}
                    </dd>
                    <div className="mt-1 text-[11px] text-slate-600">
                      Preliminary planning map
                    </div>
                  </div>
                </dl>

                <p
                  className={`mt-3 text-[11px] leading-4 ${
                    row.floodplain_1pct ? 'text-sky-900' : 'text-slate-600'
                  }`}
                >
                  A parcel overlap does not prove that an existing building lies
                  inside the mapped portion, establish a site elevation, or replace
                  survey, insurance, code, and resilience review
                  {row.floodplain_data_as_of
                    ? ` · PLUTO retrieved ${row.floodplain_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <a
                    href="https://data.cityofnewyork.us/d/64uk-42ks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 underline decoration-sky-300 underline-offset-2"
                  >
                    Official PLUTO source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://www.nyc.gov/site/floodmaps/maps/overview.page"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 underline decoration-sky-300 underline-offset-2"
                  >
                    NYC flood-map guidance
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </section>
            )}

            {typeof row.environmental_review_required === 'boolean' && (
              <section
                className={`mt-3 rounded-xl border p-3 ${
                  row.environmental_review_required
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        row.environmental_review_required
                          ? 'text-orange-950'
                          : 'text-slate-800'
                      }`}
                    >
                      Environmental designation
                    </h4>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        row.environmental_review_required
                          ? 'text-orange-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {row.environmental_review_required
                        ? `PLUTO lists ${environmentalDesignationLabel} ${
                            row.environmental_designation_number ??
                            'number unavailable'
                          } for this tax lot.`
                        : 'PLUTO does not list an E-designation or restrictive declaration for this tax lot.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      row.environmental_review_required
                        ? 'bg-orange-700 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300'
                    }`}
                  >
                    {row.environmental_review_required
                      ? row.environmental_designation_number ?? 'Review required'
                      : 'No PLUTO flag'}
                  </span>
                </div>
                <p
                  className={`mt-3 text-[11px] leading-4 ${
                    row.environmental_review_required
                      ? 'text-orange-900'
                      : 'text-slate-600'
                  }`}
                >
                  E-designations and restrictive declarations can concern
                  hazardous materials, air emissions, or noise. Neither is
                  proof of contamination or an automatic development
                  prohibition. Confirm the instrument, proposed-work trigger,
                  and required OER notices with an environmental professional
                  {row.environmental_designation_data_as_of
                    ? ` · PLUTO retrieved ${row.environmental_designation_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <a
                    href="https://www.nyc.gov/site/oer/remediation/e-designation.page"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-950 underline decoration-orange-300 underline-offset-2"
                  >
                    NYC OER guidance
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://data.cityofnewyork.us/d/64uk-42ks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-950 underline decoration-orange-300 underline-offset-2"
                  >
                    Official PLUTO source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </section>
            )}

            {typeof row.mandatory_inclusionary_housing === 'boolean' && (
              <section
                className={`mt-3 rounded-xl border p-3 ${
                  row.mandatory_inclusionary_housing
                    ? 'border-fuchsia-300 bg-fuchsia-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
                data-testid="mih-diligence"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        row.mandatory_inclusionary_housing
                          ? 'text-fuchsia-950'
                          : 'text-slate-800'
                      }`}
                    >
                      Mandatory Inclusionary Housing screen
                    </h4>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        row.mandatory_inclusionary_housing
                          ? 'text-fuchsia-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {row.mandatory_inclusionary_housing
                        ? 'This tax lot has positive-area overlap with a current adopted NYC Planning MIH mapped-area polygon.'
                        : 'The current NYC Planning MIH mapped-area layer does not overlap this tax lot.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      row.mandatory_inclusionary_housing
                        ? 'bg-fuchsia-700 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300'
                    }`}
                  >
                    {row.mandatory_inclusionary_housing
                      ? 'Mapped overlap'
                      : 'Not mapped'}
                  </span>
                </div>

                {row.mandatory_inclusionary_housing &&
                  (row.mih_options?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {row.mih_options?.map((option) => (
                        <span
                          key={option}
                          className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-fuchsia-900 ring-1 ring-inset ring-fuchsia-200"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  )}

                <p
                  className={`mt-3 text-[11px] leading-4 ${
                    row.mandatory_inclusionary_housing
                      ? 'text-fuchsia-900'
                      : 'text-slate-600'
                  }`}
                >
                  This is a dated spatial reference screen, not a tax-lot legal
                  determination. Applicability and the controlling option depend
                  on the current Zoning Resolution, proposed use, and floor area.
                  Verify Appendix F and project-specific requirements with NYC
                  Planning/HPD and zoning counsel
                  {row.mih_data_as_of
                    ? ` · official layer retrieved ${row.mih_data_as_of}`
                    : ''}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <a
                    href="https://data.cityofnewyork.us/Housing-Development/Mandatory-Inclusionary-Housing-MIH-/bw8v-wzdr/about"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-950 underline decoration-fuchsia-300 underline-offset-2"
                  >
                    Official MIH map
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://zr.planning.nyc.gov/index.php/node/21424"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-950 underline decoration-fuchsia-300 underline-offset-2"
                  >
                    Zoning Resolution Appendix F
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://www.nyc.gov/site/hpd/services-and-information/inclusionary-housing.page"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-950 underline decoration-fuchsia-300 underline-offset-2"
                  >
                    HPD guidance
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </section>
            )}

            {typeof row.nearest_transit_station_distance_m === 'number' && (
              <section
                className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3"
                data-testid="transit-diligence"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-cyan-950">
                      Subway / SIR access screen
                    </h4>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {row.nearest_transit_station_name ?? 'Unnamed station complex'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-cyan-950 ring-1 ring-inset ring-cyan-300">
                    {row.nearest_transit_station_distance_m.toLocaleString()} m
                  </span>
                </div>

                {(row.nearest_transit_routes?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Daytime routes">
                    {row.nearest_transit_routes?.map((route) => (
                      <span
                        key={route}
                        className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-950 px-2 py-1 text-[11px] font-bold text-white"
                      >
                        {route}
                      </span>
                    ))}
                  </div>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white p-2 ring-1 ring-inset ring-cyan-100">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                      ≤400 m
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-950">
                      {row.transit_station_count_400m ?? 0}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white p-2 ring-1 ring-inset ring-cyan-100">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                      ≤800 m
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-950">
                      {row.transit_station_count_800m ?? 0}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white p-2 ring-1 ring-inset ring-cyan-100">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                      ADA
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold capitalize text-slate-950">
                      {row.nearest_transit_ada_status ?? 'unknown'}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-[11px] leading-4 text-cyan-950">
                  Great-circle distance from the tax-lot centroid to the MTA
                  station-complex centroid. This is not a walking route,
                  entrance distance, travel time, service-frequency measure, or
                  zoning determination
                  {row.transit_data_as_of
                    ? ` · MTA data retrieved ${row.transit_data_as_of}`
                    : ''}
                  .
                </p>
                <a
                  href="https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-950 underline decoration-cyan-300 underline-offset-2"
                >
                  Official MTA station data
                  <ExternalLink className="h-3 w-3" />
                </a>
              </section>
            )}

            {(row.assemblage_lot_count ?? 0) >= 2 && (
              <section className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
                  Assemblage · {row.assemblage_lot_count} adjacent lots
                </h4>
                <p className="mt-1 text-xs text-violet-800">
                  {formatNumber(row.assemblage_combined_lot_area_sqft)} sf combined lot ·{' '}
                  {formatNumber(row.assemblage_combined_buildable_sqft)} sf potential envelope
                </p>
              </section>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="External parcel records">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-800"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>

            <ParcelBriefActions row={row} />

            <section className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Why it surfaced
              </h4>
              <div className="mt-2 space-y-2">
                {reasons.length > 0 ? (
                  reasons.map((reason) => (
                    <div
                      key={`${reason.label}-${reason.detail}`}
                      className={`rounded-xl border p-3 ${
                        reason.tone === 'caution'
                          ? 'border-amber-200 bg-amber-50'
                          : reason.tone === 'positive'
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        {reason.label}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {reason.detail}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    No single signal dominates this ranking. Review the underlying records
                    before advancing the parcel.
                  </p>
                )}
              </div>
            </section>

            {(row.top_features ?? []).length > 0 && (
              <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Model attribution
                </summary>
                <ul className="mt-3 space-y-2">
                  {row.top_features.map((feature) => (
                    <li key={feature.name} className="text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-800">
                          {modelFeatureLabel(feature.name)}
                        </span>
                        <span className="shrink-0">
                          {feature.contribution_logit >= 0 ? 'Raises' : 'Lowers'} ranking ·{' '}
                          {Math.round(feature.contribution_pct * 100)}%
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Observed value: {modelFeatureValue(feature)}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={
                            feature.contribution_logit >= 0
                              ? 'h-full bg-emerald-500'
                              : 'h-full bg-rose-500'
                          }
                          style={{
                            width: `${Math.min(
                              Math.abs(feature.contribution_pct) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-4 text-slate-500">
                  DOB activity records can include filings, trade permits, and renewals tied
                  to one job; they are not a count of completed buildings. Contributions
                  explain this model score, not seller intent.
                </p>
              </details>
            )}

            <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-xs font-semibold text-slate-800">Source freshness</h4>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>PLUTO {row.property_facts_as_of ?? 'date unavailable'}</span>
                <span>
                  {row.owner_name_source === 'pluto' ? 'PLUTO owner' : 'ACRIS ownership'}{' '}
                  {row.ownership_as_of ?? 'date unavailable'}
                </span>
                <span>DOB {row.project_activity_as_of ?? 'date unavailable'}</span>
                <span>ZAP {row.land_use_activity_as_of ?? 'date unavailable'}</span>
                {row.observed_imagery_year && (
                  <span>Imagery through {row.observed_imagery_year}</span>
                )}
              </div>
              {row.property_facts_current === false && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Current lot match unavailable. Verify capacity facts before use.
                </p>
              )}
            </section>
          </div>
        )}

        {tab === 'audit' && (
          <ParcelDecisionAuditPanel
            audit={row.decision_audit}
            workflowItem={workflowItem}
            signedIn={auth.status === 'authenticated'}
            onOpenWorkflow={() => setTab('workflow')}
          />
        )}

        {tab === 'underwrite' && (
          <div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
              This is a fast residual-land-value screen, not an appraisal. Verify zoning,
              affordable-housing requirements, construction costs, and tenancy.
            </div>
            <LandBasisCalculator
              row={row}
              defaultOpen
              onAssumptionsChange={trackFirstUnderwritingAdjustment}
            />
            <section
              className="mt-3 rounded-xl border border-slate-200 bg-white p-3"
              data-testid="underwriting-diligence-handoff"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-950">
                    <BriefcaseBusiness className="h-3.5 w-3.5 text-sky-700" />
                    Turn the screen into diligence
                  </h4>
                  <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">
                    {workflowItem
                      ? 'Continue with the saved evidence snapshot and next action.'
                      : underwritingAdjusted
                        ? 'Preserve this parcel and assign validation of capacity, market evidence, and costs.'
                        : 'Adjust at least one assumption above before advancing this screen.'}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Financial inputs stay in this browser session and are never
                    copied into the workflow.
                  </p>
                </div>
                {auth.status === 'authenticated' ? (
                  <button
                    type="button"
                    onClick={continueUnderwritingDiligence}
                    disabled={
                      workflowBusy ||
                      effectiveWorkflowLoadState !== 'ready' ||
                      (!workflowItem && !underwritingAdjusted)
                    }
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workflowBusy ||
                    effectiveWorkflowLoadState === 'idle' ||
                    effectiveWorkflowLoadState === 'loading' ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : workflowItem ? (
                      <ArrowRight className="h-3.5 w-3.5" />
                    ) : (
                      <BookmarkPlus className="h-3.5 w-3.5" />
                    )}
                    {effectiveWorkflowLoadState === 'idle' ||
                    effectiveWorkflowLoadState === 'loading'
                      ? 'Checking pipeline…'
                      : workflowItem
                        ? 'Continue diligence'
                        : 'Save for diligence'}
                  </button>
                ) : (
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(
                      `/parcel-intel?bbl=${row.bbl}`,
                    )}`}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Sign in to save
                  </Link>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === 'workflow' &&
          (auth.status === 'authenticated' ? (
            effectiveWorkflowLoadState === 'idle' ||
            effectiveWorkflowLoadState === 'loading' ? (
              <div
                className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"
                role="status"
              >
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking pipeline status…
              </div>
            ) : effectiveWorkflowLoadState === 'error' ? (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-800">
                Retry the pipeline check before creating or changing this lead.
              </div>
            ) : (
              <>
                <WorkflowEditor
                  item={workflowItem}
                  suggestedNextAction={
                    row.decision_audit?.readiness?.recommended_action
                  }
                  busy={workflowBusy}
                  onSave={(draft) => saveWorkflow(draft)}
                  onRemove={removeWorkflow}
                />
                {workflowItem && (
                  <EvidenceReviewChecklist
                    key={workflowItem.bbl}
                    audit={row.decision_audit}
                    item={workflowItem}
                    busyKey={evidenceReviewBusyKey}
                    issueBusyKey={evidenceIssueBusyKey}
                    onReview={reviewEvidence}
                    onClear={clearEvidenceReview}
                    onReportIssue={reportEvidenceIssue}
                    onWithdrawIssue={withdrawEvidenceIssue}
                  />
                )}
                {workflowEvents.length > 0 && (
                <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    <Clock3 className="h-3.5 w-3.5" />
                    Decision history
                  </h4>
                  <ol className="mt-2 space-y-2">
                    {workflowEvents.slice(0, 8).map((event) => (
                      <li
                        key={event.event_id}
                        className="border-l-2 border-slate-200 pl-3 text-xs"
                      >
                        <div className="font-medium capitalize text-slate-900">
                          {event.event_type}
                          {event.to_stage ? ` · ${event.to_stage}` : ''}
                          {event.to_outcome && event.to_outcome !== 'unknown'
                            ? ` · ${event.to_outcome.replaceAll('_', ' ')}`
                            : ''}
                        </div>
                        <div className="mt-0.5 text-slate-500">
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(event.occurred_at))}
                          {event.changed_fields.length > 0
                            ? ` · ${event.changed_fields.length} field${
                                event.changed_fields.length === 1 ? '' : 's'
                              } changed`
                            : ''}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                )}
              </>
            )
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                <LockKeyhole className="h-5 w-5 text-slate-500" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-slate-950">
                Sign in to manage this opportunity
              </h4>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">
                Save notes, assign an owner, watch record changes, and move the parcel
                through your acquisition pipeline.
              </p>
              <Link
                href={`/sign-in?next=${encodeURIComponent(
                  `/parcel-intel?bbl=${row.bbl}`,
                )}`}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-950 px-4 text-xs font-medium text-white hover:bg-slate-800"
              >
                Sign in
              </Link>
            </div>
          ))}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] leading-4 text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Screening intelligence only—verify official
          records and site conditions.
        </span>
      </div>
    </div>
  );
}

function FactCard({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 ${
        wide ? 'col-span-2' : ''
      }`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-950" title={value}>
        {value}
      </dd>
    </div>
  );
}
