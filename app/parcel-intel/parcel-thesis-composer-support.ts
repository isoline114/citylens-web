import {
  BOROUGH_LABELS,
  signalLabel,
  siteTypeLabel,
  type ExplorerFilters,
  type ExplorerPriority,
  type ExplorerSignal,
  type ExplorerSiteType,
} from './parcel-intel-explorer-support';

export type ThesisCriterion = {
  id:
    | 'borough'
    | 'priority'
    | 'site_type'
    | `signal:${ExplorerSignal}`
    | 'min_lot_area_sqft'
    | 'min_unused_floor_area_sqft';
  label: string;
  valueLabel: string;
  source: 'explicit' | 'safe_default';
};

export type ThesisUnsupportedConcept = {
  id:
    | 'exclusion'
    | 'financial'
    | 'maximum_or_range'
    | 'owner_contact'
    | 'program'
    | 'seller_intent'
    | 'zoning';
  label: string;
  guidance: string;
};

export type ThesisComposition = {
  normalizedText: string;
  borough: string;
  priority: ExplorerPriority;
  siteType: ExplorerSiteType;
  signals: ExplorerSignal[];
  minLotAreaSqft: number | null;
  minUnusedFloorAreaSqft: number | null;
  criteria: ThesisCriterion[];
  unsupported: ThesisUnsupportedConcept[];
  conflicts: string[];
  explicitCriterionCount: number;
  canApply: boolean;
};

type TextRule<T extends string> = {
  value: T;
  patterns: RegExp[];
};

const BOROUGH_RULES: TextRule<string>[] = [
  {
    value: 'staten_island',
    patterns: [/\bstaten\s+island\b/i],
  },
  { value: 'manhattan', patterns: [/\bmanhattan\b/i] },
  { value: 'brooklyn', patterns: [/\bbrooklyn\b/i] },
  { value: 'queens', patterns: [/\bqueens\b/i] },
  { value: 'bronx', patterns: [/\b(?:the\s+)?bronx\b/i] },
];

const SITE_TYPE_RULES: TextRule<ExplorerSiteType>[] = [
  {
    value: 'active_project',
    patterns: [/\bactive\s+(?:development\s+)?projects?\b/i],
  },
  {
    value: 'conversion_or_overbuilt',
    patterns: [
      /\bconversion(?:\s+opportunities|\s+sites?)?\b/i,
      /\boverbuilt(?:\s+sites?)?\b/i,
    ],
  },
  {
    value: 'ground_up_candidate',
    patterns: [/\bground[\s-]*up(?:\s+candidates?|\s+sites?)?\b/i],
  },
  {
    value: 'vacant_site',
    patterns: [/\bvacant(?:\s+land|\s+lots?|\s+sites?)?\b/i],
  },
  {
    value: 'all',
    patterns: [/\ball\s+(?:qualified\s+)?sites?\b/i],
  },
  {
    value: 'uncommitted',
    patterns: [
      /\bqualified\s+leads?\b/i,
      /\buncommitted(?:\s+sites?)?\b/i,
      /\bacquisition\s+candidates?\b/i,
    ],
  },
];

const SIGNAL_RULES: Array<
  TextRule<ExplorerSignal> & { negativePatterns: RegExp[] }
