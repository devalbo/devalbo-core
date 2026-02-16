# Plan: SOLID Personas, Contacts, and Groups Integration

## Goal
Add `personas`, `contacts`, and `groups` into this monorepo's stores and commands, while keeping the data model compatible with `tb-solid-pod` so data and workflows can move between projects with minimal translation.

## What I Reviewed
I reviewed the local clone at:
- `/Users/ajb/Projects/learn/learn-solid/tb-solid-pod`

Key contracts from that project:
- Store layout constants in `src/storeLayout.ts`
- JSON-LD/Zod schemas in `src/schemas/persona.ts`, `src/schemas/contact.ts`, `src/schemas/group.ts`, `src/schemas/base.ts`, `src/schemas/typeIndex.ts`
- Typed store accessors in `src/utils/storeAccessors.ts`
- CLI command patterns in `src/cli/commands/persona.tsx`, `src/cli/commands/contact.tsx`, `src/cli/commands/group.tsx`

Current local integration points in this repo:
- Store definition: `packages/state/src/store.ts`
- Shared types: `packages/shared/src/types/state.ts`, `packages/shared/src/types/commands.ts`
- Command framework: `packages/commands/src/*`
- Command implementations: `naveditor-lib/src/commands/index.tsx`

## Compatibility Target
Treat these as stable compatibility contracts with `tb-solid-pod`:
- Table names: `personas`, `contacts`, `groups`
- Command namespaces: `persona`, `contact`, `group`
- JSON-LD vocabulary intent: FOAF, vCard, SOLID, ORG terms
- Identity semantics:
  - Persona is WebID-style profile data
  - Contact supports person or agent/bot
  - Group supports organization/team/group and membership

## Proposed Architecture

### 1) Add a SOLID domain package in this monorepo
Create `packages/solid-model` for shared SOLID domain contracts used by state + commands.

Exports:
- Constants:
  - `STORE_TABLES = { ENTRIES, BUFFERS, PERSONAS, CONTACTS, GROUPS }`
  - command names and known subcommands
- Types:
  - `PersonaRecord`, `ContactRecord`, `GroupRecord`, `GroupMembership`
  - `NodeRef` and helper aliases
- Validation/parsing:
  - Zod schemas for persona/contact/group input + persisted records
- Mapping helpers:
  - `toSolidPersonaJsonLd` / `fromSolidPersonaJsonLd`
  - `toSolidContactJsonLd` / `fromSolidContactJsonLd`
  - `toSolidGroupJsonLd` / `fromSolidGroupJsonLd`

Why this package:
- Prevents SOLID-specific logic from leaking into unrelated packages.
- Keeps one source of truth for compatibility and schema evolution.

### 2) Extend `@devalbo/state` store schema
Update `packages/state/src/store.ts` to include:
- `personas`
- `contacts`
- `groups`

Recommended persisted row strategy:
- Use normalized scalar cells for queryability and TinyBase schema safety.
- Keep a `jsonLd` cell (stringified JSON) for full-fidelity roundtrip compatibility with `tb-solid-pod`.

Example high-level columns:
- `personas`: `id`, `displayName`, `nickname`, `email`, `webId`, `jsonLd`, `updatedAt`
- `contacts`: `id`, `displayName`, `kind` (`person` | `agent`), `email`, `organization`, `webId`, `jsonLd`, `updatedAt`
- `groups`: `id`, `displayName`, `groupType` (`organization` | `team` | `group`), `description`, `memberIdsJson`, `jsonLd`, `updatedAt`

Compatibility rule:
- `jsonLd` payload must serialize to/from the same semantic shape used by `tb-solid-pod` factories.

### 3) Add typed store accessors (same pattern as `tb-solid-pod`)
Create in `packages/state/src/accessors/`:
- `personas.ts`: `getPersona`, `setPersona`, `listPersonas`, `deletePersona`
- `contacts.ts`: `getContact`, `setContact`, `listContacts`, `deleteContact`
- `groups.ts`: `getGroup`, `setGroup`, `listGroups`, `deleteGroup`, membership helpers

Behavior:
- Validate inputs before writes.
- Rebuild and validate domain objects on reads.
- Keep `jsonLd` and normalized columns synchronized.

