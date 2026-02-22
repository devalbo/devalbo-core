# Plan 12: Separate `packages/cli-shell` from `editor-lib`

## Goal

Extract portable shell infrastructure from `editor-lib` into a new `packages/cli-shell` package so external app authors can build CLI and browser shell apps without pulling in naveditor-specific code.

| Package | Location | npm name | Purpose |
|---------|----------|----------|---------|
| `cli-shell` | `packages/cli-shell/` | `@devalbo/cli-shell` | Portable framework: shell UI, command runtime, filesystem commands, `startInteractiveCli` |
| `editor-lib` | `editor-lib/` | `@devalbo/editor-lib` | naveditor app library: editor, navigator, social panels, app scaffolding |

After this plan, `@devalbo/cli-shell` has zero dependency on `@devalbo/solid-client` and no naveditor-specific code.

---

## What moves to `packages/cli-shell`

| Source (`editor-lib/src/`) | Notes |
|---|---|
| `components/InteractiveShell.tsx` | Modified: remove `useSolidSession`, add `commands`/`session`/`createProgram` props |
| `components/BrowserShellProvider.tsx` | Unchanged |
| `components/ShellContext.tsx` | Unchanged |
| `components/TerminalShellProvider.tsx` | Unchanged |
| `components/ui/gradient.tsx` | Unchanged |
| `components/ui/spinner.tsx` | Unchanged |
| `components/ui/text-input.tsx` | Unchanged |
| `commands/_util.tsx` | Modified: `SolidSession` → `unknown`, drop `ExtendedCommandOptionsWithSession` |
| `commands/filesystem.ts` | Modified: import from `filesystem-args.parser` |
| `commands/system.ts` | Modified: remove static `createProgram` import, read from `options` |
| `commands/app.ts` | Unchanged |
| `commands/with-validation.ts` | Unchanged |
| `lib/command-runtime.ts` | Modified: add `commands` field, remove `SolidSession`, remove static imports |
| `lib/file-operations.ts` | Unchanged |
| `lib/filesystem-actions.ts` | Modified: `PathTokenSchema` import path change |
| `lib/bft-transfer.ts` | Unchanged (required by `filesystem-actions.ts`) |
| `lib/utils.ts` | Unchanged |
| `lib/validate-args.ts` | Unchanged |
| `lib/validate-args.node.ts` | Unchanged |
| `web/console-helpers.ts` | Modified: remove `CommandName` import and cast |

New files created inside cli-shell:

| File | Source |
|---|---|
| `lib/filesystem-args.schema.ts` | Extracted filesystem schemas from `editor-lib/src/lib/command-args.schema.ts` |
| `lib/filesystem-args.parser.ts` | Extracted filesystem parsers from `editor-lib/src/lib/command-args.parser.ts` |
| `cli-entry.ts` | New — `startInteractiveCli` entry point |
| `index.ts` | New — public API |

---

## What stays in `editor-lib`

Everything not listed above, including:

- `cli.tsx`, `cli-node.tsx` — naveditor CLI entry points (updated to use cli-shell imports)
- `program.ts` — naveditor commander program
- `commands/index.ts` — full naveditor command registry (updated imports)
- `commands/solid.ts`, `persona.ts`, `contact.ts`, `group.ts`, `files.ts`, `io.ts`
- `lib/pod-sync.ts`, `social-args.parser.ts`, `social-args.schema.ts`, `mime.ts`
- `lib/command-args.parser.ts` — **reduced**: only io/social parsers remain
- `lib/command-args.schema.ts` — **reduced**: only io/social schemas remain
- All `components/editor/`, `components/navigator/`, `components/social/`
- All `hooks/`
- `web/App.tsx`, `FileExplorer.tsx`, `SyncRootsPanel.tsx`, `index.tsx`, `config.ts`

---

## Linearized execution steps

All steps assume the working directory is the repo root (`demo-v2-codex/`). All commands use absolute paths or `pnpm --filter` to avoid `cd` chain errors.

### Step 0 — Preflight

Confirm the working tree compiles and tests pass before starting. The repo has in-progress migration changes on the `v2` branch — a dirty tree is expected.

```sh
git status
pnpm install
pnpm --filter naveditor test:unit
```

Proceed if the dirty state matches the expected migration baseline (unstaged changes in `editor-lib/`, social packages, etc.). If tests fail, resolve them first. This plan is written against the current `editor-lib/src/` directory structure.

---

### Step 1 — Add `AppConfig` factory functions to `@devalbo/shared`

**Files:**
- `packages/shared/src/app-config.ts` — add factories
- `packages/shared/src/index.ts` — add export

**What to do:**

Add to end of `packages/shared/src/app-config.ts`:

```ts
type AppIdentity = {
  appId: string;
  appName: string;
  storageKey: string;
};

/** CLI-only app: all sync and social features disabled. */
export const createCliAppConfig = (identity: AppIdentity): AppConfig => ({
  ...identity,
  podNamespace: '',
  socialLocalPath: '',
  sync: {
    social: { pollIntervalMs: 0 as Milliseconds, outboundDebounceMs: 0 as Milliseconds },
    files:  { pollIntervalMs: 0 as Milliseconds, outboundDebounceMs: 0 as Milliseconds, maxFileSizeBytes: 0 as ByteCount },
  },
  features: { socialSync: false, fileSync: false, fileSharing: false },
});

/** Browser or desktop app with full Solid sync enabled. */
export const createSocialAppConfig = (
  identity: AppIdentity,
  opts: { podNamespace: string; socialLocalPath: string }
): AppConfig => ({
  ...identity,
  podNamespace: opts.podNamespace,
  socialLocalPath: opts.socialLocalPath,
  sync: {
    social: { pollIntervalMs: 30_000 as Milliseconds, outboundDebounceMs: 2_000 as Milliseconds },
    files:  { pollIntervalMs: 60_000 as Milliseconds, outboundDebounceMs: 5_000 as Milliseconds, maxFileSizeBytes: 10_485_760 as ByteCount },
  },
  features: { socialSync: true, fileSync: true, fileSharing: true },
});
```

Add to `packages/shared/src/index.ts`:
```ts
export { createCliAppConfig, createSocialAppConfig } from './app-config';
```

**Expected outcome:** `@devalbo/shared` exports two new factory functions. Existing code unaffected.

**Verify:** `pnpm --filter @devalbo/shared type-check`

---

### Step 2 — Create `packages/cli-shell` scaffold

**Files to create:**
- `packages/cli-shell/package.json`
- `packages/cli-shell/tsconfig.json`

**`packages/cli-shell/package.json`:**
```json
{
  "name": "@devalbo/cli-shell",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@devalbo/commands": "workspace:*",
    "@devalbo/filesystem": "workspace:*",
    "@devalbo/shared": "workspace:*",
    "@devalbo/state": "workspace:*",
    "@devalbo/ui": "workspace:*",
    "@optique/core": "^0.10.3",
    "commander": "catalog:",
    "ink": "catalog:",
    "ink-web": "catalog:",
    "react": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "typescript": "catalog:"
  }
}
```