> = [
  {
    value: 'assemblage',
    patterns: [/\bassembl(?:age|y|ies)\b/i, /\bmultiple\s+adjacent\s+lots?\b/i],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:an?\s+)?assembl(?:age|y|ies)\b/i,
    ],
  },
  {
    value: 'long_held',
    patterns: [/\blong[\s-]*held\b/i, /\blong[\s-]*term\s+owner(?:ship)?\b/i],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+long[\s-]*held\b/i,
    ],
  },
  {
    value: 'recent_change',
    patterns: [
      /\brecent(?:\s+aerial)?\s+change\b/i,
      /\baerial[\s-]*change\s+evidence\b/i,
    ],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+recent(?:\s+aerial)?\s+change\b/i,
    ],
  },
  {
    value: 'transit_800m',
    patterns: [
      /\bnear(?:by)?\s+(?:the\s+)?(?:subway|transit|sir)\b/i,
      /\bwithin\s+800\s*m(?:eters?)?\s+of\s+(?:the\s+)?(?:subway|transit|sir)\b/i,
      /\btransit[\s-]*(?:served|accessible|proximate)\b/i,
    ],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:nearby\s+)?(?:subway|transit|sir)\b/i,
    ],
  },
  {
    value: 'portfolio',
    patterns: [
      /\bportfolio\s+owner(?:ship)?\b/i,
      /\bowner\s+portfolio\b/i,
      /\bmulti[\s-]*property\s+owner(?:ship)?\b/i,
      /\bowner\s+concentration\b/i,
    ],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:portfolio|multi[\s-]*property)\s+owners?\b/i,
    ],
  },
  {
    value: 'tax_lien',
    patterns: [/\btax[\s-]*liens?\b/i],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:a\s+)?tax[\s-]*liens?\b/i,
    ],
  },
  {
    value: 'violations',
    patterns: [/\bcritical\s+violations?\b/i, /\bviolations?\b/i],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:critical\s+)?violations?\b/i,
    ],
  },
  {
    value: 'floodplain',
    patterns: [/\bflood[\s-]*plain\b/i, /\bflood\s+risk\b/i],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|outside|without)\s+(?:the\s+)?(?:flood[\s-]*plain|flood\s+risk)\b/i,
    ],
  },
  {
    value: 'environmental_review',
    patterns: [
      /\benvironmental\s+(?:review|designation|constraint)\b/i,
      /\be[\s-]*designation\b/i,
    ],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:an?\s+)?environmental\s+(?:review|designation|constraint)\b/i,
    ],
  },
  {
    value: 'mih',
    patterns: [
      /\bmandatory\s+inclusionary\s+housing\b/i,
      /\binclusionary\s+housing\b/i,
      /\bmih\b/i,
    ],
    negativePatterns: [
      /\b(?:avoid|exclude|excluding|no|without)\s+(?:mandatory\s+)?inclusionary\s+housing\b/i,
    ],
  },
];

const UNSUPPORTED_RULES: Array<{
  id: ThesisUnsupportedConcept['id'];
  label: string;
  guidance: string;
  patterns: RegExp[];
}> = [
  {
    id: 'financial',
    label: 'Financial or market assumptions',
    guidance:
      'Price, rent, returns, and cost assumptions belong in explicit underwriting—not the parcel screen.',
    patterns: [
      /\b(?:purchase|asking|land)\s+price\b/i,
      /\b(?:under|below|less\s+than|at\s+most|max(?:imum)?)\s+\$\s*\d[\d,.]*\s*(?:k|m|b)?\b/i,
      /\b(?:cap\s+rate|irr|return\s+on|rent|revenue|construction\s+cost|hard\s+cost|soft\s+cost|land\s+value|valuation)\b/i,
    ],
  },
  {
    id: 'program',
    label: 'Building program or feasibility',
    guidance:
      'Units, parking, height, massing, and feasible yield require a site-specific study.',
    patterns: [
      /\b\d[\d,]*\s*(?:residential\s+)?units?\b/i,
      /\b(?:unit\s+count|bedrooms?|parking\s+(?:count|ratio|spaces?)|massing|stories|storeys|building\s+height|feasible\s+yield)\b/i,
    ],
  },
  {
    id: 'owner_contact',
    label: 'Owner contact information',
    guidance:
      'Contact research is not part of this composer and needs separately governed provenance.',
    patterns: [
      /\b(?:owner|seller)\s+(?:email|phone|contact|address)\b/i,
      /\bcontact\s+(?:the\s+)?owner\b/i,
    ],
  },
  {
    id: 'seller_intent',
    label: 'Seller or transaction intent',
    guidance:
      'CityLens does not infer willingness to sell, acquisition probability, or transaction timing.',
    patterns: [
      /\b(?:motivated\s+seller|willing(?:ness)?\s+to\s+sell|likely\s+to\s+sell|acquisition\s+probability|transaction\s+probability)\b/i,
    ],
  },
  {
    id: 'zoning',
    label: 'Custom zoning or entitlement rule',
    guidance:
      'Use the visible parcel evidence to verify mapped zoning; the composer does not invent a zoning filter.',
    patterns: [
      /\b(?:[rcm]\d[\da-z-]*)\s+zon(?:e|ed|ing)\b/i,
      /\b(?:zoned|zoning\s+district|rezon(?:e|ed|ing)|allowed\s+far)\b/i,
    ],
  },
  {
    id: 'maximum_or_range',
    label: 'Maximum or range criterion',
    guidance:
      'The current audited numeric contract supports minimum lot area and minimum unused-FAR proxy only.',
    patterns: [
      /\b(?:under|below|less\s+than|at\s+most|maximum|max)\b.{0,35}\b(?:lot|parcel|unused\s+far|unused\s+floor)\b/i,
      /\b(?:lot|parcel|unused\s+far|unused\s+floor)\b.{0,35}\b(?:under|below|less\s+than|at\s+most|maximum|max|between)\b/i,
      /\bbetween\s+\d[\d,.]*\s*(?:k|m)?\s+and\s+\d[\d,.]*/i,
    ],
  },
];

