# Plan: Solid Integration (v4)

This plan incorporates findings from the original draft plan, its review, a full audit of both the devalbo monorepo and tb-solid-pod, and general Solid/federation design principles.

**When working on this plan, follow the maintenance policy in `PLAN_MAINTENANCE.md`.** Summary of how it applies here:

- **Before starting any phase:** Run the dependency hygiene checks (e.g. `pnpm outdated -r`, build and test pass). Fix version sync in a dedicated commit before layering feature work.
- **New dependencies:** Any dependency used by more than one package (e.g. `@inrupt/vocab-*` in shared, and later possibly state) must be added to the `catalog` in `pnpm-workspace.yaml` and referenced via `catalog:` in each consumer's `package.json`. Single-package deps may stay inline.
- **Internal references:** All `@devalbo/*` and app→lib references use `workspace:*`. No exceptions.
- **Upgrades:** One version per dep across the workspace. Fix forward on breaking changes — update consuming code, do not add compatibility shims. One commit per logical upgrade; do not mix dependency maintenance with feature logic in the same commit.
- **Validation:** Every dependency or build change must pass full workspace build and test before merge.

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

Before starting any phase, run the **Dependency Hygiene Checks** from `PLAN_MAINTENANCE.md`: `pnpm outdated -r`, confirm shared deps are in catalog, build and test pass. If drift exists, fix in a separate maintenance commit first.

---

### Phase 0: Structural Preparation — COMPLETE

> Implemented in commit `7bfa7c8`. See `PRE_4_MAINTENANCE.md` for full details.

- **0a. Split command file** — `index.tsx` split into `_util.tsx`, `filesystem.ts`, `system.ts`, `io.ts`, barrel `index.ts`. All existing commands preserved.
- **0b. Structured result on CommandResult** — Added `data?: unknown` and `status?: 'ok' | 'error'` to `CommandResult`. Backward-compatible (both optional).
- **0c. Typed accessors for entries/buffers** — Zod-validated `get`/`set`/`list`/`delete` accessors. Schemas in `packages/shared/src/schemas/`. 8 tests passing.

### Phase 1: Domain Model + State

Add the social data model and store integration.

**1a. Add vocabulary constants**
- **Already complete:** The Inrupt vocab packages (`@inrupt/vocab-common-rdf` v1.0.5, `@inrupt/vocab-solid-common` v0.7.5) are already installed and promoted to the pnpm catalog (lines 25-26 in `pnpm-workspace.yaml`), and referenced via `catalog:` in `packages/shared/package.json`.
- **Already complete:** `packages/shared/src/vocab/namespaces.ts` already imports `FOAF`, `VCARD`, `LDP`, `DCTERMS` from `@inrupt/vocab-common-rdf` and `SOLID`, `WS` from `@inrupt/vocab-solid-common`, and defines custom `ORG`, `TIME`, `NS`, `POD_CONTEXT` constants for vocabularies not available in Inrupt's packages (W3C org ontology, W3C time ontology).
- **Already complete:** These are exported from `packages/shared/src/index.ts`.
- **Usage in Phase 3:** The JSON-LD mappers will import these constants (e.g., `FOAF.Person`, `VCARD.Individual`, `ORG.Organization`) to set `@type` values, and use the property constants (e.g., `FOAF.name`, `VCARD.hasEmail`) for field mapping. This avoids hardcoding IRI strings and ensures consistency with the field mapping table (lines 197–230).

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

Add the CLI command families. This phase resolves several design decisions that were implicit in the original plan.

---

#### Design Decision: Store Access in Command Handlers

**Problem:** Existing command handlers (`filesystem.ts`, `io.ts`, `system.ts`) never touch the TinyBase store — they operate on the filesystem via injected helpers. Social commands need CRUD access to the store. `ExtendedCommandOptions` currently carries `cwd`, `setCwd`, `clearScreen`, `exit` but no store reference. The plan must specify how the store reaches command handlers.

**Options considered:**

- **A. Add `store` to `ExtendedCommandOptions`.** Follow the existing pattern: options is the bag that carries context. Use a union of option types and handler types so that social handlers and the app invocation site require `store` (see concrete types below); filesystem handlers keep optional options.
- **B. Factory pattern — close over the store at registration time.** Each social command file exports a factory `(store: Store) => Record<string, AsyncCommandHandler>`. The barrel calls the factory when assembling the map. Downside: breaks the current pattern where all handler files export a static record.
- **C. Global/singleton store import.** Import the store from a module. Downside: hard to test, tight coupling, breaks multi-store scenarios.

**Decision: Option A — add `store` to `ExtendedCommandOptions`.**

**Rationale:** This is the path of least resistance. The existing convention is that `ExtendedCommandOptions` is the context bag — every new capability (`setCwd`, `clearScreen`, `exit`) was added here. Adding `store` follows the same pattern. No factory indirection, no global state. Use a **union of option and handler types** so that store is required (non-optional) for social handlers and at the app invocation site, while filesystem handlers keep their existing signature.

Concretely:
```ts
// _util.tsx
import type { Store } from 'tinybase';

type CommandOptionsBase = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
};

// Union: options may be with or without store (e.g. fs-only tests can omit store).
export type ExtendedCommandOptions =
  | CommandOptionsBase
  | (CommandOptionsBase & { store: Store });

// Required for social handlers and for invoking the command map from the app.
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: Store };

// Handlers that don't need the store (filesystem, io, system).
export type AsyncCommandHandler = (
  args: string[],
  options?: ExtendedCommandOptions
) => Promise<CommandResult>;

// Handlers that require the store; use this for persona/contact/group.
export type SocialCommandHandler = (
  args: string[],
  options: ExtendedCommandOptionsWithStore
) => Promise<CommandResult>;

// Map accepts both; invocation with the map then requires options to include store.
export type CommandHandler = AsyncCommandHandler | SocialCommandHandler;
```

- **Barrel / map:** `CommandMap = Record<CommandName, CommandHandler>`. When the app calls `commands[cmd](args, options)`, TypeScript requires `options` to satisfy both handler parameter types, so the app must pass `ExtendedCommandOptionsWithStore` (store required). Social command handlers are typed as `SocialCommandHandler`, so inside them `options.store` is non-optional.
- **Tests:** Social command tests pass a real store in options. For filesystem-only tests that want to omit the store, pass a minimal options object and cast the handler to `AsyncCommandHandler` when calling, or pass a dummy store.

