# Plan 12a: Prep Code Changes for CREATE_AN_APP Developer Experience

## Goal

Make four focused, code-only changes to `@devalbo/cli-shell` that simplify the developer-facing API before writing documentation and examples in Plan 13. Each change is mechanical, has no design ambiguity, and touches a small number of files.

**Prerequisite:** Plan 12 (cli-shell extraction) is complete — all type-checks pass, unit tests pass.

---

## Step 1 — Rename `SocialCommandHandler` → `StoreCommandHandler`

**Why:** "Social" is naveditor vocabulary. The type represents a command handler that requires a TinyBase store in its options — `StoreCommandHandler` is the generic framework name. No backwards-compatibility alias needed — this is a clean rename.

### 1a. Definition: `packages/cli-shell/src/commands/_util.tsx`

**Line 22** — rename the type alias:

```diff
-export type SocialCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
+export type StoreCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
```

**Line 23** — update the union:

```diff
-export type CommandHandler = AsyncCommandHandler | SocialCommandHandler;
+export type CommandHandler = AsyncCommandHandler | StoreCommandHandler;
```

### 1b. Re-export: `packages/cli-shell/src/index.ts`

**Line 8** — rename in the type export block:

```diff
 export type {
   AsyncCommandHandler,
-  SocialCommandHandler,
+  StoreCommandHandler,
   CommandHandler,
   ExtendedCommandOptions,
   ExtendedCommandOptionsWithStore
 } from './commands/_util';
```

### 1c. Consumers in `editor-lib/src/commands/`

All three files follow the same pattern — migrate to the new name. For each file, make two changes:

#### `editor-lib/src/commands/persona.ts`

**Line 19** — update import:
```diff
-import { makeResult, makeResultError, type SocialCommandHandler } from '@devalbo/cli-shell';
+import { makeResult, makeResultError, type StoreCommandHandler } from '@devalbo/cli-shell';
```

**Line 55** — update type annotation:
```diff
-export const personaSubcommands: Record<string, SocialCommandHandler> = {
+export const personaSubcommands: Record<string, StoreCommandHandler> = {
```

**Line 166** — update type annotation:
```diff
-export const personaCommand: SocialCommandHandler = async (args, options) => {
+export const personaCommand: StoreCommandHandler = async (args, options) => {
```

#### `editor-lib/src/commands/contact.ts`

**Line 22** — update import:
```diff
-import { makeResult, makeResultError, type SocialCommandHandler } from '@devalbo/cli-shell';
+import { makeResult, makeResultError, type StoreCommandHandler } from '@devalbo/cli-shell';
```

**Line 57** — update type annotation:
```diff
-export const contactSubcommands: Record<string, SocialCommandHandler> = {
+export const contactSubcommands: Record<string, StoreCommandHandler> = {
```

**Line 186** — update type annotation:
```diff
-export const contactCommand: SocialCommandHandler = async (args, options) => {
+export const contactCommand: StoreCommandHandler = async (args, options) => {
```

#### `editor-lib/src/commands/group.ts`

**Line 25** — update import:
```diff
-import { makeResult, makeResultError, type SocialCommandHandler } from '@devalbo/cli-shell';
+import { makeResult, makeResultError, type StoreCommandHandler } from '@devalbo/cli-shell';
```

**Line 57** — update type annotation:
```diff
-export const groupSubcommands: Record<string, SocialCommandHandler> = {
+export const groupSubcommands: Record<string, StoreCommandHandler> = {
```

**Line 196** — update type annotation:
```diff
-export const groupCommand: SocialCommandHandler = async (args, options) => {
+export const groupCommand: StoreCommandHandler = async (args, options) => {
```

### Verification

No tests reference `SocialCommandHandler` (confirmed by search). After these changes:
- `pnpm --filter @devalbo/cli-shell run type-check` should pass
- `pnpm --filter naveditor test:unit` should pass (137/137)

