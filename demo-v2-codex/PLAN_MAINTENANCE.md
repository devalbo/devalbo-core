# Maintenance Plan

## Philosophy
Maintenance is not an afterthought — it is a first-class activity that keeps the codebase healthy enough to move fast. A monorepo amplifies both the benefits and the costs of drift: when dependencies are in sync, every package shares bug fixes, security patches, and performance improvements automatically. When they drift, you accumulate invisible tech debt that surfaces as mysterious build failures, runtime inconsistencies, and wasted debugging time.

The governing rule is simple: **every shared dependency should exist at exactly one version across the entire workspace, and that version should be the latest published release unless a concrete, documented reason justifies pinning.**

This is greenfield development. **Backward compatibility is not a goal.** When an upgrade introduces breaking changes, the response is to fix forward — update all consuming code to match — not to maintain shims, compatibility layers, or dual-version support. Breaking changes should be called out clearly in commit messages so the team knows what moved, but the investment goes into adapting, not cushioning.

## Core Principles

### 1. Single-Version Policy, Enforced by Catalog
All packages in the workspace must use the same version of any given direct third-party dependency. This is enforced structurally using pnpm's `catalog:` protocol: shared dependency versions are declared once in `pnpm-workspace.yaml` and referenced by `catalog:` in each `package.json`. Version splits become impossible for cataloged dependencies because there is only one place the version is defined.

