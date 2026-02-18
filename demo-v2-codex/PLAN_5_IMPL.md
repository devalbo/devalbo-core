# Plan 5: Next Steps — A+B Implementation and D Proposals

This document contains:
1. **The full phased implementation plan for Proposal A + B** (rich shell output + reactive people panel).
2. **Three alternative proposals for Proposal D** (full CRM tab), each prioritizing a different cluster of the target use cases.

---

## Architecture Principles (From Decisions)

These apply to all phases of Plan 5:

**1. Components are store-agnostic.**
Social UI components live in `packages/ui/src/social/` and accept typed domain data (`PersonaRow[]`, `ContactRow`, etc.) as props. No store access inside components. This makes them embeddable anywhere — in shell command output, a panel, a modal, or a future app — with zero store coupling at the component layer. Row types come from `@devalbo/shared`; `packages/ui` already depends on it.

**2. Hooks are where reactivity lives.**
`packages/state/src/hooks/` gains typed social hooks — `usePersonas()`, `useContacts()`, `useGroups()`, `useMemberships()`, `usePersona(id)`, `useContact(id)`, `useGroup(id)`. These wrap the existing `useTable()` hook and parse rows through the social Zod schemas. Reactivity flows from TinyBase through hooks into components.

**3. Mutations are command-routed, always.**
Whether the trigger is a shell command or a UI action, mutations call the same command handler functions from `naveditor-lib/src/commands/`. No parallel mutation logic in the UI layer. This guarantees that a terminal `persona add` and a UI form submit go through identical validation and store-write paths. Both cause the same TinyBase event, which propagates to all subscribed views automatically.

