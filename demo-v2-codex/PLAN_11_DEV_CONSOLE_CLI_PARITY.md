# Plan 11: Dev Console CLI Parity (Coding-Agent Ready)

## Objective

Ensure browser dev-console CLI (`window.cli`) executes commands through the same runtime path as `InteractiveShell`, with the same dependency injection and behavior:

- Same `commands` registry
- Same options (`store`, `session`, `config`, `driver`, `connectivity`, `cwd`)
- Same command parsing/dispatch
- Same error semantics

No parallel/duplicate execution path should remain.

---

## Current Problem

`window.cli` currently uses console helpers that are not guaranteed to share live app context, causing behavior drift:

- Can use a separate store from the app’s interactive terminal
- Does not reliably share runtime dependencies used in `InteractiveShell`
- Duplicates execution plumbing

This makes dev-console results non-authoritative.

---

## Target State

One shared command runtime layer used by both:

1. `InteractiveShell` submit handler
2. `window.cli` helper API

Both must execute via a shared `executeCommand*` module with identical options building.

---

## Scope

### In scope
- `naveditor-lib` command runtime extraction and adoption
- `naveditor-web` / `naveditor-lib web` console helper parity wiring
- Live runtime binding from app context
- Tests for runtime and console helper behavior parity
- **App structure parity**: all three app environments (`naveditor-web`, `naveditor-desktop`, `naveditor-lib/src/web`) must follow the same structural conventions (providers, store init, persistence, Solid features, CLI exposure)

### Out of scope
- New command syntax/parser complexity
- Non-browser terminal runtime redesign
- Security hardening beyond optional dev-only exposure gate

---

## Design Contract

### Shared Runtime API

Create a single runtime module in `naveditor-lib`:

`naveditor-lib/src/lib/command-runtime.ts`

Export:

- `parseCommandLine(raw: string): { commandName: string; args: string[] }`
- `buildCommandOptions(ctx: CommandRuntimeContext): ExtendedCommandOptions`
- `executeCommand(commandName: CommandName, args: string[], ctx: CommandRuntimeContext): Promise<CommandResult>`
- `executeCommandRaw(raw: string, ctx: CommandRuntimeContext): Promise<CommandResult>`

### Runtime Context Type

Define `CommandRuntimeContext` in same file (or nearby types file):

- `store: DevalboStore`
- `session?: SolidSession | null`
- `config?: AppConfig`
- `driver?: IFilesystemDriver`
- `connectivity?: IConnectivityService`
- `cwd: string`
- `setCwd: (next: string) => void`
- `clearScreen?: () => void`
- `exit?: () => void`

### Runtime Source for Console Helper

Console helper should not own state. It should bind to a source provider:

```ts
export type CliRuntimeSource = {
  getContext: () => CommandRuntimeContext | null;
};
```

Expose:

- `bindCliRuntimeSource(source: CliRuntimeSource): void`
- `unbindCliRuntimeSource(): void`
- `getCliRuntimeStatus(): { ready: boolean; missing: string[] }`

---

## Implementation Steps

## Step 1 — Add shared command runtime module

### Create
- `naveditor-lib/src/lib/command-runtime.ts`

### Requirements
- Reuse `commands` map from `@/commands`
- Reuse `CommandName`
- Blank raw command should return a no-op `CommandResult` with empty output and no error
- `buildCommandOptions` must be the only place that constructs `ExtendedCommandOptions` from context

### Parser source of truth
`parseCommandLine` must delegate to `parseCommand` from `@devalbo/commands` (defined in `packages/commands/src/parser.ts`). Do **not** re-implement `split(/\s+/)` inline. The formal parser is the single source of truth for tokenizing raw input into `{ name, args }`. This prevents parsing drift if the formal parser evolves.

```ts
import { parseCommand } from '@devalbo/commands';

export const parseCommandLine = (raw: string): { commandName: string; args: string[] } => {
  const { name, args } = parseCommand(raw);
  return { commandName: name, args };
};
```

### Error semantics per API surface

Each API layer has a distinct contract. The coding agent must implement exactly this:

| API | Unknown command | Unbound/no context | Normal error in command |
|---|---|---|---|
| `executeCommandRaw` | Returns `CommandResult` with `error: 'Command not found: <name>'`; does **not** throw | Returns `CommandResult` with `error: 'CLI not ready'`; does **not** throw | Returns `CommandResult` with error field set |
| `cli.exec` | **Throws** `Error('Command not found: <name>')` | **Throws** `Error('CLI not ready: ...')` | Re-throws or throws with error text |
| `cli.execText` | Does **not** throw; returns `{ text: '', error: 'Command not found: <name>' }` | Does **not** throw; returns `{ text: '', error: 'CLI not ready: ...' }` | Does **not** throw; returns `{ text, error }` |
| `cli.execRaw` | Same behavior as `cli.exec` (throws) | Throws | Re-throws |

Rationale: `executeCommandRaw` is the shell's execution layer — the shell must never crash on bad input, only display error output. `cli.exec`/`cli.execRaw` are programmatic APIs where throwing is the idiomatic signal for the caller. `cli.execText` is the safe wrapper for scripting contexts where the caller inspects `error` instead of catching.

### Notes
- Do not alter existing command semantics

---

## Step 2 — Refactor InteractiveShell to shared runtime

### Modify
- `naveditor-lib/src/components/InteractiveShell.tsx`

### Changes
- Replace inline parsing/dispatch logic in `executeCommand` with `executeCommandRaw` from shared runtime
- Keep UI history rendering exactly as-is
- **Remove internal `createFilesystemDriver()` call** — `InteractiveShell` must no longer create its own driver instance. Accept `driver` as a prop instead (nullable: `driver?: IFilesystemDriver | null`). This eliminates the dual-driver problem where the shell and `App.tsx` each own a separate driver with potentially diverging state.
- Keep `connectivity` acquisition as-is (internal `useState` with `BrowserConnectivityService` is fine since it is stateless)
- Keep `session` and `config` acquisition as-is
- Build context object once per execution and pass to shared runtime

### Success condition
- No direct call to `commands[...]` remains in `InteractiveShell.tsx`
- `InteractiveShell` does not call `createFilesystemDriver()` internally

---

## Step 3 — Refactor console helpers to use shared runtime and bound context

### Modify
- `naveditor-web/src/console-helpers.ts`
- `naveditor-lib/src/web/console-helpers.ts`

### Required changes
- Remove any local/global `createDevalboStore()` singleton in console helper
- Add runtime source binding API (`bindCliRuntimeSource`, `unbindCliRuntimeSource`)
- `cli.exec(...)` must fail with clear error when runtime source is not bound or context missing
- Use `executeCommand`/`executeCommandRaw` from shared runtime
- Keep `extractText` helper but make it shared between `exec` and `execText`

### CLI API contract (must exist)
- `cli.exec(commandName: string, args?: string[], cwdOverride?: string): Promise<CommandResult>` — throws on unknown command or unbound context
- `cli.execRaw(raw: string, cwdOverride?: string): Promise<CommandResult>` — throws on unknown command or unbound context
- `cli.execText(commandName: string, args?: string[], cwdOverride?: string): Promise<{ text: string; error: string | null }>` — never throws; error captured in return value
- `cli.status(): { ready: boolean; missing: string[] }` — synchronous, never throws
- Existing convenience wrappers (`pwd`, `ls`, `cat`, etc.) should delegate to `exec` (and thus throw on failure)

See Step 1 error semantics table for the full per-API contract.

---

## Step 3b — Lift CWD state out of InteractiveShell into App

**Decision**: `window.cli` and `InteractiveShell` must share one CWD. This requires lifting `cwd`/`setCwd` out of `InteractiveShell`'s internal state and into `App.tsx` (or `AppContent`), so both the shell and the console helper binding operate on the same value.

### Modify
- `naveditor-web/src/App.tsx` (and `naveditor-desktop/src/App.tsx` if applicable)
- `naveditor-lib/src/components/InteractiveShell.tsx`

### Changes

**In `App.tsx` / `AppContent`:**
- Add `cwd` state: `const [cwd, setCwd] = useState('/')`
- Pass `cwd` and `setCwd` as props to `InteractiveShell`

**In `InteractiveShell.tsx`:**
- Remove internal `const [cwd, setCwd] = useState(...)`
- Accept `cwd: string` and `setCwd: (next: string) => void` as required props
- Keep all existing CWD initialization logic (Node.js `process.cwd()` detection) but move it into the `useState` initializer in `App.tsx`

