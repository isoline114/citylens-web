'use client';

import type { MouseEvent } from 'react';
import { useEffect } from 'react';

type SectionLink = {
  id: string;
  label: string;
};

function revealSection(id: string, updateLocation: boolean) {
  const section = document.getElementById(id);
  if (!(section instanceof HTMLDetailsElement)) return false;

  section.open = true;
  if (updateLocation) {
    window.history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  }
  section.scrollIntoView?.({ block: 'start' });
  section.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
  return true;
}

export function DocsSectionNav({
  sections,
  apiBase,
}: {
  sections: readonly SectionLink[];
  apiBase: string;
}) {
  useEffect(() => {
    const revealLocation = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (id) revealSection(id, false);
    };
    revealLocation();
    const animationFrame = window.requestAnimationFrame(revealLocation);
    window.addEventListener('hashchange', revealLocation);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('hashchange', revealLocation);
    };
  }, []);

  const handleClick = (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    if (revealSection(sectionId, true)) event.preventDefault();
  };

  return (
    <nav
      aria-label="Developer center sections"
      className="border-y border-rule bg-white py-2"
    >
      <div className="flex items-center justify-between gap-3 px-3 pb-1.5 pt-1">
        <div className="text-xs font-medium text-ink-3">
          Browse the reference
        </div>
        <code className="hidden text-[11px] text-ink sm:block">
          {apiBase}
        </code>
      </div>
      <ul className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
        {sections.map((item) => (
          <li key={item.id} className="shrink-0 snap-start sm:shrink">
            <a
              href={`#${item.id}`}
              onClick={(event) => handleClick(event, item.id)}
              className="flex min-h-10 items-center rounded-sm px-3 py-2 text-xs font-semibold text-ink-2 transition hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-select"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
