# Plan 7 — Solid UI Refinement

## Overview

This plan addresses three gaps in the D1 Card Exchange tab:

1. **Persona creation form** — the UI has no way to create a persona; the user must type `persona create <name>` in the terminal. When no personas exist the `PersonaSwitcher` just says "no personas" with no affordance.
2. **Inline persona editing** — `ShareCardPanel` is read-only. The user cannot set their name, email, homepage, or bio from the GUI.
3. **Send my card via Solid** — the `solid-share-card` command delivers your persona card to a contact's LDP inbox, but there is no GUI trigger. D2's "Share Card" quick action only logs the event locally; it does not send anything over the network.

All three features live in `naveditor-lib/src/components/social/d1/` and require no new packages or commands. Phases 1 and 2 have no external dependencies. Phase 3 calls `fetchWebIdProfile` and `deliverCard` from `@devalbo/solid-client` (already a `naveditor-lib` dependency) and `useSolidSession()` from the same package.

```
Phase 1  CreatePersonaPanel         persona creation form in D1
Phase 2  Inline persona editing     editable fields in ShareCardPanel
Phase 3  SendCardPanel              Solid inbox delivery from D1
```

Phases 1 and 2 can be implemented together since they both touch `ShareCardPanel` / `CardExchangeTab`. Phase 3 depends on having a persona (Phase 1) but is otherwise independent.

---

## Phase 1 — Persona Creation Form

### Goal

When the user opens D1 and has no personas, they see a "Create Persona" panel instead of the empty `ShareCardPanel`. A `+ New Persona` button in the left-panel header is always visible so the user can also create additional personas later.

### Entry Points

Two triggers, both in `CardExchangeTab`:

1. **Empty state**: when `personas.length === 0`, `activePersonaId` is null. The right panel shows `CreatePersonaPanel` instead of `ShareCardPanel`.
2. **Always-available button**: a small `+ New` button beside the `PersonaSwitcher` label. Clicking it sets mode to `'create-persona'` regardless of current persona count.

### Component: `CreatePersonaPanel`

New file: `naveditor-lib/src/components/social/d1/CreatePersonaPanel.tsx`

**Props**:
```ts
interface CreatePersonaPanelProps {
  onCreated: (id: PersonaId) => void;
}
```

**Fields** — name (required), email, homepage, bio. All other `PersonaRowSchema` fields are initialised to `''`. `isDefault` is computed at submit time: `true` if no default persona currently exists in the store, `false` otherwise.

**Submit logic**:
```ts
const submit = () => {
  const trimmedName = name.trim();
  if (!trimmedName) { setError('Name is required.'); return; }

  const rawId = PersonaIdToolbox.createRandomId?.() ?? crypto.randomUUID();
  const id = unsafeAsPersonaId(rawId);

  // Auto-default when no default persona exists yet.
  // getDefaultPersona checks isDefault: true in the store; if nothing has it,
  // this new persona becomes the default automatically.
  const isDefault = !getDefaultPersona(store);

  setPersona(store, id, {
    name: trimmedName,
    nickname: '', givenName: '', familyName: '',
    email: email.trim(),
    phone: '', image: '',
    bio: bio.trim(),
    homepage: homepage.trim(),
    oidcIssuer: '', inbox: '',
    publicTypeIndex: '', privateTypeIndex: '', preferencesFile: '',
    storage: '', profileDoc: '',
    isDefault,
    updatedAt: new Date().toISOString()
  });
  onCreated(id);
};
```

**Rationale for auto-default**: `ActivePersonaContext` already falls back to `personas[0]` for the GUI, so the first persona feels default in the UI. But `solid-pod-push` and `solid-share-card` call `getDefaultPersona()` which requires `isDefault: true`. A user who creates their first persona via the GUI and then tries to push to their POD would hit "No default persona set" with no clear recovery path. If there is only one persona, it is the default by definition.

Uses `useStore()` from `@devalbo/state`. No new state-package dependencies — `setPersona` and `PersonaIdToolbox` are already used by the `persona create` command.

### Changes to `CardExchangeTab`

`Mode` union type gains `'create-persona'`.