### Result
- `cd` executed from the in-app terminal updates `cwd` in `App` state, which re-renders `InteractiveShell` with the new prompt path
- `cd` executed via `window.cli` (after Step 4 binding) calls the same `setCwd`, updating the shell's visible prompt
- The console helper binding (Step 4) reads the same `cwd` ref, so `pwd` from `window.cli` always reflects the shell's current directory

### Success condition
- `InteractiveShell` has no internal `cwd` state
- `InteractiveShell`'s `cwd` prop is the single source of truth shared with the runtime binding

---

## Step 4 — Bind console runtime to live app state

### Modify
- `naveditor-web/src/App.tsx`
- `naveditor-desktop/src/App.tsx`
- `naveditor-lib/src/web/App.tsx`

All three `AppContent` components must include the bind/unbind effect. Without it, `window.cli.status()` will report `ready: false` and all `cli.exec` calls will throw, even after the app has fully initialized.

### Required behavior — identical in all three apps
- On app mount/update, bind runtime source to *live* state providers:
  - `store`
  - `session`
  - `config`
  - `driver`
  - `connectivity`
  - `cwd` + `setCwd` (lifted from `InteractiveShell` in Step 3b — same state)
- On unmount, call `unbindCliRuntimeSource()`
- Ensure binding updates when `session`, `config`, `driver`, or `cwd` changes (i.e. include them in the effect dependency array via refs)

### Implementation pattern (expected shape — use this, not ad-hoc variations)

```ts
// In AppContent:
const cwdRef = useRef(cwd);
const sessionRef = useRef(session);
const driverRef = useRef(driver);
const configRef = useRef(config);
// Keep refs in sync with current values (runs every render, before effects)
cwdRef.current = cwd;
sessionRef.current = session;
driverRef.current = driver;
configRef.current = config;

useEffect(() => {
  bindCliRuntimeSource({
    getContext: () => {
      // All-or-nothing readiness: CLI is not ready until driver is initialized.
      // This keeps status().ready unambiguous — no partial-ready states where
      // some commands work and others don't.
      if (!store || !driverRef.current) return null;
      return {
        store,
        session: sessionRef.current,
        config: configRef.current,
        driver: driverRef.current,
        connectivity,
        cwd: cwdRef.current,
        setCwd,
      };
    },
  });
  return () => unbindCliRuntimeSource();
}, [store, connectivity, setCwd]); // stable deps only — refs handle the rest
```

`store`, `connectivity`, and `setCwd` are stable references (created once); they are the only real deps. All values that change over time (`cwd`, `session`, `driver`, `config`) are read through refs inside `getContext()`, so the effect does not re-run or re-register the source on every update.

### Success condition
- `window.cli.status().ready === true` immediately after the app has mounted and initialized its driver in all three app targets

---

## Step 5 — Window exposure policy

### Modify
- `naveditor-web/src/main.tsx`
- `naveditor-lib/src/web/index.tsx`

### Behavior
- Keep `window.cli` exposure as intentional feature
- Prefer gating in non-prod builds:
  - `if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_WINDOW_CLI === 'true') window.cli = cli;`
- If not gated, explicitly document that behavior in comments

---

## Step 6 — Tests for parity and drift prevention

### Create
- `naveditor/tests/unit/lib/command-runtime.test.ts`
- `naveditor/tests/unit/web/console-helpers.test.ts`

### Update
- `naveditor/tests/unit/components/InteractiveShell.test.tsx` (or add new shell test file)

### Test cases (minimum)

#### command-runtime.test.ts
1. `parseCommandLine('ls /')` returns `{ commandName: 'ls', args: ['/'] }` — delegates to formal `parseCommand`
2. `executeCommandRaw('')` returns no-op `CommandResult` with no error and no throw
3. `executeCommandRaw('definitely-not-a-command')` returns `CommandResult` with `error: 'Command not found: ...'` — does **not** throw
4. options forwarding: command receives context fields passed through `buildCommandOptions`

