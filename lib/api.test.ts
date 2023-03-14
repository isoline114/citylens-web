import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  advanceParcelWorkflow,
  ApiError,
  clearParcelWorkflowEvidenceReview,
  createApiKey,
  createRun,
  getDemoRun,
  getFeaturedDemos,
  getParcelIntelMap,
  getParcelIntelParcel,
  getParcelOfficialDossier,
  getParcelScreeningStatus,
  getParcelWorkflow,
  getParcelWorkflowActions,
  getParcelWorkflowAlerts,
  getRun,
  getRuns,
  joinApiUrl,
  listApiKeys,
  listParcelSavedSearches,
  recordParcelProductEvent,
  reviewParcelWorkflowEvidence,
  removeParcelSavedSearch,
  resolveParcelAddress,
  resolveApiUrl,
  revokeApiKey,
  saveParcelSearch,
  setAuthTokenGetter,
  snoozeParcelWorkflowReminder,
  submitPilotRequest,
  submitParcelWorkflowEvidenceIssue,
  withdrawParcelWorkflowEvidenceIssue,
} from '@/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setAuthTokenGetter(null);
});

describe('api client', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
  });

  it('normalizes string createRun responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'run-123',
        json: async () => null,
      } as Response),
    );

    const result = await createRun({
      address: '1 Main St',
      imagery_year: 2024,
      baseline_year: 2017,
      segmentation_backend: 'sam2',
      outputs: ['previews'],
    });

    expect(result.runId).toBe('run-123');
  });

  it('parses paginated runs responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          items: [{ run_id: 'run-1', status: 'succeeded' }],
          next_cursor: 'cursor-2',
        }),
        text: async () => '',
      } as Response),
    );

    const page = await getRuns({ limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.run_id).toBe('run-1');
    expect(page.nextCursor).toBe('cursor-2');
  });

  it('requests authenticated workflow alerts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        schema_version: 'citylens/parcel-workflow-alerts@v1',
        generated_at: '2026-07-24T01:00:00Z',
        feed_generated_at: '2026-07-24T00:00:00Z',
        watched_count: 1,
        changed_lead_count: 0,
        alert_count: 0,
        removed_from_feed_count: 0,
        severity_counts: { urgent: 0, high: 0, medium: 0, low: 0 },
        alerts: [],
        warnings: [],
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await getParcelWorkflowAlerts();

    expect(result.schema_version).toBe('citylens/parcel-workflow-alerts@v1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/workflow/alerts');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );

    fetchMock.mockClear();
    await recordParcelProductEvent('saved_view_applied', 'saved_views');

    const [applyUrl, applyInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(applyUrl).toContain('/v1/parcel-intel/product-events');
    expect(JSON.parse(String(applyInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'saved_view_applied',
      source: 'saved_views',
    });
    expect(String(applyInit.body)).not.toMatch(
      /search_id|view-brooklyn|query|filter|owner/i,
    );

    fetchMock.mockClear();
    await recordParcelProductEvent(
      'decision_audit_opened',
      'decision_posture',
    );
    const [, auditInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(auditInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'decision_audit_opened',
      source: 'decision_posture',
    });
    expect(String(auditInit.body)).not.toMatch(
      /bbl|address|owner|url|notes|tags|assignee/i,
    );

    fetchMock.mockClear();
    await recordParcelProductEvent(
      'screen_criterion_relaxed',
      'screen_audit',
    );
    const [, screenAuditInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(screenAuditInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'screen_criterion_relaxed',
      source: 'screen_audit',
    });
    expect(String(screenAuditInit.body)).not.toMatch(
      /bbl|address|owner|query|min_lot|unused|threshold|result_count|5000|10000/i,
    );

    fetchMock.mockClear();
    await recordParcelProductEvent(
      'saved_view_comparison_opened',
      'saved_views',
    );
    const [, savedScreenInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(savedScreenInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'saved_view_comparison_opened',
      source: 'saved_views',
    });
    expect(String(savedScreenInit.body)).not.toMatch(
      /search_id|view_name|bbl|address|owner|query|filter|count|overlap|union/i,
    );

    fetchMock.mockClear();
    await recordParcelProductEvent(
      'saved_thesis_changes_opened',
      'saved_views',
    );
    const [, thesisChangesInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(thesisChangesInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'saved_thesis_changes_opened',
      source: 'saved_views',
    });
    expect(String(thesisChangesInit.body)).not.toMatch(
      /search_id|view_name|bbl|address|owner|query|filter|count|generation|entered|exited|overlap|union/i,
    );
  });

  it('refreshes a rejected JWT once before returning the full parcel map', async () => {
    const getToken = vi
      .fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');
    setAuthTokenGetter(getToken);
    const observedAuthorization: Array<string | null> = [];
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        observedAuthorization.push(
          new Headers((init as RequestInit | undefined)?.headers).get(
            'Authorization',
          ),
        );
        return new Response(
          JSON.stringify({ detail: 'Invalid or expired token' }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        );
      })
      .mockImplementationOnce(async (_url, init) => {
        observedAuthorization.push(
          new Headers((init as RequestInit | undefined)?.headers).get(
            'Authorization',
          ),
        );
        return new Response(
          JSON.stringify({
            rows: [],
            generated_at: '2026-07-27T03:03:01Z',
            feed_generation: '20260727T030301000000Z-a32b245a82db',
            access_scope: 'authenticated_full',
            requested_top_per_borough: 1000,
            returned_count: 0,
            available_count: 0,
            inventory_complete: true,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getParcelIntelMap(1000, { includeAuth: true });

    expect(result.access_scope).toBe('authenticated_full');
    expect(getToken).toHaveBeenNthCalledWith(1, undefined);
    expect(getToken).toHaveBeenNthCalledWith(2, { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observedAuthorization).toEqual([
      'Bearer stale-token',
      'Bearer fresh-token',
    ]);
  });

  it('persists and deletes a citywide saved view with bearer auth', async () => {
    const savedView = {
      schema_version: 'citylens/parcel-saved-view@v2',
      search_id: 'view-one',
      name: 'Citywide leads',
      borough: 'all',
      filters: {
        query: '',
        priority: 'highest',
        opportunity: 'uncommitted',
        owner_portfolio_id: null,
        overlay: 'priority',
      },
      alert_frequency: 'off',
      created_at: '2026-07-24T12:00:00Z',
      updated_at: '2026-07-24T12:00:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [savedView],
        text: async () => '',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => savedView,
        text: async () => '',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => null,
        text: async () => '',
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    expect(await listParcelSavedSearches()).toHaveLength(1);
    await saveParcelSearch('view-one', {
      name: 'Citywide leads',
      borough: 'all',
      filters: {
        query: '',
        priority: 'highest',
        opportunity: 'uncommitted',
        owner_portfolio_id: null,
        overlay: 'priority',
      },
      alert_frequency: 'off',
      snapshot: {
        schema_version: 'citylens/parcel-saved-view-snapshot@v1',
        feed_generation: '20260727T030301358307Z-a32b245a82db',
        feed_generated_at: '2026-07-27T03:03:01.358307Z',
        match_count: 2,
        matched_bbls: ['1000010001', '3000010001'],
      },
    });
    await removeParcelSavedSearch('view-one');

    const [, putInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(putInit.method).toBe('PUT');
    expect(
      new Headers(putInit.headers).get('Authorization'),
    ).toBe('Bearer tok-abc');
    expect(JSON.parse(String(putInit.body))).toMatchObject({
      alert_frequency: 'off',
      snapshot: {
        schema_version: 'citylens/parcel-saved-view-snapshot@v1',
        feed_generation: '20260727T030301358307Z-a32b245a82db',
        match_count: 2,
        matched_bbls: ['1000010001', '3000010001'],
      },
    });
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [
      string,
      RequestInit,
    ];
    expect(deleteUrl).toContain('/saved-searches/view-one');
    expect(deleteInit.method).toBe('DELETE');
  });

  it('loads one authenticated workflow record without listing the pipeline', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => null,
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    expect(await getParcelWorkflow('3020960069')).toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/workflow/3020960069');
    expect(url).not.toContain('/events');
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
  });

  it('advances one compared parcel through the bounded workflow contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        status: 'created',
        item: {
          bbl: '3020960069',
          borough: 'brooklyn',
          stage: 'reviewing',
          next_action: 'Verify current title.',
        },
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await advanceParcelWorkflow('3020960069', {
      borough: 'brooklyn',
      next_action: 'Verify current title.',
      next_action_due_date: '2026-08-01',
    });

    expect(result.status).toBe('created');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      '/v1/parcel-intel/workflow/3020960069/advance',
    );
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(JSON.parse(String(init.body))).toEqual({
      borough: 'brooklyn',
      next_action: 'Verify current title.',
      next_action_due_date: '2026-08-01',
    });
    expect(String(init.body)).not.toMatch(
      /address|owner|notes|assignee|tags|score|price/i,
    );
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
  });

  it('writes and clears only a source-bound evidence review marker', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        bbl: '3020960069',
        evidence_reviews: {},
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await reviewParcelWorkflowEvidence('3020960069', 'property_facts', {
      expected_check_status: 'verified',
      expected_source: 'NYC PLUTO',
      expected_source_as_of: '2026-07-24',
      expected_feed_generated_at: '2026-07-24T02:43:29Z',
    });
    const [reviewUrl, reviewInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(reviewUrl).toContain(
      '/v1/parcel-intel/workflow/3020960069/evidence-reviews/property_facts',
    );
    expect(reviewInit.method).toBe('PUT');
    expect(reviewInit.cache).toBe('no-store');
    expect(JSON.parse(String(reviewInit.body))).toEqual({
      expected_check_status: 'verified',
      expected_source: 'NYC PLUTO',
      expected_source_as_of: '2026-07-24',
      expected_feed_generated_at: '2026-07-24T02:43:29Z',
    });
    expect(String(reviewInit.body)).not.toMatch(
      /bbl|address|owner|notes|assignee|tags|score|price/i,
    );

    await clearParcelWorkflowEvidenceReview('3020960069', 'property_facts');
    const [clearUrl, clearInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(clearUrl).toBe(reviewUrl);
    expect(clearInit.method).toBe('DELETE');
    expect(clearInit.cache).toBe('no-store');
  });

  it('submits and withdraws a source-bound evidence issue request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        bbl: '3020960069',
        evidence_issues: {},
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await submitParcelWorkflowEvidenceIssue(
      '3020960069',
      'property_facts',
      {
        issue_type: 'correction',
        reason_code: 'incorrect_value',
        note: 'The displayed lot area conflicts with a current signed survey.',
        expected_check_status: 'verified',
        expected_source: 'NYC PLUTO',
        expected_source_as_of: '2026-07-24',
        expected_feed_generated_at: '2026-07-24T02:43:29Z',
      },
    );
    const [submitUrl, submitInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(submitUrl).toContain(
      '/v1/parcel-intel/workflow/3020960069/evidence-issues/property_facts',
    );
    expect(submitInit.method).toBe('POST');
    expect(submitInit.cache).toBe('no-store');
    expect(JSON.parse(String(submitInit.body))).toEqual({
      issue_type: 'correction',
      reason_code: 'incorrect_value',
      note: 'The displayed lot area conflicts with a current signed survey.',
      expected_check_status: 'verified',
      expected_source: 'NYC PLUTO',
      expected_source_as_of: '2026-07-24',
      expected_feed_generated_at: '2026-07-24T02:43:29Z',
    });
    expect(String(submitInit.body)).not.toMatch(
      /bbl|address|owner|assignee|tags|score|price/i,
    );

    await withdrawParcelWorkflowEvidenceIssue(
      '3020960069',
      'property_facts',
    );
    const [withdrawUrl, withdrawInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(withdrawUrl).toBe(submitUrl);
    expect(withdrawInit.method).toBe('DELETE');
    expect(withdrawInit.cache).toBe('no-store');
  });

  it('records only the strict coarse product-event contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await recordParcelProductEvent('parcel_opened', 'ranking');
    await recordParcelProductEvent(
      'underwriting_assumptions_changed',
      'base_assumptions',
    );
    await recordParcelProductEvent(
      'official_dossier_opened',
      'official_dossier',
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/product-events');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(JSON.parse(String(init.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'parcel_opened',
      source: 'ranking',
    });
    expect(String(init.body)).not.toMatch(/bbl|address|owner|notes|tags/i);
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );

    const [, underwritingInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(underwritingInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'underwriting_assumptions_changed',
      source: 'base_assumptions',
    });
    expect(String(underwritingInit.body)).not.toMatch(
      /bbl|address|owner|notes|tags|value|cost|margin|efficiency/i,
    );

    const [, dossierInit] = fetchMock.mock.calls[2] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(dossierInit.body))).toEqual({
      schema_version: 'citylens/parcel-product-event@v1',
      event: 'official_dossier_opened',
      source: 'official_dossier',
    });
    expect(String(dossierInit.body)).not.toMatch(
      /bbl|address|owner|source_fact|readiness|lead|result/i,
    );
  });

  it('submits pilot intake without authentication or hidden metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        schema_version: 'citylens/pilot-request-receipt@v1',
        request_id: 'pr_0123456789abcdef0123456789abcdef',
        status: 'received',
        created_at: '2026-07-24T20:00:00Z',
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      schema_version: 'citylens/pilot-request@v1' as const,
      plan: 'acquisitions' as const,
      name: 'Jordan Lee',
      work_email: 'jordan@example.com',
      company: 'Example Development',
      role: 'Acquisitions director',
      team_size: '2-5' as const,
      target_boroughs: ['brooklyn', 'queens'] as const,
      workflow_summary:
        'We need a shared development-site review and outreach workflow.',
      consent: true as const,
      website: '',
    };
    const result = await submitPilotRequest(
      { ...payload, target_boroughs: [...payload.target_boroughs] },
      'pilot-browser-request-123456',
    );

    expect(result.status).toBe('received');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/pilot-requests');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    const headers = new Headers(init.headers);
    expect(headers.get('Idempotency-Key')).toBe(
      'pilot-browser-request-123456',
    );
    expect(headers.get('Authorization')).toBeNull();
    expect(JSON.parse(String(init.body))).toEqual(payload);
    expect(String(init.body)).not.toMatch(
      /client_ip|user_agent|referrer|page_url|utm_/i,
    );
  });

  it('requests the authenticated workflow action queue', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        schema_version: 'citylens/parcel-workflow-actions@v1',
        generated_at: '2026-07-24T14:00:00Z',
        total_records: 0,
        open_records: 0,
        completed_records: 0,
        overdue_count: 0,
        due_today_count: 0,
        due_soon_count: 0,
        scheduled_count: 0,
        unscheduled_count: 0,
        unassigned_count: 0,
        outcome_update_due_count: 0,
        attention_count: 0,
        snoozed_count: 0,
        complete_plan_count: 0,
        plan_coverage_rate: null,
        assigned_count: 0,
        assignee_coverage_rate: null,
        outcome_current_count: 0,
        outcome_current_rate: null,
        items: [],
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await getParcelWorkflowActions();

    expect(result.schema_version).toBe('citylens/parcel-workflow-actions@v1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/workflow/actions');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
  });

  it('snoozes a workflow reminder through the authenticated API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        bbl: '3020960069',
        reminder_snoozed_until: '2026-07-25T14:00:00Z',
        is_snoozed: true,
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await snoozeParcelWorkflowReminder('3020960069', 1);

    expect(result.is_snoozed).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/workflow/3020960069/reminder');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ days: 1 }));
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
  });

  it('rebases API-relative URLs against NEXT_PUBLIC_CITYLENS_API_BASE', () => {
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.citylens.dev';

    expect(resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toBe(
      'https://api.citylens.dev/v1/demo/artifacts/demo-1/preview.png',
    );
    expect(resolveApiUrl('https://example.test/preview.png')).toBe('https://example.test/preview.png');
  });

  it('preserves API path prefixes when joining relative API URLs', () => {
    expect(joinApiUrl('https://api.citylens.dev/platform', '/v1/demo/artifacts/demo-1/preview.png')).toBe(
      'https://api.citylens.dev/platform/v1/demo/artifacts/demo-1/preview.png',
    );
  });

  it('uses same-origin relative URLs in production even when NEXT_PUBLIC_CITYLENS_API_BASE is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.NEXT_PUBLIC_CITYLENS_API_BASE = 'https://api.citylens.dev';

    expect(resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toBe(
      '/v1/demo/artifacts/demo-1/preview.png',
    );
  });

  it('uses same-origin relative URLs in production when NEXT_PUBLIC_CITYLENS_API_BASE is not set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.NEXT_PUBLIC_CITYLENS_API_BASE;

    expect(resolveApiUrl('/v1/demo/artifacts/demo-1/preview.png')).toBe(
      '/v1/demo/artifacts/demo-1/preview.png',
    );
  });

  it('joinApiUrl handles empty base for same-origin', () => {
    expect(joinApiUrl('', '/v1/demo/featured')).toBe('/v1/demo/featured');
    expect(joinApiUrl('', 'v1/health')).toBe('/v1/health');
    expect(joinApiUrl('', '')).toBe('/');
  });
});

