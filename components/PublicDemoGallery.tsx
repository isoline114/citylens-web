'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { FeaturedDemoCards } from '@/components/FeaturedDemoCards';
import { getFeaturedDemos, type DemoFeaturedRun } from '@/lib/api';

type GalleryState =
  { status: 'loading'; demos: DemoFeaturedRun[] } | { status: 'ready'; demos: DemoFeaturedRun[] } | { status: 'error'; demos: DemoFeaturedRun[] };

export function PublicDemoGallery() {
  const [state, setState] = useState<GalleryState>({
    status: 'loading',
    demos: [],
  });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading', demos: [] });
      try {
        const demos = await getFeaturedDemos();
        if (!cancelled) setState({ status: 'ready', demos });
      } catch {
        if (!cancelled) setState({ status: 'error', demos: [] });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  if (state.status === 'ready') {
    return (
      <FeaturedDemoCards
        demos={state.demos}
        sectionId="public-evidence"
        eyebrow="Public evidence library"
        title="Inspect a complete evidence package."
        description="Real NYC runs with imagery, change geometry, 3D massing, and a QA receipt. No sign-in required."
      />
    );
  }

  return (
    <section
      id="public-evidence"
      data-testid="public-evidence-library"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-busy={state.status === 'loading'}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Public evidence library</div>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Inspect a complete evidence package.</h2>
      {state.status === 'loading' ? (
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600" role="status">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading real NYC runs
        </div>
      ) : (
        <div className="mt-5 flex min-h-32 flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-5 text-center">
          <p className="text-sm font-semibold text-amber-950">Public evidence is temporarily unavailable.</p>
          <p className="mt-1 text-xs text-amber-800">Private processing is unaffected.</p>
          <button
            type="button"
            onClick={() => setRequestKey((value) => value + 1)}
            className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
