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

**L1, L2, and L3 are fully implementation-ready in this document.** L4–L5 are detailed enough to confirm no rework risk from their decisions.

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

Note: this is a `.ts` file (not `.tsx`), so JSX is not available. Use `createElement` from `react` exactly as `persona.ts` does.

```ts
import { createElement } from 'react';
import { fetchWebIdProfile } from '@devalbo/solid-client';
import { parseSolidFetchProfileArgs } from '@/lib/command-args.parser';
import type { AsyncCommandHandler } from './_util';
import { makeResultError, makeResult } from './_util';
import { SolidProfileOutput } from '@/components/social/output/SolidProfileOutput';

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

    return {
      ...makeResult(`Profile fetched for ${result.row.name}`, { id: result.id, row: result.row }),
      component: createElement(SolidProfileOutput, { id: result.id, row: result.row }),
    };
  },
};
```

The `{ ...makeResult(...), component: createElement(...) }` spread pattern is the established convention (see `persona.ts` lines 63-65, 99-102, 116-118).

#### Modified: `naveditor-lib/src/commands/index.ts`

Add `solidCommands` to the registry. The `CommandName` union is derived via `keyof typeof`, so adding a new record type automatically extends it. Concrete changes:

```ts
// Add import:
import { solidCommands } from './solid';

// Add to CoreCommandName union:
type CoreCommandName =
  | keyof typeof filesystemCommands
  | keyof typeof systemCommands
  | keyof typeof ioCommands
  | keyof typeof solidCommands;   // ← add this line

// Add to baseCommands spread:
const baseCommands = {
  ...filesystemCommands,
  ...systemCommands,
  ...ioCommands,
  ...solidCommands,               // ← add this line
} as const;
```

`solid-fetch-profile` contains a hyphen, which is a valid TypeScript string key and already used by the existing `solid-export` / `solid-import` commands in `ioCommands`.

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

#### New: `naveditor-lib/src/components/social/output/SolidProfileOutput.tsx`

Placed alongside the other social output components (`PersonaDetailOutput.tsx`, `ContactDetailOutput.tsx`, etc.). Uses `Box`/`Text` from `ink` — the same pattern as every other output component. Ink-web renders these to the DOM in browser/desktop contexts.

```tsx
import { Box, Text } from 'ink';
import type { PersonaId, PersonaRow, PersonaRowInput } from '@devalbo/shared';

interface SolidProfileOutputProps {
  id: PersonaId;
  row: PersonaRow | PersonaRowInput;
}

export const SolidProfileOutput: React.FC<SolidProfileOutputProps> = ({ id, row }) => (
  <Box flexDirection="column">
    <Text>{row.name}</Text>
    <Text color="gray">{id}</Text>
    {(row.email ?? '').trim() ? <Text color="gray">{row.email}</Text> : null}
    {(row.oidcIssuer ?? '').trim() ? <Text color="gray">OIDC: {row.oidcIssuer}</Text> : null}
    {(row.inbox ?? '').trim() ? <Text color="gray">Inbox: {row.inbox}</Text> : null}
  </Box>
);
```

Also export from `naveditor-lib/src/components/social/output/index.ts` alongside the other output components.

#### Modified: `vite.config.ts` (root)

Add the new package alias (must appear before the `@devalbo/shared` catch-all):

```ts
{ find: '@devalbo/solid-client', replacement: resolve(__dirname, 'packages/solid-client/src/index.ts') },
```

#### New: `packages/solid-client/tests/fetch-profile.test.ts`

Unit tests using `vi.spyOn(globalThis, 'fetch')` to mock HTTP. The existing `vitest.workspace.ts` already covers `packages/*/tests/**/*.{test,spec}.{ts,tsx}` — no workspace config update needed.

Test file structure (follow the packages/state test pattern for setup):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWebIdProfile } from '../src/fetch-profile';

afterEach(() => vi.restoreAllMocks());

const mockFetch = (body: unknown, options: { status?: number; contentType?: string } = {}) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: options.status ?? 200,
      headers: { 'Content-Type': options.contentType ?? 'application/ld+json' },
    })
  );
};

describe('fetchWebIdProfile', () => {
  // ... tests listed below
});
```

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

Allow the user to authenticate with a Solid OIDC identity provider so that subsequent L3/L4/L5 operations can send DPoP-authorized requests. Session state is held in React context (in-memory); no tokens are persisted to TinyBase.

### Scope for This Layer

**L2 covers browser only.** The web app (`naveditor-web`) uses the standard PKCE redirect flow. Tauri and terminal auth are deferred:

- **Tauri:** The Tauri 2 webview is a full browser — PKCE works the same way in theory, but the `redirectUrl` must be `http://localhost:1420` in dev and `tauri://localhost` in production. Most Solid servers' OIDC config won't allow `tauri://` as a registered redirect URI without manual configuration. Defer Tauri auth to a follow-up task.
- **Terminal (Node.js):** Requires `@inrupt/solid-client-authn-node` and a local HTTP callback server to catch the PKCE response. Defer to a follow-up task. Terminal users can still use `solid-fetch-profile` (L1) and any L3 operations on public POD resources anonymously.

### Library

Add `@inrupt/solid-client-authn-browser` to `pnpm-workspace.yaml` catalog and update `packages/solid-client/package.json`:

```yaml
# pnpm-workspace.yaml catalog addition:
'@inrupt/solid-client-authn-browser': ^2.0.0
```

```json
// packages/solid-client/package.json additions:
"dependencies": {
  "@devalbo/shared": "workspace:*",
  "@devalbo/state": "workspace:*",
  "@inrupt/solid-client-authn-browser": "catalog:"
},
"peerDependencies": {
  "react": "catalog:"
}
```

React is a peer dep (same pattern as `packages/state`) because `session-context.tsx` uses React hooks but the host app supplies React.

### PKCE Redirect Behavior

`solid-login <issuer>` calls `session.login({ oidcIssuer, redirectUrl: window.location.href })`. The authn library immediately redirects `window.location` to the issuer — the promise resolves but the page navigates away before any return value is useful. The shell history is lost on redirect; this is expected OAuth UX. On return, `SolidSessionProvider` calls `handleIncomingRedirect()` to complete auth and update session state.

### Session Architecture

#### New: `packages/solid-client/src/session.ts`

Wraps a module-level `Session` singleton from the authn library. `solidLogin` and `handleIncomingRedirect` both access `window.location` and must guard against Node.js environments (vitest runs tests in Node):

```ts
import { Session } from '@inrupt/solid-client-authn-browser';

const _session = new Session();

export type SolidSession = {
  webId: string;
  isAuthenticated: boolean;
  fetch: typeof globalThis.fetch;  // DPoP-aware fetch for L3/L4 requests
};

export const getSolidSession = (): SolidSession | null => {
  if (!_session.info.isLoggedIn || !_session.info.webId) return null;
  return {
    webId: _session.info.webId,
    isAuthenticated: true,
    fetch: _session.fetch as typeof globalThis.fetch,
  };
};

export const solidLogin = async (issuer: string): Promise<void> => {
  if (typeof window === 'undefined') throw new Error('solid-login requires a browser runtime');
  await _session.login({
    oidcIssuer: issuer,
    redirectUrl: window.location.href,
    clientName: 'naveditor',
  });
};

export const solidLogout = async (): Promise<void> => {
  await _session.logout();
};

export const handleIncomingRedirect = async (): Promise<SolidSession | null> => {
  if (typeof window === 'undefined') return null;
  await _session.handleIncomingRedirect(window.location.href);
  return getSolidSession();
};
```

#### New: `packages/solid-client/src/session-context.tsx`

React context that wraps the session singleton reactively. Placed in `packages/solid-client` (not `naveditor-lib`) so it can be imported by both app packages.

```tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { SolidSession } from './session';
import { getSolidSession, handleIncomingRedirect } from './session';

export const SolidSessionContext = createContext<SolidSession | null>(null);

export const SolidSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SolidSession | null>(() => getSolidSession());

  useEffect(() => {
    // Complete PKCE handshake on page load (handles the post-redirect callback)
    handleIncomingRedirect().then(setSession);
  }, []);

  return (
    <SolidSessionContext.Provider value={session}>
      {children}
    </SolidSessionContext.Provider>
  );
};

export const useSolidSession = (): SolidSession | null => useContext(SolidSessionContext);
```

#### Modified: `packages/solid-client/src/index.ts`

```ts
export * from './fetch-profile';
export * from './session';
export * from './session-context';
```

### Session in Commands

#### Modified: `naveditor-lib/src/commands/_util.tsx`

Add `session` as an optional field to `CommandOptionsBase` and add the `ExtendedCommandOptionsWithSession` type for L3 commands that require auth:

```ts
import type { SolidSession } from '@devalbo/solid-client';

type CommandOptionsBase = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
  session?: SolidSession | null;  // ← add: present when user is logged in
};

// Existing types unchanged:
export type ExtendedCommandOptions = CommandOptionsBase | (CommandOptionsBase & { store: Store });
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: Store };

// New for L3+ commands that require both store and an authenticated session:
export type ExtendedCommandOptionsWithSession = CommandOptionsBase & {
  store: Store;
  session: SolidSession;
};
```

#### Modified: `naveditor-lib/src/components/InteractiveShell.tsx`

Read session from context and pass through to commands:

```ts
// Add at top of ShellContent:
import { useSolidSession } from '@devalbo/solid-client';

function ShellContent(...) {
  const session = useSolidSession();  // ← add
  // ...
  const result = await command(args, {
    ...commandOptions,
    store,
    session,  // ← add: null when not logged in, SolidSession when authenticated
  });
}
```

#### Modified: `naveditor-web/src/App.tsx` and `naveditor-desktop/src/App.tsx`

Wrap with `SolidSessionProvider` so `handleIncomingRedirect` runs on mount and session state is available to the shell:

```tsx
import { SolidSessionProvider } from '@devalbo/solid-client';

// Wrap the outermost element:
return (
  <SolidSessionProvider>
    <StoreContext.Provider value={store}>
      {/* ... existing content unchanged ... */}
    </StoreContext.Provider>
  </SolidSessionProvider>
);
```

### Commands Added

#### Modified: `naveditor-lib/src/commands/solid.ts`

Extend `solidCommands` with three new entries. `solid-login` and `solid-logout` call functions from `packages/solid-client` directly; `solid-whoami` reads session from options.

```ts
import { solidLogin, solidLogout } from '@devalbo/solid-client';
import { parseSolidLoginArgs } from '@/lib/command-args.parser';

// Add to solidCommands Record type: 'solid-fetch-profile' | 'solid-login' | 'solid-logout' | 'solid-whoami'

'solid-login': async (args) => {
  const parsed = parseSolidLoginArgs(args);
  if (!parsed.success) return makeResultError(`Usage: solid-login <issuer>\n${parsed.error}`);
  try {
    // login() redirects the page — awaiting lets any pre-redirect errors surface
    await solidLogin(parsed.value.issuer);
    return makeOutput('Redirecting to login...');
  } catch (err) {
    return makeResultError(`Login failed: ${(err as Error).message}`);
  }
},

'solid-logout': async (_args, options) => {
  await solidLogout();
  return makeOutput('Logged out');
},

'solid-whoami': async (_args, options) => {
  const session = options?.session;
  if (!session?.isAuthenticated) return makeOutput('Not logged in');
  return makeOutput(session.webId);
},
```

#### Modified: `naveditor-lib/src/lib/command-args.parser.ts`

Add `parseSolidLoginArgs`:

```ts
export const parseSolidLoginArgs = (
  args: string[]
): { success: true; value: { issuer: string } } | { success: false; error: string } => {
  const issuer = args[0]?.trim();
  if (!issuer) return { success: false, error: 'issuer is required' };
  if (!issuer.startsWith('http://') && !issuer.startsWith('https://')) {
    return { success: false, error: 'issuer must be an http(s) URL' };
  }
  return { success: true, value: { issuer } };
};
```

### Test Specifications

**Unit tests `packages/solid-client/tests/session.test.ts`:**

The authn library's network round-trips cannot be unit-tested, but session state management can be:

