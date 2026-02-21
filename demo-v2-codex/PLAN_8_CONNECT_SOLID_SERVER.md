# Plan 8 — From Local-First to Solid-Connected

## Overview

This plan describes the full journey from running naveditor as an in-memory local-first app to a Solid-connected experience where data persists across sessions, synchronises across devices, and enables direct person-to-person card sharing over the decentralised web.

The journey has four phases:

```
Phase 0  Local-first baseline        persona, contacts, groups in memory
Phase 1  Get a Solid POD             sign up at a community server
Phase 2  Connect the app             login, fetch profile, push data
Phase 3  Cross-device sync           open a second browser, pull data
Phase 4  Social card sharing         deliver your card to a contact's inbox
```

Each phase is self-contained. A user can stop after any phase and the app remains functional at that level. Phases 1–4 each unlock meaningfully more capability.

---

## What "Local-First + Solid" Means

**Local-first** means the app works without a server. All data lives in the browser's memory (and later, browser storage). The user owns their data and can export it at any time. The app is useful offline and does not depend on any cloud service.

**Solid** (Social Linked Data) is a W3C specification for personal data pods. A Solid POD is a personal web server that you own and control. Your data lives at a URL you choose, and you decide who has read or write access to it. naveditor stores your persona, contacts, and groups in your POD as linked-data (JSON-LD) resources, under a `devalbo/` container.

The combination means: the app works fully offline, and when you choose to connect to Solid, your data is backed up, synchronised, and shareable — without surrendering it to a platform.

---

## Phase 0 — Local-First Baseline

### What the user does

1. Open the naveditor web app in a browser.
2. Switch to the **People** tab → **D1 Card Exchange**.
3. If no personas exist, the Create Persona form appears automatically. Enter a name (and optionally email, homepage, bio) and click **Create**.
4. Switch to the **Terminal** tab to add contacts and groups:
   ```
   contact add Bob --email bob@example.com
   group create "Close Friends"
   group add-member <groupId> <contactId>
   ```
5. Switch to **D3 Relationship Dashboard** to see the contact tree and group memberships.

### The data problem

TinyBase, the reactive store used throughout the app, has a built-in persister system: a `Persister` reads the store on mount and writes every change back to a storage backend. The app creates the store but **does not attach a persister**, so the store is in-memory only. All data is lost when the tab is closed or the page is refreshed. This is the most important gap between local-first promise and current reality — and it is a one-line wiring change, not an architectural gap.

### Manual save/restore (current workaround)

The app has `solid-export` and `solid-import` terminal commands that bundle all personas, contacts, and groups into a single JSON-LD file:

```
solid-export
```

This downloads `social-data.json` to the user's machine. To restore in a new session:

```
solid-import
```

A file picker appears; select the saved JSON. All personas, contacts, and group memberships are restored.

This is the escape hatch before Solid is connected. It also serves as a portable backup format — the JSON-LD file is standard RDF and can be read by any Solid-aware tool.

### Required software change — local persistence

**Priority: Critical.** The `solid-export`/`solid-import` workflow is too manual for everyday use. The app should transparently persist to `localStorage` so data survives page refreshes without the user doing anything.

TinyBase has a `LocalStoragePersister` that reads on mount and writes on every change. The change is a few lines in `naveditor-web/src/App.tsx`:

```ts
// In App component, after creating the store:
const store = useMemo(() => createDevalboStore(), []);

useEffect(() => {
  const persister = createLocalStoragePersister(store, 'devalbo-store');
  persister.startAutoLoad().then(() => persister.startAutoSave());
  return () => { persister.stopAutoLoad(); persister.stopAutoSave(); };
}, [store]);
```

This requires `createLocalStoragePersister` from `tinybase/persisters/persister-browser`. The package is already a dependency. Until this change is made, users must manually `solid-export` before closing the tab.

---

## Phase 1 — Get a Solid POD

### What a POD is

A Solid POD is a personal HTTPS server that stores your data as linked data resources. You get a WebID — a URL that identifies you on the decentralised web — and a storage root where your apps can read and write data you authorise.

For naveditor, the relevant structure in your POD is:

```
https://username.solidcommunity.net/
  profile/
    card          ← your public WebID profile (managed by the Solid server)
  devalbo/
    persona.jsonld       ← your default persona card
    contacts/
      <contactId>.jsonld ← one file per contact
    groups/
      <groupId>.jsonld   ← one file per group (includes memberships)
```