---

#### Design Decision: Subcommand Dispatch Pattern

**Problem:** The plan describes hierarchical commands (`persona list`, `persona create`, `group add-member`). The current `CommandMap` is flat — `Record<CommandName, AsyncCommandHandler>` with names like `cd`, `ls`, `rm`. The `CommandName` type is a static union. The plan must specify how hierarchical commands integrate with this flat structure.

**Options considered:**

- **A. Flat compound names.** Register `persona-list`, `persona-create`, `group-add-member` as top-level entries in `CommandMap`. Simple but ugly — doesn't match how users type commands, and Commander.js would need to map `persona list` → `persona-list`.
- **B. Single entry per namespace with internal dispatch.** Register `persona`, `contact`, `group` as top-level entries. Each handler examines `args[0]` as the subcommand name and dispatches to an internal sub-handler table. Commander.js registers the hierarchy for help text. The `CommandMap` stays flat with 3 new entries instead of 20+.
- **C. Nested map structure.** Change `CommandMap` to support `Record<string, AsyncCommandHandler | Record<string, AsyncCommandHandler>>`. Requires changing the dispatch logic everywhere the map is consumed.

**Option C downsides (dispatch and maintainability):**

- **How onerous:** Updating dispatch is bounded (one `resolveAndExecute`-style helper plus four call sites), but the ongoing cost is mixed map shape, weaker typing, and every future consumer having to handle nesting.
- **Where dispatch happens today:** The map is consumed in four places: `InteractiveShell.tsx` (lookup by `commandName`, then `command(args, options)`), `cli.tsx` (same for each Commander command), and two `console-helpers.ts` files (web and lib). Each does "get handler = commands[name]; if (!handler) …; await handler(args, options)". With a nested map, the value at `commands['persona']` is an object, not a callable — so every consumer must branch: if it's a function, call it; else treat it as a nested map, take `args[0]` as subcommand, look up again, call with `args.slice(1)`. That's either duplicated in four places or centralized in a single `resolveAndExecute(commands, name, args, options)` helper that all four call. So the code change is bounded (one helper + four call sites), but the **invariant** "one key → one handler" is gone: the map has two shapes, and every reader must remember that some keys yield a function and some yield a sub-map.
- **TypeScript:** The map type becomes a union. There's no way to express "key `persona` → nested record, key `ls` → handler" in the type system without a discriminated union keyed by command name, which is brittle when adding commands. In practice you end up with a runtime check (`typeof entry === 'function'`) and optional chaining for the nested case; type safety for "valid subcommand" is weaker.
- **Readability:** The barrel and any code that iterates the map see a mixed structure: `{ ls: fn, cd: fn, ..., persona: { list: fn, create: fn, ... }, ... }`. Adding a command means "add to the right flat object" vs "add to the right nested object" — two patterns. Tests that today do `commands.ls(...)` would do `commands.persona.list(...)` for subcommands, or go through a resolver; direct `commands.persona(args, options)` is invalid because `persona` is not a function.
- **Maintainability:** Any new consumer of the command map (e.g. a new UI or script runner) must implement or use the same resolve-then-dispatch logic and remember the two shapes. With Option B, the map stays "name → handler"; the hierarchy is encapsulated inside the three namespace handlers, so new consumers keep the same simple lookup-and-call pattern.

**Decision: Option B — single entry per namespace with internal dispatch.**

**Rationale:** This matches how CLI tools work in practice (`git commit`, `docker compose up`). The `CommandMap` stays flat (3 new entries: `persona`, `contact`, `group`), the `CommandName` union grows by 3 names instead of 20+, and no existing dispatch logic changes. Each domain file (`persona.ts`, `contact.ts`, `group.ts`) exports both a dispatch handler (for the map) and individual sub-handlers (for direct testing). Commander.js uses `.command('persona').addCommand(...)` for help/completion.

Concretely:
```ts
// persona.ts
const subcommands: Record<string, SocialCommandHandler> = {
  list: async (args, options) => { ... },
  create: async (args, options) => { ... },
  show: async (args, options) => { ... },
  // ...
};

const subcommandHelp = (): CommandResult => makeOutput(
  'Usage: persona <subcommand>\n\n' +
  'Subcommands:\n' +
  Object.keys(subcommands).map((name) => `  ${name}`).join('\n')
);

export const personaCommand: SocialCommandHandler = async (args, options) => {
  const [sub, ...rest] = args;
  if (!sub || sub === 'help') return subcommandHelp();
  const handler = subcommands[sub];
  if (!handler) return makeError(`Unknown subcommand: persona ${sub}`);
  return handler(rest, options);
};

// Exported for direct testing
export { subcommands as personaSubcommands };
```

Each namespace handler (`persona`, `contact`, `group`) follows this pattern: if no subcommand or `help` is given, return a help listing of available subcommands. This provides subcommand-level help without requiring Commander.js to know about individual subcommands.

---

#### Design Decision: Commander.js Registration & Arg Parsing for Social Commands

**Problem:** Social commands have both positional args (`<name>`, `<id>`) and option flags (`--nickname`, `--email`, `--json`, `--type`). The plan must specify: (1) how Commander.js registers social commands, and (2) where arg/option parsing happens.

**Options considered for Commander.js registration:**

- **A. Full parse — register every subcommand with specific args and options.** Commander.js definitions mirror the full arg/option spec (e.g., `persona create <name> --nickname <nick> --email <email>`). Good `--help` output, but duplicates Zod/@optique schema definitions.
- **B. Pass-through — register parent command with variadic args.** Parent command takes `.argument('<subcommand>').argument('[args...]')` and passes the raw args array to the namespace handler. Simpler, no duplication, but `--help` only shows the parent, not individual subcommands.

**Options considered for option/flag parsing:**

- **A. Commander.js parses options.** Commander extracts `--key value` pairs and passes them as a parsed options object to the handler. Tests must either use Commander's `parseAsync` or bypass it entirely with hand-constructed option objects.
- **B. Custom `parseArgs` in the handler.** A hand-rolled utility that extracts positional args and `--key=value` / `--key value` / `--flag` pairs. Reinvents what `@optique` already does, less robustly (no short options, no bundled flags, no typed value parsers).
- **C. `@optique/core` with `option()` support.** `@optique/core` already provides `option()` for `--flag` style args, `argument()` for positional args, `command()` for subcommand matching, and `or()` for discriminated unions. The existing filesystem parsers use `@optique` + Zod via `parseWithSchema`. Social commands extend the same pattern. One parsing library across the codebase.

