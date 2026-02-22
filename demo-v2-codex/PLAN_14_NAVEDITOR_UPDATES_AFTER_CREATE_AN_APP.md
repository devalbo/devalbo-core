# Plan 14: Naveditor Updates After CREATE_AN_APP

## Goal

Bring the naveditor application fully in line with the patterns documented in `CREATE_AN_APP.md` (Plan 13). After Plan 13, naveditor is presented as the reference app built on `@devalbo/cli-shell` — it should exemplify every recommended pattern so developers can study it with confidence.

**Prerequisite:** Plan 13 (documentation layer) is **complete and verified** — `CREATE_AN_APP.md` uses `@devalbo/cli-shell` as the primary import source (not `@devalbo/editor-lib`), `examples/hello-cli/` exists and runs, `welcomeMessage` is required on `InteractiveShell` and `CliEntryOptions`, all type-checks pass.

### What Plan 13 already handles (not repeated here)

These changes to naveditor files are part of Plan 13 itself (Step 1b-iv) because they're required for type-checking to pass once `welcomeMessage` becomes required:

- `naveditor-web/src/App.tsx` — add `welcomeMessage` prop to `<InteractiveShell>`
- `naveditor-desktop/src/App.tsx` — add `welcomeMessage` prop to `<InteractiveShell>`

### What Plan 14 covers

Changes that improve naveditor's alignment with documented patterns but are NOT required for Plan 13 to type-check. These are the TODOs explicitly deferred by Plan 13.

---

## Step 0 — Preflight

```sh
pnpm install
pnpm --filter naveditor test:unit
pnpm --filter @devalbo/cli-shell run type-check
pnpm --filter @devalbo/editor-lib run type-check
pnpm --filter naveditor-web run type-check
pnpm --filter naveditor-desktop run type-check
```

All must pass. Confirm Plan 13 is complete:
- `welcomeMessage` is required on `InteractiveShell` (not optional)
- `naveditor-web/src/App.tsx` passes `welcomeMessage`
- `naveditor-desktop/src/App.tsx` passes `welcomeMessage`
- `examples/hello-cli/` exists, type-checks, and uses `registerBuiltinCommands`
- `CREATE_AN_APP.md` references naveditor as a framework app

---

## Step 1 — Switch `editor-lib/src/program.ts` to `registerBuiltinCommands`

This is the primary change. naveditor currently manually registers all 16 built-in commands (pwd, cd, ls, tree, stat, clear, cat, touch, mkdir, cp, mv, rm, backend, export, import, exit) plus its app-specific commands. The documented pattern uses `registerBuiltinCommands(program)` for the builtins.

### Current state (86 lines, manual registration)

```ts
// editor-lib/src/program.ts — BEFORE
import { Command } from 'commander';

export function createProgram() {
  const program = new Command();
  const collect = (value: string, previous: string[]) => [...previous, value];

  program.name('naveditor').description('Basic file terminal app').version('0.1.0');

  // 16 manually registered built-in commands...
  program.command('pwd').description('Print current directory');
  program.command('cd').description('Change current directory').argument('<path>', 'Directory path');
  program.command('ls').description('List files in a directory').argument('[path]', 'Directory path', '.');
  // ... etc (lines 12–63)

  // App-specific commands (lines 32–83)
  program.command('solid-export')...
  program.command('persona')...
  // ...

  return program;
}
```

### Target state

