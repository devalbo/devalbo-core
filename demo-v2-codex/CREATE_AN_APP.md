# Creating a devalbo-core App

This guide walks through building an app on top of the devalbo-core packages. The framework provides:

- A **command system** shared across all UI surfaces (terminal, browser shell, browser dev console)
- A **reactive store** (TinyBase via `@devalbo/state`) for application data
- A **filesystem abstraction** (`@devalbo/filesystem`) that works in Node.js, browser, and Tauri
- **Ink-based UI rendering** for command output (works in all surfaces)

You can opt into any combination of UI surfaces: CLI only, browser app, Tauri desktop app.

Solid integration is **explicit and opt-in** — do not add `SolidSessionProvider` unless your app uses Solid features.

naveditor is an app built on this framework — it follows the same patterns described here. Wherever a pattern is introduced, you'll find a pointer to the corresponding naveditor file.

### App structure parallel

Every app follows the same shape. naveditor is the reference implementation:

| Your app | naveditor equivalent | Role |
|---|---|---|
| `my-app-lib/` | `editor-lib/` | App library — commands, config, program definition |
| `my-app-cli/` | `naveditor-terminal/` | CLI entry point |
| `my-app-web/` | `naveditor-web/` | Browser entry point (Vite + React) |
| `my-app-desktop/` | `naveditor-desktop/` | Tauri entry point |

---

## Package Map

| Package | What it provides | Direct use? |
|---------|-----------------|-------------|
| `devalbo-cli` | Shell framework, built-in commands, entry points | Yes — primary dependency |
| `@devalbo/shared` | Core types (`AppConfig`, `CommandResult`, branded types) | Advanced internal use only |
| `@devalbo/state` | TinyBase store, schemas, persisters | Re-exported via `devalbo-cli` |
| `@devalbo/filesystem` | Filesystem driver abstraction | Re-exported via `devalbo-cli` |
| `@devalbo/commands` | Command parser and validation | Used internally by `devalbo-cli` |
| `@devalbo/ui` | Ink primitives (TextInput, Spinner, etc.) | Advanced custom UI use only |
| `@devalbo/solid-client` | Solid pod auth and sync | Optional advanced integration |

For the quickstart, you only need one import source: `devalbo-cli`.

---

## Quickstart: CLI-Only App (5 minutes)

This walkthrough builds a minimal CLI-only app. Code matches `examples/hello-universal/` exactly.

### Step 1 — Create your app directory

```
my-app/
  package.json
  tsconfig.json
  src/
    commands/index.ts
    program.ts
    cli.ts
```

### Step 2 — `package.json`

```json
{
  "name": "my-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node --import tsx src/cli.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "devalbo-cli": "git+https://github.com/devalbo/devalbo-core.git",
    "commander": "^14.0.0",
    "react": "^19.1.1"
  },
  "devDependencies": {
    "@types/node": "^24.3.0",
    "@types/react": "^19.1.10",
    "tsx": "^4.20.4",
    "typescript": "^5.9.2"
  }
}
```

Note: `@devalbo/shared` is NOT a direct dependency — `createCliAppConfig` is re-exported from `devalbo-cli`.

Install commands (npm):

```sh
npm install devalbo-cli commander react
npm install --save-dev typescript tsx @types/node @types/react
```

If you want to consume `devalbo-cli` directly from the GitHub monorepo (instead of npm publish), use:

```sh
npm install git+https://github.com/devalbo/devalbo-core.git
```

Notes:
- The `package.json` above is standalone-ready and does not require this monorepo.
- Pinning to a branch/commit is recommended for reproducible builds.

### Step 3 — Write commands

**`src/commands/index.ts`**
```ts
import type { CommandHandler, AsyncCommandHandler } from 'devalbo-cli';
import { builtinCommands, makeOutput } from 'devalbo-cli';

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

`builtinCommands` is a single-import aggregate of all built-in commands (filesystem, system, app-config). Spread it into your command registry to get pwd, cd, ls, tree, cat, touch, mkdir, cp, mv, rm, stat, clear, backend, exit, help, and app-config.

> **naveditor does this too:** `editor-lib/src/commands/index.ts` uses the individual groups (`filesystemCommands`, `systemCommands`, `appCommands`) instead of the aggregate because it has 6+ app-specific command groups to compose alongside them. Both patterns work — use `builtinCommands` for simplicity, individual groups when you need selective composition.

### Step 4 — Define the program (for `help` text)

**`src/program.ts`**
```ts
import { Command } from 'commander';
import { registerBuiltinCommands } from 'devalbo-cli';

