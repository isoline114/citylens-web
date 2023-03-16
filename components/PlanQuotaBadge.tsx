'use client';

import { TriangleAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getMe, type MeResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function PlanQuotaBadge() {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [credentialRejected, setCredentialRejected] = useState(false);

  useEffect(() => {
    let alive = true;
    if (auth.status !== 'authenticated') {
      setMe(null);
      setCredentialRejected(false);
      return;
    }

    setCredentialRejected(false);
    getMe()
      .then((next) => {
        if (!alive) return;
        setMe(next);
        setCredentialRejected(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 401) {
          setMe(null);
          setCredentialRejected(true);
          return;
        }
        // A quota-service or network error is not proof that the browser
        // credential is invalid. Keep that failure quiet and let the
        // authenticated product surfaces own their retry states.
        setMe(null);
      });
    return () => {
      alive = false;
    };
  }, [auth.status, auth.user?.id]);

  if (auth.status !== 'authenticated') return null;

  if (credentialRejected) {
    return (
      <button
        type="button"
        data-testid="account-data-reconnect"
        onClick={async () => {
          await auth.signOut();
          const next =
            pathname && pathname.startsWith('/') ? pathname : '/parcel-intel';
          router.push(`/sign-in?next=${encodeURIComponent(next)}`);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
        title="Your account is visible, but its API credential expired. Sign in again to restore full data access."
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Reconnect data</span>
        <span className="sm:hidden">Reconnect</span>
      </button>
    );
  }

  if (!me) return null;

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