const LOT_MINIMUM_PATTERNS = [
  /\b(?:at\s+least|min(?:imum)?(?:\s+of)?|over|more\s+than)\s+(\d[\d,.]*)([km])?\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)?\s+(?:lots?|lot\s+area|parcels?|parcel\s+area)\b/i,
  /\b(?:lots?|lot\s+area|parcels?|parcel\s+area)\s+(?:of\s+)?(?:at\s+least|min(?:imum)?(?:\s+of)?|over|more\s+than)\s+(\d[\d,.]*)([km])?\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)?\b/i,
  /\b(\d[\d,.]*)([km])?\s*\+\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)\s+(?:lots?|lot\s+area|parcels?|parcel\s+area)\b/i,
  /\b(\d[\d,.]*)([km])?\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)\s*\+\s+(?:lots?|lot\s+area|parcels?|parcel\s+area)\b/i,
];

const UNUSED_FAR_MINIMUM_PATTERNS = [
  /\b(?:at\s+least|min(?:imum)?(?:\s+of)?|over|more\s+than)\s+(\d[\d,.]*)([km])?\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)?\s+(?:unused\s+far|unused\s+floor\s+area|unused\s+development\s+rights?|remaining\s+far)\b/i,
  /\b(?:unused\s+far|unused\s+floor\s+area|unused\s+development\s+rights?|remaining\s+far)\s+(?:of\s+)?(?:at\s+least|min(?:imum)?(?:\s+of)?|over|more\s+than)\s+(\d[\d,.]*)([km])?\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)?\b/i,
  /\b(\d[\d,.]*)([km])?\s*\+\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)\s+(?:unused\s+far|unused\s+floor\s+area|unused\s+development\s+rights?|remaining\s+far)\b/i,
  /\b(\d[\d,.]*)([km])?\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft|sqft|sf)\s*\+\s+(?:unused\s+far|unused\s+floor\s+area|unused\s+development\s+rights?|remaining\s+far)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function negationWindows(text: string): string[] {
  return (
    text.match(
      /\b(?:avoid|exclude|excluding|no|not\s+in|outside|without)\b[^,.;]{0,100}/gi,
    ) ?? []
  );
}

function uniqueRuleValues<T extends string>(
  text: string,
  rules: TextRule<T>[],
  negativeWindows: string[] = [],
): T[] {
  return rules
    .filter(
      (rule) =>
        matchesAny(text, rule.patterns) &&
        !negativeWindows.some((window) => matchesAny(window, rule.patterns)),
    )
    .map((rule) => rule.value);
}

