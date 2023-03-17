import Link from 'next/link';
import { ArrowRight, ImageIcon, Layers, MapPin } from 'lucide-react';

import type { DemoFeaturedRun } from '@/lib/api';

type Props = {
  /** Pre-fetched demos. Server components should pass the result of
   *  fetchFeaturedDemosOnServer() so the SSR HTML already includes them. */
  demos: DemoFeaturedRun[];
};

export function FeaturedDemoCards({ demos }: Props) {
  if (!demos || demos.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Featured demos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Featured demos are temporarily unavailable. You can still{' '}
          <Link href="/sign-in" className="font-medium text-slate-900 underline">
            sign in
          </Link>{' '}
          to create a run.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Featured demos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Real precomputed CityLens runs. No sign-in required.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500 md:hidden">
        Swipe through real NYC examples.
      </p>
      <div
        className="mt-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto pb-2 md:mt-6 md:grid-flow-row md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-3"
        data-testid="featured-demo-strip"
      >
        {demos.slice(0, 6).map((demo, index) => {
          const id = demoId(demo);
          if (!id) return null;
          return <DemoCard key={id} demo={demo} runId={id} index={index} />;
        })}
      </div>
    </section>
  );
}

// Cycled through the demo grid so the section reads as a kit alongside
// the home-page feature cards (which use the same sky/amber/emerald
// palette).
const DEMO_ACCENTS = ['bg-sky-500', 'bg-amber-500', 'bg-emerald-500'] as const;

function DemoCard({
  demo,
  runId,
  index,
}: {
  demo: DemoFeaturedRun;
  runId: string;
  index: number;
}) {
  const title = demoTitle(demo, runId);
  const address = typeof demo.address === 'string' ? demo.address : null;
  const imageryYear = typeof demo.imagery_year === 'number' ? demo.imagery_year : undefined;
  const baselineYear = typeof demo.baseline_year === 'number' ? demo.baseline_year : undefined;
  const outputs = Array.isArray(demo.outputs)
    ? demo.outputs.filter((o): o is string => typeof o === 'string')
    : [];
  const accent = DEMO_ACCENTS[index % DEMO_ACCENTS.length];

  return (
    <Link
      href={`/runs/${encodeURIComponent(runId)}?demo=1`}
      className="group relative flex snap-start flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 pl-5 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
      data-testid="featured-demo-card"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
      </div>

      {address && (
        <div className="flex items-start gap-2 text-xs text-slate-700">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{address}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {imageryYear !== undefined && baselineYear !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
            <Layers className="h-3 w-3" />
            {baselineYear} → {imageryYear}
          </span>
        )}
        {outputs.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
            <ImageIcon className="h-3 w-3" />
            {outputs.join(' · ')}
          </span>
        )}
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-slate-900">
        View demo
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function demoId(d: DemoFeaturedRun): string | null {
  const v = (typeof d.run_id === 'string' && d.run_id) || (typeof d.id === 'string' ? d.id : null);
  return v && v.trim().length > 0 ? v : null;
}

function demoTitle(d: DemoFeaturedRun, fallback: string): string {
  const candidates = [d.title, d.label, d.address];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return fallback;
}