Initial mode selection changes:
```ts
// Redirect to create-persona whenever the store has no personas.
// Deps: personas.length only — mode is intentionally omitted so this does not
// re-fire when the user switches to another mode (e.g. 'import') while empty.
// React ignores setMode calls that do not change the current value, so no
// redundant re-render occurs if mode is already 'create-persona'.
useEffect(() => {
  if (personas.length === 0) {
    setMode('create-persona');
  }
}, [personas.length]);
```

Left-panel PersonaSwitcher header gains a `+ New` button:
```tsx
<div style={{ padding: '10px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
  <PersonaSwitcher label="My Card" />
  <button
    type="button"
    onClick={() => setMode('create-persona')}
    style={{ border: '1px solid #334155', borderRadius: '6px', background: '#1e293b', color: '#e2e8f0', padding: '4px 8px', fontSize: '12px' }}
  >
    + New
  </button>
</div>
```

Right-panel routing gains:
```tsx
{mode === 'create-persona' && (
  <CreatePersonaPanel
    onCreated={(id) => {
      setActivePersonaId(id);
      setMode('share');
    }}
  />
)}
```

### Tests

Use a component test so that validation messages, the `onCreated` callback, and store side-effects are all exercised through real user events.

**Test file**: `naveditor/tests/unit/components/d1/CreatePersonaPanel.test.tsx`

| # | Scenario | Assertion |
|---|----------|-----------|
| 1 | Empty name → validation error | error state is set; `setPersona` not called |
| 2 | Valid name → persona created in store | `store.getRow(PERSONAS_TABLE, id).name === 'Alice'` |
| 3 | `onCreated` called with generated id | callback receives the id that exists in the store |
| 4 | Whitespace-only name → treated as empty | same as test 1 |
| 5 | No default exists → new persona gets `isDefault: true` | `store.getRow(PERSONAS_TABLE, id).isDefault === true` |
| 6 | Default already exists → new persona gets `isDefault: false` | existing default unchanged; new persona `isDefault: false` |

Use a component test (matching existing D1 test style) so validation messages, callback behavior, and store side-effects are all exercised from real user events.

---

## Phase 2 — Inline Persona Editing

### Goal

`ShareCardPanel` grows editable input fields for the common profile fields. The JSON-LD preview updates when fields are committed (on blur). The user can set their name, email, homepage, and bio without touching the terminal.

### Design Decisions

**Local state + commit on blur** — not on every keystroke. `usePersona()` is reactive; committing on every keypress would re-render every consumer of that persona on every character typed. Local `useState` per field syncs to the store on `onBlur`.

**Reset on persona switch** — `useEffect([personaId])` reinitialises local field state when `personaId` changes (e.g. the user switches the `PersonaSwitcher` dropdown). Without this, switching personas would show the previous persona's typed-but-not-blurred values.

**Fields to expose**: name, email, phone, homepage, bio, image. These are the fields a user would want to set as their public card. The Solid-specific fields (`oidcIssuer`, `inbox`, `publicTypeIndex`, etc.) are populated by `solid-fetch-profile` from their WebID document and should not be hand-edited here.

**`updatedAt` on blur** — each `onBlur` handler sets `updatedAt: new Date().toISOString()` alongside the changed field. This is necessary for L5 sync: the synchronizer uses `updatedAt` to resolve conflicts between local edits and POD versions.

### Implementation

Modify `naveditor-lib/src/components/social/d1/ShareCardPanel.tsx`.

Add local state for each editable field:
```ts
const [localName, setLocalName] = useState(persona?.name ?? '');
const [localEmail, setLocalEmail] = useState(persona?.email ?? '');
const [localPhone, setLocalPhone] = useState(persona?.phone ?? '');
const [localHomepage, setLocalHomepage] = useState(persona?.homepage ?? '');
const [localBio, setLocalBio] = useState(persona?.bio ?? '');
const [localImage, setLocalImage] = useState(persona?.image ?? '');
```

