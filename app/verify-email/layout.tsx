import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Verify email — CityLens',
  description: 'Verify the email address for your CityLens account.',
};

export default function VerifyEmailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
