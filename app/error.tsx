'use client';

import { useEffect } from 'react';

import { reportError } from '@/lib/error-reporting';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'app/error', digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-4xl flex-col justify-center px-4 py-8">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <div className="text-lg font-semibold">Something went wrong</div>
        {/* Friendly copy only — never raw error.message, which can leak
            internals (URLs, tokens, stack fragments) to end users. */}
        <p className="mt-2 text-sm">
          An unexpected error interrupted this page. It wasn&apos;t anything you
          did — try again, and if it keeps happening please let us know.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-rose-700">
            Reference code: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <button
          type="button"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