**4. Active persona is a first-class concept.**
A "currently acting as" persona is tracked in app state (not in the store — it's a session concern). All activity-launching and sharing actions are framed in the context of the active persona. The persona switcher is available wherever persona context matters.

**5. Identity-gated actions must fail explicitly, never silently.**
Per `DEPLOYMENT_AND_OPERATION.md`: "Commands that require a user that are invoked without one should fail with information to that effect." Any UI action that produces data with an actor (share, invite, log activity) requires a resolved active persona. If none is set, the action is blocked — buttons are disabled and the user sees "Select a persona first." This applies consistently across all D-proposal implementations; it is not optional per-component behavior.

**6. Platform-specific APIs must be abstracted.**
Per `DESIGN_AND_DEVELOPMENT.md`: prefer decisions that support WASM and multi-environment targeting. Do not call browser-only APIs (e.g., `navigator.clipboard`, `window.prompt`) directly in components. Instead, inject platform helpers via props or use the existing `detectPlatform()` / `RuntimePlatform` pattern. This keeps components testable without a DOM and ensures terminal/CLI contexts degrade gracefully.

---

## A + B: Full Implementation Plan

### Overview

| Phase | Scope | Package(s) |
|---|---|---|
| 1 | Typed social hooks | `packages/state` |
| 2 | Social UI components (presentational) | `packages/ui` |
| 3A | Rich command output (Plan A) | `naveditor-lib` |
| 3B | People panel tab (Plan B) | `naveditor-lib`, app shells |

Each phase is independently testable. Phases 3A and 3B can be worked in parallel once Phase 2 is complete.

---

### Phase 0: Dependency Hygiene Check

**Required before any implementation begins.** Per `PLAN_MAINTENANCE.md`, all plan phases must be preceded by a dependency hygiene check.

```bash
pnpm outdated -r          # no actionable drift
pnpm install              # succeeds, no unmet peer warnings
pnpm -r run build         # all packages build cleanly
pnpm -r run test          # all existing tests pass
```

Checklist:
- [ ] `pnpm outdated -r` shows no actionable drift
- [ ] All shared deps are in the catalog (`pnpm-workspace.yaml`)
- [ ] All internal cross-package references use `workspace:*`
- [ ] Peer dependency ranges satisfied
- [ ] Full build and test pass

If any check fails, fix it in a dedicated maintenance commit before layering any Plan 5 work. Do not mix dependency maintenance with feature commits.

**Note for D2:** adding `ActivityRowSchema` to `packages/shared` extends the zod cohort (`branded-types`, `shared`, `state`). Run the hygiene check again before starting D2 work and confirm no version drift has accumulated since the A+B phase.

---

### Phase 1: Typed Social Hooks (`packages/state`)

The existing `useTable(tableId)` hook returns an untyped TinyBase `Table`. Phase 1 adds a `useRow` primitive and typed social hooks for each entity.

#### Phase 1a: `use-row.ts` prerequisite

The existing `use-table.ts` uses `addTableListener`. Single-entity hooks need the analogous `addRowListener` pattern. Add this before the social hooks.

`packages/state/src/hooks/use-row.ts`
```ts
import { useSyncExternalStore } from 'react';
import type { Row } from 'tinybase';
import { useStore } from './use-store';

export const useRow = (tableId: string, rowId: string): Row => {
  const store = useStore();
  return useSyncExternalStore(
    (onStoreChange) => {
      const listenerId = store.addRowListener(tableId, rowId, () => onStoreChange());
      return () => store.delListener(listenerId);
    },
    () => store.getRow(tableId, rowId)
  );
};
```

#### Phase 1b: List hooks

**Implementation strategy:** list hooks call the existing accessor functions (`listPersonas`, `listContacts`, etc.) inside `useSyncExternalStore` with `addTableListener`. Do NOT re-implement row parsing inline — the accessor functions already handle `safeParseWithWarning`. This keeps parsing logic in one place.

`packages/state/src/hooks/use-personas.ts`
```ts
import { useSyncExternalStore } from 'react';
import { listPersonas } from '../accessors/personas';
import { PERSONAS_TABLE } from '../schemas/social';
import { useStore } from './use-store';
import type { PersonaRow } from '@devalbo/shared';

export const usePersonas = (): Array<{ id: PersonaId; row: PersonaRow }> => {
  const store = useStore();
  return useSyncExternalStore(
    (onChange) => {
      const id = store.addTableListener(PERSONAS_TABLE, () => onChange());
      return () => store.delListener(id);
    },
    () => listPersonas(store)
  );
};
```

`use-contacts.ts`, `use-groups.ts`, `use-memberships.ts` follow the identical pattern, calling `listContacts`, `listGroups`, `listMembers` respectively.

**`useMemberships` filter:** the filter is applied client-side after calling `listMembers(store, groupId)` for group-scoped queries, or by scanning all memberships for contact-scoped queries. If no filter is passed, calls `listMembers(store)` for all memberships (check if `listMembers` supports that — if not, query all groups and flatten). Specify the fallback: `listMemberships(store)` exists in the accessors barrel; use it if present, else call per-group and flatten.

#### Phase 1c: Single-entity hooks

Single-entity hooks call `getPersona`, `getContact`, `getGroup` inside `useSyncExternalStore` with `addRowListener`.

`packages/state/src/hooks/use-social-entity.ts`
```ts
import { useSyncExternalStore } from 'react';
import { getPersona, getContact, getGroup } from '../accessors';
import { PERSONAS_TABLE, CONTACTS_TABLE, GROUPS_TABLE } from '../schemas/social';
import { useRow } from './use-row'; // triggers re-render on row change
import { useStore } from './use-store';
import type { PersonaId, ContactId, GroupId, PersonaRow, ContactRow, GroupRow } from '@devalbo/shared';

export const usePersona = (id: PersonaId): PersonaRow | null => {
  const store = useStore();
  useRow(PERSONAS_TABLE, id); // subscribe to row changes
  return getPersona(store, id);
};

export const useContact = (id: ContactId): ContactRow | null => { /* same pattern */ };
export const useGroup = (id: GroupId): GroupRow | null => { /* same pattern */ };
```

Note: `useRow` is called for its subscription side-effect; its return value is unused. `getPersona` handles the Zod parsing. This avoids duplicating the parse logic.

#### Phase 1 updated files

- `packages/state/src/hooks/use-row.ts` — new
- `packages/state/src/hooks/use-personas.ts` — new
- `packages/state/src/hooks/use-contacts.ts` — new
- `packages/state/src/hooks/use-groups.ts` — new
- `packages/state/src/hooks/use-memberships.ts` — new
- `packages/state/src/hooks/use-social-entity.ts` — new
- `packages/state/src/hooks/index.ts` — add all new exports
- `packages/state/src/index.ts` — already exports `./hooks/*`; verify `use-row` is included

#### Phase 1 tests

`packages/state/tests/social-hooks.test.ts`:

Per `TESTING.md`, use **parameterized tests** for the list hooks and single-entity hooks — the behavior is identical across entity types and should not be copy-pasted. Structure:

```ts
// Parameterized list hook tests
const listHookCases = [
  { hookFn: usePersonas, tableName: PERSONAS_TABLE, seed: seedPersona, mutate: setPersona },
  { hookFn: useContacts, tableName: CONTACTS_TABLE, seed: seedContact, mutate: setContact },
  { hookFn: useGroups,   tableName: GROUPS_TABLE,   seed: seedGroup,   mutate: setGroup   },
];

for (const { hookFn, seed, mutate } of listHookCases) {
  describe(hookFn.name, () => {
    it('returns empty array when table is empty', ...)
    it('returns typed rows after seeding', ...)
    it('triggers re-render on row addition', ...)
    it('triggers re-render on row mutation', ...)
  });
}
```

```ts
// Parameterized single-entity hook tests
const entityHookCases = [
  { hookFn: usePersona, seed: seedPersona, mutate: setPersona },
  { hookFn: useContact, seed: seedContact, mutate: setContact },
  { hookFn: useGroup,   seed: seedGroup,   mutate: setGroup   },
];

for (const { hookFn, seed, mutate } of entityHookCases) {
  describe(hookFn.name, () => {
    it('returns null for unknown id', ...)
    it('returns the row after seeding', ...)
    it('updates when the row is mutated', ...)
  });
}
```

Follow the Arrange/Act/Assert pattern in each test body. Each test should be independently readable without relying on shared mutable state between tests.

---

### Phase 2: Social UI Components (`packages/ui`)

Pure presentational components. No store access. Dark theme consistent with the existing FileExplorer (`#0b1220`, `#334155`, `#e2e8f0`). All props are typed domain rows from `@devalbo/shared`.

**No new `packages/ui` dependencies** — component props use types from `@devalbo/shared`, which is already a dep.

**New directory:** `packages/ui/src/social/`

**Components:**

---

`persona-card.tsx` — single persona summary. Embeddable inline anywhere.

```
Props: { persona: PersonaRow; id: PersonaId; isDefault?: boolean; onClick?: () => void; selected?: boolean }
```

Visual:
```
┌──────────────────────────────────────┐
│ ● Alice Liddell          (default)   │  ← dot: avatar initial or image
│   @alice · alice@example.com         │
└──────────────────────────────────────┘
```
- Selected state: `background: #0f172a; border: 1px solid #38bdf8`
- Default state: `background: transparent; border: 1px solid #334155`
- Empty `name`: render `(unnamed)` in dim color
- Empty `nickname` and `email`: omit those lines

---

`persona-list.tsx` — scrollable list of persona cards.

```
Props: { personas: Array<{id: PersonaId; row: PersonaRow}>; defaultPersonaId?: PersonaId; selectedId?: PersonaId; onSelect?: (id: PersonaId) => void }
```

Empty state: render `<div style={{color: '#94a3b8'}}>No personas yet. Try: persona create "Alice"</div>`

---

`contact-card.tsx` — single contact with kind badge and optional group membership context.

```
Props: { contact: ContactRow; id: ContactId; memberships?: Array<{id: MembershipId; row: MembershipRow}>; onClick?: () => void; selected?: boolean }
```

Visual:
```
┌──────────────────────────────────────────┐
│ Alice Liddell             [person]        │  ← kind badge: 'person' | 'agent'
│   alice@example.com · +1-555-1234        │
│   Groups: Avengers (lead), Staff         │  ← only if memberships provided
└──────────────────────────────────────────┘
```
- Kind badge colors: `person` → `#0e7490` (teal), `agent` → `#7e22ce` (purple)
- Empty `email` and `phone`: omit those lines
- `memberships` is optional — omit the Groups line entirely if not provided or empty
- Group names in the Groups line come from `memberships[n].row` — the `MembershipRow` has `groupId` but not `groupName`. **The caller is responsible for providing pre-resolved membership rows or for omitting the memberships prop entirely.** `ContactCard` does not fetch groups. If group names are needed, the parent resolves them before passing.

---

`contact-list.tsx` — list of contact cards with optional client-side search.

```
Props: { contacts: Array<{id: ContactId; row: ContactRow}>; selectedId?: ContactId; onSelect?: (id: ContactId) => void; searchable?: boolean }
```

- When `searchable` is true, renders a text input above the list. Filter is applied client-side on `row.name` and `row.email` (case-insensitive substring match).
- Empty state (no contacts): `No contacts yet. Try: contact add "Bob"`
- Empty state (search returns nothing): `No contacts match "{query}"`

---

`group-card.tsx` — single group with type badge and member count.

```
Props: { group: GroupRow; id: GroupId; memberCount?: number; onClick?: () => void; selected?: boolean }
```

Visual:
```
┌──────────────────────────────────────┐
│ Avengers              [organization] │  ← groupType badge
│   3 members · avengers.example.com  │  ← memberCount + url if present
└──────────────────────────────────────┘
```
- Type badge colors: `organization` → `#166534` (green), `team` → `#1d4ed8` (blue), `group` → `#334155` (gray)
- `memberCount` is optional — omit member count if not provided
- Empty `url`: omit url line

---

`group-list.tsx` — list of group cards.

```
Props: { groups: Array<{id: GroupId; row: GroupRow; memberCount?: number}>; selectedId?: GroupId; onSelect?: (id: GroupId) => void }
```

Empty state: `No groups yet. Try: group create "Avengers" --type organization`

---

`membership-list.tsx` — members of a group, showing name (resolved from contacts), role, dates.

```
Props: { memberships: Array<{id: MembershipId; row: MembershipRow}>; contactsById: Map<ContactId, ContactRow> }
```

`contactsById` is a `Map` keyed by `ContactId` for O(1) name lookup. The caller builds this map (typically from the result of `useContacts()` or `listContacts()`). `MembershipList` does not fetch contacts.

Visual:
```
  Alice Liddell     lead     since 2026-01-01
  Bob the Builder   member   —
  (unknown)         member   —               ← contact not found in map
```
- Empty state: `No members yet. Try: group add-member <groupId> <contactId>`
- Dates: show `startDate` as `since YYYY-MM-DD` if non-empty; omit if empty. Omit `endDate` unless non-empty.

---

`social-entity-badge.tsx` — compact inline chip for embedding in other UI.

```
Props: { kind: 'persona' | 'contact' | 'group'; name: string }
```

Visual: `[ person  Alice Liddell ]` — small pill, 11px font, border `#334155`, bg `#1e293b`. Kind prefix in dim color.

---

`index.ts` — barrel export of all components above.

---

### Phase 3A: Rich Command Output (Plan A)

Social commands currently use `makeResult(text, data)` which renders plain `<Text>`. Phase 3A replaces the `component` field with rich components from the Phase 2 library, while leaving `result.data` unchanged (it is already correctly populated — see shapes below).

Command result components are **not reactive** — they render a snapshot from `result.data` at the time the command ran. Shell history is a log.

#### `result.data` shapes (from existing command code — do not change these)

| Command | `result.data` shape |
|---|---|
| `persona list` | `{ personas: Array<{id: PersonaId, row: PersonaRow}>, defaultPersona: {id, row} \| null }` |
| `persona show` | `{ id: PersonaId, row: PersonaRow }` |
| `persona create` | `{ id: PersonaId, row: PersonaRowInput }` |
| `persona edit` | `{ id: PersonaId, row: PersonaRowInput }` |
| `persona delete` | `{ id: PersonaId }` |
| `persona set-default` | `{ id: PersonaId }` |
| `contact list` | `{ contacts: Array<{id: ContactId, row: ContactRow}> }` |
| `contact show` | `{ id: ContactId, row: ContactRow }` |
| `contact add` | `{ id: ContactId, row: ContactRowInput }` |
| `contact edit` | `{ id: ContactId, row: ContactRowInput }` |
| `contact search` | `{ contacts: Array<{id, row}>, query: string }` |
| `contact delete` | `{ id: ContactId }` |
| `contact link` | `{ contactId, personaId }` |
| `group list` | `{ groups: Array<{id: GroupId, row: GroupRow}> }` |
| `group show` | `{ id: GroupId, row: GroupRow }` |
| `group create` | `{ id: GroupId, row: GroupRowInput }` |
| `group edit` | `{ id: GroupId, row: GroupRowInput }` |
| `group delete` | `{ id: GroupId }` |
| `group list-members` | `{ members: Array<{id: MembershipId, row: MembershipRow}>, groupId: GroupId }` |
| `group add-member` | `{ id: MembershipId, groupId, contactId, role?, start?, end? }` |
| `group remove-member` | `{ groupId, contactId }` |

#### Which subcommands get rich output components

Only commands that return displayable entity data get a new `component`. Commands that confirm a deletion or link operation keep plain text output — there is nothing visually richer to show.

| Command | Gets rich component? | Component | Props sourced from |
|---|---|---|---|
| `persona list` | ✓ | `PersonaListOutput` | `data.personas`, `data.defaultPersona` |
| `persona show` | ✓ | `PersonaDetailOutput` | `data.id`, `data.row` |
| `persona create` | ✓ | `PersonaDetailOutput` | `data.id`, `data.row` |
| `persona edit` | ✓ | `PersonaDetailOutput` | `data.id`, `data.row` |
| `persona delete` | — | plain text | — |
| `persona set-default` | — | plain text | — |
| `contact list` | ✓ | `ContactListOutput` | `data.contacts` |
| `contact search` | ✓ | `ContactListOutput` | `data.contacts` (include query as heading) |
| `contact show` | ✓ | `ContactDetailOutput` | `data.id`, `data.row` |
| `contact add` | ✓ | `ContactDetailOutput` | `data.id`, `data.row` |
| `contact edit` | ✓ | `ContactDetailOutput` | `data.id`, `data.row` |
| `contact delete` | — | plain text | — |
| `contact link` | — | plain text | — |
| `group list` | ✓ | `GroupListOutput` | `data.groups` |
| `group show` | ✓ | `GroupDetailOutput` | `data.id`, `data.row` |
| `group create` | ✓ | `GroupDetailOutput` | `data.id`, `data.row` |
| `group edit` | ✓ | `GroupDetailOutput` | `data.id`, `data.row` |
| `group delete` | — | plain text | — |
| `group list-members` | ✓ | `MembershipListOutput` | `data.members`, `data.groupId` |
| `group add-member` | — | plain text | — |
| `group remove-member` | — | plain text | — |

#### New output components

**New directory:** `naveditor-lib/src/components/social/output/`

`PersonaListOutput.tsx`
```tsx
// Props: { personas: Array<{id, row}>, defaultPersona: {id, row} | null }
// Renders: <PersonaList> from @devalbo/ui with snapshot data
```

`PersonaDetailOutput.tsx`
```tsx
// Props: { id: PersonaId, row: PersonaRow | PersonaRowInput }
// Renders: <PersonaCard> for a single persona
```

`ContactListOutput.tsx`
```tsx
// Props: { contacts: Array<{id, row}>, query?: string }
// Renders: optional heading "Results for '{query}'" + <ContactList> (searchable=false, data is already filtered)
```

`ContactDetailOutput.tsx`
```tsx
// Props: { id: ContactId, row: ContactRow | ContactRowInput }
// Renders: <ContactCard memberships={undefined}> — no membership lookup in shell output
```

`GroupListOutput.tsx`
```tsx
// Props: { groups: Array<{id, row}> }
// Renders: <GroupList> with memberCount=undefined (not fetched in snapshot)
```

`GroupDetailOutput.tsx`
```tsx
// Props: { id: GroupId, row: GroupRow | GroupRowInput }
// Renders: <GroupCard memberCount={undefined}>
```

`MembershipListOutput.tsx`
```tsx
// Props: { members: Array<{id, row: MembershipRow}>, groupId: GroupId }
// Renders: <MembershipList memberships={members} contactsById={new Map()} />
// contactsById is empty in shell output — names fall back to "(unknown)" or contactId
// This is acceptable for shell history; the panel has full contact context
```

#### How to update command handlers

Replace the `makeResult(text, data)` call with a helper that also sets `component`. Example for `persona list`:

```tsx
// Before:
return makeResult(text, { personas: rows, defaultPersona });

// After (import PersonaListOutput at top of file):
return {
  ...makeResult(text, { personas: rows, defaultPersona }),
  component: <PersonaListOutput personas={rows} defaultPersona={defaultPersona} />
};
```

The `text` string in `makeResult` is kept — it populates `result.status` and is used in tests. Only the `component` field changes.

#### Phase 3A tests

`naveditor-lib/tests/unit/commands/persona-output.test.ts` (or add to existing `persona.test.ts`):
- `persona list` with 0 personas → component renders empty state text
- `persona list` with 2 personas → component renders 2 persona cards
- `persona show <id>` → component renders a single persona card with correct name
- `persona create` → component renders the new persona card

Same coverage for contact and group output components.

---

### Phase 3B: People Panel Tab (Plan B)

A reactive, read-only `People` tab. Uses Phase 1 hooks for live store subscriptions and Phase 2 components for rendering. Any change made via terminal commands is immediately reflected here.

**New file:** `naveditor-lib/src/components/social/SocialPanel.tsx`

```
SocialPanel
├── EntityTypeNav          (Personas | Contacts | Groups)
├── EntityList             (switches on EntityTypeNav selection)
│   ├── PersonaList        (via usePersonas())
│   ├── ContactList        (via useContacts() + searchable)
│   └── GroupList          (via useGroups())
└── EntityDetail           (shown on list item click)
    ├── PersonaCard        (via usePersona(id))
    ├── ContactCard        (via useContact(id) + useMemberships({ contactId }))
    └── GroupCard + MembershipList (via useGroup(id) + useMemberships({ groupId }))
```

Two-column CSS grid: 280px left | 1fr right. Consistent with `FileExplorer` layout.

**StoreContext scope — important:** `InteractiveShell` currently creates its store internally via `useMemo(() => store ?? createDevalboStore(), [store])`. The People panel needs the same store instance. The store must be lifted to `App` level so both tabs share one instance.

The files to change are **`naveditor-web/src/App.tsx`** and **`naveditor-desktop/src/App.tsx`** — the app shell files, not `naveditor-lib/src/web/App.tsx`. The `@/` alias in the app shells maps to `naveditor-lib/src/`, so they import `InteractiveShell` from the lib but own the App-level layout themselves.

**`StoreContext` import source:** `import { StoreContext, createDevalboStore } from '@devalbo/state'`

`InteractiveShell` keeps its `store?: DevalboStore` prop as optional with fallback — do not make it required. Pass the store explicitly from `App.tsx` to ensure both tabs share the same instance. The fallback remains for standalone use (e.g., the lib's own dev server).

Concrete `naveditor-web/src/App.tsx` change:
```tsx
import { useMemo } from 'react';
import { createDevalboStore } from '@devalbo/state';
import { StoreContext } from '@devalbo/state';
import { SocialPanel } from '@/components/social/SocialPanel';

export const App: React.FC = () => {
  const [tab, setTab] = useState<'terminal' | 'explorer' | 'people'>('terminal');
  const store = useMemo(() => createDevalboStore(), []);

  // ... tab buttons: add "People" button alongside Terminal and File Explorer

  return (
    <StoreContext.Provider value={store}>
      <div style={{ maxWidth: '1000px', margin: '24px auto', padding: '0 16px' }}>
        {/* ... tab bar ... */}
        {tab === 'terminal' && (
          <InkTerminalBox rows={28} focus>
            <InteractiveShell store={store} />
          </InkTerminalBox>
        )}
        {tab === 'explorer' && <FileExplorer />}
        {tab === 'people' && <SocialPanel />}
      </div>
    </StoreContext.Provider>
  );
};
```

`naveditor-desktop/src/App.tsx` — identical change, same pattern.

**`SocialPanel` internal structure:**

```tsx
// naveditor-lib/src/components/social/SocialPanel.tsx
// Uses usePersonas(), useContacts(), useGroups(), usePersona(id), etc. from @devalbo/state
// Renders social components from @devalbo/ui/social

type EntityType = 'personas' | 'contacts' | 'groups';

export const SocialPanel: React.FC = () => {
  const [entityType, setEntityType] = useState<EntityType>('personas');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // ...
};
```

**Empty/default states in `SocialPanel`:**
- On first render: entity type = `'personas'`, nothing selected. Detail panel shows: `Select a persona, contact, or group to view details.` in dim color.
- Selecting an entity type clears `selectedId`.
- When `selectedId` is set but the entity no longer exists (deleted from terminal): detail panel shows `Entity not found.` This can happen if the user runs `persona delete` in the terminal while the People panel is open.

**Updated files:**
- `naveditor-lib/src/components/social/SocialPanel.tsx` — new
- `naveditor-web/src/App.tsx` — lift StoreContext, add People tab
- `naveditor-desktop/src/App.tsx` — same

#### Phase 3B tests

`naveditor-lib/tests/unit/components/SocialPanel.test.tsx`:
- Renders with empty store → shows empty states for each entity type
- `persona create` via store mutation → persona appears in list without re-mounting
- Clicking a persona → detail panel renders that persona's card
- `persona delete` via store → detail panel shows "Entity not found" for the deleted id
- Tab switch (Personas → Contacts) → selectedId is cleared, contact list renders

---

### Concrete File Change List (A + B)

| File | Change |
|---|---|
| `packages/state/src/hooks/use-row.ts` | new (prerequisite) |
| `packages/state/src/hooks/use-personas.ts` | new |
| `packages/state/src/hooks/use-contacts.ts` | new |
| `packages/state/src/hooks/use-groups.ts` | new |
| `packages/state/src/hooks/use-memberships.ts` | new |
| `packages/state/src/hooks/use-social-entity.ts` | new |
| `packages/state/src/hooks/index.ts` | add all new hook exports |
| `packages/state/src/index.ts` | verify hooks barrel includes use-row |
| `packages/state/tests/social-hooks.test.ts` | new |
| `packages/ui/src/social/persona-card.tsx` | new |
| `packages/ui/src/social/persona-list.tsx` | new |
| `packages/ui/src/social/contact-card.tsx` | new |
| `packages/ui/src/social/contact-list.tsx` | new |
| `packages/ui/src/social/group-card.tsx` | new |
| `packages/ui/src/social/group-list.tsx` | new |
| `packages/ui/src/social/membership-list.tsx` | new |
| `packages/ui/src/social/social-entity-badge.tsx` | new |
| `packages/ui/src/social/index.ts` | new |
| `packages/ui/src/index.ts` | add social exports |
| `naveditor-lib/src/components/social/output/PersonaListOutput.tsx` | new |
| `naveditor-lib/src/components/social/output/PersonaDetailOutput.tsx` | new |
| `naveditor-lib/src/components/social/output/ContactListOutput.tsx` | new |
| `naveditor-lib/src/components/social/output/ContactDetailOutput.tsx` | new |
| `naveditor-lib/src/components/social/output/GroupListOutput.tsx` | new |
| `naveditor-lib/src/components/social/output/GroupDetailOutput.tsx` | new |
| `naveditor-lib/src/components/social/output/MembershipListOutput.tsx` | new |
| `naveditor-lib/src/commands/persona.ts` | update list/show/create/edit to return rich output |
| `naveditor-lib/src/commands/contact.ts` | update list/search/show/add/edit to return rich output |
| `naveditor-lib/src/commands/group.ts` | update list/show/create/edit/list-members to return rich output |
| `naveditor-lib/tests/unit/commands/persona-output.test.ts` | new |
| `naveditor-lib/tests/unit/commands/contact-output.test.ts` | new |
| `naveditor-lib/tests/unit/commands/group-output.test.ts` | new |
| `naveditor-lib/src/components/social/SocialPanel.tsx` | new |
| `naveditor-lib/tests/unit/components/SocialPanel.test.tsx` | new |
| `naveditor-web/src/App.tsx` | lift StoreContext, add People tab |
| `naveditor-desktop/src/App.tsx` | lift StoreContext, add People tab |

---

## D: CRM Tab Proposals

Three proposals, each prioritizing a different cluster of the target use cases. They share the Phase 2 component library and hooks, but differ in primary mental model and layout.

---

### D1: Social Card Exchange — Identity and Data Sharing First

**Mental model:** contacts are cards. The primary actions are "share my card" and "add their card."

**Use cases served:**
- Share information with others via text strings ✓ (core)
- Import data FROM others via text strings ✓ (core)
- Share a file link ◐ (secondary action)

**Layout:**

```
┌─ People ────────────────────────────────────────────────────────────┐
│  [My Cards ▾ Alice]  [Contacts]  [Groups]                           │
├──────────────────────┬──────────────────────────────────────────────┤
│  Alice Liddell       │  ┌─ Share My Card ──────────────────────┐   │
│  Bob the Builder     │  │  { "@type": "foaf:Person",            │   │
│  Carol Danvers       │  │    "foaf:name": "Alice Liddell",      │   │
│                      │  │    "foaf:mbox": "mailto:alice@..." }  │   │
│  [+ Import Card]     │  │                        [Copy] [QR]    │   │
│                      │  └─────────────────────────────────────┘   │
│                      │                                              │
│                      │  ┌─ Import Card ───────────────────────┐   │
│                      │  │  Paste JSON-LD or WebID URL          │   │
│                      │  │  [                               ]   │   │
│                      │  │                        [Parse + Add] │   │
│                      │  └─────────────────────────────────────┘   │
└──────────────────────┴──────────────────────────────────────────────┘
```

**Key interactions:**
- **Share my card:** renders the active persona as JSON-LD via the existing `personaToJsonLd()` mapper with a Copy button. Optionally a QR code (WebID URL).
- **Import card:** text area accepts a JSON-LD snippet or WebID URL. "Parse + Add" runs the `solid-import` command handler on the pasted text, adds the result to contacts.
- **Contact detail:** click a contact to see their card. "Forward their info" generates a JSON-LD snippet of that contact for forwarding to a third party.
- **Active persona switcher ("My Cards"):** shows all personas; selecting one changes which card is "mine" for sharing.

**What's already usable now:**
`personaToJsonLd()` mapper is implemented and tested. `solid-import` command is implemented. The "share as text / import from text" loop is fully achievable with existing infrastructure.

**Solid alignment:**
- Sharing a WebID URL is the Solid-native identity mechanism. Our `persona.webId` field is the WebID. ✓
- `personaToJsonLd()` already produces `foaf:Person` JSON-LD per W3C FOAF spec. ✓
- Our contact model is `vcard:Individual` per W3C vCard — compatible with Solid Address Book spec. ✓
- **Call-out — remote WebID fetch:** importing via a WebID URL requires an HTTP GET to the profile document. We have no HTTP fetch layer yet. Near-term workaround: user pastes the JSON-LD text manually. Future: `solid-fetch-profile <webid-url>` command.
- **Call-out — QR code:** WebID URL as QR code is a Solid-community convention, not a formal spec requirement. Treat as enhancement.

#### D1 Implementation Phases

**Prerequisites:** A+B must be complete (hooks and social UI components must exist).

**Phase D1-1: Active Persona Session State**

A React context that tracks which persona is currently "acting." This is session state (not in the store).

New file: `naveditor-lib/src/components/social/ActivePersonaContext.tsx`
```tsx
// Context + provider for active persona selection
export interface ActivePersonaContextValue {
  activePersonaId: PersonaId | null;
  setActivePersonaId: (id: PersonaId | null) => void;
}
export const ActivePersonaContext = createContext<ActivePersonaContextValue>(...);
export const useActivePersona = (): ActivePersonaContextValue => ...;
export const ActivePersonaProvider: React.FC<{ children: ReactNode }> = ...;
```

The `ActivePersonaProvider` wraps the tab content in `App.tsx`. The active persona defaults to the store's default persona (`getDefaultPersona`) on mount.

**Phase D1-2: Persona Switcher Component**

New file: `naveditor-lib/src/components/social/PersonaSwitcher.tsx`

```
Props: { label?: string }  // defaults to "My Card"
```

Visual:
```
[My Card ▾ Alice Liddell]
```
Renders a dropdown/select populated from `usePersonas()`. On change, calls `setActivePersonaId`. Uses the existing `<Select>` primitive from `@devalbo/ui`. Renders in the top bar of the CRM tab.

**Phase D1-3: Share Card Panel**

New file: `naveditor-lib/src/components/social/d1/ShareCardPanel.tsx`

```
Props: { personaId: PersonaId | null }
```

Behavior:
- If `personaId` is null: renders "Select a persona to share."
- If persona exists: calls `personaToJsonLd(row)` from `@devalbo/state` mappers, renders the JSON-LD as a `<pre>` block.
- "Copy" button: **do not call `navigator.clipboard` directly** — this is a browser-only API (violates Principle 6 / `DESIGN_AND_DEVELOPMENT.md` WASM principle). Instead, accept a `onCopy: (text: string) => void` prop. The caller (CardExchangeTab or App) provides the implementation appropriate to the runtime (`navigator.clipboard.writeText` in browser, write-to-stdout in terminal). On success: caller signals completion back via a separate `copyStatus?: 'idle' | 'copied' | 'error'` prop that drives the button label ("Copy" → "Copied!" → back to "Copy"). This keeps the component testable without a DOM.
- QR code: out of scope for initial implementation. Leave a `{/* TODO: QR code */}` placeholder.
- Also shows the WebID URL separately if `row.webId` is non-empty: "WebID: https://..."

**Phase D1-4: Import Card Panel**

New file: `naveditor-lib/src/components/social/d1/ImportCardPanel.tsx`

```
Props: { onImported?: (contactId: ContactId) => void }
```

Behavior:
- Textarea for pasting JSON-LD text.
- "Parse + Add" button: calls the `solid-import` command handler with the pasted text as a virtual file input. Specifically: parse the JSON-LD text using the existing JSON-LD-to-domain mappers (`jsonLdToContactRow`, etc.), call `setContact(store, id, row)` directly. The `solid-import` command reads from filesystem paths — parsing the pasted text means calling the mapper layer directly, not going through the command's file I/O.
- On success: brief "Added contact: [name]" status message. Calls `onImported?.(contactId)`.
- On error (parse failure, invalid JSON-LD): show red error message with the parse error detail.
- Empty textarea + submit: show "Paste some JSON-LD or a WebID URL first."

**Phase D1-5: Contact Forward Panel**

Shown in the right panel when a contact is selected (not the active persona).

New file: `naveditor-lib/src/components/social/d1/ContactForwardPanel.tsx`

```
Props: { contactId: ContactId }
```

Behavior:
- Calls `useContact(contactId)` for the row.
- Calls `contactToJsonLd(row)` mapper to generate JSON-LD.
- Renders the JSON-LD + Copy button (same pattern as ShareCardPanel).
- Heading: "Share [name]'s info"

**Phase D1-6: CardExchangeTab Top-Level Component**

New file: `naveditor-lib/src/components/social/d1/CardExchangeTab.tsx`

Layout: two-column grid (280px left | 1fr right), same as FileExplorer.

Left panel:
- `<PersonaSwitcher label="My Card" />` at top
- `<ContactList contacts={...} searchable onSelect={setSelectedId} />` below
- `[+ Import Card]` button at bottom — opens `ImportCardPanel` in right panel (replaces detail view)

Right panel (switches on state):
- Default / persona selected: `<ShareCardPanel personaId={activePersonaId} />`
- Contact selected: `<ContactForwardPanel contactId={selectedId} />`
- Import mode: `<ImportCardPanel onImported={(id) => { setSelectedId(id); setMode('contact'); }} />`

Wrap in `<ActivePersonaProvider>`.

**D1 file change list:**

| File | Change |
|---|---|
| `naveditor-lib/src/components/social/ActivePersonaContext.tsx` | new |
| `naveditor-lib/src/components/social/PersonaSwitcher.tsx` | new |
| `naveditor-lib/src/components/social/d1/ShareCardPanel.tsx` | new |
| `naveditor-lib/src/components/social/d1/ImportCardPanel.tsx` | new |
| `naveditor-lib/src/components/social/d1/ContactForwardPanel.tsx` | new |
| `naveditor-lib/src/components/social/d1/CardExchangeTab.tsx` | new |
| `naveditor-web/src/App.tsx` | add "People" tab (already done in 3B); swap `SocialPanel` for `CardExchangeTab` or add alongside |
| `naveditor-desktop/src/App.tsx` | same |

**D1 tests:**

`naveditor-lib/tests/unit/components/d1/ShareCardPanel.test.tsx`:
- Null personaId → renders prompt text
- Valid personaId → renders JSON-LD block containing persona name
- Copy button click → `navigator.clipboard.writeText` called with JSON-LD string

`naveditor-lib/tests/unit/components/d1/ImportCardPanel.test.tsx`:
- Empty submit → error message
- Invalid JSON → error message with detail
- Valid contact JSON-LD → calls `setContact`, calls `onImported`

---

### D2: Activity Console — Persona-Aware Action Launching

**Mental model:** social data is a launch pad for things you do with people. Primary question: "what do I want to do, with whom, as which persona?"

**Use cases served:**
- Launch activities with a friend or for a group ✓ (core)
- Persona-context switching per activity ✓ (core)
- Send a file / share a file link ◐ (as activity types)
- Share info / import info ◐ (as action shortcuts)

**Layout:**

```
┌─ People ──────────────────────────────────────────────────────────────┐
│  Acting as: [Alice (host) ▾]                                          │
├──────────────────────┬────────────────────────────────────────────────┤
│  Contacts            │  Bob the Builder                               │
│  ────────────────    │  ─────────────────────────────────────────     │
│  Bob the Builder  ●  │  bob@example.com · person                      │
│  Carol Danvers       │  Groups: Avengers (lead), Staff (member)       │
│  Stark Industries    │                                                 │
│                      │  ┌─ Quick Actions ─────────────────────────┐  │
│  Groups              │  │  [Send File]  [Share Link]               │  │
│  ────────────────    │  │  [Share Card] [Invite to...]             │  │
│  Avengers         ●  │  └─────────────────────────────────────────┘  │
│  Staff               │                                                 │
│                      │  ┌─ Activity Log ──────────────────────────┐  │
│                      │  │  ↑ Shared README.md       2026-02-17     │  │
│                      │  │  ↓ Received card from Bob  2026-02-15    │  │
│                      │  └─────────────────────────────────────────┘  │
└──────────────────────┴────────────────────────────────────────────────┘
```

**Key interactions:**
- **"Acting as" bar:** always visible. Changing it changes which persona is the actor for all subsequent actions. Context: Alice might host as "alice-host" persona but play as "alice-player" persona.
- **Contact/group list:** unified, sorted by recent activity.
- **Quick Actions panel:**
  - "Send File" — opens file picker from the explorer tree; generates a share payload (local path + recipient name + acting persona, formatted as text). Future: POD write.
  - "Share Link" — same but payload is a URL/path reference.
  - "Share Card" — generates JSON-LD of the selected contact for forwarding.
  - "Invite to..." — opens a mini-form (activity type, notes); logs an `activity` record to the store.
- **Activity Log:** per-contact or per-group history of logged activities.

**New store table needed:** `activities` with cells `{ id, actorPersonaId, subjectType ('contact'|'group'), subjectId, activityType, payload, timestamp }`. This is an addendum to the social schema from Plan 4 — define in a Plan 5B schema extension.

**Solid alignment:**
- Persona switching for different activity contexts matches the Solid multi-WebID model. ✓
- Activity types should map to W3C Activity Streams 2.0: `as:Offer` (share), `as:Invite`, `as:Create`. **Call-out:** AS2 activities should be deliverable to a recipient's POD inbox (ActivityPub). We have no HTTP delivery layer. Activities are local records only — they cannot be pushed to a remote contact's inbox yet.
- **Call-out — file sending via Solid:** Solid file sharing means writing to a POD LDP container with WAC ACL granting the recipient `acl:Read`. We have no POD HTTP write layer. Near-term: generate a descriptive share text the user can send out-of-band.
- Future path: add `solid-deliver <activity-id>` command that POSTs to a recipient's inbox URL if their WebID profile advertises one.

#### D2 Implementation Phases

**Prerequisites:** A+B complete. `ActivePersonaContext` and `PersonaSwitcher` from D1 (or implement D1 first).

**Phase D2-1: Activities Table Schema**

New store table: `activities`. Add to `packages/state/src/schemas/social.ts` and `store.ts`.

```ts
// packages/state/src/schemas/social.ts
export const ACTIVITIES_TABLE = 'activities';

// packages/shared/src/types/social.ts — add ActivityRow
export const ActivityRowSchema = z.object({
  actorPersonaId: z.string(),       // PersonaId (branded as string in store)
  subjectType: z.enum(['contact', 'group']),
  subjectId: z.string(),            // ContactId or GroupId
  activityType: z.enum(['share-card', 'share-file', 'share-link', 'invite', 'note']),
  payload: z.string(),              // JSON string with activity-type-specific data
  timestamp: z.string(),            // ISO 8601
});
export type ActivityRow = z.output<typeof ActivityRowSchema>;
export type ActivityRowInput = z.input<typeof ActivityRowSchema>;
```

New accessor file: `packages/state/src/accessors/activities.ts`
```ts
export const logActivity = (store: Store, id: ActivityId, row: ActivityRowInput): void
export const listActivities = (store: Store): Array<{id: ActivityId, row: ActivityRow}>
export const listActivitiesForSubject = (store: Store, subjectType: string, subjectId: string): Array<{id, row}>
```

New hook: `packages/state/src/hooks/use-activities.ts`
```ts
export const useActivities = (filter?: { subjectType?: string; subjectId?: string }): Array<{id, row}>
```

**Phase D2-2: Quick Action Payload Formats**

Define the `payload` JSON shape for each `activityType` so components and accessors agree:

```ts
// activityType: 'share-card'
type ShareCardPayload = { personaId: string; jsonLd: string }

// activityType: 'share-file'
type ShareFilePayload = { filePath: string; description: string }

// activityType: 'share-link'
type ShareLinkPayload = { url: string; description: string }

// activityType: 'invite'
type InvitePayload = { activityDescription: string; notes: string }

// activityType: 'note'
type NotePayload = { text: string }
```

**Phase D2-3: Activity Log Component**

New file: `naveditor-lib/src/components/social/d2/ActivityLog.tsx`

```
Props: { activities: Array<{id: ActivityId, row: ActivityRow}>; emptyMessage?: string }
```

Visual (one entry per row):
```
↑ share-card    Alice Liddell (host)   to Bob   2026-02-17 14:32
↑ share-file    README.md              to Avengers  2026-02-15 09:11
↓ note          (received)             from Carol   2026-02-14
```
- `↑` = outbound (actor is one of your personas). `↓` = inbound (actor is external — future, for now all are outbound).
- Timestamp: show relative time if < 24h, else date.
- Empty state: `emptyMessage` prop or default "No activity yet."

**Phase D2-4: Quick Actions Panel**

New file: `naveditor-lib/src/components/social/d2/QuickActionsPanel.tsx`

```
Props: {
  subjectType: 'contact' | 'group';
  subjectId: ContactId | GroupId;
  subjectName: string;
  actorPersonaId: PersonaId | null;
  onActivityLogged?: (id: ActivityId) => void;
}
```

Renders four action buttons. Each opens an inline mini-form below the button row on click:

- **Share Card:** inline text area pre-filled with JSON-LD of `actorPersonaId`'s persona. "Send" logs a `share-card` activity. "Copy to clipboard" also available.
- **Share File:** inline file path input + description. "Log" logs a `share-file` activity with the path and description as payload.
- **Share Link:** inline URL input + description. "Log" logs a `share-link` activity.
- **Invite:** inline description + notes fields. "Log" logs an `invite` activity.

All "Log" actions call `logActivity(store, newId, row)` via `useStore()`. On success: close the mini-form, call `onActivityLogged?.(id)`.

Disabled state: if `actorPersonaId` is null, buttons are disabled with tooltip "Select a persona first."

**Phase D2-5: Activity Console Top-Level Component**

New file: `naveditor-lib/src/components/social/d2/ActivityConsoleTab.tsx`

Layout: top bar + two-column grid.

```
┌─ [Alice (host) ▾] ──────────────────────────── (persona switcher)   ┐
├──────────────────────┬────────────────────────────────────────────── ┤
│  Contacts            │  Bob the Builder                              │
│  Bob (●)             │  person · bob@example.com                    │
│  Carol               │                                               │
│  Groups              │  [Share Card][Share File][Share Link][Invite] │
│  Avengers (●)        │                                               │
│  Staff               │  Activity Log                                 │
│                      │  ─────────────────────────────────────────   │
│                      │  ↑ share-card  2026-02-17                    │
└──────────────────────┴────────────────────────────────────────────── ┘
```

Left panel: unified contacts + groups list (sections, not tabs). Contacts shown first, then groups. Both show recent-activity indicator (dot) if they have any logged activity.

Right panel: `<ContactCard>` or `<GroupCard>` detail at top, `<QuickActionsPanel>` in middle, `<ActivityLog>` filtered to the selected subject at bottom.

Wrap in `<ActivePersonaProvider>`.

**D2 file change list:**

| File | Change |
|---|---|
| `packages/shared/src/types/social.ts` | add `ActivityRowSchema`, `ActivityRow`, `ActivityId` |
| `packages/shared/src/index.ts` | add activity type exports |
| `packages/state/src/schemas/social.ts` | add `ACTIVITIES_TABLE` constant |
| `packages/state/src/store.ts` | add `activities` table to schema |
| `packages/state/src/accessors/activities.ts` | new |
| `packages/state/src/accessors/index.ts` | add activities exports |
| `packages/state/src/hooks/use-activities.ts` | new |
| `packages/state/src/hooks/index.ts` | add `useActivities` export |
| `packages/state/tests/activity-accessors.test.ts` | new |
| `naveditor-lib/src/components/social/d2/ActivityLog.tsx` | new |
| `naveditor-lib/src/components/social/d2/QuickActionsPanel.tsx` | new |
| `naveditor-lib/src/components/social/d2/ActivityConsoleTab.tsx` | new |
| `naveditor-lib/tests/unit/components/d2/QuickActionsPanel.test.tsx` | new |

**D2 tests:**

`packages/state/tests/activity-accessors.test.ts`:
- `logActivity` stores row; `listActivities` returns it
- `listActivitiesForSubject` filters by subjectType + subjectId

`naveditor-lib/tests/unit/components/d2/QuickActionsPanel.test.tsx`:
- Null actorPersonaId → buttons disabled
- Click "Share Card" → mini-form opens
- "Log" with valid data → `logActivity` called, `onActivityLogged` fires, form closes
- Empty payload → validation error shown (do not log)

---

### D3: Relationship Dashboard — Group and Context First

**Mental model:** social data is organized around groups and shared contexts. Contacts matter in relation to groups. Files and activities live in the context of a group relationship.

**Use cases served:**
- Send a file to a group or contact ✓ (core)
- Share a file link to a group or contact ✓ (core)
- Launch activities for a group ✓ (core)
- Import data from text strings ◐ (via contact panel)

**Layout:**

```
┌─ People ──────────────────────────────────────────────────────────────┐
│  [Personas] [Contacts] [Groups ●]                    [Alice ▾]        │
├──────────────────────┬────────────────────────────────────────────────┤
│  Avengers         ●  │  Avengers                                      │
│    Iron Man          │  org:Organization · 3 members                  │
│    Captain America   │                                                 │
│    Thor              │  Members                                        │
│  ───────────────     │  Iron Man    lead     tony@avengers.org         │
│  Staff               │  Cap         member   steve@avengers.org        │
│    Alice Liddell     │  Thor        member   thor@asgard.example       │
│    Bob the Builder   │                                                 │
│                      │  Shared Files & Links                           │
│  [+ New Group]       │  ── Nothing shared yet ──                       │
│                      │  [Send File to Group]  [Share Link]             │
│                      │                                                 │
│                      │  Group Activities                               │
│                      │  ── Nothing logged yet ──                       │
│                      │  [New Activity]                                 │
└──────────────────────┴────────────────────────────────────────────────┘
```

**Key interactions:**
- **Groups as primary navigation:** groups are top-level items in the left panel. Contacts appear nested under their groups. Contacts without a group have their own "Ungrouped" section.
- **Group context panel:** right panel shows members (from `MembershipList`), a shared files/links log, and a group activity log — all in one place.
- **Send File to Group:** file picker from explorer; generates a descriptive share payload for all members (file name + group name + acting persona). Logs a share activity.
- **Share Link:** same but payload is a URL/path.
- **New Activity:** mini-form (type, notes); logs to the group's activity record.
- **Contact panel:** selecting an individual contact within a group shows their card + shared history with them specifically.

**Solid alignment:**
- Groups map to `vcard:Group` / `org:Organization` in our JSON-LD export. These are Solid-standard RDF types. ✓
- **Call-out — group file sharing via Solid:** would use an LDP container with `acl:agentGroup` pointing to a group WebID. No group WebID publishing or LDP write layer yet.
- **Call-out — group activities:** W3C Activity Streams supports `as:audience` for group-targeted activities. No delivery yet. Local records only.
- Contacts nested under groups makes the address book structure visible. Compatible with Solid Address Book containers. ✓

#### D3 Implementation Phases

**Prerequisites:** A+B complete. Activities table schema from D2 (D3 reuses it). `ActivePersonaContext`/`PersonaSwitcher` from D1.

**Phase D3-1: Activities Table (shared with D2)**

Same `ACTIVITIES_TABLE` schema as D2-1. If D2 is implemented first, this is already done. If D3 is implemented independently, implement the same schema.

**Phase D3-2: Contact-Group Tree Component**

New file: `naveditor-lib/src/components/social/d3/ContactGroupTree.tsx`

```
Props: {
  groups: Array<{id: GroupId, row: GroupRow}>;
  contacts: Array<{id: ContactId, row: ContactRow}>;
  memberships: Array<{id: MembershipId, row: MembershipRow}>;
  selectedId: string | null;
  selectedType: 'group' | 'contact' | null;
  onSelectGroup: (id: GroupId) => void;
  onSelectContact: (id: ContactId) => void;
}
```

Renders a tree:
```
▾ Avengers  (organization)
    Iron Man
    Captain America
▾ Staff  (team)
    Alice Liddell
    Bob the Builder
  Ungrouped
    Carol Danvers
```

- Groups are top-level, expandable (default: all expanded).
- Contacts appear under every group they belong to (a contact can appear in multiple groups).
- Contacts with no memberships appear under a non-collapsible "Ungrouped" section at the bottom.
- Selected item: `background: #0f172a`.
- Clicking a group header selects the group. Clicking a contact name selects the contact.

Build membership lookup: for each group, find memberships where `row.groupId === group.id`, then find the contact row for each `row.contactId`. This join is done in the component from the provided props — no fetching.

**Phase D3-3: Group Context Panel**

New file: `naveditor-lib/src/components/social/d3/GroupContextPanel.tsx`

```
Props: {
  groupId: GroupId;
  actorPersonaId: PersonaId | null;
}
```

Three sections stacked vertically:

1. **Group header** — `<GroupCard>` with member count, rendered from `useGroup(groupId)`.

2. **Members** — `<MembershipList>` from `useMembers(groupId)` + a `contactsById` map built from `useContacts()`.

3. **Shared Files & Links + Activities** — `<ActivityLog activities={useActivities({ subjectType: 'group', subjectId: groupId })} emptyMessage="Nothing shared yet." />` + action buttons (Share File, Share Link, New Activity) that open inline forms using the same mini-form pattern from D2's `QuickActionsPanel`.

**Phase D3-4: Contact Context Panel**

New file: `naveditor-lib/src/components/social/d3/ContactContextPanel.tsx`

```
Props: {
  contactId: ContactId;
  actorPersonaId: PersonaId | null;
}
```

Two sections:

1. **Contact header** — `<ContactCard>` from `useContact(contactId)`, with memberships from `useMembers filtered by contactId`.

2. **Activity with this contact** — `<ActivityLog activities={useActivities({ subjectType: 'contact', subjectId: contactId })} />` + Share Card / Share File / Share Link / Invite buttons.

**Phase D3-5: Relationship Dashboard Top-Level Component**

New file: `naveditor-lib/src/components/social/d3/RelationshipDashboardTab.tsx`

Layout: top bar + two-column grid.

```
┌─ [Alice ▾] ─────────────────────────────── (persona switcher, right-aligned)  ┐
├──────────────────────────┬──────────────────────────────────────────────────── ┤
│  ▾ Avengers              │  Avengers              (organization)                │
│      Iron Man         ●  │  3 members · avengers.example.com                   │
│      Captain America     │                                                      │
│      Thor                │  Members                                             │
│  ▾ Staff                 │  Iron Man   lead   tony@avengers.org                 │
│      Alice Liddell       │  Cap        member  ...                              │
│      Bob the Builder     │                                                      │
│    Ungrouped             │  Shared Files & Links                                │
│      Carol Danvers       │  ── Nothing yet ──                                   │
│                          │  [Share File]  [Share Link]                          │
│  [+ New Group]           │                                                      │
│                          │  Group Activities                                    │
│                          │  ── Nothing yet ──  [New Activity]                   │
└──────────────────────────┴──────────────────────────────────────────────────── ┘
```

State:
- `selectedGroupId: GroupId | null` — set by clicking a group header
- `selectedContactId: ContactId | null` — set by clicking a contact name; also clears if selected group changes
- Right panel: if `selectedContactId` is set, render `<ContactContextPanel>`; else if `selectedGroupId`, render `<GroupContextPanel>`; else render "Select a group or contact."

`[+ New Group]` button: runs `group create` command handler with a simple inline name prompt (an `<input>` that submits on Enter).

Wrap in `<ActivePersonaProvider>`.

**D3 file change list:**

| File | Change |
|---|---|
| Activities schema | same as D2-1 (skip if D2 already implemented) |
| `naveditor-lib/src/components/social/d3/ContactGroupTree.tsx` | new |
| `naveditor-lib/src/components/social/d3/GroupContextPanel.tsx` | new |
| `naveditor-lib/src/components/social/d3/ContactContextPanel.tsx` | new |
| `naveditor-lib/src/components/social/d3/RelationshipDashboardTab.tsx` | new |
| `naveditor-web/src/App.tsx` | swap tab content to `RelationshipDashboardTab` |
| `naveditor-desktop/src/App.tsx` | same |
| `naveditor-lib/tests/unit/components/d3/ContactGroupTree.test.tsx` | new |
| `naveditor-lib/tests/unit/components/d3/GroupContextPanel.test.tsx` | new |

**D3 tests:**

`ContactGroupTree.test.tsx`:
- Contact with 2 groups appears under both
- Contact with no memberships appears under "Ungrouped"
- Clicking group header → `onSelectGroup` called
- Clicking contact name → `onSelectContact` called

`GroupContextPanel.test.tsx`:
- Renders group name and member count
- Shows empty activity log when no activities logged
- After logging a share-file activity, activity log shows the entry

---

## Proposal D Comparison

| | D1: Card Exchange | D2: Activity Console | D3: Relationship Dashboard |
|---|---|---|---|
| **Primary metaphor** | Cards / identity | Actions / doing | Groups / context |
| **Share info as text** | ✓ core | ◐ action | ◐ contact panel |
| **Import from text** | ✓ core | ◐ action | ◐ contact panel |
| **Send file** | ◐ | ✓ action type | ✓ per group/contact |
| **Share file link** | ◐ | ✓ action type | ✓ per group/contact |
| **Launch activities** | — | ✓ core | ✓ per group |
| **Persona switching** | ✓ (my card) | ✓ (acting as) | ✓ (top bar) |
| **Solid alignment** | Highest | Medium | Medium |
| **New store schema** | none | `activities` table | `activities` table |
| **Effort** | Medium | Medium-high | Medium-high |

---

## Solid Compliance Gap Summary

These gaps apply regardless of which D proposal is chosen. They are not blockers for Plan 5 — they define a future "POD infrastructure" plan.

| Capability | Current state | Solid standard | Gap |
|---|---|---|---|
| Share identity | Export JSON-LD snippet; manual paste | WebID profile at a hosted URL | No HTTP hosting |
| Import identity | `solid-import` from file/text | HTTP GET of WebID profile | No remote fetch |
| File sharing | Local path reference + text | LDP resource + WAC ACL for recipient | No POD HTTP write |
| File link sharing | Local path string | POD resource URL with read ACL | No POD hosting |
| Activity delivery | Local activity record | ActivityPub inbox POST | No ActivityPub layer |
| Group activities | Local record | AS2 + shared group inbox | No remote delivery |

**Design principle for UI:** label near-term workarounds as "local mode." When a POD HTTP layer is added, "local mode" actions upgrade to Solid-native delivery without changing the UI contracts — only the command handler internals change.

---

## Behavior-Driven Test Scenarios (Gherkin)

Per `TESTING.md`: "prefer higher-level tests to assess the status of broad system behaviors." The unit tests in each phase validate internals. These Gherkin scenarios validate observable user behavior end-to-end. They should be written as the acceptance criteria for each phase and implemented as integration tests once the stack is in place.

These are not exhaustive — they define the minimum behavior contract for each major user-facing feature.

```gherkin
Feature: Social shell commands with rich output (Plan A)

  Scenario: List personas with none created
    Given the store is empty
    When I run "persona list"
    Then the shell output shows "No personas yet"

  Scenario: List personas with rich card output
    Given I have created personas "Alice" and "Bob"
    When I run "persona list"
    Then the shell output renders a PersonaList component
    And the component shows cards for "Alice" and "Bob"

  Scenario: Create a persona and see it in the list
    Given the store is empty
    When I run "persona create Alice --email alice@example.com"
    Then the shell output renders a PersonaCard for "Alice"
    And running "persona list" afterwards shows "Alice" in the list

Feature: People panel reactivity (Plan B)

  Scenario: Panel reflects terminal mutations
    Given the People panel is open showing the Personas tab
    And the store is empty
    When I run "persona create Alice" in the terminal
    Then the People panel list updates to show "Alice" without reloading

  Scenario: Deleting a selected entity shows not-found state
    Given the People panel has "Alice" selected in the detail view
    When I run "persona delete <alice-id>" in the terminal
    Then the detail panel shows "Entity not found"

Feature: Share my card (D1)

  Scenario: Copy persona JSON-LD to clipboard
    Given I have a persona "Alice Liddell" with email "alice@example.com"
    And Alice is my active persona
    When I click "Copy" in the Share Card panel
    Then the onCopy callback is called with JSON-LD containing foaf:name "Alice Liddell"

  Scenario: No persona selected shows prompt
    Given no active persona is set
    When the Share Card panel renders
    Then it shows "Select a persona to share"

Feature: Import a contact card (D1)

  Scenario: Successfully import a contact from JSON-LD text
    Given I paste valid contact JSON-LD for "Bob Builder" into the Import Card panel
    When I click "Parse + Add"
    Then a new contact "Bob Builder" appears in the contacts list
    And the onImported callback fires with the new contact id

  Scenario: Invalid JSON shows error without adding contact
    Given I paste "not valid json" into the Import Card panel
    When I click "Parse + Add"
    Then an error message appears
    And no new contact is created in the store

Feature: Activity logging (D2)

  Scenario: Log a share-card activity
    Given "Alice" is my active persona
    And "Bob" is the selected contact
    When I click "Share Card" and then "Log"
    Then an activity record appears in the Activity Log for Bob
    And the record shows actorPersonaId matching Alice's id

  Scenario: Activity actions blocked without active persona
    Given no active persona is set
    When the Quick Actions panel renders for any contact
    Then all action buttons are disabled
    And a tooltip reads "Select a persona first"

Feature: Group context (D3)

  Scenario: Contact appears under all their groups
    Given contact "Alice" is a member of "Avengers" and "Staff"
    When the Relationship Dashboard renders
    Then "Alice" appears under both "Avengers" and "Staff" in the tree
    And "Alice" does not appear in the "Ungrouped" section

  Scenario: Contact with no groups appears in Ungrouped
    Given contact "Carol" has no group memberships
    When the Relationship Dashboard renders
    Then "Carol" appears under "Ungrouped" in the tree
```

---

## Recommended Path

**A + B first** — implement rich shell output and reactive panel on the foundation that's already there. This validates the component architecture and hooks before investing in the full CRM UI.

**D1 next** — the identity exchange loop (share card / import card) is fully achievable now with existing mappers. High value, low risk, good Solid alignment.

**D2 after D1** — once the `activities` table schema is defined, add the activity console. The persona-switching concept established in D1 carries directly into D2.

**D3 as eventual home** — the group-centric view becomes more valuable as groups accumulate files, activities, and members. Build it after D2 once the group model is richer.