describe('parseFeaturedDemosResponse', () => {
  it('passes through a top-level array', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    const out = parseFeaturedDemosResponse([{ run_id: 'a' }]);
    expect(out).toEqual([{ run_id: 'a' }]);
  });

  it('unwraps {featured: []} and {runs: []} variants', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    expect(parseFeaturedDemosResponse({ featured: [{ run_id: 'a' }] })).toEqual([{ run_id: 'a' }]);
    expect(parseFeaturedDemosResponse({ runs: [{ run_id: 'b' }] })).toEqual([{ run_id: 'b' }]);
  });

  it('flattens category-keyed objects and dedupes by id', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    const raw = {
      Featured: [{ run_id: 'a', label: 'A' }, { run_id: 'b', label: 'B' }],
      'Change Detection': [{ run_id: 'a', label: 'A-dup' }, { run_id: 'c', label: 'C' }],
    };
    const out = parseFeaturedDemosResponse(raw);
    expect(out.map((d) => d.run_id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] for unrecognized shapes (and never throws)', async () => {
    const { parseFeaturedDemosResponse } = await import('@/lib/api');
    expect(parseFeaturedDemosResponse(null)).toEqual([]);
    expect(parseFeaturedDemosResponse(undefined)).toEqual([]);
    expect(parseFeaturedDemosResponse(42)).toEqual([]);
    expect(parseFeaturedDemosResponse('hello')).toEqual([]);
    expect(parseFeaturedDemosResponse({})).toEqual([]);
  });
});

