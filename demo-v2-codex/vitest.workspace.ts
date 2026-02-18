import { defineWorkspace } from 'vitest/config';
import { resolve } from 'node:path';

export default defineWorkspace([
  // Packages project: explicit include so it doesn't accidentally glob naveditor/tests
  {
    test: {
      name: 'packages',
      globals: true,
      environment: 'node',
      include: ['packages/*/tests/**/*.{test,spec}.{ts,tsx}'],
      setupFiles: ['packages/state/tests/setup-vitest.ts'],
    },
  },

  // Naveditor project: root anchored to naveditor/ so relative paths in tests resolve correctly
  {
    test: {
      name: 'naveditor',
      globals: true,
      environment: 'node',
      root: resolve(__dirname, 'naveditor'),
      include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
      setupFiles: ['./tests/setup-vitest.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: `./tests/results/unit/latest/coverage`,
        exclude: ['tests/**', 'dist/**'],
      },
    },
  },
]);
