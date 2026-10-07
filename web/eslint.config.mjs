import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    '.data/**',
    '.cache/**',
    'public/duckdb/**',
    'public/_fixtures/**',
    'next-env.d.ts',
    'playwright-report/**',
  ]),
  {
    rules: {
      // TSE's names and addresses reach the page as text. React escapes text, and this rule
      // keeps every string on that path.
      'react/no-danger': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
])
