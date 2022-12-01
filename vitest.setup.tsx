import '@testing-library/jest-dom/vitest';

import React from 'react';
import { vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { src, alt, priority, fill, placeholder, ...rest } = props as React.ImgHTMLAttributes<HTMLImageElement> & {
      priority?: boolean;
      fill?: boolean;
      placeholder?: string;
    };
    return <img src={typeof src === 'string' ? src : ''} alt={alt} {...rest} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children?: React.ReactNode;
  }) => {
    const resolved = typeof href === 'string' ? href : (href as { pathname?: string }).pathname ?? '';
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    );
  },
}));
