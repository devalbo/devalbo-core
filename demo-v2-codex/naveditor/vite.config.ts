import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'node:path';

const devalboCommonAliases = {
  '@devalbo/commands': resolve(__dirname, '../packages/commands/src/index.ts'),
  '@devalbo/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
  '@devalbo/state': resolve(__dirname, '../packages/state/src/index.ts'),
  '@devalbo/ui': resolve(__dirname, '../packages/ui/src/index.ts')
};

export default defineConfig(({ mode }) => {
  const isNode = mode === 'node';

  if (isNode) {
    return {
      esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react'
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src/cli-node.tsx'),
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
          '@': resolve(__dirname, 'src'),
          '@/lib/validate-args': resolve(__dirname, 'src/lib/validate-args.node.ts')
        }
      }
    };
  }

  return {
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    },
    server: {
      port: 3000,
      open: true,
      host: true
    },
    plugins: [react(), nodePolyfills()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@/lib/validate-args': resolve(__dirname, 'src/lib/validate-args.ts'),
        '@devalbo/filesystem/node': resolve(__dirname, '../packages/filesystem/src/node.browser.ts'),
        '@devalbo/filesystem': resolve(__dirname, '../packages/filesystem/src/browser.ts'),
        ...devalboCommonAliases,
        ink: 'ink-web'
      }
    }
  };
});