#### console-helpers.test.ts
1. `cli.status().ready === false` before binding
2. `cli.exec(...)` **throws** before binding (unbound context)
3. `cli.execText(...)` **does not throw** before binding; returns `{ text: '', error: 'CLI not ready: ...' }`
4. after binding, `cli.exec('pwd')` returns `CommandResult` from shared runtime (no throw)
5. after binding, `cli.exec('definitely-not-a-command')` **throws** `Error('Command not found: ...')`
6. after binding, `cli.execText('definitely-not-a-command')` does **not** throw; returns `{ text: '', error: 'Command not found: ...' }`
7. rebinding swaps context (verify changed store/cwd reflected in subsequent `exec` output)

#### InteractiveShell test
1. submit path calls shared runtime function (`executeCommandRaw`) rather than direct `commands[...]`
2. history still records command and output

---

## Step 7 — Backward compatibility behavior

- Keep existing `window.cli` method names where possible
- If any method signature changes, keep aliases and log one-line deprecation warning

---

## Step 8 — Post-implementation verification (to execute)

Run these commands in order and capture failures.

### Automated verification

1. Build core packages:
```bash
pnpm --filter @devalbo/shared build
pnpm --filter @devalbo/state build
pnpm --filter @devalbo/solid-client build
pnpm --filter @devalbo/naveditor-lib type-check
```

2. Run targeted new tests:
```bash
pnpm --filter naveditor exec vitest run tests/unit/lib/command-runtime.test.ts
pnpm --filter naveditor exec vitest run tests/unit/web/console-helpers.test.ts
```

3. Run full unit suite:
```bash
pnpm --filter naveditor test:unit
```

4. Build app targets:
```bash
pnpm --filter naveditor-web build
pnpm --filter naveditor-desktop build:web
```

### Manual verification (browser)

In web app:

1. Open app and devtools console.
2. Run `window.cli.status()`.
   - Expected: `ready: true` after app runtime is initialized.
3. Run:
   - `await window.cli.exec('pwd')`
   - `await window.cli.exec('help')`
   - Expected: same output semantics as terminal tab.
4. In terminal tab, run a state-mutating command (e.g. add a sync root/contact).
5. In console, run relevant listing command and verify mutation is visible.
   - Confirms shared live store.
6. Authenticate Solid from UI, then run a Solid command in console (`solid-whoami` via `exec`).
   - Confirms shared live session.
7. Refresh page and re-check `window.cli.status()` and command execution.
   - Confirms binding lifecycle survives app re-init.

### Direct browser testing (copy/paste script)

Use this in DevTools Console after the app has loaded:

```js
// 1) Presence + readiness
console.assert(!!window.cli, 'window.cli should exist');
const s1 = window.cli.status();
console.log('cli.status (initial):', s1);
console.assert(typeof s1.ready === 'boolean', 'status.ready should be boolean');

// 2) Basic command parity checks
const pwdResult = await window.cli.execText('pwd');
console.log('pwd:', pwdResult);
console.assert(!pwdResult.error, 'pwd should not error');

const helpResult = await window.cli.execText('help');
console.log('help:', helpResult);
console.assert(!helpResult.error, 'help should not error');
console.assert(helpResult.text.includes('pwd'), 'help output should include standard commands');

// 3) Files command path (if file sync commands are enabled in this build)
const rootsBefore = await window.cli.execText('files-root-list');
console.log('files-root-list (before):', rootsBefore);

// 4) Unknown command behavior
let unknownFailed = false;
try {
  await window.cli.exec('definitely-not-a-command');
} catch (e) {
  unknownFailed = true;
  console.log('unknown command error:', String(e));
}
console.assert(unknownFailed, 'Unknown command should throw/fail clearly');

// 5) Re-check status after some commands
const s2 = window.cli.status();
console.log('cli.status (after):', s2);
console.assert(s2.ready === true, 'CLI should remain ready after command execution');
```

Expected:

1. `window.cli` exists.
2. `window.cli.status().ready` is `true` once runtime binding is complete.
3. `pwd` / `help` run without errors and return text output.
4. Unknown command fails with a clear error.
5. `status()` remains ready after multiple executions.

### Direct browser testing (state parity check)

This verifies dev-console and in-app terminal share the same live store/session.

1. In app terminal, run a mutating command (example): `files-root-add /home/ https://example.com/files/ --label demo --web-id https://alice.example/profile#me`.
2. In DevTools Console:
```js
const roots = await window.cli.execText('files-root-list');
console.log(roots.text);
```
3. Confirm the newly-added root appears in console output.
4. Remove it from either path (terminal or console) and verify the other path sees the change immediately.

