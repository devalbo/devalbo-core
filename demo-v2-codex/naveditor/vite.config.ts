import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  build: {
    lib: {
      entry: resolve(__dirname, '../naveditor-lib/src/cli-node.tsx'),
      name: 'naveditor',
      fileName: () => 'cli.js',
      formats: ['es']
    },
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: [
        'commander',
        'ink',
        'react',
        'react/jsx-runtime',
        '@devalbo/commands',
        '@devalbo/filesystem',
        '@devalbo/filesystem/node',
        '@devalbo/shared',
        '@devalbo/state',
        '@devalbo/ui'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../naveditor-lib/src'),
      '@/lib/validate-args': resolve(__dirname, '../naveditor-lib/src/lib/validate-args.node.ts')
    }
  }
});