function parseScaledNumber(raw: string, suffix: string | undefined): number {
  const base = Number(raw.replaceAll(',', ''));
  const multiplier =
    suffix?.toLowerCase() === 'm'
      ? 1_000_000
      : suffix?.toLowerCase() === 'k'
        ? 1_000
        : 1;
  return Math.round(base * multiplier);
}

function numericMatches(text: string, patterns: RegExp[]): number[] {
  return [
    ...new Set(
      patterns.flatMap((pattern) => {
        const flags = pattern.flags.includes('g')
          ? pattern.flags
          : `${pattern.flags}g`;
        return [...text.matchAll(new RegExp(pattern.source, flags))].flatMap(
          (match) => {
            if (!match[1]) return [];
            const parsed = parseScaledNumber(match[1], match[2]);
            return Number.isFinite(parsed) ? [parsed] : [];
          },
        );
      }),
    ),
  ];
}

function unsupportedConcepts(
  text: string,
  hasNegatedSignal: boolean,
): ThesisUnsupportedConcept[] {
  const result = UNSUPPORTED_RULES.filter((rule) =>
    matchesAny(text, rule.patterns),
  ).map(({ id, label, guidance }) => ({ id, label, guidance }));
  if (hasNegatedSignal) {
    result.push({
      id: 'exclusion',
      label: 'Negative or exclusion criterion',
      guidance:
        'The current screen supports positive requirements only. Review the excluded geography, site type, hazard, or constraint directly instead of silently reversing it.',
    });
  }
  return [...new Map(result.map((item) => [item.id, item])).values()];
}

function priorityValues(text: string): ExplorerPriority[] {
  if (
    /\b(?:high\s+or\s+better|high\s+or\s+highest|top\s+two\s+tiers?)\b/i.test(
      text,
    )
  ) {
    return ['high_or_better'];
  }
  const values: ExplorerPriority[] = [];
  if (/\b(?:highest|top)[\s-]*priority\b/i.test(text)) {
    values.push('highest');
  }
  if (/\bhigh[\s-]*priority\b/i.test(text)) {
    values.push('high_or_better');
  }
  return [...new Set(values)];
}

function priorityLabel(value: ExplorerPriority): string {
  if (value === 'highest') return 'Highest tier only';
  if (value === 'high_or_better') return 'High or highest tier';
  return 'All priority tiers';
}

function numericConflict(
  values: number[],
  label: string,
  maximum: number,
): string | null {
  if (values.length > 1) {
    return `${label} contains more than one minimum. Use one explicit threshold.`;
  }
  if (values[0] !== undefined && (values[0] < 1 || values[0] > maximum)) {
    return `${label} must be between 1 and ${maximum.toLocaleString()} square feet.`;
  }
  return null;
}

