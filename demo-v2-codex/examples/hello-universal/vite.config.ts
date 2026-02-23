import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: [
      { find: 'devalbo-cli', replacement: path.resolve(__dirname, '../../packages/devalbo-cli/src/index.ts') },
      { find: /^@devalbo\/cli-shell\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/cli-shell/src/$1') },
      { find: '@devalbo/cli-shell', replacement: path.resolve(__dirname, '../../packages/cli-shell/src/index.ts') },
      { find: '@devalbo/commands', replacement: path.resolve(__dirname, '../../packages/commands/src/index.ts') },
      { find: '@devalbo/shared', replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts') },
      { find: '@devalbo/state', replacement: path.resolve(__dirname, '../../packages/state/src/index.ts') },
      { find: '@devalbo/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts') },
      { find: 'ink', replacement: 'ink-web' }
    ]
  }
});
