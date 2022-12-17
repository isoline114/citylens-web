import type { ReactNode } from 'react';

type CodeBlockProps = {
  language?: string;
  label?: string;
  children: string;
};

export function CodeBlock({ language = 'bash', label, children }: CodeBlockProps) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-900">
      {(label || language) && (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          <span>{label ?? language}</span>
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed text-slate-100">
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

const METHOD_COLORS: Record<EndpointProps['method'], string> = {
  GET: 'bg-sky-100 text-sky-800 ring-sky-200',
  POST: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  PUT: 'bg-amber-100 text-amber-800 ring-amber-200',
  DELETE: 'bg-rose-100 text-rose-800 ring-rose-200',
  PATCH: 'bg-violet-100 text-violet-800 ring-violet-200',
};

const AUTH_BADGES: Record<EndpointProps['auth'], { label: string; classes: string }> = {
  public: { label: 'public', classes: 'bg-slate-100 text-slate-700 ring-slate-200' },
  bearer: { label: 'requires bearer', classes: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  admin: { label: 'admin only', classes: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

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
  const methodClass = METHOD_COLORS[method];
  const authBadge = AUTH_BADGES[auth];

  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span
          className={`inline-flex h-6 items-center rounded-md px-2 font-mono text-xs font-semibold ring-1 ring-inset ${methodClass}`}
        >
          {method}
        </span>
        <code className="font-mono text-sm text-slate-900">{path}</code>
        <span
          className={`ml-auto inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium ring-1 ring-inset ${authBadge.classes}`}
        >
          {authBadge.label}
        </span>
      </header>
      <div className="space-y-3 px-4 py-4">
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-700">{description}</div>
        </div>
        {request && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Request
            </div>
            <CodeBlock language={request.language} label={request.label}>
              {request.body}
            </CodeBlock>
          </div>
        )}
        {response && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Response
            </div>
            <CodeBlock language={response.language} label={response.label}>
              {response.body}
            </CodeBlock>
          </div>
        )}
        {notes && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {notes}
          </div>
        )}
      </div>
    </section>
  );
}
