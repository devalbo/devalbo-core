# Plan 15: Refactor for Integration (npm-first + devalbo-cli)

## Goal

Make devalbo-core easy for a new app author to use from a fresh directory with only `npm`, by providing:

1. A single app-facing package installable from git: `devalbo-cli`
2. A minimal browser + terminal reference app: `examples/hello-universal`
3. npm-only onboarding docs in `CREATE_AN_APP.md`

This plan assumes the author does **not** clone the monorepo unless they choose to contribute.

---

## Guiding Decisions

- External onboarding is npm-first and npm-only in docs.
- App authors import only from `devalbo-cli`.
- `@devalbo/cli-shell` remains a lower-level internal dependency surface.
- `examples/hello-universal` is the canonical onboarding reference (not `naveditor`).

---

## Deliverables

- Root/package install target: `devalbo-cli`
- External git install support via:
  - `npm install git+https://github.com/devalbo/devalbo-core.git`
- Example app:
  - `examples/hello-universal/` (terminal + browser + dev-console parity)
- Updated docs:
  - `CREATE_AN_APP.md` rewritten for npm-only external consumers
- Verification:
  - Internal monorepo checks
  - External fresh-directory smoke test using npm + git install

---

## Scope

### In scope

- Define and implement stable app-facing exports in `devalbo-cli`
- Build and verify browser + terminal hello app against that package
- Update docs to npm-only author workflow
- Add regression checks for API and parity

### Out of scope

- npm registry publishing
- Desktop/Tauri onboarding path
- Solid integration in hello-world flow

---

## Phase 0 — Distribution Contract (First)

Define the external contract before coding:

- Package name: `devalbo-cli`
- Install command:
  - `npm install git+https://github.com/devalbo/devalbo-core.git`
- Import contract:
  - All onboarding examples must import from `devalbo-cli`
- Semantics:
  - App-facing APIs are stable by intent
  - Internal package paths are not part of public contract

Output of this phase:

- A short API contract section in this plan listing required exports.

Required exports for onboarding:

- CLI/browser runtime:
  - `startInteractiveCli`
  - `InteractiveShell`
  - `bindCliRuntimeSource`
  - `unbindCliRuntimeSource`
  - `cli`
- Command composition:
  - `builtinCommands`
  - `registerBuiltinCommands`
  - `mergeCommands`
- Config:
  - `createCliAppConfig`
  - `defaultWelcomeMessage`
- Browser app wiring:
  - `createDevalboStore`
  - `AppConfigProvider`
  - `useAppConfig`
  - `StoreContext`
  - `createFilesystemDriver`
  - `BrowserConnectivityService`
- Command types/helpers:
  - `CommandHandler`, `AsyncCommandHandler`, `StoreCommandHandler`
  - `makeOutput`, `makeError`, `makeResult`, `makeResultError`

---

## Phase 1 — Implement `devalbo-cli`

Implementation tasks:

1. Add `devalbo-cli` package wiring so git install exposes the package cleanly.
2. Ensure package has valid `exports`, typings, and runtime build outputs.
3. Ensure git install yields consumable artifacts (via `prepare` or equivalent build strategy).
4. Ensure `devalbo-cli` re-exports only intended app-facing APIs.
5. Ensure external install path does not require workspace resolution.

Constraints:

- No onboarding docs may require importing from `@devalbo/*` packages directly.
- No onboarding docs may reference `src/*` internals.

### Export Map Checklist (exact symbols + owners)

Use this as the implementation checklist for `devalbo-cli` re-exports. Every symbol below must be exported by `devalbo-cli` and covered by a smoke usage in `examples/hello-universal`.

