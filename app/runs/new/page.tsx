import type { Metadata } from 'next';

import { NewRunWorkspace } from './new-run-workspace';

export const metadata: Metadata = {
  title: 'New run — CityLens',
  description:
    'Start a CityLens imagery-to-evidence processing run for an NYC address.',
};

export default function NewRunPage() {
  return <NewRunWorkspace />;
}
