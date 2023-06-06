import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  pathname: '/',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

import { SiteFooterBoundary, SiteMain } from './SiteMain';

describe('SiteMain', () => {
  beforeEach(() => {
    navigation.pathname = '/';
  });

  it('uses the standard content measure by default', () => {
    render(<SiteMain>Home</SiteMain>);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveClass('max-w-6xl');
    expect(main).not.toHaveClass('ws-tabular');
  });

  it('gives the parcel workspace its full decision-canvas width', () => {
    navigation.pathname = '/parcel-intel';
    render(<SiteMain>Parcels</SiteMain>);

    expect(screen.getByRole('main')).toHaveClass('ws-tabular');
    expect(screen.getByRole('main')).not.toHaveClass('max-w-[1480px]');
  });

  it('reserves the parcel canvas for work while keeping public-page footers', () => {
    const { rerender } = render(
      <SiteFooterBoundary><footer>Site links</footer></SiteFooterBoundary>,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    navigation.pathname = '/parcel-intel';
    rerender(<SiteFooterBoundary><footer>Site links</footer></SiteFooterBoundary>);
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
