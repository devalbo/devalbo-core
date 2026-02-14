# Plan 1: @devalbo/core Library

## What

A pnpm monorepo packaging the foundational isomorphic capabilities from RESEARCH.md into reusable packages. The Rust/WASM core is a future concern; this focuses on TypeScript-side abstractions with extension points for future WASM integration.

The library is rooted at `/Users/ajb/Projects/devalbo-core/demo-v2-claude/` and provides the foundation for the Navigator/Editor PoC (Plan 2) and its test suite (Plan 3).

## Monorepo Structure

```
demo-v2-claude/
  pnpm-workspace.yaml
  package.json                          # Root workspace config
  tsconfig.base.json                    # Shared TS config
  .gitignore
  RESEARCH.md                           # (existing)
  docs/                                 # (existing)

  packages/
    shared/                             # @devalbo/shared
      package.json
      tsconfig.json
      src/
        index.ts                        # Public API barrel
        types/
          branded.ts                    # Branded type utilities (FilePath, DirectoryPath)
          environment.ts                # RuntimePlatform enum, RuntimeEnv interface
          filesystem.ts                 # FileEntry, WatchEventType, WatchEvent
          commands.ts                   # CommandResult, CommandHandler, CommandRegistry
          state.ts                      # TinyBase store schema types
        environment/
          detect.ts                     # detectPlatform() function
          inject.ts                     # ServiceContainer (register/resolve)
        validation/
          index.ts                      # Zod-based argument validation utilities
          errors.ts                     # Effect-style tagged errors (MissingArgument, FileNotFound, etc.)

    filesystem/                         # @devalbo/filesystem
      package.json
      tsconfig.json
      src/
        index.ts
        interfaces.ts                   # IFilesystemDriver, IWatcherService
        drivers/
          native.ts                     # NativeFSDriver (Node.js fs/promises)
          zenfs.ts                      # ZenFSDriver (browser OPFS via @zenfs/core + @zenfs/dom)
          memory.ts                     # InMemoryDriver (Map-based, for testing)
        watcher/
          service.ts                    # UnifiedWatcherService (detects platform, delegates)
          node-watcher.ts              # fs.watch adapter with "two-bite" stability check
          browser-watcher.ts           # FileSystemObserver adapter
          polling-watcher.ts           # Polling fallback (stat-based interval)
          events.ts                    # Normalized WatchEvent types

    state/                              # @devalbo/state
      package.json
      tsconfig.json
      src/
        index.ts
        store.ts                        # TinyBase store factory with schema validation
        persisters/
          sqlite-browser.ts            # SQLite WASM + OPFS persister (tabular mapping)
          sqlite-node.ts               # SQLite Node.js persister via better-sqlite3
          memory.ts                    # In-memory persister for testing
        schemas/
          file-tree.ts                 # entries table: path, name, isDirectory, size, mtime, parentPath
          editor-buffer.ts             # buffers table: path, content, isDirty, cursorPos
        hooks/
          use-store.ts                 # React hook for store context access
          use-table.ts                 # React hook for reactive table subscription

    ui/                                 # @devalbo/ui
      package.json
      tsconfig.json
      src/
        index.ts
        primitives/
          text-input.tsx               # Isomorphic TextInput
          spinner.tsx                  # Isomorphic Spinner
          select.tsx                   # Isomorphic Select list (ink-select-input)
          tree-view.tsx               # Isomorphic tree component
          status-bar.tsx              # Isomorphic status bar
          scroll-area.tsx             # Scrollable container
        shell/
          shell-context.tsx            # ShellContext + useShell hook
          browser-shell-provider.tsx   # Browser lifecycle provider
          terminal-shell-provider.tsx  # Terminal lifecycle provider
          interactive-shell.tsx        # Full shell component
        hooks/
          use-platform.ts             # Environment detection hook (returns RuntimeEnv)
          use-keyboard.ts             # Unified keyboard handler

    commands/                           # @devalbo/commands
      package.json
      tsconfig.json
      src/
        index.ts
        registry.ts                    # CommandRegistry class (register, get, list, getHelp)
        parser.ts                      # Hierarchical command parser (app noun verb)
        handler.ts                     # CommandHandler base type + convenience helpers
        validation.ts                  # withValidation pattern (ported from demo)
        console-bridge.ts             # createConsoleBridge() for window.cli-style objects
        types.ts                       # CommandResult, CommandOptions

    worker-bridge/                      # @devalbo/worker-bridge
      package.json
      tsconfig.json
      src/
        index.ts
        bridge.ts                      # WorkerBridge class (postMessage/onMessage)
        protocols.ts                   # Message protocol types (Request, Response, Error)
        shared-buffer.ts              # SharedBufferPool for SharedArrayBuffer allocation
        atomics.ts                    # AtomicsLock and AtomicsSignal helpers
```