Reset on persona switch:
```ts
useEffect(() => {
  if (!persona) return;
  setLocalName(persona.name);
  setLocalEmail(persona.email);
  setLocalPhone(persona.phone);
  setLocalHomepage(persona.homepage);
  setLocalBio(persona.bio);
  setLocalImage(persona.image);
}, [personaId]); // intentionally not [persona] — avoids reset on every Solid sync
```

Commit helper — uses a narrow union type so TypeScript catches field-name typos at compile time:
```ts
type EditablePersonaField = 'name' | 'email' | 'phone' | 'homepage' | 'bio' | 'image';

const commit = (field: EditablePersonaField, value: string) => {
  if (!persona || !personaId) return;
  setPersona(store, resolvedPersonaId, {
    ...persona,
    [field]: value,
    updatedAt: new Date().toISOString()
  });
};
```

`EditablePersonaField` is a subset of the keys of `PersonaRowInput` that are editable in the GUI. The spread `...persona` ensures all other fields carry through unchanged. `ShareCardPanel` gains `useStore()` (one new import from `@devalbo/state`) and calls `setPersona` on blur. The existing `<pre>{json}</pre>` preview stays below the form — it reflects the committed (store) value, not the local draft.

**Props**: no changes needed. `personaId` is already the key prop.

### Editable field render pattern

```tsx
<label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
  Name
  <input
    value={localName}
    onChange={(e) => setLocalName(e.target.value)}
    onBlur={() => commit('name', localName)}
    style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
  />
</label>
```

### Tests

| # | Scenario | Assertion |
|---|----------|-----------|
| 1 | Blur name field → store row updated | `store.getRow(PERSONAS_TABLE, id).name === 'New Name'` |
| 2 | Blur sets `updatedAt` to a recent ISO timestamp | `updatedAt` differs from the initial value and is parseable as a date |
| 3 | Switching `personaId` prop resets local fields | local state reflects new persona's values |
| 4 | Store updates from outside (Solid sync) do NOT reset mid-edit | type without blurring; sync event fires; local field unchanged |

Prefer component tests for 1–3 so blur/reset behavior is exercised end-to-end through the rendered inputs. Test 4 remains best as manual/E2E because it depends on race timing with external sync updates.

---

## Phase 3 — Send My Card via Solid

### Goal

When the user selects a contact in D1 that has a `webId`, and they are authenticated via Solid, a "Send my card" section appears below `ContactForwardPanel`. Clicking the button fetches the contact's profile to find their LDP inbox, then POSTs the user's persona card as an AS2 `Offer` activity — the same flow as `solid-share-card <contactId>` but GUI-driven.

### Why D1, Not D2

D2's `QuickActionsPanel` "Share Card" button writes a local activity log entry. It is a record-keeping action, not a network delivery. These are distinct: D2 is "I recorded that I shared my card with Bob", D1 is "I actually sent my card to Bob's inbox right now." Conflating them would confuse both features. D1 is the right place for live Solid delivery.

### Session Access

`CardExchangeTab` is rendered inside `<SolidSessionProvider>` (set up in `App.tsx`). Adding `useSolidSession()` to `CardExchangeTab` requires one import from `@devalbo/solid-client` — already a dependency of `naveditor-lib`.

### Component: `SendCardPanel`

New file: `naveditor-lib/src/components/social/d1/SendCardPanel.tsx`

**Props**:
```ts
interface SendCardPanelProps {
  personaId: PersonaId;
  contactId: ContactId;
  session: SolidSession;
}
```

**Render guards**: return `null` if either the contact has no `webId` or `usePersona()` returns `undefined` (which can happen if the persona is deleted after the component mounts). Both checks go at the top of the component body before any derived values are computed:

```ts
const persona = usePersona(unsafeAsPersonaId(personaId));
const contact = useContact(unsafeAsContactId(contactId));
if (!contact?.webId || !persona) return null;
```

This keeps `CardExchangeTab` simple — it always renders `SendCardPanel` when a contact is selected and authenticated, letting the panel self-hide.

**Actor WebID requirement**: The AS2 `actor` field in the delivered Offer must be a resolvable URL. When a persona is created locally, its `personaId` is a UUID (not a URL). A contact receiving such a card cannot look up the sender, and some Solid servers reject non-URL actor IRIs. Send is therefore only enabled when the persona has a resolvable identity:

```ts
// persona.profileDoc is set by solid-fetch-profile or solid-pod-pull.
// personaId is a URL when the persona was pulled from a Solid POD (session.webId).
const isValidUrl = (s: string): boolean => { try { new URL(s); return true; } catch { return false; } };
const profileDoc = persona.profileDoc.trim();
const actorWebId = isValidUrl(profileDoc) ? profileDoc : (isValidUrl(personaId) ? personaId : '');
const canSend = !!actorWebId;
```

`startsWith('http')` is intentionally avoided — it accepts strings like `"httpx://..."` that are not valid URLs. `new URL()` is the correct parse check and is available in all target environments (browser, Tauri, Node.js 18+).

If `canSend` is false, the Send button is disabled and a hint is shown:
> "Your persona needs a WebID. Run `solid-fetch-profile <your-webId>` or `solid-pod-pull` first."

**Send logic**:
```ts
const send = async () => {
  if (!canSend) return; // guard; button should already be disabled
  setStatus('loading');
  setMessage('');

  const profileResult = await fetchWebIdProfile(contact.webId);
  if (!profileResult.ok) {
    setStatus('error');
    setMessage(`Could not fetch contact profile: ${profileResult.error}`);
    return;
  }
  if (!profileResult.row.inbox) {
    setStatus('error');
    setMessage("Contact's profile does not list an inbox.");
    return;
  }

  const cardJsonLd = personaToJsonLd(persona, personaId);
  const result = await deliverCard(
    profileResult.row.inbox,
    actorWebId,   // use resolved URL, not the raw personaId
    contact.webId,
    cardJsonLd,
    session.fetch
  );

  if (!result.ok) {
    setStatus('error');
    setMessage(result.error);
  } else {
    setStatus('success');
    setMessage(`Card sent to ${contact.name || contact.webId}`);
  }
};
```

Note `actorWebId` is passed to `deliverCard` rather than `personaId` directly. `deliverCard`'s second argument is typed `string` (the actor IRI), so this is correct.

**Status type**: `'idle' | 'loading' | 'success' | 'error'`

**Imports**:
```ts
import { personaToJsonLd, useContact, usePersona } from '@devalbo/state';
import { deliverCard, fetchWebIdProfile, type SolidSession } from '@devalbo/solid-client';
import { unsafeAsContactId, unsafeAsPersonaId, type ContactId, type PersonaId } from '@devalbo/shared';
```

`useStore` is omitted — `SendCardPanel` is read-only with respect to the store (all writes happen in the persister layer).

### Changes to `CardExchangeTab`

Add near the top:
```ts
const session = useSolidSession();
```

In the right-panel, alongside `ContactForwardPanel`:
```tsx
{mode === 'contact' && selectedContactId && (
  <>
    <ContactForwardPanel contactId={unsafeAsContactId(selectedContactId)} onCopy={copyText} copyStatus={copyStatus} />
    {session?.isAuthenticated && activePersonaId && (
      <SendCardPanel
        contactId={unsafeAsContactId(selectedContactId)}
        personaId={activePersonaId}
        session={session}
      />
    )}
  </>
)}
```

`SendCardPanel` self-hides if the contact has no `webId`, so no conditional logic needed in `CardExchangeTab`.

### Tests

The core send logic mirrors the existing `solid-share-card` command tests. The most valuable new tests verify the async state transitions. If React Testing Library is not set up, the send logic can be extracted to a plain async function with injected `fetchProfileFn` and `deliverFn` dependencies and tested directly.

**Test file**: `naveditor/tests/unit/components/d1/SendCardPanel.test.tsx`

| # | Scenario | Assertion |
|---|----------|-----------|
| 1 | Contact has no webId → panel returns null | `deliverCard` not called |
| 2 | Persona has no profileDoc and UUID personaId → `canSend` false, button disabled | button disabled; hint text shown |
| 3 | Persona has profileDoc URL → `canSend` true | button enabled |
| 4 | Persona has URL-shaped personaId (no profileDoc) → `canSend` true | button enabled |
| 5 | `fetchWebIdProfile` returns error → status `'error'`, message shown | error message contains profile fetch error |
| 6 | Profile has no inbox → status `'error'`, "does not list an inbox" | error message matches |
| 7 | `deliverCard` returns `ok: false` → error message shown | message from `result.error` |
| 8 | Happy path → `deliverCard` called with `actorWebId` (not raw personaId), correct inbox and contact.webId | mock called correctly; status `'success'` |
| 9 | While loading, button is disabled | `disabled === true` during async operation |

