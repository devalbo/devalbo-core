# Plan 2: Navigator/Editor PoC Application

## What

A standalone application that depends on the `@devalbo/core` library (Plan 1) and implements a file navigator and editor. It runs in both terminal (Ink CLI) and browser (ink-web via Vite), following the exact structural patterns established in the existing `demo/` project.

**Location**: `/Users/ajb/Projects/devalbo-core/demo-v2-claude/naveditor/`
**Primary dependency**: `@devalbo/core` packages via workspace/path linking

Commands: `naveditor navigate [path]`, `naveditor edit [file]`, `naveditor help`

## Application Structure

```
naveditor/
  package.json
  tsconfig.json
  tsconfig.vitest.json
  tsconfig.cucumber.json
  .cucumber.cjs
  vite.config.ts
  vitest.config.ts
  index.html
  .gitignore

  src/
    program.ts                          # Commander program definition
    cli-node.tsx                        # Node.js CLI entry (#!/usr/bin/env node)
    cli.tsx                             # CLI setup with Ink render
    index.css                           # Web styles (Tailwind)

    commands/
      index.tsx                         # Command registry (single source of truth)
      navigate.tsx                      # navigate command handler
      edit.tsx                          # edit command handler
      with-validation.ts               # Effect-based validation wrapper

    lib/
      validate-args.ts                  # Zod/Effect validators for navigate, edit
      utils.ts                          # General utilities
      file-operations.ts               # Driver factory and file helpers

    hooks/
      use-file-tree.ts                 # Directory listing + watcher subscription
      use-file-editor.ts               # File buffer, dirty state, save/revert
      use-file-tree-store.ts           # TinyBase store integration

    components/
      ShellContext.tsx                  # Shell state context
      BrowserShellProvider.tsx          # Browser lifecycle provider
      TerminalShellProvider.tsx         # Terminal lifecycle provider
      InteractiveShell.tsx             # Interactive shell with navigate/edit

      navigator/
        Navigator.tsx                  # Main navigator (tree + status bar)
        FileTree.tsx                   # Recursive tree view of file entries
        FileTreeItem.tsx              # Single file/directory row with icon
        NavigatorStatusBar.tsx        # Current path, file count, selected item

      editor/
        Editor.tsx                     # Main editor (content + status bar)
        EditorContent.tsx             # File content display/edit area
        EditorStatusBar.tsx           # Filename, dirty state, cursor line:col
        LineNumbers.tsx               # Line number gutter

      ui/
        text-input.tsx                # Re-export or override from @devalbo/ui
        spinner.tsx
        gradient.tsx

    web/
      App.tsx                          # Browser app with InkTerminalBox
      index.tsx                        # Browser entry, mounts React root
      console-helpers.ts              # window.cli with navigate/edit/help

  tests/                               # (See Plan 3)
    ...
```

## Dependencies

```json
{
  "dependencies": {
    "@devalbo/shared": "workspace:*",
    "@devalbo/filesystem": "workspace:*",
    "@devalbo/state": "workspace:*",
    "@devalbo/ui": "workspace:*",
    "@devalbo/commands": "workspace:*",
    "commander": "^14.0.2",
    "effect": "^3.19.14",
    "ink-select-input": "^6.2.0",
    "ink-web": "^0.1.11",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "xterm": "^5.3.0",
    "zod": "^4.3.4"
  },
  "devDependencies": {
    "@cucumber/cucumber": "^12.5.0",
    "@playwright/test": "^1.57.0",
    "@types/node": "^25.0.3",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.2",
    "ink": "^6.6.0",
    "playwright": "^1.57.0",
    "tsx": "^4.19.2",
    "typescript": "^5.9.3",
    "vite": "^7.3.0",
    "vite-plugin-node-polyfills": "^0.25.0",
    "vite-plugin-wasm": "^3.x",
    "vitest": "^4.0.16"
  }
}
```

## Key Interfaces

```typescript
// src/hooks/use-file-tree.ts
export interface UseFileTreeOptions {
  rootPath: DirectoryPath;
  depth?: number;          // max traversal depth, default 3
  showHidden?: boolean;
}
export interface UseFileTreeReturn {
  entries: FileEntry[];
  selectedPath: FilePath | null;
  isLoading: boolean;
  error: string | null;
  select: (path: FilePath) => void;
  refresh: () => void;
  expand: (path: DirectoryPath) => void;
  collapse: (path: DirectoryPath) => void;
}

// src/hooks/use-file-editor.ts
export interface UseFileEditorOptions {
  filePath: FilePath;
  readonly?: boolean;
}
export interface UseFileEditorReturn {
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  cursorLine: number;
  cursorCol: number;
  setContent: (content: string) => void;
  save: () => Promise<void>;
  revert: () => Promise<void>;
  moveCursor: (line: number, col: number) => void;
}
```