| Symbol | Current source owner | Notes |
|---|---|---|
| `startInteractiveCli` | `packages/cli-shell/src/cli-entry.tsx` | Terminal entry-point |
| `InteractiveShell` | `packages/cli-shell/src/components/InteractiveShell.tsx` | Browser/terminal UI shell |
| `bindCliRuntimeSource` | `packages/cli-shell/src/web/console-helpers.ts` | Browser dev-console runtime bind |
| `unbindCliRuntimeSource` | `packages/cli-shell/src/web/console-helpers.ts` | Browser dev-console runtime unbind |
| `cli` | `packages/cli-shell/src/web/console-helpers.ts` | Browser helper API |
| `builtinCommands` | `packages/cli-shell/src/index.ts` | Built-in command aggregate |
| `registerBuiltinCommands` | `packages/cli-shell/src/program-helpers.ts` | Commander metadata registration |
| `mergeCommands` | `packages/cli-shell/src/commands/_util.tsx` | Duplicate-command guard |
| `createCliAppConfig` | `packages/shared/src/app-config.ts` (re-exported via `packages/cli-shell/src/index.ts`) | CLI config factory |
| `defaultWelcomeMessage` | `packages/cli-shell/src/program-helpers.ts` | Welcome text helper |
| `createDevalboStore` | `packages/state/src/index.ts` | Browser app store bootstrap |
| `AppConfigProvider` | `packages/state/src/index.ts` | Browser app config provider |
| `useAppConfig` | `packages/state/src/index.ts` | Browser app config hook |
| `StoreContext` | `packages/state/src/index.ts` | Optional direct store context access |
| `createFilesystemDriver` | `packages/filesystem/src/index.ts` | Browser/terminal driver bootstrap |
| `BrowserConnectivityService` | `packages/shared/src/index.ts` | Browser connectivity runtime |
| `CommandHandler` | `packages/cli-shell/src/commands/_util.tsx` | Type export |
| `AsyncCommandHandler` | `packages/cli-shell/src/commands/_util.tsx` | Type export |
| `StoreCommandHandler` | `packages/cli-shell/src/commands/_util.tsx` | Type export |
| `ExtendedCommandOptions` | `packages/cli-shell/src/commands/_util.tsx` | Type export |
| `ExtendedCommandOptionsWithStore` | `packages/cli-shell/src/commands/_util.tsx` | Type export |
| `makeOutput` | `packages/cli-shell/src/commands/_util.tsx` | Command output helper |
| `makeError` | `packages/cli-shell/src/commands/_util.tsx` | Command output helper |
| `makeResult` | `packages/cli-shell/src/commands/_util.tsx` | Command output helper |
| `makeResultError` | `packages/cli-shell/src/commands/_util.tsx` | Command output helper |

`devalbo-cli` owner files to add/update:

- `package.json` (`devalbo-cli` package identity + exports)
- `devalbo-cli` entry file (`src/index.ts` or root entry) with explicit re-export list
- build/type config for distributable JS + d.ts

Verification for this checklist:

- Static check: `rg "export .*<symbol>"` on `devalbo-cli` entry
- Usage check: import/use every symbol at least once in `examples/hello-universal` or its tests

---

## Phase 2 — Build `examples/hello-universal` on `devalbo-cli` only

Create `examples/hello-universal/` using only `devalbo-cli` imports.

Files:

- `examples/hello-universal/package.json`
- `examples/hello-universal/tsconfig.json`
- `examples/hello-universal/index.html`
- `examples/hello-universal/src/commands.ts`
- `examples/hello-universal/src/program.ts`
- `examples/hello-universal/src/config.ts`
- `examples/hello-universal/src/cli.ts`
- `examples/hello-universal/src/App.tsx`
- `examples/hello-universal/src/main.tsx`
- `examples/hello-universal/src/console-helpers.ts`

Behavior requirements:

- Terminal and browser use shared `commands` + `createProgram`.
- `createProgram` uses `registerBuiltinCommands` once.
- `welcomeMessage` is explicit variable in both CLI and browser.
- Browser binds full runtime context for `window.cli`.
- Commands `hello` and `echo` behave identically across surfaces.

---

## Phase 3 — npm-only `CREATE_AN_APP.md`

Reorganize docs around external npm consumer workflow.

Required doc structure:

1. Start from fresh directory
2. Install from git with npm
3. Create hello app files
4. Run terminal
5. Run browser
6. Test browser dev-console CLI
7. Troubleshooting

Mandatory doc rules:

- Only npm commands in onboarding path.
- No pnpm instructions in app-author main path.
- No workspace/catelog/version-protocol language in external instructions.
- All code snippets import from `devalbo-cli` only.

---

## Phase 4 — Verification and Quality Gates

## Internal gate (repo contributor)

From repo root (maintainer flow):

```sh
pnpm install
pnpm --filter hello-universal run type-check
pnpm --filter hello-universal run test
pnpm --filter hello-universal run build
```

## External gate (app author reality)

From fresh directory outside repo:

```sh
mkdir devalbo-app-smoke && cd devalbo-app-smoke
npm init -y
npm install git+https://github.com/devalbo/devalbo-core.git
```

### Executable verification runbook (must be runnable by coding agent)

