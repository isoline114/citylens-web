import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign out — CityLens',
};

export default function SignOutLayout({ children }: { children: ReactNode }) {
  return children;
}
