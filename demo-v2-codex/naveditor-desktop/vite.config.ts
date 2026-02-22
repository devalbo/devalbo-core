import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'node:path';

const tauriDevHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  clearScreen: false,
  server: {
    host: tauriDevHost || '127.0.0.1',
    port: 1420,
    strictPort: true,
    hmr: tauriDevHost
      ? {
        protocol: 'ws',
        host: tauriDevHost,
        port: 1421
      }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  resolve: {
    alias: [
      { find: '@/lib/validate-args', replacement: resolve(__dirname, '../packages/cli-shell/src/lib/validate-args.ts') },
      { find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, '../packages/cli-shell/src/$1') },
      { find: '@devalbo/cli-shell', replacement: resolve(__dirname, '../packages/cli-shell/src/index.ts') },
      { find: '@devalbo/commands', replacement: resolve(__dirname, '../packages/commands/src/index.ts') },
      { find: '@devalbo/shared', replacement: resolve(__dirname, '../packages/shared/src/index.ts') },
      { find: '@devalbo/solid-client', replacement: resolve(__dirname, '../packages/solid-client/src/index.ts') },
      { find: '@devalbo/state', replacement: resolve(__dirname, '../packages/state/src/index.ts') },
      { find: '@devalbo/ui', replacement: resolve(__dirname, '../packages/ui/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, '../editor-lib/src') },
      { find: 'ink', replacement: 'ink-web' }
    ]
  }
});