**Decision: Pass-through Commander.js registration + `@optique` for all arg/option parsing (Option B + C).**

**Rationale:**
- **Commander.js registration:** Use pass-through (Option B). Register `persona`, `contact`, `group` as parent commands with variadic args. Commander provides top-level `--help`; individual subcommand help is handled by the namespace handler's help fallback. This avoids duplicating 20+ subcommand definitions in Commander that already exist in `@optique`/Zod schemas.
- **Arg parsing:** Use `@optique/core` (Option C). `@optique` provides `option("-n", "--nickname", string())` for named options, `option("--json")` for boolean flags, and `argument(string())` for positional args — all composable via `object()` and validated with Zod through the existing `parseWithSchema` pattern. This keeps one parsing library across the codebase (filesystem commands and social commands both use `@optique` + Zod), avoids reinventing a custom `parseArgs`, and gives better error messages, short-option support (`-n`), and `--key=value` / `--key value` handling for free.
- Tests call handlers with plain string arrays (the `@optique` `parse()` function takes `string[]`), so there is no Commander dependency in tests.

Concretely:
```ts
// social-args.parser.ts — follows the same pattern as command-args.parser.ts
import { argument, object, optional, option, parse, string, type Parser } from '@optique/core';

// persona create <name> [--nickname <nick>] [--email <email>] [--bio <bio>] ...
const personaCreateParser = object({
  name: argument(string()),
  nickname: optional(option("--nickname", string())),
  email: optional(option("--email", string())),
  bio: optional(option("--bio", string())),
  homepage: optional(option("--homepage", string())),
  image: optional(option("--image", string())),
});

// persona show <id> [--json]
const personaShowParser = object({
  id: argument(string()),
  json: option("--json"),  // boolean flag — false when absent
});

// contact list [--agents] [--people]
const contactListParser = object({
  agents: option("--agents"),
  people: option("--people"),
});

// group create <name> [--type <type>] [--description <desc>] ...
const groupCreateParser = object({
  name: argument(string()),
  type: optional(option("--type", string())),
  description: optional(option("--description", string())),
  url: optional(option("--url", string())),
  logo: optional(option("--logo", string())),
  parent: optional(option("--parent", string())),
});

// Each composed with Zod via parseWithSchema, same as filesystem parsers:
export const parsePersonaCreateArgs = (args: string[]): ParseResult<PersonaCreateArgs> =>
  parseWithSchema(personaCreateParser, args, PersonaCreateArgsSchema);
```

```ts
// program.ts registration — pass-through, Commander doesn't parse subcommand args
const collect = (value: string, prev: string[]) => [...prev, value];
program.command('persona')
  .description('Manage personas (list, create, show, edit, delete, set-default)')
  .argument('<subcommand>')
  .argument('[args...]', '', collect, []);
```

---

#### Design Decision: Branded Social IDs

**Problem:** The `BRANDED_TYPES.md` guide specifies that social IDs (`PersonaId`, `ContactId`, `GroupId`, `MembershipId`) should be branded to prevent cross-domain mixups. Phase 1 accessors currently accept plain `string` IDs. Phase 2 is where IDs flow through arg parsing → handler logic → accessor calls → result data. The plan must decide when brands are introduced.

**Options considered:**

- **A. Introduce brands in Phase 2.** Define brand types and toolboxes in `@devalbo/shared`. Update accessor signatures in `@devalbo/state` to accept branded IDs. Update Phase 1 tests. Build commands with branded IDs from the start.
- **B. Define brands in Phase 2, use at command layer only.** Create the brand types and toolboxes, use them in arg schemas and command handlers, but pass them to accessors as-is (a branded string is structurally assignable to `string`). Tighten accessor signatures in a follow-up pass.
- **C. Defer brands entirely.** Build Phase 2 with plain strings. Brand everything in a dedicated pass after commands are working.

**Decision: Option B — define brands in Phase 2, use at command boundary, tighten accessors later.**

**Rationale:** This follows the branded types guide's own adoption order: "1. Paths and command args, 2. Accessor row IDs." Paths are already branded. Phase 2 introduces social commands — the natural place to brand social IDs at the parse boundary. Since branded types are structurally `string & { __brand }`, they pass to accessors that accept `string` without any accessor changes. This means:
- Brand infrastructure (types, toolboxes, parse/assert functions) ships in Phase 2
- Command arg schemas produce branded IDs (validation at the untrusted boundary)
- Command handlers work with branded IDs internally
- Accessors accept them without signature changes (branded string is assignable to string)
- A follow-up pass (**Phase 2.5**, see Phased Delivery and Concrete File Changes) tightens accessor signatures from `string` to the specific brand, which is a non-breaking change for callers already passing branded values

This avoids blocking Phase 2 on an accessor refactor while getting the brand infrastructure in place where it matters most (user input parsing). Phase 2.5 is a required step in this plan so the follow-up is not left out.

---

#### Design Decision: CommandResult Helpers

**Problem:** `makeOutput` and `makeError` in `_util.tsx` produce `CommandResult` with `component` (and optionally `error`) but never set `data` or `status`. Social commands need to populate these fields for programmatic testing.

**Decision:** Add `makeResult` and `makeResultError` helpers alongside the existing ones. Social commands use the new helpers; existing commands are unchanged.

```ts
export const makeResult = (text: string, data: unknown): CommandResult => ({
  component: <Box flexDirection="column" padding={1}><Text>{text}</Text></Box>,
  data,
  status: 'ok'
});

export const makeResultError = (message: string, data?: unknown): CommandResult => ({
  component: <Box flexDirection="column" padding={1}><Text color="red">{message}</Text></Box>,
  error: message,
  data,
  status: 'error'
});
```

---

