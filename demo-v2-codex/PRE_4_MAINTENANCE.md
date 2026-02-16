# Pre-Phase 0: Maintenance Plan

These four items come from the "What needs attention before adding scope" section in `PLAN_4_SOLID_INTEGRATION.md`. All four are pure refactors — no new features, no behavior changes. Each can be done independently and merged separately.

---

## Implementation Status (2026-02-16)

- Item 1 (`naveditor-lib` command split): implemented.
- Item 2 (`CommandResult` optional structured fields): implemented.
- Item 3 (typed accessors for `entries` and `buffers`): implemented, including tests.
- Item 4 (schema vs JSON-LD storage decision): documentation-only, no code changes required.

---

## 1. Split the command file

**Problem:** `naveditor-lib/src/commands/index.tsx` is 456 lines containing every command handler in a flat map. Adding social commands here would push it past 1000 lines.

**Target structure:**

```
naveditor-lib/src/commands/
  filesystem.ts    pwd, cd, ls, tree, stat, cat, touch, mkdir, cp, mv, rm
  system.ts        clear, backend, help, exit
  io.ts            export, import (+ helpers: pickBftFileText, downloadTextFile, promptTextInput, etc.)
  index.ts         barrel that merges all maps + aliases (navigate, edit)
```

**Steps:**

1. Create `filesystem.ts`:
   - Move `ExtendedCommandOptions`, `AsyncCommandHandler`, `makeOutput`, `makeError` into a shared `_util.ts` (these are used by all command files).
   - Move the `pwd`, `cd`, `ls`, `tree`, `stat`, `cat`, `touch`, `mkdir`, `cp`, `mv`, `rm` handlers.
   - Export as `Record<string, AsyncCommandHandler>`.

2. Create `system.ts`:
   - Move `clear`, `backend`, `help`, `exit` handlers.
   - The `help` handler calls `createProgram()` — this import stays the same.

3. Create `io.ts`:
   - Move `export`, `import` handlers.
   - Move the helper functions they depend on: `defaultImportLocationFromFileName`, `defaultImportLocationFromPath`, `defaultExportFileName`, `downloadTextFile`, `pickBftFileText`, `promptTextInput`.

4. Create `_util.ts`:
   - Move `ExtendedCommandOptions`, `AsyncCommandHandler` type, `makeOutput`, `makeError`.
   - All three domain files import from here.

5. Rewrite `index.ts` as barrel:
   - Import from `filesystem.ts`, `system.ts`, `io.ts`.
   - Merge into single `CommandMap`.
   - Add aliases (`navigate` -> `ls`, `edit` -> `cat`).
   - Export `CommandName` type and `commands` map.
   - Rename file from `.tsx` to `.ts` (JSX is only in `makeOutput`/`makeError` which move to `_util.tsx`).

