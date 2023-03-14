import { render, screen } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  pathname: '/parcel-intel' as string | null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (
    properties: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean },
  ) => {
    const { alt, priority, ...imageProperties } = properties;
    void priority;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt ?? ''} {...imageProperties} />
    );
  },
}));

vi.mock('@/components/AuthHeaderControls', () => ({
  AuthHeaderControls: () => <div>Account controls</div>,
}));

vi.mock('@/components/PlanQuotaBadge', () => ({
  PlanQuotaBadge: () => null,
}));

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('marks the active destination in desktop and mobile navigation', () => {
    render(<SiteHeader />);

    const parcelLinks = screen.getAllByRole('link', { name: 'Parcels' });
    expect(parcelLinks).toHaveLength(2);
    parcelLinks.forEach((link) => {
      expect(link).toHaveAttribute('aria-current', 'page');
    });
  });

  it('keeps Home current while the static root pathname initializes', () => {
    navigation.pathname = null;
    render(<SiteHeader />);

    screen.getAllByRole('link', { name: 'Home' }).forEach((link) => {
      expect(link).toHaveAttribute('aria-current', 'page');
    });
  });
});