**2a. Define branded social IDs**
- Use `createBrandedUuidToolbox` from `@devalbo/branded-types` for each social ID family. This provides `createRandomId`, `createIdForKey`, `parseId`, `assertId`, and `idSchema` out of the box via the prefix+UUID methodology.
- Add `PersonaId`, `ContactId`, `GroupId`, `MembershipId` toolboxes to `packages/shared/src/types/branded.ts` (or a new `packages/shared/src/types/social-ids.ts` if branded.ts grows too large).
- Each toolbox follows this pattern:
  ```ts
  import { createBrandedUuidToolbox, IdTypePrefixBrandSchema } from '@devalbo/branded-types';

  const PERSONA_PREFIX = IdTypePrefixBrandSchema.parse('persona');
  export const PersonaIdToolbox = createBrandedUuidToolbox(PERSONA_PREFIX, '_');
  export type PersonaId = ReturnType<NonNullable<typeof PersonaIdToolbox.createRandomId>>;
  ```
  This gives IDs like `persona_a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5`. Same pattern for `contact_`, `group_`, `membership_`.
- Each ID family also gets an `unsafeAs*` cast for trusted internal use (e.g., `unsafeAsPersonaId`).
- Export toolboxes and types from `packages/shared/src/index.ts`.

**2b. Add arg schemas and parsers**
- Create `naveditor-lib/src/lib/social-args.schema.ts` with Zod schemas for all social command args. Schemas produce branded ID outputs where applicable (e.g., `PersonaId` for the `<id>` argument in `persona show`).
- Create `naveditor-lib/src/lib/social-args.parser.ts` with `@optique/core` parsers using `argument()` for positional args and `option()` for named flags/options, composed with Zod validation via `parseWithSchema`. Follows the same pattern and `ParseResult<T>` return type as the existing `command-args.parser.ts`. See Design Decision: Commander.js Registration & Arg Parsing for concrete examples.

**2c. Add `store` to ExtendedCommandOptions**
- Implement the union-typed `ExtendedCommandOptions` / `ExtendedCommandOptionsWithStore` / `SocialCommandHandler` / `CommandHandler` types as specified in the Store Access design decision.
- Add `makeResult` and `makeResultError` helpers.

**2d. Add command handlers**
- Create `naveditor-lib/src/commands/persona.ts` — internal subcommand table + dispatch handler. Subcommands: `list`, `create`, `show`, `edit`, `delete`, `set-default`. Includes help fallback (no subcommand or `help` → list available subcommands).
- Create `naveditor-lib/src/commands/contact.ts` — subcommands: `list`, `add`, `show`, `edit`, `delete`, `search`, `link`. Same help fallback.
- Create `naveditor-lib/src/commands/group.ts` — subcommands: `list`, `create`, `show`, `edit`, `delete`, `add-member`, `remove-member`, `list-members`. Same help fallback.
- Each handler extracts `store` from options, uses branded IDs, populates `data` and `status` on `CommandResult` via `makeResult`/`makeResultError`.

**2e. Register commands**
- In `naveditor-lib/src/program.ts`: register `persona`, `contact`, `group` as Commander.js parent commands with subcommand definitions for help text (see Design Decision: Commander.js Subcommand Strategy below).
- In `naveditor-lib/src/commands/index.ts`: add `persona`, `contact`, `group` to `CommandName` union and merge dispatch handlers into `CommandMap`. The map value type becomes `CommandHandler` (the union of `AsyncCommandHandler | SocialCommandHandler`).

**2f. Wire store into command invocation sites**
- Update `naveditor-lib/src/components/InteractiveShell.tsx`: accept a `store` prop (or obtain via React context), include it in `commandOptions` passed to every `command(args, options)` call. The `CommandMap` value type is `CommandHandler` (union), so TypeScript requires `options` to include `store`.
- Update `naveditor-lib/src/cli.tsx`: obtain the store (create or receive as parameter), include it in the options passed to `handler(args, options)`.
- Update `naveditor-lib/src/web/console-helpers.ts` and `naveditor-web/src/console-helpers.ts`: same — include `store` in the options passed to `command(args, options)`.
- All four sites must pass `ExtendedCommandOptionsWithStore` to satisfy the `CommandHandler` union type.

**2g. Tests**
- Arg parser tests: valid/invalid inputs for each subcommand's arg schema.
- Sub-handler unit tests: call individual sub-handlers directly (e.g., `personaSubcommands.create`) with a fresh in-memory store in options. Assert on `data`/`status` and store state.
- Dispatch tests: call the namespace handler (e.g., `personaCommand`) with subcommand args, verify routing.
- Located in `naveditor/tests/unit/commands/` (matching existing test location, not `packages/commands/tests/`).

**Exit criteria:**
- All social commands work end-to-end (create, list, show, edit, delete for each entity).
- Group membership commands work (add-member, remove-member, list-members).
- Contact search works.
- Persona set-default works.
- Branded ID parse/validation works at the arg boundary.
- All tests pass.

---

### Phase 3: JSON-LD Interop

Add Solid-compatible import/export. This phase resolves the JSON-LD structure and mapping decisions.

**Design Authority:** The Solid Protocol specification and related W3C RDF vocabularies (FOAF, vCard, org ontology, etc.) are the authoritative sources for external representation. Where a published Solid spec or W3C standard exists, we defer to it. If tb-solid-pod or any other implementation deviates from the published spec, the implementation should update to match the spec, not vice versa. Our JSON-LD output is spec-compliant first, implementation-compatible second. Roundtrip tests against tb-solid-pod serve as an interop check, not as a design authority.

---

#### Design Decision: JSON-LD Structure and Serialization

**Problem:** The mappers must produce concrete JSON-LD objects with specific `@context`, `@type`, `@id`, and property structures. The field mapping table (lines 197–230) maps domain cells to vocabulary IRIs, but doesn't specify: (1) what `@type` values to use, (2) how to handle `@context`, (3) how IRI-valued fields are wrapped, (4) how multi-value fields are serialized, or (5) how optional/empty fields are handled.

**Design Authority (reiterated):** Published Solid specs and W3C RDF vocabularies are the source of truth for these decisions. We reference tb-solid-pod as an interop validation target, but if it deviates from the spec, we follow the spec.

**Options considered for `@type` values:**

- **A. Follow published RDF/Solid specifications.** Use vocabulary types as defined in the published specs (W3C FOAF, vCard, org ontology). Spec-compliant first. If tb-solid-pod or other implementations use different types, they should update to match the spec.
- **B. Match tb-solid-pod's types exactly.** Use the same `@type` for each entity that tb-solid-pod produces, even if it diverges from published specs. Prioritizes immediate interop with one specific implementation over spec compliance.

**Options considered for `@context` placement:**

