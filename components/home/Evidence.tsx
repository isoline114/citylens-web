'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { FeaturedDemoCards, demoId, demoTitle, previewDemo } from '@/components/FeaturedDemoCards';
import { SiteEvidencePreviewImage } from '@/components/SiteEvidencePreviewImage';
import { getFeaturedDemos, type DemoFeaturedRun } from '@/lib/api';
import { formatAddress } from '@/lib/parcel-format';
import { publicAssetPath } from '@/lib/site';
import { finite, record } from './data';

const classes = [
  ['added', 'bg-change-added'], ['demolished', 'bg-change-demolished'],
  ['modified', 'bg-change-modified'], ['unchanged', 'bg-change-unchanged'],
] as const;
export function HomeEvidence({ initialDemos, initialSummary, children }: { children?: ReactNode; initialDemos: DemoFeaturedRun[]; initialSummary: Record<string, unknown> | null }) {
  const [demos, setDemos] = useState(initialDemos);
  const [summary, setSummary] = useState(initialSummary);
  const demo = previewDemo(demos);
  const id = demo ? demoId(demo) : null;
  const initialId = previewDemo(initialDemos) ? demoId(previewDemo(initialDemos)!) : null;
  useEffect(() => {
    if (initialDemos.length) return;
    let cancelled = false;
    getFeaturedDemos().then(rows => { if (!cancelled) setDemos(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [initialDemos]);
  useEffect(() => {
    if (!id || id === initialId) return;
    let cancelled = false;
    fetch(publicAssetPath(`/v1/demo/artifacts/${encodeURIComponent(id)}/run_summary.json`), { signal: AbortSignal.timeout(2_000) })
      .then(res => res.ok ? res.json() : null).then(value => { if (!cancelled) setSummary(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, initialId]);
  const counts = record(record(summary?.qa).change_counts);
  const yearsKnown = typeof demo?.baseline_year === 'number' && typeof demo?.imagery_year === 'number';
  return <>
    <section aria-labelledby="site-evidence-heading" className="grid min-w-0 items-start gap-7 border-t border-rule py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
      <div>
        <h2 id="site-evidence-heading" className="text-3xl font-bold leading-tight tracking-tight">See what changed on the block.</h2>
        <p className="mt-3 max-w-[46ch] text-sm leading-6 text-ink-2">An evidence run compares the city&apos;s {yearsKnown ? demo.baseline_year : 'baseline'} building footprints with the {yearsKnown ? demo.imagery_year : 'dated'} aerial survey. The model classifies footprints as added, demolished, modified or unchanged and draws the result on the image. These are model-detected changes, so check the model output against the photo.</p>
        {demo && <>
          <p className="mt-3 text-sm leading-6 text-ink-2">{demoTitle(demo)}{demo.address ? `, ${formatAddress(demo.address)}` : ''}. The preview includes the change overlay.</p>
          <h3 className="mt-4 font-cond text-sm font-semibold">Model-detected changes</h3>
          <ul aria-label="Model-detected change classes" className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">{classes.map(([label, color]) => <li key={label} className="flex items-center gap-2"><span aria-hidden="true" className={`h-2.5 w-2.5 ${color}`} /><span className="capitalize">{label}</span>{finite(counts[label]) && <span className="ws-tabular font-mono">{counts[label].toLocaleString('en-US')}</span>}</li>)}</ul>
          <Link href={`/runs/${encodeURIComponent(id!)}?demo=1`} aria-label={`Inspect site evidence: ${demoTitle(demo)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">Open this run</Link>
        </>}
        {!demo && <Link href="/runs#public-evidence" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">Open the public evidence library</Link>}
      </div>
      <div data-testid="home-evidence-preview" className="min-w-0">
        {demo && id ? <figure><div className="relative mx-auto aspect-square max-h-[560px] bg-white"><SiteEvidencePreviewImage key={id} src={publicAssetPath(`/v1/demo/artifacts/${encodeURIComponent(id)}/preview.png`)} alt={`Aerial change evidence for ${demoTitle(demo)}`} /></div><figcaption className="mt-2 font-mono text-xs text-ink-3">{yearsKnown ? `${demo.baseline_year} footprints → ${demo.imagery_year} imagery` : 'Imagery dates unavailable'} · CityLens model output</figcaption></figure>
          : <p className="border-y border-rule py-6 text-sm leading-6 text-ink-3">A featured change preview is temporarily unavailable. The public evidence library can be checked again.</p>}
      </div>
    </section>
    {children}
    <FeaturedDemoCards demos={demos} sectionId="public-evidence" limit={demos.length} />
  </>;
}
