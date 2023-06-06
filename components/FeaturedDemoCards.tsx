import Link from 'next/link';
import type { DemoFeaturedRun } from '@/lib/api';
import { formatAddress } from '@/lib/parcel-format';

type Props = {
  demos: DemoFeaturedRun[]; sectionId?: string; eyebrow?: string; title?: string;
  description?: string; limit?: number; variant?: 'cards' | 'survey';
};
export function demoId(demo: DemoFeaturedRun): string | null {
  return [demo.run_id, demo.id].find((id): id is string => typeof id === 'string' && !!id.trim()) ?? null;
}
export function previewDemo(demos: DemoFeaturedRun[]) {
  return demos.find(demo => demoId(demo) && (!Array.isArray(demo.outputs) || demo.outputs.includes('previews')));
}
export function demoTitle(demo: DemoFeaturedRun): string {
  return demo.title?.trim() || demo.label?.trim() || formatAddress(demo.address) || 'Public site evidence';
}
export function FeaturedDemoCards({ demos, sectionId, title = 'Public evidence library', description = 'Precomputed runs you can open without an account: imagery, change geometry, the 3D view and the QA receipt.', limit = 6 }: Props) {
  const available = demos.filter(demo => demoId(demo)).slice(0, limit);
  return (
    <section id={sectionId} data-testid={sectionId === 'public-evidence' ? 'public-evidence-library' : undefined} className="grid min-w-0 gap-7 border-t border-rule py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
      <div>
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink">{title}</h2>
        <p className="mt-3 max-w-[46ch] text-sm leading-6 text-ink-2">{description}</p>
      </div>
      {available.length ? (
        <div className="min-w-0 overflow-x-auto" data-testid="featured-demo-strip">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Public evidence runs</caption>
            <thead className="border-b border-ink font-cond text-ink-3"><tr>
              <th scope="col" className="pb-2 pr-4 font-semibold">Site</th><th scope="col" className="pb-2 pr-4 font-semibold">Address</th><th scope="col" className="pb-2 text-right font-semibold">Footprints → imagery</th>
            </tr></thead>
            <tbody>{available.map(demo => <tr key={demoId(demo)} className="border-b border-rule align-top">
              <td className="py-3 pr-4"><Link data-testid="featured-demo-card" href={`/runs/${encodeURIComponent(demoId(demo)!)}?demo=1`} className="font-medium text-ink underline underline-offset-4">{demoTitle(demo)}</Link></td>
              <td className="py-3 pr-4 text-ink-2">{formatAddress(demo.address) || 'Address unavailable'}</td>
              <td className="ws-tabular py-3 text-right font-mono text-xs text-ink-2">{typeof demo.baseline_year === 'number' && typeof demo.imagery_year === 'number' ? `${demo.baseline_year} → ${demo.imagery_year}` : 'Dates unavailable'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : <p className="text-sm leading-6 text-ink-3">Featured demos are temporarily unavailable. Visit the <Link href="/runs#public-evidence" className="text-ink underline underline-offset-4">public evidence library</Link> to try again.</p>}
    </section>
  );
}
