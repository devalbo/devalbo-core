# Plan: Solid Integration (v4)

This plan incorporates findings from the original draft plan, its review, a full audit of both the devalbo monorepo and tb-solid-pod, and general Solid/federation design principles.

---

## Design Review of the Project As-Is

### What works well

- **Clear package boundaries.** `@devalbo/shared` (types, validation), `@devalbo/state` (TinyBase store + persisters), `@devalbo/commands` (registry, parser, bridge), `naveditor-lib` (concrete command handlers). Each package has a defined responsibility.
- **Consistent validation pattern.** Zod schemas for arg parsing, `@optique/core` for positional arg extraction, both composed together in `parseWithSchema`. This is a solid (lowercase-s) pattern to extend.
- **Hierarchical command framework.** `CommandRegistry` supports subcommands natively with path resolution. Adding `persona list`, `contact add`, `group create` requires no framework changes.
- **Multi-environment targeting.** The `detectPlatform`/`RuntimePlatform` pattern, combined with browser/node/tauri entry points, means new features don't need to pick a runtime.
- **TinyBase as reactive state.** React hooks for table/row subscriptions are already wired. New social tables will get reactivity for free.

### What needs attention before adding scope

> **Status: All items resolved.** See `PRE_4_MAINTENANCE.md` for implementation details.

1. ~~**The command file is already at capacity.**~~ **Done.** Split into `filesystem.ts`, `system.ts`, `io.ts`, `_util.tsx`, and barrel `index.ts`.

2. ~~**Commands are untestable in isolation.**~~ **Done.** Added optional `data` and `status` fields to `CommandResult`.

3. ~~**No typed accessor layer.**~~ **Done.** Added Zod-validated accessors for `entries` and `buffers` tables, with tests.

4. ~~**Schema enforcement vs. JSON-LD reality.**~~ **Resolved by design decision.** Domain cells are the source of truth; JSON-LD is a serialization format for import/export (see Core Architectural Decision below).

---

## Core Architectural Decision: Storage Model

### The problem

tb-solid-pod stores full JSON-LD objects directly in a schemaless TinyBase store. The property keys are full IRIs. Nested values (NodeRef objects, arrays) are cast to `Row` and any non-scalar values are silently dropped at the TinyBase layer.

This project uses a schema-enforced TinyBase store with friendly cell names (`name`, `path`, `isDirectory`). These two models are fundamentally different.

### The decision

**Domain data is the source of truth. JSON-LD is a serialization format, not a storage format.**

Store social entities as domain records with friendly cell names in the existing schema-enforced TinyBase store. Reconstruct JSON-LD on export by mapping domain fields to their vocabulary IRIs and wrapping values in the appropriate JSON-LD structure (`@context`, `@type`, NodeRef, etc.).

This means:
- **One source of truth** — the store cells. No `jsonLd` mirror string. No dual-write problem.
- **Schema enforcement preserved** — cell names and types are declared in `setTablesSchema`, just like `entries` and `buffers`.
- **Queryable** — `name`, `email`, `groupType` are real cells you can filter on.
- **Lossless export** — the domain-to-JSON-LD mapper knows how to reconstruct the full shape (wrap emails in `mailto:`, IRIs in NodeRef objects, etc.).
- **Lossless import** — the JSON-LD-to-domain mapper knows how to extract scalar values from the JSON-LD structure.

The trade-off: a mapping layer is required for import/export. But this mapping layer is explicit, testable, and one-directional at any given time — unlike a dual-write synchronization layer that must work bidirectionally at all times.

### Relationship to tb-solid-pod

This is not byte-level compatibility with tb-solid-pod's internal store format. It is **interoperability at the JSON-LD boundary**: data exported from this project can be imported by tb-solid-pod (and vice versa) because both agree on the JSON-LD vocabulary and shape. The internal storage model is an implementation detail that each project is free to choose.

This aligns with how Solid itself works: pods don't share internal storage formats; they share RDF/JSON-LD over HTTP.

---

## TinyBase Zod Schematizer

TinyBase v7 provides `createZodSchematizer` from `tinybase/schematizers/schematizer-zod`. This is a conversion utility that derives TinyBase's native `TablesSchema` format from Zod object schemas, eliminating the need to manually duplicate cell name/type declarations in both Zod schemas and `setTablesSchema`.

