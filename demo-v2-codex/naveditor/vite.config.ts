import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  build: {
    lib: {
      entry: resolve(__dirname, '../editor-lib/src/cli-node.tsx'),
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
        '@devalbo/cli-shell',
        '@devalbo/filesystem',
        '@devalbo/filesystem/node',
        '@devalbo/shared',
        '@devalbo/solid-client',
        '@devalbo/state',
        '@devalbo/ui'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../editor-lib/src'),
      '@/lib/validate-args': resolve(__dirname, '../packages/cli-shell/src/lib/validate-args.node.ts')
    }
  }
});