1. `getSolidSession()` returns `null` when session is not logged in
2. `useSolidSession()` hook returns `null` when no provider is present
3. `SolidSessionProvider` renders children without throwing
4. `SolidSessionProvider` calls `handleIncomingRedirect` on mount (mock the function, verify it's called)

**Command tests (add to `naveditor/tests/unit/commands/solid.test.ts`):**

5. `solid-login` with no args → `result.error` truthy
6. `solid-login` with `"not-a-url"` → `result.error` truthy
7. `solid-login` with valid issuer URL → `result.component` truthy, no error (mock `solidLogin` to resolve immediately)
8. `solid-logout` → `result.component` truthy (mock `solidLogout`)
9. `solid-whoami` with `options.session = null` → output contains "Not logged in"
10. `solid-whoami` with mocked session `{ webId: "https://alice.example/", isAuthenticated: true }` → output contains the webId

### Acceptance Criteria

- [ ] `solid-login https://solidcommunity.net` redirects to the OIDC login page in the browser
- [ ] After returning from login, `solid-whoami` prints the authenticated WebID
- [ ] `solid-logout` clears the session; `solid-whoami` returns "Not logged in"
- [ ] All 10 L2 tests pass
- [ ] Existing 210 tests remain green

---

## L3 — POD Write / LDP Persister

### Goal

Read and write the user's personas, contacts, and groups to their Solid POD using LDP. This is the first layer that mutates remote state. Requires L2 (authenticated `SolidSession.fetch`).

### Resource Layout

The app writes to a dedicated `devalbo/` container inside the POD rather than to `profile/card` directly (avoids clobbering the user's existing profile document):

```
<podRoot>/devalbo/                         ← app root container
<podRoot>/devalbo/persona.jsonld           ← user's persona (one per app instance)
<podRoot>/devalbo/contacts/                ← contacts container
<podRoot>/devalbo/contacts/<id>.jsonld     ← individual contact
<podRoot>/devalbo/groups/                  ← groups container
<podRoot>/devalbo/groups/<id>.jsonld       ← individual group
```

`<id>` is `encodeURIComponent(tinybase_row_id)` — safe for all TinyBase ID formats.

### Pre-L3 Schema Addition: `pim:storage`

The `SolidLdpPersister` requires a `podRoot` URL. The canonical source is `pim:storage` in the WebID profile. Add it to the schema and mapper before implementing the persister.

#### Modified: `packages/shared/src/schemas/social.ts`

```ts
export const PersonaRowSchema = z.object({
  // ... existing fields unchanged ...
  preferencesFile: optionalStringCell,
  storage: optionalStringCell,       // ← add: pim:storage POD root URL
  profileDoc: optionalStringCell,
  // ...
});
```

`optionalStringCell` defaults to `''`, so this is non-breaking for all existing rows and tests.

#### Modified: `packages/state/src/mappers/persona-jsonld.ts`

In `jsonLdToPersonaRow`, add after `preferencesFile`:

```ts
storage: valueAsNodeId(get(jsonLd, 'pim:storage', `${NS.pim}storage`)),
```

`NS` is exported from `@devalbo/shared` (`packages/shared/src/vocab/namespaces.ts`) but is not currently imported in `persona-jsonld.ts`. Add it to the existing import:

```ts
// Before:
import { DCTERMS, FOAF, LDP, POD_CONTEXT, SOLID, VCARD, ... } from '@devalbo/shared';

// After:
import { DCTERMS, FOAF, LDP, NS, POD_CONTEXT, SOLID, VCARD, ... } from '@devalbo/shared';
```

Do not add `storage` to `personaToJsonLd` — it is an infrastructure field, not part of the social card export format.

### POD Root Resolution

The `SolidLdpPersister` is constructed with a `podRoot` URL. The command layer derives this from the active persona:

```ts
const podRoot = persona.row.storage || derivePodRootFromWebId(persona.id);
```

The fallback heuristic for `derivePodRootFromWebId`:

```ts
const derivePodRootFromWebId = (webId: string): string => {
  // "https://alice.solidcommunity.net/profile/card#me" → "https://alice.solidcommunity.net/"
  const url = new URL(webId);
  return `${url.origin}/`;
};
```

This heuristic works for all major Solid servers (CSS, NSS, ESS) where the WebID and POD share the same origin. It fails for cases like `https://id.example/alice#me` with POD at `https://pod.example/alice/`. For those cases, `pim:storage` in the fetched profile will provide the correct value (it is populated by L1's mapper fix above).

### `SolidLdpPersister` Implementation

#### New: `packages/solid-client/src/ldp-persister.ts`

```ts
import {
  personaToJsonLd, jsonLdToPersonaRow,
  contactToJsonLd, jsonLdToContactRow,
} from '@devalbo/state';
import type {
  PersonaId, PersonaRow, PersonaRowInput,
  ContactId, ContactRow, ContactRowInput,
  GroupId,
} from '@devalbo/shared';

type FetchFn = typeof globalThis.fetch;
type JsonLdObject = Record<string, unknown>;

const LDP_CONTAINER_LINK = '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"';
const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';

export class SolidLdpPersister {
  private readonly appRoot: string;

  constructor(
    podRoot: string,
    private readonly fetchFn: FetchFn
  ) {
    const base = podRoot.endsWith('/') ? podRoot : `${podRoot}/`;
    this.appRoot = `${base}devalbo/`;
  }

  private resourceUrl(container: string, id: string): string {
    return `${this.appRoot}${container}/${encodeURIComponent(id)}.jsonld`;
  }

  async ensureContainer(name: string): Promise<void> {
    const containerUrl = `${this.appRoot}${name}/`;
    const probe = await this.fetchFn(containerUrl, { method: 'HEAD' });
    if (probe.status === 404) {
      // Ensure appRoot exists first
      const appProbe = await this.fetchFn(this.appRoot, { method: 'HEAD' });
      if (appProbe.status === 404) {
        const parentUrl = this.appRoot.replace(/devalbo\/$/, '');
        await this.fetchFn(parentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/turtle', Slug: 'devalbo', Link: LDP_CONTAINER_LINK },
          body: '',
        });
      }
      await this.fetchFn(this.appRoot, {
        method: 'POST',
        headers: { 'Content-Type': 'text/turtle', Slug: name, Link: LDP_CONTAINER_LINK },
        body: '',
      });
    }
  }

  /**
   * GET an LDP container and return the URLs of its members.
   * Follows Link: <next>; rel="next" pagination headers.
   * LDP containers list member resource URLs via ldp:contains — they do NOT inline member data.
   */
  private async listContainerMembers(containerUrl: string): Promise<string[]> {
    const members: string[] = [];
    let url: string | null = containerUrl;

    while (url) {
      const res = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
      if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
      const body = await res.json() as JsonLdObject;

      // ldp:contains may appear as prefixed or full IRI key, and as a single object or array
      const contains = body['ldp:contains'] ?? body[LDP_CONTAINS];
      for (const member of [contains].flat().filter(Boolean)) {
        const id = typeof member === 'string' ? member : (member as JsonLdObject)['@id'];
        if (typeof id === 'string') members.push(id);
      }

      const link = res.headers.get('link') ?? '';
      url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }

    return members;
  }

  async putPersona(row: PersonaRow, id: PersonaId): Promise<void> {
    const url = `${this.appRoot}persona.jsonld`;
    const body = JSON.stringify(personaToJsonLd(row, id), null, 2);
    const res = await this.fetchFn(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body,
    });
    if (!res.ok) throw new Error(`PUT persona → HTTP ${res.status}`);
  }

  async getPersona(): Promise<{ id: PersonaId; row: PersonaRowInput } | null> {
    const url = `${this.appRoot}persona.jsonld`;
    const res = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET persona → HTTP ${res.status}`);
    return jsonLdToPersonaRow(await res.json() as JsonLdObject);
  }

  async putContact(row: ContactRow, id: ContactId): Promise<void> {
    await this.ensureContainer('contacts');
    const res = await this.fetchFn(this.resourceUrl('contacts', id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(contactToJsonLd(row, id), null, 2),
    });
    if (!res.ok) throw new Error(`PUT contact ${id} → HTTP ${res.status}`);
  }

  async deleteContact(id: ContactId): Promise<void> {
    const res = await this.fetchFn(this.resourceUrl('contacts', id), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`DELETE contact ${id} → HTTP ${res.status}`);
  }

  /**
   * List all contacts by:
   * 1. GETting the container to extract ldp:contains member URLs
   * 2. GETting each member URL individually to retrieve the contact JSON-LD
   */
  async listContacts(): Promise<Array<{ id: ContactId; row: ContactRowInput }>> {
    const containerUrl = `${this.appRoot}contacts/`;
    const probe = await this.fetchFn(containerUrl, { method: 'HEAD' });
    if (probe.status === 404) return [];

    const memberUrls = await this.listContainerMembers(containerUrl);
    const results: Array<{ id: ContactId; row: ContactRowInput }> = [];

    for (const url of memberUrls) {
      const res = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
      if (!res.ok) continue;
      try {
        const parsed = jsonLdToContactRow(await res.json() as JsonLdObject);
        if (parsed.row.name) results.push(parsed as { id: ContactId; row: ContactRowInput });
      } catch { continue; }
    }

    return results;
  }

  /**
   * Write a pre-serialized group JSON-LD document.
   * The caller is responsible for serialization (groupToJsonLd requires a Store for memberships
   * — keeping store access out of the persister).
   */
  async putGroupJsonLd(id: GroupId, jsonLd: JsonLdObject): Promise<void> {
    await this.ensureContainer('groups');
    const res = await this.fetchFn(this.resourceUrl('groups', id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(jsonLd, null, 2),
    });
    if (!res.ok) throw new Error(`PUT group ${id} → HTTP ${res.status}`);
  }

  async deleteGroup(id: GroupId): Promise<void> {
    const res = await this.fetchFn(this.resourceUrl('groups', id), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`DELETE group ${id} → HTTP ${res.status}`);
  }
}
```

#### Modified: `packages/solid-client/src/index.ts`

```ts
export * from './fetch-profile';
export * from './session';
export * from './session-context';
export * from './ldp-persister';
```

### Commands Added

#### Modified: `naveditor-lib/src/commands/solid.ts`

Add `solid-pod-push` and `solid-pod-pull`. These are `SocialCommandHandler` variants requiring both store and session (use `ExtendedCommandOptionsWithSession`).

`hasStore` is a private helper in `io.ts` — define an equivalent inline in `solid.ts` rather than importing across command files:

```ts
import { SolidLdpPersister } from '@devalbo/solid-client';
import { getDefaultPersona, listContacts, listGroups, groupToJsonLd, setContact, setGroup, setPersona } from '@devalbo/state';
import type { ExtendedCommandOptions } from './_util';

// Local type guard — mirrors the one in io.ts
const hasStore = (options?: ExtendedCommandOptions): options is ExtendedCommandOptions & { store: Store } =>
  typeof options === 'object' && options != null && 'store' in options;

