# Brutal Review: PLAN_SOLID_INTEGRATION.md

## Overall Assessment

The plan reads well on the surface. It references the right files, uses the right vocabulary, and proposes a reasonable-looking phased approach. But it papers over the hardest problems, makes architectural choices that will create long-term pain, and in several places the claimed "compatibility" with `tb-solid-pod` is illusory. Below is a point-by-point teardown.

---

## Critical Issues

### 1. The dual-storage model (`normalized columns + jsonLd mirror`) is a consistency timebomb

The plan proposes storing data as normalized scalar columns (for queryability) AND a `jsonLd` string cell (for roundtrip fidelity). This is a classic dual-write problem:

- **Who is the source of truth?** If the scalar columns and the jsonLd string disagree, which one wins? The plan says "Keep jsonLd and normalized columns synchronized" but never explains _how_.
- **TinyBase has no transactions.** If you update `displayName` but the jsonLd re-serialization throws, you're in an inconsistent state.
- **What about fields only in jsonLd?** The normalized columns cover a subset of the full JSON-LD shape. Where do `solid:oidcIssuer`, `solid:publicTypeIndex`, `pim:preferencesFile`, `org:hasMembership` with roles and time intervals live? Only in the jsonLd blob? Now you have a two-tier data model where some fields are queryable and some are buried in a string.
- **tb-solid-pod doesn't do this.** It stores the full Zod-validated JSON-LD objects directly as row values. The plan's approach is a fundamentally different storage strategy dressed up as "compatibility."

**Recommendation:** Pick one source of truth. Either store the full JSON-LD shape and derive views, or store normalized columns and build JSON-LD on export only. Don't maintain both.

### 2. `memberIdsJson` is a terrible design

The proposed groups schema includes `memberIdsJson` — a JSON array of member IDs stuffed into a string cell. This is the worst of both worlds:

- **Not queryable.** "Which groups is contact X a member of?" requires parsing every group's `memberIdsJson`. At any non-trivial scale this is awful.
- **No referential integrity.** Delete a contact and their ID silently rots inside group membership strings.
- **Throws away tb-solid-pod's rich membership model.** The reference project has a full `org:Membership` model with roles (`org:role`), time intervals (`time:Interval` with `hasBeginning`/`hasEnd`), and proper linked-data references. Where does any of that go in a JSON string cell on the group row?
- **Defeats the stated goal of normalization.** The plan says "Use normalized scalar cells for queryability" and then immediately un-normalizes the most relational data in the model.

**Recommendation:** Add a `memberships` table. Rows keyed by `groupId + contactId`, with cells for `role`, `startDate`, `endDate`. This is what normalized data actually looks like. TinyBase relationships or indexes can handle the lookups.

### 3. The "compatibility" claim is mostly fiction

The plan says: _"keeping the data model compatible with tb-solid-pod so data and workflows can move between projects with minimal translation."_

But:

- **Different storage models:** tb-solid-pod stores full JSON-LD with IRIs as property keys (`http://xmlns.com/foaf/0.1/name`). This plan stores `displayName` in a cell and hopes a mapper can bridge the gap.
- **Different table inventories:** tb-solid-pod has `typeIndexes`, `resources`, `cliScripts` tables. This plan ignores them.
- **Lossy mapping:** The proposed column list for personas omits `givenName`, `familyName`, `phone`, `image`, `bio`, and all the SOLID infrastructure fields (`oidcIssuer`, `publicTypeIndex`, `privateTypeIndex`, `inbox`, `preferencesFile`). For contacts, it omits `phone`, `url`, `photo`, `notes`, `role`, the `knows` relationship, and the entire agent-specific schema fields. For groups, it omits `url`, `logo`, `parent`, `childUnits`, and the entire rich membership model.
- **"Semantic compatibility" is hand-wavy.** The plan's Open Decision #3 says "semantic compatibility first, not byte-for-byte identity." What does that mean in practice? If you export a persona from this system, import it into tb-solid-pod, and half the fields are missing — is that "semantically compatible"? Define which fields survive the roundtrip and which don't. Otherwise "compatibility" is just aspirational.

**Recommendation:** Either commit to full field parity (and accept the schema complexity) or explicitly document what's in-scope vs. out-of-scope for compatibility, with a concrete field mapping table. Don't promise compatibility and deliver a subset.

### 4. The phasing has a dependency problem

- **Phase 1** creates `packages/solid-model` with JSON-LD mappers.
- **Phase 2** extends the store schema.
- Phase 1's exit criteria: _"JSON-LD mapping roundtrip passes."_

Roundtrip _to/from what?_ The normalized columns that don't exist until Phase 2? You can't meaningfully test a mapper from JSON-LD to store rows when the store rows don't exist yet. Either the Phase 1 mappers are mapping to plain TypeScript objects (in which case the roundtrip test doesn't prove store compatibility), or the phases need to be reordered.

**Recommendation:** Merge Phase 1 and Phase 2, or at minimum define Phase 1 mappers as JSON-LD <-> domain objects (not store rows), and add a separate mapping layer for domain objects <-> store rows in Phase 2.

---

## Significant Issues

### 5. The command file will become unmanageable

All commands currently live in `naveditor-lib/src/commands/index.tsx` (456 lines). The plan adds:
- `persona`: 7 subcommands (list, create, show, edit, delete, set-default + set-inbox/set-typeindex from tb-solid-pod)
- `contact`: 7 subcommands (list, add, show, edit, delete, search, link)
- `group`: 8 subcommands (list, create, show, edit, delete, add-member, remove-member, list-members)

