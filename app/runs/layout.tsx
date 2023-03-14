import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Runs — CityLens',
  description:
    'Track CityLens processing, review completed evidence packages, and recover failed work.',
};

export default function RunsLayout({ children }: { children: ReactNode }) {
  return children;
}