### How it works

```ts
import { createZodSchematizer } from 'tinybase/schematizers/schematizer-zod';

const schematizer = createZodSchematizer(store);
schematizer.setTablesSchema({
  personas: PersonaRowSchema,
  contacts: ContactRowSchema,
  // ...
});
```

The schematizer walks each Zod object schema and generates `{ type: 'string' | 'number' | 'boolean', default?: ... }` entries for each cell. It handles `.optional()` (generates a default of `''` for strings, `0` for numbers, `false` for booleans) and `.default(value)`.

### What it preserves

- Cell names and primitive types (`z.string()`, `z.number()`, `z.boolean()`)
- Default values (`z.string().default('hello')`)
- Nullable/optional handling (converts to TinyBase defaults)

### What it loses (by design)

- **Validation constraints**: `z.string().min(1)`, `.max()`, `.regex()`, `.email()` — all dropped. TinyBase does not do constraint validation; it only enforces type.
- **Enums**: `z.enum(['organization', 'team', 'group'])` — **silently dropped**. The schematizer does not recognize enum schemas as string cells. This means `GroupTypeSchema` and `ContactKindSchema` need manual handling.
- **Complex types**: unions, intersections, nested objects — silently dropped.

This is acceptable because **Zod validation happens in the accessor layer**, not in TinyBase. TinyBase's schema is a type guard for cell storage, not a validation engine. The accessors call `Schema.parse()` on every write, which enforces all constraints. The schematizer simply eliminates the manual type mirroring.

### Enum workaround

For schemas containing enum fields (`kind`, `groupType`), the Zod schemas in `packages/shared/src/schemas/social.ts` should use `z.string()` at the TinyBase schema level and `z.enum()` at the accessor validation level — or more practically, the schemas can stay as-is (with `z.enum()`) and the enum fields can be patched into the schematizer output manually:

```ts
// Option A: patch after schematizer
schematizer.setTablesSchema({ contacts: ContactRowSchema });
// kind cell is missing because z.enum() was dropped — add it manually:
// (TinyBase sees it as just a string cell anyway)

// Option B (preferred): use a "store shape" variant of the schema
// that replaces enums with z.string() for the schematizer, while the
// accessor-layer schemas keep z.enum() for validation.
```

The preferred approach is documented in Phase 1c below.

### Resolves the `optional` vs empty-string mismatch

The Phase 1 draft uses `z.string().optional()` for optional cells, which types them as `string | undefined`. But TinyBase defaults missing string cells to `''` (empty string), so the runtime value is always `string`, never `undefined`. The schematizer makes this explicit: it converts `z.string().optional()` into `{ type: 'string', default: '' }`, which is exactly what TinyBase does. This means the "store shape" schemas should use `z.string().default('')` instead of `z.string().optional()` — or the accessor layer should treat `''` as equivalent to "not set" when reading rows back. Either way, the schematizer forces this decision to be made explicitly rather than leaving a type lie.

---

## Store Schema Design

### Social tables

```
personas
  name         string    (foaf:name — required)
  nickname     string    (foaf:nick)
  givenName    string    (foaf:givenName)
  familyName   string    (foaf:familyName)
  email        string    (vcard:hasEmail — mailto: URI, or JSON array if multiple)
  phone        string    (vcard:hasTelephone — tel: URI)
  image        string    (foaf:img — URL)
  bio          string    (vcard:note)
  homepage     string    (foaf:homepage — URL)
  oidcIssuer   string    (solid:oidcIssuer — URL)
  inbox        string    (ldp:inbox — URL)
  publicTypeIndex   string  (solid:publicTypeIndex — URL)
  privateTypeIndex  string  (solid:privateTypeIndex — URL)
  preferencesFile   string  (pim:preferencesFile — URL)
  profileDoc   string    (foaf:isPrimaryTopicOf — URL)
  isDefault    boolean
  updatedAt    string

contacts
  name         string    (vcard:fn — required)
  uid          string    (vcard:hasUID — urn:uuid:...)
  nickname     string    (vcard:nickname)
  kind         string    ("person" | "agent")
  email        string    (vcard:hasEmail — mailto: URI, or JSON array if multiple)
  phone        string    (vcard:hasTelephone — tel: URI)
  url          string    (vcard:hasURL)
  photo        string    (vcard:hasPhoto — URL)
  notes        string    (vcard:hasNote)
  organization string    (vcard:hasOrganizationName)
  role         string    (vcard:hasRole)
  webId        string    (solid:webid — URL)
  agentCategory string   (schema:applicationCategory — agents only)
  linkedPersona string   (vcard:hasRelated — persona @id)
  updatedAt    string

groups
  name         string    (vcard:fn — required)
  groupType    string    ("organization" | "team" | "group")
  description  string    (dc:description)
  url          string    (vcard:hasURL)
  logo         string    (vcard:hasLogo — URL)
  parentGroup  string    (org:unitOf — group @id)
  updatedAt    string

memberships
  groupId      string    (row ID of the group)
  contactId    string    (row ID or @id of the contact)
  role         string    (org:role — optional role IRI)
  startDate    string    (time:hasBeginning — ISO datetime)
  endDate      string    (time:hasEnd — ISO datetime)
```