## Key Dependencies

| Package | Dependency | Version |
|---------|-----------|---------|
| Root | pnpm | ^9.x |
| Root | typescript | ^5.9 |
| @devalbo/shared | zod | ^4.3 |
| @devalbo/shared | effect | ^3.19 |
| @devalbo/filesystem | @zenfs/core | ^1.9 |
| @devalbo/filesystem | @zenfs/dom | ^0.3 |
| @devalbo/state | tinybase | ^5.x |
| @devalbo/state | @sqlite.org/sqlite-wasm | ^3.x |
| @devalbo/state | better-sqlite3 (optional peer) | ^11.x |
| @devalbo/ui | react | ^19.2 |
| @devalbo/ui | ink | ^6.6 |
| @devalbo/ui | ink-web (peer) | ^0.1.11 |
| @devalbo/ui | @inkjs/ui | ^2.x |
| @devalbo/commands | commander | ^14.x |

## Key Interfaces and Types

```typescript
// === @devalbo/shared ===

// Branded types
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;
export type FilePath = Branded<string, 'FilePath'>;
export type DirectoryPath = Branded<string, 'DirectoryPath'>;

// Environment
export enum RuntimePlatform {
  NodeJS = 'nodejs',
  Browser = 'browser',
  Worker = 'worker',
}
export interface RuntimeEnv {
  platform: RuntimePlatform;
  hasSharedArrayBuffer: boolean;
  hasOPFS: boolean;
  hasFSWatch: boolean;
}

// Filesystem types
export interface FileEntry {
  name: string;
  path: FilePath;
  isDirectory: boolean;
  size?: number;
  mtime?: Date;
  children?: FileEntry[];
}
export enum WatchEventType {
  Created = 'created',
  Modified = 'modified',
  Deleted = 'deleted',
  Moved = 'moved',
}
export interface WatchEvent {
  type: WatchEventType;
  path: FilePath;
  oldPath?: FilePath;
  timestamp: Date;
}

// Command types
export interface CommandResult {
  component: React.ReactNode;
  error?: string;
}
export interface CommandOptions {
  interactive?: boolean;
  onComplete?: () => void;
}
export type CommandHandler = (args: string[], options?: CommandOptions) => CommandResult;


// === @devalbo/filesystem ===

export interface IFilesystemDriver {
  readFile(path: FilePath): Promise<Uint8Array>;
  writeFile(path: FilePath, data: Uint8Array): Promise<void>;
  readdir(path: DirectoryPath): Promise<FileEntry[]>;
  stat(path: FilePath): Promise<FileEntry>;
  mkdir(path: DirectoryPath): Promise<void>;
  rm(path: FilePath): Promise<void>;
  exists(path: FilePath): Promise<boolean>;
}

export interface IWatcherService {
  watch(path: DirectoryPath, callback: (event: WatchEvent) => void): () => void;
  watchFile(path: FilePath, callback: (event: WatchEvent) => void): () => void;
}


// === @devalbo/commands ===

export interface CommandDefinition {
  name: string;
  description: string;
  arguments?: ArgumentDefinition[];
  options?: OptionDefinition[];
  handler: CommandHandler;
  subcommands?: CommandDefinition[];
}
```

## Build and Run Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm -r build

# Build specific package
pnpm --filter @devalbo/shared build

# Run all tests
pnpm -r test

# Type-check all packages
pnpm -r type-check

