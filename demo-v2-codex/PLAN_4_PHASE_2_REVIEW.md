# Plan 4 Review: Phase 0/1 Verification & Phase 2+ Open Items

This review was conducted against the codebase as of 2026-02-16, verifying implementation status of Phases 0 and 1 and identifying open questions, contradictions, and gaps in Phases 2 and later.

---

## Phase 0: COMPLETE ✓

All three items are implemented and verified in the codebase.

| Item | Status | Evidence |
|---|---|---|
| **0a. Command file split** | Done | `_util.tsx`, `filesystem.ts`, `system.ts`, `io.ts`, barrel `index.ts` all exist in `naveditor-lib/src/commands/`. |
| **0b. Structured result on CommandResult** | Done | `data?: unknown` and `status?: 'ok' \| 'error'` are present in `packages/shared/src/types/commands.ts`. |
| **0c. Typed accessors for entries/buffers** | Done | `packages/state/src/accessors/entries.ts` and `buffers.ts` exist and are exported from the barrel. |

**Note:** `navigate.tsx`, `edit.tsx`, and `with-validation.ts` also exist in the commands directory. These predate the plan — they are component-rendering command wrappers using a different pattern (synchronous, `withValidation` wrapper, no `CommandResult`). The barrel maps them as aliases (`navigate` → `ls`, `edit` → `cat`), so they are not used as handlers. Not a blocker, but these files exist outside the plan's architecture and may need cleanup eventually.

---

## Phase 1: COMPLETE ✓

Every deliverable is implemented.

| Plan item | Status | Evidence |
|---|---|---|
| **1a. Vocab constants** | Done | `packages/shared/src/vocab/namespaces.ts` has `@inrupt/vocab-common-rdf` + `@inrupt/vocab-solid-common` re-exports, plus `ORG`, `TIME`, `NS`, `POD_CONTEXT`. `utils.ts` has `generateUID`, `iri`, `getId`, `toArray`, `nowISO`. Exported via `packages/shared/src/index.ts`. |
| **1b. Domain types + schemas** | Done | `packages/shared/src/types/social.ts` exports `PersonaRow`, `ContactRow`, `GroupRow`, `MembershipRow` (+ input variants). `packages/shared/src/schemas/social.ts` has full Zod schemas with enum types and store-shape variants (`ContactRowStoreSchema`, `GroupRowStoreSchema`). |
| **1c. Store schema (schematizer)** | Done | `packages/state/src/store.ts` uses `createZodSchematizer` with the store-shape schemas. `entries` and `buffers` remain manual. `schemaVersion` value is set (version 2). Schema version check with `console.warn` on mismatch is implemented. Table name constants in `packages/state/src/schemas/social.ts`. |
| **1d. Typed accessors** | Done | `personas.ts`, `contacts.ts`, `groups.ts`, `memberships.ts` all exist in `packages/state/src/accessors/`. All functions from the plan are implemented: CRUD, `searchContacts`, `linkContactToPersona`, `getDefaultPersona`, `setDefaultPersona`, `getGroupsForContact`, `addMember`, `removeMember`, `listMembers`. Cascade delete on `deleteContact` and `deleteGroup` removes related memberships. |
| **1e. Tests** | Done | `packages/state/tests/social-accessors.test.ts` has 10 tests covering: CRUD roundtrip, default persona selection, search, link, membership lifecycle, cascade delete, invalid row rejection, referential integrity, migration safety, and malformed-row warning. `store-schema.test.ts` verifies schematizer output for enum handling and optional defaults. |

### ~~Maintenance note: @inrupt packages not in catalog~~ — RESOLVED

~~The `@inrupt/vocab-*` packages were installed as inline versions in `packages/shared/package.json`.~~ **Fixed:** Promoted `@inrupt/vocab-common-rdf` (`^1.0.5`) and `@inrupt/vocab-solid-common` (`^0.7.5`) to the `catalog` in `pnpm-workspace.yaml`. `packages/shared/package.json` now references them via `catalog:`.

---

## Phase 2+ Review: Open Items

### ~~Issue 1: Step 2c contradicts the Store Access design decision~~ — RESOLVED

~~Step 2c said "Add optional `store?: Store` field" but the design decision specifies a union type approach.~~ **Fixed:** Step 2c now reads: "Implement the union-typed `ExtendedCommandOptions` / `ExtendedCommandOptionsWithStore` / `SocialCommandHandler` / `CommandHandler` types as specified in the Store Access design decision."

---

### ~~Issue 2: No plan step for wiring the store into command invocation sites~~ — RESOLVED