// Extend Record type: ... | 'solid-pod-push' | 'solid-pod-pull'

'solid-pod-push': async (_args, options) => {
  if (!options?.session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
  if (!hasStore(options)) return makeResultError('solid-pod-push requires a store');

  const defaultPersona = getDefaultPersona(options.store);
  if (!defaultPersona) return makeResultError('No default persona set. Run: persona set-default <id>');

  const podRoot = defaultPersona.row.storage || derivePodRootFromWebId(defaultPersona.id);
  const persister = new SolidLdpPersister(podRoot, options.session.fetch);

  try {
    await persister.putPersona(defaultPersona.row, defaultPersona.id);
    const contacts = listContacts(options.store);
    for (const { id, row } of contacts) await persister.putContact(row, id);
    const groups = listGroups(options.store);
    // groupToJsonLd requires the store (for memberships) — serialize here, not inside the persister
    for (const { id, row } of groups) await persister.putGroupJsonLd(id, groupToJsonLd(options.store, row, id));
    return makeResult(
      `Pushed to POD: 1 persona, ${contacts.length} contacts, ${groups.length} groups`,
      { podRoot, counts: { contacts: contacts.length, groups: groups.length } }
    );
  } catch (err) {
    return makeResultError((err as Error).message);
  }
},

'solid-pod-pull': async (_args, options) => {
  if (!options?.session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
  if (!hasStore(options)) return makeResultError('solid-pod-pull requires a store');

  const defaultPersona = getDefaultPersona(options.store);
  if (!defaultPersona) return makeResultError('No default persona set.');

  const podRoot = defaultPersona.row.storage || derivePodRootFromWebId(defaultPersona.id);
  const persister = new SolidLdpPersister(podRoot, options.session.fetch);

  try {
    const persona = await persister.getPersona();
    if (persona) setPersona(options.store, persona.id, persona.row);

    const contacts = await persister.listContacts();
    for (const { id, row } of contacts) setContact(options.store, id, row);

    return makeResult(
      `Pulled from POD: ${persona ? 1 : 0} persona, ${contacts.length} contacts`,
      { podRoot, counts: { contacts: contacts.length } }
    );
  } catch (err) {
    return makeResultError((err as Error).message);
  }
},
```

`derivePodRootFromWebId` is a module-level helper in `solid.ts` (not exported):

```ts
const derivePodRootFromWebId = (webId: string): string => {
  try { return `${new URL(webId).origin}/`; } catch { return ''; }
};
```

### Test Specifications

**Unit tests `packages/solid-client/tests/ldp-persister.test.ts`:**

Use the same `mockFetch` pattern from `fetch-profile.test.ts` — `vi.spyOn(globalThis, 'fetch')`.

1. `putContact` → `fetch` called with `PUT`, URL matches `<podRoot>/devalbo/contacts/<encoded-id>.jsonld`, Content-Type is `application/ld+json`
2. `deleteContact` → `fetch` called with `DELETE`, correct URL
3. `deleteContact` with 404 response → does not throw (idempotent)
4. `getPersona` with 404 response → returns `null`
5. `getPersona` with valid JSON-LD response → returns parsed `PersonaRowInput` with correct `name`
6. `listContacts` with 404 container → returns `[]`
7. `listContacts` — container returns `ldp:contains` with two member URLs; each member URL is fetched individually and parsed → returns two contacts
8. `listContacts` with paginated container (two pages via `Link: <next>; rel="next"`) → member URLs from both pages are fetched → all contacts returned
9. `ensureContainer` with HEAD 200 → no POST request made
10. `ensureContainer` with HEAD 404 on container → POST request made for container creation
11. `putPersona` → `fetch` called with `PUT`, URL is `<podRoot>/devalbo/persona.jsonld`
12. `putGroupJsonLd` → `fetch` called with `PUT`, URL matches `<podRoot>/devalbo/groups/<encoded-id>.jsonld`, body is the passed JSON-LD serialized

**Command tests (add to `naveditor/tests/unit/commands/solid.test.ts`):**

12. `solid-pod-push` with no session → `result.error` contains "Not logged in"
13. `solid-pod-push` with session but no default persona → `result.error` contains "No default persona"
14. `solid-pod-push` with session + default persona → persister methods called (mock `SolidLdpPersister`)
15. `solid-pod-pull` with no session → `result.error` contains "Not logged in"

**Mapper tests (add to `packages/state/tests/jsonld-roundtrip.test.ts` or equivalent):**

16. `jsonLdToPersonaRow` with `{ "pim:storage": { "@id": "https://alice.example/" } }` → `row.storage === "https://alice.example/"`

### Acceptance Criteria

- [ ] `solid-pod-push` pushes all contacts and groups to `<podRoot>/devalbo/`
- [ ] `solid-pod-pull` reads them back and merges into the local store
- [ ] All 11 `ldp-persister.test.ts` tests pass
- [ ] All 4 new command tests pass
- [ ] Mapper regression test passes
- [ ] Existing 210 tests remain green

---

## L4 — ActivityPub Delivery

### Goal

Send the user's persona card to a contact's ActivityPub inbox via an AS2 `Offer` activity. Unidirectional — no incoming message processing in this layer.

### Command: `solid-share-card <contactId>`

Command flow:

1. Check session is authenticated — if not, return error
2. Parse `contactId` from args — if missing, return usage error
3. `getContact(store, contactId)` — if absent, return error
4. Check `contact.webId` is non-empty — if absent, return error
5. `fetchWebIdProfile(contact.webId)` → get `row.inbox` — if absent, return error
6. `getDefaultPersona(store)` → build card payload via `personaToJsonLd(persona.row, persona.id)`
7. `deliverCard(row.inbox, persona.id, contact.webId, cardJsonLd, session.fetch)` — if error, return it
8. Return success result

### New: `packages/solid-client/src/activitypub-delivery.ts`

```ts
type FetchFn = typeof globalThis.fetch;
type JsonLdObject = Record<string, unknown>;

export type ActivityPubDeliveryResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * POST an ActivityStreams 2.0 "Offer" activity to the recipient's ldp:inbox.
 * Pass session.fetch as fetchFn for DPoP-authorized requests (required by most Solid servers).
 */
export const deliverCard = async (
  inboxUrl: string,
  actorWebId: string,
  recipientWebId: string,
  cardJsonLd: JsonLdObject,
  fetchFn: FetchFn = globalThis.fetch
): Promise<ActivityPubDeliveryResult> => {
  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Offer',
    actor: actorWebId,
    object: cardJsonLd,
    to: recipientWebId,
  };

  let res: Response;
  try {
    res = await fetchFn(inboxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(activity),
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` };
  }

  if (res.ok) return { ok: true }; // 200, 201, 202 all acceptable
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: `Inbox rejected the request (HTTP ${res.status}). The contact's server may require a trusted sender.`,
    };
  }
  return { ok: false, error: `Delivery failed: HTTP ${res.status}` };
};
```

### Modified: `packages/solid-client/src/index.ts`

```ts
export * from './fetch-profile';
export * from './session';
export * from './session-context';
export * from './ldp-persister';
export * from './activitypub-delivery';   // ← add
```

### Modified: `naveditor-lib/src/lib/command-args.parser.ts`

Add after `parseSolidFetchProfileArgs`:

```ts
export const parseSolidShareCardArgs = (
  args: string[]
): { success: true; value: { contactId: string } } | { success: false; error: string } => {
  const contactId = args[0]?.trim();
  if (!contactId) return { success: false, error: 'contactId is required' };
  return { success: true, value: { contactId } };
};
```

`contactId` is a TinyBase row ID (any non-empty string) — no URL validation needed.

### Modified: `naveditor-lib/src/commands/solid.ts`

Add imports:

```ts
import { fetchWebIdProfile, deliverCard } from '@devalbo/solid-client';
import { getContact, getDefaultPersona, personaToJsonLd } from '@devalbo/state';
import type { ContactId } from '@devalbo/shared';
import { parseSolidShareCardArgs } from '@/lib/command-args.parser';
```

`personaToJsonLd` and `getDefaultPersona` are also used by L3; consolidate into the existing `@devalbo/state` import line. Extend the `solidCommands` Record type to include `'solid-share-card'` and add the handler:

```ts
'solid-share-card': async (args, options) => {
  if (!options?.session?.isAuthenticated)
    return makeResultError('Not logged in. Run: solid-login <issuer>');
  if (!hasStore(options))
    return makeResultError('solid-share-card requires a store');

  const parsed = parseSolidShareCardArgs(args);
  if (!parsed.success)
    return makeResultError(`Usage: solid-share-card <contactId>\n${parsed.error}`);

  const contact = getContact(options.store, parsed.value.contactId as ContactId);
  if (!contact)
    return makeResultError(`Contact not found: ${parsed.value.contactId}`);
  if (!contact.webId)
    return makeResultError('Contact has no WebID — cannot discover inbox');

  const profileResult = await fetchWebIdProfile(contact.webId);
  if (!profileResult.ok)
    return makeResultError(`Could not fetch contact profile: ${profileResult.error}`);
  if (!profileResult.row.inbox)
    return makeResultError("Contact's profile does not list an inbox");

  const defaultPersona = getDefaultPersona(options.store);
  if (!defaultPersona)
    return makeResultError('No default persona set. Run: persona set-default <id>');

  const cardJsonLd = personaToJsonLd(defaultPersona.row, defaultPersona.id);

  const deliveryResult = await deliverCard(
    profileResult.row.inbox,
    defaultPersona.id,       // actorWebId (sender's WebID)
    contact.webId,           // recipientWebId
    cardJsonLd,
    options.session.fetch,   // DPoP-aware fetch from L2 session
  );

  if (!deliveryResult.ok) return makeResultError(deliveryResult.error);
  return makeResult(
    `Card sent to ${contact.name || contact.webId}`,
    { inboxUrl: profileResult.row.inbox }
  );
},
```

Note: `personaToJsonLd` uses `field()` (plain string) for IRI-valued fields such as `oidcIssuer` and `inbox` — correct for the outgoing social card format.

### Test Specifications

**Unit tests: `packages/solid-client/tests/activitypub-delivery.test.ts`** (new)

Use `vi.spyOn(globalThis, 'fetch')` — consistent with `fetch-profile.test.ts`. Use `it.each` for parameterized auth-rejection cases (per `TESTING.md` — parameterized tests).

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { deliverCard } from '../src/activitypub-delivery';

const INBOX = 'https://bob.example/inbox';
const ACTOR = 'https://alice.example/profile#me';
const RECIPIENT = 'https://bob.example/profile#me';
const CARD = { name: 'Alice' };

const mockResponse = (status: number): Response =>
  new Response(null, { status });

afterEach(() => vi.restoreAllMocks());

describe('deliverCard', () => {
  it('1. returns ok:true on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(200));
    expect(await deliverCard(INBOX, ACTOR, RECIPIENT, CARD)).toEqual({ ok: true });
  });

  it('2. returns ok:true on 201', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(201));
    expect(await deliverCard(INBOX, ACTOR, RECIPIENT, CARD)).toEqual({ ok: true });
  });

  it('3. returns ok:true on 202', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(202));
    expect(await deliverCard(INBOX, ACTOR, RECIPIENT, CARD)).toEqual({ ok: true });
  });

  it('4. POSTs to inbox URL with correct AS2 Offer shape', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(201));
    await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe(INBOX);
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams');
    expect(body.type).toBe('Offer');
    expect(body.actor).toBe(ACTOR);
    expect(body.to).toBe(RECIPIENT);
    expect(body.object).toEqual(CARD);
  });

  it.each([401, 403])(
    '5+6. returns descriptive error for auth rejection HTTP %i',
    async (status) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(status));
      const result = await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: string }).error).toContain(String(status));
    }
  );

  it('7. returns error containing status on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(500));
    const result = await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain('500');
  });

  it('8. returns network error message when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connection refused'));
    const result = await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain('connection refused');
  });
});
```

**Command tests (add to `naveditor/tests/unit/commands/solid.test.ts`):**

Extend `vi.hoisted` to also hoist `deliverCardMock`, and add it to the `vi.mock('@devalbo/solid-client')` factory:

```ts
const { fetchWebIdProfileMock, deliverCardMock } = vi.hoisted(() => ({
  fetchWebIdProfileMock: vi.fn<(webId: string) => Promise<ProfileFetchResult>>(),
  deliverCardMock: vi.fn<() => Promise<{ ok: true } | { ok: false; error: string }>>(),
}));

vi.mock('@devalbo/solid-client', () => ({
  fetchWebIdProfile: fetchWebIdProfileMock,
  deliverCard: deliverCardMock,           // ← add
}));
```

Import `createStore` from `'tinybase'` and `setContact`, `setPersona` from `'@devalbo/state'` for store-aware tests. Define shared helpers at the top of the `solid-share-card` describe block:

```ts
// Helper: minimal ContactRow fields required by the schema
const emptyContactRow = {
  name: '', nickname: '', givenName: '', familyName: '',
  email: '', phone: '', image: '', bio: '', homepage: '',
  organization: '', role: '', notes: '', webId: '',
  linkedPersona: '', updatedAt: '',
};
// Helper: minimal PersonaRow for happy-path setup
const alicePersonaRow = {
  name: 'Alice', nickname: '', givenName: '', familyName: '',
  email: '', phone: '', image: '', bio: '', homepage: '',
  oidcIssuer: '', inbox: '', publicTypeIndex: '', privateTypeIndex: '',
  preferencesFile: '', storage: '', profileDoc: '', isDefault: true, updatedAt: '',
};
const emptyProfileRow = {
  name: '', nickname: '', givenName: '', familyName: '',
  email: '', phone: '', image: '', bio: '', homepage: '',
  oidcIssuer: '', inbox: '', publicTypeIndex: '', privateTypeIndex: '',
  preferencesFile: '', profileDoc: '', isDefault: false, updatedAt: '',
};
const mockSession = { isAuthenticated: true, webId: 'https://alice.example/#me', fetch: globalThis.fetch };
```

Tests:

```ts
describe('solid-share-card command', () => {
  it('16. returns error when contactId arg is missing', async () => {
    const store = createStore();
    const result = await commands['solid-share-card']([], { store, session: mockSession });
    expect(result.error).toBeTruthy();
  });

  it('17. returns error when not logged in', async () => {
    const store = createStore();
    const result = await commands['solid-share-card'](['bob-id'], { store, session: null });
    expect(result.error).toContain('Not logged in');
  });

  it('18. returns error when contact not in store', async () => {
    const store = createStore();   // empty store
    const result = await commands['solid-share-card'](['missing-id'], { store, session: mockSession });
    expect(result.error).toContain('Contact not found');
  });

  it('19. returns error when contact has no webId', async () => {
    const store = createStore();
    setContact(store, 'bob-id', { ...emptyContactRow, name: 'Bob', webId: '' });
    const result = await commands['solid-share-card'](['bob-id'], { store, session: mockSession });
    expect(result.error).toContain('no WebID');
  });

  it('20. returns error when profile has no inbox', async () => {
    const store = createStore();
    setContact(store, 'bob-id', { ...emptyContactRow, name: 'Bob', webId: 'https://bob.example/#me' });
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true, id: 'https://bob.example/#me', row: { ...emptyProfileRow, inbox: '' }
    });
    const result = await commands['solid-share-card'](['bob-id'], { store, session: mockSession });
    expect(result.error).toContain('does not list an inbox');
  });

  it('21. calls deliverCard and returns success on happy path', async () => {
    const store = createStore();
    setContact(store, 'bob-id', { ...emptyContactRow, name: 'Bob', webId: 'https://bob.example/#me' });
    setPersona(store, 'https://alice.example/#me' as PersonaId, alicePersonaRow);
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true, id: 'https://bob.example/#me',
      row: { ...emptyProfileRow, inbox: 'https://bob.example/inbox' }
    });
    deliverCardMock.mockResolvedValueOnce({ ok: true });
    const result = await commands['solid-share-card'](['bob-id'], { store, session: mockSession });
    expect(deliverCardMock).toHaveBeenCalledWith(
      'https://bob.example/inbox',
      'https://alice.example/#me',
      'https://bob.example/#me',
      expect.any(Object),
      mockSession.fetch
    );
    expect(result.error).toBeUndefined();
  });
});
```

Tests use real TinyBase stores (`createStore()`) and real `@devalbo/state` accessors — no store-layer mocking needed. Only the network boundary (`@devalbo/solid-client`) is mocked, consistent with the inversion-of-control principle from `TESTING.md`.

### Acceptance Criteria

- [ ] `solid-share-card <contactId>` executes in naveditor terminal
- [ ] All 8 `activitypub-delivery.test.ts` unit tests pass
- [ ] All 6 L4 command tests pass (tests 16–21)
- [ ] Existing tests remain green

### Impact on L1/L2/L3

Zero. L4 reuses `fetchWebIdProfile` (L1) and `session.fetch` (L2) as-is, and adds no modifications to any earlier-layer file.

---

## L5 — TinyBase Bidirectional Sync

### Goal

Keep the local TinyBase store in continuous sync with the user's Solid POD automatically — replacing the need to run explicit `solid-pod-push` / `solid-pod-pull` commands after every change.

### Architecture

```
TinyBase Store ↔ SolidLdpSynchronizer ↔ SolidLdpPersister (L3) ↔ Solid POD
```

**Outbound (store → POD):** `addRowListener(tableId, null, listener)` on `contacts` and `groups`. The listener fires for every row add, change, and delete. On mutation it schedules a debounced flush (1 second). On deletion it also records the row ID in `_pendingDeletes`. The flush PUTs all current rows then DELETEs each pending ID — O(n_changes) network requests, not O(n_total).

**Inbound (POD → store):** Poll every 30 seconds. For each POD contact and group, compare `updatedAt` (ISO 8601 lexicographic) against the local row. Overwrite local only when the POD version is strictly newer. `_suppressOutbound` prevents the inbound `setContact` / `setGroup` calls from triggering an outbound flush.

**Conflict resolution:** Last-write-wins via `updatedAt`. The writer with the higher `updatedAt` wins.

### L5 Persister Extension: `listGroups()`

L5 needs to poll groups inbound, which requires a `listGroups()` method on `SolidLdpPersister`. This is a pure addition to the L3 file — no existing method changes.

#### Modified: `packages/solid-client/src/ldp-persister.ts`

Add to imports (alongside the existing `contactToJsonLd, jsonLdToContactRow`):

```ts
import {
  personaToJsonLd, jsonLdToPersonaRow,
  contactToJsonLd, jsonLdToContactRow,
  jsonLdToGroupRow,   // ← add
} from '@devalbo/state';
import type {
  PersonaId, PersonaRow, PersonaRowInput,
  ContactId, ContactRow, ContactRowInput,
  GroupId, GroupRowInput,               // ← add GroupRowInput
} from '@devalbo/shared';
```

Add method to `SolidLdpPersister` (mirrors `listContacts()` exactly):

```ts
async listGroups(): Promise<Array<{ id: GroupId; row: GroupRowInput }>> {
  const containerUrl = `${this.appRoot}groups/`;
  const probe = await this.fetchFn(containerUrl, { method: 'HEAD' });
  if (probe.status === 404) return [];

  const memberUrls = await this.listContainerMembers(containerUrl);
  const results: Array<{ id: GroupId; row: GroupRowInput }> = [];

  for (const url of memberUrls) {
    const res = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
    if (!res.ok) continue;
    try {
      const parsed = jsonLdToGroupRow(await res.json() as JsonLdObject);
      if (parsed.row.name) results.push(parsed as { id: GroupId; row: GroupRowInput });
    } catch { continue; }
  }

  return results;
}
```

Note: `jsonLdToGroupRow` returns `{ id, row }` where `row` is `GroupRowInput`. Membership data embedded in the JSON-LD (`org:hasMembership`) is not restored to the store by inbound group sync — membership inbound sync is deferred to a follow-up.

### New: `packages/solid-client/src/ldp-synchronizer.ts`

```ts
import type { Id, Store } from 'tinybase';
import {
  getDefaultPersona,
  listContacts as storeListContacts,
  listGroups as storeListGroups,
  groupToJsonLd,
  setContact,
  setGroup,
  CONTACTS_TABLE,
  GROUPS_TABLE,
} from '@devalbo/state';
import type { ContactId, GroupId } from '@devalbo/shared';
import type { SolidSession } from './session';
import { SolidLdpPersister } from './ldp-persister';

const derivePodRootFromWebId = (webId: string): string => {
  try { return `${new URL(webId).origin}/`; } catch { return ''; }
};

export class SolidLdpSynchronizer {
  private readonly persister: SolidLdpPersister;
  private listenerIds: Id[] = [];
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  /** Row IDs deleted from the store since the last flush, keyed by table. */
  private _pendingDeletes = new Map<string, Set<string>>([
    [CONTACTS_TABLE, new Set()],
    [GROUPS_TABLE, new Set()],
  ]);
  /** Set true during inbound updates to prevent outbound flush re-triggering. */
  private _suppressOutbound = false;

  constructor(private readonly store: Store, session: SolidSession) {
    const defaultPersona = getDefaultPersona(store);
    if (!defaultPersona) {
      throw new Error('SolidLdpSynchronizer: no default persona — cannot derive podRoot');
    }
    const podRoot = defaultPersona.row.storage || derivePodRootFromWebId(defaultPersona.id);
    this.persister = new SolidLdpPersister(podRoot, session.fetch);
  }

  start(pollIntervalMs = 30_000): void {
    // addRowListener(tableId, null, listener) fires for any row add, change, or delete
    const contactsId = this.store.addRowListener(
      CONTACTS_TABLE, null,
      (_store, _tableId, rowId) => {
        if (!this.store.hasRow(CONTACTS_TABLE, rowId)) {
          // Row was deleted — record it for the next flush
          this._pendingDeletes.get(CONTACTS_TABLE)!.add(rowId);
        }
        this._scheduleFlush(CONTACTS_TABLE);
      }
    );
    const groupsId = this.store.addRowListener(
      GROUPS_TABLE, null,
      (_store, _tableId, rowId) => {
        if (!this.store.hasRow(GROUPS_TABLE, rowId)) {
          this._pendingDeletes.get(GROUPS_TABLE)!.add(rowId);
        }
        this._scheduleFlush(GROUPS_TABLE);
      }
    );
    this.listenerIds = [contactsId, groupsId];
    this.pollIntervalId = setInterval(() => void this._poll(), pollIntervalMs);
  }

  stop(): void {
    for (const id of this.listenerIds) this.store.delListener(id);
    this.listenerIds = [];
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    for (const timer of this.flushTimers.values()) clearTimeout(timer);
    this.flushTimers.clear();
    this._pendingDeletes.forEach((set) => set.clear());
  }

  private _scheduleFlush(tableId: string, debounceMs = 1_000): void {
    if (this._suppressOutbound) return;
    const existing = this.flushTimers.get(tableId);
    if (existing !== undefined) clearTimeout(existing);
    const id = setTimeout(() => void this._flushTable(tableId), debounceMs);
    this.flushTimers.set(tableId, id);
  }

  private async _flushTable(tableId: string): Promise<void> {
    this.flushTimers.delete(tableId);
    // Swap to a fresh set so new deletes that arrive during async work queue for the next flush
    const pendingDeletes = this._pendingDeletes.get(tableId)!;
    this._pendingDeletes.set(tableId, new Set());
    try {
      if (tableId === CONTACTS_TABLE) {
        for (const { id, row } of storeListContacts(this.store)) {
          await this.persister.putContact(row, id);
        }
        for (const id of pendingDeletes) {
          await this.persister.deleteContact(id as ContactId);
        }
      } else if (tableId === GROUPS_TABLE) {
        for (const { id, row } of storeListGroups(this.store)) {
          // groupToJsonLd requires the store (for memberships) — serialize at call site
          await this.persister.putGroupJsonLd(id, groupToJsonLd(this.store, row, id));
        }
        for (const id of pendingDeletes) {
          await this.persister.deleteGroup(id as GroupId);
        }
      }
    } catch (err) {
      console.warn(`[SolidLdpSynchronizer] outbound flush failed for "${tableId}":`, err);
    }
  }

  private async _poll(): Promise<void> {
    this._suppressOutbound = true;
    try {
      const podContacts = await this.persister.listContacts();
      for (const { id, row } of podContacts) {
        const localRow = this.store.getRow(CONTACTS_TABLE, id);
        const localUpdatedAt = typeof localRow?.updatedAt === 'string' ? localRow.updatedAt : '';
        if (!localUpdatedAt || (row.updatedAt && row.updatedAt > localUpdatedAt)) {
          setContact(this.store, id, row);
        }
      }

      const podGroups = await this.persister.listGroups();
      for (const { id, row } of podGroups) {
        const localRow = this.store.getRow(GROUPS_TABLE, id);
        const localUpdatedAt = typeof localRow?.updatedAt === 'string' ? localRow.updatedAt : '';
        if (!localUpdatedAt || (row.updatedAt && row.updatedAt > localUpdatedAt)) {
          setGroup(this.store, id, row); // note: does not restore memberships — deferred
        }
      }
    } catch (err) {
      console.warn('[SolidLdpSynchronizer] inbound poll failed:', err);
    } finally {
      this._suppressOutbound = false;
    }
  }
}
```

### Modified: `packages/solid-client/src/index.ts`

```ts
export * from './fetch-profile';
export * from './session';
export * from './session-context';
export * from './ldp-persister';
export * from './activitypub-delivery';
export * from './ldp-synchronizer';   // ← add
```

### App Integration

#### Modified: `naveditor-web/src/App.tsx`

Add a `useEffect` that starts the synchronizer when the session becomes authenticated and stops it on logout or unmount. L2 will have already wrapped the tree in `<SolidSessionProvider>`, so `useSolidSession()` is available.

```tsx
// Add to imports:
import { useSolidSession, SolidLdpSynchronizer } from '@devalbo/solid-client';

// Inside App component, after `const store = useMemo(...)`:
const session = useSolidSession();

useEffect(() => {
  if (!session?.isAuthenticated) return;
  let sync: SolidLdpSynchronizer;
  try {
    sync = new SolidLdpSynchronizer(store, session);
    sync.start();
  } catch {
    // No default persona yet — synchronizer will be re-initialized next time session changes
    return;
  }
  return () => sync.stop();
}, [session, store]);
```

The `session` dependency ensures sync restarts on re-login and stops cleanly on logout (when `useSolidSession()` returns `null`).

#### Modified: `naveditor-desktop/src/App.tsx`

Identical changes to `naveditor-web/src/App.tsx`.

### Test Specifications

**Unit tests: `packages/solid-client/tests/ldp-synchronizer.test.ts`** (new)

Use `vi.useFakeTimers()` to control `setTimeout` and `setInterval`. Mock `SolidLdpPersister` via `vi.mock` to avoid network calls.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from 'tinybase';
import { setContact, setPersona, CONTACTS_TABLE } from '@devalbo/state';
import { SolidLdpSynchronizer } from '../src/ldp-synchronizer';
import type { PersonaId } from '@devalbo/shared';

const { persisterMocks } = vi.hoisted(() => ({
  persisterMocks: {
    putContact: vi.fn().mockResolvedValue(undefined),
    listContacts: vi.fn().mockResolvedValue([]),
    deleteContact: vi.fn().mockResolvedValue(undefined),
    putGroupJsonLd: vi.fn().mockResolvedValue(undefined),
    listGroups: vi.fn().mockResolvedValue([]),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
  }
}));

vi.mock('../src/ldp-persister', () => ({
  SolidLdpPersister: vi.fn(() => persisterMocks)
}));

const ALICE_ID = 'https://alice.example/#me' as PersonaId;
const alicePersona = {
  name: 'Alice', nickname: '', givenName: '', familyName: '',
  email: '', phone: '', image: '', bio: '', homepage: '',
  oidcIssuer: '', inbox: '', publicTypeIndex: '', privateTypeIndex: '',
  preferencesFile: '', storage: 'https://alice.example/', profileDoc: '',
  isDefault: true, updatedAt: '2024-01-01T00:00:00Z'
};
const mockSession = { isAuthenticated: true as const, webId: ALICE_ID, fetch: globalThis.fetch };

const emptyContact = {
  name: '', nickname: '', givenName: '', familyName: '',
  email: '', phone: '', image: '', bio: '', homepage: '',
  organization: '', role: '', notes: '', webId: '',
  linkedPersona: '', updatedAt: ''
};

describe('SolidLdpSynchronizer', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    setPersona(store, ALICE_ID, alicePersona);
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. throws when store has no default persona', () => {
    const emptyStore = createStore();
    expect(() => new SolidLdpSynchronizer(emptyStore, mockSession)).toThrow(/no default persona/i);
  });

  it('2. start() registers two row listeners (contacts, groups)', () => {
    const spy = vi.spyOn(store, 'addRowListener');
    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(CONTACTS_TABLE, null, expect.any(Function));
    sync.stop();
  });

  it('3. stop() removes all registered listeners', () => {
    const spy = vi.spyOn(store, 'delListener');
    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start();
    sync.stop();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('4. contact mutation triggers putContact after 1s debounce', async () => {
    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start();

    setContact(store, 'bob-id', { ...emptyContact, name: 'Bob' });
    expect(persisterMocks.putContact).not.toHaveBeenCalled(); // not yet — debounced

    await vi.runAllTimersAsync();
    expect(persisterMocks.putContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bob' }),
      'bob-id'
    );
    sync.stop();
  });

  it('5. contact deletion triggers deleteContact after 1s debounce', async () => {
    setContact(store, 'bob-id', { ...emptyContact, name: 'Bob' });
    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start();

    store.delRow(CONTACTS_TABLE, 'bob-id');
    expect(persisterMocks.deleteContact).not.toHaveBeenCalled(); // not yet — debounced

    await vi.runAllTimersAsync();
    expect(persisterMocks.deleteContact).toHaveBeenCalledWith('bob-id');
    sync.stop();
  });

  it('6. poll updates local row when POD updatedAt is newer', async () => {
    setContact(store, 'bob-id', { ...emptyContact, name: 'Bob Old', updatedAt: '2024-01-01T00:00:00Z' });
    persisterMocks.listContacts.mockResolvedValueOnce([{
      id: 'bob-id',
      row: { ...emptyContact, name: 'Bob New', updatedAt: '2024-06-01T00:00:00Z' }
    }]);

    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start(10_000);
    await vi.advanceTimersByTimeAsync(10_001);

    expect(store.getRow(CONTACTS_TABLE, 'bob-id').name).toBe('Bob New');
    sync.stop();
  });

  it('7. poll does not overwrite local row when local updatedAt is newer', async () => {
    setContact(store, 'bob-id', { ...emptyContact, name: 'Bob Local', updatedAt: '2024-12-01T00:00:00Z' });
    persisterMocks.listContacts.mockResolvedValueOnce([{
      id: 'bob-id',
      row: { ...emptyContact, name: 'Bob Pod', updatedAt: '2024-01-01T00:00:00Z' }
    }]);

    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start(10_000);
    await vi.advanceTimersByTimeAsync(10_001);

    expect(store.getRow(CONTACTS_TABLE, 'bob-id').name).toBe('Bob Local'); // unchanged
    sync.stop();
  });

  it('8. inbound setContact does not trigger outbound putContact (suppress flag)', async () => {
    persisterMocks.listContacts.mockResolvedValueOnce([{
      id: 'bob-id',
      row: { ...emptyContact, name: 'Bob', updatedAt: '2099-01-01T00:00:00Z' }
    }]);

    const sync = new SolidLdpSynchronizer(store, mockSession);
    sync.start(10_000);
    await vi.advanceTimersByTimeAsync(10_001); // trigger poll

    // Poll wrote bob-id to store, but _suppressOutbound prevented outbound flush
    expect(persisterMocks.putContact).not.toHaveBeenCalled();
    sync.stop();
  });
});
```

### Design Notes

**Why `addRowListener` instead of `addTableListener` for deletion tracking?** `addTableListener` fires when the table content changes but doesn't identify which row changed. To reconcile deletions using `addTableListener`, the flush must call `persister.listContacts()` — which is a container GET plus one GET per member URL (O(n) requests per flush). With `addRowListener(tableId, null, listener)`, the listener receives the specific `rowId` and can check `store.hasRow` to detect deletions. The flush then issues only targeted `deleteContact(id)` calls for the rows that were actually removed.

**`_pendingDeletes` drain pattern:** At the start of `_flushTable`, `_pendingDeletes` is swapped to a fresh `Set`. Any new deletions that arrive during the async flush are captured in the new set and handled on the next flush, avoiding races.

**Inbound membership sync is deferred:** `setGroup(store, id, row)` restores the group row but not memberships (which are stored in a separate `memberships` table). To restore memberships, `extractMembershipsFromGroupJsonLd` and `setMembership` would be needed for each group. This is a targeted follow-up — outbound group sync already captures memberships correctly via `groupToJsonLd`.

**Why not TinyBase `Persister` interface?** TinyBase 7.x's `Persister` interface is designed for full-store serialization (IndexedDB, SQLite). Solid LDP is per-resource HTTP — no single "load all / save all" maps to TinyBase's persister lifecycle. A plain class fits the actual semantics.

**Persona sync:** The synchronizer derives `podRoot` from the default persona but does not sync personas in the background. Use `solid-pod-push` / `solid-pod-pull` (L3) for explicit persona sync.

### Acceptance Criteria

- [ ] `SolidLdpSynchronizer.start()` registers row listeners on contacts and groups tables
- [ ] A contact mutation is pushed to the POD after the 1-second debounce
- [ ] A contact deleted from the store triggers `deleteContact` on the POD (no container GET needed)
- [ ] A group deleted from the store triggers `deleteGroup` on the POD
- [ ] Inbound poll overwrites stale local contacts and groups (POD `updatedAt` strictly greater)
- [ ] Inbound poll does not overwrite newer local data
- [ ] Inbound updates do not trigger a redundant outbound flush
- [ ] All 8 `ldp-synchronizer.test.ts` tests pass
- [ ] Sync starts automatically on login in `naveditor-web` and `naveditor-desktop`
- [ ] Sync stops cleanly on logout and on component unmount
- [ ] Existing tests remain green

### Impact on Earlier Layers

`packages/solid-client/src/ldp-persister.ts` (L3) gains one new method (`listGroups`) and two new imports (`jsonLdToGroupRow`, `GroupRowInput`). This is purely additive — no existing method signatures or behavior changes.

---

## Implementation Order Summary

```
L1  packages/solid-client/src/fetch-profile.ts                     (new — DONE)
    packages/solid-client/src/index.ts                             (new — DONE)
    packages/solid-client/package.json                             (new — DONE)
    packages/state/src/mappers/persona-jsonld.ts                   (fix: valueAsNodeId — DONE)
    naveditor-lib/src/commands/solid.ts                            (new — DONE)
    naveditor-lib/src/commands/index.ts                            (add solidCommands — DONE)
    naveditor-lib/src/lib/command-args.parser.ts                   (add parseSolidFetchProfileArgs — DONE)
    naveditor-lib/src/components/social/output/SolidProfileOutput.tsx  (new — DONE)
    naveditor-lib/src/components/social/output/index.ts            (add export — DONE)
    vite.config.ts                                                 (add @devalbo/solid-client alias — DONE)
    packages/solid-client/tests/fetch-profile.test.ts              (new — DONE)