### Why a `memberships` table

The draft plan proposed `memberIdsJson` — a JSON array stuffed into a string cell on the group row. This is:
- Not queryable ("which groups is contact X in?" requires full-table scan + JSON parsing)
- No referential integrity (deleted contacts rot silently)
- Unable to represent tb-solid-pod's rich membership model (roles, time intervals)

A dedicated `memberships` table solves all three. Row key: `{groupId}:{contactId}`. Scalar cells for role and time range. TinyBase indexes can provide fast lookups in both directions.

### Field coverage vs. tb-solid-pod

Every field in tb-solid-pod's PersonaSchema, ContactSchema, GroupSchema, and MembershipSchema has a corresponding cell in the tables above. The `foaf:knows` relationship on contacts is deferred (it requires a separate contact-to-contact relationship table and no tb-solid-pod CLI command uses it).

| tb-solid-pod field | Stored in | Cell |
|---|---|---|
| `foaf:name` | personas | `name` |
| `foaf:nick` | personas | `nickname` |
| `foaf:givenName` | personas | `givenName` |
| `foaf:familyName` | personas | `familyName` |
| `vcard:hasEmail` | personas/contacts | `email` |
| `vcard:hasTelephone` | personas/contacts | `phone` |
| `foaf:img` | personas | `image` |
| `vcard:note` / `vcard:hasNote` | personas/contacts | `bio` / `notes` |
| `foaf:homepage` | personas | `homepage` |
| `solid:oidcIssuer` | personas | `oidcIssuer` |
| `solid:publicTypeIndex` | personas | `publicTypeIndex` |
| `solid:privateTypeIndex` | personas | `privateTypeIndex` |
| `ldp:inbox` | personas | `inbox` |
| `pim:preferencesFile` | personas | `preferencesFile` |
| `foaf:isPrimaryTopicOf` | personas | `profileDoc` |
| `vcard:fn` | contacts/groups | `name` |
| `vcard:hasUID` | contacts | `uid` |
| `vcard:nickname` | contacts | `nickname` |
| `vcard:hasURL` | contacts/groups | `url` |
| `vcard:hasPhoto` | contacts | `photo` |
| `vcard:hasOrganizationName` | contacts | `organization` |
| `vcard:hasRole` | contacts | `role` |
| `solid:webid` | contacts | `webId` |
| `schema:applicationCategory` | contacts | `agentCategory` |
| `vcard:hasRelated` | contacts | `linkedPersona` |
| `dc:description` | groups | `description` |
| `vcard:hasLogo` | groups | `logo` |
| `org:unitOf` | groups | `parentGroup` |
| `vcard:hasMember` | memberships | (derived from rows) |
| `org:hasMembership` | memberships | `role`, `startDate`, `endDate` |
| `org:hasUnit` | groups | (derived: query groups where `parentGroup` = this group) |
| `foaf:knows` | _deferred_ | — |

---

## Vocabulary Constants

### Decision: use `@inrupt/vocab-common-rdf` and `@inrupt/vocab-solid-common`

tb-solid-pod uses these packages. Using the same packages ensures IRI constants are identical, eliminating a class of copy-paste divergence bugs. These are small, well-maintained packages with no transitive dependency concerns.

Additionally, copy the `ORG` and `TIME` namespace constants from tb-solid-pod's `group.ts` (these aren't covered by the @inrupt packages, and tb-solid-pod defines them locally).

