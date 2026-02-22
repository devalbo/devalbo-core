# Plan 13: Developer-Facing Documentation Layer

## Goal

Make `@devalbo/cli-shell` usable by external app developers — people who have never seen the naveditor codebase and want to build their own CLI/browser/desktop app on top of the devalbo framework.

**Prerequisite:** Plan 12 (cli-shell extraction) and Plan 12a (prep changes) are **complete and verified** — all type-checks pass, unit tests pass.

### Post-12a API surface (verified)

The following exports are now available from `@devalbo/cli-shell`:

```
Components:     InteractiveShell (with welcomeMessage prop), BrowserShellProvider,
                ShellContext, useShell, TerminalShellProvider
Types:          AsyncCommandHandler, StoreCommandHandler, CommandHandler,
                ExtendedCommandOptions, ExtendedCommandOptionsWithStore
Utilities:      makeOutput, makeError, makeResult, makeResultError
Command groups: filesystemCommands, systemCommands, appCommands, builtinCommands (aggregate)
Program helper: registerBuiltinCommands
Runtime:        parseCommandLine, buildCommandOptions, executeCommand, executeCommandRaw,
                CommandRuntimeContext
Console:        bindCliRuntimeSource, unbindCliRuntimeSource, getCliRuntimeStatus, cli, CliRuntimeSource
Entry:          startInteractiveCli, CliEntryOptions
Config:         createCliAppConfig (re-export from @devalbo/shared)
Filesystem:     buildTree, changeDir, copyPath, ... (full set), FsTreeNode
File ops:       getDriver, getFilesystemBackendInfo, getWatcher
```

Key 12a changes the docs must reflect:
- `builtinCommands` — single-import aggregate of all built-in commands
- `registerBuiltinCommands(program)` — eliminates manual commander registration of 16 commands
- `StoreCommandHandler` — replaces the old `SocialCommandHandler` name
- `welcomeMessage` prop — required string or ReactNode. Apps provide their own welcome message.
- `defaultWelcomeMessage(config)` — utility for generating `Welcome to <appName>. Type "help" for available commands.`
- `createCliAppConfig({ appId, appName, storageKey })` — factory for CLI-only config (no Solid)

After Plan 13, a developer should be able to:
1. Read `CREATE_AN_APP.md` and understand the full path from zero to running app
2. Copy `examples/hello-cli/` and have a working shell in minutes
3. See naveditor as an app built on the framework using the same patterns they'd follow — with `editor-lib` as its app library, `naveditor-web` as its browser shell, `naveditor-desktop` as its Tauri shell, and `naveditor-terminal` as its CLI shell
4. Explore the package graph without confusion about what's framework vs. what's app

---

## Step 0 — Preflight

```sh
pnpm install
pnpm --filter naveditor test:unit
```

All unit tests should pass. Confirm Plan 12a changes are in place:
- `packages/cli-shell/src/index.ts` exports `builtinCommands`, `registerBuiltinCommands`, `StoreCommandHandler`
- `packages/cli-shell/src/components/InteractiveShell.tsx` has `welcomeMessage` prop
- `editor-lib/src/commands/persona.ts`, `contact.ts`, `group.ts` all use `StoreCommandHandler`

Verify the 12a rename is complete — no stale references:
```sh
rg "SocialCommandHandler" packages editor-lib
```
Expected: no matches.

---

## Step 1 — Restructure `packages/cli-shell/src/index.ts` with API tier headers

The current `index.ts` exports ~45 symbols with no guidance. Add JSDoc section headers grouping exports into tiers. **No changes to the set of exported symbols** — only reordering and adding comments.

### Target layout:

```ts
// ─── Tier 1 — Primary API (what every app uses) ───────────────────────

// Entry point
export { startInteractiveCli, type CliEntryOptions } from './cli-entry';

// Config factory
export { createCliAppConfig } from '@devalbo/shared';

// Command authoring
export type { CommandHandler, AsyncCommandHandler, StoreCommandHandler } from './commands/_util';
export { makeOutput, makeError, makeResult, makeResultError } from './commands/_util';

// Built-in command groups
export { builtinCommands };  // aggregate — spread into your command registry
export { filesystemCommands } from './commands/filesystem';
export { systemCommands } from './commands/system';
export { appCommands } from './commands/app';

// Program helper — registers all built-in commands on a commander program
export { registerBuiltinCommands } from './program-helpers';

// Type for building command options
export type { ExtendedCommandOptions, ExtendedCommandOptionsWithStore } from './commands/_util';

// ─── Tier 2 — Browser / desktop integration ───────────────────────────

// Shell component (for custom React/Ink apps)
export { InteractiveShell } from './components/InteractiveShell';

// Console helpers (window.cli binding for browser devtools)
export {
  bindCliRuntimeSource,
  unbindCliRuntimeSource,
  cli,
  type CliRuntimeSource,
} from './web/console-helpers';

// Shell providers
export { BrowserShellProvider } from './components/BrowserShellProvider';
export { TerminalShellProvider } from './components/TerminalShellProvider';

// ─── Tier 3 — Advanced / internals ────────────────────────────────────

// Direct command execution (for custom shells or testing)
export {
  parseCommandLine,
  buildCommandOptions,
  executeCommand,
  executeCommandRaw,
  type CommandRuntimeContext,
} from './lib/command-runtime';

// Shell context hook
export { ShellContext, useShell } from './components/ShellContext';

// Status helper
export { getCliRuntimeStatus } from './web/console-helpers';

// Filesystem operations (used by filesystem commands; exposed for apps
// that need direct fs access without going through the shell)
export {
  buildTree, changeDir, copyPath, exportDirectoryAsBft, getDefaultCwd,
  importBftTextToLocation, importBftToLocation, joinFsPath, listDirectory,
  makeDirectory, movePath, readBytesFile, readTextFile, removePath,
  resolveFsPath, splitFsPath, statPath, touchFile, treeText,
  writeBytesFile, writeTextFile, type FsTreeNode,
} from './lib/filesystem-actions';

// File operation utilities
export { getDriver, getFilesystemBackendInfo, getWatcher } from './lib/file-operations';
```

**Action:** Reorder and add section headers in `packages/cli-shell/src/index.ts` to match the layout above. Keep the existing top-level `import` statements for the `builtinCommands` aggregate where they are (they must remain above the export). The actual set of exported symbols must not change — only the order and comments.

---

## Step 1b — Make `welcomeMessage` required + add `defaultWelcomeMessage` utility

Currently `welcomeMessage` is optional on both `InteractiveShell` and `CliEntryOptions`, with a config-derived default baked into `ShellContent`. Change it to required so every app explicitly provides its own welcome string. Also add a `defaultWelcomeMessage()` utility so apps have a clean way to generate a sensible default from their config.

### 1b-i. Add `defaultWelcomeMessage` utility

Add to `packages/cli-shell/src/program-helpers.ts` (alongside `registerBuiltinCommands`):

```ts
import type { AppConfig } from '@devalbo/shared';

/**
 * Generate a default welcome message from an AppConfig.
 *
 * Returns: `Welcome to ${appName}. Type "help" for available commands.`
 *
 * @example
 * ```ts
 * import { defaultWelcomeMessage, createCliAppConfig } from '@devalbo/cli-shell';
 *
 * const config = createCliAppConfig({ appId: 'my-app', appName: 'My App', storageKey: 'my-app' });
 * const msg = defaultWelcomeMessage(config); // 'Welcome to My App. Type "help" for available commands.'
 * ```
 */
export const defaultWelcomeMessage = (config: AppConfig): string => {
  const name = config.appName || config.appId || 'CLI shell';
  return `Welcome to ${name}. Type "help" for available commands.`;
};
```

Export from `packages/cli-shell/src/index.ts` (add to Tier 1, alongside `registerBuiltinCommands`):

```ts
export { registerBuiltinCommands, defaultWelcomeMessage } from './program-helpers';
```

### 1b-ii. Make `welcomeMessage` required on `InteractiveShell`

**`packages/cli-shell/src/components/InteractiveShell.tsx`**

In `ShellContent` props:
```diff
-  welcomeMessage?: string | ReactNode;
+  welcomeMessage: string | ReactNode;
```

In `InteractiveShell` component props:
```diff
-  welcomeMessage?: string | ReactNode;
+  welcomeMessage: string | ReactNode;
```

Remove the config-derived default logic (the `shellName` and `defaultWelcomeMessage` variables). The initial history simply uses the prop directly:
```ts
const [history, setHistory] = useState<CommandOutput[]>([
  {
    component: typeof welcomeMessage === 'string'
      ? <Text color="cyan">{welcomeMessage}</Text>
      : welcomeMessage
  }
]);
```

Remove the conditional spread for `welcomeMessage` in both `ShellContent` call sites — pass it directly since it's always present:
```diff
-          {...(welcomeMessage !== undefined ? { welcomeMessage } : {})}
+          welcomeMessage={welcomeMessage}
```

### 1b-iii. Make `welcomeMessage` required on `CliEntryOptions`

**`packages/cli-shell/src/cli-entry.tsx`**

Add `welcomeMessage` to `CliEntryOptions`:
```diff
 export type CliEntryOptions = {
   commands: Record<string, CommandHandler>;
   createProgram: () => Command;
   config: AppConfig;
+  welcomeMessage: string | ReactNode;
 };
```

