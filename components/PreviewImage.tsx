'use client';

export function PreviewImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <img src={src} alt={alt} className="h-auto w-full" />
    </div>
  );
}
