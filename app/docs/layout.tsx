import type { ReactNode } from 'react';

// Override the root layout's `max-w-4xl` with a wider container so the
// sidebar + content grid in the docs page has room to breathe. The root
// <main> already wraps children in a content column; we use negative
// margins to break out of it and re-apply our own width.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -my-6">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