```ts
// editor-lib/src/program.ts — AFTER
import { Command } from 'commander';
import { registerBuiltinCommands } from '@devalbo/cli-shell';

export function createProgram() {
  const program = new Command();
  const collect = (value: string, previous: string[]) => [...previous, value];

  program.name('naveditor').description('Basic file terminal app').version('0.1.0');

  // ─── App-specific commands ─────────────────────────────────────────
  program
    .command('solid-export')
    .description('Export social entities as a Solid JSON-LD bundle')
    .argument('[output]', 'Output JSON file path', 'social-data.json');
  program
    .command('solid-import')
    .description('Import social entities from a Solid JSON-LD bundle file')
    .argument('<file>', 'Solid JSON-LD bundle file path');
  program
    .command('solid-fetch-profile')
    .description('Fetch a public Solid WebID profile as JSON-LD')
    .argument('<webId>', 'WebID URL');
  program
    .command('solid-login')
    .description('Authenticate with a Solid OIDC issuer')
    .argument('<issuer>', 'OIDC issuer URL');
  program
    .command('solid-logout')
    .description('Clear active Solid session');
  program
    .command('solid-whoami')
    .description('Show authenticated Solid WebID');
  program
    .command('solid-pod-push')
    .description('Push social data to your Solid POD');
  program
    .command('solid-pod-pull')
    .description('Pull social data from your Solid POD');
  program
    .command('solid-share-card')
    .description('Send your persona card to a contact inbox')
    .argument('<contactId>', 'Contact row id');
  program.command('interactive').description('Start interactive terminal session');
  program
    .command('persona')
    .description('Manage personas (list, create, show, edit, delete, set-default)')
    .argument('<subcommand>')
    .argument('[args...]', '', collect, []);
  program
    .command('contact')
    .description('Manage contacts (list, add, show, edit, delete, search, link)')
    .argument('<subcommand>')
    .argument('[args...]', '', collect, []);
  program
    .command('group')
    .description('Manage groups (list, create, show, edit, delete, add-member, remove-member, list-members)')
    .argument('<subcommand>')
    .argument('[args...]', '', collect, []);

  // ─── Built-in commands (pwd, cd, ls, tree, cat, etc.) ──────────────
  registerBuiltinCommands(program);

  return program;
}
```

### Key changes

1. **Add import:** `import { registerBuiltinCommands } from '@devalbo/cli-shell';`
2. **Remove 16 manual built-in registrations:** pwd, cd, ls, tree, stat, clear, cat, touch, mkdir, cp, mv, rm, backend, export, import, exit — plus the `help` command (which `registerBuiltinCommands` provides as part of system commands)
3. **Keep all app-specific registrations:** solid-*, interactive, persona, contact, group
4. **Call `registerBuiltinCommands(program)` after app-specific commands** — this matches the hello-cli example pattern and ensures `help` displays everything

### What changes in built-in command metadata

`registerBuiltinCommands` uses slightly different argument syntax than the manual registrations. For example:

| Manual (current) | registerBuiltinCommands |
|---|---|
| `program.command('cd').argument('<path>')` | `program.command('cd <path>')` |
| `program.command('ls').argument('[path]', ..., '.')` | `program.command('ls [path]')` |
| `program.command('stat').argument('<path>')` | `program.command('stat <path>')` |

This is functionally equivalent — commander handles both forms the same way. The help text descriptions may differ slightly (e.g., "Print current directory" → "Print working directory") but these are cosmetic.

### What about `export` and `import`?

These are **naveditor app-specific commands** (defined in `editor-lib/src/commands/io.ts`), NOT cli-shell built-in commands. They are currently manually registered in program.ts alongside the builtins:

```ts
program.command('export').description('Export a directory as BFT JSON')...
program.command('import').description('Import BFT JSON...')...
```

These must remain as manual app-specific registrations. They are NOT part of `registerBuiltinCommands`.

**Wait — check if `registerBuiltinCommands` overlaps:** `registerBuiltinCommands` does NOT register `export` or `import`. It registers: pwd, cd, ls, tree, cat, touch, mkdir, cp, mv, rm, stat (filesystem), clear, backend, exit, help (system), app-config (app). So there is no conflict.

**But:** The current manual registration includes `export` and `import` in the "built-in" block. These must be moved to the app-specific block.

Updated target — add export/import to the app-specific section:

```ts
  // ─── App-specific commands ─────────────────────────────────────────
  program
    .command('export')
    .description('Export a directory as BFT JSON')
    .argument('[path]', 'Source directory path', '.')
    .argument('[output]', 'Output .bft/.json file path');
  program
    .command('import')
    .description('Import BFT JSON (browser/Tauri picks a file when no bftFile is provided)')
    .argument('[bftFile]', 'BFT file path')
    .argument('[location]', 'Target directory name/path');
  // ... rest of app-specific commands
```

### Verification

```sh
pnpm --filter @devalbo/editor-lib run type-check
pnpm --filter naveditor test:unit
```