**Verification:**
- `pnpm type-check` passes across all packages.
- Manual smoke test of every command in the terminal app (or a quick script that calls each handler with known args).
- Existing tests in `packages/commands/tests/registry-parser-bridge.test.ts` still pass (they don't import from `naveditor-lib/src/commands/` directly, so they should be unaffected).

**Files touched:**
- `naveditor-lib/src/commands/index.tsx` — deleted (replaced by the files below)
- `naveditor-lib/src/commands/_util.tsx` — new
- `naveditor-lib/src/commands/filesystem.ts` — new
- `naveditor-lib/src/commands/system.ts` — new
- `naveditor-lib/src/commands/io.ts` — new
- `naveditor-lib/src/commands/index.ts` — new (barrel)

---

## 2. Add structured result fields to CommandResult

**Problem:** `CommandResult` only has `component` (React node) and `error?` (string). Tests can't assert on command output without rendering React. New social commands need machine-readable results.

**Current type** (`packages/shared/src/types/commands.ts`):
```ts
interface CommandResult {
  component: React.ReactNode;
  error?: string;
}
```

**Target type:**
```ts
interface CommandResult {
  component: React.ReactNode;
  error?: string;
  data?: unknown;
  status?: 'ok' | 'error';
}
```

**Steps:**

1. Edit `packages/shared/src/types/commands.ts`:
   - Add `data?: unknown` and `status?: 'ok' | 'error'` to `CommandResult`.

2. That's it. Both fields are optional, so every existing command handler remains valid with zero changes.

**Verification:**
- `pnpm type-check` passes. No existing code breaks because both fields are optional.
- Existing tests pass unchanged.

**Files touched:**
- `packages/shared/src/types/commands.ts`

---

## 3. Add typed accessor layer for existing tables

**Problem:** The store exposes raw TinyBase `getRow`/`setRow` with no validation. Callers get untyped `Row` objects. This should be fixed for the existing `entries` and `buffers` tables before adding new ones, so the pattern is established.

**Target accessors:**

```ts
// packages/state/src/accessors/entries.ts
getEntry(store, id): FileTreeRow | null
setEntry(store, id, entry: FileTreeRow): void
listEntries(store): Array<{ id: string; row: FileTreeRow }>
deleteEntry(store, id): void

// packages/state/src/accessors/buffers.ts
getBuffer(store, id): EditorBufferRow | null
setBuffer(store, id, buffer: EditorBufferRow): void
listBuffers(store): Array<{ id: string; row: EditorBufferRow }>
deleteBuffer(store, id): void
```

**Steps:**

1. Create Zod schemas for existing row types in `packages/shared/src/schemas/`:
   - `file-tree.ts`: schema matching `FileTreeRow` interface (path: string, name: string, parentPath: string, isDirectory: boolean, size: number, mtime: string).
   - `editor-buffer.ts`: schema matching `EditorBufferRow` interface (path: string, content: string, isDirty: boolean, cursorLine: number, cursorCol: number).
   - These already exist as TypeScript interfaces in `packages/shared/src/types/state.ts`. The Zod schemas formalize them for runtime validation.

2. Export new schemas from `packages/shared/src/index.ts`.

3. Create `packages/state/src/accessors/entries.ts`:
   - Import `FileTreeRow` type and its Zod schema.
   - `getEntry`: call `store.getRow('entries', id)`, safeParse with Zod, return null if missing or invalid.
   - `setEntry`: parse with Zod (throws on invalid), then `store.setRow`.
   - `listEntries`: iterate `store.getRowIds('entries')`, safeParse each, collect valid ones.
   - `deleteEntry`: `store.delRow('entries', id)`.

4. Create `packages/state/src/accessors/buffers.ts`: same pattern for `EditorBufferRow`.

5. Create `packages/state/src/accessors/index.ts` as barrel export.

6. Add exports to `packages/state/src/index.ts`.

7. Write tests in `packages/state/tests/accessors.test.ts`:
   - Create store, set a valid entry via accessor, get it back, verify fields.
   - Set an entry with raw `setRow` with wrong types, verify accessor `getEntry` returns null.
   - List entries: add three, list, verify count and content.
   - Delete entry: add, delete, verify gone.
   - Same four tests for buffers.

**Note:** This does NOT require changing any existing callers. The accessors are additive. Existing code that uses `store.getRow` directly continues to work. Migration of existing callers to use accessors can happen opportunistically.

**Verification:**
- New tests pass.
- `pnpm type-check` passes.
- Existing tests unchanged.

**Files touched:**
- `packages/shared/src/schemas/file-tree.ts` — new
- `packages/shared/src/schemas/editor-buffer.ts` — new
- `packages/shared/src/index.ts` — add schema exports
- `packages/state/src/accessors/entries.ts` — new
- `packages/state/src/accessors/buffers.ts` — new
- `packages/state/src/accessors/index.ts` — new
- `packages/state/src/index.ts` — add accessor exports
- `packages/state/tests/accessors.test.ts` — new

---

## 4. Resolve schema enforcement vs. JSON-LD tension (decision only)

**Problem:** The current store uses `setTablesSchema` with fixed cell names/types. JSON-LD objects use IRI property keys and nested structures. The Solid integration plan needs to decide how social data is stored.

**This item is already resolved by the plan.** The decision (from `PLAN_4_SOLID_INTEGRATION.md`):

> Domain data is the source of truth. JSON-LD is a serialization format, not a storage format.

Social entities use friendly cell names in the existing schema-enforced store (same as `entries` and `buffers`). JSON-LD is reconstructed on export via mappers in Phase 3.

**No code changes needed here.** This was a design question, not a maintenance task. The answer is documented. The implementation happens in Phase 1 of the main plan.

---

## Execution Order

These tasks have no hard dependencies on each other, but the recommended order is:

1. **CommandResult fields** (item 2) — smallest change, zero risk, unlocks test patterns for everything after.
2. **Split command file** (item 1) — pure move refactor. Do it while the file is still 456 lines, not 1000.
3. **Typed accessors** (item 3) — establishes the pattern that Phase 1 of the Solid plan extends.
4. Item 4 requires no action.

Total estimated file changes: 13 files (6 new, 7 modified). No deleted files except the original `index.tsx` which is replaced by the split files.