Pass it through to `InteractiveShell`:
```diff
       <InteractiveShell
         runtime="terminal"
         commands={opts.commands}
         createProgram={opts.createProgram}
         store={store}
         config={opts.config}
         driver={driver}
         cwd={cwd}
         setCwd={setCwd}
+        welcomeMessage={opts.welcomeMessage}
       />
```

Add `ReactNode` import if not already present:
```ts
import type { ReactNode } from 'react';
```

### 1b-iv. Update callers

**`editor-lib/src/cli.tsx`** — already passes `welcomeMessage` (from 12a). No change needed.

**`editor-lib/src/web/App.tsx`** — already passes `welcomeMessage` (from 12a). No change needed.

**`naveditor-web/src/App.tsx`** and **`naveditor-desktop/src/App.tsx`** — these don't pass `welcomeMessage` yet. They now must. Add:
```tsx
welcomeMessage="Try: pwd, ls, export ., import snapshot.bft restore, backend"
```

### Verification

```sh
pnpm --filter @devalbo/cli-shell run type-check
pnpm --filter @devalbo/editor-lib run type-check
pnpm --filter naveditor-web run type-check
pnpm --filter naveditor-desktop run type-check
pnpm --filter naveditor test:unit
```

All should pass — every caller now provides `welcomeMessage`.

---

## Step 2 — Add JSDoc to Tier 1 and Tier 2 exports

Every symbol exported from Tiers 1 and 2 gets a JSDoc comment **at its definition site** (not in index.ts). Focus on:

- **What it is** (one line)
- **When you need it** (one line)
- **Example** (for key functions)

### Files to edit and their key symbols:

**`packages/cli-shell/src/cli-entry.tsx`** — `startInteractiveCli`, `CliEntryOptions`:
```ts
/**
 * Boot a CLI-only interactive shell with ink.
 *
 * Creates a store and filesystem driver, then renders InteractiveShell
 * in terminal mode. This is the primary entry point for CLI-only apps.
 *
 * @example
 * ```ts
 * import { startInteractiveCli, createCliAppConfig, builtinCommands } from '@devalbo/cli-shell';
 *
 * await startInteractiveCli({
 *   commands: { ...builtinCommands, hello, echo },
 *   createProgram,
 *   config: createCliAppConfig({ appId: 'my-app', appName: 'My App', storageKey: 'my-app' }),
 *   welcomeMessage: 'Welcome to My App. Type "help" for available commands.',
 * });
 * ```
 */
```

**`packages/cli-shell/src/commands/_util.tsx`** — `CommandHandler`, `AsyncCommandHandler`, `StoreCommandHandler`, `makeOutput`, `makeError`, `makeResult`, `makeResultError`, `ExtendedCommandOptions`, `ExtendedCommandOptionsWithStore`:
```ts
/** A function that handles a shell command. Union of AsyncCommandHandler and StoreCommandHandler. */
export type CommandHandler = ...

/** Async command handler — options.store is optional. Use for commands that don't require store access. */
export type AsyncCommandHandler = ...

/** Command handler that requires a store. options is non-optional and always includes store. */
export type StoreCommandHandler = ...

/** Create a successful command result with plain text output. */
export const makeOutput = ...

/** Create an error command result with red text. Sets result.error. */
export const makeError = ...

/** Create a successful command result with text output and structured data. */
export const makeResult = ...

/** Create an error command result with red text and structured data. */
export const makeResultError = ...
```

**`packages/cli-shell/src/commands/filesystem.ts`** — `filesystemCommands`:
```ts
/** Built-in filesystem commands: pwd, cd, ls, tree, stat, cat, touch, mkdir, cp, mv, rm. */
```

**`packages/cli-shell/src/commands/system.ts`** — `systemCommands`:
```ts
/** Built-in system commands: clear, backend, exit, help. */
```

**`packages/cli-shell/src/components/InteractiveShell.tsx`** — `InteractiveShell`:
```ts
/**
 * Ink-based interactive command shell component.
 *
 * Renders a command prompt with history, input, and output.
 * Use startInteractiveCli() for CLI-only apps; use this component
 * directly when embedding the shell in a custom React app (browser or desktop).
 *
 * @param commands - Record of command name → handler function
 * @param createProgram - Factory for the commander program (used by the help command)
 * @param config - AppConfig; used for app-config command and welcome message default
 * @param welcomeMessage - Welcome text or React node displayed when the shell starts (required)
 * @param session - Opaque session object (pass a SolidSession for Solid integration, or omit)
 */
```

**`packages/cli-shell/src/web/console-helpers.ts`** — `bindCliRuntimeSource`, `unbindCliRuntimeSource`, `cli`, `CliRuntimeSource`:
```ts
/** Bind a CliRuntimeSource so commands can execute in the browser devtools via window.cli. */
export function bindCliRuntimeSource ...

/** Remove the runtime source binding. Call on unmount. */
export function unbindCliRuntimeSource ...

/**
 * Browser devtools CLI object. After binding a runtime source, use cli.exec(),
 * cli.execRaw(), or convenience methods like cli.ls(), cli.pwd().
 */
export const cli = ...
```