Note: `@devalbo/solid-client` is deliberately NOT listed. `@optique/core` IS listed (needed by filesystem-args.parser.ts).

**`packages/cli-shell/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@devalbo/commands": ["../commands/src/index.ts"],
      "@devalbo/filesystem": ["../filesystem/src/index.ts"],
      "@devalbo/filesystem/node": ["../filesystem/src/node.ts"],
      "@devalbo/shared": ["../shared/src/index.ts"],
      "@devalbo/state": ["../state/src/index.ts"],
      "@devalbo/ui": ["../ui/src/index.ts"]
    }
  },
  "include": ["src"]
}
```

**Expected outcome:** Empty package that can be discovered by pnpm workspace (`packages/*` glob).

---

### Step 3 — Copy unchanged files to cli-shell

**What to do:** Copy these files from `editor-lib/src/` to `packages/cli-shell/src/`, preserving directory structure. No modifications needed for these files.

```
components/BrowserShellProvider.tsx
components/ShellContext.tsx
components/TerminalShellProvider.tsx
components/ui/gradient.tsx
components/ui/spinner.tsx
components/ui/text-input.tsx
commands/app.ts
commands/with-validation.ts
lib/file-operations.ts
lib/bft-transfer.ts
lib/utils.ts
lib/validate-args.ts
lib/validate-args.node.ts
```

**Expected outcome:** 13 files copied verbatim. cli-shell won't compile yet (missing modified files + index.ts).

---

### Step 4 — Copy and modify `commands/_util.tsx`

**Source:** `editor-lib/src/commands/_util.tsx`
**Destination:** `packages/cli-shell/src/commands/_util.tsx`

**Modifications to apply in the cli-shell copy:**

1. Remove `import type { SolidSession } from '@devalbo/solid-client';` (line 3)
2. Change `session?: SolidSession | null` to `session?: unknown | null` in `CommandOptionsBase` (line 12)
3. Remove `ExtendedCommandOptionsWithSession` type entirely (lines 20-23) — it is unused in the codebase
4. Add to `CommandOptionsBase`:
   ```ts
   createProgram?: () => import('commander').Command;
   ```

The resulting file should have:
```tsx
import { Box, Text } from 'ink';
import type { AppConfig, CommandOptions, CommandResult, IConnectivityService } from '@devalbo/shared';
import type { Store } from 'tinybase';
import type { IFilesystemDriver } from '@devalbo/filesystem';

type CommandOptionsBase = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
  session?: unknown | null;
  config?: AppConfig;
  driver?: IFilesystemDriver;
  connectivity?: IConnectivityService;
  createProgram?: () => import('commander').Command;
};

export type ExtendedCommandOptions = CommandOptionsBase | (CommandOptionsBase & { store: Store });
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: Store };

export type AsyncCommandHandler = (args: string[], options?: ExtendedCommandOptions) => Promise<CommandResult>;
export type SocialCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
export type CommandHandler = AsyncCommandHandler | SocialCommandHandler;

export const makeOutput = (text: string): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text>{text}</Text>
    </Box>
  )
});

export const makeError = (message: string): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text color="red">{message}</Text>
    </Box>
  ),
  error: message
});

export const makeResult = (text: string, data: unknown): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text>{text}</Text>
    </Box>
  ),
  data,
  status: 'ok'
});

export const makeResultError = (message: string, data?: unknown): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text color="red">{message}</Text>
    </Box>
  ),
  error: message,
  data,
  status: 'error'
});
```

**Expected outcome:** `_util.tsx` in cli-shell has no reference to `SolidSession` or `@devalbo/solid-client`.

---

### Step 5 — Copy and modify `lib/command-runtime.ts`

**Source:** `editor-lib/src/lib/command-runtime.ts`
**Destination:** `packages/cli-shell/src/lib/command-runtime.ts`

**Modifications:**

1. Remove `import type { SolidSession } from '@devalbo/solid-client';` (line 4)
2. Remove `import { commands, type CommandName } from '@/commands';` (line 6)
3. Add `commands` and `createProgram` fields to `CommandRuntimeContext`:
   ```ts
   export type CommandRuntimeContext = {
     commands: Record<string, import('../commands/_util').CommandHandler>;
     store: DevalboStore;
     session?: unknown | null;
     config?: AppConfig;
     driver?: IFilesystemDriver | null;
     connectivity?: IConnectivityService;
     cwd: string;
     setCwd: (next: string) => void;
     createProgram?: () => import('commander').Command;
     clearScreen?: () => void;
     exit?: () => void;
   };
   ```
4. Change `executeCommand` parameter from `commandName: CommandName` to `commandName: string`
5. Change command lookup from `commands[commandName]` to `ctx.commands[commandName]`
6. In `buildCommandOptions`, add `createProgram`:
   ```ts
   ...(ctx.createProgram ? { createProgram: ctx.createProgram } : {})
   ```
7. In `executeCommandRaw`, remove `as CommandName` cast (line 64)

The resulting file should be:
```ts
import { parseCommand } from '@devalbo/commands';
import type { AppConfig, CommandResult, IConnectivityService } from '@devalbo/shared';
import type { DevalboStore } from '@devalbo/state';
import type { IFilesystemDriver } from '@devalbo/filesystem';
import { makeError, makeOutput, type CommandHandler, type ExtendedCommandOptions } from '@/commands/_util';

export type CommandRuntimeContext = {
  commands: Record<string, CommandHandler>;
  store: DevalboStore;
  session?: unknown | null;
  config?: AppConfig;
  driver?: IFilesystemDriver | null;
  connectivity?: IConnectivityService;
  cwd: string;
  setCwd: (next: string) => void;
  createProgram?: () => import('commander').Command;
  clearScreen?: () => void;
  exit?: () => void;
};

export const parseCommandLine = (raw: string): { commandName: string; args: string[] } => {
  const { name, args } = parseCommand(raw);
  return { commandName: name, args };
};

const notReady = (): CommandResult => makeError('CLI not ready');

export const buildCommandOptions = (ctx: CommandRuntimeContext): ExtendedCommandOptions => ({
  store: ctx.store,
  cwd: ctx.cwd,
  setCwd: ctx.setCwd,
  ...(ctx.session !== undefined ? { session: ctx.session } : {}),
  ...(ctx.config !== undefined ? { config: ctx.config } : {}),
  ...(ctx.driver ? { driver: ctx.driver } : {}),
  ...(ctx.connectivity ? { connectivity: ctx.connectivity } : {}),
  ...(ctx.clearScreen ? { clearScreen: ctx.clearScreen } : {}),
  ...(ctx.exit ? { exit: ctx.exit } : {}),
  ...(ctx.createProgram ? { createProgram: ctx.createProgram } : {})
});

export const executeCommand = async (
  commandName: string,
  args: string[],
  ctx: CommandRuntimeContext | null
): Promise<CommandResult> => {
  if (!ctx) return notReady();
  const command = ctx.commands[commandName];
  if (!command) {
    return makeError(`Command not found: ${commandName}`);
  }

  try {
    return await command(args, buildCommandOptions(ctx) as ExtendedCommandOptions & { store: DevalboStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return makeError(message);
  }
};

export const executeCommandRaw = async (raw: string, ctx: CommandRuntimeContext | null): Promise<CommandResult> => {
  if (!ctx) return notReady();
  const { commandName, args } = parseCommandLine(raw);
  if (!commandName) return makeOutput('');

  return executeCommand(commandName, args, ctx);
};
```