Copy the `POD_CONTEXT`, `NS`, and utility functions (`generateUID`, `iri`, `getId`, `toArray`, `nowISO`) from tb-solid-pod's `base.ts`.

---

## Command Architecture Changes

### 1. Split commands by domain

Replace the single `naveditor-lib/src/commands/index.tsx` with:

```
naveditor-lib/src/commands/
  filesystem.ts    (pwd, cd, ls, tree, stat, cat, touch, mkdir, cp, mv, rm)
  system.ts        (clear, backend, help, exit)
  io.ts            (export, import)
  persona.ts       (new)
  contact.ts       (new)
  group.ts         (new)
  index.ts         (barrel: merges all command maps + aliases)
```

Each file exports a partial `CommandMap`. The barrel combines them.

### 2. Add structured result type

Extend `CommandResult` to support programmatic results alongside React components:

```ts
// In @devalbo/shared types/commands.ts
interface CommandResult {
  component: React.ReactNode;
  error?: string;
  data?: unknown;         // structured result data (optional)
  status?: 'ok' | 'error'; // machine-readable status
}
```

The `data` field is optional. Existing commands don't change. New social commands populate it. Tests assert on `data` and `status` without touching React.

### 3. Social command definitions

| Namespace | Subcommand | Arguments |
|---|---|---|
| `persona` | `list` | |
| `persona` | `create` | `<name> [--nickname] [--email] [--bio] [--homepage] [--image]` |
| `persona` | `show` | `<id> [--json]` |
| `persona` | `edit` | `<id> --field=value [--field=value ...]` |
| `persona` | `delete` | `<id>` |
| `persona` | `set-default` | `<id>` |
| `contact` | `list` | `[--agents] [--people]` |
| `contact` | `add` | `<name> [--email] [--phone] [--org] [--agent] [--category]` |
| `contact` | `show` | `<id> [--json]` |
| `contact` | `edit` | `<id> --field=value [--field=value ...]` |
| `contact` | `delete` | `<id>` |
| `contact` | `search` | `<query>` |
| `contact` | `link` | `<contactId> <personaId>` |
| `group` | `list` | `[--type=organization\|team\|group]` |
| `group` | `create` | `<name> [--type] [--description] [--url] [--logo] [--parent]` |
| `group` | `show` | `<id> [--json]` |
| `group` | `edit` | `<id> --field=value [--field=value ...]` |
| `group` | `delete` | `<id>` |
| `group` | `add-member` | `<groupId> <contactId> [--role] [--start] [--end]` |
| `group` | `remove-member` | `<groupId> <contactId>` |
| `group` | `list-members` | `<groupId>` |

---

## Package Placement

### No new package

The review correctly identified that a `packages/solid-model` package is premature. The two consumers are `@devalbo/state` (accessors) and `naveditor-lib` (commands). A new package adds build/dep overhead for no isolation benefit.

Instead:

| Concern | Location |
|---|---|
| Domain types (`PersonaRow`, `ContactRow`, etc.) | `packages/shared/src/types/social.ts` |
| Domain Zod schemas | `packages/shared/src/schemas/social.ts` |
| Vocabulary constants (`NS`, `POD_CONTEXT`) | `packages/shared/src/vocab/solid.ts` |
| Store table constants | `packages/state/src/schemas/social.ts` |
| Typed accessors | `packages/state/src/accessors/` |
| JSON-LD mapping (domain <-> JSON-LD) | `packages/state/src/mappers/` |
| Command handlers | `naveditor-lib/src/commands/persona.ts`, etc. |
| Arg schemas | `naveditor-lib/src/lib/social-args.schema.ts` |
| Arg parsers | `naveditor-lib/src/lib/social-args.parser.ts` |

If a third consumer emerges later, extract into a package then.

---

## Persisted Store Migration

TinyBase `setTablesSchema` constrains runtime writes but doesn't affect the persistence format. Adding new tables to the schema means:

- **New stores:** work immediately.
- **Existing persisted stores (SQLite/memory):** load fine. The new tables simply have no rows. No migration needed.
- **Forward compatibility:** old code opening a store with social table data would ignore those tables (TinyBase drops cells/rows not in schema on load if schema is active).