- **A. Inline per-entity.** Each entity JSON-LD object includes the full `POD_CONTEXT`. Entities are self-contained but bundles are verbose.
- **B. Shared top-level in bundles.** Bundle has one `@context` at the root; entities omit it. Compact, but individual entities aren't valid JSON-LD outside a bundle.
- **C. Minimal per-entity.** Each entity includes only the namespace prefixes it actually uses. Compact and self-contained.

**Options considered for NodeRef wrapping:**

- **A. Wrap all IRI-valued fields.** Every field that is an IRI (email as `mailto:`, URLs, webId, etc.) is wrapped in `{ "@id": "..." }` (NodeRef). Most explicit, verbose.
- **B. Wrap only object references.** Fields that reference other entities (e.g., `linkedPersona`, `parentGroup`) are wrapped; scalar IRIs (email, homepage) are plain strings with the URI prefix. More compact.
- **C. Context-dependent.** Let the `@context` `@type` coercion determine the shape. Fields declared as `@id` in context get NodeRef, others don't.

**Options considered for multi-value fields:**

- **A. Store multiple values as JSON array string in the cell; mapper parses and expands to JSON-LD array.** The domain cell is `"[\"mailto:a@b.com\",\"mailto:c@d.com\"]"` (string). The mapper parses, wraps each in NodeRef, outputs JSON-LD `[{"@id":"mailto:a@b.com"},{"@id":"mailto:c@d.com"}]`.
- **B. Store as single value (most common case); use a secondary table for additional values.** Most contacts have one email. Store the first in the `email` cell; additional emails go in a `contactEmails` table keyed by `contactId`. The mapper queries both. Avoids JSON-in-string.
- **C. Store multiple values separated by a delimiter (e.g., comma or semicolon).** The domain cell is `"mailto:a@b.com,mailto:c@d.com"`. The mapper splits, wraps each. Simple but fragile if values contain the delimiter.

**Decisions:**

**`@type` values (Option A — follow published RDF/Solid specifications):**

The `@type` constants are already available via the Inrupt vocabulary libraries (`@inrupt/vocab-common-rdf`, `@inrupt/vocab-solid-common`) that are installed in `packages/shared`. The `packages/shared/src/vocab/namespaces.ts` file already imports `FOAF`, `VCARD`, `LDP`, `DCTERMS`, `SOLID`, `WS` and defines custom `ORG` and `TIME` constants for vocabularies not yet available in Inrupt's packages. These constants reference the IRIs defined in the published W3C specifications.

**Concrete `@type` values and their TypeScript constant references (per published specs):**

- **Persona:** `FOAF.Person` → `"http://xmlns.com/foaf/0.1/Person"` (W3C FOAF spec, also used by tb-solid-pod)
- **Contact (person):** `VCARD.Individual` → `"http://www.w3.org/2006/vcard/ns#Individual"` (W3C vCard spec)
- **Contact (agent):** `VCARD.Individual` → `"http://www.w3.org/2006/vcard/ns#Individual"` (distinguished by presence of `schema:applicationCategory` field)
- **Group (organization):** `ORG.Organization` → `"http://www.w3.org/ns/org#Organization"` (W3C org ontology spec)
- **Group (team):** `ORG.OrganizationalUnit` → `"http://www.w3.org/ns/org#OrganizationalUnit"` (W3C org ontology spec)
- **Group (group):** `VCARD.Group` → `"http://www.w3.org/2006/vcard/ns#Group"` (W3C vCard spec)
- **Membership:** `ORG.Membership` → `"http://www.w3.org/ns/org#Membership"` (W3C org ontology spec)

**Implementation note:** The mappers in Phase 3a should use prefixed string keys for property names and `@type` values (e.g., `"@type": "foaf:Person"`, `"foaf:name": row.name`) as specified in the Design Decision: Property Key Format. The `@context` (via `POD_CONTEXT`) defines the prefix mappings that resolve these to full IRIs. For import-side matching (accepting JSON-LD that may use full IRIs), use the Inrupt constants (`FOAF.name`, etc.) as fallback keys.

**Interop note:** These types align with tb-solid-pod's current implementation and are spec-compliant. If future versions of tb-solid-pod or other Solid implementations deviate from these W3C-defined types, those implementations should be updated to match the published specifications, not the other way around.

**`@context` placement (Option A — inline per-entity):** Each entity includes the full `POD_CONTEXT`. This makes every entity self-contained JSON-LD that can be consumed individually or as part of a bundle. The bundle itself is a plain JSON object `{ personas: [...], contacts: [...], groups: [...] }` with no top-level `@context`; each array element is valid JSON-LD independently. Verbosity is acceptable for interop safety.

**NodeRef wrapping (Option B — wrap object references only):**
- **Wrapped in NodeRef:** `linkedPersona`, `parentGroup`, `webId`, any field that is a reference to another entity or WebID IRI.
- **Plain strings with URI prefix:** `email` as `"mailto:..."`, `phone` as `"tel:..."`, `image`/`homepage`/`url`/`logo` as plain URL strings. These are still IRIs but not wrapped because they are scalar values, not object references.
- This matches common JSON-LD practice where `@id` wrapping signals "this is a reference to another resource" vs "this is a literal URI value."

**Multi-value fields (Option A — JSON array string in cell):**
- **Storage:** When a persona/contact has multiple emails or phones, store as a JSON-serialized array string in the single cell: `"[\"mailto:a@b.com\",\"mailto:c@d.com\"]"`. Single values remain plain strings: `"mailto:a@b.com"`.
- **Export (domain → JSON-LD):** Mapper checks if cell is JSON (starts with `[`); if yes, parse as array, map each element (already has `mailto:` prefix), output as JSON-LD array. If no, treat as single value.
- **Import (JSON-LD → domain):** Mapper receives JSON-LD field (could be string, object, or array); normalize to array with `toArray()`, unwrap NodeRef if present, extract string values, serialize to JSON array string if length > 1, else store as single string.
- The accessor layer provides getters that transparently parse JSON arrays, so handlers see `string[]` when reading. Setters serialize back to JSON string.

**Optional/empty fields:** Omitted from JSON-LD export if the domain cell is empty string (`''`). On import, missing fields → `''` in the domain cell (TinyBase default).

**`@id` values:** The branded ID is used as-is (e.g., `"@id": "persona_abc123-..."`). No full IRI needed; the ID is the identifier. If full IRIs are required (e.g., for WebID Profile Document URIs), they go in dedicated fields (`webId`, `profileDoc`).