The `devalbo/` container and everything inside it is created and managed by naveditor. The `profile/card` file is managed by the Solid server and populated when you register.

### Option A — solidcommunity.net (recommended for getting started)

solidcommunity.net is a free community-run Solid server. It requires no infrastructure, no credit card, and no configuration.

**Steps:**

1. Go to **https://solidcommunity.net**
2. Click **Register** and choose a username (e.g. `alice`).
3. Complete registration. Your WebID is now:
   ```
   https://alice.solidcommunity.net/profile/card#me
   ```
4. Your POD storage root is:
   ```
   https://alice.solidcommunity.net/
   ```
5. The OIDC issuer (needed for login) is:
   ```
   https://solidcommunity.net
   ```

**Caveats:** solidcommunity.net runs Node Solid Server (NSS), an older implementation. It is reliable but not actively developed. Data is community-hosted; treat it as a personal backup, not a production service. For production, consider self-hosting (Option B).

### Option B — solidweb.me

solidweb.me is a free alternative that runs Community Solid Server (CSS), a more modern implementation. Registration is similar. Your WebID would be:

```
https://username.solidweb.me/profile/card#me
```

Use issuer `https://solidweb.me` for login.

### Option C — Self-hosted Community Solid Server (for developers)

Community Solid Server (CSS) is the reference open-source implementation. It is Docker-friendly, actively maintained, and the recommended path for production deployments.

**Minimum Docker setup:**

```bash
docker run --name my-solid-server \
  -p 3000:3000 \
  -v $(pwd)/solid-data:/data \
  -e CSS_CONFIG=@css:config/file.json \
  communitysolidserver/community-solid-server:latest
```

This runs CSS at `http://localhost:3000`. Users register at `http://localhost:3000/idp/register/`. WebIDs are `http://localhost:3000/username/profile/card#me`.

**CORS configuration for local development:** By default, CSS allows all origins. For a deployed instance, configure `allowedOrigins` in the CSS config to include the naveditor app's origin. Without this, browser `fetch` calls from the app will be blocked.

**Required naveditor configuration change:** If using a non-standard origin (e.g. `http://localhost:3000`), no code changes are needed — the app derives the POD root from the WebID URL and uses `session.fetch` (DPoP-authenticated) for all requests. CORS headers on the Solid server are the only requirement.

---

## Phase 2 — Connect the App

This phase establishes a Solid session in the browser and synchronises local data to the POD for the first time.

### Step 1 — Log in

**Via the UI (recommended):** The sync bar in the top-right of the app shows a gray dot and "Not connected to Solid" when no session is active. Clicking this label (or either disabled Push/Pull button) opens an inline onboarding panel with three Solid server options and a pre-filled issuer URL input. Select an option or type your issuer URL, then click **Connect**. The browser navigates to the Solid server's login/consent page.

**Via the terminal:**

```
solid-login https://solidcommunity.net
```

Either path triggers the same PKCE redirect flow. After the user authenticates, the server redirects back to the naveditor app with an authorisation code. The `@inrupt/solid-client-authn-browser` library exchanges this for a DPoP-bound access token. From this point, all POD requests use `session.fetch` — a DPoP-authenticated wrapper around `globalThis.fetch`. The sync bar updates to show a green dot + the authenticated WebID host.

To confirm the session in the terminal:

```
solid-whoami
```

This returns the authenticated WebID, e.g. `https://alice.solidcommunity.net/profile/card#me`.

**Connection point:** `solidLogin(issuer)` in `packages/solid-client/src/session.ts` calls `session.login({ oidcIssuer, redirectUrl, clientName })`. The redirect URL is `window.location.href`. On return, `handleIncomingRedirect()` is called (also in `session.ts`), restoring the session from the URL callback parameters. `useSolidSession()` in the React tree then emits the authenticated session to all subscribers, including the `useEffect` in `App.tsx` that starts `SolidLdpSynchronizer`.

### Step 2 — Populate your persona from your WebID profile

Your Solid server populated your WebID profile when you registered. Fetching it maps the profile fields (name, email, inbox, storage, publicTypeIndex, etc.) into your local persona:

```
solid-fetch-profile https://alice.solidcommunity.net/profile/card#me
```

This returns a `PersonaRowInput` displayed in the terminal. It does **not** automatically update your local persona — it is a read-only fetch command. To link your Solid identity to your local persona, the user currently needs to:

1. Note the WebID URL.
2. Manually update their persona's `profileDoc` field:
   ```
   persona edit <personaId> --profileDoc=https://alice.solidcommunity.net/profile/card#me
   ```

**Connection point:** `fetchWebIdProfile` in `packages/solid-client/src/fetch-profile.ts` fetches the WebID document and runs it through `jsonLdToPersonaRow`. The result is returned to the caller; no store mutation happens. The `profileDoc` field on the persona is what `SendCardPanel` uses for the `actorWebId` guard.

**Required software change — post-login profile fetch:** The current flow requires two manual steps (login, then separately fetch-and-edit). A better UX is: after a successful Solid login, automatically call `fetchWebIdProfile(session.webId)` and merge the Solid-specific fields (`inbox`, `storage`, `publicTypeIndex`, `oidcIssuer`, `profileDoc`) into the user's default persona, without overwriting fields they have already set locally (name, email, bio, etc.). This merge could happen inside the `subscribeSolidSession` callback in `session.ts` or in the `useEffect` in `App.tsx` that fires on session change.

### Step 3 — Ensure a default persona exists

`solid-pod-push` and `SolidLdpSynchronizer` both require a default persona (`isDefault: true`) to determine the POD root. If the user created their persona via the D1 GUI using the Plan 7 `CreatePersonaPanel`, the first persona is auto-defaulted. If they only fetched their Solid profile without creating a local persona, they need to:

```
persona set-default <personaId>
```

Or, if no persona exists yet, create one and it will auto-default.

### Step 4 — Push local data to the POD

**Via the UI:** Click the **↑ Push** button in the sync bar. The button shows a loading state and then "✓ Pushed N contacts, M groups" briefly before reverting.

**Via the terminal:**

```
solid-pod-push
```

This:
1. Determines the POD root from `defaultPersona.row.storage` (set by profile fetch) or falls back to `derivePodRootFromWebId(defaultPersona.id)`.
2. Creates the `devalbo/` container if it does not exist (`ensureContainer`).
3. Creates `devalbo/contacts/` and `devalbo/groups/` containers.
4. PUTs `devalbo/persona.jsonld`.
5. PUTs `devalbo/contacts/<id>.jsonld` for each contact.
6. PUTs `devalbo/groups/<id>.jsonld` for each group (including memberships).

All HTTP requests use `session.fetch` (DPoP-authenticated). The Solid server enforces ACL: only the pod owner can write to their own containers by default.

**Connection point:** `SolidLdpPersister` in `packages/solid-client/src/ldp-persister.ts` handles all HTTP operations. `ensureContainer` creates LDP BasicContainers via `POST` with `Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"`. Resources are written via `PUT` with `Content-Type: application/ld+json`.

### Step 5 — Automatic sync takes over

Once the session is authenticated, `App.tsx` starts `SolidLdpSynchronizer`:

```ts
useEffect(() => {
  if (!session?.isAuthenticated) return;
  const sync = new SolidLdpSynchronizer(store, session);
  sync.start();
  return () => sync.stop();
}, [session, store]);
```

From this point:
- **Outbound (local → POD):** Any change to a contact or group row in TinyBase triggers a debounced (1 second) `putContact` or `putGroupJsonLd` call. Deleted rows trigger `deleteContact` or `deleteGroup`.
- **Inbound (POD → local):** Every `pollIntervalMs` (default 30 seconds), `listContacts()` and `listGroups()` are called. If the POD version of a record has a newer `updatedAt` than the local version, the local row is updated (with `_suppressOutbound` set to prevent a write-back loop).

The persona is not continuously synced by `SolidLdpSynchronizer` — it is only synced via explicit `solid-pod-push` / `solid-pod-pull`. This is intentional: the persona file changes rarely and is not a per-row TinyBase resource.

---

## Phase 3 — Cross-Device Sync

This is the proof that Solid is working: open the app in a different browser or on a different device and your data appears.

### Steps

1. Open naveditor in a new browser (or incognito window, or different device).
2. The store is empty on first load.
3. Log in:
   ```
   solid-login https://solidcommunity.net
   ```
4. After redirect, either:
   - Wait up to 30 seconds for the first `SolidLdpSynchronizer` poll to pull contacts and groups automatically, **or**
   - Click **↓ Pull** in the sync bar for an immediate pull, **or**
   - Run immediately in the terminal:
     ```
     solid-pod-pull
     ```