~~No step for wiring store into InteractiveShell, cli, console-helpers.~~ **Fixed:** Added step 2f to the plan. All four invocation sites (InteractiveShell.tsx, cli.tsx, and both console-helpers.ts files) are now listed with instructions to accept and pass the store. Also added to Concrete File Changes.

---

### ~~Issue 3: Commander.js subcommand registration strategy is underspecified~~ — RESOLVED

~~Unclear whether Commander.js fully parses subcommand args or passes through.~~ **Fixed:** Added "Design Decision: Commander.js Registration & Arg Parsing for Social Commands" to the plan. Decision: pass-through Commander.js registration + `@optique/core` for all arg/option parsing. Commander registers parent commands with variadic args; namespace handlers dispatch internally; `@optique` `option()` and `argument()` handle all parsing via the existing `parseWithSchema` pattern.

---

### ~~Issue 4: Social command option/flag parsing needs a decision~~ — RESOLVED

~~Social commands have `--flag` options but existing code only uses `@optique` `argument()`.~~ **Fixed:** `@optique/core` actually provides `option()` for `--flag` style args (the existing codebase only used `argument()` because filesystem commands have no flags). Decision: use `@optique` `option()` + `argument()` for social commands, composed with Zod via `parseWithSchema` — same pattern as filesystem parsers. One parsing library across the codebase. Step 2b and Concrete File Changes updated.

---

### ~~Issue 5: Branded ID toolbox approach should be specified~~ — RESOLVED

~~Plan didn't specify whether to use the `@devalbo/branded-types` toolbox or the simpler manual approach.~~ **Fixed:** Step 2a now explicitly specifies using `createBrandedUuidToolbox` from `@devalbo/branded-types` for all four social ID families, with a concrete code example. IDs follow `prefix_uuid` format (e.g., `persona_a1b2c3d4-...`).

---

### ~~Issue 6: Phase 2.5 ordering is ambiguous~~ — RESOLVED

~~Unclear whether Phase 2.5 must come after Phase 3 or is flexible.~~ **Fixed:** Phase 2.5 "When" section now explicitly states it can be done any time after Phase 2 is stable, has no dependency on Phase 3, and is listed after Phase 3 for readability only.

---

### ~~Issue 7: Schema validation tests location mismatch~~ — RESOLVED

~~Testing Strategy Layer 1 said `packages/shared/tests/` but no tests exist there.~~ **Fixed:** Layer 1 in the plan now reflects that schema validation is covered by accessor tests in `packages/state/tests/`, with standalone schema tests in `packages/shared/tests/` optional and recommended only if schemas grow complex enough to warrant isolated testing.

---

### ~~Issue 8: `help` command output for social commands~~ — RESOLVED

~~Namespace handlers returned an error when no subcommand was given, instead of help text.~~ **Fixed:** The dispatch handler example in the plan now includes a help fallback: if no subcommand or `help` is given, it returns a listing of available subcommands. Step 2d updated to note all three handlers include this. Concrete File Changes updated to note "with help fallback" on each handler file.

---

## Summary

| # | Issue | Priority | Action |
|---|---|---|---|
| ~~1~~ | ~~Step 2c contradicts union-type design decision~~ | ~~Must fix~~ | **RESOLVED** — step 2c rewritten |
| ~~2~~ | ~~No step for wiring store into invocation sites~~ | ~~Must fix~~ | **RESOLVED** — step 2f added, Concrete File Changes updated |
| ~~3~~ | ~~Commander.js subcommand strategy underspecified~~ | ~~Should clarify~~ | **RESOLVED** — pass-through registration + `@optique` for parsing |
| ~~4~~ | ~~Option/flag parsing for social commands undecided~~ | ~~Should clarify~~ | **RESOLVED** — `@optique` `option()` + `argument()` via `parseWithSchema` |
| ~~5~~ | ~~Branded ID toolbox approach not specified~~ | ~~Should clarify~~ | **RESOLVED** — `createBrandedUuidToolbox` specified in step 2a |
| ~~6~~ | ~~Phase 2.5 ordering ambiguous~~ | ~~Minor~~ | **RESOLVED** — flexible after Phase 2, no Phase 3 dependency |
| ~~7~~ | ~~Schema validation test location mismatch~~ | ~~Minor~~ | **RESOLVED** — Layer 1 updated to reflect actual test locations |
| ~~8~~ | ~~Subcommand help text not addressed~~ | ~~Minor~~ | **RESOLVED** — help fallback added to dispatch pattern and step 2d |
