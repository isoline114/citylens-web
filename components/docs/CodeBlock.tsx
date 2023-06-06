import type { ReactNode } from 'react';

import { CopyButton } from '@/components/docs/CopyButton';

type CodeBlockProps = {
  language?: string;
  label?: string;
  children: string;
};

export function CodeBlock({ language = 'bash', label, children }: CodeBlockProps) {
  return (
    <div className="max-w-full overflow-hidden rounded-sm border border-ink bg-ink">
      {(label || language) && (
        <div className="font-cond flex min-w-0 items-center justify-between gap-3 border-b border-ink bg-ink/70 px-3 py-2 text-[13px] font-medium text-rule">
          <span className="min-w-0 truncate">{label ?? language}</span>
          <CopyButton value={children} />
        </div>
      )}
      <pre className="max-w-full overflow-x-auto overscroll-x-contain px-4 py-4 text-[12px] leading-6 text-white sm:text-[13px]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

type EndpointProps = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  auth: 'public' | 'bearer' | 'admin';
  title: string;
  description: ReactNode;
  request?: { language: string; label?: string; body: string };
  response?: { language: string; label?: string; body: string };
  notes?: ReactNode;
  id: string;
};

const AUTH_LABELS = { public: 'public', bearer: 'requires bearer', admin: 'admin only' };

export function Endpoint({
  method,
  path,
  auth,
  title,
  description,
  request,
  response,
  notes,
  id,
}: EndpointProps) {
  const authLabel = AUTH_LABELS[auth];

  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-rule bg-white"
    >
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-rule bg-paper-2/70 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span
          className="font-mono text-xs font-medium text-ink"
        >
          {method}
        </span>
        <code className="min-w-0 break-all font-mono text-sm text-ink">{path}</code>
        <span
          className="col-span-2 text-xs text-ink-3 sm:col-span-1"
        >
          {authLabel}
        </span>
      </header>
      <div className="space-y-4 px-4 py-4">
        <div>
          <div className="text-sm font-medium text-ink">{title}</div>
          <div className="mt-1 text-sm text-ink-2">{description}</div>
        </div>
        {request && (
          <div>
            <div className="font-cond mb-1.5 text-[13px] font-semibold text-ink-3">
              Request
            </div>
            <CodeBlock language={request.language} label={request.label}>
              {request.body}
            </CodeBlock>
          </div>
        )}
        {response && (
          <div>
            <div className="font-cond mb-1.5 text-[13px] font-semibold text-ink-3">
              Response
            </div>
            <CodeBlock language={response.language} label={response.label}>
              {response.body}
            </CodeBlock>
          </div>
        )}
        {notes && (
          <div className="border-t border-rule py-2 text-xs text-ink-2">
            {notes}
          </div>
        )}
      </div>
    </section>
  );
}
