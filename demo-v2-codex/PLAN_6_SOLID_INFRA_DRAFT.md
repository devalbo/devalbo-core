# Plan 6 — Solid POD Infrastructure

## Overview

This plan integrates the naveditor ecosystem with the Solid protocol — Linked Data Platform (LDP) containers, WebID profiles, Solid OIDC, and ActivityPub delivery. The work is split into five ordered layers. Each layer unlocks the next; none can be usefully parallelized with its successor.

```
L1  Read-only WebID profile fetch         (no auth)
L2  Solid OIDC authentication             (auth gate for all write layers)
L3  POD write / LDP persister             (read+write your own POD)
L4  ActivityPub delivery                  (send to contacts' inboxes)
L5  TinyBase bidirectional sync           (live two-way replication)
```

**Only L1 is fully implementation-ready in this document.** L2–L5 are detailed enough to confirm that L1 carries no rework risk regardless of decisions made in later layers.

---

## Cross-Cutting Decision: Package Structure

**Decision: create `packages/solid-client` starting at L1.**

All five layers require HTTP operations against Solid POD URLs. Putting this logic in a dedicated package (`packages/solid-client`) rather than in `naveditor-lib/src/lib/solid-fetch.ts` means:

- Commands in `naveditor-lib` stay thin (call the package, render the result)
- L2 auth functions, L3 LDP operations, and L4 inbox delivery all extend the same package
- No file moves required between layers

The package starts small (one function in L1) and grows incrementally. L1 does not depend on any auth state, so the package has no `@inrupt/solid-client-authn-*` dependency until L2.

**Package location:** `packages/solid-client/`
**Internal package name:** `@devalbo/solid-client`

---

## L1 — Read-Only WebID Profile Fetch

### Goal

Given a WebID URL (`https://user.example/profile/card#me`), fetch the public profile document, parse it, and return it as a `PersonaRowInput`. No authentication required — Solid WebID profiles are public by design.

This powers:
- `solid-fetch-profile <webId>` command (displays fetched profile)
- "Import from WebID" flow in `ImportCardPanel` (currently shows "not supported yet")

### What Makes This Non-Trivial

**Our existing mappers were built for our own `solid-export` format**, which uses string literals for URL fields. Real Solid WebID profiles represent resource IRIs as `{ "@id": "..." }` node references, not strings. Fields affected:

| PersonaRow field    | Our export form | Real Solid profile form              |
|---------------------|-----------------|--------------------------------------|
| `oidcIssuer`        | `"https://..."` | `{ "@id": "https://..." }`           |
| `inbox`             | `"https://..."` | `{ "@id": "https://..." }`           |
| `publicTypeIndex`   | `"https://..."` | `{ "@id": "https://..." }`           |
| `privateTypeIndex`  | `"https://..."` | `{ "@id": "https://..." }`           |
| `preferencesFile`   | `"https://..."` | `{ "@id": "https://..." }`           |
| `homepage`          | `"https://..."` | `{ "@id": "https://..." }`           |

The current `jsonLdToPersonaRow` uses `valueAsString` for all of the above, which returns `''` for node references. The fix is to use `valueAsNodeId` (already defined in the same file), which handles both string and `{ "@id": "..." }` forms.

**`valueAsNodeId` is already forward-compatible:** it handles both literal strings and node refs, so changing these fields does not break existing `solid-import` behavior (our own export uses string literals, which pass through unchanged).

### JSON-LD Response Shape Variations

Solid servers return JSON-LD in one of three shapes when `Accept: application/ld+json` is sent:

```
Shape A — single object:
  { "@context": {...}, "@id": "...#me", "foaf:name": "Alice", ... }

Shape B — JSON-LD array:
  [ { "@context": {...}, "@id": "...#me", ... }, { "@id": "...", ... } ]

Shape C — named graph / @graph:
  { "@context": {...}, "@graph": [ { "@id": "...#me", ... }, ... ] }
```

Our parser must handle all three. For B and C, find the node where `@id === webId`.

### Error Cases