---

#### Design Decision: Property Key Format (Prefixed vs Full IRI)

**Problem:** The Inrupt vocabulary constants (`FOAF.name`, `VCARD.hasEmail`, etc.) expand to full IRIs (e.g., `"http://xmlns.com/foaf/0.1/name"`). But the JSON-LD examples in this plan use compact prefixed keys (`"foaf:name"`, `"vcard:hasEmail"`). These produce semantically equivalent RDF but different serialized JSON. The mapper must pick one form.

**Options considered:**

- **A. Full IRI keys via Inrupt constants.** Use `[FOAF.name]` as computed property keys. Output: `{ "http://xmlns.com/foaf/0.1/name": "Alice" }`. Unambiguous, no `@context` needed for property resolution. But verbose, hard to read, and doesn't match how JSON-LD is typically authored or consumed.
- **B. Prefixed keys as string literals.** Use `"foaf:name"` directly. Output: `{ "foaf:name": "Alice" }`. Compact, human-readable, matches standard JSON-LD practice. Requires `@context` with prefix definitions (already provided by `POD_CONTEXT`). The Inrupt constants are not used for building output keys.

**Decision: Option B — prefixed string keys.**

**Rationale:** Compact/prefixed JSON-LD is the standard serialization form. Every JSON-LD example in the Solid ecosystem, including tb-solid-pod's output and the W3C spec examples, uses prefixed keys. The `POD_CONTEXT` already defines all the required prefix mappings (`foaf:`, `vcard:`, `solid:`, `org:`, `dc:`, `schema:`, `ldp:`, `time:`). Prefixed keys are readable, compact, and interoperable.

**Consequences for the mapper code:**
- **Export:** Use prefixed string literals as property keys: `"foaf:name"`, `"vcard:hasEmail"`, `"solid:oidcIssuer"`, etc. Do NOT use `[FOAF.name]` computed keys (those produce full IRI keys in the output).
- **`@type` values:** Also use prefixed form: `"foaf:Person"`, `"vcard:Individual"`, `"org:Organization"`, etc. The `@context` compaction handles resolution.
- **Import:** Accept both prefixed and full IRI keys. When parsing incoming JSON-LD, check for the prefixed key first (common case), fall back to full IRI match using the Inrupt constants. This makes import robust to JSON-LD that has been expanded by a processor.
- **Inrupt constants role:** Used for import-side matching (recognizing full IRIs in expanded JSON-LD) and for `@type` comparisons during import. Not used for constructing export output keys.
- **Prefix key constants (optional):** If scattered string literals become a maintenance burden, define a `PREFIXED` constant object in `packages/shared/src/vocab/namespaces.ts` that maps friendly names to prefixed strings (e.g., `PREFIXED.foafName = "foaf:name"`). This is optional — prefixed strings are short and unlikely to be mistyped.

Concretely (example outputs):

```jsonc
// personaToJsonLd output for a typical persona
{
  "@context": {
    "@vocab": "http://www.w3.org/2006/vcard/ns#",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "vcard": "http://www.w3.org/2006/vcard/ns#",
    "solid": "http://www.w3.org/ns/solid/terms#",
    "ldp": "http://www.w3.org/ns/ldp#",
    "dc": "http://purl.org/dc/terms/",
    "schema": "https://schema.org/"
  },
  "@type": "foaf:Person",
  "@id": "persona_a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
  "foaf:name": "Alice",
  "foaf:nick": "alice",
  "foaf:givenName": "Alice",
  "foaf:familyName": "Smith",
  "vcard:hasEmail": "mailto:alice@example.com",
  "vcard:hasTelephone": "tel:+1-555-1234",
  "foaf:img": "https://example.com/alice.jpg",
  "vcard:note": "Software engineer",
  "foaf:homepage": "https://alice.example.com",
  "solid:oidcIssuer": "https://solidcommunity.net",
  "ldp:inbox": "https://alice.example.com/inbox/",
  "solid:publicTypeIndex": "https://alice.example.com/settings/publicTypeIndex.ttl",
  "foaf:isPrimaryTopicOf": { "@id": "https://alice.example.com/profile/card" }
}
```

```jsonc
// personaToJsonLd output with multi-value email
{
  "@context": { /* same */ },
  "@type": "foaf:Person",
  "@id": "persona_abc...",
  "foaf:name": "Bob",
  "vcard:hasEmail": [
    "mailto:bob@work.com",
    "mailto:bob@personal.com"
  ]
}
```

```jsonc
// contactToJsonLd output for a person contact
{
  "@context": { /* same */ },
  "@type": "vcard:Individual",
  "@id": "contact_x1y2z3...",
  "vcard:fn": "Jane User",
  "vcard:hasUID": "urn:uuid:a1b2c3d4-...",
  "vcard:nickname": "jane",
  "vcard:hasEmail": "mailto:jane@example.com",
  "solid:webid": { "@id": "https://pod.example.com/profile/card#me" },
  "vcard:hasRelated": { "@id": "persona_abc..." }
}
```

```jsonc
// contactToJsonLd output for an agent contact
{
  "@context": { /* same */ },
  "@type": "vcard:Individual",
  "@id": "contact_def456...",
  "vcard:fn": "Acme Bot",
  "vcard:hasUID": "urn:uuid:def456...",
  "schema:applicationCategory": "automation",
  "vcard:hasOrganizationName": "Acme Corp"
}
```

```jsonc
// groupToJsonLd output for an organization with memberships
{
  "@context": { /* same */ },
  "@type": "org:Organization",
  "@id": "group_org123...",
  "vcard:fn": "Acme Corp",
  "dc:description": "A software company",
  "vcard:hasURL": "https://acme.com",
  "vcard:hasLogo": "https://acme.com/logo.png",
  "vcard:hasMember": [
    { "@id": "contact_abc..." },
    { "@id": "contact_def..." }
  ],
  "org:hasMembership": [
    {
      "@type": "org:Membership",
      "org:member": { "@id": "contact_abc..." },
      "org:role": { "@id": "http://www.w3.org/ns/org#Role" },
      "org:memberDuring": {
        "@type": "time:Interval",
        "time:hasBeginning": "2026-01-01T00:00:00.000Z",
        "time:hasEnd": ""
      }
    }
  ]
}
```