---

---

## Phase 4 — Group Membership Editing in D3

### Goal

The D3 Relationship Dashboard shows which contacts belong to which groups via the `ContactGroupTree` and the `MembershipList` in `GroupContextPanel`. Both are read-only. The only way to add or remove a contact from a group is the terminal command `group add-member <groupId> <contactId>`. Phase 4 adds inline add/remove controls in both context panels, covering both directions of the relationship.

### What Exists

- `ContactGroupTree` — tree of groups with members nested under each; "Ungrouped" section at the bottom. Selection-only, no mutation.
- `GroupContextPanel` — shows `GroupCard`, `MembershipList` (display only), `QuickActionsPanel`, `ActivityLog`.
- `ContactContextPanel` — shows `ContactCard` (includes memberships display), `QuickActionsPanel`, `ActivityLog`.
- `addMember(store, { groupId, contactId, role, startDate, endDate })` and `removeMember(store, groupId, contactId)` are both already exported from `@devalbo/state` and used by the terminal commands.

### Changes: `GroupContextPanel`

Replace the static `MembershipList` block with an inline managed list that includes per-member remove buttons, plus an "Add member" control at the bottom.

**New local state:**
```ts
const store = useStore();
const [addContactId, setAddContactId] = useState<ContactId | ''>('');
```

**Derived values:**
```ts
const memberContactIds = useMemo(
  () => new Set(memberships.map((m) => m.row.contactId)),
  [memberships]
);
// Contacts not already in this group, for the add-member select
const available = useMemo(
  () => contacts.filter(({ id }) => !memberContactIds.has(id)),
  [contacts, memberContactIds]
);
```

**Members section** replaces `<MembershipList>`:
```tsx
<div>
  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Members</div>
  {memberships.length === 0
    ? <div style={{ color: '#64748b', fontSize: '12px' }}>No members yet.</div>
    : memberships.map((m) => {
        const name = contactsById.get(m.row.contactId)?.name ?? m.row.contactId;
        return (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span style={{ color: '#e2e8f0' }}>{name}</span>
            <button type="button" onClick={() => removeMember(store, groupId, m.row.contactId as ContactId)} style={removeButtonStyle}>
              Remove
            </button>
          </div>
        );
      })
  }
  {available.length > 0 && (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <select value={addContactId} onChange={(e) => setAddContactId(e.target.value as ContactId | '')} style={selectStyle}>
        <option value="">Add member…</option>
        {available.map(({ id, row }) => <option key={id} value={id}>{row.name}</option>)}
      </select>
      <button
        type="button"
        disabled={!addContactId}
        onClick={() => {
          if (!addContactId) return;
          addMember(store, { groupId, contactId: addContactId as ContactId, role: '', startDate: '', endDate: '' });
          setAddContactId('');
        }}
        style={addButtonStyle}
      >
        Add
      </button>
    </div>
  )}
</div>
```

`GroupContextPanel` gains `useStore()` from `@devalbo/state` and `addMember`, `removeMember`, `useState` imports. `ContactId` is added to the `@devalbo/shared` imports. `MembershipList` import can be removed from this file once replaced.

### Changes: `ContactContextPanel`

Add a "Groups" section below `ContactCard` showing current memberships with remove buttons and an add-to-group control.

**New local state and derived values:**
```ts
const store = useStore();
const groups = useGroups();
const [addGroupId, setAddGroupId] = useState<GroupId | ''>('');

const memberGroupIds = useMemo(
  () => new Set(memberships.map((m) => m.row.groupId)),
  [memberships]
);
const available = useMemo(
  () => groups.filter(({ id }) => !memberGroupIds.has(id)),
  [groups, memberGroupIds]
);
```

