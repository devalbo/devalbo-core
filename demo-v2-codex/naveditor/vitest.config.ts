import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup-vitest.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/coverage`,
      exclude: ['tests/**', 'dist/**']
    },
    typecheck: {
      tsconfig: './tsconfig.vitest.json'
    },
    reporters: ['default', 'json', 'junit'],
    outputFile: {
      json: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/results.json`,
      junit: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/junit.xml`
    }
  },
  resolve: {
    alias: [
      { find: '@/lib/validate-args', replacement: resolve(__dirname, '../packages/cli-shell/src/lib/validate-args.node.ts') },
      { find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, '../packages/cli-shell/src/$1') },
      { find: '@devalbo/cli-shell', replacement: resolve(__dirname, '../packages/cli-shell/src/index.ts') },
      { find: '@devalbo/filesystem/node', replacement: resolve(__dirname, '../packages/filesystem/src/node.ts') },
      { find: '@devalbo/filesystem', replacement: resolve(__dirname, '../packages/filesystem/src/index.ts') },
      { find: '@devalbo/commands', replacement: resolve(__dirname, '../packages/commands/src/index.ts') },
      { find: '@devalbo/shared', replacement: resolve(__dirname, '../packages/shared/src/index.ts') },
      { find: '@devalbo/solid-client', replacement: resolve(__dirname, '../packages/solid-client/src/index.ts') },
      { find: '@devalbo/state', replacement: resolve(__dirname, '../packages/state/src/index.ts') },
      { find: '@devalbo/ui', replacement: resolve(__dirname, '../packages/ui/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, '../editor-lib/src') }
    ]
  }
});
