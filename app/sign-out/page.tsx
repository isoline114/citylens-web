'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { useAuth } from '@/lib/auth';

export default function SignOutPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.signOut();
      if (!cancelled) router.push('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, router]);

  return (
    <AuthPageShell
      eyebrow="Account"
      title="Signing out…"
      description="Closing this CityLens session and returning you home."
    >
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-500" />
      </div>
    </AuthPageShell>
  );
}