describe('demo fetches do not send Authorization', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
  });

  function stubFetch(body: unknown) {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);
    return mockFetch;
  }

  it('getFeaturedDemos does not include Authorization header', async () => {
    const mockFetch = stubFetch({
      Featured: [{ run_id: 'demo-1', label: 'Test', address: 'Addr', imagery_year: 2024, baseline_year: 2017, segmentation_backend: 'sam2', outputs: [] }],
    });

    const demos = await getFeaturedDemos();
    expect(demos).toHaveLength(1);
    expect(demos[0]?.run_id).toBe('demo-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('getDemoRun does not include Authorization header', async () => {
    const mockFetch = stubFetch({ run_id: 'demo-1', status: 'succeeded' });

    const run = await getDemoRun('demo-1');
    expect(run.run_id).toBe('demo-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
  });
});

describe('non-demo fetches attach Bearer token', () => {
  it('getRun includes Authorization: Bearer header', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ run_id: 'run-1', status: 'succeeded' }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await getRun('run-1');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-abc');
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('throws ApiError(401) when no token is available', async () => {
    setAuthTokenGetter(async () => null);
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(getRun('run-1')).rejects.toMatchObject({ status: 401 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('parcel intelligence progressive reads', () => {
  function stubFetch(body: unknown) {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);
    return mockFetch;
  }

  it('loads the public compact citywide map without authentication', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = stubFetch({ rows: [], generated_at: null });

    await getParcelIntelMap(250, { includeAuth: false });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/map?top_per_borough=250');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(init.cache).toBeUndefined();
  });

  it('bypasses the public HTTP cache for the authenticated citywide map', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = stubFetch({
      rows: [],
      generated_at: null,
      feed_generation: '20260727T030301358307Z-a32b245a82db',
      access_scope: 'authenticated_full',
      requested_top_per_borough: 1000,
      returned_count: 0,
      available_count: 0,
      inventory_complete: true,
    });

    const result = await getParcelIntelMap(1000, { includeAuth: true });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
    expect(init.cache).toBe('no-store');
    expect(result.feed_generation).toBe(
      '20260727T030301358307Z-a32b245a82db',
    );
  });

  it('loads full selected-parcel detail with the user token', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = stubFetch({ bbl: '3000010001' });

    await getParcelIntelParcel('3000010001', { includeAuth: true });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/parcel/3000010001');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-abc');
  });

  it('loads an exact screening receipt privately with the user token', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = stubFetch({
      schema_version: 'citylens/parcel-screening-status@v1',
      bbl: '3058920038',
      result: 'screened_out',
    });

    await getParcelScreeningStatus('3058920038');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/screening/3058920038');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
    expect(init.cache).toBe('no-store');
  });

  it('loads one official parcel dossier privately with the user token', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = stubFetch({
      schema_version: 'citylens/parcel-official-dossier@v1',
      bbl: '3058920038',
      address: '464 OVINGTON AVENUE',
    });

    await getParcelOfficialDossier('3058920038');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/official-parcel/3058920038');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
    expect(init.cache).toBe('no-store');
  });

  it('posts an address privately without placing it in the request URL', async () => {
    setAuthTokenGetter(async () => 'tok-abc');
    const mockFetch = stubFetch({
      schema_version: 'citylens/parcel-address-resolve-response@v1',
      match_status: 'unique',
      candidates: [{ bbl: '3058920038', borough: 'brooklyn' }],
    });

    await resolveParcelAddress(
      '464 Ovington Ave, Brooklyn, NY 11209',
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/parcel-intel/resolve-address');
    expect(url).not.toContain('Ovington');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer tok-abc',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      schema_version: 'citylens/parcel-address-resolve-request@v1',
      address: '464 Ovington Ave, Brooklyn, NY 11209',
    });
  });
});

