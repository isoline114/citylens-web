import { expect, test } from '@playwright/test';

test('authenticated parcel explorer shows maturity-qualified outcome evidence', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'citylens_mock_auth_user',
      JSON.stringify({
        id: 'mock-outcomes',
        email: 'outcomes@mock.local',
        displayName: 'Outcome tester',
      }),
    );
  });

  await page.route('**/v1/parcel-intel/map?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-07-24T02:43:29Z',
        rows: [
          {
            bbl: '3020960069',
            borough: 'brooklyn',
            address: '100 E 21 STREET',
            lat: 40.65,
            lng: -73.96,
            citywide_rank: 82,
            acquisition_rank: 21,
            acquisition_eligible: true,
            acquisition_status: 'eligible',
            priority_tier: 'highest',
            opportunity_category: 'ground_up_candidate',
            score_calibrated: 0.42,
            lot_area_sqft: 5_000,
            land_use: '01',
          },
        ],
      }),
    });
  });

  await page.route(
    '**/v1/parcel-intel/workflow/analytics',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'citylens/parcel-workflow-analytics@v2',
          generated_at: '2026-07-24T03:16:26Z',
          measurement_status: 'directional',
          measurement_label: 'Directional maturity-qualified evidence',
          total_records: 12,
          active_records: 10,
          archived_records: 2,
          event_history_records: 12,
          rank_snapshot_records: 12,
          valid_saved_at_records: 12,
          oldest_followup_days: 220,
          median_followup_days: 75,
          minimum_cohort_size: 30,
          minimum_rate_denominator: 10,
          stage_counts: { reviewing: 8, pursue: 4 },
          outcome_counts: { owner_contacted: 4, unknown: 8 },
          decision_reason_counts: {},
          funnel: {
            saved: 12,
            contacted: 4,
            meeting_scheduled: 2,
            qualified: 2,
            offer_submitted: 1,
            under_contract: 0,
            closed: 0,
            rejected: 2,
            lost: 0,
            contacted_per_saved: {
              numerator: 4,
              denominator: 12,
              rate: 0.3333,
              sufficient_denominator: true,
            },
            qualified_per_contacted: {
              numerator: 2,
              denominator: 4,
              rate: 0.5,
              sufficient_denominator: false,
            },
            offer_per_qualified: {
              numerator: 1,
              denominator: 2,
              rate: 0.5,
              sufficient_denominator: false,
            },
            contract_per_offer: {
              numerator: 0,
              denominator: 1,
              rate: 0,
              sufficient_denominator: false,
            },
            close_per_contract: {
              numerator: 0,
              denominator: 0,
              rate: null,
              sufficient_denominator: false,
            },
          },
          maturity_windows: [
            {
              milestone: 'owner_contacted',
              label: 'Contacted within 30 days',
              horizon_days: 30,
              eligible_records: 10,
              reached_within_horizon: 4,
              pending_records: 2,
              rate: 0.4,
              sufficient_denominator: true,
            },
            {
              milestone: 'qualified',
              label: 'Qualified within 90 days',
              horizon_days: 90,
              eligible_records: 8,
              reached_within_horizon: 2,
              pending_records: 4,
              rate: 0.25,
              sufficient_denominator: false,
            },
            {
              milestone: 'offer_submitted',
              label: 'Offer submitted within 180 days',
              horizon_days: 180,
              eligible_records: 3,
              reached_within_horizon: 1,
              pending_records: 9,
              rate: 0.3333,
              sufficient_denominator: false,
            },
            {
              milestone: 'under_contract',
              label: 'Under contract within 270 days',
              horizon_days: 270,
              eligible_records: 0,
              reached_within_horizon: 0,
              pending_records: 12,
              rate: null,
              sufficient_denominator: false,
            },
            {
              milestone: 'closed',
              label: 'Closed within 365 days',
              horizon_days: 365,
              eligible_records: 0,
              reached_within_horizon: 0,
              pending_records: 12,
              rate: null,
              sufficient_denominator: false,
            },
          ],
          cohorts: [
            {
              dimension: 'rank_band',
              value: '1-100',
              total: 12,
              contacted: 4,
              qualified: 2,
              offer_submitted: 1,
              under_contract: 0,
              closed: 0,
              rejected: 2,
              lost: 0,
              contacted_rate_denominator: 10,
              qualified_rate_denominator: 8,
              close_rate_denominator: 0,
              contacted_rate: 0.4,
              qualified_rate: 0.25,
              close_rate: null,
            },
          ],
          warnings: [
            'These are user-entered prospective workflow outcomes, not model accuracy.',
          ],
        }),
      });
    },
  );

  await page.goto('/parcel-intel');
  await page.getByRole('button', { name: 'Outcome insights' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Are saved leads becoming real opportunities?',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Directional maturity-qualified evidence'),
  ).toBeVisible();
  await expect(
    page.getByTestId('maturity-window-owner_contacted'),
  ).toContainText('40%');
  await expect(
    page.getByTestId('maturity-window-owner_contacted'),
  ).toContainText('4 of 10 mature · 2 pending');
  await expect(
    page.getByTestId('maturity-window-qualified'),
  ).toContainText('Collecting');
  await expect(
    page.getByRole('columnheader', { name: 'Contacted ≤30d' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: /40%.*n=10/ })).toBeVisible();
  await expect(
    page.getByText(/not the historical model's validation accuracy/i),
  ).toBeVisible();
});