Then manual check:
- Start naveditor in any entry point (web, desktop, or terminal)
- Run `help` — verify all commands appear (builtins + app-specific)
- Run `pwd`, `ls`, `cd /` — builtins work
- Run `export .`, `persona list` — app-specific commands work

---

## Step 2 — Add `app-config` command to naveditor

`registerBuiltinCommands` registers `app-config` as a built-in command (it's part of `appCommands`). naveditor already spreads `appCommands` in its command registry (`editor-lib/src/commands/index.ts` line 30), so the `app-config` handler is available.

However, the old manual program.ts did NOT register `app-config` — it registered `help`, `exit`, and the filesystem commands, but not `app-config`. After Step 1, `registerBuiltinCommands` adds it, so `help` will show `app-config` and it will work. No additional changes needed — this is a free bonus from switching to `registerBuiltinCommands`.

**Verification:** After Step 1, run `app-config` in naveditor — it should display the current AppConfig.

---

## Step 3 — Switch `editor-lib/src/commands/index.ts` to `mergeCommands`

naveditor currently uses object spread (`{ ...groupA, ...groupB }`) to compose its command registry. This silently shadows handlers if two groups define the same command name. Switch to `mergeCommands` from `@devalbo/cli-shell`, which throws at startup on any duplicate.

### Current state

```ts
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
  navigate: async (...) => filesystemCommands.ls(...),
  edit: async (...) => filesystemCommands.cat(...)
};
```

### Target state

```ts
import { mergeCommands, filesystemCommands, systemCommands, appCommands } from '@devalbo/cli-shell';

const baseCommands = mergeCommands(
  filesystemCommands,
  systemCommands,
  ioCommands,
  solidCommands,
  filesCommands,
  appCommands
);

export const commands: CommandMap = mergeCommands(
  baseCommands,
  {
    persona: personaCommand,
    contact: contactCommand,
    group: groupCommand,
    navigate: async (args, options) => filesystemCommands.ls(args, options),
    edit: async (args, options) => filesystemCommands.cat(args, options)
  }
);
```

If any two groups define the same command name, the app will throw `Error: Duplicate command registration: "<name>"` at startup — catching the collision immediately rather than silently shadowing a handler.

### Verification

```sh
# Verify mergeCommands is imported
rg "mergeCommands" editor-lib/src/commands/index.ts
# Expected: import and two call sites

# Verify no bare object spreads remain for command composition
rg "\.\.\.filesystemCommands|\.\.\.systemCommands|\.\.\.appCommands" editor-lib/src/commands/index.ts
# Expected: no matches (all composition goes through mergeCommands)

# Type-check
pnpm --filter @devalbo/editor-lib run type-check
```

---

## Step 4 — Review `editor-lib/src/cli.tsx` against documented patterns

`CREATE_AN_APP.md` documents `startInteractiveCli()` as the primary CLI entry point. naveditor's `editor-lib/src/cli.tsx` does NOT use `startInteractiveCli()` — it renders `InteractiveShell` directly.

### Decision: Keep the current approach

naveditor's cli.tsx is intentionally more complex than the documented quickstart pattern because:

1. **Dual-mode support:** It handles both interactive mode (`interactive` command or no args) and batch mode (direct command execution from argv). `startInteractiveCli` only supports interactive mode.
2. **Custom store lifecycle:** It creates the store at the top level and shares it across both modes.
3. **`driver={null}`:** The terminal entry point currently passes `driver={null}` to `InteractiveShell`. This is a current implementation detail — the built-in filesystem commands fall back to Node.js `fs` operations when no driver is provided. This behavior is not a guaranteed architectural contract and may change if `startInteractiveCli` is extended.

No code changes needed. This step is verification only.

**Future consideration:** If `startInteractiveCli` gains batch-mode support, naveditor could be simplified. Beyond the scope of this plan.

---

## Step 5 — Verify import paths

All naveditor imports from the framework should use `@devalbo/cli-shell`, not internal package paths.

```sh
# Verify correct import sources
rg "from '@devalbo/cli-shell'" editor-lib/src/
# Expected: hits in commands/index.ts, cli.tsx, web/App.tsx

# Verify no internal cli-shell path imports
rg "from '@devalbo/cli-shell/src" editor-lib/src/ naveditor-web/src/ naveditor-desktop/src/
# Expected: no matches (all imports should be from the package root)

# Verify no stale naveditor-lib imports (deleted package)
rg "naveditor-lib" editor-lib/src/ naveditor-web/src/ naveditor-desktop/src/ naveditor-terminal/
# Expected: no matches
```

No changes expected. This step is verification only.

---

## Step 6 — Final verification

Run all checks from repo root:

```sh
# 1. Type-check all packages
pnpm --filter @devalbo/cli-shell run type-check
pnpm --filter @devalbo/editor-lib run type-check
pnpm --filter naveditor-web run type-check
pnpm --filter naveditor-desktop run type-check
pnpm --filter hello-cli run type-check

# 2. Run unit tests
pnpm --filter naveditor test:unit

# 3. Verify registerBuiltinCommands is used
rg "registerBuiltinCommands" editor-lib/src/program.ts
# Expected: one import line and one call

# 4. Verify no manual built-in command registration remains
# After Step 1, program.ts should NOT contain these patterns:
rg "command\('pwd'\)|command\('cd'\)|command\('ls'\)|command\('tree'\)|command\('stat'\)|command\('clear'\)|command\('cat'\)|command\('touch'\)|command\('mkdir'\)|command\('cp'\)|command\('mv'\)|command\('rm'\)|command\('backend'\)|command\('exit'\)|command\('help'\)" editor-lib/src/program.ts
# Expected: no matches (all handled by registerBuiltinCommands)

# 5. Verify app-specific commands still registered
rg "command\('solid-|command\('persona|command\('contact|command\('group|command\('interactive|command\('export|command\('import" editor-lib/src/program.ts
# Expected: hits for all app-specific commands
```

---

## Acceptance criteria

- [ ] `editor-lib/src/program.ts` uses `registerBuiltinCommands(program)` instead of manually registering 16+ built-in commands
- [ ] `editor-lib/src/program.ts` imports `registerBuiltinCommands` from `@devalbo/cli-shell`
- [ ] `editor-lib/src/program.ts` retains all app-specific command registrations (solid-*, persona, contact, group, interactive, export, import)
- [ ] `editor-lib/src/commands/index.ts` uses `mergeCommands()` instead of object spread for command composition
- [ ] Duplicate command names cause a startup error (enforced by `mergeCommands`, not by runtime luck)
- [ ] `app-config` command works in naveditor (provided by registerBuiltinCommands + appCommands)
- [ ] `help` output includes all commands (builtins from registerBuiltinCommands + app-specific)
- [ ] All import paths use `@devalbo/cli-shell` (not internal paths)
- [ ] No stale `naveditor-lib` references exist
- [ ] All type-checks pass (`cli-shell`, `editor-lib`, `naveditor-web`, `naveditor-desktop`, `hello-cli`)
- [ ] All unit tests pass (`pnpm --filter naveditor test:unit`)

---

## Scope notes

### What this plan does NOT cover

1. **Framework package changes** — cli-shell, shared, state, etc. are Plan 13's responsibility
2. **`welcomeMessage` required prop** — handled in Plan 13 Step 1b
3. **JSDoc on framework exports** — handled in Plan 13 Steps 2–3
4. **`examples/hello-cli/` creation** — handled in Plan 13 Step 4
5. **`CREATE_AN_APP.md` rewrite** — already updated to use `@devalbo/cli-shell`; further refinements are Plan 13 Step 6
6. **`docs/ARCHITECTURE.md`** — handled in Plan 13 Step 7
7. **Converting cli.tsx to use `startInteractiveCli`** — intentionally kept as-is (see Step 4 rationale)

### Why this plan is small

Plan 13's review (Step 5) found that naveditor already follows documented patterns correctly in most areas:
- Command composition uses individual groups (correct for its complexity)
- Import paths come from `@devalbo/cli-shell`
- `StoreCommandHandler` is used (not the old `SocialCommandHandler`)
- `welcomeMessage` is passed in `editor-lib/src/cli.tsx` and `editor-lib/src/web/App.tsx`
- `bindCliRuntimeSource` is wired correctly in browser/desktop shells
- Session casting pattern in `editor-lib/src/commands/solid.ts` matches the docs

The only significant gap is `editor-lib/src/program.ts` still using manual built-in command registration — which is the primary deliverable of this plan.
