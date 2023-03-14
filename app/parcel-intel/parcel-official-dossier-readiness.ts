import type { ParcelOfficialDossier } from '@/lib/api';

export type DossierEvidenceStatus =
  | 'available'
  | 'partial'
  | 'review'
  | 'missing';

export type DossierEvidenceGroup = {
  key:
    | 'identity'
    | 'ownership'
    | 'deed'
    | 'physical'
    | 'zoning'
    | 'constraints';
  label: string;
  status: DossierEvidenceStatus;
  detail: string;
};

export type DossierVerificationAction = {
  key: string;
  label: string;
  detail: string;
  link: keyof ParcelOfficialDossier['official_links'];
};

export type DossierEvidenceReadiness = {
  status: 'strong' | 'partial' | 'review_required';
  label: string;
  presentCount: number;
  totalCount: number;
  reviewCount: number;
  partialCount: number;
  missingCount: number;
  groups: DossierEvidenceGroup[];
  actions: DossierVerificationAction[];
};

function present(value: string | number | null): boolean {
  return value !== null && value !== '';
}

function evidenceGroup(
  group: DossierEvidenceGroup,
): DossierEvidenceGroup {
  return group;
}

export function buildDossierEvidenceReadiness(
  dossier: ParcelOfficialDossier,
): DossierEvidenceReadiness {
  const physicalValues = [
    dossier.lot_area_sqft,
    dossier.building_area_sqft,
    dossier.units,
    dossier.year_built,
    dossier.land_use,
    dossier.building_class,
  ];
  const physicalPresent = physicalValues.filter(present).length;
  const hasZoning = Boolean(
    dossier.zoning_district_1 || dossier.zoning_district_2,
  );
  const hasFar = [
    dossier.built_far,
    dossier.residential_far,
    dossier.commercial_far,
    dossier.facility_far,
  ].some((value) => value !== null);
  const hasDeedDate = dossier.last_sale_date !== null;
  const hasDeedAmount = dossier.last_sale_price !== null;
  const mappedConstraint =
    dossier.firm_2007_floodplain ||
    dossier.pfirm_2015_floodplain ||
    dossier.environmental_review_required;

  const groups: DossierEvidenceGroup[] = [
    evidenceGroup({
      key: 'identity',
      label: 'Tax-lot identity',
      status: dossier.address ? 'available' : 'missing',
      detail: dossier.address
        ? 'Official address and canonical BBL are present.'
        : 'The canonical BBL is present; the official address is unavailable.',
    }),
    evidenceGroup({
      key: 'ownership',
      label: 'Recorded ownership',
      status:
        dossier.owner_source_status === 'match'
          ? 'available'
          : dossier.owner_source_status === 'different'
            ? 'review'
          : dossier.owner_source_status === 'unavailable'
            ? 'missing'
            : 'partial',
      detail:
        dossier.owner_source_status === 'match'
          ? 'PLUTO and ACRIS recorded-party names align.'
          : dossier.owner_source_status === 'different'
            ? 'PLUTO and ACRIS identify different recorded parties.'
            : dossier.owner_source_status === 'unavailable'
              ? 'Neither source reports a recorded owner.'
              : 'Only one recorded-owner source is available.',
    }),
    evidenceGroup({
      key: 'deed',
      label: 'Latest deed',
      status:
        hasDeedDate && hasDeedAmount
          ? 'available'
          : hasDeedDate || hasDeedAmount
            ? 'partial'
            : 'missing',
      detail:
        hasDeedDate && hasDeedAmount
          ? 'Latest observed deed date and consideration are present.'
          : hasDeedDate || hasDeedAmount
            ? 'The latest deed record is only partially populated.'
            : 'No latest deed date or consideration is available.',
    }),
    evidenceGroup({
      key: 'physical',
      label: 'Physical record',
      status:
        physicalPresent >= 4
          ? 'available'
          : physicalPresent > 0
            ? 'partial'
            : 'missing',
      detail:
        physicalPresent >= 4
          ? `${physicalPresent} of ${physicalValues.length} core PLUTO physical fields are present.`
          : physicalPresent > 0
            ? `Only ${physicalPresent} of ${physicalValues.length} core PLUTO physical fields are present.`
            : 'Core PLUTO physical fields are unavailable.',
    }),
    evidenceGroup({
      key: 'zoning',
      label: 'Zoning references',
      status:
        hasZoning && hasFar
          ? 'available'
          : hasZoning || hasFar
            ? 'partial'
            : 'missing',
      detail:
        hasZoning && hasFar
          ? 'Mapped zoning district and FAR references are present.'
          : hasZoning || hasFar
            ? 'Mapped zoning references are only partially populated.'
            : 'Mapped zoning district and FAR references are unavailable.',
    }),
    evidenceGroup({
      key: 'constraints',
      label: 'Mapped constraints',
      status: mappedConstraint ? 'review' : 'available',
      detail: mappedConstraint
        ? 'At least one mapped flood or environmental designation needs review.'
        : 'No mapped flood overlap or environmental designation is reported.',
    }),
  ];

  const presentCount = groups.filter(
    (group) => group.status !== 'missing',
  ).length;
  const reviewCount = groups.filter(
    (group) => group.status === 'review',
  ).length;
  const partialCount = groups.filter(
    (group) => group.status === 'partial',
  ).length;
  const missingCount = groups.filter(
    (group) => group.status === 'missing',
  ).length;
  const actions: DossierVerificationAction[] = [];

  if (groups.find((group) => group.key === 'ownership')?.status !== 'available') {
    actions.push({
      key: 'verify-title',
      label: 'Verify the deed chain',
      detail:
        'Review ACRIS parties and documents before relying on a recorded-owner name.',
      link: 'acris',
    });
  } else if (groups.find((group) => group.key === 'deed')?.status !== 'available') {
    actions.push({
      key: 'verify-deed',
      label: 'Review deed history',
      detail:
        'Open ACRIS to confirm the latest transfer and any nominal consideration.',
      link: 'acris',
    });
  }

  if (
    groups.find((group) => group.key === 'zoning')?.status !== 'available' ||
    dossier.environmental_review_required
  ) {
    actions.push({
      key: 'verify-zoning',
      label: 'Review mapped zoning',
      detail:
        'Use ZoLa to inspect districts, overlays, special-purpose areas, and environmental designations.',
      link: 'zola',
    });
  }

  if (
    groups.find((group) => group.key === 'physical')?.status !== 'available'
  ) {
    actions.push({
      key: 'verify-building',
      label: 'Cross-check building records',
      detail:
        'Use DOB BIS to reconcile building, occupancy, and physical-record gaps.',
      link: 'dob_bis',
    });
  }

  if (
    dossier.firm_2007_floodplain ||
    dossier.pfirm_2015_floodplain
  ) {
    actions.push({
      key: 'verify-flood',
      label: 'Confirm flood context',
      detail:
        'Inspect the current mapped flood context and obtain site-specific diligence.',
      link: 'zola',
    });
  }

  if (actions.length === 0) {
    actions.push({
      key: 'verify-source',
      label: 'Open the official records',
      detail:
        'Cross-check the cited source systems before underwriting or outreach.',
      link: 'zola',
    });
  }

  const status =
    reviewCount > 0
      ? 'review_required'
      : missingCount > 0 || partialCount > 0
        ? 'partial'
        : 'strong';

  return {
    status,
    label:
      status === 'review_required'
        ? 'Source review required'
        : status === 'partial'
          ? 'Source coverage partial'
          : 'Source coverage strong',
    presentCount,
    totalCount: groups.length,
    reviewCount,
    partialCount,
    missingCount,
    groups,
    actions: actions.slice(0, 3),
  };
}