5. All contacts, groups, and the persona appear in the store and in the People UI.

### What `solid-pod-pull` does

1. Calls `persister.getPersona()` → GETs `devalbo/persona.jsonld` → runs through `jsonLdToPersonaRow` → calls `setPersona(store, id, row)`.
2. Calls `persister.listContacts()` → GETs `devalbo/contacts/` container → fetches each member URL → maps through `jsonLdToContactRow` → calls `setContact` for each.
3. Groups are not currently pulled by `solid-pod-pull` (contacts only). Groups are pulled by `SolidLdpSynchronizer`'s poll cycle.

**Connection point:** `jsonLdToPersonaRow` in `packages/state/src/mappers/persona-jsonld.ts` reads the foaf/vcard/solid fields from the stored JSON-LD. `jsonLdToContactRow` in `packages/state/src/mappers/contact-jsonld.ts` reads vcard fields with foaf fallbacks (added in the Plan 8 bug fix for persona-card import).

**Required software change — pull groups and set default persona:**

Two bugs currently exist in the cross-device pull flow:

1. **Groups not pulled by `solid-pod-pull`:** The command only pulls persona and contacts. Groups are only pulled by the synchronizer's poll, which takes up to 30 seconds. `solid-pod-pull` should also call `persister.listGroups()` and `setGroup` for each result.

2. **Pulled persona has `isDefault: false`:** `jsonLdToPersonaRow` hard-codes `isDefault: false` because the JSON-LD serialisation does not include an `isDefault` field (it is a local-only concept — other Solid apps don't know about it). After `solid-pod-pull`, the pulled persona has `isDefault: false`, which means subsequent `solid-pod-push` calls fail with "No default persona set." Fix: in `solid-pod-pull`, after `setPersona(store, persona.id, persona.row)`, check if any default persona exists; if not, call `setDefaultPersona(store, persona.id)`.

Both fixes are in `naveditor-lib/src/commands/solid.ts`, in the `solid-pod-pull` handler.

---

## Phase 4 — Social Card Sharing

With both users connected to Solid, they can exchange contact cards directly over the protocol — no intermediary platform required.

### Scenario: Alice shares her card with Bob

Both Alice and Bob have WebIDs and naveditor connected to their PODs.

**Alice's side:**

1. Alice has Bob as a contact (imported previously — e.g. Bob emailed Alice his WebID URL `https://bob.solidcommunity.net/profile/card#me`).
2. Alice imports Bob into naveditor:
   - In D1, click **+ Import Card**, paste Bob's WebID URL, click **Parse + Add**. The app calls `fetchWebIdProfile(url)` to get Bob's name, email, and inbox.
3. Alice selects Bob in the D1 contact list.
4. The **Send my card via Solid** section appears (Phase 3 of Plan 7). Alice clicks **Send my card**.
5. The app fetches Bob's WebID profile to get his `ldp:inbox` URL.
6. The app POSTs an AS2 `Offer` activity to Bob's inbox, carrying Alice's persona card as the object, authenticated with Alice's DPoP session.

**Connection point:** `deliverCard` in `packages/solid-client/src/activitypub-delivery.ts` constructs:
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Offer",
  "actor": "https://alice.solidcommunity.net/profile/card#me",
  "object": { ...alicePersonaJsonLd },
  "to": "https://bob.solidcommunity.net/profile/card#me"
}
```
and POSTs it to `https://bob.solidcommunity.net/inbox/` with `Content-Type: application/ld+json` and DPoP authentication.

**Bob's side:**

Bob's Solid server received the notification in his inbox. Currently naveditor has no inbox reader — Bob cannot see incoming cards through the UI. This is a known gap (see Required Software Changes below).

**Workaround until inbox reading is implemented:** Alice shares her WebID URL with Bob (out of band — by text message, email, etc.). Bob imports it directly into naveditor via ImportCardPanel by pasting the URL.

### Alternative: Copy/paste card exchange (no Solid required)

Alice's D1 tab shows her persona card as JSON-LD with a **Copy** button. She can paste this JSON anywhere — a chat message, a QR code. Bob pastes it into D1 → **+ Import Card** → **Parse + Add**. This path requires no Solid session on either side.

---

## Required Software Changes (Summary)

Listed in priority order.

### 1 — Local persistence via TinyBase LocalStorage persister (Critical)

**File:** `naveditor-web/src/App.tsx`