If this round-trip works, store parity is confirmed.

### Desktop manual sanity check (naveditor-desktop webview DevTools)

Open the desktop app and enable DevTools (Tauri: right-click → Inspect, or launch with `WEBKIT_WEBINSPECTOR_SERVER` / `--remote-debugging-port` depending on the shell). Then run:

```js
// 1) CLI present and ready
console.assert(!!window.cli, 'window.cli should exist on desktop');
const s = window.cli.status();
console.log('desktop cli.status:', s);
console.assert(s.ready === true, 'CLI should be ready after app init');

// 2) Basic command parity
const pwd = await window.cli.execText('pwd');
console.log('desktop pwd:', pwd);
console.assert(!pwd.error, 'pwd should not error on desktop');

// 3) Unknown command throws
let threw = false;
try { await window.cli.exec('no-such-command'); } catch { threw = true; }
console.assert(threw, 'unknown command should throw on desktop');
```

Expected: identical behavior to the web checks above. If `status().ready` is `false`, the bind effect in `naveditor-desktop/src/App.tsx` (Step 4) did not execute correctly.

---

## App Structure Parity

Three app environments exist. They must follow a single canonical structural pattern so that conventions stay in sync as the codebase grows.

### Canonical App Pattern

```
main.tsx / index.tsx
├── window.cli = cli  (env-gated: DEV || VITE_ENABLE_WINDOW_CLI)
└── render <App />

App (root component)
├── const [store] = useState(() => createDevalboStore())   ← lazy initializer, NOT useMemo
├── useEffect: store persistence (createLocalPersister or platform equivalent)
├── SolidSessionProvider
├── AppConfigProvider (shared defaultAppConfig)
└── AppContent (store prop)
    ├── const [cwd, setCwd] = useState(...)               ← lifted from InteractiveShell (Step 3b)
    ├── const [driver, setDriver] = useState(null)
    ├── const [watcher, setWatcher] = useState(null)
    ├── const [syncRoots, setSyncRoots] = useState(...)
    ├── useEffect: driver + watcher init
    ├── useEffect: syncRoots table listener
    ├── useEffect: social sync (feature-gated)
    ├── useEffect: file sync map (feature-gated)
    ├── useEffect: post-login Solid profile sync
    ├── useEffect: bindCliRuntimeSource (Step 4)
    ├── SolidSyncBar
    └── InteractiveShell (store, config, driver, cwd, setCwd)
```

The `naveditor-lib/src/web` dev App is intentionally simpler (no social features, no file sync), but must still follow the same conventions for the parts it does include.

### Step 9 — Consolidate console-helpers into single canonical source

**Problem**: Two separate console-helper files with diverging method sets exist. After Step 3 adds binding/unbinding to both, they will diverge further.

#### Modify
- `naveditor-lib/src/web/console-helpers.ts` — becomes the **canonical implementation** (it has the fuller method set)
- `naveditor-web/src/console-helpers.ts` — becomes a **thin re-export**:
  ```ts
  export { cli } from '@/web/console-helpers'; // re-export from naveditor-lib
  ```

#### Requirements
- All methods in both current files must be present in the canonical lib version after merge
- The canonical version is the one modified in Steps 1–5; the web version just re-exports
- `naveditor-desktop` if/when it gets console helpers also re-exports from lib

---

### Step 10 — Consolidate shared `defaultAppConfig`

**Problem**: `naveditor-web/src/config.ts` and `naveditor-desktop/src/config.ts` are byte-for-byte identical. Any future config change must be made in two places.

#### Create
- `naveditor-lib/src/web/config.ts` — move the shared `defaultAppConfig` here and export it

#### Modify
- `naveditor-web/src/config.ts` — replace contents with:
  ```ts
  export { defaultAppConfig } from '@/web/config';
  ```
- `naveditor-desktop/src/config.ts` — replace contents with:
  ```ts
  export { defaultAppConfig } from '@/web/config';
  ```

Both apps already resolve `@` to `naveditor-lib/src` via their Vite + TypeScript alias configuration (confirmed: both import `'@/components/InteractiveShell'` today). No `exports` map change to `naveditor-lib/package.json` is needed.

