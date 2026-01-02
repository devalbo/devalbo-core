import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isNode = mode === 'node';

  if (isNode) {
    // Node.js CLI build
    return {
      esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react'
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src/cli-node.tsx'),
          name: 'demo',
          fileName: () => 'cli.js',
          formats: ['es']
        },
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
          external: ['commander', '@clack/prompts', 'ink', 'react', 'react/jsx-runtime']
        }
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      }
    };
  }

  // Web browser build
  return {
    root: './',
    publicDir: 'public',
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
    plugins: [
      react(),
      nodePolyfills()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // Alias ink to ink-web for browser compatibility
        'ink': 'ink-web'
      }
    }
  };
});
