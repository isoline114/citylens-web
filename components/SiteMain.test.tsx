import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  pathname: '/',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

import { SiteMain } from './SiteMain';

describe('SiteMain', () => {
  beforeEach(() => {
    navigation.pathname = '/';
  });

  it('uses the standard content measure by default', () => {
    render(<SiteMain>Home</SiteMain>);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveClass('max-w-6xl');
    expect(main).not.toHaveClass('max-w-[1480px]');
  });

  it('gives the parcel workspace its full decision-canvas width', () => {
    navigation.pathname = '/parcel-intel';
    render(<SiteMain>Parcels</SiteMain>);

    expect(screen.getByRole('main')).toHaveClass('max-w-[1480px]');
  });
});
