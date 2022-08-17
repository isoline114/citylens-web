'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { getRecentRuns, type RecentRun } from '@/lib/storage';

export default function RunsPage() {
  const [runs, setRuns] = useState<RecentRun[]>([]);

  useEffect(() => {
    setRuns(getRecentRuns());
  }, []);

  const rows = useMemo(() => runs, [runs]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      <p className="text-sm text-slate-600">
        Recent runs are stored locally in this browser (no server-side list endpoint yet).
      </p>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">Recent run IDs</div>
        <div className="p-4">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-600">No runs yet. Create one from Home.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.runId} className="flex items-center justify-between py-3">
                  <Link href={`/runs/${encodeURIComponent(r.runId)}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {r.runId}
                  </Link>
                  <div className="text-xs text-slate-600">
                    {r.lastKnownStatus ? `status: ${r.lastKnownStatus}` : 'status: (unknown)'}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 text-xs text-slate-500">
            TODO: If the backend adds a list endpoint, replace this local history.
          </div>
        </div>
      </div>
    </div>
  );
}