**`packages/cli-shell/src/components/BrowserShellProvider.tsx`** — `BrowserShellProvider`:
```ts
/** Shell provider for browser environments. Wraps children with ink-web rendering context. */
```

**`packages/cli-shell/src/components/TerminalShellProvider.tsx`** — `TerminalShellProvider`:
```ts
/** Shell provider for Node.js terminal environments. Wraps children with ink rendering context. */
```

**`packages/cli-shell/src/program-helpers.ts`** — `registerBuiltinCommands`:

Already has JSDoc from Plan 12a. Verify it's present and accurate.

---

## Step 3 — Add `session` documentation to cli-shell types

The `session?: unknown | null` pattern needs JSDoc explanation at every touch point.

### In `packages/cli-shell/src/components/InteractiveShell.tsx` — `ShellContent` props:

```ts
/**
 * Optional session object for authenticated integrations.
 *
 * For Solid pod integration, pass the result of useSolidSession()
 * from @devalbo/solid-client. For CLI-only or non-Solid apps, omit this prop.
 *
 * The session is passed opaquely to command handlers via options.session.
 * Framework commands (filesystem, system) ignore it; only app-specific
 * commands that import SolidSession from @devalbo/solid-client use it.
 */
session?: unknown | null;
```

### In `packages/cli-shell/src/lib/command-runtime.ts` — `CommandRuntimeContext`:

```ts
/**
 * Opaque session object passed through to command options.
 * Typed as unknown in cli-shell to avoid a dependency on @devalbo/solid-client.
 * Commands that need a typed session should cast: `options.session as SolidSession`.
 */
session?: unknown | null;
```

---

## Step 4 — Create `examples/hello-cli/`

A minimal working CLI app that developers can copy and run.

### File structure

```
examples/hello-cli/
  package.json
  tsconfig.json
  src/
    commands/index.ts
    program.ts
    cli.ts
```

### `examples/hello-cli/package.json`

```json
{
  "name": "hello-cli",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node --import tsx src/cli.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@devalbo/cli-shell": "workspace:*",
    "commander": "catalog:",
    "react": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:"
  }
}
```

Note: `@devalbo/shared` is NOT a direct dependency — `createCliAppConfig` is re-exported from `@devalbo/cli-shell`.

Note: `pnpm start` requires a TTY terminal (interactive Ink shell). It will not work in CI or non-interactive shells. TODO: support a non-interactive mode (e.g. `pnpm start -- pwd` to run a single command and exit).

### `examples/hello-cli/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@devalbo/cli-shell": ["../../packages/cli-shell/src/index.ts"],
      "@devalbo/cli-shell/*": ["../../packages/cli-shell/src/*"],
      "@devalbo/shared": ["../../packages/shared/src/index.ts"],
      "@devalbo/state": ["../../packages/state/src/index.ts"],
      "@devalbo/filesystem": ["../../packages/filesystem/src/index.ts"],
      "@devalbo/filesystem/node": ["../../packages/filesystem/src/node.ts"],
      "@devalbo/commands": ["../../packages/commands/src/index.ts"],
      "@devalbo/ui": ["../../packages/ui/src/index.ts"]
    }
  },
  "include": ["src"]
}
```

The paths include transitive dependencies so TypeScript can resolve cli-shell's own imports.

### `examples/hello-cli/src/commands/index.ts`

```ts
import type { CommandHandler, AsyncCommandHandler } from '@devalbo/cli-shell';
import { builtinCommands, makeOutput } from '@devalbo/cli-shell';

const hello: AsyncCommandHandler = async (args) => {
  const name = args[0] ?? 'world';
  return makeOutput(`Hello, ${name}!`);
};

const echo: AsyncCommandHandler = async (args) => {
  return makeOutput(args.join(' '));
};

export const commands: Record<string, CommandHandler> = {
  ...builtinCommands,
  hello,
  echo,
};
```

### `examples/hello-cli/src/program.ts`

```ts
import { Command } from 'commander';
import { registerBuiltinCommands } from '@devalbo/cli-shell';

export const createProgram = (): Command => {
  const program = new Command('hello-cli')
    .description('A minimal devalbo CLI app')
    .version('0.1.0');

  // App-specific commands
  program.command('hello [name]').description('Say hello');
  program.command('echo <words...>').description('Echo arguments back');

  // All built-in commands (pwd, ls, cd, help, app-config, etc.)
  registerBuiltinCommands(program);

  return program;
};
```

### `examples/hello-cli/src/cli.ts`

```ts
import { startInteractiveCli, createCliAppConfig } from '@devalbo/cli-shell';
import { commands } from './commands/index';
import { createProgram } from './program';

