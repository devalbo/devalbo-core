# Plan 4 Review: Phase 3 (JSON-LD Interop) & Phase 2.5

Review of Phase 3 and Phase 2.5 detail sufficiency, conducted against the plan and codebase as of 2026-02-16.

**Last updated:** 2026-02-16 (after adding JSON-LD Design Decision section and Property Key Format decision)

---

## Status Summary

| Issue | Priority | Status |
|-------|----------|--------|
| Phase 2.5 detail | N/A | ✓ COMPLETE — implemented alongside Phase 2 |
| Issue 1: No concrete JSON-LD output shape | Must specify | ✓ RESOLVED |
| Issue 2: `@type` values not specified | Must specify | ✓ RESOLVED |
| Issue 3: `@context` handling is vague | Should specify | ✓ RESOLVED |
| Issue 4: Multi-value field serialization | Should specify | ✓ RESOLVED |
| Issue 5: Membership mapping detail | Should specify | ✓ RESOLVED |
| Issue 6: Import/export command design | Should specify | ✓ RESOLVED |
| Issue 7: tb-solid-pod dependency strategy | Should specify | ✓ RESOLVED |
| Issue 8: Property key format (prefixed vs full IRI) | Must specify | ✓ RESOLVED |

---

## Phase 2.5: COMPLETE ✓

Phase 2.5 (tighten accessor signatures with branded IDs) was implemented alongside Phase 2. All accessor signatures in `@devalbo/state` already use branded ID types (`PersonaId`, `ContactId`, `GroupId`, `MembershipId`). No further work needed.

---

## Phase 3: Needs More Detail

Phase 3 has enough *intent* but not enough *detail* for an implementer to work without consulting tb-solid-pod source code. Phase 2 went through a review cycle that added concrete code examples, design decisions, and resolved ambiguities. Phase 3 hasn't had that treatment.

### What's already sufficient

- **Mapper function signatures** are clear (`personaToJsonLd(row) -> Persona`, `jsonLdToPersonaRow(jsonLd) -> PersonaRow`).
- **Field mapping table** is comprehensive — every domain cell is mapped to its JSON-LD IRI (lines 197–230 of the plan).
- **Roundtrip test strategy** is clear (domain → JSON-LD → tb-solid-pod schema → domain).
- **Exit criteria** are concrete.
- **Concrete File Changes** list is complete.

### Issue 1: No concrete JSON-LD output shape

**Priority: Must specify before implementation.**

The mappers need to produce specific JSON-LD objects with `@context`, `@type`, `@id`, and property IRIs. The plan says "reconstruct JSON-LD on export" but never shows what a persona or contact looks like as JSON-LD.

Phase 2 has concrete code examples for parsers and handlers. Phase 3 has zero examples for mappers. An implementer would need to reverse-engineer the expected shape from tb-solid-pod's source code.

**Needed:** A concrete example of each entity type as JSON-LD output. For example:

```jsonc
// Expected output of personaToJsonLd(row) for a typical persona
{
  "@context": { /* POD_CONTEXT or subset */ },
  "@type": "???",
  "@id": "persona_abc123...",
  "foaf:name": "Alice",
  "foaf:nick": "alice",
  "vcard:hasEmail": { "@id": "mailto:alice@example.com" },
  "foaf:img": { "@id": "https://example.com/alice.jpg" },
  // ...
}
```

Without this, the shape is ambiguous: Are IRI-valued fields wrapped in `{ "@id": ... }` (NodeRef) or plain strings? Are optional empty fields omitted or included as empty strings? Is the `@id` the branded ID or a full IRI?

### Issue 2: `@type` values not specified

**Priority: Must specify before implementation.**

Each JSON-LD entity needs a `@type`. The field mapping table covers properties but not types. The plan needs to state:

- **Persona** `@type`: `foaf:Person`? `schema:Person`? Something else?
- **Contact** `@type`: `vcard:Individual`? Depends on `kind` field (`person` vs `agent`)?
- **Group** `@type`: Depends on `groupType` (`vcard:Group` vs `org:Organization` vs `org:OrganizationalUnit`)?
- **Membership** `@type`: `org:Membership`?

These should match what tb-solid-pod produces, since roundtrip compatibility is the goal.

### Issue 3: `@context` handling is vague

**Priority: Should specify before implementation.**

`POD_CONTEXT` exists (implemented in `packages/shared/src/vocab/namespaces.ts`) but the plan doesn't say:

