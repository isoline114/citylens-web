import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in — CityLens',
  description: 'Sign in to your CityLens parcel intelligence workspace.',
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