describe('error handling', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
  });

  it('throws ApiError with status on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Run not found' }),
        text: async () => '',
      } as Response),
    );

    await expect(getFeaturedDemos()).rejects.toThrow(ApiError);
    try {
      await getFeaturedDemos();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
    }
  });

  it('throws ApiError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(getDemoRun('demo-1')).rejects.toThrow(ApiError);
    try {
      await getDemoRun('demo-1');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toContain('Network error');
    }
  });
});

describe('user api keys helpers', () => {
  beforeEach(() => {
    setAuthTokenGetter(async () => 'tok-abc');
  });

  it('createApiKey POSTs the label and returns the plaintext + record', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        key_id: 'k1',
        label: 'cli',
        key_prefix: 'clk_live_abcd',
        plaintext_key: 'clk_live_abcdSECRET',
        created_at: '2026-04-30T12:00:00Z',
        last_used_at: null,
        revoked_at: null,
      }),
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const created = await createApiKey('cli');
    expect(created.plaintext_key).toBe('clk_live_abcdSECRET');
    expect(created.key_id).toBe('k1');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/api-keys$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ label: 'cli' });
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-abc');
  });

  it('listApiKeys returns the items array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          items: [
            {
              key_id: 'k1',
              label: 'cli',
              key_prefix: 'clk_live_abcd',
              created_at: '2026-04-30T12:00:00Z',
              last_used_at: null,
              revoked_at: null,
            },
          ],
        }),
        text: async () => '',
      } as Response),
    );

    const items = await listApiKeys();
    expect(items).toHaveLength(1);
    expect(items[0]?.key_id).toBe('k1');
  });

  it('listApiKeys returns [] when the response shape is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ unexpected: 'shape' }),
        text: async () => '',
      } as Response),
    );

    expect(await listApiKeys()).toEqual([]);
  });

  it('revokeApiKey sends DELETE with Bearer auth', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: async () => null,
      text: async () => '',
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await revokeApiKey('k1');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/api-keys\/k1$/);
    expect(init.method).toBe('DELETE');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-abc');
  });
});
