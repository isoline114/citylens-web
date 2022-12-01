'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-4xl flex-col justify-center px-4 py-8">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <div className="text-lg font-semibold">Something went wrong</div>
        <div className="mt-2 whitespace-pre-wrap text-sm">{error.message}</div>
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