Use this exact sequence to confirm library updates are packaged, importable, and usable by a newly created app.

#### A) Verify package install + export surface in fresh npm project

```sh
mkdir devalbo-app-smoke && cd devalbo-app-smoke
npm init -y
npm install git+https://github.com/devalbo/devalbo-core.git
npm ls --depth=0
```

Create `verify-exports.mjs`:

```js
import * as devalbo from 'devalbo-cli';

const required = [
  'startInteractiveCli',
  'InteractiveShell',
  'bindCliRuntimeSource',
  'unbindCliRuntimeSource',
  'cli',
  'builtinCommands',
  'registerBuiltinCommands',
  'mergeCommands',
  'createCliAppConfig',
  'defaultWelcomeMessage',
  'makeOutput',
  'makeError',
  'makeResult',
  'makeResultError',
  'createDevalboStore',
  'AppConfigProvider',
  'useAppConfig',
  'StoreContext',
  'createFilesystemDriver',
  'BrowserConnectivityService'
];

const missing = required.filter((k) => !(k in devalbo));
if (missing.length) {
  console.error('Missing exports:', missing);
  process.exit(1);
}
console.log('Export check passed');
```

Run:

```sh
node verify-exports.mjs
```

Expected:

- prints `Export check passed`

#### B) Create new app from scratch (terminal + browser)

Create files exactly per `CREATE_AN_APP.md` npm path and import only from `devalbo-cli`.

Minimum project shape:

```text
devalbo-app-smoke/
  package.json
  tsconfig.json
  index.html
  src/
    commands.ts
    program.ts
    config.ts
    cli.ts
    App.tsx
    main.tsx
```

Required package scripts:

- `type-check`
- `start:terminal`
- `start:browser`
- `build`

#### C) Type-check + build verification

```sh
npm run type-check
npm run build
```

Expected:

- both commands exit 0

#### D) Terminal runtime smoke test

```sh
npm run start:terminal
```

In terminal app, execute:

- `help`
- `hello`
- `hello Alice`
- `echo foo bar`
- `app-config`

Expected:

- no runtime crashes
- command outputs match documented behavior

#### E) Browser runtime + devtools smoke test

```sh
npm run start:browser
```

In browser shell UI, execute:

- `help`
- `hello Alice`
- `echo foo bar`
- `app-config`

In browser devtools console, execute:

```js
await cli.exec('hello', ['Alice']);
await cli.execRaw('echo foo bar');
await cli.execText('help', []);
await cli.execText('app-config', []);
```

Expected:

- command results are returned successfully
- `help` includes app and built-in commands
- devtools API behavior matches shell behavior

#### F) Update propagation check (library change is actually reflected)

After making a façade export or runtime behavior change in devalbo-core:

1. reinstall in smoke app:

```sh
npm install git+https://github.com/devalbo/devalbo-core.git
```

2. rerun:

```sh
node verify-exports.mjs
npm run type-check
```

3. rerun one terminal command and one devtools command:

- terminal: `hello Alice`
- devtools: `await cli.exec('hello', ['Alice'])`

Expected:

- updated behavior/export is visible without switching to monorepo-only tooling

---

## Acceptance Criteria

- [ ] `devalbo-cli` is installable from git with npm
- [ ] App-facing API exports are complete and documented in this plan
- [ ] `examples/hello-universal` exists and uses only `devalbo-cli` imports
- [ ] Terminal + browser + dev-console command parity is verified
- [ ] `CREATE_AN_APP.md` is npm-only for external app authors
- [ ] `CREATE_AN_APP.md` contains no pnpm/workspace assumptions in onboarding path
- [ ] No onboarding example imports internal paths or low-level package internals
- [ ] External fresh-directory smoke test passes
- [ ] This plan stays synchronized with onboarding changes during implementation

---

## Risks and Mitigations

- Risk: `devalbo-cli` surface drifts from actual recommended usage.
  - Mitigation: lock docs and hello-universal to `devalbo-cli` imports only.
- Risk: git install works for maintainers but not external users.
  - Mitigation: require external smoke test as release gate.
- Risk: hidden dependency on monorepo-only protocols.
  - Mitigation: forbid workspace-specific references in external docs/examples.

---

## Reorganization Opinions (for devalbo-core)

