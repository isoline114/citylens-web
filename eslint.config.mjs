import next from 'eslint-config-next';
import nextCwv from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...next,
  ...nextCwv,
  ...nextTs,
  {
    rules: {
      // Standard hydration / fetch-on-mount patterns trigger this in components
      // like RunForm and the mock auth provider. The intent is intentional.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'public/**',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },
];

export default config;