**Expected outcome:** `command-runtime.ts` in cli-shell resolves commands from `ctx.commands` (injected at runtime) instead of a static import. No reference to `SolidSession`, `CommandName`, or `@/commands`.

---

### Step 6 — Copy and modify `commands/system.ts`

**Source:** `editor-lib/src/commands/system.ts`
**Destination:** `packages/cli-shell/src/commands/system.ts`

**Modifications:**

1. Remove `import { createProgram } from '@/program';` (line 1)
2. Change `help` handler to read `options?.createProgram` instead of calling the static import:

```ts
import { getFilesystemBackendInfo } from '@/lib/file-operations';
import type { AsyncCommandHandler } from './_util';
import { makeError, makeOutput } from './_util';

export const systemCommands: Record<'clear' | 'backend' | 'exit' | 'help', AsyncCommandHandler> = {
  clear: async (_args, options) => {
    options?.clearScreen?.();
    return makeOutput('');
  },
  backend: async () => {
    const info = await getFilesystemBackendInfo();
    const lines = [`Platform: ${info.platform}`, `Adapter: ${info.adapter}`];
    if (info.persistence) lines.push(`Persistence: ${info.persistence}`);
    if (info.baseDir) lines.push(`Base directory: ${info.baseDir}`);
    return makeOutput(lines.join('\n'));
  },
  exit: async (_args, options) => {
    if (!options?.exit) return makeError('exit is only available in terminal interactive mode');
    options.exit();
    return makeOutput('Exiting...');
  },
  help: async (_args, options) => {
    if (!options?.createProgram) {
      return makeOutput('No program registered. Pass createProgram when setting up the shell.');
    }
    const program = options.createProgram();
    const lines: string[] = [];
    lines.push(`Usage: ${program.name()} [options] [command]`);
    lines.push('');
    lines.push(program.description());
    lines.push('');
    lines.push('Commands:');
    for (const cmd of program.commands) {
      const args = cmd.registeredArguments?.map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`)).join(' ') ?? '';
      lines.push(`  ${(cmd.name() + ' ' + args).trim().padEnd(20)} ${cmd.description()}`);
    }
    return makeOutput(lines.join('\n'));
  }
};
```

**Expected outcome:** `system.ts` has no import from `@/program`. The `help` command reads `createProgram` from the options object at runtime.

---

### Step 7 — Copy and modify `components/InteractiveShell.tsx`

**Source:** `editor-lib/src/components/InteractiveShell.tsx`
**Destination:** `packages/cli-shell/src/components/InteractiveShell.tsx`

**Modifications:**

1. Remove `import { useSolidSession } from '@devalbo/solid-client';` (line 14)
2. Add imports for `CommandHandler`:
   ```ts
   import type { CommandHandler } from '@/commands/_util';
   ```
3. Add `commands`, `createProgram`, `session` to `ShellContent` props:
   ```ts
   function ShellContent({
     commands,
     createProgram,
     runtime,
     store,
     config,
     driver,
     cwd,
     setCwd,
     session
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
   })
   ```
4. Remove `const session = useSolidSession();` (line 38) — now received as prop
5. Add `commands` and `createProgram` to the `executeCommandRaw` context object:
   ```ts
   const result = await executeCommandRaw(raw, {
     commands,
     createProgram,
     store,
     cwd,
     setCwd,
     ...(session !== undefined ? { session } : {}),
     // ... rest unchanged
   });
   ```
6. Add `commands`, `createProgram`, `session` to `InteractiveShell` props interface:
   ```ts
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
   }>
   ```
7. Pass `commands`, `createProgram`, `session` through to `ShellContent`:
   ```tsx
   <ShellContent
     commands={commands}
     createProgram={createProgram}
     runtime="terminal"
     store={shellStore}
     {...(config ? { config } : {})}
     driver={driver}
     cwd={resolvedCwd}
     setCwd={resolvedSetCwd}
     session={session}
   />
   ```

**Expected outcome:** `InteractiveShell` has no reference to `useSolidSession` or `@devalbo/solid-client`. `commands` is a required prop.

---

### Step 8 — Copy and modify `web/console-helpers.ts`

**Source:** `editor-lib/src/web/console-helpers.ts`
**Destination:** `packages/cli-shell/src/web/console-helpers.ts`

**Modifications:**

1. Remove `import type { CommandName } from '@/commands';` (line 3)
2. In `exec` function, remove `as CommandName` cast (line 66):
   ```ts
   // Was: const result = await executeCommand(commandName as CommandName, args, ctx);
   const result = await executeCommand(commandName, args, ctx);
   ```

Everything else stays the same.

**Expected outcome:** `console-helpers.ts` uses `string` for command names instead of the naveditor-specific `CommandName` type.

---

### Step 9 — Copy and modify `lib/filesystem-actions.ts`

**Source:** `editor-lib/src/lib/filesystem-actions.ts`
**Destination:** `packages/cli-shell/src/lib/filesystem-actions.ts`

**Modifications:**

1. Change line 13:
   ```ts
   // Was: import { PathTokenSchema } from './command-args.schema';
   import { PathTokenSchema } from './filesystem-args.schema';
   ```

Everything else stays the same.

**Expected outcome:** `filesystem-actions.ts` imports `PathTokenSchema` from the extracted schema file.

---

### Step 10 — Copy and modify `commands/filesystem.ts`

**Source:** `editor-lib/src/commands/filesystem.ts`
**Destination:** `packages/cli-shell/src/commands/filesystem.ts`

**Modifications:**

1. Change parser import (lines 14-25):
   ```ts
   // Was: from '@/lib/command-args.parser'
   import {
     parseCatArgs,
     parseCdArgs,
     parseCpArgs,
     parseLsArgs,
     parseMkdirArgs,
     parseMvArgs,
     parseRmArgs,
     parseStatArgs,
     parseTouchArgs,
     parseTreeArgs
   } from '@/lib/filesystem-args.parser';
   ```

Everything else stays the same.

**Expected outcome:** `filesystem.ts` imports parsers from the extracted parser file.

---

### Step 11 — Create `packages/cli-shell/src/lib/filesystem-args.schema.ts`

**What to do:** Extract filesystem-related schemas from `editor-lib/src/lib/command-args.schema.ts`.

```ts
import { z } from 'zod';
import { pathArgSchema } from '@devalbo/shared';

export const PathTokenSchema = pathArgSchema;

export const CdArgsSchema = z.object({
  path: PathTokenSchema
});

export const LsArgsSchema = z.object({
  path: PathTokenSchema.optional()
});

export const TreeArgsSchema = z.object({
  path: PathTokenSchema.optional()
});