await startInteractiveCli({
  commands,
  createProgram,
  config: createCliAppConfig({
    appId: 'hello-cli',
    appName: 'Hello CLI',
    storageKey: 'hello-cli-store',
  }),
  welcomeMessage: 'Welcome to Hello CLI. Type "help" for available commands.',
});
```

Note: `welcomeMessage` is required. Every app provides its own welcome string.

### Update `pnpm-workspace.yaml`

Add to workspace list:
```yaml
- 'examples/*'
```

---

## Step 5 — Review naveditor as an app built on the framework

naveditor is an app built on `@devalbo/cli-shell`, following the same patterns any developer would follow. Before writing `CREATE_AN_APP.md`, verify that naveditor's structure parallels what the docs will teach, and identify any gaps where naveditor hasn't caught up to the 12a API improvements.

### Structural parallel

| Doc example | naveditor | Role |
|---|---|---|
| `my-app-lib` | `editor-lib` | App library — commands, config, program definition |
| `my-app-cli` | `naveditor-terminal` | CLI entry point |
| `my-app-web` | `naveditor-web` | Browser entry point (Vite + React) |
| `my-app-desktop` | `naveditor-desktop` | Tauri entry point |

Both `naveditor-web` and `naveditor-desktop` are thin shells: their tsconfig maps `@/*` → `editor-lib/src/*`, so commands, config, and program all live in `editor-lib`.

### What to verify:

**5a. Command composition** — `editor-lib/src/commands/index.ts`

naveditor spreads `filesystemCommands`, `systemCommands`, `appCommands` individually alongside its own app-specific groups (`ioCommands`, `solidCommands`, `filesCommands`, `personaCommand`, `contactCommand`, `groupCommand`).

This is correct for naveditor — it needs individual groups because it has many of its own command groups to compose alongside. The simpler `builtinCommands` aggregate is for apps that just want all the builtins in one spread (like hello-cli). The docs should show both patterns.

**5b. Program definition** — `editor-lib/src/program.ts`

naveditor manually registers all 16 built-in commands plus its ~15 app-specific commands. It predates `registerBuiltinCommands`. All apps should use `registerBuiltinCommands(program)`. TODO: update `editor-lib/src/program.ts` to use `registerBuiltinCommands(program)` instead of manual registration.

**5c. Welcome message** — `editor-lib/src/cli.tsx` (line 19)

naveditor passes `welcomeMessage="Try: pwd, ls, export ., import snapshot.bft restore, backend"`. This is a normal use of the prop — the app overrides the config-derived default with its own hint text. The docs should show this as the customization pattern.

**5d. Config** — `editor-lib/src/web/config.ts`

naveditor builds its config manually because it needs custom sync timings and Solid features enabled. This mirrors what the docs will call `createSocialAppConfig()` for browser/desktop apps, or manual config for apps with non-default sync timings. The docs should show `createCliAppConfig()` for the quickstart (simplest case).

**5e. Store commands** — `editor-lib/src/commands/persona.ts`, `contact.ts`, `group.ts`

These use `StoreCommandHandler` — they require `options: ExtendedCommandOptionsWithStore`. This is normal for app commands that read/write the store. The docs should present `AsyncCommandHandler` first (simpler), then `StoreCommandHandler` for commands that need guaranteed store access.

**5f. Browser devtools CLI** — `editor-lib/src/web/App.tsx`

naveditor binds `window.cli` via `bindCliRuntimeSource` in a `useEffect`, using refs for stale-closure safety. This is the same pattern the docs should teach for browser apps.

**5g. Solid integration** — `editor-lib/src/commands/solid.ts`

naveditor casts `options.session` to `SolidSession` using a runtime type guard. This is the recommended pattern for any app opting into Solid — cli-shell keeps `session` as `unknown | null` to avoid the dependency.

### Verification checks

Run these to confirm naveditor uses the post-12a API correctly:

```sh
# StoreCommandHandler is used (not SocialCommandHandler)
rg "StoreCommandHandler" editor-lib/src/commands/
# Expected: hits in persona.ts, contact.ts, group.ts

# welcomeMessage is passed to InteractiveShell
rg "welcomeMessage" editor-lib/src/
# Expected: hits in cli.tsx and/or web/App.tsx

# bindCliRuntimeSource is wired up in the browser shell
rg "bindCliRuntimeSource" editor-lib/src/ naveditor-web/src/ naveditor-desktop/src/
# Expected: hits in web/App.tsx (all three)

# Imports come from @devalbo/cli-shell, not editor-lib internals
rg "from '@devalbo/cli-shell'" editor-lib/src/commands/index.ts editor-lib/src/cli.tsx
# Expected: hits in both files
```

### Outcome

No code changes from this step. The checks confirm naveditor uses the framework patterns correctly. The CREATE_AN_APP.md doc can confidently point to naveditor's files as examples of each pattern.

---

## Step 6 — Rewrite `CREATE_AN_APP.md`

Rewrite `CREATE_AN_APP.md` (root of repo) against the actual post-12a API. Every code snippet must compile. The document references `examples/hello-cli/` as the living example and `editor-lib/` (naveditor) as a real-world reference.

### Outline

The doc should call out naveditor as an app built on this framework throughout — not as a separate "reference" section, but as inline "naveditor does this too" pointers wherever a pattern is introduced. This helps developers see the patterns are real and battle-tested.

The structural parallel should be introduced early:

| Your app | naveditor equivalent |
|---|---|
| `my-app-lib/` | `editor-lib/` |
| `my-app-cli/` | `naveditor-terminal/` |
| `my-app-web/` | `naveditor-web/` |
| `my-app-desktop/` | `naveditor-desktop/` |

```
# Building an App with @devalbo/cli-shell

## Overview
What devalbo-core provides and who it's for.
naveditor is an app built on this framework — it follows the same patterns described here.

## Package Map
| Package | What it provides | Direct use? |
|---------|-----------------|-------------|
| @devalbo/cli-shell | Shell framework, built-in commands, entry points | Yes — primary dependency |
| @devalbo/shared | Core types (AppConfig, CommandResult, branded types) | Rarely — types re-exported through cli-shell |
| @devalbo/state | TinyBase store, schemas, persisters | Yes — if you define custom store schemas |
| @devalbo/filesystem | Filesystem driver abstraction | Transitively via cli-shell |
| @devalbo/commands | Command parser and validation | Transitively via cli-shell |
| @devalbo/ui | Ink primitives (TextInput, Spinner, etc.) | Yes — if you build custom Ink components |
| @devalbo/solid-client | Solid pod auth and sync | Yes — only if opting into Solid integration |

## App Structure
Every app has the same shape:
- An app library (commands, config, program definition)
- One or more entry points (CLI, browser, desktop)

Show the parallel: your my-app-lib is naveditor's editor-lib, your my-app-web
is naveditor's naveditor-web, etc.

## Quick Start: CLI-Only App (5 minutes)
Step-by-step from zero to running shell. Code must match examples/hello-cli/ exactly.
1. package.json — depends on @devalbo/cli-shell, commander, react
2. commands/index.ts — spread builtinCommands + custom commands
3. program.ts — registerBuiltinCommands(program) + app-specific commands
4. cli.ts — startInteractiveCli with createCliAppConfig
5. Run it

Key point: only ONE import source (@devalbo/cli-shell) for the quickstart.

## Writing Commands
- AsyncCommandHandler signature: (args: string[], options?) => Promise<CommandResult>
- Using makeOutput/makeError/makeResult/makeResultError for results
- Accessing cwd, driver, config, store from options
- Custom Ink component output (createElement pattern)
- Example: a custom command from scratch
- naveditor example: editor-lib/src/commands/io.ts (export/import commands)

## StoreCommandHandler (when commands need the store)
- StoreCommandHandler signature: options is required and always includes store
- When to use it vs AsyncCommandHandler
- Example: a command that reads/writes TinyBase rows
- naveditor example: editor-lib/src/commands/persona.ts

## Command Registry Pattern
- builtinCommands — spread all built-ins with one import (recommended for most apps)
- Individual groups (filesystemCommands, systemCommands, appCommands) for apps with many
  command groups of their own
- The Record<string, CommandHandler> pattern
- naveditor example: editor-lib/src/commands/index.ts (uses individual groups because it
  has 6+ app-specific command groups to compose)

## Program Definition (help text)
- How createProgram() defines the commander program for the help command
- registerBuiltinCommands(program) for the 16 built-in commands (recommended default for most apps)
- Manual registration is allowed when you need fine-grained built-in argument metadata control
- Registering app-specific commands manually
- naveditor example: editor-lib/src/program.ts (still uses manual registration — predates
  registerBuiltinCommands, TODO to update)

## Configuration
- createCliAppConfig({ appId, appName, storageKey }) — CLI-only, no Solid
- createSocialAppConfig(identity, { podNamespace, socialLocalPath }) — browser/desktop with Solid
- AppConfig shape and what each field controls
- The welcomeMessage prop (required): every app provides its own welcome string or ReactNode
- naveditor example: editor-lib/src/web/config.ts (manual AppConfig for custom sync timings);
  editor-lib/src/cli.tsx (custom welcomeMessage)

## Browser App
- Project structure (Vite + React)
- Using InteractiveShell component directly with InkTerminalBox
- Passing commands, createProgram, config, driver, cwd, setCwd, welcomeMessage
- bindCliRuntimeSource for window.cli devtools access (ref pattern)
- Vite alias configuration for workspace paths
- Include a concrete bindCliRuntimeSource + window.cli usage snippet:
  ```ts
  // In your App component's useEffect:
  bindCliRuntimeSource({
    getContext: () => ({
      commands, store, config: configRef.current,
      driver: driverRef.current, cwd: cwdRef.current, setCwd
    })
  });
  // Then in browser devtools:
  await cli.exec('hello', ['Alice'])   // run any registered command
  await cli.ls('/')                     // filesystem shortcut
  await cli.helpText()                  // get help output as string
  ```
- naveditor example: naveditor-web/src/App.tsx (renders InteractiveShell with Solid session,
  binds window.cli, manages store persistence)

## Desktop App (Tauri)
- Same as browser — createFilesystemDriver auto-selects Tauri backend
- Cross-origin headers for SQLite WASM (if using SQLite persister)
- naveditor example: naveditor-desktop/ (same structure as naveditor-web with Tauri additions)

## Solid Integration (Opt-In)
- Installing @devalbo/solid-client
- SolidSessionProvider wrapper
- Passing session to InteractiveShell
- Writing commands that use session (cast options.session as SolidSession)
- createSocialAppConfig instead of createCliAppConfig
- naveditor example: editor-lib/src/commands/solid.ts (runtime type guard for session cast)

## Store Customization
- Defining custom TinyBase schemas
- Accessing store from command options
- Persister selection (localStorage, SQLite, memory)
```

**Action:** Write the full `CREATE_AN_APP.md` following this outline. Every code snippet must compile against the actual post-12a exports. The quickstart code must be identical to `examples/hello-cli/`. naveditor is an app built on this framework — present it that way throughout, with inline pointers to its files wherever a pattern is introduced. All imports must be from `@devalbo/cli-shell`, not `@devalbo/editor-lib`.

---

## Step 7 — Architecture overview diagram

Create `docs/ARCHITECTURE.md` with a package dependency graph and one-paragraph descriptions.

### Content

```markdown
# Architecture Overview

## Package Dependency Graph

Arrows follow typical dependency direction: `A ──▶ B` means **A depends on B**.

```
@devalbo/cli-shell ──▶ @devalbo/commands
@devalbo/cli-shell ──▶ @devalbo/filesystem
@devalbo/cli-shell ──▶ @devalbo/shared
@devalbo/cli-shell ──▶ @devalbo/state
@devalbo/cli-shell ──▶ @devalbo/ui

@devalbo/state      ──▶ @devalbo/shared
@devalbo/filesystem ──▶ @devalbo/shared

# Optional (opt-in Solid integration):
your-app            ──▶ @devalbo/solid-client

# App layer example (naveditor):
editor-lib          ──▶ @devalbo/cli-shell
naveditor-web       ──▶ editor-lib
naveditor-desktop   ──▶ editor-lib
naveditor-terminal  ──▶ editor-lib
```
```

### Package Descriptions

Each package gets a one-paragraph description. Match the Package Map table from Step 6.

### Publishing to npm (future)

```markdown
## Publishing to npm (future)

All packages currently use `"private": true` and `workspace:*` dependencies.
To publish to npm:

1. Remove `"private": true` from packages intended for external use
2. Replace `workspace:*` with actual semver ranges
3. Use changesets or a similar versioning tool
4. Publish order (leaf → root): shared → state → commands → filesystem → ui → cli-shell
```

---

## Step 8 — Verify

Run all commands from the repo root:

```sh
# 1. Install (picks up new examples/hello-cli workspace)
pnpm install

# 2. Type-check cli-shell (includes JSDoc additions)
pnpm --filter @devalbo/cli-shell run type-check

# 3. Type-check editor-lib
pnpm --filter @devalbo/editor-lib run type-check

# 4. Type-check hello-cli example
pnpm --filter hello-cli run type-check

# 5. Type-check app packages
pnpm --filter naveditor-web run type-check
pnpm --filter naveditor-desktop run type-check

# 6. Run all unit tests
pnpm --filter naveditor test:unit

# 7. Run hello-cli (manual: verify shell starts, hello/echo/pwd/help work)
pnpm --filter hello-cli run start
```

Expected:
- Steps 1–6: all pass with zero errors
- Step 7: interactive shell starts, displays `Welcome to Hello CLI. Type "help" for available commands.`, `hello Alice` → `Hello, Alice!`, `help` shows all commands including builtins, `pwd`/`ls` work, `app-config` shows hello-cli config

---

## Acceptance criteria

- [ ] `packages/cli-shell/src/index.ts` has JSDoc section headers grouping exports into Primary / Browser-Desktop / Advanced tiers
- [ ] All Tier 1 and Tier 2 exports have JSDoc at their definition sites
- [ ] `session` fields have JSDoc explaining the opaque pattern
- [ ] `examples/hello-cli/` exists, is in the workspace, type-checks, runs, and demonstrates 2 custom commands + all builtins via `builtinCommands`
- [ ] `examples/hello-cli/` uses `registerBuiltinCommands(program)` — not manual registration
- [ ] `examples/hello-cli/` uses `createCliAppConfig()` — not manual config
- [ ] `packages/cli-shell/src/program-helpers.ts` exports `defaultWelcomeMessage(config: AppConfig): string`
- [ ] `packages/cli-shell/src/index.ts` re-exports `defaultWelcomeMessage` from `./program-helpers`
- [ ] `InteractiveShell` requires `welcomeMessage` (not optional) in `packages/cli-shell/src/components/InteractiveShell.tsx`
- [ ] `CliEntryOptions` requires `welcomeMessage` in `packages/cli-shell/src/cli-entry.tsx`
- [ ] `naveditor-web/src/App.tsx` passes `welcomeMessage` to `<InteractiveShell>`
- [ ] `naveditor-desktop/src/App.tsx` passes `welcomeMessage` to `<InteractiveShell>`
- [ ] `CREATE_AN_APP.md` is rewritten per the Step 6 outline
- [ ] `CREATE_AN_APP.md` quickstart code matches `examples/hello-cli/` exactly
- [ ] `CREATE_AN_APP.md` presents naveditor as an app built on the framework — inline "naveditor does this too" pointers, not a separate reference section
- [ ] `CREATE_AN_APP.md` documents `builtinCommands`, `registerBuiltinCommands`, `StoreCommandHandler`, `welcomeMessage`, `createCliAppConfig`
- [ ] `CREATE_AN_APP.md` code snippets use `@devalbo/cli-shell` as the primary import — NOT `@devalbo/editor-lib`
- [ ] `docs/ARCHITECTURE.md` exists with package graph, descriptions, and publishing note
- [ ] All type-checks and unit tests pass

---

## Resolved questions

1. **Primary import source** — All example code imports from `@devalbo/cli-shell`, never from `@devalbo/editor-lib`. The old CREATE_AN_APP.md incorrectly used `@devalbo/editor-lib` as the primary dependency; this is fixed.

2. **`builtinCommands` vs individual groups** — The quickstart uses `builtinCommands` (one import, one spread). The docs also show individual groups for apps that want a subset. naveditor uses the individual-groups pattern.

3. **`registerBuiltinCommands` guidance** — `registerBuiltinCommands(program)` is the default recommendation for most apps. Manual registration is allowed when built-in command metadata needs fine-grained control. naveditor still uses manual registration (predates the helper) — TODO to update it.

4. **Config factories** — `createCliAppConfig()` for CLI-only (zeroes Solid fields). `createSocialAppConfig()` for browser/desktop with Solid. Manual config only for custom sync timings.

5. **Welcome message** — `welcomeMessage` is required. Every app provides its own welcome string or ReactNode. `defaultWelcomeMessage(config)` is available when apps want a standard generated message.

6. **naveditor as an app on the framework** — The doc presents naveditor as an app built the same way any developer would build one. It shows the parallel (`editor-lib` = your app-lib, `naveditor-web` = your app-web, etc.) and points to specific naveditor files inline wherever a pattern is introduced — not in a separate "reference" section.

7. **`@devalbo/shared` as direct dependency** — Not needed for the hello-cli example. `createCliAppConfig` is re-exported from `@devalbo/cli-shell`. Only apps that need `unsafeAsByteCount`, `unsafeAsMilliseconds`, or the `AppConfig` type directly would add `@devalbo/shared`.

---

## Finalized Review Decisions

The following review outcomes are now final and should be treated as normative plan guidance:

1. `registerBuiltinCommands(program)` guidance:
   It is the default recommendation for most apps.
   Manual registration is allowed when fine-grained built-in command metadata control is needed.

2. `welcomeMessage` strategy:
   `welcomeMessage` is required on `InteractiveShell` and `CliEntryOptions`.
   Apps must provide their own welcome string/ReactNode.
   `defaultWelcomeMessage(config)` exists as a utility for apps that want a standard generated string.

3. Runtime expectation for hello example:
   `examples/hello-cli` is TTY-only (interactive Ink shell) and is not expected to run in non-interactive CI shells.

4. Rename verification:
   `rg "SocialCommandHandler" packages editor-lib` is required in preflight and must return zero matches.

5. Browser devtools guidance:
   `CREATE_AN_APP.md` must include a concrete `bindCliRuntimeSource` + `cli` usage snippet.

6. Architecture graph convention:
   Dependency arrows use `A -> B` meaning “A depends on B”.

7. Step 5 reproducibility:
   Step 5 must include concrete command checks (grep-based) and not rely only on narrative review.
