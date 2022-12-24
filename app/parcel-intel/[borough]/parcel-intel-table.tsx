'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Download } from 'lucide-react';
import type { ParcelIntelRow } from '@/lib/api';

type SortKey =
  | 'score_calibrated'
  | 'lot_area_sqft'
  | 'last_sale_price'
  | 'years_held';

type Direction = 'asc' | 'desc';

type Props = {
  rows: ParcelIntelRow[];
  borough: string;
};

const SORT_LABELS: Record<SortKey, string> = {
  score_calibrated: 'Score',
  lot_area_sqft: 'Lot area',
  last_sale_price: 'Last sale',
  years_held: 'Years held',
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatScore(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function downloadCSV(rows: ParcelIntelRow[], borough: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]) as (keyof ParcelIntelRow)[];
  const csv = [headers.join(',')]
    .concat(
      rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h];
            if (v === null || v === undefined) return '';
            if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
              return `"${v.replace(/"/g, '""')}"`;
            }
            return String(v);
          })
          .join(','),
      ),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `parcel-intel-${borough}-top${rows.length}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ParcelIntelTable({ rows, borough }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score_calibrated');
  const [direction, setDirection] = useState<Direction>('desc');
  const [hideLandmarked, setHideLandmarked] = useState(false);

  const filtered = useMemo(() => {
    return hideLandmarked
      ? rows.filter((r) => !r.is_landmark && !r.is_historic_district)
      : rows;
  }, [rows, hideLandmarked]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // null/undefined sort to bottom regardless of direction.
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return direction === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return out;
  }, [filtered, sortKey, direction]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k)
      return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return direction === 'desc' ? (
      <ChevronDown className="h-3 w-3 text-slate-700" />
    ) : (
      <ChevronUp className="h-3 w-3 text-slate-700" />
    );
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={hideLandmarked}
            onChange={(e) => setHideLandmarked(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-700"
          />
          Hide landmarked / historic-district parcels
        </label>
        <button
          type="button"
          onClick={() => downloadCSV(sorted, borough)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Download CSV ({sorted.length})
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">BBL</th>
                {(
                  [
                    'score_calibrated',
                    'lot_area_sqft',
                    'last_sale_price',
                    'years_held',
                  ] as SortKey[]
                ).map((k) => (
                  <th key={k} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort(k)}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900"
                    >
                      {SORT_LABELS[k]}
                      <SortIcon k={k} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3">Zoning</th>
                <th className="px-4 py-3">Year built</th>
                <th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r, i) => (
                <tr
                  key={r.bbl}
                  id={`bbl-${r.bbl}`}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.address || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {r.bbl}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatScore(r.score_calibrated)}
                  </td>
                  <td className="px-4 py-3">
                    {formatNumber(r.lot_area_sqft)} sqft
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(r.last_sale_price)}
                    {r.last_sale_year && (
                      <span className="ml-1 text-xs text-slate-500">
                        ({r.last_sale_year})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.years_held ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {r.zoning_district_1 || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.year_built && r.year_built > 0 ? r.year_built : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.is_landmark && (
                      <span className="mr-1 inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                        landmark
                      </span>
                    )}
                    {r.is_historic_district && (
                      <span className="mr-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        historic dist
                      </span>
                    )}
                    {(r.block_rank ?? 0) > 1 && r.block_id && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                        {r.block_rank} of N in {r.block_id}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