The store is in-memory only. Without Solid, every page refresh destroys all data. TinyBase's `LocalStoragePersister` provides automatic, transparent local persistence. This is the single highest-impact change.

**Dependency:** `tinybase/persisters/persister-browser` — already in the monorepo catalog.

### 2 — `solid-pod-pull` must pull groups (Important)

**File:** `naveditor-lib/src/commands/solid.ts`, `solid-pod-pull` handler

Currently only persona and contacts are pulled. Add:
```ts
const groups = await persister.listGroups();
for (const { id, row } of groups) setGroup(options.store, id, row);
```

### 3 — `solid-pod-pull` must set pulled persona as default when none exists (Important)

**File:** `naveditor-lib/src/commands/solid.ts`, `solid-pod-pull` handler

After `setPersona(store, persona.id, persona.row)`, add:
```ts
if (!getDefaultPersona(options.store)) {
  setDefaultPersona(options.store, persona.id);
}
```

### 4 — Post-login profile merge into default persona (Nice to have)

**File:** `naveditor-web/src/App.tsx` or `packages/solid-client/src/session.ts`

After `session.isAuthenticated` becomes true, automatically call `fetchWebIdProfile(session.webId)` and merge Solid-specific fields (`inbox`, `storage`, `publicTypeIndex`, `oidcIssuer`, `profileDoc`) into the default persona without clobbering locally-set fields (name, email, bio). This removes the need for the user to manually run `solid-fetch-profile` and `persona edit`.

### 5 — Inbox reader (Future)

**New feature, not yet planned**

When `deliverCard` delivers Alice's card to Bob's inbox, Bob currently has no way to see it in naveditor. An inbox reader would:
- `GET` the user's `ldp:inbox` container (URL from their WebID profile).
- List incoming `Offer` activities.
- For each one that carries a persona card, offer a one-click "Add as contact" action.

This would complete the social card exchange loop and make the Solid inbox the primary discovery mechanism rather than out-of-band WebID sharing.

---

## Connection Points Reference

| App capability | Entry point | Solid protocol |
|---|---|---|
| Login | `solid-login <issuer>` → `solidLogin()` in `session.ts` | Solid OIDC / PKCE redirect |
| Session state | `useSolidSession()` in React tree | `@inrupt/solid-client-authn-browser` Session |
| Fetch public profile | `solid-fetch-profile <webId>` → `fetchWebIdProfile()` | HTTP GET WebID document (public, no auth) |
| Import contact from WebID | `ImportCardPanel` paste URL path | HTTP GET WebID document |
| Push data to POD | `solid-pod-push` → `SolidLdpPersister` | LDP PUT to `devalbo/` containers |
| Pull data from POD | `solid-pod-pull` → `SolidLdpPersister` | LDP GET container members, GET each resource |
| Live outbound sync | `SolidLdpSynchronizer.start()` → TinyBase `addRowListener` | LDP PUT / DELETE on row change |
| Live inbound sync | `SolidLdpSynchronizer` poll | LDP GET containers, compare `updatedAt` |
| Deliver card to inbox | `solid-share-card <id>` or D1 Send button → `deliverCard()` | AS2 Offer POST to `ldp:inbox` |
| Export to file | `solid-export` | None — local JSON-LD bundle |
| Import from file | `solid-import` | None — local JSON-LD bundle |

---

## Data Ownership and Social Rationale

naveditor's Solid integration is motivated by a specific thesis: **contact data should belong to the person, not the platform.**

In conventional social apps, the platform owns your social graph. You cannot export it, port it, or interact with it outside the app's interfaces. When the platform changes its terms, monetises your data, or shuts down, you lose access.

With Solid:
- Your contacts live at a URL you control (`https://you.solidcommunity.net/devalbo/contacts/`).
- You can point other Solid-aware apps at the same data without re-entering anything.
- Access control is enforced by the Solid server — you decide who can read which resources.
- Card exchange is peer-to-peer: Alice delivers her card directly to Bob's inbox on Bob's server. No intermediary stores the card.
- The data format (JSON-LD with vcard/foaf ontologies) is a W3C standard, not a proprietary schema.

The tradeoff is complexity: Solid requires users to obtain a WebID and understand the concept of a POD. The local-first phase (Phase 0) lets users benefit from the app immediately, without any of that complexity. Solid becomes opt-in infrastructure that upgrades the experience rather than a prerequisite.