1. Treat `devalbo-cli` as the primary product boundary for app authors.
2. Keep `@devalbo/cli-shell` as low-level internals for advanced users/maintainers.
3. Promote `examples/hello-universal` as the first-class reference app.
4. Demote `naveditor` to advanced/reference status in onboarding docs.
5. Prefer task-oriented docs over package-oriented docs.
6. Add CI job `verify:onboarding` that runs internal + external gates.

---

## Summary (by Claude)

### What this plan is trying to do

Plan 15 introduces a **new facade package** (`devalbo-cli`) that sits on top of the existing `@devalbo/*` internal packages and presents a single, clean import surface for external app developers. The core motivation is **distribution simplification**: instead of requiring app authors to understand the monorepo's internal package graph (`@devalbo/cli-shell`, `@devalbo/shared`, `@devalbo/state`, etc.), they install one thing and import from one place.

The plan has four phases:
1. **Define the public API contract** — enumerate exactly which symbols the facade re-exports
2. **Implement the facade package** with build artifacts consumable outside the monorepo
3. **Build a universal example app** (`hello-universal`) that works in both terminal and browser, using only facade imports
4. **Rewrite onboarding docs** to be npm-only (no pnpm, no workspace protocols, no monorepo assumptions)

This is essentially the next logical step after Plans 12–14: those plans extracted `cli-shell` from `editor-lib` and documented the API. Plan 15 goes further by wrapping that API for standalone consumption.

### Relationship to prior plans

| Plan | What it did | Plan 15's relationship |
|---|---|---|
| 12 | Extracted `cli-shell` from `editor-lib` | Plan 15 wraps `cli-shell` in a higher-level facade |
| 12a | Cleaned up the developer-facing API | Plan 15 re-exports exactly these cleaned-up symbols |
| 13 | Documentation + `examples/hello-cli` + JSDoc | Plan 15 replaces the docs and example with npm-only versions |
| 14 | Align naveditor with documented patterns | Plan 15 demotes naveditor from "reference app" to "advanced example" |

---

## Questions and Thoughts

### 1. Is the facade really needed, or is `@devalbo/cli-shell` already the right boundary?

The export map checklist in Phase 1 is **identical** to what `@devalbo/cli-shell` already exports today. Every single symbol listed comes from `cli-shell` (which itself re-exports `createCliAppConfig` from `@devalbo/shared`). The facade would be a thin `export * from '@devalbo/cli-shell'` plus possibly some `@devalbo/state` re-exports.

**Question:** What concrete problem does the extra indirection layer solve that publishing `@devalbo/cli-shell` to npm (or making it git-installable) wouldn't? Is the value in the *name* (`devalbo-cli` is friendlier than `cli-shell`), the *bundling* (single installable artifact with no workspace resolution), or both?

### 2. Git-install of a monorepo package is fragile

The plan assumes `npm install git+https://github.com/devalbo/devalbo-core.git` will work. But this installs the **entire monorepo** as a dependency, not just the facade package. npm's git install doesn't support `path:` subpackage targeting the way pnpm workspace does.

**Question:** How will the git install actually resolve to `devalbo-cli`? Options:
- (a) Make `devalbo-cli` the **root** `package.json` of the monorepo (the plan hints at this with "Root/package install target")
- (b) Use a `prepare` script that builds the facade at install time
- (c) Use a separate repo or branch that contains only the built facade
- (d) Use npm's experimental workspace support with `--workspace`

Option (a) is the simplest but means the monorepo root's `package.json` becomes the `devalbo-cli` identity, which is a significant structural change. This needs to be decided explicitly.

### 3. Build/distribution strategy is underspecified

Phase 1 says "Ensure git install yields consumable artifacts (via `prepare` or equivalent build strategy)" but doesn't specify:
- What build tool (tsc? tsup? vite library mode?)
- Where built artifacts live (`dist/`?)
- Whether the facade ships ESM, CJS, or both
- How TypeScript declarations are generated and distributed
- How transitive dependencies (ink, react, tinybase, commander) are declared for the consumer

This is the hardest part of the plan and it's handwaved. A `prepare` script that runs in the consumer's `node_modules` after git install needs to build the entire dependency chain — that's a lot of moving parts to get right.

### 4. `mergeCommands` is missing from the export map

We just added `mergeCommands` to `@devalbo/cli-shell` as a duplicate-command guard. If `devalbo-cli` is the public surface, it should re-export `mergeCommands` too. The export map checklist doesn't include it.

### 5. Tension between Plan 13/14 and Plan 15 on the role of `CREATE_AN_APP.md`