- Does each entity get an inline `@context`? (simpler per-entity, but verbose in bundles)
- Does the bundle use a shared top-level `@context` and entities omit it? (more compact, but entities aren't self-contained)
- Does each entity use a minimal `@context` with only the prefixes it actually needs?

This affects the JSON-LD structure and whether exported entities can be consumed individually or only as part of a bundle.

### Issue 4: Multi-value field serialization for JSON-LD direction

**Priority: Should specify before implementation.**

The plan says `email` is stored as "JSON array if multiple" in a string cell. The Risks & Mitigations table says: "Store as JSON-serialized array string when > 1 value; accessor handles parse/serialize transparently."

But the mapper needs to know the full pipeline:

- **Domain → JSON-LD (export):** Parse the JSON array string from the cell, wrap each email in `mailto:` prefix, wrap in NodeRef `{ "@id": "mailto:..." }`, output as JSON-LD array. What if the cell has a single value (no JSON array, just a plain string)? The mapper must handle both single-string and JSON-array-string formats.
- **JSON-LD → Domain (import):** Receive JSON-LD array of NodeRef objects, unwrap `@id`, strip `mailto:` prefix (or keep it?), serialize back to JSON array string (or single string if only one value).

Same applies to `phone` (`tel:` prefix) and any other multi-value field.

**Needed:** Specify the serialization contract for multi-value cells (what the accessor stores and what the mapper expects), and whether `mailto:`/`tel:` prefixes are stored in the cell or added/stripped by the mapper.

### Issue 5: Membership mapping is complex and underspecified

**Priority: Should specify before implementation.**

Membership is the most complex mapper and gets the least detail. In JSON-LD, groups contain memberships as nested objects:

```jsonc
{
  "@type": "vcard:Group",
  "vcard:hasMember": [
    { "@id": "contact_abc123..." },
    { "@id": "contact_def456..." }
  ],
  "org:hasMembership": [
    {
      "@type": "org:Membership",
      "org:member": { "@id": "contact_abc123..." },
      "org:role": { "@id": "http://example.org/role/lead" },
      "org:memberDuring": {
        "@type": "time:Interval",
        "time:hasBeginning": "2026-01-01T00:00:00Z",
        "time:hasEnd": ""
      }
    }
  ]
}
```

The group mapper needs to:
- **Export:** Query the `memberships` table for the group's members, build the `vcard:hasMember` array (simple member refs) and `org:hasMembership` array (rich membership objects with role + time), and nest them in the group JSON-LD.
- **Import:** Extract the nested membership objects, flatten them into `memberships` table rows with `groupId` + `contactId` + role + dates.

**Needed:** Pseudocode or a concrete example for the group mapper showing how memberships are expanded/flattened. Also clarify: does `groupToJsonLd` take the store as a parameter (to query memberships), or does it take a pre-fetched list of memberships?

### Issue 6: Import/export command design undecided

**Priority: Should decide before implementation.**

Step 3c says: "Extend existing `export` command or add `solid-export`." This is still two options without a decision. Questions:

- **Extend or new command?** If extending `export`, how does the user choose between BFT export (current) and JSON-LD export? A `--format=jsonld` flag? A different subcommand (`export solid`)?
- **Scope:** Does `solid-export` export the entire store (all personas, contacts, groups, memberships) or allow entity-type filtering (`solid-export --personas`, `solid-export --contacts`)?
- **File handling:** Does export write to stdout or to a file? Does import read from a file path argument? What about the web/browser context where filesystem access differs?
- **Are these `SocialCommandHandler`s?** They need the store (to read/write entities). They also need filesystem access (to read/write files). The existing `export`/`import` commands in `io.ts` handle filesystem via the injected helpers. How do the new commands get both store and filesystem access?

### Issue 7: tb-solid-pod dependency strategy undecided

**Priority: Should decide before implementation.**

The plan says: "Install tb-solid-pod schemas as dev dependency for roundtrip validation (or copy the specific Zod schemas into a test helper)."

This is still two options. The choice affects:
- Whether tests import from a package or from a local copy
- Whether tb-solid-pod version changes can break tests (dep) or go unnoticed (copy)
- Whether the copied schemas drift from upstream

**Recommendation:** Pick one. If tb-solid-pod is published as a package, use it as a dev dep. If it's a local/private repo, copy the specific schemas into a test helper and note which commit they were copied from.

---

## Summary

All issues resolved! ✓

| # | Issue | Priority | Status |
|---|---|---|---|
| 1 | No concrete JSON-LD output shape | Must specify | ✓ RESOLVED — Added comprehensive Design Decision section with concrete examples |
| 2 | `@type` values not specified | Must specify | ✓ RESOLVED — Specified all `@type` values with Inrupt vocab constants |
| 3 | `@context` handling vague | Should specify | ✓ RESOLVED — Decided: inline per-entity |
| 4 | Multi-value field serialization | Should specify | ✓ RESOLVED — Documented JSON array string in cell strategy |
| 5 | Membership mapping underspecified | Should specify | ✓ RESOLVED — Added detailed export/import logic to step 3a |
| 6 | Import/export command design undecided | Should decide | ✓ RESOLVED — New top-level `solid-export`/`solid-import` commands |
| 7 | tb-solid-pod dependency undecided | Should decide | ✓ RESOLVED — Copy schemas to test helper with source commit comment |

---

## Resolutions (2026-02-16)

### Issue 1: RESOLVED

**Action taken:** Added comprehensive "Design Decision: JSON-LD Structure and Serialization" section before Phase 3a in `PLAN_4_SOLID_INTEGRATION.md`.

**What was added:**
- Concrete JSON-LD examples for all entity types (persona with single/multi values, person contact, agent contact, organization with memberships, team with parent)
- Specified NodeRef wrapping rules (wrap object references like `linkedPersona`, `webId`; plain strings for scalar IRIs like `email`, `phone`)
- Clarified optional field handling (omit from export if empty; on import, missing → empty string)
- Specified `@id` values (use branded ID as-is, e.g., `persona_abc123...`)

### Issue 2: RESOLVED

**Action taken:** Updated the `@type` values decision to explicitly reference the Inrupt vocabulary constants already available in the codebase, with emphasis on following published W3C/Solid specifications rather than any specific implementation.

**What was added:**
- **Design Authority statement:** Added explicit guidance that published Solid specs and W3C RDF vocabularies are the authoritative sources, not tb-solid-pod or any other implementation. If implementations deviate from specs, the implementations should update to match the standards.
- Concrete `@type` values with their TypeScript constant references and W3C spec sources:
  - `FOAF.Person` → `"http://xmlns.com/foaf/0.1/Person"` for personas (W3C FOAF spec)
  - `VCARD.Individual` → `"http://www.w3.org/2006/vcard/ns#Individual"` for contacts (W3C vCard spec)
  - `ORG.Organization`, `ORG.OrganizationalUnit`, `VCARD.Group` for groups (W3C org ontology and vCard specs)
  - `ORG.Membership` for memberships (W3C org ontology spec)
- Implementation note directing mappers to import these constants from `@devalbo/shared/vocab/namespaces` and use them directly rather than hardcoding IRI strings
- **Interop note:** Clarified that alignment with tb-solid-pod is validation of spec compliance, not a design constraint
- Updated Phase 1a to document that vocab constants are already complete and explain how they'll be used in Phase 3
- Added concrete code example to step 3a showing how to import and use the constants in mappers
- Updated rationale to emphasize spec compliance over implementation matching
- Updated test strategy to position tb-solid-pod schemas as interop checks, not source of truth

### Issue 3: RESOLVED

**Action taken:** Added explicit decision for `@context` placement in the "Design Decision: JSON-LD Structure and Serialization" section.

**Decision:** Option A — Inline per-entity. Each entity includes the full `POD_CONTEXT`. This makes every entity self-contained JSON-LD that can be consumed individually or as part of a bundle.

**Rationale:** Verbosity is acceptable for interop safety. Bundle format is a plain JSON object with arrays of complete JSON-LD entities.

### Issue 4: RESOLVED

**Action taken:** Added explicit decision for multi-value field serialization in both directions (domain ↔ JSON-LD).

**Decision:** Option A — JSON array string in cell.
- **Storage:** `"[\"mailto:a@b.com\",\"mailto:c@d.com\"]"` when multiple values; plain string when single value
- **Export:** Mapper checks if cell starts with `[`, parses as JSON array if yes, treats as single value if no
- **Import:** Normalize JSON-LD field to array with `toArray()`, unwrap NodeRef if present, serialize to JSON array string if length > 1, else store as single string
- Accessor layer provides transparent parse/serialize so handlers see `string[]`

### Issue 5: RESOLVED

**Action taken:** Added detailed membership expansion/flattening logic to step 3a with concrete responsibilities for export and import.

**What was added:**
- **Export (`groupToJsonLd`):** Takes store as parameter, queries memberships table, builds `vcard:hasMember` array (simple NodeRefs) and `org:hasMembership` array (full membership objects with role + time interval)
- **Import (`jsonLdToGroupRow`):** Extracts group's own cells, returns `{ id, row }`. Separate helper `extractMembershipsFromGroupJsonLd(jsonLd) -> MembershipRowInput[]` walks `org:hasMembership`, unwraps fields, returns domain membership rows. Import command calls both helpers.
- Added concrete JSON-LD example for organization with memberships showing the nested structure

### Issue 6: RESOLVED

**Action taken:** Added explicit command design decision to step 3c.

**Decision:** Add new top-level commands `solid-export` and `solid-import` (not subcommands of existing `export`/`import`).

**Details:**
- `solid-export [path]` — exports all social entities to JSON-LD bundle at path (defaults to `social-data.json` in cwd)
- `solid-import <file>` — imports JSON-LD bundle from file, upserts entities to store
- Both are `SocialCommandHandler`s (require store) and use injected filesystem helpers for I/O
- Register in `program.ts`, add handlers to `io.ts` or new `social-io.ts`

### Issue 7: RESOLVED

**Action taken:** Added explicit tb-solid-pod dependency strategy decision to step 3b.

**Decision:** Option B — Copy specific Zod schemas into test helper file.
- Copy `PersonaSchema`, `ContactSchema`, `GroupSchema`, `MembershipSchema` from tb-solid-pod into `packages/state/tests/helpers/tb-solid-pod-schemas.ts`
- Include comment with source commit hash and date
- No dev dependency; test file makes schema changes explicit

**Rationale:** Avoids dev dependency, tests don't silently break when upstream changes. If schemas diverge, roundtrip tests catch it and copied schemas can be updated in a maintenance commit.

---

---

### Issue 8: RESOLVED

**Action taken:** Added "Design Decision: Property Key Format (Prefixed vs Full IRI)" section to `PLAN_4_SOLID_INTEGRATION.md`. Updated the 3a code examples and implementation notes to match.

**Problem:** The Inrupt vocabulary constants (`FOAF.name`, `VCARD.hasEmail`) expand to full IRIs (`"http://xmlns.com/foaf/0.1/name"`), but the JSON-LD examples in the plan use compact prefixed keys (`"foaf:name"`). The mapper code example in 3a used `[FOAF.name]` computed property keys, which would produce full IRI keys in the output — inconsistent with the examples.

**Decision:** Use prefixed string keys (`"foaf:name"`, `"vcard:hasEmail"`, `"foaf:Person"`) for export. The `@context` (via `POD_CONTEXT`) resolves prefixed keys to full IRIs. Use Inrupt constants only for import-side matching (accepting JSON-LD that may contain full IRIs from a JSON-LD processor).

**What was updated:**
- Added design decision section with options, rationale, and consequences
- Rewrote 3a export code example to use prefixed string keys with a `field()` helper for optional field omission
- Added 3a import code example showing dual-key matching (prefixed first, full IRI fallback)
- Updated `@type` implementation note to reference prefixed form
- Updated group mapper description to use prefixed key references

---

## Phase 3: Ready for Implementation ✓

All 8 open issues have been resolved in `PLAN_4_SOLID_INTEGRATION.md`. Phase 3 now has:
- **Clear design authority:** Published Solid specs and W3C RDF vocabularies are the source of truth, not any specific implementation
- Concrete JSON-LD examples for all entity types
- Explicit `@type` values as prefixed strings (`"foaf:Person"`, `"vcard:Individual"`, etc.)
- Clear `@context` strategy (inline per-entity via `POD_CONTEXT`)
- **Explicit property key format:** prefixed strings for export, dual-key matching for import
- Specified multi-value serialization (JSON array string in cell)
- Detailed membership expansion/flattening logic
- Concrete import/export command design (`solid-export`/`solid-import`)
- tb-solid-pod dependency strategy (copy schemas to test helper) with explicit positioning as interop check, not design authority

Phase 2.5 is already complete (implemented alongside Phase 2).

The plan is spec-first and ready for implementation. tb-solid-pod schemas serve as an interoperability validation target; where they diverge from published specs, the specs take precedence.