export const StatArgsSchema = z.object({
  path: PathTokenSchema
});

export const CatArgsSchema = z.object({
  file: PathTokenSchema
});

export const TouchArgsSchema = z.object({
  file: PathTokenSchema
});

export const MkdirArgsSchema = z.object({
  path: PathTokenSchema
});

export const RmArgsSchema = z.object({
  path: PathTokenSchema
});

export const CpArgsSchema = z.object({
  source: PathTokenSchema,
  dest: PathTokenSchema
});

export const MvArgsSchema = z.object({
  source: PathTokenSchema,
  dest: PathTokenSchema
});

export type CpArgsInput = z.infer<typeof CpArgsSchema>;
export type MvArgsInput = z.infer<typeof MvArgsSchema>;
export type CdArgsInput = z.infer<typeof CdArgsSchema>;
export type LsArgsInput = z.infer<typeof LsArgsSchema>;
export type TreeArgsInput = z.infer<typeof TreeArgsSchema>;
export type StatArgsInput = z.infer<typeof StatArgsSchema>;
export type CatArgsInput = z.infer<typeof CatArgsSchema>;
export type TouchArgsInput = z.infer<typeof TouchArgsSchema>;
export type MkdirArgsInput = z.infer<typeof MkdirArgsSchema>;
export type RmArgsInput = z.infer<typeof RmArgsSchema>;
```

---

### Step 12 — Create `packages/cli-shell/src/lib/filesystem-args.parser.ts`

**What to do:** Extract filesystem-related parsers from `editor-lib/src/lib/command-args.parser.ts`.

Include the shared `parseWithSchema` helper (duplicated here — the editor-lib copy keeps its own).

```ts
import { argument, formatMessage, object, optional, parse, string, type Parser } from '@optique/core';
import { z } from 'zod';
import {
  CatArgsSchema, type CatArgsInput,
  CdArgsSchema, type CdArgsInput,
  CpArgsSchema, type CpArgsInput,
  LsArgsSchema, type LsArgsInput,
  MkdirArgsSchema, type MkdirArgsInput,
  MvArgsSchema, type MvArgsInput,
  RmArgsSchema, type RmArgsInput,
  StatArgsSchema, type StatArgsInput,
  TouchArgsSchema, type TouchArgsInput,
  TreeArgsSchema, type TreeArgsInput
} from './filesystem-args.schema';

type ParserShapeFor<T extends Record<string, unknown>> = {
  [K in keyof T]-?: Parser<'sync', T[K], unknown>;
};

const cpParser = object({
  source: argument(string()),
  dest: argument(string())
} satisfies ParserShapeFor<CpArgsInput>);

const cdParser = object({
  path: argument(string())
} satisfies ParserShapeFor<CdArgsInput>);

const lsParser = object({
  path: optional(argument(string()))
} satisfies ParserShapeFor<LsArgsInput>);

const treeParser = object({
  path: optional(argument(string()))
} satisfies ParserShapeFor<TreeArgsInput>);

const statParser = object({
  path: argument(string())
} satisfies ParserShapeFor<StatArgsInput>);

const catParser = object({
  file: argument(string())
} satisfies ParserShapeFor<CatArgsInput>);

const touchParser = object({
  file: argument(string())
} satisfies ParserShapeFor<TouchArgsInput>);

const mkdirParser = object({
  path: argument(string())
} satisfies ParserShapeFor<MkdirArgsInput>);

const rmParser = object({
  path: argument(string())
} satisfies ParserShapeFor<RmArgsInput>);

const mvParser = object({
  source: argument(string()),
  dest: argument(string())
} satisfies ParserShapeFor<MvArgsInput>);

type ParseResult<T> = {
  success: true;
  value: T;
} | {
  success: false;
  error: string;
};

const zodErrorToMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join('; ');

const parseWithSchema = <TParsed, TOutput>(
  parser: Parser<'sync', TParsed, unknown>,
  args: string[],
  schema: z.ZodType<TOutput>,
  mapValue?: (value: TParsed) => unknown
): ParseResult<TOutput> => {
  const result = parse(parser, args);
  if (!result.success) {
    return { success: false, error: formatMessage(result.error) };
  }
  const input = mapValue ? mapValue(result.value) : result.value;
  const validated = schema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: zodErrorToMessage(validated.error) };
  }
  return { success: true, value: validated.data };
};

export type CpArgs = CpArgsInput;
export type CdArgs = CdArgsInput;
export type LsArgs = LsArgsInput;
export type TreeArgs = TreeArgsInput;
export type StatArgs = StatArgsInput;
export type CatArgs = CatArgsInput;
export type TouchArgs = TouchArgsInput;
export type MkdirArgs = MkdirArgsInput;
export type RmArgs = RmArgsInput;
export type MvArgs = MvArgsInput;

export const parseCpArgs = (args: string[]): ParseResult<CpArgs> => parseWithSchema(cpParser, args, CpArgsSchema);
export const parseCdArgs = (args: string[]): ParseResult<CdArgs> => parseWithSchema(cdParser, args, CdArgsSchema);
export const parseLsArgs = (args: string[]): ParseResult<LsArgs> => parseWithSchema(lsParser, args, LsArgsSchema);
export const parseTreeArgs = (args: string[]): ParseResult<TreeArgs> => parseWithSchema(treeParser, args, TreeArgsSchema);
export const parseStatArgs = (args: string[]): ParseResult<StatArgs> => parseWithSchema(statParser, args, StatArgsSchema);
export const parseCatArgs = (args: string[]): ParseResult<CatArgs> => parseWithSchema(catParser, args, CatArgsSchema);
export const parseTouchArgs = (args: string[]): ParseResult<TouchArgs> => parseWithSchema(touchParser, args, TouchArgsSchema);
export const parseMkdirArgs = (args: string[]): ParseResult<MkdirArgs> => parseWithSchema(mkdirParser, args, MkdirArgsSchema);
export const parseRmArgs = (args: string[]): ParseResult<RmArgs> => parseWithSchema(rmParser, args, RmArgsSchema);
export const parseMvArgs = (args: string[]): ParseResult<MvArgs> => parseWithSchema(mvParser, args, MvArgsSchema);
```

---

### Step 13 — Create `packages/cli-shell/src/cli-entry.ts`

```ts
import { render } from 'ink';
import { useState } from 'react';
import type { Command } from 'commander';
import type { CommandHandler } from './commands/_util';
import type { AppConfig } from '@devalbo/shared';
import { createDevalboStore } from '@devalbo/state';
import { createFilesystemDriver } from '@devalbo/filesystem';
import { InteractiveShell } from './components/InteractiveShell';

export type CliEntryOptions = {
  commands: Record<string, CommandHandler>;
  createProgram: () => Command;
  config: AppConfig;  // Required by design — use createCliAppConfig() for a sensible default
};

