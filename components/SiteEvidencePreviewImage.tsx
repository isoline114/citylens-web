'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';

export function SiteEvidencePreviewImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_35%_25%,rgba(14,165,233,0.24),transparent_32%),linear-gradient(145deg,#020617,#0f172a)]"
        data-testid="home-site-evidence-fallback"
        role="img"
        aria-label="Site-evidence preview unavailable"
      >
        <div className="flex flex-col items-center gap-2 text-center text-slate-300">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <ImageOff className="h-5 w-5 text-sky-300" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium">Preview temporarily unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      className="object-cover opacity-95"
      onError={() => setFailed(true)}
      data-testid="home-site-evidence-image"
    />
  );
}