Do **not** use `@devalbo/naveditor-lib/web/config` — `naveditor-lib` has no `exports` field and subpath imports via the package name would fail to resolve.

#### Note
If web and desktop legitimately need different configs (e.g. different `storageKey`, different `features` flags), split into a `baseAppConfig` (shared) + per-app overrides rather than full duplication.

---

### Step 11 — Bring `naveditor-lib/src/web/App.tsx` up to standard

**Current state**: renders `<InteractiveShell />` with no props, no `SolidSessionProvider`, no `AppConfigProvider`, no store, no driver, no CWD.

#### Modify
- `naveditor-lib/src/web/App.tsx`

#### Required changes
- Wrap with `SolidSessionProvider` and `AppConfigProvider` (using `defaultAppConfig` from Step 10)
- Create store via `useState(() => createDevalboStore())`
- Add store persistence via `createLocalPersister`
- Add `driver` state from `createFilesystemDriver()`
- Add `cwd`/`setCwd` state
- Pass `store`, `config`, `driver`, `cwd`, `setCwd` to `InteractiveShell`
- Add `bindCliRuntimeSource` effect (Step 4)

#### Note
Social and file-sync features remain absent in the lib dev App — `features.socialSync` and `features.fileSync` are `false` in the shared config, so their effects are no-ops. No additional UI tabs needed.

---

### Step 12 — Bring `naveditor-desktop/src/App.tsx` up to standard

**Gaps vs. `naveditor-web`:**
- No `SolidSyncBar`
- No post-login Solid profile sync (`fetchWebIdProfile` merge effect)
- No store persistence
- Store created with `useState` (correct) but needs persister
- `InteractiveShell` missing `driver`, `cwd`, `setCwd` props (shared gap with web, addressed in Steps 2/3b)

#### Modify
- `naveditor-desktop/src/App.tsx`

#### Required changes
1. **Add store persistence**: add `createLocalPersister` effect (same as web). If a Tauri-specific persister exists or is planned, use that instead — but do not leave it with no persistence.
2. **Add `SolidSyncBar`**: add `<SolidSyncBar store={store} config={config} />` to the header row.
3. **Add post-login Solid profile sync**: add the `fetchWebIdProfile` → persona merge effect (identical to `naveditor-web`). This should be extracted into a shared hook in `naveditor-lib` to avoid duplication — see Step 13.
4. **Pass `driver`, `cwd`, `setCwd` to `InteractiveShell`**: follows from Steps 2/3b.

---

### Step 13 — Extract post-login Solid profile sync into a shared hook

**Problem**: The `fetchWebIdProfile` → merge → `setPersona` logic in `naveditor-web/src/App.tsx` (lines 131–165) is non-trivial and would need to be duplicated into `naveditor-desktop` and `naveditor-lib/src/web` if left inline.

#### Create
- `naveditor-lib/src/hooks/useSolidProfileSync.ts`

#### Export
```ts
export const useSolidProfileSync = (store: DevalboStore): void => {
  // encapsulates the session.isAuthenticated → fetchWebIdProfile → merge → setPersona effect
};
```

#### Modify
- `naveditor-web/src/App.tsx` — replace inline effect with `useSolidProfileSync(store)`
- `naveditor-desktop/src/App.tsx` — add `useSolidProfileSync(store)` (Step 12 item 3)
- `naveditor-lib/src/web/App.tsx` — add `useSolidProfileSync(store)` (Step 11, even if Solid is not active — the hook is a no-op when `session` is null)

---

### Step 14 — Fix store creation style: `useState` everywhere

**Problem**: `naveditor-web` uses `useMemo(() => createDevalboStore(), [])` for store creation. `naveditor-desktop` correctly uses `useState(() => createDevalboStore())`. `useMemo` is not guaranteed to be stable across future React versions; `useState` with a lazy initializer is the documented pattern for one-time initialization.

#### Modify
- `naveditor-web/src/App.tsx` line 245: change `useMemo(() => createDevalboStore(), [])` → `useState(() => createDevalboStore())[0]` (or `const [store] = useState(() => createDevalboStore())`)

---

### Step 15 — Add `window.cli` to `naveditor-desktop`