export async function startInteractiveCli(opts: CliEntryOptions): Promise<void> {
  const store = createDevalboStore();
  const driver = await createFilesystemDriver();
  const initialCwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd?.() ?? '/';

  const App = () => {
    const [cwd, setCwd] = useState(initialCwd);
    return (
      <InteractiveShell
        runtime="terminal"
        commands={opts.commands}
        createProgram={opts.createProgram}
        store={store}
        config={opts.config}
        driver={driver}
        cwd={cwd}
        setCwd={setCwd}
      />
    );
  };

  render(<App />);
}
```

---

### Step 14 — Create `packages/cli-shell/src/index.ts`

```ts
// Shell components
export { InteractiveShell } from './components/InteractiveShell';
export { BrowserShellProvider } from './components/BrowserShellProvider';
export { ShellContext, useShell } from './components/ShellContext';
export { TerminalShellProvider } from './components/TerminalShellProvider';

// Command types and helpers
export type {
  AsyncCommandHandler,
  SocialCommandHandler,
  CommandHandler,
  ExtendedCommandOptions,
  ExtendedCommandOptionsWithStore,
} from './commands/_util';
export { makeOutput, makeError, makeResult, makeResultError } from './commands/_util';

// Built-in command groups
export { filesystemCommands } from './commands/filesystem';
export { systemCommands } from './commands/system';
export { appCommands } from './commands/app';

// Runtime
export {
  parseCommandLine,
  buildCommandOptions,
  executeCommand,
  executeCommandRaw,
  type CommandRuntimeContext,
} from './lib/command-runtime';

// Console helpers (window.cli binding)
export {
  bindCliRuntimeSource,
  unbindCliRuntimeSource,
  getCliRuntimeStatus,
  cli,
  type CliRuntimeSource,
} from './web/console-helpers';

// CLI entry point
export { startInteractiveCli, type CliEntryOptions } from './cli-entry';

// AppConfig factory (re-export for convenience)
export { createCliAppConfig } from '@devalbo/shared';

// Filesystem operations (used by editor-lib commands that stay behind)
export {
  buildTree,
  changeDir,
  copyPath,
  exportDirectoryAsBft,
  getDefaultCwd,
  importBftTextToLocation,
  importBftToLocation,
  joinFsPath,
  listDirectory,
  makeDirectory,
  movePath,
  readBytesFile,
  readTextFile,
  removePath,
  resolveFsPath,
  splitFsPath,
  statPath,
  touchFile,
  treeText,
  writeBytesFile,
  writeTextFile,
  type FsTreeNode,
} from './lib/filesystem-actions';

// File operations
export {
  getDriver,
  getFilesystemBackendInfo,
  getWatcher,
} from './lib/file-operations';
```

**Expected outcome:** After steps 3–14, `packages/cli-shell` should compile standalone.

**Verify:** `pnpm install && pnpm --filter @devalbo/cli-shell type-check`

---

### Step 15 — Add `@devalbo/cli-shell` dependency to `editor-lib`

**File:** `editor-lib/package.json`

Add to `dependencies`:
```json
"@devalbo/cli-shell": "workspace:*"
```

**File:** `editor-lib/tsconfig.json`

Add to `paths`:
```json
"@devalbo/cli-shell": ["../packages/cli-shell/src/index.ts"],
"@devalbo/cli-shell/*": ["../packages/cli-shell/src/*"]
```

---

### Step 16 — Update `editor-lib/src/commands/index.ts`

Change all imports to use `@devalbo/cli-shell`:

```ts
import type { CommandHandler, ExtendedCommandOptions } from '@devalbo/cli-shell';
import { filesystemCommands, systemCommands, appCommands } from '@devalbo/cli-shell';
import { ioCommands } from './io';
import { solidCommands } from './solid';
import { personaCommand } from './persona';
import { contactCommand } from './contact';
import { groupCommand } from './group';
import { filesCommands } from './files';

type CoreCommandName =
  | keyof typeof filesystemCommands
  | keyof typeof systemCommands
  | keyof typeof ioCommands
  | keyof typeof solidCommands
  | keyof typeof filesCommands
  | keyof typeof appCommands;

type SocialCommandName = 'persona' | 'contact' | 'group';
type AliasCommandName = 'navigate' | 'edit';
export type CommandName = CoreCommandName | SocialCommandName | AliasCommandName;

type CommandMap = Record<CommandName, CommandHandler>;

const baseCommands = {
  ...filesystemCommands,
  ...systemCommands,
  ...ioCommands,
  ...solidCommands,
  ...filesCommands,
  ...appCommands
} as const;

export const commands: CommandMap = {
  ...baseCommands,
  persona: personaCommand,
  contact: contactCommand,
  group: groupCommand,
  navigate: async (args: string[], options?: ExtendedCommandOptions) => filesystemCommands.ls(args, options),
  edit: async (args: string[], options?: ExtendedCommandOptions) => filesystemCommands.cat(args, options)
};
```

---

### Step 17 — Update remaining `editor-lib/src/commands/` imports

For each command file that stays in editor-lib and imports from `./_util`, change the import source to `@devalbo/cli-shell`:

**`commands/io.ts`** — 3 import lines change:
```ts
// Was: import type { ExtendedCommandOptionsWithStore } from './_util';
import type { ExtendedCommandOptionsWithStore } from '@devalbo/cli-shell';
// Was: import type { AsyncCommandHandler } from './_util';
import type { AsyncCommandHandler } from '@devalbo/cli-shell';
// Was: import { makeError, makeOutput, makeResult, makeResultError } from './_util';
import { makeError, makeOutput, makeResult, makeResultError } from '@devalbo/cli-shell';
```

Also change filesystem-actions import:
```ts
// Was: import { exportDirectoryAsBft, getDefaultCwd, readTextFile, importBftTextToLocation, importBftToLocation, writeTextFile } from '@/lib/filesystem-actions';
import { exportDirectoryAsBft, getDefaultCwd, readTextFile, importBftTextToLocation, importBftToLocation, writeTextFile } from '@devalbo/cli-shell';
```

**`commands/solid.ts`:**
```ts
// Was: import type { AsyncCommandHandler, ExtendedCommandOptions } from './_util';
import type { AsyncCommandHandler, ExtendedCommandOptions } from '@devalbo/cli-shell';
// Was: import { makeOutput, makeResult, makeResultError } from './_util';
import { makeOutput, makeResult, makeResultError } from '@devalbo/cli-shell';
```

**`commands/persona.ts`:**
```ts
// Was: import { makeResult, makeResultError, type SocialCommandHandler } from './_util';
import { makeResult, makeResultError, type SocialCommandHandler } from '@devalbo/cli-shell';
```

**`commands/contact.ts`:**
```ts
// Was: import { makeResult, makeResultError, type SocialCommandHandler } from './_util';
import { makeResult, makeResultError, type SocialCommandHandler } from '@devalbo/cli-shell';
```

**`commands/group.ts`:**
```ts
// Was: import { makeResult, makeResultError, type SocialCommandHandler } from './_util';
import { makeResult, makeResultError, type SocialCommandHandler } from '@devalbo/cli-shell';
```

**`commands/files.ts`:**
```ts
// Was: import { makeOutput, makeResultError, type AsyncCommandHandler, type ExtendedCommandOptions } from './_util';
import { makeOutput, makeResultError, type AsyncCommandHandler, type ExtendedCommandOptions } from '@devalbo/cli-shell';
```

---

### Step 18 — Update `editor-lib/src/web/App.tsx`

**Modifications:**

1. Change InteractiveShell and console-helpers imports:
   ```ts
   // Was: import { InteractiveShell } from '@/components/InteractiveShell';
   import { InteractiveShell } from '@devalbo/cli-shell';
   // Was: import { bindCliRuntimeSource, unbindCliRuntimeSource } from '@/web/console-helpers';
   import { bindCliRuntimeSource, unbindCliRuntimeSource } from '@devalbo/cli-shell';
   ```

2. Add imports for commands and createProgram:
   ```ts
   import { commands } from '@/commands';
   import { createProgram } from '@/program';
   ```

3. Add `commands` and `createProgram` to `bindCliRuntimeSource` context (around line 69):
   ```ts
   return {
     commands,
     createProgram,
     store,
     session: sessionRef.current,
     // ... rest unchanged
   };
   ```

4. Add `commands`, `createProgram`, `session` props to `<InteractiveShell>` (around line 119):
   ```tsx
   <InteractiveShell
     commands={commands}
     createProgram={createProgram}
     session={session}
     store={store}
     config={config}
     driver={driver}
     cwd={cwd}
     setCwd={setCwd}
   />
   ```

---

### Step 19 — Update `editor-lib/src/web/index.tsx`

**File:** `editor-lib/src/web/index.tsx`

Change the console-helpers import:

```ts
// Was: import { cli } from './console-helpers';
import { cli } from '@devalbo/cli-shell';
```

Everything else stays the same. Without this change, the web entry point breaks after Step 23 deletes `editor-lib/src/web/console-helpers.ts`.

---

### Step 20 — Update `editor-lib/src/web/FileExplorer.tsx`

Change imports of moved modules:

```ts
// Was: import { getFilesystemBackendInfo, getWatcher } from '@/lib/file-operations';
import { getFilesystemBackendInfo, getWatcher } from '@devalbo/cli-shell';