export function composeParcelThesis(input: string): ThesisComposition {
  const normalizedText = input.trim().replaceAll(/\s+/g, ' ');
  const negativeWindows = negationWindows(normalizedText);
  const boroughValues = uniqueRuleValues(
    normalizedText,
    BOROUGH_RULES,
    negativeWindows,
  );
  const siteTypeValues = uniqueRuleValues(
    normalizedText,
    SITE_TYPE_RULES,
    negativeWindows,
  );
  const priorityIsNegated = negativeWindows.some((window) =>
    /\b(?:highest|top|high)[\s-]*priority\b/i.test(window),
  );
  const priorities = priorityIsNegated
    ? []
    : priorityValues(normalizedText);
  const signals: ExplorerSignal[] = [];
  let hasNegatedSignal =
    priorityIsNegated ||
    negativeWindows.some(
      (window) =>
        BOROUGH_RULES.some((rule) => matchesAny(window, rule.patterns)) ||
        SITE_TYPE_RULES.some((rule) => matchesAny(window, rule.patterns)),
    );
  for (const rule of SIGNAL_RULES) {
    const negated =
      matchesAny(normalizedText, rule.negativePatterns) ||
      negativeWindows.some((window) => matchesAny(window, rule.patterns));
    if (negated) {
      hasNegatedSignal = true;
      continue;
    }
    if (matchesAny(normalizedText, rule.patterns)) {
      signals.push(rule.value);
    }
  }

  const lotMinimums = numericMatches(normalizedText, LOT_MINIMUM_PATTERNS);
  const unusedFarMinimums = numericMatches(
    normalizedText,
    UNUSED_FAR_MINIMUM_PATTERNS,
  );
  const conflicts = [
    boroughValues.length > 1
      ? `More than one borough was recognized: ${boroughValues
          .map((value) => BOROUGH_LABELS[value] ?? value)
          .join(', ')}.`
      : null,
    siteTypeValues.length > 1
      ? `More than one site type was recognized: ${siteTypeValues
          .map(siteTypeLabel)
          .join(', ')}.`
      : null,
    priorities.length > 1
      ? 'Both highest-only and high-or-better priority were recognized.'
      : null,
    numericConflict(lotMinimums, 'Minimum lot area', 10_000_000),
    numericConflict(
      unusedFarMinimums,
      'Minimum unused-FAR proxy',
      100_000_000,
    ),
  ].filter((value): value is string => Boolean(value));

  const borough = boroughValues[0] ?? 'all';
  const priority = priorities[0] ?? 'all';
  const siteType = siteTypeValues[0] ?? 'uncommitted';
  const minLotAreaSqft = lotMinimums[0] ?? null;
  const minUnusedFloorAreaSqft = unusedFarMinimums[0] ?? null;
  const criteria: ThesisCriterion[] = [];
  if (borough !== 'all') {
    criteria.push({
      id: 'borough',
      label: 'Geography',
      valueLabel: BOROUGH_LABELS[borough] ?? borough,
      source: 'explicit',
    });
  }
  if (priority !== 'all') {
    criteria.push({
      id: 'priority',
      label: 'Priority',
      valueLabel: priorityLabel(priority),
      source: 'explicit',
    });
  }
  criteria.push({
    id: 'site_type',
    label: 'Site type',
    valueLabel: siteTypeLabel(siteType),
    source: siteTypeValues.length > 0 ? 'explicit' : 'safe_default',
  });
  for (const signal of signals) {
    criteria.push({
      id: `signal:${signal}`,
      label: 'Required evidence',
      valueLabel: signalLabel(signal),
      source: 'explicit',
    });
  }
  if (minLotAreaSqft !== null) {
    criteria.push({
      id: 'min_lot_area_sqft',
      label: 'PLUTO lot area',
      valueLabel: `≥ ${minLotAreaSqft.toLocaleString()} sf`,
      source: 'explicit',
    });
  }
  if (minUnusedFloorAreaSqft !== null) {
    criteria.push({
      id: 'min_unused_floor_area_sqft',
      label: 'Unused FAR proxy',
      valueLabel: `≥ ${minUnusedFloorAreaSqft.toLocaleString()} sf`,
      source: 'explicit',
    });
  }

  const explicitCriterionCount = criteria.filter(
    (criterion) => criterion.source === 'explicit',
  ).length;
  return {
    normalizedText,
    borough,
    priority,
    siteType,
    signals,
    minLotAreaSqft,
    minUnusedFloorAreaSqft,
    criteria,
    unsupported: unsupportedConcepts(normalizedText, hasNegatedSignal),
    conflicts,
    explicitCriterionCount,
    canApply: explicitCriterionCount > 0 && conflicts.length === 0,
  };
}

export function filtersFromThesisComposition(
  current: ExplorerFilters,
  composition: ThesisComposition,
): ExplorerFilters {
  return {
    ...current,
    borough: composition.borough,
    priority: composition.priority,
    siteType: composition.siteType,
    signals: [...composition.signals],
    minLotAreaSqft: composition.minLotAreaSqft,
    minUnusedFloorAreaSqft: composition.minUnusedFloorAreaSqft,
    query: '',
    ownerPortfolioId: null,
  };
}
