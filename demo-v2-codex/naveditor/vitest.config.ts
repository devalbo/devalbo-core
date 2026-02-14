import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
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
    alias: {
      '@': resolve(__dirname, 'src'),
      '@devalbo/commands': resolve(__dirname, '../packages/commands/src/index.ts'),
      '@devalbo/filesystem/node': resolve(__dirname, '../packages/filesystem/src/node.ts'),
      '@devalbo/filesystem': resolve(__dirname, '../packages/filesystem/src/index.ts'),
      '@devalbo/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
      '@devalbo/state': resolve(__dirname, '../packages/state/src/index.ts'),
      '@devalbo/ui': resolve(__dirname, '../packages/ui/src/index.ts')
    }
  }
});