// Was: import { buildTree, type FsTreeNode, getDefaultCwd, listDirectory, ... } from '@/lib/filesystem-actions';
import {
  buildTree,
  type FsTreeNode,
  getDefaultCwd,
  listDirectory,
  makeDirectory,
  readBytesFile,
  removePath,
  resolveFsPath,
  splitFsPath,
  writeBytesFile,
  writeTextFile
} from '@devalbo/cli-shell';
```

---

### Step 21 — Update `editor-lib/src/cli.tsx`

**Modifications:**

1. Change imports to use cli-shell:
   ```ts
   // Was: import { TerminalShellProvider } from './components/TerminalShellProvider';
   // Was: import { InteractiveShell } from './components/InteractiveShell';
   import { TerminalShellProvider, InteractiveShell } from '@devalbo/cli-shell';
   ```

2. Add `commands` and `createProgram` props to `<InteractiveShell>` in `TerminalInteractiveShell`:
   ```tsx
   const TerminalInteractiveShell = ({ store }: { store: ReturnType<typeof createDevalboStore> }) => {
     const [cwd, setCwd] = useState(process.cwd());
     return (
       <InteractiveShell
         runtime="terminal"
         commands={commands}
         createProgram={createProgram}
         store={store}
         driver={null}
         cwd={cwd}
         setCwd={setCwd}
       />
     );
   };
   ```

---

### Step 22 — Reduce `editor-lib/src/lib/command-args.schema.ts`

Remove all filesystem schemas (Cd, Ls, Tree, Stat, Cat, Touch, Mkdir, Rm, Cp, Mv and their types). Keep only:

```ts
import { z } from 'zod';
import { pathArgSchema } from '@devalbo/shared';

export const PathTokenSchema = pathArgSchema;

export const ImportArgsSchema = z.object({
  firstArg: PathTokenSchema.optional(),
  secondArg: PathTokenSchema.optional()
});

export const ExportArgsSchema = z.object({
  sourcePath: PathTokenSchema.optional(),
  outputPath: PathTokenSchema.optional()
});

export const SolidExportArgsSchema = z.object({
  outputPath: PathTokenSchema.optional()
});

export const SolidImportArgsSchema = z.object({
  filePath: PathTokenSchema
});

export type ImportArgsInput = z.infer<typeof ImportArgsSchema>;
export type ExportArgsInput = z.infer<typeof ExportArgsSchema>;
export type SolidExportArgsInput = z.infer<typeof SolidExportArgsSchema>;
export type SolidImportArgsInput = z.infer<typeof SolidImportArgsSchema>;
```

---

### Step 23 — Reduce `editor-lib/src/lib/command-args.parser.ts`

Remove all filesystem parsers and their type aliases. Keep only the io/social parsers and the shared `parseWithSchema` helper:

```ts
import { argument, formatMessage, object, optional, parse, string, type Parser } from '@optique/core';
import { z } from 'zod';
import {
  ExportArgsSchema,
  type ExportArgsInput,
  ImportArgsSchema,
  type ImportArgsInput,
  SolidExportArgsSchema,
  type SolidExportArgsInput,
  SolidImportArgsSchema,
  type SolidImportArgsInput
} from './command-args.schema';

type ParserShapeFor<T extends Record<string, unknown>> = {
  [K in keyof T]-?: Parser<'sync', T[K], unknown>;
};

const importParser = object({
  firstArg: optional(argument(string())),
  secondArg: optional(argument(string()))
} satisfies ParserShapeFor<ImportArgsInput>);

const exportParser = object({
  sourcePath: optional(argument(string())),
  outputPath: optional(argument(string()))
} satisfies ParserShapeFor<ExportArgsInput>);

const solidExportParser = object({
  outputPath: optional(argument(string()))
} satisfies ParserShapeFor<SolidExportArgsInput>);

const solidImportParser = object({
  filePath: argument(string())
} satisfies ParserShapeFor<SolidImportArgsInput>);

export type ImportArgs = ImportArgsInput;
export type ExportArgs = ExportArgsInput;
export type SolidExportArgs = SolidExportArgsInput;
export type SolidImportArgs = SolidImportArgsInput;

type ParseResult<T> = {
  success: true;
  value: T;
} | {
  success: false;
  error: string;
};

const zodErrorToMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join('; ');

const parseWithSchema = <TParsed, TOutput>(
  parser: Parser<'sync', TParsed, unknown>,
  args: string[],
  schema: z.ZodType<TOutput>,
  mapValue?: (value: TParsed) => unknown
): ParseResult<TOutput> => {
  const result = parse(parser, args);
  if (!result.success) {
    return { success: false, error: formatMessage(result.error) };
  }
  const input = mapValue ? mapValue(result.value) : result.value;
  const validated = schema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: zodErrorToMessage(validated.error) };
  }
  return { success: true, value: validated.data };
};

export const parseImportArgs = (args: string[]): ParseResult<ImportArgs> =>
  parseWithSchema(importParser, args, ImportArgsSchema);

