'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getMe, type MeResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CITYLENS_DATA_ACCESS_READY_EVENT } from '@/lib/auth/dataAccessEvents';

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
        // This request proves that the browser's CityLens API credential is
        // usable. Wake any product surface that exhausted an earlier token
        // refresh while Neon was still restoring the browser session.
        window.dispatchEvent(
          new Event(CITYLENS_DATA_ACCESS_READY_EVENT),
        );
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
        className="btn border-stale text-stale"
        title="Your account is visible, but its API credential expired. Sign in again to restore full data access."
      >
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
        className="hidden text-xs text-ink-2 sm:inline"
      >
        Admin: unlimited
      </span>
    );
  }

  const used = me.quota.runs_used;
  const limit = me.quota.monthly_run_limit ?? 0;
  const text = `${plan_type[0].toUpperCase()}${plan_type.slice(1)} plan: ${used}/${limit} runs this month`;
  const atLimit = limit > 0 && used >= limit;
  const nearLimit = limit > 0 && used / limit >= 0.8;
  const stateWord = atLimit ? ' Limit reached.' : nearLimit ? ' Near limit.' : '';
  return (
    <span
      data-testid="plan-quota-badge"
      title={text}
      className="hidden text-xs text-ink-2 sm:inline"
    >
      <span className="hidden xl:inline">
        {`${plan_type[0].toUpperCase()}${plan_type.slice(1)} plan: `}
      </span>
      <span className="ws-tabular tabular-nums text-ink">{`${used}/${limit}`}</span>
      {' runs'}
      <span className="hidden xl:inline">{' this month'}</span>
      {stateWord ? (
        <span className="font-semibold text-stale">{stateWord}</span>
      ) : null}
    </span>
  );
}
