'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Signing out…</h1>
      <p className="text-slate-700 text-sm">You will be redirected shortly.</p>
    </div>
  );
}
