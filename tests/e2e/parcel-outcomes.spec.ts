import { expect, test } from '@playwright/test';

test('authenticated parcel explorer shows maturity-qualified outcome evidence', async ({
  page,
}) => {
  let reminderSnoozed = false;
  const productEvents: unknown[] = [];

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
            mandatory_inclusionary_housing: true,
            nearest_transit_station_name: 'Church Av',
            nearest_transit_station_distance_m: 420,
            nearest_transit_routes: ['B', 'Q'],
            nearest_transit_ada_status: 'full',
            transit_station_count_800m: 2,
            transit_access_tier: 'walkable',
          },
        ],
      }),
    });
  });

  await page.route(
    '**/v1/parcel-intel/parcel/3020960069',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          bbl: '3020960069',
          borough: 'brooklyn',
          address: '100 E 21 STREET',
          score_calibrated: 0.42,
          score_calibrated_p10: 0.31,
          score_calibrated_p90: 0.53,
          priority_rank: 21,
          priority_tier: 'highest',
          model_rank: 65,
          acquisition_rank: 21,
          citywide_rank: 82,
          acquisition_eligible: true,
          acquisition_status: 'eligible',
          acquisition_exclusion_reasons: [],
          lot_area_sqft: 5000,
          allowed_far: 2,
          max_floor_area_sqft: 10000,
          unused_floor_area_sqft: 5000,
          far_utilization_pct: 50,
          zoning_district_1: 'R6',
          land_use: '01',
          year_built: 1930,
          num_floors: 2,
          lat: 40.65,
          lng: -73.96,
          last_sale_price: 1_400_000,
          last_sale_year: 2025,
          years_held: 1,
          has_recent_sale_5yr: true,
          is_landmark: false,
          is_historic_district: false,
          block_id: '302096',
          block_rank: 1,
          top_features: [],
          redev_status: 'still_vacant',
          opportunity_category: 'ground_up_candidate',
          property_facts_current: true,
          property_facts_as_of: '2026-07-24',
          ownership_as_of: '2026-07-15',
          project_activity_as_of: '2026-07-22',
          land_use_activity_as_of: '2026-07-24',
          data_warnings: [],
          mandatory_inclusionary_housing: true,
          mih_options: ['Option 1'],
          mih_area_count: 1,
          mih_data_as_of: '2026-07-24',
          nearest_transit_complex_id: '628',
          nearest_transit_station_name: 'Church Av',
          nearest_transit_station_distance_m: 420,
          nearest_transit_routes: ['B', 'Q'],
          nearest_transit_ada_status: 'full',
          transit_station_count_400m: 0,
          transit_station_count_800m: 2,
          transit_access_tier: 'walkable',
          transit_data_as_of: '2026-07-24',
          decision_audit: {
            schema_version: 'citylens/parcel-decision-audit@v1',
            overall_status: 'screened_with_flags',
            overall_label: 'Eligible lead with diligence flags',
            readiness: {
              status: 'review_required',
              label: 'Diligence review required before advancing',
              recommended_action:
                'Resolve the listed diligence items in the cited source records before advancing to owner outreach or detailed underwriting.',
              blockers: [],
              review_items: [
                'Review floodplain exposure and site-specific mitigation requirements.',
                'Verify MIH applicability, mapped options, and affordable-housing requirements against current Appendix F before relying on residual land value.',
              ],
              cleared_items: [
                'Current project and acquisition eligibility gates passed.',
              ],
              disclaimer:
                'Decision readiness is not a purchase recommendation, appraisal, title opinion, seller-intent score, or substitute for professional diligence.',
            },
            validation: {
              target: 'dob_nb_job_filing',
              evaluation_scope: '2024 PLUTO to 2025 DOB NB filings',
              precision_at_100: 0.34,
              precision_at_1000: 0.104,
              base_rate: 0.0012439591,
              prospective_validated: false,
              disclaimer:
                'Historical next-year DOB new-building filing performance is not seller intent, transaction probability, or acquisition conversion.',
            },
            checks: [
              {
                key: 'historical_model',
                layer: 'model_signal',
                label: 'Historical redevelopment signal',
                status: 'informational',
                summary: 'Historical screening order, not a parcel probability.',
                source: 'Accepted model bundle',
                as_of: '2025-2025',
                affects_model_rank: true,
                affects_acquisition_eligibility: false,
              },
              {
                key: 'acquisition_eligibility',
                layer: 'eligibility_gate',
                label: 'Current acquisition gate',
                status: 'verified',
                summary: 'This lead passed current project and ownership gates.',
                source: 'CityLens deterministic acquisition policy',
                as_of: '2026-07-24',
                affects_model_rank: false,
                affects_acquisition_eligibility: true,
              },
              {
                key: 'current_diligence',
                layer: 'current_diligence',
                label: 'Current diligence overlays',
                status: 'review',
                summary:
                  'Review before underwriting: 1% floodplain overlap; mandatory inclusionary housing mapped-area overlap.',
                source: 'NYC PLUTO/FEMA and NYC Planning MIH',
                as_of: '2026-07-24',
                affects_model_rank: false,
                affects_acquisition_eligibility: false,
              },
              {
                key: 'transit_access',
                layer: 'current_diligence',
                label: 'Subway/SIR accessibility',
                status: 'verified',
                summary:
                  'Nearest MTA station complex: Church Av, 420 m straight-line; routes B, Q; 2 complexes within 800 m.',
                source: 'MTA Subway Stations',
                as_of: '2026-07-24',
                affects_model_rank: false,
                affects_acquisition_eligibility: false,
              },
            ],
            limitations: [
              'The historical target is not owner willingness to sell.',
            ],
          },
        }),
      });
    },
  );

  await page.route(
    '**/v1/parcel-intel/product-events',
    async (route) => {
      productEvents.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, body: '' });
    },
  );

  await page.route(
    '**/v1/parcel-intel/workflow/3020960069',
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: 'null',
        });
        return;
      }
      if (route.request().method() !== 'PUT') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          bbl: '3020960069',
          borough: 'brooklyn',
          stage: 'new',
          notes: '',
          tags: [],
          assignee: null,
          watching: true,
          decision_reason: null,
          next_action: null,
          next_action_due_date: null,
          outcome: 'unknown',
          snapshot: {
            feed_generated_at: '2026-07-24T09:15:49Z',
            property_facts_as_of: '2026-07-24',
            citywide_rank: 82,
            acquisition_rank: 21,
            priority_tier: 'highest',
            opportunity_category: 'ground_up_candidate',
          },
          saved_at: '2026-07-24T09:40:00Z',
          updated_at: '2026-07-24T09:40:00Z',
        }),
      });
    },
  );

  await page.route(
    '**/v1/parcel-intel/workflow/3020960069/events',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: '[]',
      });
    },
  );

  await page.route(
    '**/v1/parcel-intel/workflow/actions',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'citylens/parcel-workflow-actions@v1',
          generated_at: '2026-07-24T03:16:26Z',
          total_records: 3,
          open_records: 2,
          completed_records: 1,
          overdue_count: 1,
          due_today_count: 0,
          due_soon_count: 0,
          scheduled_count: 0,
          unscheduled_count: 1,
          unassigned_count: 1,
          outcome_update_due_count: 1,
          attention_count: reminderSnoozed ? 1 : 2,
          snoozed_count: reminderSnoozed ? 1 : 0,
          complete_plan_count: 1,
          plan_coverage_rate: 0.5,
          assigned_count: 1,
          assignee_coverage_rate: 0.5,
          outcome_current_count: 1,
          outcome_current_rate: 0.5,
          items: [
            {
              bbl: '3020960069',
              borough: 'brooklyn',
              address: '100 E 21 STREET',
              stage: 'reviewing',
              outcome: 'unknown',
              assignee: 'Acquisitions',
              next_action: 'Call owner',
              next_action_due_date: '2026-07-22',
              action_state: 'overdue',
              days_overdue: 2,
              days_since_update: 10,
              needs_assignee: false,
              needs_outcome_update: true,
              requires_attention: true,
              reminder_snoozed_until: reminderSnoozed
                ? '2026-07-25T14:00:00Z'
                : null,
              is_snoozed: reminderSnoozed,
              citywide_rank: 82,
              priority_tier: 'highest',
              opportunity_category: 'ground_up_candidate',
              saved_at: '2026-06-01T14:00:00Z',
              updated_at: '2026-07-14T14:00:00Z',
            },
            {
              bbl: '4012340056',
              borough: 'queens',
              address: null,
              stage: 'new',
              outcome: 'unknown',
              assignee: null,
              next_action: null,
              next_action_due_date: null,
              action_state: 'unscheduled',
              days_overdue: 0,
              days_since_update: 3,
              needs_assignee: true,
              needs_outcome_update: false,
              requires_attention: true,
              reminder_snoozed_until: null,
              is_snoozed: false,
              citywide_rank: 145,
              priority_tier: 'high',
              opportunity_category: 'vacant_site',
              saved_at: '2026-07-20T14:00:00Z',
              updated_at: '2026-07-21T14:00:00Z',
            },
          ],
        }),
      });
    },
  );

  await page.route(
    '**/v1/parcel-intel/workflow/3020960069/reminder',
    async (route) => {
      const body = route.request().postDataJSON() as { days: number };
      reminderSnoozed = body.days > 0;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          bbl: '3020960069',
          reminder_snoozed_until: reminderSnoozed
            ? '2026-07-25T14:00:00Z'
            : null,
          is_snoozed: reminderSnoozed,
        }),
      });
    },
  );

  await page.route(
    '**/v1/parcel-intel/workflow/analytics',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'citylens/parcel-workflow-analytics@v3',
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
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0.1382,
                upper: 0.6093,
              },
              sufficient_denominator: true,
            },
            qualified_per_contacted: {
              numerator: 2,
              denominator: 4,
              rate: 0.5,
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0.15,
                upper: 0.85,
              },
              sufficient_denominator: false,
            },
            offer_per_qualified: {
              numerator: 1,
              denominator: 2,
              rate: 0.5,
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0.0945,
                upper: 0.9055,
              },
              sufficient_denominator: false,
            },
            contract_per_offer: {
              numerator: 0,
              denominator: 1,
              rate: 0,
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0,
                upper: 0.7935,
              },
              sufficient_denominator: false,
            },
            close_per_contract: {
              numerator: 0,
              denominator: 0,
              rate: null,
              confidence_interval: null,
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
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0.1682,
                upper: 0.6873,
              },
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
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0.0715,
                upper: 0.5907,
              },
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
              confidence_interval: {
                confidence_level: 0.95,
                lower: 0.0615,
                upper: 0.7923,
              },
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
              confidence_interval: null,
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
              confidence_interval: null,
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
              contacted_confidence_interval: {
                confidence_level: 0.95,
                lower: 0.1682,
                upper: 0.6873,
              },
              qualified_rate: 0.25,
              qualified_confidence_interval: {
                confidence_level: 0.95,
                lower: 0.0715,
                upper: 0.5907,
              },
              close_rate: null,
              close_confidence_interval: null,
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
  await expect(
    page.getByRole('button', { name: /Subway\/SIR ≤800 m/i }),
  ).toContainText('1');
  await page.getByRole('button', { name: 'Action queue' }).click();
  await expect(
    page.getByRole('heading', { name: 'What needs attention next?' }),
  ).toBeVisible();
  await expect(page.getByTestId('workflow-action-3020960069')).toContainText(
    '2 days overdue',
  );
  await expect(page.getByTestId('workflow-action-3020960069')).toContainText(
    'Outcome update due',
  );
  await expect(
    page.getByText('Plan coverage').locator('..'),
  ).toContainText('50%');
  await page
    .getByTestId('workflow-action-3020960069')
    .getByRole('button', { name: 'Snooze 1 day' })
    .click();
  await expect(page.getByRole('button', { name: 'Snoozed 1' })).toBeVisible();
  await expect(
    page.getByLabel('1 workflow items need attention'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Snoozed 1' }).click();
  await page.getByRole('button', { name: 'Restore reminder' }).click();
  await expect(page.getByRole('button', { name: 'Snoozed 0' })).toBeVisible();
  await expect(
    page.getByLabel('2 workflow items need attention'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close action queue' }).click();

  await page.getByRole('button', { name: /100 E 21 STREET/i }).click();
  await expect(page.getByTestId('workflow-quick-save')).toHaveText('Save lead');
  await page.getByTestId('workflow-quick-save').click();
  await expect(page.getByText('Saved to your pipeline')).toBeVisible();
  await expect(page.getByTestId('workflow-quick-save')).toContainText(
    'In pipeline · Open',
  );
  await expect
    .poll(() => productEvents)
    .toEqual(
      expect.arrayContaining([
        {
          schema_version: 'citylens/parcel-product-event@v1',
          event: 'parcel_opened',
          source: 'ranking',
        },
        {
          schema_version: 'citylens/parcel-product-event@v1',
          event: 'workflow_created',
          source: 'header',
        },
      ]),
    );
  expect(JSON.stringify(productEvents)).not.toMatch(
    /3020960069|100 E 21|owner|notes|tags/i,
  );
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByTestId('mih-diligence')).toContainText(
    'Mandatory Inclusionary Housing screen',
  );
  await expect(page.getByTestId('mih-diligence')).toContainText(
    'Mapped overlap',
  );
  await expect(page.getByTestId('transit-diligence')).toContainText(
    'Church Av',
  );
  await expect(page.getByTestId('transit-diligence')).toContainText(
    '420 m',
  );
  await expect(page.getByTestId('transit-diligence')).toContainText(
    'not a walking route',
  );
  await page.getByRole('button', { name: 'Underwrite' }).click();
  await expect(page.getByTestId('mih-underwriting-warning')).toContainText(
    'MIH scenario required',
  );
  await page.getByRole('button', { name: 'Audit' }).click();
  await expect(page.getByTestId('parcel-decision-audit')).toContainText(
    'Eligible lead with diligence flags',
  );
  await expect(page.getByTestId('parcel-decision-audit')).toContainText(
    '34.0%',
  );
  await expect(page.getByTestId('parcel-decision-audit')).toContainText(
    '10.4%',
  );
  await expect(page.getByTestId('parcel-decision-audit')).toContainText(
    'not seller intent',
  );
  await expect(page.getByTestId('decision-audit-current_diligence')).toContainText(
    'Diligence only · no rank effect',
  );
  await expect(page.getByTestId('decision-audit-transit_access')).toContainText(
    'Diligence only · no rank effect',
  );
  await expect(page.getByTestId('parcel-decision-readiness')).toContainText(
    'Diligence review required before advancing',
  );
  await expect(page.getByTestId('parcel-decision-readiness')).toContainText(
    'Review floodplain exposure',
  );
  await expect(page.getByTestId('parcel-decision-readiness')).toContainText(
    'Verify MIH applicability',
  );
  await expect(page.getByTestId('parcel-decision-readiness')).toContainText(
    'not a purchase recommendation',
  );
  await page
    .getByRole('button', { name: 'Review workflow' })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Next action', exact: true }),
  ).toHaveValue(/Resolve the listed diligence items/);
  await page
    .getByRole('button', {
      name: 'Close parcel panel and return to ranked parcels',
    })
    .click();

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
    page.getByTestId('maturity-window-owner_contacted'),
  ).toContainText('95% interval 17–69%');
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