### 4) Add command namespaces and subcommands
Implement commands in `naveditor-lib` with names aligned to `tb-solid-pod`:

- `persona`
  - `list`, `create`, `show`, `edit`, `delete`, `set-default`
- `contact`
  - `list`, `add`, `show`, `edit`, `delete`, `search`, `link`
- `group`
  - `list`, `create`, `show`, `edit`, `delete`, `add-member`, `remove-member`, `list-members`

Command style:
- Keep current `CommandResult` UX model used by this repo.
- Add structured error codes incrementally where useful.

### 5) Optional but recommended: command execution context upgrade
Current command handlers are UI-output oriented. For parity with `tb-solid-pod` and easier automation:
- Add optional programmatic result mode (`success/data/error`) in command execution utilities.
- Keep existing UI output as default behavior.

This is not required for initial integration, but it reduces future churn and improves testability.

## Phased Delivery

## Phase 1: Contracts and Types
- Create `packages/solid-model` with constants, types, schemas, and JSON-LD mappers.
- Add unit tests for parsing/mapping roundtrips.

Exit criteria:
- Persona/contact/group records validate.
- JSON-LD mapping roundtrip passes.

## Phase 2: State Integration
- Extend `createDevalboStore` schema with new tables.
- Add typed accessors in `packages/state`.
- Export new tables/types from `packages/state` and `packages/shared` as needed.

Exit criteria:
- CRUD operations work for all 3 entity types.
- Store tests cover serialization compatibility with `tb-solid-pod` shape.

## Phase 3: Command Integration
- Add `persona`, `contact`, `group` command handlers in `naveditor-lib`.
- Register commands in existing command map/help.
- Add parser/registry tests for subcommands and argument handling.

Exit criteria:
- CLI can create/list/show/edit/delete personas, contacts, groups.
- Group membership operations work.

## Phase 4: Interop and Migration Utilities
- Add import/export helpers for SOLID JSON-LD bundles (or per-entity docs).
- Add migration utility for older store versions with no social tables.

Exit criteria:
- Exported JSON can be consumed by `tb-solid-pod` schema validators (or with documented minimal transforms).

## Testing Plan
- Unit tests:
  - schema validation
  - accessor CRUD
  - mapper roundtrip
  - command argument parsing
- Integration tests:
  - create persona/contact/group via commands, then verify store rows
  - membership add/remove flows
- Regression tests:
  - existing file tree/editor commands unaffected

## Risks and Mitigations
- Risk: TinyBase schema cell constraints vs nested JSON-LD values.
  - Mitigation: normalized scalar columns + canonical `jsonLd` string payload.
- Risk: Command UX drift from current style.
  - Mitigation: preserve existing `CommandResult` rendering and add features incrementally.
- Risk: Incomplete SOLID vocabulary parity.
  - Mitigation: prioritize fields already used by `tb-solid-pod` persona/contact/group schemas.

## Concrete File Change Plan
When implementation starts, expected touch points:
- `packages/state/src/store.ts`
- `packages/state/src/index.ts`
- `packages/state/src/accessors/*.ts` (new)
- `packages/shared/src/types/state.ts`
- `packages/shared/src/index.ts`
- `naveditor-lib/src/commands/index.tsx`
- `naveditor-lib/src/program.ts`
- `packages/commands/tests/registry-parser-bridge.test.ts`
- `packages/state/tests/store.test.ts`
- `packages/solid-model/*` (new package)

## Open Decisions (Recommend defaults)
1. Canonical persisted format
- Recommended: normalized scalar columns + `jsonLd` mirror string.

2. Scope of Phase 1 commands
- Recommended: implement all CRUD/list/show plus group membership; defer advanced SOLID fields (`set-inbox`, `set-typeindex`) to Phase 2/3 follow-up.

3. Interop strictness
- Recommended: semantic compatibility first (same concepts and JSON-LD meaning), not byte-for-byte identity.

## Definition of Done
- Store supports personas/contacts/groups with typed validation.
- CLI supports persona/contact/group command families.
- Exported data has documented SOLID-compatible shape aligned with `tb-solid-pod`.
- Tests cover core CRUD, membership, and compatibility mappings.
