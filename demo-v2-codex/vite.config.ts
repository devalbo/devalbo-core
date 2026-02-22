import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Root-level Vite config used by the vitest workspace shared ViteNode server.
// Per-project resolve.alias does not apply in vitest 4 workspace mode;
// aliases must be declared here so the shared module resolver can intercept them.
//
// This file is NOT used by the app packages (naveditor-web, naveditor-desktop) —
// they each have their own Vite configs and don't import this file.
export default defineConfig({
  resolve: {
    alias: [
      // More-specific aliases must come before the @/ catch-all
      { find: '@/lib/validate-args', replacement: resolve(__dirname, 'packages/cli-shell/src/lib/validate-args.node.ts') },
      { find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, 'packages/cli-shell/src/$1') },
      { find: '@devalbo/cli-shell', replacement: resolve(__dirname, 'packages/cli-shell/src/index.ts') },
      { find: '@devalbo/filesystem/node', replacement: resolve(__dirname, 'packages/filesystem/src/node.ts') },
      { find: '@devalbo/filesystem', replacement: resolve(__dirname, 'packages/filesystem/src/index.ts') },
      { find: '@devalbo/commands', replacement: resolve(__dirname, 'packages/commands/src/index.ts') },
      { find: '@devalbo/shared', replacement: resolve(__dirname, 'packages/shared/src/index.ts') },
      { find: '@devalbo/solid-client', replacement: resolve(__dirname, 'packages/solid-client/src/index.ts') },
      { find: '@devalbo/state', replacement: resolve(__dirname, 'packages/state/src/index.ts') },
      { find: '@devalbo/ui', replacement: resolve(__dirname, 'packages/ui/src/index.ts') },
      { find: /^@\/(.*)$/, replacement: resolve(__dirname, 'editor-lib/src/$1') },
    ],
  },
});