**Current state**: `naveditor-desktop/src/main.tsx` has no console-helper import or `window.cli` assignment. There is also no `naveditor-desktop/src/console-helpers.ts` today.

#### Create
- `naveditor-desktop/src/console-helpers.ts` — a one-line re-export from the canonical lib helpers:
  ```ts
  export { cli } from '@/web/console-helpers';
  ```
  (`@` resolves to `naveditor-lib/src` in the desktop Vite/tsconfig alias, same as web.)

#### Modify
- `naveditor-desktop/src/main.tsx` — add import and env-gated exposure:
  ```ts
  import { cli } from './console-helpers';

  declare global {
    interface Window {
      cli: typeof cli;
    }
  }

  if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_WINDOW_CLI === 'true') {
    window.cli = cli;
  }
  ```

#### Note
The canonical implementation lives in `naveditor-lib/src/web/console-helpers.ts` (Step 9). Desktop imports through its own thin re-export file for consistency with the web pattern and to allow future desktop-specific overrides without touching lib.

---

## Acceptance Criteria

**CLI parity (Steps 1–8):**
- `InteractiveShell` and `window.cli` both execute commands through shared runtime module.
- Console helper no longer creates isolated store.
- Console helper reports readiness and fails clearly when unbound.
- `InteractiveShell` receives `driver` as a prop; it does not create its own driver instance.
- `cwd`/`setCwd` is owned by `App`/`AppContent` and shared with both `InteractiveShell` (prop) and the `window.cli` runtime binding — a `cd` from either path updates the terminal prompt.
- Parity tests added and passing.

**App structure parity (Steps 9–15):**
- One canonical console-helpers implementation in `naveditor-lib`; web and desktop re-export from it.
- One `defaultAppConfig` in `naveditor-lib`; web and desktop import from it.
- All three app environments wrap with `SolidSessionProvider` + `AppConfigProvider`.
- All three app environments pass `store`, `config`, `driver`, `cwd`, `setCwd` to `InteractiveShell`.
- All browser app environments have store persistence.
- `naveditor-desktop` has `SolidSyncBar` and post-login Solid profile sync.
- Post-login Solid profile sync extracted to `useSolidProfileSync` hook; no duplication across apps.
- Store creation uses `useState` lazy initializer in all apps.
- `window.cli` is exposed (env-gated) in all three app entry points.

**Build / test:**
- Full unit suite + builds pass for all three app targets.

---

## Risks / Edge Cases

1. **Stale binding after auth changes**
   - Mitigation: reactive bind/update with refs + effect dependencies.
2. **CWD drift between shell and console helper**
   - Resolved by design: `cwd`/`setCwd` lifted to `App` in Step 3b; both consumers share the same state.
3. **Production exposure of `window.cli`**
   - Mitigation: env gate and explicit comment.
4. **`InteractiveShell` used outside of `App` without a `driver` prop**
   - `driver` is nullable (`IFilesystemDriver | null`); commands that need a driver already handle the undefined case gracefully. No regression expected, but verify any standalone `InteractiveShell` usage in tests or stories passes `driver={null}` explicitly.
5. **Desktop app (`naveditor-desktop`) also renders `InteractiveShell`**
   - Covered by Steps 12 and 15. Desktop has its own `createFilesystemDriver()` call in `AppContent` which correctly becomes the driver source for the prop.

---

## Suggested Commit Structure

**CLI parity:**
1. `refactor(naveditor-lib): extract shared command runtime for shell and helpers`
2. `refactor(naveditor-lib): lift cwd and driver out of InteractiveShell into App`
3. `refactor(web): bind window.cli to live app runtime context`
4. `test(naveditor): add command-runtime and console-helper parity tests`
5. `chore(web): gate window.cli exposure in production`

**App structure parity:**
6. `refactor(naveditor-lib): consolidate console-helpers as canonical source, web re-exports`
7. `refactor(naveditor-lib): consolidate defaultAppConfig as shared source`
8. `refactor(naveditor-lib): extract useSolidProfileSync hook`
9. `refactor(naveditor-lib): bring lib dev App up to canonical structure`
10. `refactor(naveditor-desktop): bring desktop App up to canonical structure`
11. `chore(naveditor-web): fix store creation to use useState lazy initializer`
12. `chore(naveditor-desktop): add window.cli env-gated exposure`
