'use client';
import { useState } from 'react';
export function OrthoImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p role="status" className="absolute inset-0 flex items-end justify-center bg-paper-2 p-4 text-center text-xs text-ink-3">The aerial image is temporarily unavailable. Tax-lot outlines remain visible.</p>;
  // This public ArcGIS export must share its exact pixel grid with the SVG overlay.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={900} height={600} className="absolute inset-0 h-full w-full" onError={() => setFailed(true)} />;
}
