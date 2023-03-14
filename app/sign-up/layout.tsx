import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create an account — CityLens',
  description:
    'Create a CityLens account for parcel intelligence and imagery analysis.',
};

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
