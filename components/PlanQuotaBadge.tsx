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
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 border border-emerald-200"
      >
        Admin: unlimited
      </span>
    );
  }

  const used = me.quota.runs_used;
  const limit = me.quota.monthly_run_limit ?? 0;
  return (
    <span
      data-testid="plan-quota-badge"
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200"
    >
      {`${plan_type[0].toUpperCase()}${plan_type.slice(1)} plan: ${used}/${limit} runs this month`}
    </span>
  );
}
