import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getFeaturedDemos: vi.fn() }));
vi.mock('@/lib/api', async () => ({ ...await vi.importActual('@/lib/api'), getFeaturedDemos: mocks.getFeaturedDemos }));
import { HomeEvidence } from './Evidence';
beforeEach(() => mocks.getFeaturedDemos.mockReset());
afterEach(() => vi.unstubAllGlobals());
describe('homepage public evidence fallback', () => {
  it('loads the live browser catalog and summary when SSR demos are disabled', async () => {
    mocks.getFeaturedDemos.mockResolvedValue([{ run_id: 'browser-demo', label: 'Browser evidence', outputs: ['previews'], baseline_year: 2017, imagery_year: 2024 }]);
    const fetchSummary = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ qa: { change_counts: { modified: 42 } } }) });
    vi.stubGlobal('fetch', fetchSummary);
    render(<HomeEvidence initialDemos={[]} initialSummary={null} />);
    expect(await screen.findByRole('link', { name: 'Inspect site evidence: Browser evidence' })).toHaveAttribute('href', '/runs/browser-demo?demo=1');
    expect(await screen.findByText('42')).toBeVisible();
    expect(fetchSummary.mock.calls[0][0]).toBe('/v1/demo/artifacts/browser-demo/run_summary.json');
  });
  it('keeps missing class counts unknown when the public summary fails', async () => {
    mocks.getFeaturedDemos.mockResolvedValue([{ run_id: 'browser-demo', label: 'Browser evidence', outputs: ['previews'] }]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<HomeEvidence initialDemos={[]} initialSummary={null} />);
    expect(await screen.findByRole('list', { name: 'Model-detected change classes' })).toHaveTextContent('addeddemolishedmodifiedunchanged');
    expect(screen.queryByText('2017 → 2024')).not.toBeInTheDocument();
  });
});
