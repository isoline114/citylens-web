'use client';

import { useEffect, useState } from 'react';

import { ApiError, getMe, type MeResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function PlanQuotaBadge() {
  const auth = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (auth.status !== 'authenticated') {
      setMe(null);
      setError(null);
      return;
    }

    setError(null);
    getMe()
      .then((next) => {
        if (alive) setMe(next);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 401) {
          setError(null);
          setMe(null);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load plan info');
      });
    return () => {
      alive = false;
    };
  }, [auth.status, auth.user?.id]);

  if (auth.status !== 'authenticated' || !me) return null;
  if (error) return null;

  const { plan_type, is_admin } = me.user;
  if (is_admin || me.quota.unlimited) {
    return (
      <span
        data-testid="plan-quota-badge"
        className="hidden h-9 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 sm:inline-flex"
      >
        Admin: unlimited
      </span>
    );
  }

  const used = me.quota.runs_used;
  const limit = me.quota.monthly_run_limit ?? 0;
  const text = `${plan_type[0].toUpperCase()}${plan_type.slice(1)} plan: ${used}/${limit} runs this month`;
  const pct = limit > 0 ? Math.min(100, Math.max(0, Math.round((used / limit) * 100))) : 0;
  // Bar color shifts as the user gets closer to the cap so the chip
  // tells you both "what plan" and "how close to running out" at a glance.
  const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-sky-500';
  return (
    <span
      data-testid="plan-quota-badge"
      title={text}
      className="hidden h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-2 text-xs font-medium text-slate-800 sm:inline-flex"
    >
      <span className="hidden xl:inline">{text}</span>
      <span className="xl:hidden">{`${used}/${limit} runs`}</span>
      <span
        aria-hidden="true"
        className="relative h-1.5 w-12 overflow-hidden rounded-full bg-slate-200"
      >
        <span
          className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
