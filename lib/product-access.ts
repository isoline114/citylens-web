export const PRODUCT_ACCESS = {
  publicPreviewParcelCount: 125,
  authenticatedParcelCount: 5_000,
  freeMonthlyRunLimit: 5,
} as const;

export const PRODUCT_ACCESS_COPY = {
  publicPreview: '125-parcel public preview',
  authenticatedWorkspace: 'Full 5,000-lead citywide workspace',
  monthlyRuns: '5 custom imagery runs per month',
  freeAccountSummary:
    'Every verified account includes the full 5,000-lead citywide workspace and five custom imagery runs each month.',
} as const;