```jsonc
// groupToJsonLd output for a team with parent organization
{
  "@context": { /* same */ },
  "@type": "org:OrganizationalUnit",
  "@id": "group_team456...",
  "vcard:fn": "Platform Team",
  "org:unitOf": { "@id": "group_org123..." },
  "vcard:hasMember": [
    { "@id": "contact_xyz..." }
  ]
}
```

**Rationale:**
- **`@type`:** Follow the published W3C RDF vocabulary specifications (FOAF, vCard, org ontology). These types are defined in stable, standardized specifications that the Solid ecosystem is built upon. The Inrupt vocabulary libraries provide TypeScript constants that reference these spec-defined IRIs. Where tb-solid-pod or other implementations currently use these types, that's validation of spec compliance, not a design constraint. If any implementation deviates from the published specs, that implementation should be updated to align with the standards.
- **`@context`:** Inline per-entity keeps entities self-contained. An implementer can export one persona and send it as standalone JSON-LD. The bundle format is a plain JSON object with arrays of complete JSON-LD entities.
- **NodeRef wrapping:** Wrap references to other entities/WebIDs (`linkedPersona`, `parentGroup`, `webId`, `profileDoc`, membership `org:member`). Don't wrap scalar IRIs (`email`, `phone`, `homepage`, `url`, `logo`, `image`). This matches JSON-LD best practices and how RDF tools distinguish object properties from datatype properties.
- **Multi-value:** JSON array string in the cell keeps storage simple (no secondary table). The accessor layer already handles transparent parse/serialize, so command handlers see `string[]`. The mapper checks for JSON array syntax and expands accordingly.
- **Optional fields:** Omit from JSON-LD if empty. On import, missing → `''` in cell (TinyBase default). Keeps JSON-LD clean; doesn't bloat exports with 15 empty string fields per entity.

---

**3a. JSON-LD mappers**
- Create `packages/state/src/mappers/persona-jsonld.ts`: `personaToJsonLd(row, id) -> object` (JSON-LD object), `jsonLdToPersonaRow(jsonLd) -> { id: string, row: PersonaRow }`. See Design Decision: JSON-LD Structure for the concrete output shape, `@type`, and field wrapping rules.
  - **Use prefixed string keys** for property names and `@type` values (see Design Decision: Property Key Format). Import `POD_CONTEXT` for `@context`; import Inrupt constants (`FOAF`, `VCARD`, etc.) only for import-side full-IRI matching.
  - **Example snippet (export):**
    ```ts
    import { POD_CONTEXT } from '@devalbo/shared/vocab/namespaces';
    import type { PersonaRow } from '@devalbo/shared';

    // Helper: omit key entirely if value is empty
    const field = (key: string, value: string) =>
      value ? { [key]: value } : {};

    export function personaToJsonLd(row: PersonaRow, id: string): Record<string, unknown> {
      return {
        "@context": POD_CONTEXT,
        "@type": "foaf:Person",
        "@id": id,
        "foaf:name": row.name,
        ...field("foaf:nick", row.nickname),
        ...field("foaf:givenName", row.givenName),
        ...field("foaf:familyName", row.familyName),
        ...field("vcard:hasEmail", row.email),
        ...field("vcard:hasTelephone", row.phone),
        ...field("foaf:img", row.image),
        // ... remaining fields per field mapping table
      };
    }
    ```
  - **Example snippet (import):**
    ```ts
    import { FOAF, VCARD } from '@devalbo/shared/vocab/namespaces';

    // Accept both prefixed and full IRI keys
    const get = (obj: Record<string, unknown>, prefixed: string, fullIri: string): string =>
      (obj[prefixed] ?? obj[fullIri] ?? '') as string;

    export function jsonLdToPersonaRow(jsonLd: Record<string, unknown>): { id: string; row: PersonaRowInput } {
      return {
        id: jsonLd["@id"] as string,
        row: {
          name: get(jsonLd, "foaf:name", FOAF.name),
          nickname: get(jsonLd, "foaf:nick", FOAF.nick),
          // ... remaining fields
        }
      };
    }
    ```
- Create `packages/state/src/mappers/contact-jsonld.ts`: same pattern. `@type` depends on `kind` field (`VCARD.Individual` for both person and agent; agents distinguished by `schema:applicationCategory` presence).
- Create `packages/state/src/mappers/group-jsonld.ts`: same pattern. `@type` depends on `groupType` (`"org:Organization"`, `"org:OrganizationalUnit"`, or `"vcard:Group"`). The group mapper also handles **membership expansion/flattening**:
  - **Export (`groupToJsonLd`):** Takes the store as a parameter, queries `memberships` table via `listMembers(store, groupId)`, builds `"vcard:hasMember"` array (simple NodeRefs) and `"org:hasMembership"` array (full membership objects with role + time interval). Uses prefixed string keys per the Property Key Format decision. See concrete example in the design decision.
  - **Import (`jsonLdToGroupRow`):** Extracts the group's own cells (name, type, description, etc.) and returns `{ id, row }`. Memberships are handled separately: a second helper `extractMembershipsFromGroupJsonLd(jsonLd) -> MembershipRowInput[]` walks `org:hasMembership`, unwraps each membership's fields, and returns an array of domain membership rows. The import command calls both helpers and writes memberships to the store.
- Create `packages/state/src/mappers/membership-jsonld.ts` (optional): `membershipToJsonLd(row) -> object` (for constructing the nested membership object in group export). This can also be inlined in `group-jsonld.ts` if it's only used there.
- Export from `packages/state/src/index.ts`.

**3b. Roundtrip tests**
- For each entity type: create domain row -> map to JSON-LD -> validate structure is spec-compliant -> map back to domain row -> assert equality.
- **tb-solid-pod schema dependency decision:** Copy the specific Zod schemas (`PersonaSchema`, `ContactSchema`, `GroupSchema`, `MembershipSchema`) from tb-solid-pod into a test helper file (`packages/state/tests/helpers/tb-solid-pod-schemas.ts`). Include a comment with the source commit hash and date. This avoids a dev dependency while keeping the validation baseline clear.
- **tb-solid-pod role in testing:** The copied tb-solid-pod schemas serve as an **interoperability check**, not as the source of truth. If a test fails because tb-solid-pod's schema diverges from the published Solid/RDF specs, investigate to determine whether: (1) our implementation is spec-compliant (pass), or (2) tb-solid-pod has a valid interpretation we should adopt (update our implementation), or (3) tb-solid-pod has deviated from the spec (document the divergence, optionally contribute a fix upstream). The test should validate spec compliance first, interop with specific implementations second.