---

## Step 2 — Make `InteractiveShell` welcome message configurable

**Why:** The hardcoded `"Welcome to naveditor"` and `"Try: pwd, ls, export ..."` in InteractiveShell leaks naveditor branding into the framework package. External app authors need their own welcome message.

### 2a. Add `welcomeMessage` prop to `ShellContent` and `InteractiveShell`

**File:** `packages/cli-shell/src/components/InteractiveShell.tsx`

Add `welcomeMessage` to the `ShellContent` function signature and its type (lines 23–43). Add it as an optional prop alongside the existing props:

```diff
 function ShellContent({
   commands,
   createProgram,
   runtime,
   store,
   config,
   driver,
   cwd,
   setCwd,
-  session
+  session,
+  welcomeMessage
 }: {
   commands: Record<string, CommandHandler>;
   createProgram?: () => import('commander').Command;
   runtime: 'browser' | 'terminal';
   store: DevalboStore;
   config?: AppConfig;
   driver?: IFilesystemDriver | null;
   cwd: string;
   setCwd: (next: string) => void;
   session?: unknown | null;
+  welcomeMessage?: string | ReactNode;
 }) {
```

Make the `command` field in `CommandOutput` optional so the welcome row doesn't render a blank dimmed line:

```diff
 interface CommandOutput {
-  command: string;
+  command?: string;
   component?: ReactNode;
 }
```

Update the render loop to skip the dimmed label when `command` is absent:

```diff
       {history.map((item, idx) => (
         <Box key={idx} flexDirection="column" marginBottom={1}>
-          <Text dimColor>{item.command}</Text>
+          {item.command ? <Text dimColor>{item.command}</Text> : null}
           {item.component && <Box marginLeft={2}>{item.component}</Box>}
         </Box>
       ))}
```

Define a default message using explicit variables (no inline fallback logic in the template string), then use it in the initial history state:

```diff
  const shellName = config?.appName ?? config?.appId ?? 'CLI shell';
  const defaultWelcomeMessage = `Welcome to ${shellName}. Type "help" for available commands.`;

  const [history, setHistory] = useState<CommandOutput[]>([
     {
-      command: 'Welcome to naveditor',
-      component: <Text color="cyan">Try: pwd, ls, export ., import snapshot.bft restore, backend</Text>
+      component: typeof welcomeMessage === 'string'
+        ? <Text color="cyan">{welcomeMessage}</Text>
+        : welcomeMessage ?? <Text color="cyan">{defaultWelcomeMessage}</Text>
     }
   ]);
```

Add `welcomeMessage` to the outer `InteractiveShell` component's props (line 109–118):

```diff
 export const InteractiveShell: React.FC<{
   commands: Record<string, CommandHandler>;
   createProgram?: () => import('commander').Command;
   runtime?: 'browser' | 'terminal';
   store?: DevalboStore;
   config?: AppConfig;
   driver?: IFilesystemDriver | null;
   cwd?: string;
   setCwd?: (next: string) => void;
   session?: unknown | null;
+  welcomeMessage?: string | ReactNode;
 }> = ({
   commands,
   createProgram,
   runtime = 'browser',
   store,
   config,
   driver = null,
   cwd,
   setCwd,
-  session
+  session,
+  welcomeMessage
 }) => {
```

Pass `welcomeMessage` through to both `<ShellContent>` render branches (terminal at ~line 142, browser at ~line 159). Add it alongside the other spread props:

```diff
         <ShellContent
           commands={commands}
           {...(createProgram ? { createProgram } : {})}
           runtime="terminal"
           store={shellStore}
           {...(config ? { config } : {})}
           driver={driver}
           cwd={resolvedCwd}
           setCwd={resolvedSetCwd}
           {...(session !== undefined ? { session } : {})}
+          welcomeMessage={welcomeMessage}
         />
```

Do the same for the browser branch.

### 2b. Update editor-lib callers to preserve naveditor-specific message