## Build and Run Commands

```bash
# Development
pnpm dev                    # Vite dev server (web, port 3000)

# Build
pnpm build                  # Both web and node builds
pnpm build:web              # vite build (browser)
pnpm build:cli              # vite build --mode node (CLI)

# Run CLI
pnpm cli navigate /path     # Terminal navigator
pnpm cli edit /path/file    # Terminal editor
pnpm cli help               # Show help

# After global install:
naveditor navigate /path
naveditor edit /path/file.txt
naveditor help

# Type checking
pnpm type-check
```

---

## TODO List

### Phase 1: Project Scaffolding
- [ ] Create `naveditor/` directory
- [ ] Create `package.json` with `"type": "module"`, `"bin": { "naveditor": "./dist/cli.js" }`, all dependencies
- [ ] Create `tsconfig.json` extending base config with `jsx: react-jsx`, path aliases (`@/*` -> `./src/*`)
- [ ] Create `tsconfig.vitest.json` for test compilation
- [ ] Create `tsconfig.cucumber.json` for BDD step compilation
- [ ] Create `vite.config.ts` with dual-mode build:
  - Default: web build with `ink: 'ink-web'` alias, `nodePolyfills()`, React plugin
  - `--mode node`: CLI build with `formats: ['es']`, external ink/react
- [ ] Create `vitest.config.ts` with timestamped output support following demo pattern
- [ ] Create `.cucumber.cjs` configuration for terminal and browser profiles
- [ ] Create `index.html` with `<div id="root">` and module script to `src/web/index.tsx`
- [ ] Create `.gitignore` (node_modules, dist, tests/results, coverage)

### Phase 2: Command Infrastructure
- [ ] Create `src/program.ts` defining Commander program:
  - `navigate [path]` -- Navigate a directory (default: `.`)
  - `edit <file>` -- Edit a file
  - `help` -- Display help
- [ ] Create `src/commands/index.tsx` as single source of truth with stub handlers
- [ ] Create `src/commands/navigate.tsx` returning placeholder component
- [ ] Create `src/commands/edit.tsx` returning placeholder component
- [ ] Create `src/commands/with-validation.ts` (port from demo or import from `@devalbo/commands`)
- [ ] Create `src/lib/validate-args.ts`:
  - `validateNavigateArgs(args)` -- optional path, defaults to `.`, validates directory exists
  - `validateEditArgs(args)` -- required file path, validates file exists
- [ ] Create `src/cli-node.tsx` as `#!/usr/bin/env node` entry point
- [ ] Create `src/cli.tsx` with `setupCLI()` wiring Commander actions to Ink render
- [ ] Verify: `pnpm build:cli && node dist/cli.js help` outputs correct help text

### Phase 3: Filesystem Integration
- [ ] Create `src/lib/file-operations.ts`:
  - `getDriver()` factory: returns `NativeFSDriver` in Node, `ZenFSDriver` in browser, injectable for tests
  - `getWatcher()` factory: returns appropriate watcher for platform
- [ ] Implement `src/hooks/use-file-tree.ts`:
  - Call `driver.readdir()` on mount, populate `FileEntry[]` state
  - Subscribe to `IWatcherService` events, update entries on Created/Deleted/Modified
  - Implement `expand()` for lazy directory loading
  - Implement `collapse()` to remove child entries
  - Implement `select()` to track selected file path
- [ ] Implement `src/hooks/use-file-editor.ts`:
  - Call `driver.readFile()` on mount, decode UTF-8, set content state
  - Track dirty state (content !== lastSaved)
  - Implement `save()`: encode content, call `driver.writeFile()`, clear dirty
  - Implement `revert()`: re-read file from driver

### Phase 4: TinyBase State Integration
- [ ] Create `src/hooks/use-file-tree-store.ts`:
  - Connect `useFileTree()` to TinyBase store from `@devalbo/state`
  - Populate TinyBase `entries` table from filesystem reads
  - Sync watcher events to TinyBase store (insert/update/delete rows)