**3c. Import/export commands**
- **Command design decision:** Add new top-level commands `solid-export` and `solid-import` (not subcommands of the existing `export`/`import`). This keeps the existing BFT export/import unchanged and avoids overloading `export` with two different formats. Register them in `program.ts` and add handlers to `io.ts` (or a new `social-io.ts` if `io.ts` becomes too large).
- **solid-export:** `solid-export [path]` — exports all personas, contacts, groups, memberships to a JSON-LD bundle file at the given path (defaults to `social-data.json` in cwd). Format: `{ personas: [...], contacts: [...], groups: [...] }` where each array element is a complete JSON-LD entity with inline `@context`. Reads from the store, calls the mappers, writes JSON to filesystem via the injected filesystem helpers.
- **solid-import:** `solid-import <file>` — imports a JSON-LD bundle from the given file path. Reads JSON, validates bundle structure, calls `jsonLdTo*Row` for each entity, writes to the store via accessors. Overwrites existing entities with matching IDs (upsert semantics).
- Both are `SocialCommandHandler`s (require store). They also use the injected filesystem helpers for file I/O (same as the existing `export`/`import` commands in `io.ts`).

**3d. Tests**
- Roundtrip: export from this system -> validate JSON-LD structure is spec-compliant -> import back -> assert equality.
- Interop check: export from this system -> validate against tb-solid-pod schemas (copied to test helpers) -> passes. If tb-solid-pod schema rejects spec-compliant output, investigate and document the divergence.
- Interop check: tb-solid-pod factory output (if available) -> import into this system -> export -> compare. Differences should be investigated to determine if they represent spec compliance vs implementation quirks.
- Edge cases: multi-value emails, agent contacts, team with parent org, membership with role and time interval.

**Exit criteria:**
- All roundtrip tests pass (spec-compliant JSON-LD survives domain → JSON-LD → domain transformation).
- tb-solid-pod interop checks pass OR divergences are documented with spec references.
- Import/export commands work for single entities and bundles.
- Field mapping table (lines 197–230) is verified: every field survives the roundtrip.

### Phase 2.5: Tighten accessor signatures (branded IDs) — COMPLETE

> Implemented alongside Phase 2. All accessor signatures in `@devalbo/state` already use branded ID types (`PersonaId`, `ContactId`, `GroupId`, `MembershipId`) for all ID parameters. All tests pass with branded IDs end-to-end.

---

## Testing Strategy

### Layer 1: Schema validation (unit)
- Zod schemas accept valid domain data, reject invalid.
- Currently covered by accessor tests in `packages/state/tests/` (social-accessors.test.ts validates schemas implicitly through accessor calls; store-schema.test.ts verifies schematizer output). Standalone schema-only tests in `packages/shared/tests/` are optional — add them if schemas grow complex enough to warrant isolated testing independent of accessors.

### Layer 2: Accessor CRUD (unit)
- Create an in-memory store, exercise each accessor, verify store state.
- Located in `packages/state/tests/`.

### Layer 3: Command execution (integration)
- Call command handler with args and a fresh in-memory store in options, assert on `CommandResult.data` and `CommandResult.status`.
- Verify store side-effects (row created/updated/deleted).
- Test both individual sub-handlers and namespace dispatch handlers.
- Located in `naveditor/tests/unit/commands/` (matching existing command test location).

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
- `pnpm-workspace.yaml` — add @inrupt/vocab-* to catalog if shared; else inline in shared only.
- `packages/shared/package.json` — add @inrupt/vocab-* deps (via `catalog:` if in catalog)
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
- `packages/shared/src/types/branded.ts` (or new `social-ids.ts`) — add PersonaId, ContactId, GroupId, MembershipId toolboxes via `createBrandedUuidToolbox` + types + `unsafeAs*` casts
- `packages/shared/src/index.ts` — add branded ID exports
- `naveditor-lib/src/lib/social-args.schema.ts` — new (Zod schemas for social command args, producing branded IDs)
- `naveditor-lib/src/lib/social-args.parser.ts` — new (`@optique` parsers with `option()` + `argument()`, composed with Zod via `parseWithSchema`)
- `naveditor-lib/src/commands/_util.tsx` — implement union-typed `ExtendedCommandOptions` / `ExtendedCommandOptionsWithStore` / `SocialCommandHandler` / `CommandHandler`; add `makeResult`/`makeResultError`
- `naveditor-lib/src/commands/persona.ts` — new (subcommand table + dispatch handler, with help fallback)
- `naveditor-lib/src/commands/contact.ts` — new (subcommand table + dispatch handler, with help fallback)
- `naveditor-lib/src/commands/group.ts` — new (subcommand table + dispatch handler, with help fallback)
- `naveditor-lib/src/commands/index.ts` — extend CommandName union, merge social dispatch handlers, map value type becomes `CommandHandler`
- `naveditor-lib/src/program.ts` — register persona/contact/group as pass-through parent commands with variadic args
- `naveditor-lib/src/components/InteractiveShell.tsx` — accept store prop/context, include in `commandOptions`
- `naveditor-lib/src/cli.tsx` — obtain store, include in handler options
- `naveditor-lib/src/web/console-helpers.ts` — include store in options
- `naveditor-web/src/console-helpers.ts` — include store in options
- `naveditor/tests/unit/commands/persona.test.ts` — new
- `naveditor/tests/unit/commands/contact.test.ts` — new
- `naveditor/tests/unit/commands/group.test.ts` — new
- `naveditor/tests/unit/commands/social-args.test.ts` — new (arg parser + schema tests)

### Phase 3
- `packages/state/src/mappers/persona-jsonld.ts` — new
- `packages/state/src/mappers/contact-jsonld.ts` — new
- `packages/state/src/mappers/group-jsonld.ts` — new
- `packages/state/src/mappers/index.ts` — new (barrel)
- `packages/state/src/index.ts` — add mapper exports
- `packages/state/tests/jsonld-roundtrip.test.ts` — new

### Phase 2.5 — COMPLETE
Implemented alongside Phase 2. All accessor signatures already use branded ID types.

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