| Condition                                   | Behavior                                                           |
|---------------------------------------------|--------------------------------------------------------------------|
| HTTP error (4xx/5xx)                        | `{ ok: false, error: "HTTP <status>: <statusText>" }`              |
| Non-JSON-LD content type returned           | `{ ok: false, error: "Server returned <type>, not JSON-LD. ..." }` |
| Network failure                             | `{ ok: false, error: "Network error: <message>" }`                 |
| Malformed JSON                              | `{ ok: false, error: "Could not parse response as JSON" }`         |
| No node matching webId found in document    | `{ ok: false, error: "Profile document does not contain a node for <webId>" }` |
| Name field empty after parse                | `{ ok: false, error: "Profile missing required foaf:name" }`       |

CORS note: In browser runtimes, fetching cross-origin Solid profiles will fail if the server does not send permissive `Access-Control-Allow-Origin` headers. Community Solid Server (CSS) and Solid Community (`solidcommunity.net`) both set `Access-Control-Allow-Origin: *` for profile documents. In Tauri and Node.js there is no CORS restriction. The browser CORS failure surfaces as a network error (browsers do not expose CORS details), so the error message for network errors should include a hint: "If you are in a browser, the server may not allow cross-origin requests — try the desktop or terminal client."

### Files to Create / Modify

#### New: `packages/solid-client/package.json`

```json
{
  "name": "@devalbo/solid-client",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@devalbo/shared": "workspace:*",
    "@devalbo/state": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

#### New: `packages/solid-client/src/index.ts`

```ts
export * from './fetch-profile';
```

#### New: `packages/solid-client/src/fetch-profile.ts`

```ts
import { jsonLdToPersonaRow } from '@devalbo/state';
import type { PersonaId, PersonaRowInput } from '@devalbo/shared';

type JsonLdObject = Record<string, unknown>;

export type ProfileFetchResult =
  | { ok: true; id: PersonaId; row: PersonaRowInput }
  | { ok: false; error: string };