The only risk: old code opening a new store with social data, then saving — the social data would be dropped on save because the old schema doesn't include those tables. Mitigation: version the store. Add a `_meta` values entry (TinyBase Values, not Tables) with a `schemaVersion` number. The store creation function checks this and warns if the schema is newer than expected.

```ts
store.setValuesSchema({
  schemaVersion: { type: 'number', default: 1 },
});
```

Bump to `2` when social tables are added. On load, if `schemaVersion > expected`, warn the user rather than silently dropping data.

---

## Phased Delivery

### Phase 0: Structural Preparation — COMPLETE

> Implemented in commit `7bfa7c8`. See `PRE_4_MAINTENANCE.md` for full details.

- **0a. Split command file** — `index.tsx` split into `_util.tsx`, `filesystem.ts`, `system.ts`, `io.ts`, barrel `index.ts`. All existing commands preserved.
- **0b. Structured result on CommandResult** — Added `data?: unknown` and `status?: 'ok' | 'error'` to `CommandResult`. Backward-compatible (both optional).
- **0c. Typed accessors for entries/buffers** — Zod-validated `get`/`set`/`list`/`delete` accessors. Schemas in `packages/shared/src/schemas/`. 8 tests passing.

### Phase 1: Domain Model + State

Add the social data model and store integration.

**1a. Add vocabulary constants**
- Install `@inrupt/vocab-common-rdf` and `@inrupt/vocab-solid-common` in `@devalbo/shared`.
- Create `packages/shared/src/vocab/solid.ts` with re-exports + local `ORG`, `TIME`, `NS`, `POD_CONTEXT` constants.
- Export from `packages/shared/src/index.ts`.

**1b. Add domain types and schemas**
- Create `packages/shared/src/types/social.ts` with `PersonaRow`, `ContactRow`, `GroupRow`, `MembershipRow`.
- Create `packages/shared/src/schemas/social.ts` with Zod schemas for each row type.
- Export from `packages/shared/src/index.ts`.

**1c. Extend store schema (using Zod schematizer)**
- Use `createZodSchematizer` from `tinybase/schematizers/schematizer-zod` to derive TinyBase table schemas from the Zod row schemas in `@devalbo/shared`, instead of manually duplicating cell declarations in `setTablesSchema`.
- Create "store shape" variants of schemas that contain `z.enum()` fields (ContactRowSchema, GroupRowSchema) by replacing enums with `z.string()` for the schematizer. The accessor-layer schemas keep `z.enum()` for runtime validation. This handles the schematizer's enum blindspot.
- Add table name constants in `packages/state/src/schemas/social.ts`.
- Add `schemaVersion` to store values.
- **Note:** The current `store.ts` manually declares all 40+ social cells in `setTablesSchema`. This should be replaced with schematizer calls to eliminate the duplication between Zod schemas and TinyBase schema declarations. The `entries` and `buffers` tables (which have no Zod schemas) can remain manually declared.

**1d. Add typed accessors**
- Create `packages/state/src/accessors/personas.ts`: `getPersona`, `setPersona`, `listPersonas`, `deletePersona`, `getDefaultPersona`, `setDefaultPersona`.
- Create `packages/state/src/accessors/contacts.ts`: `getContact`, `setContact`, `listContacts`, `deleteContact`, `searchContacts`, `linkContactToPersona`.
- Create `packages/state/src/accessors/groups.ts`: `getGroup`, `setGroup`, `listGroups`, `deleteGroup`.
- Create `packages/state/src/accessors/memberships.ts`: `addMember`, `removeMember`, `listMembers`, `getGroupsForContact`.
- Export from `packages/state/src/index.ts`.

**1e. Tests**
- CRUD roundtrip tests for each accessor.
- Membership lifecycle tests (add, list, remove, reverse lookup).
- Schema validation tests (reject invalid inputs, accept valid inputs).
- Store migration safety test (new store loads, old store loads without social data).

**Exit criteria:**
- All accessor CRUD tests pass.
- Membership tests pass.
- Store creates cleanly with social tables.

### Phase 2: Commands

Add the CLI command families.

**2a. Add arg schemas and parsers**
- Create `naveditor-lib/src/lib/social-args.schema.ts` with Zod schemas for all social command args.
- Create `naveditor-lib/src/lib/social-args.parser.ts` with @optique parsers composed with Zod validation.