L2  pnpm-workspace.yaml                                            (add @inrupt/solid-client-authn-browser to catalog)
    packages/solid-client/package.json                             (add authn-browser dep; add react peerDep)
    packages/solid-client/src/session.ts                           (new)
    packages/solid-client/src/session-context.tsx                  (new)
    packages/solid-client/src/index.ts                             (add exports)
    naveditor-lib/src/commands/_util.tsx                           (add session to options; add ExtendedCommandOptionsWithSession)
    naveditor-lib/src/commands/solid.ts                            (add solid-login, solid-logout, solid-whoami)
    naveditor-lib/src/lib/command-args.parser.ts                   (add parseSolidLoginArgs)
    naveditor-lib/src/components/InteractiveShell.tsx              (read session from context, pass to commands)
    naveditor-web/src/App.tsx                                      (wrap with SolidSessionProvider)
    naveditor-desktop/src/App.tsx                                  (wrap with SolidSessionProvider)
    packages/solid-client/tests/session.test.ts                    (new)
    naveditor/tests/unit/commands/solid.test.ts                    (add L2 command tests)

L3  pnpm-workspace.yaml catalog                                    (no new deps — uses L2's authn-browser for fetch)
    packages/shared/src/schemas/social.ts                          (add storage field to PersonaRowSchema)
    packages/state/src/mappers/persona-jsonld.ts                   (add pim:storage mapping)
    packages/solid-client/src/ldp-persister.ts                     (new)
    packages/solid-client/src/index.ts                             (add export)
    naveditor-lib/src/commands/solid.ts                            (add solid-pod-push, solid-pod-pull)
    packages/solid-client/tests/ldp-persister.test.ts              (new)
    naveditor/tests/unit/commands/solid.test.ts                    (add L3 command tests)

L4  packages/solid-client/src/activitypub-delivery.ts              (new)
    packages/solid-client/src/index.ts                             (add export)
    naveditor-lib/src/lib/command-args.parser.ts                   (add parseSolidShareCardArgs)
    naveditor-lib/src/commands/solid.ts                            (add solid-share-card)
    packages/solid-client/tests/activitypub-delivery.test.ts       (new)
    naveditor/tests/unit/commands/solid.test.ts                    (add L4 command tests, tests 16–21)

L5  packages/solid-client/src/ldp-persister.ts                     (add listGroups method)
    packages/solid-client/src/ldp-synchronizer.ts                  (new)
    packages/solid-client/src/index.ts                             (add export)
    naveditor-web/src/App.tsx                                      (start synchronizer on login)
    naveditor-desktop/src/App.tsx                                  (start synchronizer on login)
    packages/solid-client/tests/ldp-synchronizer.test.ts           (new)
```

No later layer requires changing the behavior or signature of anything created in an earlier layer.