#### `editor-lib/src/cli.tsx`

Add the `welcomeMessage` prop to `<InteractiveShell>` (line 11):

```diff
     <InteractiveShell
       runtime="terminal"
       commands={commands}
       createProgram={createProgram}
       store={store}
       driver={null}
       cwd={cwd}
       setCwd={setCwd}
+      welcomeMessage="Try: pwd, ls, export ., import snapshot.bft restore, backend"
     />
```

#### `editor-lib/src/web/App.tsx`

Add the `welcomeMessage` prop to `<InteractiveShell>` (around line 122):

```diff
              <InteractiveShell
                commands={commands}
                createProgram={createProgram}
                session={session}
                store={store}
                config={config}
                driver={driver}
                cwd={cwd}
                setCwd={setCwd}
+               welcomeMessage="Try: pwd, ls, export ., import snapshot.bft restore, backend"
               />
```

#### `packages/cli-shell/src/cli-entry.tsx`

Do NOT add `welcomeMessage` here. The generic default (`Type "help" for available commands.`) is correct for the framework's own entry point.

#### `naveditor-web/src/App.tsx` and `naveditor-desktop/src/App.tsx`

These are naveditor app shells that independently render `<InteractiveShell>` — they import everything through `@/*` which maps to `editor-lib/src/*`. They are near-duplicates of each other and of `editor-lib/src/web/App.tsx`. **Do not touch them in this plan.** They will pick up the generic default, which is fine. Consolidating the duplication between these app shells is a separate concern.

### Verification