This applies to **direct dependencies only**. Transitive version duplication (where your dependency's dependency pulls a different version than yours) is normal, expected, and handled correctly by pnpm's strict isolation. Two versions of `foo` in the lockfile is not a problem when one is your direct dep and the other is pulled transitively by a third-party package. Only intervene in transitive duplication when it causes a concrete issue (security vulnerability, runtime conflict), using `pnpm.overrides` in the root `package.json` as a targeted fix.

### 2. Latest-First
The target version for every dependency is the latest published release. Staying current minimizes the size of each upgrade, keeps upgrade notes fresh in memory, and avoids the painful "big bang" catch-up that happens when versions are left to drift.

### 3. Workspace Protocol for Internal Dependencies
All internal `@devalbo/*` and app-level cross-references must use pnpm's `workspace:*` protocol. This guarantees internal packages always resolve to the local source, never to a stale published version.

### 4. Peer Dependencies Track the Workspace
When a package declares a peer dependency (e.g., `react`, `ink`), the version range must be compatible with the single version installed at the workspace root. Peer ranges should be as narrow as practical to prevent silent mismatches.

### 5. Catalog-First for Shared Dependencies
Any dependency used by two or more workspace packages must be defined in the `catalog` section of `pnpm-workspace.yaml` and referenced via `catalog:` in each consumer's `package.json`. Dependencies used by only a single package may remain inline. When a previously single-use dependency is added to a second package, it must be promoted to the catalog at that point.

### 6. Upgrade Atomically
A dependency version bump is a single-line edit in `pnpm-workspace.yaml` for cataloged deps, applied in one commit. Partial upgrades — where some packages move to v2 while others stay on v1 — are structurally prevented by the catalog. This keeps `pnpm-lock.yaml` clean and avoids duplicate installs.

### 7. Fix Forward on Breaking Changes
When an upgrade breaks consuming code, fix the consuming code. Do not:
- add backward-compatible overloads or wrappers
- maintain two code paths for old and new APIs
- defer the upgrade to avoid breakage

Instead:
- upgrade the dependency
- fix all compile errors and test failures across the workspace
- note the breaking change and what was updated in the commit message

The goal is a clean codebase on latest, not a codebase that can run on two versions.

### 8. Validate Before Merging
Every dependency change must pass the full verification suite before merge:
- `pnpm install` succeeds with no warnings about unmet peers
- `pnpm -r run build` succeeds across all packages
- `pnpm -r run test` passes across all packages
- No new TypeScript errors introduced (`pnpm -r run typecheck` if available)

### 9. Document Exceptions
If a dependency genuinely cannot be upgraded (upstream regression, unresolvable incompatibility, etc.), pin it explicitly and add a comment in the relevant location (`pnpm-workspace.yaml` for cataloged deps, `package.json` for inline deps) explaining:
- what version is pinned
- why it cannot be upgraded
- what condition would unblock the upgrade

## Version Duplication: When to Act

Not all version duplication is a problem. Use this decision framework:

| Situation | Action |
|-----------|--------|
| Same direct dep at different versions across your packages | Fix immediately — this is what catalog prevents |
| Transitive dep differs from your direct dep version | Normal. No action unless it causes a runtime issue. |
| Transitive dep has a known security vulnerability | Add a `pnpm.overrides` entry in root `package.json` to force the patched version |
| Transitive dep causes runtime conflict (e.g., duplicate React) | Add a `pnpm.overrides` entry or configure `pnpm.peerDependencyRules` |
| Named catalogs (`catalog:legacy`) for split direct versions | Do not use. This is a migration crutch; we fix forward instead. |

## Process

### Routine Dependency Sync
Run periodically (at minimum before each plan/phase begins):

1. **Audit current state**
   ```bash
   pnpm outdated -r
   ```
   This shows every dependency that is behind its latest published version, across all workspace packages.

2. **Upgrade cataloged deps**
   Edit the version in `pnpm-workspace.yaml`. For patch/minor bumps, batch them. For major bumps, do one at a time.

3. **Fix forward**
   After bumping a version, fix all consuming code:
   ```bash
   pnpm install && pnpm -r run build
   ```
   If build fails, fix the breakage. Note what changed in the commit message.

4. **Verify**
   ```bash
   pnpm -r run build && pnpm -r run test
   ```

5. **Commit**
   One commit per logical upgrade unit. Commit message format:
   ```
   upgrade <dep> <old> -> <new>

   Breaking changes: <brief description of what broke and how it was fixed>
   ```
   If no breakage: omit the breaking changes line.

### Upgrade Tiers
- **Tier 1 — Patch/minor**: Batch all patch and minor bumps together. Edit versions in `pnpm-workspace.yaml`, install, build, test, commit.
- **Tier 2 — Major**: One major bump at a time. Read the changelog, identify breaking changes, fix forward, verify, commit.
- **Tier 3 — Ecosystem cohorts**: Dependencies that move in groups (`@tauri-apps/*`, `vite` + `vitest`, `@inrupt/vocab-*`) are upgraded together in a single commit.

### Dependency Hygiene Checks
Before starting any new plan or phase of work:

- [ ] `pnpm outdated -r` shows no actionable drift
- [ ] All shared deps are in the catalog
- [ ] All internal references use `workspace:*`
- [ ] Peer dependency ranges are satisfied
- [ ] Build and test pass cleanly

### Handling Conflicts During Feature Work
If a feature branch needs a dependency that is already out of sync in `main`:
1. Fix the version sync first, in a dedicated maintenance commit.
2. Then layer the feature work on top.
3. Never mix dependency maintenance with feature logic in the same commit.

## Catalog Migration

**Status: Complete** (as of 2026-02-16).

All shared dependencies are defined in the `catalog` section of `pnpm-workspace.yaml` and referenced via `catalog:` in each consumer's `package.json`. Inline versions remain only for dependencies used by exactly one package.

When adding a new shared dependency in the future:
1. Add the version to the `catalog` section of `pnpm-workspace.yaml`.
2. Reference it as `catalog:` in every consuming `package.json`.
3. Never add an inline version for a dependency that already exists in the catalog.

## Workspace Inventory

For reference, the packages governed by this policy:

| Layer | Package | Key External Dependencies |
|-------|---------|--------------------------|
| Core | `@devalbo/branded-types` | zod |
| Core | `@devalbo/shared` | zod, effect, @inrupt/vocab-* |
| Core | `@devalbo/commands` | effect (peer: react) |
| Core | `@devalbo/state` | tinybase, zod (peer: react) |
| Core | `@devalbo/filesystem` | @tauri-apps/api, tinybase |
| Core | `@devalbo/ui` | @inkjs/ui, ink-select-input (peer: ink, react) |
| Core | `@devalbo/worker-bridge` | (none) |
| App | `naveditor` | commander, effect, react, tinybase, @xterm/xterm |
| App | `@devalbo/naveditor-lib` | (all @devalbo core) |
| App | `naveditor-web` | vite |
| App | `naveditor-terminal` | ink, commander |
| App | `naveditor-desktop` | @tauri-apps/api, vite |

## Known Version Mismatches

> **This section is a living document.** Review and update it every time dependencies are upgraded. If this section is empty, all direct dependency versions are aligned.

When a mismatch is identified, log it here with the dependency name, which packages disagree, what versions they declare, and whether it's blocked or just pending a fix. Remove entries once resolved.

| Dependency | Packages | Versions | Status | Notes |
|------------|----------|----------|--------|-------|
| *(none)* | — | — | — | All direct deps aligned as of 2026-02-16 |

<!-- Example entry:
| ink       | packages/ui: ^5.0.0, naveditor-terminal: ^6.7.0 | ^5 vs ^6 | Blocked | ui depends on ink-web which requires ink 5; track ink-web release for ink 6 support |
-->

### How to audit
```bash
# Show all outdated deps across the workspace
pnpm outdated -r

# Quick check: list every non-workspace dep + version across all package.json files, sorted to spot splits
grep -r '"version"\|"dependencies"\|"devDependencies"\|"peerDependencies"' packages/*/package.json naveditor*/package.json --include='package.json' -l | \
  xargs -I{} node -e "
    const p = require('{}');
    const name = p.name || '{}';
    for (const section of ['dependencies','devDependencies','peerDependencies']) {
      for (const [dep, ver] of Object.entries(p[section] || {})) {
        if (!ver.startsWith('workspace:')) console.log(dep + '\t' + ver + '\t' + name);
      }
    }
  " | sort | uniq -c | sort -rn
```
When a dependency name appears with different version strings, it belongs in the table above.

## Known Dependency Cohorts
These dependencies should always be upgraded together as a single catalog edit + commit:
- **zod**: branded-types, shared, state
- **effect**: shared, commands, naveditor
- **tinybase**: state, filesystem, naveditor
- **react** (peer): commands, state, ui, naveditor, naveditor-lib, naveditor-web, naveditor-terminal, naveditor-desktop
- **ink** (peer): ui, naveditor-terminal
- **@tauri-apps/\***: filesystem, naveditor-desktop
- **@inrupt/vocab-\***: shared
- **vite / vitest**: naveditor-web, naveditor-desktop, and all packages using vitest for testing
