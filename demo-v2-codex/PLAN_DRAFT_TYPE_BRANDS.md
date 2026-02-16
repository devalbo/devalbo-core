# Type Brand Strategy (Replanned Draft)

## Goal
Apply branded types as a correctness boundary across the monorepo, with emphasis on structured domain IDs that encode namespace + key methodology in the ID string itself.

This plan follows `docs/BRANDED_TYPES.md` and replaces older assumptions.

## Current Baseline (as of this draft)
- `@devalbo/shared` has basic brands for filesystem paths only (`FilePath`, `DirectoryPath`) via unchecked casts.
- Command argument validation (`pathArgSchema`) returns plain strings, not branded path outputs.
- Social/state schemas and accessors still use generic `string` IDs (`personaId`, `contactId`, `groupId`, membership row IDs).
- TinyBase persistence is string-based, which is compatible with branded boundaries if brands are applied at parse/accessor layers.

## Strategy Decisions
1. Keep brands compile-time only; runtime validation stays in parse/assert helpers and Zod schemas.
2. Keep TinyBase storage as primitive strings; no runtime brand metadata.
3. For domain IDs, adopt structured branded strings that encode:
- prefix (domain namespace)
- key methodology (`UuidKey` or `NumberIndexKey`)
- key value
4. Expose toolbox APIs for each ID family (`createRandomId`, `createIdForKey`, `parseId`, `createValidatedId`).
5. Roll out incrementally, boundary-first, with compatibility shims where needed.

## Target Type Model

### Shared Brand Primitives
Add to `packages/shared/src/types/branded.ts` (or split into focused files if cleaner):
- generic: `Branded<T, B>`
- paths: `FilePath`, `DirectoryPath`
- IDs:
  - `IdPrefix`
  - `UuidKey`
  - `NumberIndexKey`
  - `PrefixKeyId<TPrefix, TKeyMethod>`
- domain IDs:
  - `PersonaId`, `ContactId`, `GroupId`, `MembershipId`
- URI/time domains:
  - `Iri`, `WebId`, `UuidUrn`, `IsoDateTime`

### Structured ID Factories
Add reusable factories in `@devalbo/shared`:
- `createBrandedUuidIdToolbox(prefix)`
- `createBrandedNumberIndexIdToolbox(prefix)`

Each toolbox provides:
- `idSchema`
- `createRandomId()`
- `createIdForKey(key)`
- `parseId(id)`
- `createValidatedId(id)`

### Domain ID Families (initial)
- `persona` -> `PersonaId` (UUID-keyed)
- `contact` -> `ContactId` (UUID-keyed)
- `group` -> `GroupId` (UUID-keyed)
- `membership` -> `MembershipId`

For `MembershipId`, keep deterministic relation semantics by defining one canonical format (for example, explicit composite contract) and centralizing it in one toolbox/helper, rather than ad-hoc string concatenation.

## Implementation Plan

## Phase 1: Shared Foundations
1. Introduce new brand primitives and ID/key methodology types.
2. Keep existing `asFilePath` / `asDirectoryPath` for compatibility, but add explicit unsafe aliases:
- `unsafeAsFilePath`
- `unsafeAsDirectoryPath`
3. Add parse/assert helpers for path and ID domains.
4. Export branded schemas from `@devalbo/shared` for reuse across packages.

Deliverables:
- branded type module(s)
- toolbox factory module(s)
- branded schema exports
- compatibility aliases for existing API

## Phase 2: Boundary Schemas and Command Layer
1. Update `packages/shared/src/validation/index.ts`:
- keep plain `pathArgSchema` for compatibility
- add branded variants that parse to branded outputs (`PathToken`/`FilePath`/`DirectoryPath` where semantics are known)
2. Update `naveditor-lib/src/lib/command-args.schema.ts` to use branded outputs where command intent is explicit.
3. Ensure command handlers consume branded path/id types without local ad-hoc casts.

Deliverables:
- branded command arg schemas
- reduced command-layer string casting

## Phase 3: State + Accessor Typing
1. Keep TinyBase row/cell storage schemas string-compatible.
2. Update accessor signatures to accept/return branded IDs:
- `getPersona(store, id: PersonaId)`
- `setContact(store, id: ContactId, ...)`
- `addMember(...): MembershipId`
3. Replace stringly row-id utilities with branded helpers:
- `getMembershipRowId(groupId: GroupId, contactId: ContactId): MembershipId`
4. Add parse/rebrand boundaries at accessor edges so internal logic remains typed while persistence remains string.

Deliverables:
- branded accessor interfaces
- branded membership row-id utilities
- no persistence format breakage

## Phase 4: Social Schema Enrichment
1. Introduce branded schema outputs for high-risk social fields:
- IDs (`uid`, relation refs)
- `webId`, `Iri`-like fields
- temporal fields (`updatedAt` as `IsoDateTime`)
2. Keep store-facing schema variants permissive where TinyBase constraints require it.
3. Add clear conversion points between permissive store schemas and branded domain schemas.

Deliverables:
- branded social/domain schema layer
- stable store schema compatibility

## Phase 5: Compatibility + Migration Hardening
1. Keep external boundary overloads that accept plain strings where migration is incomplete.
2. Internally prefer branded-first signatures.
3. Add deprecation path for ambiguous helpers and ad-hoc casts.

Deliverables:
- migration-safe APIs
- deprecation notes and replacement guidance

## Testing Plan

### Compile-Time Tests
- `@ts-expect-error` misuse cases for swapped IDs (`ContactId` vs `GroupId`, etc.).
- type inference checks for schema parse outputs returning branded types.

### Runtime Tests
- invalid ID format/prefix/methodology rejection.
- valid UUID and numeric-index ID parsing.
- membership row-id format validation and deterministic generation.
- command args parse into branded outputs.

### Persistence Roundtrip Tests
- write branded values through accessors -> TinyBase stores strings -> read back -> values re-branded by typed boundary.

## Acceptance Criteria
1. No new cross-domain ID misuse compiles in accessor/service APIs.
2. Command path args are branded before filesystem operations.
3. Shared ID toolboxes exist and are used for domain ID generation/parsing.
4. TinyBase schemas remain string-based and backward-compatible.
5. Existing consumers can migrate incrementally via compatibility surfaces.

## Risks and Mitigations
- Risk: wide signature churn across packages.
  - Mitigation: introduce branded overloads first, then tighten in follow-up PRs.
- Risk: legacy IDs do not match canonical structured formats.
  - Mitigation: provide `createValidatedId` + compatibility parsers during migration window.
- Risk: membership ID contract ambiguity.
  - Mitigation: define one canonical membership ID format in shared helpers and ban inline string composition.

## Suggested Work Breakdown (PR Sequence)
1. PR1: shared brand primitives + toolboxes + tests.
2. PR2: command/schema boundary adoption.
3. PR3: state accessor branded signatures + membership ID helpers.
4. PR4: social schema branded enrichment + roundtrip tests.
5. PR5: compatibility cleanup and deprecation follow-through.