**2b. Add command handlers**
- Create `naveditor-lib/src/commands/persona.ts` with all persona subcommands.
- Create `naveditor-lib/src/commands/contact.ts` with all contact subcommands.
- Create `naveditor-lib/src/commands/group.ts` with all group subcommands.
- Each handler populates `data` and `status` on `CommandResult`.

**2c. Register commands**
- Add social command definitions to `naveditor-lib/src/program.ts` (Commander.js).
- Merge social command maps into the barrel export in `naveditor-lib/src/commands/index.ts`.

**2d. Tests**
- Arg parser tests (valid/invalid inputs for each subcommand).
- Command integration tests: call handler -> assert on `data`/`status` and store state.
- Command registry tests: verify all social subcommands resolve correctly.

**Exit criteria:**
- All social commands work end-to-end (create, list, show, edit, delete for each entity).
- Group membership commands work (add-member, remove-member, list-members).
- Contact search works.
- Persona set-default works.
- All tests pass.

### Phase 3: JSON-LD Interop

Add Solid-compatible import/export.

**3a. JSON-LD mappers**
- Create `packages/state/src/mappers/persona-jsonld.ts`: `personaToJsonLd(row) -> Persona`, `jsonLdToPersonaRow(jsonLd) -> PersonaRow`.
- Create `packages/state/src/mappers/contact-jsonld.ts`: same pattern.
- Create `packages/state/src/mappers/group-jsonld.ts`: same pattern, including membership flattening/expansion.
- Export from `packages/state/src/index.ts`.

**3b. Roundtrip tests**
- For each entity type: create domain row -> map to JSON-LD -> validate against tb-solid-pod's Zod schema -> map back to domain row -> assert equality.
- Install tb-solid-pod schemas as dev dependency for roundtrip validation (or copy the specific Zod schemas into a test helper).

**3c. Import/export commands**
- Extend existing `export` command or add `solid-export` to export personas/contacts/groups as a JSON-LD bundle.
- Extend existing `import` command or add `solid-import` to import a JSON-LD bundle.
- Format: JSON file containing `{ personas: [...], contacts: [...], groups: [...] }` where each entity is a JSON-LD object with `@context`.

**3d. Tests**
- Roundtrip: export from this system -> import into tb-solid-pod validator -> passes.
- Roundtrip: tb-solid-pod factory output -> import into this system -> export -> compare.
- Edge cases: multi-value emails, agent contacts, team with parent org, membership with role and time interval.

**Exit criteria:**
- All roundtrip tests pass against tb-solid-pod schemas.
- Import/export commands work for single entities and bundles.
- Field mapping table (above) is verified: every field survives the roundtrip.

---

## Testing Strategy

### Layer 1: Schema validation (unit)
- Zod schemas accept valid domain data, reject invalid.
- Located in `packages/shared/tests/`.

### Layer 2: Accessor CRUD (unit)
- Create an in-memory store, exercise each accessor, verify store state.
- Located in `packages/state/tests/`.

### Layer 3: Command execution (integration)
- Call command handler with args, assert on `CommandResult.data` and `CommandResult.status`.
- Verify store side-effects (row created/updated/deleted).
- Located in `naveditor-lib/tests/` or `packages/commands/tests/`.

### Layer 4: JSON-LD roundtrip (integration)
- Domain row -> JSON-LD -> tb-solid-pod schema validation -> domain row.
- Located in `packages/state/tests/`.

### Layer 5: Regression (smoke)
- Existing filesystem and system commands still work after all changes.
- Located in existing test files.

---

## Concrete File Changes

### Phase 0 — COMPLETE
All file changes delivered in commit `7bfa7c8`. See diff for details.

### Phase 1
- `packages/shared/package.json` — add @inrupt/vocab-* deps
- `packages/shared/src/vocab/solid.ts` — new
- `packages/shared/src/types/social.ts` — new
- `packages/shared/src/schemas/social.ts` — new
- `packages/shared/src/index.ts` — add exports
- `packages/state/src/store.ts` — refactor to use `createZodSchematizer` for social tables + schemaVersion
- `packages/state/src/schemas/social.ts` — new (table name constants)
- `packages/state/src/accessors/personas.ts` — new
- `packages/state/src/accessors/contacts.ts` — new
- `packages/state/src/accessors/groups.ts` — new
- `packages/state/src/accessors/memberships.ts` — new
- `packages/state/src/index.ts` — add exports
- `packages/state/tests/social-accessors.test.ts` — new