export const parseExportArgs = (args: string[]): ParseResult<ExportArgs> =>
  parseWithSchema(exportParser, args, ExportArgsSchema);

export const parseSolidExportArgs = (args: string[]): ParseResult<SolidExportArgs> =>
  parseWithSchema(solidExportParser, args, SolidExportArgsSchema);

export const parseSolidImportArgs = (args: string[]): ParseResult<SolidImportArgs> =>
  parseWithSchema(solidImportParser, args, SolidImportArgsSchema);

export const parseSolidFetchProfileArgs = (
  args: string[]
): { success: true; value: { webId: string } } | { success: false; error: string } => {
  const webId = args[0]?.trim();
  if (!webId) return { success: false, error: 'webId is required' };
  if (!webId.startsWith('http://') && !webId.startsWith('https://')) {
    return { success: false, error: 'webId must be an http(s) URL' };
  }
  return { success: true, value: { webId } };
};

export const parseSolidLoginArgs = (
  args: string[]
): { success: true; value: { issuer: string } } | { success: false; error: string } => {
  const issuer = args[0]?.trim();
  if (!issuer) return { success: false, error: 'issuer is required' };
  if (!issuer.startsWith('http://') && !issuer.startsWith('https://')) {
    return { success: false, error: 'issuer must be an http(s) URL' };
  }
  return { success: true, value: { issuer } };
};

export const parseSolidShareCardArgs = (
  args: string[]
): { success: true; value: { contactId: string } } | { success: false; error: string } => {
  const contactId = args[0]?.trim();
  if (!contactId) return { success: false, error: 'contactId is required' };
  return { success: true, value: { contactId } };
};
```

---

### Step 24 — Delete original files from `editor-lib/src/`

Delete these files (they now live in `packages/cli-shell/src/`):

```
editor-lib/src/components/InteractiveShell.tsx
editor-lib/src/components/BrowserShellProvider.tsx
editor-lib/src/components/ShellContext.tsx
editor-lib/src/components/TerminalShellProvider.tsx
editor-lib/src/components/ui/gradient.tsx
editor-lib/src/components/ui/spinner.tsx
editor-lib/src/components/ui/text-input.tsx
editor-lib/src/commands/_util.tsx
editor-lib/src/commands/filesystem.ts
editor-lib/src/commands/system.ts
editor-lib/src/commands/app.ts
editor-lib/src/commands/with-validation.ts
editor-lib/src/lib/command-runtime.ts
editor-lib/src/lib/file-operations.ts
editor-lib/src/lib/filesystem-actions.ts
editor-lib/src/lib/bft-transfer.ts
editor-lib/src/lib/utils.ts
editor-lib/src/lib/validate-args.ts
editor-lib/src/lib/validate-args.node.ts
editor-lib/src/web/console-helpers.ts
```

**21 files deleted.** Empty parent directories (`components/ui/`) can also be removed if no other files remain.

Check that `editor-lib/src/components/` still contains `editor/`, `navigator/`, `social/` subdirectories (these stay).

---

### Step 25 — Update `naveditor-web` imports and configs

**`naveditor-web/src/App.tsx`:**

1. Change InteractiveShell import:
   ```ts
   // Was: import { InteractiveShell } from '@/components/InteractiveShell';
   import { InteractiveShell } from '@devalbo/cli-shell';
   ```

2. Change console-helpers import:
   ```ts
   // Was: import { bindCliRuntimeSource, unbindCliRuntimeSource } from '@/web/console-helpers';
   import { bindCliRuntimeSource, unbindCliRuntimeSource } from '@devalbo/cli-shell';
   ```

3. Add imports:
   ```ts
   import { commands } from '@/commands';
   import { createProgram } from '@/program';
   ```

4. Add `commands` and `createProgram` to `bindCliRuntimeSource` context (around line 139):
   ```ts
   return {
     commands,
     createProgram,
     store,
     session: sessionRef.current,
     // ... rest unchanged
   };
   ```

5. Add props to `<InteractiveShell>` (around line 206):
   ```tsx
   <InteractiveShell
     commands={commands}
     createProgram={createProgram}
     session={session}
     store={store}
     config={config}
     driver={driver}
     cwd={cwd}
     setCwd={setCwd}
   />
   ```

**`naveditor-web/src/console-helpers.ts`:**
```ts
// Was: export { cli } from '@/web/console-helpers';
export { cli } from '@devalbo/cli-shell';
```

**`naveditor-web/tsconfig.json`** — add to `paths`:
```json
"@devalbo/cli-shell": ["../packages/cli-shell/src/index.ts"],
"@devalbo/cli-shell/*": ["../packages/cli-shell/src/*"]
```

**`naveditor-web/vite.config.ts`** — add to `resolve.alias` array (before the `@` catch-all):
```ts
{ find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, '../packages/cli-shell/src/$1') },
{ find: '@devalbo/cli-shell', replacement: resolve(__dirname, '../packages/cli-shell/src/index.ts') },
```

Also update the `validate-args` alias:
```ts
// Was: { find: '@/lib/validate-args', replacement: resolve(__dirname, '../editor-lib/src/lib/validate-args.ts') }
{ find: '@/lib/validate-args', replacement: resolve(__dirname, '../packages/cli-shell/src/lib/validate-args.ts') }
```

**`naveditor-web/package.json`** — add to `dependencies`:
```json
"@devalbo/cli-shell": "workspace:*"
```

---

### Step 26 — Update `naveditor-desktop` imports and configs

Same pattern as Step 25. Apply identical changes to:

**`naveditor-desktop/src/App.tsx`:**
- Same 5 modifications as naveditor-web (InteractiveShell import, console-helpers import, commands/createProgram imports, bindCliRuntimeSource context, InteractiveShell props)

**`naveditor-desktop/src/console-helpers.ts`:**
```ts
export { cli } from '@devalbo/cli-shell';
```

**`naveditor-desktop/tsconfig.json`** — add to `paths`:
```json
"@devalbo/cli-shell": ["../packages/cli-shell/src/index.ts"],
"@devalbo/cli-shell/*": ["../packages/cli-shell/src/*"]
```

**`naveditor-desktop/vite.config.ts`** — add to `resolve.alias` array (before the `@` catch-all):
```ts
{ find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, '../packages/cli-shell/src/$1') },
{ find: '@devalbo/cli-shell', replacement: resolve(__dirname, '../packages/cli-shell/src/index.ts') },
```

Also update `validate-args` alias:
```ts
{ find: '@/lib/validate-args', replacement: resolve(__dirname, '../packages/cli-shell/src/lib/validate-args.ts') }
```

**`naveditor-desktop/package.json`** — add to `dependencies`:
```json
"@devalbo/cli-shell": "workspace:*"
```

---

### Step 27 — Update `naveditor` (test package) configs

**`naveditor/tsconfig.json`** — add to `paths`:
```json
"@devalbo/cli-shell": ["../packages/cli-shell/src/index.ts"],
"@devalbo/cli-shell/*": ["../packages/cli-shell/src/*"]
```

**`naveditor/vitest.config.ts`** — add to `resolve.alias` array (before the `@` catch-all):
```ts
{ find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, '../packages/cli-shell/src/$1') },
{ find: '@devalbo/cli-shell', replacement: resolve(__dirname, '../packages/cli-shell/src/index.ts') },
```

Also update `validate-args` alias:
```ts
// Was: { find: '@/lib/validate-args', replacement: resolve(__dirname, '../editor-lib/src/lib/validate-args.node.ts') }
{ find: '@/lib/validate-args', replacement: resolve(__dirname, '../packages/cli-shell/src/lib/validate-args.node.ts') }
```

**`naveditor/package.json`** — add to `dependencies`:
```json
"@devalbo/cli-shell": "workspace:*"
```

---

### Step 28 — Update root `vite.config.ts`

Add cli-shell alias entries (before the `@/` catch-all):

```ts
{ find: /^@devalbo\/cli-shell\/(.*)$/, replacement: resolve(__dirname, 'packages/cli-shell/src/$1') },
{ find: '@devalbo/cli-shell', replacement: resolve(__dirname, 'packages/cli-shell/src/index.ts') },
```

Also update `validate-args` aliases:
```ts
// Was: { find: '@/lib/validate-args', replacement: resolve(__dirname, 'editor-lib/src/lib/validate-args.node.ts') }
{ find: '@/lib/validate-args', replacement: resolve(__dirname, 'packages/cli-shell/src/lib/validate-args.node.ts') }
```

---

### Step 29 — Update `naveditor-terminal`

**`naveditor-terminal/package.json`** — add to `dependencies`:
```json
"@devalbo/cli-shell": "workspace:*"
```

No source file changes needed — `naveditor-terminal` has no `src/` and just runs `editor-lib/src/cli-node.tsx` which delegates to `cli.tsx` (already updated in Step 21).

---

### Step 30 — Update test files

**`naveditor/tests/unit/components/InteractiveShell.test.tsx`:**

1. After Step 23, `@/components/InteractiveShell` and `@/lib/command-runtime` resolve to deleted files. Update:
   ```ts
   // Was: import { InteractiveShell } from '@/components/InteractiveShell';
   import { InteractiveShell } from '@devalbo/cli-shell';
   // Was: import * as commandRuntime from '@/lib/command-runtime';
   import * as commandRuntime from '@devalbo/cli-shell/lib/command-runtime';
   ```

2. Add `commands` as a required prop to every `<InteractiveShell>` render:
   ```tsx
   <InteractiveShell
     runtime="browser"
     commands={{}}
     store={createDevalboStore()}
     driver={null}
     cwd="/"
     setCwd={setCwd}
   />
   ```

3. The `executeCommandRaw` spy assertions need to include `commands` in the expected context:
   ```ts
   expect(executeSpy).toHaveBeenCalledWith(
     'pwd',
     expect.objectContaining({
       commands: {},
       cwd: '/',
       setCwd,
       store: expect.any(Object)
     })
   );
   ```

**`naveditor/tests/unit/lib/command-runtime.test.ts`:**

1. Update import:
   ```ts
   // Was: import { ... } from '@/lib/command-runtime';
   import {
     executeCommand,
     executeCommandRaw,
     parseCommandLine,
     type CommandRuntimeContext
   } from '@devalbo/cli-shell';
   ```
   Or use the deep import: `from '@devalbo/cli-shell/lib/command-runtime'`

2. Add `commands` to every `CommandRuntimeContext`:
   ```ts
   const ctx: CommandRuntimeContext = {
     commands: {},  // empty — or import actual commands for the forwarding test
     store: createDevalboStore(),
     cwd: '/',
     setCwd: vi.fn()
   };
   ```

3. The `forwards options built from context to commands` test calls `executeCommand('pwd', [], ctx)` and `executeCommand('cd', ['/'], ctx)`. These require the actual `pwd` and `cd` handlers in `ctx.commands`:
   ```ts
   import { filesystemCommands } from '@devalbo/cli-shell';
   // ...
   const ctx: CommandRuntimeContext = {
     commands: { ...filesystemCommands },
     store: createDevalboStore(),
     cwd: '/tmp',
     setCwd
   };
   ```

**`naveditor/tests/unit/web/console-helpers.test.ts`:**

1. Update imports:
   ```ts
   // Was: import { bindCliRuntimeSource, cli, unbindCliRuntimeSource } from '@/web/console-helpers';
   import { bindCliRuntimeSource, cli, unbindCliRuntimeSource, type CommandRuntimeContext } from '@devalbo/cli-shell';
   // Was: import type { CommandRuntimeContext } from '@/lib/command-runtime';
   // (merged into the import above)
   ```

2. Add `commands` to `makeContext`:
   ```ts
   import { filesystemCommands, systemCommands } from '@devalbo/cli-shell';
   // ...
   const makeContext = (cwd: string): CommandRuntimeContext => ({
     commands: { ...filesystemCommands, ...systemCommands },
     store: createDevalboStore(),
     cwd,
     setCwd: () => undefined
   });
   ```

---

### Step 31 — Install and verify

Run from the repo root (`demo-v2-codex/`):

```sh
# 1. Install new package into workspace
pnpm install