We just rewrote `CREATE_AN_APP.md` (earlier today) to use `@devalbo/cli-shell` imports throughout. Plan 15 Phase 3 wants to rewrite it *again* to use `devalbo-cli` imports and npm-only workflows. This means the current doc would be short-lived.

**Question:** Should Plan 13's documentation work be deferred until Plan 15's facade is decided? Or should the docs stay on `@devalbo/cli-shell` and Plan 15 becomes a future "polish for external consumers" phase?

### 6. `hello-universal` vs `hello-cli` overlap

Plan 13 creates `examples/hello-cli/` (CLI-only). Plan 15 creates `examples/hello-universal/` (CLI + browser). These serve different audiences but overlap significantly. Should `hello-universal` replace `hello-cli`, or coexist?

### 7. The npm-only constraint may be premature

The plan explicitly bans pnpm from onboarding docs. But the monorepo itself uses pnpm, the workspace uses pnpm catalogs, and any contributor will need pnpm. If the external install story (git install of monorepo) requires a `prepare` build step, it needs to work with npm's install lifecycle — but the monorepo's own build scripts likely assume pnpm.

**Question:** Has the npm-only git-install path been tested end-to-end? Even a quick spike would de-risk the plan significantly.

### 8. Should `@devalbo/state` be re-exported?

The export map focuses on cli-shell symbols. But browser apps need `createDevalboStore`, `AppConfigProvider`, `useAppConfig`, `StoreContext` from `@devalbo/state`, and `createFilesystemDriver` from `@devalbo/filesystem`. These aren't in the checklist. Either:
- (a) The facade re-exports them too (making it truly one-stop)
- (b) The onboarding docs allow `@devalbo/state` and `@devalbo/filesystem` as additional imports for browser apps

Option (b) contradicts the "import only from `devalbo-cli`" constraint.

### 9. Ordering recommendation

If this plan proceeds, I'd suggest: Phase 0 (contract) first, then a **spike** on the git-install mechanism (Phase 1, items 3+5) before committing to the full implementation. The git-install path is the highest-risk element — if it doesn't work cleanly, the entire plan needs restructuring (perhaps toward npm publishing or a separate distributable repo).

---

## Responses to Claude Questions / Thoughts

These responses are the current plan decisions and should be treated as implementation guidance.

### 1) Is the facade needed if `@devalbo/cli-shell` already exists?

Decision: **yes, keep the facade** (`devalbo-cli`).

Reason:

- It provides a stable, app-author-focused boundary and naming.
- It enables one-package onboarding docs (reduced cognitive load).
- It decouples external docs from internal package layout changes.

### 2) How does git install resolve in npm for a monorepo?

Decision: **root package identity is `devalbo-cli`** for external installs (Model #1).

Implication:

- `npm install git+https://github.com/devalbo/devalbo-core.git` resolves to the root package.
- Root package must be the installable façade and export the onboarding API.

### 3) Build/distribution strategy specifics

Decision:

- Build output in `dist/`.
- ESM-first output for onboarding path.
- Type declarations emitted and exported.
- Use a deterministic build entry for façade exports.
- Use `prepare` (or equivalent) so git install provides usable artifacts.

Implementation note:

- Do a small Phase-1 spike to verify install/build behavior before full migration.

### 4) Missing `mergeCommands`

Decision: **include `mergeCommands`** in required exports and checklist. (Now reflected above.)

### 5) Tension with Plan 13/14 doc work

Decision:

- Plan 15 supersedes onboarding sections from Plan 13 where they conflict.
- Keep current docs usable until Plan 15 completion, then switch to npm-only `devalbo-cli` onboarding.

### 6) `hello-universal` vs `hello-cli`

Decision:

- `hello-universal` becomes the primary onboarding reference.
- `hello-cli` may remain as a narrow CLI regression fixture, but not the first-start example.

### 7) Is npm-only premature?

Decision:

- npm-only remains the external author goal.
- Add mandatory external smoke test gate early (fresh directory, npm + git install).
- Contributor workflows can still use pnpm internally; docs must separate external vs contributor paths.

### 8) Should state/filesystem APIs be re-exported?

Decision: **yes for onboarding-critical symbols**.

Rationale:

- Browser onboarding requires store/driver setup.
- One-stop import surface is part of the simplification goal.

### 9) Ordering

Decision: adopt Claude’s recommendation.

- Phase 0 contract
- Phase 1 git-install spike (high-risk de-risking)
- Remaining implementation only after spike passes