- editor-lib CLI and editor-lib web shells display the naveditor-specific welcome message.
- `startInteractiveCli()` displays the generic `Type "help" for available commands.`.
- naveditor-web and naveditor-desktop display the generic default (acceptable — they're app shell duplicates that can be updated independently).
- No tests reference the welcome message text, so all 137 tests should still pass.

---

## Step 3 — Add `builtinCommands` aggregate export

**Why:** Right now building a command registry requires three imports and three spreads:

```ts
import { filesystemCommands, systemCommands, appCommands } from '@devalbo/cli-shell';
const commands = { ...filesystemCommands, ...systemCommands, ...appCommands, hello, echo };
```

A single `builtinCommands` export reduces this to:

```ts
import { builtinCommands } from '@devalbo/cli-shell';
const commands = { ...builtinCommands, hello, echo };
```

### 3a. Add aggregate in `packages/cli-shell/src/index.ts`

Add this after the individual command group exports (after the current line 17):

```ts
import { filesystemCommands as _fs } from './commands/filesystem';
import { systemCommands as _sys } from './commands/system';
import { appCommands as _app } from './commands/app';

/** All built-in commands combined: filesystem (pwd, cd, ls, ...) + system (clear, backend, exit, help) + app (app-config). */
export const builtinCommands = { ..._fs, ..._sys, ..._app } as const;
```

Keep the individual `filesystemCommands`, `systemCommands`, and `appCommands` exports for apps that want only a subset.

### Verification

- Type-check should pass. `builtinCommands` is a `Record` of command names → `AsyncCommandHandler`.
- No existing code changes — this is purely additive.

---

## Step 4 — Add `registerBuiltinCommands` helper

**Why:** Every app needs a `createProgram()` function that registers command metadata with commander for the `help` command. Without this helper, app authors must manually register all 16 built-in commands. `registerBuiltinCommands(program)` eliminates that boilerplate.

### 4a. Create `packages/cli-shell/src/program-helpers.ts`

```ts
import type { Command } from 'commander';

/**
 * Register all built-in cli-shell commands on a commander program.
 *
 * Call this after registering your own app-specific commands so that
 * `help` displays everything. Built-in commands include filesystem
 * operations, system commands, and app-config.
 *
 * @example
 * ```ts
 * import { Command } from 'commander';
 * import { registerBuiltinCommands } from '@devalbo/cli-shell';
 *
 * const program = new Command('my-app');
 * program.command('hello [name]').description('Say hello');
 * registerBuiltinCommands(program);
 * ```
 */
export const registerBuiltinCommands = (program: Command): void => {
  // Filesystem
  program.command('pwd').description('Print working directory');
  program.command('cd <path>').description('Change directory');
  program.command('ls [path]').description('List directory contents');
  program.command('tree [path]').description('Show directory tree');
  program.command('cat <file>').description('Display file contents');
  program.command('touch <file>').description('Create empty file');
  program.command('mkdir <dir>').description('Create directory');
  program.command('cp <src> <dest>').description('Copy file or directory');
  program.command('mv <src> <dest>').description('Move/rename file or directory');
  program.command('rm <path>').description('Remove file or directory');
  program.command('stat <path>').description('Show file/directory info');

  // System
  program.command('clear').description('Clear terminal');
  program.command('backend').description('Show filesystem backend info');
  program.command('exit').description('Exit the shell');
  program.command('help').description('Show available commands');

  // App
  program.command('app-config').description('Show current app configuration');
};
```

### 4b. Export from `packages/cli-shell/src/index.ts`

Add this export alongside the other exports (a good location is after the command group exports or near `startInteractiveCli`):

```ts
export { registerBuiltinCommands } from './program-helpers';
```

### Maintenance constraint

`registerBuiltinCommands` hardcodes the command names, argument forms, and descriptions. If a command is added, removed, or its signature changes in `filesystemCommands`, `systemCommands`, or `appCommands`, this function must be updated manually to match. A future improvement could generate the program registrations from the command records, but for now this is an acceptable trade-off — the command surface is stable and the duplication is in one file.

### Verification

- Type-check should pass. `commander` is already a dependency of cli-shell.
- No existing code changes — this is purely additive.

---

## Summary of all files touched

| File | Change |
|------|--------|
| `packages/cli-shell/src/commands/_util.tsx` | Rename `SocialCommandHandler` → `StoreCommandHandler` (2 lines) |
| `packages/cli-shell/src/index.ts` | Rename export, add `builtinCommands` aggregate, add `registerBuiltinCommands` export |
| `packages/cli-shell/src/components/InteractiveShell.tsx` | Add `welcomeMessage` prop to `ShellContent` + `InteractiveShell`, update initial history |
| `packages/cli-shell/src/program-helpers.ts` | **New file** — `registerBuiltinCommands` helper |
| `editor-lib/src/commands/persona.ts` | `SocialCommandHandler` → `StoreCommandHandler` (3 occurrences) |
| `editor-lib/src/commands/contact.ts` | `SocialCommandHandler` → `StoreCommandHandler` (3 occurrences) |
| `editor-lib/src/commands/group.ts` | `SocialCommandHandler` → `StoreCommandHandler` (3 occurrences) |
| `editor-lib/src/cli.tsx` | Add `welcomeMessage` prop to `<InteractiveShell>` |
| `editor-lib/src/web/App.tsx` | Add `welcomeMessage` prop to `<InteractiveShell>` |

**Not touched:**
- `packages/cli-shell/src/cli-entry.tsx` — intentionally uses the generic default.
- `naveditor-web/src/App.tsx`, `naveditor-desktop/src/App.tsx` — naveditor app shell duplicates; not in scope for this plan.

---

## Final verification

Run from the repo root:

```sh
# Type-check the modified packages
pnpm --filter @devalbo/cli-shell run type-check
pnpm --filter @devalbo/editor-lib run type-check

# Type-check the app packages that depend on editor-lib
pnpm --filter naveditor-web run type-check
pnpm --filter naveditor-desktop run type-check

# Run all unit tests (should be 137/137)
pnpm --filter naveditor test:unit
```

All should pass with zero errors. No behavioral changes — only renamed types, a configurable default message, and two new additive exports.