# 2. Type-check cli-shell standalone
pnpm --filter @devalbo/cli-shell type-check

# 3. Type-check editor-lib (now imports from @devalbo/cli-shell)
pnpm --filter @devalbo/editor-lib type-check

# 4. Type-check naveditor-web
pnpm --filter naveditor-web type-check

# 5. Type-check naveditor-desktop
pnpm --filter naveditor-desktop type-check

# 6. Unit tests
pnpm --filter naveditor test:unit

# 7. Terminal BDD
pnpm --filter naveditor test:bdd:terminal

# 8. Web builds
pnpm --filter naveditor-web build
pnpm --filter naveditor-desktop build:web
```

All unit tests should pass. Terminal BDD should pass. Both web builds should succeed.

---

## Acceptance criteria

- [ ] `packages/cli-shell` type-checks clean standalone
- [ ] `packages/cli-shell/package.json` has NO dependency on `@devalbo/solid-client`
- [ ] `editor-lib` has no local copies of moved files — all go through `@devalbo/cli-shell`
- [ ] `commands/system.ts` in cli-shell reads `options.createProgram` — no static `@/program` import
- [ ] `InteractiveShell` receives `commands` and `session` as props — no `useSolidSession` hook
- [ ] `CommandRuntimeContext` has `commands: Record<string, CommandHandler>` — no static import from `@/commands`
- [ ] `createCliAppConfig` and `createSocialAppConfig` exported from `@devalbo/shared`; `createCliAppConfig` re-exported from `@devalbo/cli-shell`
- [ ] `startInteractiveCli` works for a CLI-only app
- [ ] `help` command produces output in both terminal and browser surfaces
- [ ] All unit tests pass
- [ ] Terminal BDD passes
- [ ] `naveditor-web` and `naveditor-desktop` build clean
- [ ] All config files (`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`) resolve `@devalbo/cli-shell`