That's 22 new subcommand handlers. At ~20-30 lines each (conservative, looking at the reference project), that's 450-700 lines of new command code. The file will exceed 1000 lines with no architectural change proposed.

**Recommendation:** The plan should include splitting commands into per-namespace files (`commands/persona.ts`, `commands/contact.ts`, `commands/group.ts`) with a barrel export. Do this _before_ adding the new commands, not after.

### 6. Testing strategy is incomplete without the programmatic result mode

The plan correctly identifies that commands return React components (`CommandResult`) and suggests an optional "programmatic result mode" (Section 5). But then it lists integration tests like _"create persona/contact/group via commands, then verify store rows."_

How? You call the command handler, it returns a React element. You can check the store side-effects, but you can't assert on the command's output without rendering the React component. This makes the tests either:
- Store-only assertions (missing the command logic)
- React rendering tests (heavy, brittle, testing UI instead of logic)

The programmatic result mode isn't "optional but recommended" — it's a prerequisite for the testing plan to work.

**Recommendation:** Move Section 5 (command execution context upgrade) into Phase 1. You need it before you can write proper tests.

### 7. Missing dependency: `@inrupt/vocab-*` packages

tb-solid-pod uses `@inrupt/vocab-common-rdf` and `@inrupt/vocab-solid-common` for vocabulary constants (FOAF, VCARD, LDP, SOLID, etc.). The plan's `packages/solid-model` will need these same constants for JSON-LD mapping. But the plan never mentions adding these dependencies.

Are you going to:
- (a) Add @inrupt packages as dependencies? (Adds a new dependency tree)
- (b) Copy-paste the IRI strings? (Immediate divergence risk from tb-solid-pod)
- (c) Define a subset? (Which subset? Decided by whom?)

This should be an explicit decision, not an afterthought.

### 8. No migration story for persisted stores

Phase 4 mentions _"Add migration utility for older store versions with no social tables"_ without explaining what that means. TinyBase doesn't have a built-in migration system. If the store is persisted to SQLite (which this codebase supports), you need actual schema migration logic:

- How do you detect the old schema?
- How do you add new tables to an existing persisted store?
- What happens if a user opens an old persisted store with the new code?
- Does TinyBase even handle this gracefully, or does it throw?

This isn't a Phase 4 concern — it's a Phase 2 concern. The moment you change the store schema, existing persisted stores are affected.

---

## Minor Issues

### 9. The `packages/solid-model` package might be premature abstraction

The stated justification is _"Prevents SOLID-specific logic from leaking into unrelated packages."_ But:

- The types are needed by `@devalbo/state` (for the store schema) and `naveditor-lib` (for commands). That's... the two main consumers.
- Creating a separate package adds: its own `package.json`, `tsconfig.json`, build step, version management, and cross-package dependency resolution.
- The existing `@devalbo/shared` package already serves as the "shared types" location.

Consider whether the types/schemas could live in `@devalbo/shared` with a `types/solid/` subdirectory, and the mappers could live in `@devalbo/state`. A new package is warranted if there will be multiple independent consumers or if the package needs independent versioning. Neither is demonstrated here.

### 10. The "Open Decisions" section reveals the plan is unfinished

Three "open decisions" with "recommended defaults" isn't a plan — it's a proposal awaiting decisions. And the listed decisions are the easy ones. The hard questions aren't even acknowledged:

- How to handle the rich membership model (roles, time intervals)?
- Which vocabulary constants to use and where they come from?
- How to handle JSON-LD `@context` and namespace management?
- How do social entities (personas/contacts/groups) relate to the existing file tree entities?
- What's the story for cross-entity references (contact linked to persona, group containing contacts)?

### 11. No consideration of cross-entity relationships with existing data

The codebase currently manages `entries` (file tree) and `buffers` (editor content). The plan adds personas, contacts, and groups as if they exist in a vacuum. But they're going into the same TinyBase store. Questions the plan should address:

- Can a file be "owned by" a persona?
- Can a buffer reference a contact?
- Are there any planned interactions between the file/editor domain and the social domain?
- If not, why are they in the same store?

---

## What the Plan Gets Right

To be fair:

- **Correct identification of the reference contracts.** All cited files in tb-solid-pod exist and contain what the plan says they contain.
- **The command namespace alignment** (persona/contact/group) mirrors tb-solid-pod well and fits the existing hierarchical command framework.
- **Recognizing the need for typed accessors.** The codebase currently has no accessor layer and adding one is the right call.
- **The Zod validation pattern** from tb-solid-pod is a good fit — the codebase already uses Zod.
- **Identifying the programmatic result mode gap** in the command system, even though it's incorrectly classified as optional.

---

## Summary of Recommendations

| # | Issue | Recommendation |
|---|-------|---------------|
| 1 | Dual-storage model | Pick one source of truth, not two |
| 2 | `memberIdsJson` | Add a `memberships` table instead |
| 3 | Overpromised compatibility | Define explicit field mapping with in/out-of-scope fields |
| 4 | Phase dependency issue | Merge Phases 1+2 or redefine mapper targets |
| 5 | Command file growth | Split into per-namespace files before adding commands |
| 6 | Untestable commands | Make programmatic result mode Phase 1, not optional |
| 7 | Missing @inrupt deps | Decide on vocabulary constant source explicitly |
| 8 | No migration story | Address persisted store migration in Phase 2 |
| 9 | Premature package | Consider `@devalbo/shared` subpath instead of new package |
| 10 | Open decisions | Close them or acknowledge them as blockers |
| 11 | No cross-domain story | Address relationship to file tree entities |
