'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, TriangleAlert } from 'lucide-react';

export function PreviewImage({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [src]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          <span>{alt}</span>
        </div>
        <a className="inline-flex items-center gap-1 hover:text-slate-900" href={src} target="_blank" rel="noreferrer">
          <Download className="h-3.5 w-3.5" /> Download
        </a>
      </div>
      <div className="relative min-h-48 bg-slate-50">
        {status === 'loading' && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading preview…</span>
          </div>
        )}
        {status === 'error' ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-rose-700">
            <TriangleAlert className="h-4 w-4" />
            <span>Preview image failed to load. Use the download link above.</span>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className={`h-auto w-full ${status === 'loading' ? 'absolute inset-0 opacity-0' : ''}`}
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('error')}
          />
        )}
      </div>
    </div>
  );
}
