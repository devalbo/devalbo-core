import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

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
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/coverage`,
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