### Phase 2
- `naveditor-lib/src/lib/social-args.schema.ts` — new
- `naveditor-lib/src/lib/social-args.parser.ts` — new
- `naveditor-lib/src/commands/persona.ts` — new
- `naveditor-lib/src/commands/contact.ts` — new
- `naveditor-lib/src/commands/group.ts` — new
- `naveditor-lib/src/commands/index.ts` — add social commands
- `naveditor-lib/src/program.ts` — register social commands
- `packages/commands/tests/social-commands.test.ts` — new

### Phase 3
- `packages/state/src/mappers/persona-jsonld.ts` — new
- `packages/state/src/mappers/contact-jsonld.ts` — new
- `packages/state/src/mappers/group-jsonld.ts` — new
- `packages/state/src/mappers/index.ts` — new (barrel)
- `packages/state/src/index.ts` — add mapper exports
- `packages/state/tests/jsonld-roundtrip.test.ts` — new

---

## How This Plan Addresses the Review's Concerns

| Review Issue | Resolution |
|---|---|
| #1 Dual-storage consistency timebomb | Eliminated. Domain cells are the single source of truth. JSON-LD is reconstructed on export. |
| #2 `memberIdsJson` | Replaced with dedicated `memberships` table with scalar cells. |
| #3 Overpromised compatibility | Reframed as JSON-LD boundary interop (like Solid itself). Full field mapping table provided. |
| #4 Phase dependency problem | Phase 1 is domain model + state (testable without JSON-LD). Phase 3 adds JSON-LD mappers after the domain layer exists. |
| #5 Command file growth | **Done.** Phase 0 split the file into per-domain modules. |
| #6 Untestable commands | **Done.** Phase 0 added `data`/`status` fields to `CommandResult`. All new commands will populate them. |
| #7 Missing @inrupt deps | Explicit decision: use @inrupt packages. Added in Phase 1a. |
| #8 No migration story | `schemaVersion` value in TinyBase Values. Checked on load. Defined in Phase 1c. |
| #9 Premature package | No new package. Types in `@devalbo/shared`, accessors in `@devalbo/state`, commands in `naveditor-lib`. |
| #10 Open decisions | All closed. Storage model decided. Vocab source decided. Membership model decided. Field coverage documented. |
| #11 No cross-domain story | Social entities and file tree entities coexist in the same store but are independent domains. No cross-references planned. They share the store for reactive UI convenience (one provider, one subscription model). |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Multi-value fields (emails, phones) don't fit a single string cell | Data loss | Store as JSON-serialized array string when > 1 value; accessor handles parse/serialize transparently |
| TinyBase cell value limit | Truncation | TinyBase has no hard limit on string cell size; not a real risk |
| @inrupt packages add unwanted transitive deps | Bundle size | These packages are tiny constant-only modules; verify with `pnpm ls` after install |
| ~~Splitting the command file introduces regressions~~ | ~~Broken commands~~ | **Done.** Split completed, all tests green. |
| Zod schematizer silently drops `z.enum()` fields | Missing cells in TinyBase schema | Use "store shape" schema variants with `z.string()` for enums; accessor-layer schemas keep `z.enum()` for validation |
| Store schema version mismatch on upgrade | Silent data loss | `schemaVersion` value + load-time check prevents old code from overwriting new data |
| JSON-LD roundtrip loses field ordering | Test flakiness | Compare semantically (deep equality on parsed objects), not by string comparison |

---

## What This Plan Does Not Cover

- **Actual Solid pod sync** (reading/writing to a remote pod over HTTP). This is a future phase that builds on the data model established here.
- **TypeIndex integration** (tb-solid-pod's `typeIndexes` table). This is Solid infrastructure for type discovery; it can be added independently when pod sync is implemented.
- **foaf:knows relationships** (contact-to-contact links). Requires a separate relationship table. Can be added when a UI use case demands it.
- **Access control** (WAC/ACP). This is a pod-level concern, not a local data model concern.
- **UI components** for social data (list views, forms, detail panels). These build on the accessor layer established here and can be developed independently.