**Groups section** (inserted between `ContactCard` and `QuickActionsPanel`):
```tsx
<div>
  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Groups</div>
  {memberships.length === 0
    ? <div style={{ color: '#64748b', fontSize: '12px' }}>Not in any group.</div>
    : memberships.map((m) => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ color: '#e2e8f0' }}>{groupsById.get(m.row.groupId)?.name ?? m.row.groupId}</span>
          <button type="button" onClick={() => removeMember(store, m.row.groupId as GroupId, contactId)} style={removeButtonStyle}>
            Remove
          </button>
        </div>
      ))
  }
  {available.length > 0 && (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <select value={addGroupId} onChange={(e) => setAddGroupId(e.target.value as GroupId | '')} style={selectStyle}>
        <option value="">Add to group…</option>
        {available.map(({ id, row }) => <option key={id} value={id}>{row.name}</option>)}
      </select>
      <button
        type="button"
        disabled={!addGroupId}
        onClick={() => {
          if (!addGroupId) return;
          addMember(store, { groupId: addGroupId as GroupId, contactId, role: '', startDate: '', endDate: '' });
          setAddGroupId('');
        }}
        style={addButtonStyle}
      >
        Add
      </button>
    </div>
  )}
</div>
```

`ContactContextPanel` gains `useStore()`, `useGroups()`, `addMember`, `removeMember`, `useState`, `useMemo` imports. A `groupsById` map is derived similarly to `contactsById` in `GroupContextPanel`.

### Why Both Panels

The user can navigate D3 from either direction — selecting a group first or selecting a contact first. Putting membership management in both panels means the action is always one click away from context, whichever direction the user entered.

### Tests

**Test file**: `naveditor/tests/unit/components/d3/GroupContextPanel.test.tsx` and `ContactContextPanel.test.tsx`

| # | Panel | Scenario | Assertion |
|---|-------|----------|-----------|
| 1 | Group | Remove button calls `removeMember` with correct groupId and contactId | membership deleted from store |
| 2 | Group | Add select shows only contacts not already in group | available list excludes existing members |
| 3 | Group | Add button disabled when no contact selected | `disabled === true` on button |
| 4 | Group | Add button calls `addMember` and resets select | membership created; select back to empty |
| 5 | Contact | Remove button calls `removeMember` with correct groupId and contactId | membership deleted |
| 6 | Contact | Add select shows only groups contact is not already in | available list excludes current groups |
| 7 | Contact | Add button calls `addMember` and resets select | membership created; select reset |

---

## Files Created / Modified

| Action | Path |
|--------|------|
| NEW    | `naveditor-lib/src/components/social/d1/CreatePersonaPanel.tsx` |
| NEW    | `naveditor-lib/src/components/social/d1/SendCardPanel.tsx` |
| MODIFY | `naveditor-lib/src/components/social/d1/CardExchangeTab.tsx` |
| MODIFY | `naveditor-lib/src/components/social/d1/ShareCardPanel.tsx` |
| MODIFY | `naveditor-lib/src/components/social/d3/GroupContextPanel.tsx` |
| MODIFY | `naveditor-lib/src/components/social/d3/ContactContextPanel.tsx` |

No new packages, no new commands, no changes to `@devalbo/state`, `@devalbo/shared`, or `@devalbo/solid-client`.

---

## Implementation Order

```
1. CreatePersonaPanel.tsx           (new component, no deps on P2/P3/P4)
2. CardExchangeTab — mode + button  (wire P1 entry points)
3. ShareCardPanel inline editing    (Phase 2 — can be done alongside P1)
4. SendCardPanel.tsx                (new component, needs session from useSolidSession)
5. CardExchangeTab — session wire   (add useSolidSession + render SendCardPanel)
6. GroupContextPanel — membership   (Phase 4 — inline add/remove members)
7. ContactContextPanel — membership (Phase 4 — inline add to / remove from group)
```

Steps 1–3 and 6–7 require no authenticated session and can be tested entirely offline. Steps 4–5 require a Solid session for live testing but can be unit-tested with mocked `fetchWebIdProfile` and `deliverCard`.