# Dev mode (watch)
pnpm --filter @devalbo/ui dev
```

---

## TODO List

### Phase 1: Monorepo Scaffolding
- [ ] Create root `pnpm-workspace.yaml` defining `packages/*`
- [ ] Create root `package.json` with workspace scripts and shared dev dependencies
- [ ] Create `tsconfig.base.json` with shared compiler options (ES2020, bundler resolution, strict, paths)
- [ ] Create `.gitignore` with node_modules, dist, coverage, .turbo exclusions
- [ ] Initialize each package directory with `package.json` (name, version, type:module, exports, scripts)
- [ ] Create per-package `tsconfig.json` extending `tsconfig.base.json` with composite references
- [ ] Verify `pnpm install` resolves all workspace dependencies correctly
- [ ] Verify `pnpm -r build` succeeds on empty barrel exports

### Phase 2: @devalbo/shared -- Types and Environment Detection
- [ ] Define branded type utilities (`Branded<T, B>`, `FilePath`, `DirectoryPath`) in `types/branded.ts`
- [ ] Define `RuntimePlatform` enum and `RuntimeEnv` interface in `types/environment.ts`
- [ ] Define `FileEntry`, `WatchEventType`, `WatchEvent` types in `types/filesystem.ts`
- [ ] Define `CommandResult`, `CommandOptions`, `CommandHandler` types in `types/commands.ts`
- [ ] Define TinyBase store schema types in `types/state.ts`
- [ ] Implement `detectPlatform()` function in `environment/detect.ts`
- [ ] Implement `ServiceContainer` with `register()` and `resolve()` in `environment/inject.ts`
- [ ] Implement Zod-based validation helpers in `validation/index.ts`
- [ ] Implement Effect-style tagged errors (`MissingArgument`, `FileNotFound`, `PermissionDenied`) in `validation/errors.ts`
- [ ] Create barrel export `index.ts` exposing all public API
- [ ] Write unit tests for branded type construction and guards
- [ ] Write unit tests for `detectPlatform()` with mocked globals
- [ ] Write unit tests for `ServiceContainer` register/resolve/missing dependency

### Phase 3: @devalbo/filesystem -- Drivers and Watcher
- [ ] Define `IFilesystemDriver` and `IWatcherService` interfaces in `interfaces.ts`
- [ ] Implement `NativeFSDriver` wrapping Node.js `fs/promises` in `drivers/native.ts`
- [ ] Implement `ZenFSDriver` wrapping ZenFS `configure()` + OPFS backend in `drivers/zenfs.ts`
- [ ] Implement `InMemoryDriver` using a Map-based virtual filesystem in `drivers/memory.ts`
- [ ] Define normalized `WatchEvent` emission in `watcher/events.ts`
- [ ] Implement `NodeWatcher` adapter with "two-bite" stability check in `watcher/node-watcher.ts`
- [ ] Implement `BrowserWatcher` adapter using `FileSystemObserver` in `watcher/browser-watcher.ts`
- [ ] Implement `PollingWatcher` fallback using stat-based interval checks in `watcher/polling-watcher.ts`
- [ ] Implement `UnifiedWatcherService` that detects platform and delegates in `watcher/service.ts`
- [ ] Register all drivers with `ServiceContainer` keyed by `RuntimePlatform`
- [ ] Write unit tests for `InMemoryDriver` (full CRUD operations)
- [ ] Write unit tests for `NativeFSDriver` using a temp directory
- [ ] Write unit tests for `UnifiedWatcherService` event normalization with mock backends
- [ ] Write integration test: create file via driver, observe event via watcher

### Phase 4: @devalbo/state -- TinyBase and SQLite Persistence
- [ ] Implement `createStore()` factory in `store.ts` with schema validation
- [ ] Define file-tree TinyBase schema (table: `entries`, cells: path, name, isDirectory, size, mtime, parentPath) in `schemas/file-tree.ts`
- [ ] Define editor-buffer TinyBase schema (table: `buffers`, cells: path, content, isDirty, cursorPos) in `schemas/editor-buffer.ts`
- [ ] Implement in-memory persister for testing in `persisters/memory.ts`
- [ ] Implement SQLite browser persister using `@sqlite.org/sqlite-wasm` with tabular mapping in `persisters/sqlite-browser.ts`
- [ ] Implement SQLite Node.js persister using `better-sqlite3` with tabular mapping in `persisters/sqlite-node.ts`
- [ ] Implement `useStore()` React hook for store context access in `hooks/use-store.ts`
- [ ] Implement `useTable()` React hook for reactive table subscription in `hooks/use-table.ts`
- [ ] Configure `startAutoSave` and `startAutoLoad` in persister setup
- [ ] Write unit tests for store creation and schema enforcement
- [ ] Write unit tests for in-memory persister round-trip (save and load)
- [ ] Write unit tests for reactive hooks using React Testing Library

### Phase 5: @devalbo/ui -- Isomorphic Components
- [ ] Port `ShellContext`, `useShell` from demo to `shell/shell-context.tsx`
- [ ] Port `BrowserShellProvider` from demo to `shell/browser-shell-provider.tsx`
- [ ] Port `TerminalShellProvider` from demo to `shell/terminal-shell-provider.tsx`
- [ ] Port `InteractiveShell` from demo to `shell/interactive-shell.tsx`
- [ ] Port and generalize `TextInput` from demo to `primitives/text-input.tsx`
- [ ] Port and generalize `Spinner` from demo to `primitives/spinner.tsx`
- [ ] Implement `Select` list component using `ink-select-input` in `primitives/select.tsx`
- [ ] Implement `TreeView` component for hierarchical file display in `primitives/tree-view.tsx`
- [ ] Implement `StatusBar` component for bottom-of-screen info in `primitives/status-bar.tsx`
- [ ] Implement `ScrollArea` component for scrollable content in `primitives/scroll-area.tsx`
- [ ] Implement `usePlatform()` hook returning `RuntimeEnv` in `hooks/use-platform.ts`
- [ ] Implement `useKeyboard()` hook for unified keyboard shortcuts in `hooks/use-keyboard.ts`
- [ ] Write unit tests for each primitive component (renders without error, props work)
- [ ] Write visual snapshot tests for TreeView with sample data

### Phase 6: @devalbo/commands -- Registry and Parser
- [ ] Implement `CommandRegistry` class with `register()`, `get()`, `list()`, `getHelp()` in `registry.ts`
- [ ] Implement hierarchical command parser supporting `app noun verb` patterns in `parser.ts`
- [ ] Implement `CommandHandler` base type and convenience helpers in `handler.ts`
- [ ] Port `withValidation` pattern from demo to `validation.ts`
- [ ] Implement `createConsoleBridge()` that generates a `window.cli`-style object from a registry in `console-bridge.ts`
- [ ] Integrate Commander.js program generation from registry definitions in `parser.ts`
- [ ] Write unit tests for CommandRegistry (register, duplicate detection, listing)
- [ ] Write unit tests for hierarchical parsing (nested commands, argument extraction)
- [ ] Write unit tests for `createConsoleBridge()` output shape

### Phase 7: @devalbo/worker-bridge -- Web Worker Utilities
- [ ] Define message protocol types (Request, Response, Error) in `protocols.ts`
- [ ] Implement `WorkerBridge` class with `postMessage`/`onMessage` abstraction in `bridge.ts`
- [ ] Implement `SharedBufferPool` for `SharedArrayBuffer` allocation in `shared-buffer.ts`
- [ ] Implement `AtomicsLock` and `AtomicsSignal` helpers in `atomics.ts`
- [ ] Add feature detection for `SharedArrayBuffer` and `Atomics` availability
- [ ] Write unit tests for message protocol serialization
- [ ] Write unit tests for `SharedBufferPool` allocation and deallocation
- [ ] Document usage patterns for main-thread/worker communication

### Phase 8: Integration and Documentation
- [ ] Create root `README.md` with architecture overview and quick-start
- [ ] Create per-package `README.md` with API documentation and examples
- [ ] Create an `examples/` directory with minimal usage examples
- [ ] Run full `pnpm -r build` and verify all packages produce valid ES module output
- [ ] Run full `pnpm -r test` and verify all unit tests pass
- [ ] Verify workspace package linking works (`@devalbo/ui` can import from `@devalbo/shared`)
- [ ] Configure `publishConfig` in each package.json for npm publishing