- [ ] Configure persister:
  - In-memory for tests
  - SQLite for production (browser: WASM+OPFS, node: better-sqlite3)
- [ ] Ensure UI components read from TinyBase store (not raw fs calls)
- [ ] Verify reactive chain: fs event -> store update -> UI re-render

### Phase 5: Navigator Component
- [ ] Create `src/components/navigator/FileTreeItem.tsx`:
  - Render file/directory icon, name, size
  - Highlight when selected
  - Indent based on depth
- [ ] Create `src/components/navigator/FileTree.tsx`:
  - Recursive tree rendering using nested `Box`/`Text`
  - Consume `useFileTree()` hook
- [ ] Implement keyboard navigation in FileTree:
  - Up/Down arrows to move selection
  - Enter on directory to expand/collapse
  - Enter on file to select
- [ ] Create `src/components/navigator/NavigatorStatusBar.tsx`:
  - Show current path, file count, selected item name
- [ ] Create `src/components/navigator/Navigator.tsx`:
  - Compose FileTree + NavigatorStatusBar
  - Accept `rootPath` prop
- [ ] Wire `navigate` command in `commands/index.tsx` to render `<Navigator rootPath={path} />`
- [ ] Verify terminal: `naveditor navigate .` shows directory tree with keyboard navigation
- [ ] Verify browser: same Navigator component renders in ink-web terminal box

### Phase 6: Editor Component
- [ ] Create `src/components/editor/LineNumbers.tsx`:
  - Render line number gutter aligned with content
- [ ] Create `src/components/editor/EditorContent.tsx`:
  - Display file content with cursor position tracking
  - Basic text input: character insertion, backspace, newline
- [ ] Create `src/components/editor/EditorStatusBar.tsx`:
  - Show filename, line:col, dirty indicator ([+] when modified), encoding
- [ ] Create `src/components/editor/Editor.tsx`:
  - Compose LineNumbers + EditorContent + EditorStatusBar
  - Accept `filePath` prop
  - Consume `useFileEditor()` hook
- [ ] Wire `edit` command in `commands/index.tsx` to render `<Editor filePath={file} />`
- [ ] Implement keybindings using `useKeyboard()`:
  - Ctrl+S: save file
  - Ctrl+Q: quit editor (return to shell)
- [ ] Verify terminal: `naveditor edit ./package.json` shows content with line numbers
- [ ] Verify browser: same Editor component renders in ink-web terminal box

### Phase 7: Shell and Web Integration
- [ ] Create `src/components/ShellContext.tsx` (re-export from `@devalbo/ui` or local)
- [ ] Create `src/components/BrowserShellProvider.tsx` with browser lifecycle
- [ ] Create `src/components/TerminalShellProvider.tsx` with terminal lifecycle + exit handling
- [ ] Create `src/components/InteractiveShell.tsx`:
  - Extend demo pattern with `navigate` and `edit` commands
  - Command history, clear command, error display
- [ ] Create `src/web/App.tsx`:
  - `InkTerminalBox` wrapping InteractiveShell
  - Container styling (border, background, max-width)
- [ ] Create `src/web/index.tsx`:
  - Mount React root
  - Import CSS: `index.css`, `ink-web/css`, `xterm/css/xterm.css`
  - Expose `window.cli` from console-helpers
- [ ] Create `src/web/console-helpers.ts`:
  - `cli.navigate(path?)` -- navigate command
  - `cli.edit(file)` -- edit command
  - `cli.help()` -- help command
  - Text extraction from React nodes for console output
- [ ] Create `src/index.css` with Tailwind import
- [ ] Verify: `pnpm dev` starts Vite server, browser shows working terminal with navigate/edit

### Phase 8: Polish and Edge Cases
- [ ] Handle filesystem permission errors gracefully (display error in component)
- [ ] Handle non-existent paths in `navigate` (show error message, don't crash)
- [ ] Handle non-existent files in `edit` (offer to create new file)
- [ ] Handle binary files in editor (detect non-UTF8, show "binary file" message)
- [ ] Add loading spinners during filesystem operations (Spinner from @devalbo/ui)
- [ ] Add empty state for empty directories in navigator
- [ ] Implement basic file type indicators (icons or labels based on extension)
- [ ] Ensure consistent behavior between terminal and browser for all commands
