import type { ParcelIntelRow } from '@/lib/api';
import {
  BOROUGH_LABELS,
  opportunityLabel,
  priorityLabel,
} from './parcel-intel-explorer-support';

function escapeMarkdown(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]<>#]/g, '\\$&');
}

function text(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Not available';
  return escapeMarkdown(String(value));
}

function number(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not available';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function currency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not available';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function readiness(row: ParcelIntelRow): string {
  const statusLabels = {
    eligible: 'Acquisition screened',
    active_project: 'Existing project activity',
    completed_project: 'Completed project',
    constrained: 'Current constraint',
    incomplete_data: 'Evidence incomplete',
  } satisfies Record<
    NonNullable<ParcelIntelRow['acquisition_status']>,
    string
  >;
  return (
    row.decision_audit?.readiness?.label ??
    (row.acquisition_status
      ? statusLabels[row.acquisition_status]
      : 'Initial review required')
  );
}

function diligenceFlags(row: ParcelIntelRow): string[] {
  const flags: string[] = [];
  if (row.acquisition_status === 'active_project') flags.push('Active project');
  if (row.acquisition_status === 'completed_project') {
    flags.push('Completed project');
  }
  if (row.is_landmark) flags.push('Individual landmark');
  if (row.is_historic_district) flags.push('Historic district');
  if (row.floodplain_1pct) flags.push('1% floodplain tax-lot overlap');
  if (row.environmental_review_required) {
    flags.push('Environmental review designation');
  }
  if (row.mandatory_inclusionary_housing) flags.push('MIH mapped-area overlap');
  if ((row.critical_violation_count ?? 0) > 0) {
    flags.push(`${row.critical_violation_count} immediate-hazard records`);
  }
  return flags;
}

function projectRecord(row: ParcelIntelRow): string {
  const label = [row.latest_project_job_number, row.latest_project_status]
    .filter(Boolean)
    .map((value) => escapeMarkdown(String(value)))
    .join(' · ');
  if (!label) return 'None surfaced';
  if (row.latest_project_url?.startsWith('https://')) {
    try {
      const url = new URL(row.latest_project_url);
      if (url.protocol === 'https:') {
        return `[${label}](<${url.toString().replaceAll('>', '%3E')}>)`;
      }
    } catch {
      // A malformed source URL stays visible as a record label without a link.
    }
  }
  return label;
}

function evidenceDates(row: ParcelIntelRow): string[] {
  return [
    ['Property facts', row.property_facts_as_of],
    ['Ownership', row.ownership_as_of],
    ['Project activity', row.project_activity_as_of],
    ['Violations', row.violation_data_as_of],
    ['Floodplain', row.floodplain_data_as_of],
    ['Environmental', row.environmental_designation_data_as_of],
    ['MIH', row.mih_data_as_of],
    ['Transit', row.transit_data_as_of],
    ['Tax-lien history', row.tax_lien_data_as_of],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([label, value]) => `${label}: ${escapeMarkdown(value)}`);
}

/** Build a portable, user-triggered brief without workflow notes or hidden fields. */
export function buildComparisonBrief(rows: ParcelIntelRow[]): string {
  const lines = [
    '# CityLens parcel evidence comparison',
    '',
    'Screening aid only—not an appraisal, site plan, zoning opinion, seller-intent score, or buy/pass recommendation. Verify current official records and complete professional diligence before acting.',
  ];

  rows.forEach((row, index) => {
    const flags = diligenceFlags(row);
    const dates = evidenceDates(row);
    lines.push(
      '',
      `## ${index + 1}. ${escapeMarkdown(row.address ?? `BBL ${row.bbl}`)}`,
      '',
      `- **BBL:** ${escapeMarkdown(row.bbl)}`,
      `- **Borough:** ${text(BOROUGH_LABELS[row.borough ?? ''] ?? row.borough)}`,
      `- **Decision posture:** ${escapeMarkdown(readiness(row))}`,
      `- **Recommended next action:** ${text(
        row.decision_audit?.readiness?.recommended_action ??
          'Verify current records before pursuit.',
      )}`,
      `- **Opportunity / priority:** ${escapeMarkdown(
        opportunityLabel(row.opportunity_category),
      )} · ${escapeMarkdown(priorityLabel(row.priority_tier))}`,
      `- **Capacity screen:** ${number(row.lot_area_sqft)} sqft lot · ${number(
        row.allowed_far,
      )} allowed FAR · ${number(
        row.unused_floor_area_sqft,
      )} sqft unused floor area`,
      `- **Owner / tenure:** ${text(
        row.owner_name ?? row.owner_type,
      )} · ${number(row.years_held)} years held`,
      `- **Last sale:** ${currency(row.last_sale_price)}${
        row.last_sale_year ? ` (${row.last_sale_year})` : ''
      }`,
      `- **Current project record:** ${projectRecord(row)}`,
      `- **Surfaced diligence:** ${
        flags.length ? flags.map(escapeMarkdown).join('; ') : 'No surfaced flags'
      }`,
      `- **Evidence dates:** ${
        dates.length ? dates.join('; ') : 'Not available'
      }`,
    );
  });

  return `${lines.join('\n')}\n`;
}