export const createProgram = (): Command => {
  const program = new Command('my-app')
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

`registerBuiltinCommands(program)` registers all 16 built-in commands on the commander program, so `help` displays them. Register your app-specific commands first, then call `registerBuiltinCommands`.

> **naveditor does this too:** `editor-lib/src/program.ts` — (TODO: currently uses manual registration, will switch to `registerBuiltinCommands` in Plan 14).

### Step 5 — Wire up the CLI entry point

**`src/cli.ts`**
```ts
import { startInteractiveCli, createCliAppConfig } from 'devalbo-cli';
import { commands } from './commands/index';
import { createProgram } from './program';

await startInteractiveCli({
  commands,
  createProgram,
  config: createCliAppConfig({
    appId: 'my-app',
    appName: 'My App',
    storageKey: 'my-app-store',
  }),
  welcomeMessage: 'Welcome to My App. Type "help" for available commands.',
});
```

`createCliAppConfig()` creates an `AppConfig` with Solid features disabled — appropriate for CLI-only apps. `welcomeMessage` is required: every app provides its own welcome string or ReactNode.

> **naveditor does this too:** `editor-lib/src/cli.tsx` uses a custom welcome message: `"Try: pwd, ls, export ., import snapshot.bft restore, backend"`.

### Step 6 — Run it

```sh
npm install
npm run start
```

You'll see: `Welcome to My App. Type "help" for available commands.`

Try: `hello Alice`, `echo foo bar`, `help`, `pwd`, `ls`, `app-config`.

Note: `npm run start` requires a TTY terminal (interactive Ink shell). It will not work in CI or non-interactive shells.

---

## Writing Commands

### AsyncCommandHandler

The simplest command handler signature:

```ts
type AsyncCommandHandler = (args: string[], options?: ExtendedCommandOptions) => Promise<CommandResult>;
```

`ExtendedCommandOptions` gives you:

| Field | Type | When available |
|-------|------|----------------|
| `store` | `DevalboStore` | always |
| `cwd` | `string` | always |
| `setCwd` | `(next: string) => void` | always |
| `config` | `AppConfig` | always |
| `driver` | `IFilesystemDriver` | after async driver init |
| `session` | `unknown \| null` | only when using Solid integration (cast to `SolidSession`) |
| `connectivity` | `IConnectivityService` | in browser/Tauri |
| `clearScreen` | `() => void` | in interactive terminal mode |
| `exit` | `() => void` | in interactive terminal mode |

### Output helpers

All imported from `devalbo-cli`:

```ts
import { makeOutput, makeError, makeResult, makeResultError } from 'devalbo-cli';

makeOutput('Hello world')                    // simple text
makeError('Something went wrong')            // red text, sets result.error
makeResult('Done', { count: 3 })             // success with structured data
makeResultError('Failed', { reason: 'x' })   // error with structured data
```

For rich output, return a custom Ink component:

```ts
import { createElement } from 'react';
import { MyOutputComponent } from '../components/output/MyOutputComponent';

return {
  ...makeResult('Loaded item', data),
  component: createElement(MyOutputComponent, { item: data })
};
```

> **naveditor does this too:** `editor-lib/src/commands/io.ts` returns custom Ink components for export/import results.

### StoreCommandHandler (when commands need the store)

For commands that always require store access, use `StoreCommandHandler`:

```ts
type StoreCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
```

The difference: `options` is required and always includes `store` (non-optional). Use `StoreCommandHandler` when your command reads/writes TinyBase rows and shouldn't run without a store.

```ts
import type { StoreCommandHandler } from 'devalbo-cli';
import { makeOutput, makeError } from 'devalbo-cli';

const myStoreCommand: StoreCommandHandler = async (args, options) => {
  // options.store is guaranteed — no need to null-check
  const count = options.store.getCell('my-table', 'stats', 'count') ?? 0;
  return makeOutput(`Count: ${count}`);
};
```

> **naveditor does this too:** `editor-lib/src/commands/persona.ts`, `contact.ts`, `group.ts` all use `StoreCommandHandler` because they manage store-backed social entities.

### Command Registry Pattern

Two patterns for composing commands:

**Pattern 1: `builtinCommands` aggregate** (recommended for most apps)

```ts
import { builtinCommands } from 'devalbo-cli';

export const commands: Record<string, CommandHandler> = {
  ...builtinCommands,
  hello,
  echo,
};
```

**Pattern 2: Individual groups** (for apps with many command groups)

```ts
import { filesystemCommands, systemCommands, appCommands } from 'devalbo-cli';

export const commands: Record<CommandName, CommandHandler> = {
  ...filesystemCommands,
  ...systemCommands,
  ...appCommands,
  ...myCommands,
  ...solidCommands,
};
```

> **naveditor uses Pattern 2:** `editor-lib/src/commands/index.ts` — it has 6+ app-specific command groups (io, solid, files, persona, contact, group) that it composes alongside the built-in groups individually.

---

## Program Definition (help text)

The `createProgram()` function defines a commander program used by the `help` command to display available commands and their arguments.

**Recommended:** Use `registerBuiltinCommands(program)` for all built-in commands:

```ts
import { Command } from 'commander';
import { registerBuiltinCommands } from 'devalbo-cli';

export function createProgram() {
  const program = new Command();
  program.name('my-app').description('My devalbo app').version('0.1.0');

  // App-specific commands
  program.command('my-greet [name]').description('Greet someone');

  // Built-in commands (pwd, cd, ls, ..., help, app-config)
  registerBuiltinCommands(program);

  return program;
}
```

Manual registration is allowed when you need fine-grained control over built-in command metadata (argument names, descriptions). In that case, register each command individually instead of using `registerBuiltinCommands`.

---

## Configuration

### CLI-only apps: `createCliAppConfig`

```ts
import { createCliAppConfig } from 'devalbo-cli';

const config = createCliAppConfig({
  appId: 'my-app',
  appName: 'My App',
  storageKey: 'my-app-store',
});
```

This creates an `AppConfig` with Solid features disabled and sensible defaults.

### Browser/desktop apps with custom config

Start with `createCliAppConfig` and keep the app simple. For advanced Solid sync timing controls, see `naveditor` (`editor-lib/src/web/config.ts`) and treat that as an advanced path outside this quickstart.

### Welcome message

`welcomeMessage` is required on both `InteractiveShell` and `startInteractiveCli`. Every app provides its own welcome string or ReactNode.

```ts
// Simple string
welcomeMessage: 'Welcome to My App. Type "help" for available commands.'

// Or use the utility for a standard format
import { defaultWelcomeMessage } from 'devalbo-cli';
welcomeMessage: defaultWelcomeMessage(config)
// → 'Welcome to My App. Type "help" for available commands.'
```

> **naveditor does this:** `editor-lib/src/cli.tsx` — `welcomeMessage="Try: pwd, ls, export ., import snapshot.bft restore, backend"` (custom hint text).

---

## Store integration

The store is a TinyBase `Store`. Create it once, stably, at the top of your App.

```ts
import { createDevalboStore } from 'devalbo-cli';

// Always use useState lazy initializer — never useMemo
const [store] = useState(() => createDevalboStore());
```

### Custom store schema

Apps can define their own tables alongside the built-in ones:

```ts
const [store] = useState(() => {
  const s = createDevalboStore();
  s.setTablesSchema({
    'my-items': {
      name: { type: 'string' },
      count: { type: 'number', default: 0 }
    }
  });
  return s;
});
```

### Persistence (browser and Tauri)

```ts
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

useEffect(() => {
  const persister = createLocalPersister(store, defaultAppConfig.storageKey);
  let stopped = false;
  void persister.startAutoLoad().then(() => {
    if (stopped) return;
    return persister.startAutoSave();
  });
  return () => {
    stopped = true;
    void persister.stopAutoLoad();
    void persister.stopAutoSave();
  };
}, [store]);
```

---

## Filesystem driver

The driver initializes asynchronously and is platform-specific (`createFilesystemDriver()` picks the right backend automatically: Node.js, browser OPFS, or Tauri FS). An **in-memory backend is always available** as a fallback.

Always treat the driver as nullable until initialized:

```ts
import { createFilesystemDriver } from 'devalbo-cli';

type DriverInstance = Awaited<ReturnType<typeof createFilesystemDriver>>;
const [driver, setDriver] = useState<DriverInstance | null>(null);

useEffect(() => {
  let cancelled = false;
  void createFilesystemDriver().then((d) => {
    if (!cancelled) setDriver(d);
  });
  return () => { cancelled = true; };
}, []);
```

Pass `driver` to `InteractiveShell` and into the CLI runtime context. The CLI is **not ready** until the driver is initialized — this is all-or-nothing, no partial-ready state.

---

## CLI-only app (Node.js)

`startInteractiveCli` is the primary entry point for CLI-only apps. It handles store creation, filesystem driver init, and `InteractiveShell` rendering via Ink to stdout.

```ts
import { startInteractiveCli, createCliAppConfig, builtinCommands } from 'devalbo-cli';

await startInteractiveCli({
  commands: { ...builtinCommands, hello, echo },
  createProgram,
  config: createCliAppConfig({ appId: 'my-app', appName: 'My App', storageKey: 'my-app' }),
  welcomeMessage: 'Welcome to My App. Type "help" for available commands.',
});
```

If you need to customize beyond defaults (custom store schema, batch command mode, specific driver), use the lower-level `InteractiveShell` component directly in your own Ink entry point.

> **naveditor does this:** `editor-lib/src/cli.tsx` renders `InteractiveShell` directly (rather than using `startInteractiveCli`) because it supports both interactive and batch command execution modes.

---

## Browser app

No Solid integration by default. Only add `SolidSessionProvider` when your app explicitly uses Solid features.

**`my-app-web/src/App.tsx`**
```tsx
import React, { useEffect, useRef, useState } from 'react';
import { InkTerminalBox } from 'ink-web';
import {
  AppConfigProvider,
  BrowserConnectivityService,
  InteractiveShell,
  bindCliRuntimeSource,
  createDevalboStore,
  createFilesystemDriver,
  unbindCliRuntimeSource,
  useAppConfig
} from 'devalbo-cli';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { commands } from './commands';
import { createProgram } from './program';
import { defaultAppConfig } from './config';

type StoreInstance = ReturnType<typeof createDevalboStore>;
type DriverInstance = Awaited<ReturnType<typeof createFilesystemDriver>>;

const AppContent: React.FC<{ store: StoreInstance }> = ({ store }) => {
  const [driver, setDriver] = useState<DriverInstance | null>(null);
  const [cwd, setCwd] = useState('/');
  const [connectivity] = useState(() => new BrowserConnectivityService());
  const config = useAppConfig();

  // Refs for stable CLI closure (avoids stale values in the bind effect)
  const cwdRef = useRef(cwd);
  const driverRef = useRef(driver);
  const configRef = useRef(config);
  cwdRef.current = cwd;
  driverRef.current = driver;
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    void createFilesystemDriver().then((d) => {
      if (!cancelled) setDriver(d);
    });
    return () => { cancelled = true; };
  }, []);

  // Bind window.cli for browser devtools access
  useEffect(() => {
    bindCliRuntimeSource({
      getContext: () => {
        if (!store || !driverRef.current) return null;
        return {
          commands,
          createProgram,
          store,
          config: configRef.current,
          driver: driverRef.current,
          connectivity,
          cwd: cwdRef.current,
          setCwd
        };
      }
    });
    return () => unbindCliRuntimeSource();
  }, [store, connectivity, setCwd]);

  return (
    <div>
      <h1>{config.appName}</h1>
      <InkTerminalBox rows={24} focus>
        <InteractiveShell
          commands={commands}
          createProgram={createProgram}
          store={store}
          config={config}
          driver={driver}
          cwd={cwd}
          setCwd={setCwd}
          welcomeMessage="Welcome to My App. Type 'help' for available commands."
        />
      </InkTerminalBox>
    </div>
  );
};

export const App: React.FC = () => {
  const [store] = useState(() => createDevalboStore());

  useEffect(() => {
    const persister = createLocalPersister(store, defaultAppConfig.storageKey);
    let stopped = false;
    void persister.startAutoLoad().then(() => {
      if (stopped) return;
      return persister.startAutoSave();
    });
    return () => {
      stopped = true;
      void persister.stopAutoLoad();
      void persister.stopAutoSave();
    };
  }, [store]);

  return (
    <AppConfigProvider config={defaultAppConfig}>
      <AppContent store={store} />
    </AppConfigProvider>
  );
};
```

Key points:
- `InteractiveShell`, `bindCliRuntimeSource`, `unbindCliRuntimeSource` all import from `devalbo-cli`
- `welcomeMessage` is required on `InteractiveShell`
- `bindCliRuntimeSource` uses refs to avoid stale closure values

> **naveditor does this:** `naveditor-web/src/App.tsx` — same pattern, plus Solid session and social sync wiring.

---

## Browser developer console CLI (`window.cli`)

`window.cli` is powered by `bindCliRuntimeSource` in your App. Once the driver initializes, it becomes ready.

```ts
// In your App component's useEffect:
bindCliRuntimeSource({
  getContext: () => ({
    commands, createProgram, store, config: configRef.current,
    driver: driverRef.current, cwd: cwdRef.current, setCwd
  })
});

// Then in browser devtools:
await cli.exec('hello', ['Alice'])   // run any registered command
await cli.ls('/')                     // filesystem shortcut
await cli.helpText()                  // get help output as string
```

| API | Throws? | On |
|-----|---------|------|
| `cli.exec(name, args)` | Yes | CLI not ready, or command returned an error |
| `cli.execRaw(raw)` | Yes | CLI not ready, or command returned an error |
| `cli.execText(name, args)` | Never | returns `{ text: '', error: '...' }` on failure |

> **naveditor does this:** `editor-lib/src/web/App.tsx` — binds `window.cli` with the full context including session.

---

## Desktop app (Tauri)

Same structure as the browser app. `createFilesystemDriver()` automatically selects the Tauri FS backend when running inside a Tauri window.

```
my-app-desktop/src/App.tsx     — identical structure to my-app-web/src/App.tsx
my-app-desktop/src/main.tsx    — same as web main.tsx
my-app-desktop/src/config.ts   — same config re-export
```

Tauri-specific additions go in `src-tauri/` and use the `@tauri-apps` APIs for native features (file dialogs, system tray, etc.).

> **naveditor does this:** `naveditor-desktop/` — same structure as `naveditor-web/` with Tauri additions.

---

## Rendering document content

### From the store

```ts
'my-list': async (_args, options) => {
  if (!options?.store) return makeError('No store');
  const rows = options.store.getTable('my-items');
  const lines = Object.entries(rows).map(([id, row]) => `${id}: ${row.name}`);
  return makeOutput(lines.join('\n') || '(empty)');
},
```

For rich output, return a custom Ink component:

```tsx
import { createElement } from 'react';
import { MyItemList } from '../components/output/MyItemList';

'my-list': async (_args, options) => {
  const rows = options?.store?.getTable('my-items') ?? {};
  const items = Object.entries(rows).map(([id, row]) => ({ id, name: String(row.name ?? '') }));
  return {
    ...makeResult(`${items.length} item(s)`, { items }),
    component: createElement(MyItemList, { items })
  };
},
```

### From the filesystem

```ts
'my-read': async (args, options) => {
  if (!options?.driver) return makeError('Filesystem not ready');
  const path = args[0];
  if (!path) return makeError('Usage: my-read <path>');
  try {
    const content = await options.driver.readTextFile(options.cwd ?? '/', path);
    return makeOutput(content);
  } catch {
    return makeError(`Cannot read: ${path}`);
  }
}
```

---

## Opt-in: Solid integration

Add Solid features explicitly. Do not include these unless your app uses them.

This quickstart intentionally stays `devalbo-cli`-only. If you opt into Solid, add `@devalbo/solid-client` explicitly and thread `session` into `InteractiveShell` plus the bound console runtime context. The `session` prop is typed as `unknown | null` in `devalbo-cli`; Solid-aware commands should cast after runtime validation.

> **naveditor does this:** `editor-lib/src/commands/solid.ts` — uses a runtime type guard to cast `options.session` to `SolidSession`.

---

## Summary: where things live

| What | File | Package |
|------|------|---------|
| App config | `src/web/config.ts` | `my-app-lib` |
| App commands | `src/commands/my-commands.ts` | `my-app-lib` |
| Command registry | `src/commands/index.ts` | `my-app-lib` |
| Program (for `help`) | `src/program.ts` | `my-app-lib` |
| Command runtime | `src/lib/command-runtime.ts` | `devalbo-cli` |
| InteractiveShell component | `src/components/InteractiveShell.tsx` | `devalbo-cli` |
| Console helpers | `src/web/console-helpers.ts` | `devalbo-cli` |
| App component | `src/App.tsx` | `my-app-web` / `my-app-desktop` |
| Entry point + `window.cli` | `src/main.tsx` | `my-app-web` / `my-app-desktop` |
| CLI entry point | `src/cli.ts` | `my-app-cli` |