/** Find the node in a JSON-LD document whose @id matches the given webId. */
const extractSubjectNode = (parsed: unknown, webId: string): JsonLdObject | null => {
  const matchesId = (n: unknown): n is JsonLdObject =>
    typeof n === 'object' && n !== null && '@id' in n &&
    (n as JsonLdObject)['@id'] === webId;

  if (Array.isArray(parsed)) {
    return (parsed.find(matchesId) as JsonLdObject | undefined) ?? null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as JsonLdObject;

  // Shape C: @graph wrapper — inherit top-level @context if absent from node
  if (Array.isArray(obj['@graph'])) {
    const node = (obj['@graph'] as unknown[]).find(matchesId);
    if (node) {
      const merged = { ...(node as JsonLdObject) };
      if (!('@context' in merged) && '@context' in obj) {
        merged['@context'] = obj['@context'];
      }
      return merged;
    }
  }

  // Shape A: single object
  return matchesId(obj) ? obj : null;
};

/**
 * Fetch a public Solid WebID profile document and parse it into a PersonaRowInput.
 * No authentication required — WebID profiles are publicly readable.
 */
export const fetchWebIdProfile = async (webId: string): Promise<ProfileFetchResult> => {
  let response: Response;
  try {
    response = await fetch(webId, {
      headers: { Accept: 'application/ld+json, application/json;q=0.9' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = typeof window !== 'undefined'
      ? ' If you are in a browser, the server may not allow cross-origin requests — try the desktop or terminal client.'
      : '';
    return { ok: false, error: `Network error: ${msg}.${hint}` };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    return {
      ok: false,
      error: `Server returned "${contentType}", not JSON-LD. Try the desktop or terminal client (Turtle is supported there), or verify the WebID URL.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { ok: false, error: 'Could not parse response as JSON' };
  }

  const node = extractSubjectNode(parsed, webId);
  if (!node) {
    return {
      ok: false,
      error: `Profile document does not contain a node for "${webId}". The server may use Turtle only or the WebID fragment may not match.`,
    };
  }

  try {
    const { id, row } = jsonLdToPersonaRow(node);
    if (!row.name) {
      return { ok: false, error: 'Profile missing required foaf:name' };
    }
    return { ok: true, id: id || (webId as PersonaId), row };
  } catch (err) {
    return { ok: false, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` };
  }
};
```

#### Modified: `packages/state/src/mappers/persona-jsonld.ts`

Change `valueAsString` to `valueAsNodeId` for all IRI-valued fields in `jsonLdToPersonaRow`:

```ts
// Before:
oidcIssuer: valueAsString(get(jsonLd, 'solid:oidcIssuer', SOLID.oidcIssuer)),
inbox: valueAsString(get(jsonLd, 'ldp:inbox', LDP.inbox)),
publicTypeIndex: valueAsString(get(jsonLd, 'solid:publicTypeIndex', SOLID.publicTypeIndex)),
privateTypeIndex: valueAsString(get(jsonLd, 'solid:privateTypeIndex', SOLID.privateTypeIndex)),
preferencesFile: valueAsString(get(jsonLd, 'pim:preferencesFile', 'http://www.w3.org/ns/pim/space#preferencesFile')),
homepage: valueAsString(get(jsonLd, 'foaf:homepage', FOAF.homepage)),

// After:
oidcIssuer: valueAsNodeId(get(jsonLd, 'solid:oidcIssuer', SOLID.oidcIssuer)),
inbox: valueAsNodeId(get(jsonLd, 'ldp:inbox', LDP.inbox)),
publicTypeIndex: valueAsNodeId(get(jsonLd, 'solid:publicTypeIndex', SOLID.publicTypeIndex)),
privateTypeIndex: valueAsNodeId(get(jsonLd, 'solid:privateTypeIndex', SOLID.privateTypeIndex)),
preferencesFile: valueAsNodeId(get(jsonLd, 'pim:preferencesFile', 'http://www.w3.org/ns/pim/space#preferencesFile')),
homepage: valueAsNodeId(get(jsonLd, 'foaf:homepage', FOAF.homepage)),
```

`valueAsNodeId` handles both `{ "@id": "..." }` and string forms, so existing `solid-import` tests remain green.

#### New: `naveditor-lib/src/commands/solid.ts`

```ts
import { fetchWebIdProfile } from '@devalbo/solid-client';
import { parseSolidFetchProfileArgs } from '@/lib/command-args.parser';
import type { AsyncCommandHandler } from './_util';
import { makeResultError, makeResult } from './_util';
import { SolidProfileOutput } from '@/components/output/SolidProfileOutput';

export const solidCommands: Record<'solid-fetch-profile', AsyncCommandHandler> = {
  'solid-fetch-profile': async (args) => {
    const parsed = parseSolidFetchProfileArgs(args);
    if (!parsed.success) {
      return makeResultError(`Usage: solid-fetch-profile <webId>\n${parsed.error}`);
    }

    const result = await fetchWebIdProfile(parsed.value.webId);
    if (!result.ok) {
      return makeResultError(result.error);
    }

    return makeResult(`Profile fetched for ${result.row.name}`, {
      component: SolidProfileOutput,
      props: { id: result.id, row: result.row },
    });
  },
};
```

#### Modified: `naveditor-lib/src/commands/index.ts`

Merge `solidCommands` into the command registry alongside `ioCommands`.

#### Modified: `naveditor-lib/src/lib/command-args.parser.ts`

Add `parseSolidFetchProfileArgs`:

```ts
export const parseSolidFetchProfileArgs = (
  args: string[]
): { success: true; value: { webId: string } } | { success: false; error: string } => {
  const webId = args[0]?.trim();
  if (!webId) return { success: false, error: 'webId is required' };
  if (!webId.startsWith('http://') && !webId.startsWith('https://')) {
    return { success: false, error: 'webId must be an http(s) URL' };
  }
  return { success: true, value: { webId } };
};
```

#### New: `naveditor-lib/src/components/output/SolidProfileOutput.tsx`

Read-only display component following Solid UI Principle 6 (props-in, events-out, no store access):

```tsx
import type { PersonaId, PersonaRowInput } from '@devalbo/shared';

interface SolidProfileOutputProps {
  id: PersonaId;
  row: PersonaRowInput;
}

export const SolidProfileOutput = (props: SolidProfileOutputProps) => (
  <div class="solid-profile-output">
    <div class="solid-profile-output__name">{props.row.name}</div>
    {props.row.email && <div class="solid-profile-output__field">Email: {props.row.email}</div>}
    {props.id && <div class="solid-profile-output__field">WebID: <code>{props.id}</code></div>}
    {props.row.oidcIssuer && <div class="solid-profile-output__field">OIDC Issuer: {props.row.oidcIssuer}</div>}
    {props.row.inbox && <div class="solid-profile-output__field">Inbox: {props.row.inbox}</div>}
  </div>
);
```

#### Modified: `vite.config.ts` (root)

Add the new package alias (must appear before the `@devalbo/shared` catch-all):

```ts
{ find: '@devalbo/solid-client', replacement: resolve(__dirname, 'packages/solid-client/src/index.ts') },
```

#### New: `packages/solid-client/tests/fetch-profile.test.ts`

Unit tests using `vi.spyOn(globalThis, 'fetch')` or a lightweight mock.

### Test Specifications

**Unit tests for `packages/solid-client` (`fetch-profile.test.ts`):**

1. Network error (fetch throws) → `{ ok: false, error starts with "Network error:" }`
2. HTTP 404 response → `{ ok: false, error: "HTTP 404: Not Found" }`
3. Content-type `text/turtle` response → `{ ok: false, error contains "not JSON-LD" }`
4. Valid Shape A JSON-LD (single object) → `{ ok: true, row.name === "Alice" }`
5. Valid Shape B JSON-LD (array) → correct node extracted by `@id`
6. Valid Shape C JSON-LD (`@graph`) → correct node extracted, `@context` inherited
7. Node with `solid:oidcIssuer: { "@id": "https://example.org" }` → `row.oidcIssuer === "https://example.org"`
8. Node without `foaf:name` → `{ ok: false, error contains "missing required foaf:name" }`
9. `@id` not found in document → `{ ok: false, error contains "does not contain a node" }`

**Mapper regression tests (in existing `packages/state` test suite):**

10. `jsonLdToPersonaRow` with `{ "solid:oidcIssuer": { "@id": "https://example.org" } }` → `row.oidcIssuer === "https://example.org"` (new — tests the fix)
11. `jsonLdToPersonaRow` with `{ "solid:oidcIssuer": "https://example.org" }` (string literal) → `row.oidcIssuer === "https://example.org"` (regression — confirms solid-import compatibility)

**Command tests (`naveditor/tests/unit/commands/solid.test.ts`):**

12. `solid-fetch-profile` with no args → `result.error` truthy
13. `solid-fetch-profile` with `"not-a-url"` → `result.error` truthy
14. `solid-fetch-profile` with mocked successful `fetchWebIdProfile` → `result.component` truthy, `result.error` falsy

**BDD scenarios for `ImportCardPanel`:**

```
Scenario: Import from WebID URL (happy path)
  Given ImportCardPanel renders with a webId-bearing contact
  When the user provides a WebID URL as input
  Then the panel calls fetchWebIdProfile and displays the profile for confirmation

Scenario: Import from WebID URL (network failure)
  Given fetchWebIdProfile returns { ok: false, error: "Network error: ..." }
  Then the panel shows the error message
  And does not add a contact to the store
```

### Acceptance Criteria

- [ ] `solid-fetch-profile https://...` executes in naveditor terminal
- [ ] Output renders: name, email (if present), WebID, OIDC issuer (if present), inbox (if present)
- [ ] All 9 `fetch-profile.test.ts` unit tests pass
- [ ] Both mapper regression tests pass (solid-import command still green)
- [ ] All 3 `solid.test.ts` command tests pass
- [ ] Existing 195 tests remain green

---

## L2 — Solid OIDC Authentication

### Goal

Allow the user to authenticate with a Solid OIDC identity provider so that subsequent L3/L4/L5 operations can send DPoP-authorized requests. Authentication state is held in memory for the session; no persistence of tokens to the TinyBase store.

### Library Decision

**Use `@inrupt/solid-client-authn-browser` for browser/Tauri and `@inrupt/solid-client-authn-node` for the Node.js CLI.**

These are the reference implementations and work with CSS, NSS, solidcommunity.net, and ESS. Alternatives:
- Rolling a custom PKCE+DPoP flow — fragile; CSS and NSS have server-specific quirks
- `solid-auth-client` (legacy) — unmaintained, no DPoP support

**Impact on L1:** Zero. L1 uses anonymous `fetch` and does not import the authn library.

### Session Architecture

```ts
// packages/solid-client/src/session.ts
export type SolidSession = {
  webId: string;
  isAuthenticated: boolean;
  fetch: typeof globalThis.fetch;  // DPoP-aware fetch returned by authn library after login
};
```

`SolidSession.fetch` is passed into all L3/L4 functions as a parameter. They do not import the authn library directly. If no session is provided, L3 functions fall back to `globalThis.fetch` (anonymous, read-only access where ACL allows).

### Login Flow by Runtime

```
CLI / terminal:   Solid OIDC device authorization flow (no browser redirect required)
Browser:          Standard PKCE redirect flow (window.location redirect to issuer, callback handled on return)
Tauri:            PKCE redirect via custom URI scheme (requires tauri.conf.json allowlist.protocol entry)
```

**Tauri config note:** The Tauri redirect URI scheme (`devalbo://`) must be registered in `src-tauri/tauri.conf.json` before the Tauri auth flow works. This is a config change, not a code change, but it must be done before L2 Tauri testing.

### Commands Added

```
solid-login <issuer>    Start OIDC login for the given issuer URL
solid-logout            Clear the current session (idempotent)
solid-whoami            Print the WebID of the current session, or "Not logged in"
```

---

## L3 — POD Write / LDP Persister

### Goal

Read and write RDF resources in the user's own Solid POD using LDP. Enables syncing personas, contacts, and groups to the POD.

### `SolidLdpPersister` API

```ts
// packages/solid-client/src/ldp-persister.ts
export class SolidLdpPersister {
  constructor(
    private readonly podRoot: string,
    private readonly fetchFn: typeof globalThis.fetch
  ) {}

  async getPersona(): Promise<PersonaRowInput | null>
  async putPersona(row: PersonaRow, id: PersonaId): Promise<void>
  async listContacts(): Promise<Array<{ id: ContactId; row: ContactRowInput }>>
  async putContact(row: ContactRow, id: ContactId): Promise<void>
  async deleteContact(id: ContactId): Promise<void>
  // groups mirror the contacts API
}
```

### Content Type for Writes

All writes use `Content-Type: application/ld+json` (consistent with existing mappers). Reads use `Accept: application/ld+json`.

### Container Bootstrap

Before writing to `<pod>/contacts/`, probe with `HEAD <pod>/contacts/`. If 404, create the container:

```
POST <pod>/
Slug: contacts
Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"
Content-Type: text/turtle
(empty body)
```

### Critical Pre-L3 Decision: POD Root Discovery

The `SolidLdpPersister` constructor needs a `podRoot` URL. The correct source is `pim:storage` in the WebID profile — not a URL heuristic.

**Action required before L3:** Add `storage: optionalStringCell` to `PersonaRowSchema` in `packages/shared/src/schemas/social.ts` and map `pim:storage` in `jsonLdToPersonaRow` using `valueAsNodeId`. This is additive (defaults to `''`) and does not affect any existing tests.

This addition can be done as a small PR at the start of L3 prep, or as a final step of L1 (it is a one-line schema change and one-line mapper change). It does not require any rework of `fetchWebIdProfile`.

### Pagination

LDP containers may paginate responses via `Link: <next-url>; rel="next"`. The `listContacts()` implementation must follow pagination links until exhausted.

---

## L4 — ActivityPub Delivery

### Goal

Send structured Offer/Create activities to a contact's ActivityPub inbox. Unidirectional; no incoming message processing in this layer.

### Inbox Discovery

ActivityPub inbox URL = `ldp:inbox` from the recipient's WebID profile. L1 already captures this field. No L1 changes required.

Flow for `solid-share-card <contactId>`:
1. Look up contact's `webId` from store
2. Call `fetchWebIdProfile(contact.webId)` — reuse L1 as-is
3. POST an `Offer` activity (JSON-LD, ActivityStreams 2.0 context) to `profile.row.inbox`

### Auth Requirement

Most Solid inbox endpoints enforce ACL — the sender must be authenticated (DPoP token). L4 requires L2. An optional `SolidSession` parameter on the delivery function allows unauthenticated sends to open inboxes.

### Potential Blockers

- **Recipient inbox ACL:** Server may return 401, 403, or 409. Error messages must distinguish these.
- **Missing `ldp:inbox` on contact profile:** `solid-share-card` must fail gracefully with a clear message.
- **ActivityPub vs Solid inbox mismatch:** Rare but possible — some servers serve a different URL for ActivityPub `inbox` vs Solid `ldp:inbox`. Document the assumption and add a fallback error.

**Impact on L1:** Zero.

---

## L5 — TinyBase Bidirectional Sync

### Goal

Keep the local TinyBase store in continuous sync with the user's Solid POD via a custom `SolidLdpSynchronizer`.

### Sync Architecture

```
TinyBase Store ↔ SolidLdpSynchronizer ↔ SolidLdpPersister (L3) ↔ Solid POD
```

The synchronizer subscribes to TinyBase row-change events and calls the L3 persister for writes. For inbound changes, it uses polling (initial implementation) or WebSocket notifications (CSS extension, follow-up).

### Conflict Resolution

Use `dc:modified` timestamps (already in all mappers) for last-write-wins. On write: if POD version has newer `dc:modified`, fetch first, merge, then PUT.

### Potential Blockers

- **TinyBase Synchronizer API:** Verify TinyBase version before L5. The Synchronizer interface changed in TinyBase 5.x.
- **Atomic multi-resource writes:** Updating a contact + their memberships requires two PUT operations with no transaction support. Partial failures require a retry queue.
- **LDP container pagination:** The L3 persister handles this, but the synchronizer's initial-load phase must wait for all pages before marking sync as ready.

**Impact on L1:** Zero. L5 sits entirely on top of L3.

---

## Implementation Order Summary

```
L1  packages/solid-client/src/fetch-profile.ts       (new)
    packages/solid-client/src/index.ts               (new)
    packages/solid-client/package.json               (new)
    packages/state/src/mappers/persona-jsonld.ts     (fix: valueAsNodeId for IRI fields)
    naveditor-lib/src/commands/solid.ts              (new)
    naveditor-lib/src/commands/index.ts              (add solidCommands)
    naveditor-lib/src/lib/command-args.parser.ts     (add parseSolidFetchProfileArgs)
    naveditor-lib/src/components/output/SolidProfileOutput.tsx  (new)
    vite.config.ts                                   (add @devalbo/solid-client alias)
    packages/solid-client/tests/fetch-profile.test.ts  (new)

L2  packages/solid-client/src/session.ts             (new)
    packages/solid-client/src/oidc-login.ts          (new)
    naveditor-lib/src/commands/solid.ts              (add login/logout/whoami)
    src-tauri/tauri.conf.json                        (add protocol allowlist for redirect)

L3  packages/shared/src/schemas/social.ts            (add storage field)
    packages/state/src/mappers/persona-jsonld.ts     (add pim:storage mapping)
    packages/solid-client/src/ldp-persister.ts       (new)
    naveditor-lib/src/commands/solid.ts              (add sync push/pull commands)

L4  packages/solid-client/src/activitypub-delivery.ts  (new)
    naveditor-lib/src/commands/solid.ts              (add solid-share-card)

L5  packages/solid-client/src/ldp-synchronizer.ts   (new)
    packages/state/ (register synchronizer at app startup)
```

No later layer requires reworking files created in an earlier layer. L1 is the smallest shippable increment and carries no rework risk from any L2–L5 decisions.
