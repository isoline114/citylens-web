'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';

export function SiteEvidencePreviewImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-paper-2 px-5"
        data-testid="home-site-evidence-fallback"
        role="img"
        aria-label="Site-evidence preview unavailable"
      >
        <div className="flex flex-col items-center gap-3 text-center text-ink-3">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">Preview temporarily unavailable</span>
          <span className="max-w-[16rem] text-xs leading-5">Open the evidence record to inspect available artifacts.</span>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(min-width: 1024px) 55vw, 100vw"
      className="object-contain"
      onError={() => setFailed(true)}
      data-testid="home-site-evidence-image"
    />
  );
}
