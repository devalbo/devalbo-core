# Plan 9: Filesystem ↔ Solid Pod Sync

## Context

The app currently has two independent sync layers:

```
Real Filesystem ↔ (driver + watcher) ↔ TinyBase [entries, buffers]
                                               ↕  ← no connection
Solid Pod (/devalbo/) ↔ (SolidLdpSynchronizer) ↔ TinyBase [personas, contacts, groups]
```

The file editor is **local-only**. The Solid integration only handles social data (persona, contacts, groups) stored as JSON-LD under `{podRoot}/devalbo/`.

This plan closes the gap: it lets a user opt in to syncing their files to their Solid pod, round-trip back to a fresh device, and work offline with changes flushed when reconnected.

### What exists today (reusable)

- **`IFilesystemDriver`**: `readFile`, `writeFile`, `readdir`, `stat`, `mkdir`, `rm`, `exists` — works identically across browser (BrowserStoreFSDriver), desktop (TauriFSDriver), and Node.
- **`IWatcherService`**: emits `WatchEvent` (Created/Modified/Deleted) for any local path.
- **`SolidLdpPersister`**: already implements `ensureContainer`, paginated `listContainerMembers`, PUT/GET/DELETE for individual resources. The exact same pattern will work for arbitrary files.
- **`SolidLdpSynchronizer`**: live bidirectional sync with debounced outbound writes and polling inbound — the model to follow for file sync.
- **Terminal shell**: already has a command registry and interactive shell. File sync operations and sync root management will be exposed as first-class CLI commands alongside the existing `solid-*` commands.
- **SolidSyncBar**: already handles authentication and onboarding.

---

## App Configuration

Several values are currently hardcoded throughout the codebase and should be unified into a typed configuration object set once at app startup:

| Hardcoded value | Location | Should come from |
|---|---|---|
| `'devalbo-store'` | `App.tsx` (`createLocalPersister`) | `config.storageKey` |
| `'devalbo/'` | `SolidLdpPersister` constructor | `config.podNamespace` |
| `'devalbo naveditor'` | `solidLogin` call | `config.appName` |
| `30_000` ms poll interval | `SolidLdpSynchronizer` | `config.sync.social.pollIntervalMs` |
| `1_000` ms debounce | `SolidLdpSynchronizer` | `config.sync.social.outboundDebounceMs` |
| `devalbo/files/` | File sync (this plan) | derived from `config.podNamespace` + `config.sync.files.*` |
| *(implicit)* reserved social path | `files-root-add` guard | `config.socialLocalPath` |

### `AppConfig` type

Defined in `packages/shared/src/app-config.ts`:

```ts
export type AppConfig = {
  // Identity
  // appId: stable machine identifier used in storage keys and pod paths (e.g. 'naveditor').
  // appName: human-readable display name used in UI headers and as the OAuth client_name
  //          passed to solidLogin. May differ from appId if the product is ever rebranded.
  appId: string;
  appName: string;

  // Local storage key for the TinyBase persister (e.g. 'devalbo-store').
  // Convention: `${appId}-store`, but explicit so it can be overridden without changing appId.
  storageKey: string;

  // LDP container name directly under the user's pod root.
  // Social data:        {podRoot}/{podNamespace}/
  // File containers:    {podRoot}/{podNamespace}/files/
  // Sync roots manifest:{podRoot}/{podNamespace}/sync-roots-manifest.json
  // Convention: same as appId, but explicit for the same reason as storageKey.
  podNamespace: string;

  // Reserved local path prefix for social data (persona, contacts, groups).
  // File sync roots may not overlap with this path.
  // Future: contacts/groups may be exposed as read-only JSON-LD files here.
  // Default: '/_social/'
  socialLocalPath: string;

  // Sync behaviour — social and file sync are tuned separately because file writes
  // are heavier and have different latency requirements than contact/group updates.
  sync: {
    social: {
      pollIntervalMs: Milliseconds;       // default 30_000 — matches current hardcoded value
      outboundDebounceMs: Milliseconds;   // default 1_000 — matches current hardcoded value
    };
    files: {
      pollIntervalMs: Milliseconds;       // default 30_000
      outboundDebounceMs: Milliseconds;   // default 1_500 — heavier than social writes
      maxFileSizeBytes: ByteCount;        // warn before uploading files larger than this; default 5 MB
    };
  };

  // Feature flags — lets the same library be deployed with different capabilities.
  features: {
    socialSync: boolean;   // enable SolidLdpSynchronizer for contacts/groups (default true)
    fileSync: boolean;     // enable filesystem ↔ pod sync (this plan; default false until stable)
    fileSharing: boolean;  // enable ACL-based file sharing with contacts (stretch goal; default false)
  };
};
```

### Two levels of configuration

**App-level config** (set by the developer, static per deployment):
The `AppConfig` object above. Provided at app startup via a React context (`AppConfigProvider` in `packages/state/src/hooks/`) and as a constructor parameter to synchronizers and persisters. The context lives in `@devalbo/state` alongside `StoreContext` for consistency.

**User-level config** (set by the user at runtime, persisted in TinyBase):
Sync roots (`sync_roots` table) and UI preferences. These are data in the store — they change during a session and survive page reloads via `createLocalPersister`.

### Default config for this app

`naveditor-web/src/config.ts` (mirrored in `naveditor-desktop`):

```ts
import type { AppConfig } from '@devalbo/shared';
import { MillisecondsSchema, ByteCountSchema } from '@devalbo/shared';

const ms = (n: number) => MillisecondsSchema.parse(n);
const bytes = (n: number) => ByteCountSchema.parse(n);

export const defaultAppConfig: AppConfig = {
  appId: 'naveditor',
  appName: 'naveditor',
  storageKey: 'devalbo-store',
  podNamespace: 'devalbo',
  socialLocalPath: '/_social/',
  sync: {
    social: { pollIntervalMs: ms(30_000), outboundDebounceMs: ms(1_000) },
    files:  { pollIntervalMs: ms(30_000), outboundDebounceMs: ms(1_500), maxFileSizeBytes: bytes(5 * 1024 * 1024) }
  },
  features: { socialSync: true, fileSync: false, fileSharing: false }
};
```

### How config flows

```
naveditor-web/src/config.ts
        ↓
  App.tsx: <AppConfigProvider config={defaultAppConfig}>
                ↓
    createLocalPersister(store, config.storageKey)
    SolidLdpPersister(podRoot, config.podNamespace, session.fetch)
    solidLogin(issuer, { clientName: config.appName })
    SolidLdpSynchronizer(store, session, config.sync.social)
    SolidLdpFileSynchronizer(root, allRoots, session, store, driver, watcher, config.sync.files, connectivity)
    files-root-add: guard against podUrl inside {podNamespace}/ but outside {podNamespace}/files/
    files-root-add: guard against localPath overlapping config.socialLocalPath
```

`SolidLdpPersister` receives `podNamespace` and builds its `appRoot` as `{podRoot}/{podNamespace}/`. All subsequent paths (`persona.jsonld`, `contacts/`, `groups/`, `files/`, `sync-roots-manifest.json`) are relative to that namespace.

---

## Goals

1. **Local-first, opt-in cloud**: files stay local by default; the user explicitly enables pod sync.
2. **Round-trip fidelity**: uploading to a pod and pulling on another device produces an identical local filesystem.
3. **Offline-capable**: mutations while offline are queued and flushed when connectivity returns.
4. **Conflict-safe**: the same file modified locally and on the pod does not silently lose data.
5. **Multiple sync root points**: different local directory subtrees can sync to different pod containers, and potentially to different Solid accounts. No assumption that the entire local filesystem maps to a single pod URL.
6. **CLI-first management**: all sync root operations and manual sync actions are available as terminal commands with explicit arguments. The UI surfaces the same operations but does not gate them.
7. **Foundation for sharing**: ACL-based sharing of individual files or directories with contacts (addressed as a stretch goal at the end).

---

## Sync Root Points

A **sync root** is a named pairing of a local directory path and a pod container URL. It is the fundamental unit of the file sync system.

```
sync root:  { localPath: '/work/',     podUrl: 'https://alice.solidcommunity.net/projects/work/files/' }
sync root:  { localPath: '/personal/', podUrl: 'https://alice.solidweb.me/devalbo/files/personal/' }
sync root:  { localPath: '/shared/',   podUrl: 'https://bob.example/shared-with-alice/files/',  readonly: true }
```

- Every file belongs to **at most one** sync root — roots must be mutually non-overlapping (enforced at add time and at synchronizer construction).
- A sync root can point to **any pod URL**, including a container on a different Solid account than the one used for identity/social data.
- A sync root can be marked **read-only** — the synchronizer will pull changes from the pod but never push. Useful for folders shared by another user.
- Sync roots are independent: a failure or conflict in one root does not affect others.
- A local path not covered by any sync root is never synced.

### Path resolution

Roots must be mutually non-overlapping (enforced by `files-root-add` and the synchronizer constructor — see below). Given a valid set of roots, any file path is covered by **at most one** root:

```
root A: localPath='/work/'
root B: localPath='/personal/'
```

1. Find the unique root whose `localPath` is a prefix of the file path. Because `localPath` always ends with `/`, `startsWith` is segment-boundary-safe — `/work/` will never falsely match `/workbench/x`. At most one enabled root matches; if none match, the file is untracked.
2. Relative path: strip `localPath` prefix → `project/src/index.ts`.
3. Pod URL: append each path segment (individually percent-encoded) to `root.podUrl`.

A **path resolution utility** handles this:

```ts
// packages/solid-client/src/sync-root-resolver.ts
// (SyncRoot type is defined in @devalbo/shared — see Architecture)

// Find the most specific enabled root that covers localPath. Returns null if none match.
export const findSyncRoot = (localPath: AbsolutePath, roots: SyncRoot[]): SyncRoot | null

// Convert a local absolute path to its pod URL using the given root.
// Splits the relative path by '/', percent-encodes each segment individually,
// then rejoins with '/' — never encodes the separator itself.
export const localPathToPodUrl = (localPath: AbsolutePath, root: SyncRoot): PodUrl

// Convert a pod resource URL back to a local absolute path using the given root.
// Returns null if the URL is not under root.podUrl.
export const podUrlToLocalPath = (podUrl: PodUrl, root: SyncRoot): AbsolutePath | null
```

### No overlapping roots — construction-time validation

`SolidLdpFileSynchronizer` receives the full `allRoots` list and, at construction time, checks whether any other root's `localPath` is a prefix of `root.localPath` or vice versa. If a conflict is found the constructor throws immediately rather than attempting runtime routing:

```ts
// In constructor, before any other setup:
const conflicts = allRoots.filter(r =>
  r.id !== root.id && (
    r.localPath.startsWith(root.localPath) ||
    root.localPath.startsWith(r.localPath)
  )
);
if (conflicts.length > 0) {
  const detail = conflicts.map(r => `"${r.id}" at "${r.localPath}"`).join(', ');
  console.error(
    `[SolidLdpFileSynchronizer] root "${root.id}" (${root.localPath}) ` +
    `conflicts with: ${detail}. This synchronizer will not start.`
  );
  throw new Error(`SyncRoot conflict: ${root.id}`);
}
```

The calling code (AppContent's `useEffect`) wraps each constructor call in a try/catch and skips roots whose synchronizer fails to construct. Conflicting roots appear in `files-root-list` as registered (their data is preserved) but their synchronizers never start; the UI marks them `⚠ conflict`.

Because the constructor validates no overlap exists, the watcher handler needs no runtime path-routing logic — any event under `root.localPath` belongs unambiguously to this root.

**Overlap detection is also enforced at add time**: `files-root-add` calls `findRootConflicts([...existing, newRoot])` and errors before saving if any pair overlaps. A sync root can only be created if it is non-overlapping with all existing roots. This makes the construction-time check a safety net for state that somehow reached the store inconsistently, not the primary gate.

`findRootConflicts` is defined in `sync-root-resolver.ts` alongside the existing path utilities:

```ts
// Returns every pair [a, b] where a.localPath and b.localPath overlap (one is a prefix of the other).
export const findRootConflicts = (roots: SyncRoot[]): Array<[SyncRoot, SyncRoot]>
```

---

## CLI Commands

All sync root operations and manual sync actions are available as terminal commands. This makes them scriptable, testable without the UI, and usable on headless/desktop deployments.

Commands follow the same pattern as the existing `solid-*` commands and are registered in `naveditor-lib/src/commands/`.

### Sync root management

```
files-root-add <localPath> <podUrl> [--label <label>] [--readonly] [--web-id <webId>]
```
Adds a new sync root. Both positional arguments are **required** — the user must explicitly choose where files live locally and where they go on the pod. `localPath` must be an absolute POSIX-canonical path ending with `/`. `podUrl` must be a full URL ending with `/`. Both are validated; if the user omits the trailing slash the command errors rather than silently normalizing (the user must re-run with the correct argument). `--web-id` defaults to the active session's WebID.

**Overlap validation errors** (canonical messages):

- Missing trailing slash:
  `Error: localPath "/work" must end with "/". Did you mean "/work/"?`
- `localPath` is a prefix of an existing root (new root would contain an existing one):
  `Error: localPath "/work/" would contain existing root "Work Projects" ("/work/project/"). Sync roots must not overlap. Choose a path that does not contain or extend any existing root.`
- `localPath` is inside an existing root (existing root is a prefix of the new one):
  `Error: localPath "/work/project/" is inside existing root "Work" ("/work/"). Sync roots must not overlap. Choose a path outside "/work/", or remove that root first.`
- `podUrl` inside the social namespace:
  `Error: podUrl "https://alice.solidcommunity.net/devalbo/contacts/" overlaps with the app's social data namespace. Use "https://alice.solidcommunity.net/devalbo/files/" (or a sub-container) for file sync, or a container outside "https://alice.solidcommunity.net/devalbo/" entirely.`

```
files-root-list
```
Lists all sync roots with their id, label, localPath, podUrl, enabled status, and per-root pending/conflict counts.

```
files-root-enable <rootId>
files-root-disable <rootId>
```
Enables or disables a root without deleting it. A disabled root's synchronizer is stopped; its `file_sync_state` rows are preserved.

```
files-root-remove <rootId> <keep-pod|delete-from-pod>
```
Removes a sync root record. The second argument is **required** and controls what happens to the pod copy:
- `keep-pod` — removes the root record and all associated `file_sync_state` rows locally. Files remain on both the local filesystem and the pod, untracked.
- `delete-from-pod` — additionally deletes every resource in the root's `podUrl` container from the pod before removing the local record. Requires write access to the pod.

Both options leave local files untouched.

### Manual sync operations

```
files-push [--root <rootId>]
```
Pushes all local files to the pod for the specified root, or all enabled roots if `--root` is omitted. Reports count of uploaded files per root.

```
files-pull [--root <rootId>]
```
Pulls all files from the pod for the specified root, or all enabled roots if `--root` is omitted. Downloads only files newer than the local copy or not present locally. Reports count of downloaded files per root.

```
files-status [--root <rootId>]
```
Shows sync status for the specified root, or all roots. Lists per-file status (synced ✓ / pending ↑ / conflict ⚠ / pending delete ✗). Includes overall counts and timestamp of last successful sync.

### Conflict resolution

```
files-resolve <filePath> <keep-local|keep-pod|keep-both>
```
Resolves a conflict for a specific file. Arguments:
- `filePath` — local absolute path of the conflicted file.
- `keep-local` — re-upload local version to pod, overwriting.
- `keep-pod` — download pod version, overwriting local.
- `keep-both` — rename local file to `{name}.local.{ext}`, download pod version as `{name}`.

### App config inspection

```
app-config
```
Displays the current `AppConfig` values (read-only; config is set at build time by the developer, not at runtime).

---

## User Journey

### Setup (first time)

1. User has a Solid account (via the existing SolidSyncBar onboarding flow — solidcommunity.net, solidweb.me, or self-hosted CSS).
2. User is logged in: green dot in the header, session active.
3. User either:
   - Opens the **Sync Roots** panel in the File Explorer and clicks **"+ Add sync root"**, or
   - Runs `files-root-add /home/ https://alice.solidcommunity.net/devalbo/files/ --label "All files"` in the terminal.
     Note: `/` itself is rejected — `socialLocalPath` (`/_social/`) starts with `/`, so any root whose `localPath` is a prefix of `/_social/` is blocked. Use a sub-directory such as `/home/` or `/documents/`.
4. On confirm, the root is saved to the `sync_roots` store table. User is prompted (or passes `--push-now` to `files-root-add`) to upload local files immediately.
5. A progress bar (UI) or line-by-line output (terminal) shows upload progress. On completion, per-file sync status icons appear.

### Adding a second sync root (different pod)

1. User runs: `files-root-add /work/ https://work.example/projects/alice/ --label "Work" --web-id https://alice.work.example/profile#me`
2. If the `--web-id` differs from the active session, the terminal shows: "Root added but inactive — log in as https://alice.work.example/profile#me to enable it." The root appears in `files-root-list` as disabled.
3. When the user authenticates as the work account, the synchronizer for that root starts automatically.

### New device or fresh install (MVP)

Sync roots manifest is **post-MVP**. In MVP the user must re-add roots manually:

1. User logs in via SolidSyncBar.
2. User re-adds each sync root via `files-root-add <localPath> <podUrl>` or the Sync Roots panel form. The pod containers still exist from the previous device — the roots just aren't registered locally yet.
3. User runs `files-pull` (or clicks "Pull" per root in the UI) to download files into the newly registered local paths.
4. Live sync starts.

*Post-MVP*: App will auto-populate roots from `{podRoot}/{podNamespace}/sync-roots-manifest.json` after login, eliminating step 2.

### Going offline

- No user action needed. The driver continues to work locally.
- Outbound writes are tagged `pending_upload` in `file_sync_state`.
- A banner "Offline — N changes pending" appears. `files-status` also shows pending counts.
- On reconnect (`online` event), each root's queue flushes independently.

### Removing a sync root

User runs `files-root-remove <rootId> keep-pod` (most common — keep files on pod, just stop syncing) or `files-root-remove <rootId> delete-from-pod` (decommission — remove from pod too). The second argument is required; the command errors if omitted, to prevent accidental data loss.

---

## Architecture

### Pod URL scheme

Files map to pod resources via their sync root. Roots must be mutually non-overlapping. Given:

```
sync root A:  localPath='/work/',      podUrl='https://alice.solidcommunity.net/devalbo/files/work/'
sync root B:  localPath='/personal/',  podUrl='https://alice.solidcommunity.net/devalbo/files/personal/'
```

Path resolution examples:

```
local path                    root    pod URL
──────────────────────────── ─────── ─────────────────────────────────────────────────────
/work/project/src/app.ts      A       .../devalbo/files/work/project/src/app.ts
/work/README.md               A       .../devalbo/files/work/README.md
/personal/notes.txt           B       .../devalbo/files/personal/notes.txt
/tmp/scratch.txt              none    untracked (no root covers /tmp/)
```

Each file belongs to exactly one root. `/tmp/scratch.txt` is untracked because no root's `localPath` is a prefix of `/tmp/`. Adding root A at `/work/` and root C at `/work/project/` would be rejected — they overlap — so this ambiguity cannot arise at runtime.

Each directory level maps to an LDP container. File MIME types are sent as `Content-Type` on PUT. Binary files use raw `Uint8Array`; text files use `text/plain` or the inferred MIME.

### Canonical Path Format

All internal paths — in TinyBase tables, accessors, CLI arguments, and synchronizer state — are **POSIX-style**:
- Forward slash `/` separator.
- Absolute paths start with `/`.
- Directory paths end with `/`; file paths do not.
- No `.` or `..` segments.

Platform normalization happens at the **driver boundary** (when paths enter or leave `IFilesystemDriver`):

| Runtime | Raw OS path | Canonical internal path |
|---|---|---|
| Browser | N/A (virtual FS, already POSIX) | unchanged |
| Tauri/macOS/Linux | `/Users/alice/work/file.ts` | `/Users/alice/work/file.ts` |
| Tauri/Windows | `C:\Users\alice\work\file.ts` | `/c/Users/alice/work/file.ts` (drive letter lowercased, backslash → slash) |
| Node (Linux/macOS) | `/home/alice/file.ts` | unchanged |

The normalizer is a shared helper in `packages/shared/src/types/filesystem.ts`:

```ts
export const toCanonicalPath = (rawPath: string): string
export const fromCanonicalPath = (canonicalPath: string, platform: 'posix' | 'win32'): string
```

`SyncRoot.localPath` is always stored in canonical form. `files-root-add` normalizes the user-supplied `localPath` before saving.

### `IConnectivityService`

The `SolidLdpFileSynchronizer` needs to detect online/offline transitions, but `navigator.onLine` and `window.addEventListener('online')` are browser-specific and do not work on desktop/Node runtimes.

Define in `packages/shared/src/types/environment.ts` (or a new file):

```ts
export interface IConnectivityService {
  isOnline(): boolean;
  /** Register a callback to be called when connectivity is restored. Returns an unsubscribe function. */
  onOnline(callback: () => void): () => void;
}
```

Implementations:

| Runtime | Class | Location |
|---|---|---|
| Browser | `BrowserConnectivityService` | `naveditor-web/src/connectivity.ts` |
| Tauri (desktop) | `TauriConnectivityService` | `naveditor-desktop/src/connectivity.ts` |
| Node / test | `AlwaysOnlineConnectivityService` | `packages/shared/src/environment/connectivity.ts` |

`BrowserConnectivityService` uses `navigator.onLine` and `window.addEventListener('online', ...)`. It lives in `naveditor-web/src/` to avoid importing browser globals into `@devalbo/shared`, which is also built in Node contexts (tests, CLI). `AlwaysOnlineConnectivityService` contains no browser APIs and is safe in shared.

`SolidLdpFileSynchronizer` accepts `IConnectivityService` as a **required** constructor parameter. Callers choose the right implementation explicitly: `BrowserConnectivityService` in the web app, `AlwaysOnlineConnectivityService` in tests and CLI. This makes the runtime environment visible at the call site rather than hidden inside the class.

### Shared file sync operations (no duplicate logic)

CLI commands (`files-push`, `files-pull`) and the live `SolidLdpFileSynchronizer` must share the same traversal/write logic. Extract it into standalone functions:

**`packages/solid-client/src/ldp-file-sync-ops.ts`**

```ts
export const pushFilesForRoot = async (
  root: SyncRoot,
  session: SolidSession,
  driver: IFilesystemDriver,
  store: Store
): Promise<FileSyncSummary>

export const pullFilesForRoot = async (
  root: SyncRoot,
  session: SolidSession,
  driver: IFilesystemDriver,
  store: Store
): Promise<FileSyncSummary>
```

`SolidLdpFileSynchronizer.pushAll()` and `pullAll()` delegate to these functions. CLI commands also call them directly (the CLI has access to store, session, and driver via command options). This is the single source of truth for traversal and write logic.

### `FileSyncContext` (synchronizer lifecycle)

The `SyncRootsPanel` UI and conflict resolution panel need access to the active synchronizer instance for a given root (to call `pullAll()` and `resolveConflict()`). The synchronizer instances are created inside a React `useEffect` in `AppContent` and would otherwise be inaccessible to descendant components.

Add to `naveditor-lib/src/components/social/` or `naveditor-web/src/`:

```tsx
export type FileSyncMap = Map<SyncRootId, SolidLdpFileSynchronizer>;

export const FileSyncContext = createContext<FileSyncMap>(new Map());

export const useFileSyncMap = (): FileSyncMap => useContext(FileSyncContext);
```

In `AppContent`'s synchronizer `useEffect`, expose the synchronizer map via state:

```tsx
const [fileSyncMap, setFileSyncMap] = useState<FileSyncMap>(() => new Map());

useEffect(() => {
  // ... create synchronizers ...
  const map = new Map(activeRoots.map(r => [r.id, new SolidLdpFileSynchronizer(r, ...)]));
  setFileSyncMap(map);
  for (const sync of map.values()) sync.start();
  return () => { for (const sync of map.values()) sync.stop(); setFileSyncMap(new Map()); };
}, [session, store, config]);

// In JSX:
<FileSyncContext.Provider value={fileSyncMap}>
  {/* rest of AppContent */}
</FileSyncContext.Provider>
```

`SyncRootsPanel` calls `useFileSyncMap()` to get the synchronizer for each root.

### Social Data Isolation

Social data (persona, contacts, groups) is managed exclusively by `SolidLdpSynchronizer` and stored on the pod under `{podRoot}/{podNamespace}/` — e.g., `https://alice.solidcommunity.net/devalbo/persona.jsonld`, `.../devalbo/contacts/`, `.../devalbo/groups/`. On the local filesystem, social data currently lives only in TinyBase (not as files on disk).

The file sync system must never read or write this pod container or its local counterpart. Two risks to guard against:

**Pod-side overlap**: If a user adds a file sync root with `podUrl: 'https://alice.solidcommunity.net/devalbo/'`, the file synchronizer would compete with `SolidLdpSynchronizer` for the same LDP container, potentially overwriting `persona.jsonld` or corrupting contact records.

**Local-side overlap**: If a future feature exposes social data as files under a local path (e.g., `config.socialLocalPath`), the file sync system must exclude that path from all roots.

#### Pod namespace guard

`files-root-add` validates that the new `podUrl` does not overlap with the social-data resources managed by `SolidLdpSynchronizer`. File sync roots are expected to live under `{podNamespace}/files/` — that sub-container is explicitly allowed. Everything else directly under `{podNamespace}/` (persona, contacts, groups, manifest) is reserved.

The guard logic (in the command handler):

```ts
const socialPodBase = `${webIdOrigin}/${config.podNamespace}/`;
const fileSyncBase  = `${socialPodBase}files/`;

// Allow anything under .../files/ — that is the intended file sync sub-container.
// Block anything else directly under the social namespace.
if (podUrl.startsWith(socialPodBase) && !podUrl.startsWith(fileSyncBase)) {
  return makeResultError(
    `podUrl "${podUrl}" overlaps with the app's social data namespace. ` +
    `Use "${fileSyncBase}" (or a sub-container of it) for file sync, ` +
    `or a container outside "${socialPodBase}" entirely.`
  );
}
```

This means `https://alice.solidcommunity.net/devalbo/files/work/` is valid; `https://alice.solidcommunity.net/devalbo/contacts/` is rejected; `https://alice.solidcommunity.net/devalbo/` itself is rejected.

#### Local social path (`config.socialLocalPath`)

`AppConfig` has a required field `socialLocalPath: string`. The value must be set explicitly in each app's `defaultAppConfig` — `'/_social/'` is the conventional value used by this app. This is the local canonical path prefix reserved for any future social-data filesystem mount. The file sync system treats this path as excluded — no file sync root may have a `localPath` that overlaps with it, and the watcher handler skips events under this prefix.

For the MVP, no files are actually written under `socialLocalPath` — it is reserved for a future feature where contacts/groups could be browsed as JSON-LD files. The exclusion is enforced now so no sync root can claim the path before the feature ships.

`AppConfig` change:

```ts
// Add to AppConfig type:
socialLocalPath: string;  // default: '/_social/'
```

`naveditor-web/src/config.ts` (and desktop):

```ts
socialLocalPath: '/_social/',
```

`files-root-add` validation for local overlap:

```ts
if (localPath.startsWith(config.socialLocalPath) || config.socialLocalPath.startsWith(localPath)) {
  return makeResultError(
    `localPath "${localPath}" overlaps with the reserved social data path (${config.socialLocalPath}).`
  );
}
```

### Branded types

Several values share the primitive type `string` or `number` but inhabit completely distinct value spaces. Branded types move that constraint from code comments into the compiler.

All infrastructure is imported from `@devalbo/branded-types` (already in the monorepo).

#### `packages/shared/src/types/branded.ts`

```ts
import { createBrandedNonNegativeIntSchema } from '@devalbo/branded-types';
import type { BrandedString, BrandedNumber } from '@devalbo/branded-types';
import { z } from 'zod';

// Unique identifier for a SyncRoot row (UUID v4).
export type SyncRootId = BrandedString<'SyncRootId'>;
export const SyncRootIdSchema = z.string().uuid()
  .transform(v => v as SyncRootId);

// Absolute canonical POSIX path to a directory (local filesystem).
// Must be non-empty and end with '/'. Used for sync root localPath and watcher scoping.
// Never mix with PodUrl, RelativePath, or AbsolutePath.
export type DirectoryPath = BrandedString<'DirectoryPath'>;
export const DirectoryPathSchema = z.string().min(1)
  .refine(v => v.startsWith('/'), 'DirectoryPath must be absolute')
  .refine(v => v.endsWith('/'), 'DirectoryPath must end with "/"')
  .transform(v => v as DirectoryPath);

// Absolute canonical POSIX path to a file or directory (local filesystem).
// Must be non-empty and start with '/'. No trailing-slash constraint — covers both
// files (/work/a.txt) and directories (/work/). Used for individual file references
// in file_sync_state and conflict resolution.
// Never mix with PodUrl, RelativePath, or DirectoryPath.
export type AbsolutePath = BrandedString<'AbsolutePath'>;
export const AbsolutePathSchema = z.string().min(1)
  .refine(v => v.startsWith('/'), 'AbsolutePath must be absolute')
  .transform(v => v as AbsolutePath);

// Full URL of an LDP container on a Solid pod. Must be a valid URL and end with '/'.
// Never mix with DirectoryPath, AbsolutePath, or RelativePath.
export type PodUrl = BrandedString<'PodUrl'>;
export const PodUrlSchema = z.string().url()
  .refine(v => v.endsWith('/'), 'PodUrl must end with "/"')
  .transform(v => v as PodUrl);

// Solid WebID URL. Must be a valid URL.
// Distinct from PodUrl even though both are HTTP URLs — different identity/access-control space.
export type WebId = BrandedString<'WebId'>;
export const WebIdSchema = z.string().url()
  .transform(v => v as WebId);

// SHA-256 hex digest of file bytes at last successful sync.
// Computed locally from downloaded or local bytes. NEVER compare against PodETag.
export type ContentHash = BrandedString<'ContentHash'>;
export const ContentHashSchema = z.string()
  .regex(/^[0-9a-f]{64}$/, 'ContentHash must be a 64-char lowercase hex string')
  .transform(v => v as ContentHash);

// Duration in milliseconds. Non-negative integer.
// Used for poll intervals and debounce timings. Distinct from ByteCount.
export const MillisecondsSchema = createBrandedNonNegativeIntSchema('Milliseconds');
export type Milliseconds = BrandedNumber<'Milliseconds'>;

// Size in bytes. Non-negative integer. Distinct from Milliseconds.
export const ByteCountSchema = createBrandedNonNegativeIntSchema('ByteCount');
export type ByteCount = BrandedNumber<'ByteCount'>;
```

Export all of the above from `packages/shared/src/index.ts`.

#### `packages/solid-client/src/types.ts`

```ts
import type { BrandedString } from '@devalbo/branded-types';
import { z } from 'zod';

// Opaque ETag value returned by the Solid pod server in HTTP response headers.
// Server-defined; used only as a cheap cache pre-check.
// NEVER compare against ContentHash — completely different value spaces.
// No further structural constraint — ETags are server-defined opaque strings.
export type PodETag = BrandedString<'PodETag'>;
export const PodETagSchema = z.string().min(1)
  .transform(v => v as PodETag);

// Path of a resource relative to a pod container URL or sync root.
// Must not start with '/'. Segments are percent-encoded individually.
// Never mix with DirectoryPath, AbsolutePath, or PodUrl.
export type RelativePath = BrandedString<'RelativePath'>;
export const RelativePathSchema = z.string()
  .refine(v => !v.startsWith('/'), 'RelativePath must not start with "/"')
  .transform(v => v as RelativePath);
```

**Cast sites** — raw `string` is cast to the branded type exactly once, at the appropriate boundary:

| Branded type | Cast site |
|---|---|
| `PodETag` | `SolidLdpFilePersister` — when reading the `ETag` response header |
| `ContentHash` | `SolidLdpFileSynchronizer` — after computing SHA-256 of file bytes |
| `DirectoryPath` | `files-root-add` command — after path validation, before storing in `SyncRoot.localPath` |
| `AbsolutePath` | `SolidLdpFileSynchronizer` watcher handler — cast from raw watcher event path |
| `PodUrl` | `files-root-add` command — after URL validation, before storing |
| `WebId` | `files-root-add` command — from `session.webId`, after validation |
| `SyncRootId` | `files-root-add` command — after `crypto.randomUUID()` |
| `RelativePath` | `sync-root-resolver.ts` — inside `localPathToPodUrl` / `podUrlToLocalPath` |
| `Milliseconds` | `config.ts` — at `AppConfig` literal construction |
| `ByteCount` | `config.ts` — at `AppConfig` literal construction |

TinyBase stores all values as raw primitives internally. The branded types live at the TypeScript layer — accessor functions (`listSyncRoots`, `getFileSyncState`, etc.) cast from the raw stored strings to the appropriate branded type on read, and unwrap to plain `string` on write.

`podEtag` is stored as `''` (empty string) when the server returned no ETag. Accessor functions convert `''` ↔ `null` at the boundary so `FileSyncStateRow.podEtag` is always typed `PodETag | null` at the TypeScript layer. `PodETagSchema` (which validates non-empty strings) is only applied to known-non-null values during that conversion.

---

### `SyncRoot` type (in `@devalbo/shared`)

`SyncRoot` is defined in `packages/shared/src/schemas/sync-root.ts` alongside its Zod schema. Placing it in `@devalbo/shared` lets both `@devalbo/state` (TinyBase accessors) and `@devalbo/solid-client` (synchronizer, resolver) import it without circular dependencies.

```ts
// packages/shared/src/schemas/sync-root.ts
import { SyncRootIdSchema, DirectoryPathSchema, PodUrlSchema, WebIdSchema } from '../types/branded';

export const SyncRootSchema = z.object({
  id:        SyncRootIdSchema,          // UUID v4
  label:     z.string(),
  localPath: DirectoryPathSchema,       // absolute POSIX path, ends with '/'
  podUrl:    PodUrlSchema,              // valid URL, ends with '/'
  webId:     WebIdSchema,               // valid URL; Solid account for this root
  readonly:  z.boolean(),
  enabled:   z.boolean()
});
export type SyncRoot = z.infer<typeof SyncRootSchema>;
```

### New TinyBase table: `sync_roots`

Row key: `id` (UUID). Schema mirrors `SyncRoot`. Persisted locally via `createLocalPersister`. *Post-MVP*: a pod-side sync-roots manifest will mirror this table to enable automatic fresh-device discovery. In MVP, roots are re-added manually on a new device.

### New TinyBase table: `file_sync_state`

Added to the store schema:

```ts
file_sync_state: {
  path: string,         // AbsolutePath — absolute POSIX path to file, used as row key
  syncRootId: string,   // SyncRootId — UUID of the owning sync_roots row
  podEtag: string,      // PodETag | '' — ETag from the pod at last successful sync,
                        // used as a cheap pre-check to skip downloading unchanged files.
                        // Server-defined opaque string; '' when server returned none.
                        // Do NOT compare against contentHash (different value spaces).
  contentHash: string,  // ContentHash — SHA-256 hex (64 lowercase chars) of the file bytes
                        // at last successful sync. Authoritative change indicator.
  status: string,       // 'synced' | 'pending_upload' | 'pending_delete' | 'conflict'
}
```

TinyBase stores all fields as raw `string`. Accessor functions cast to the branded types (`AbsolutePath`, `SyncRootId`, `PodETag`, `ContentHash`) on read and unwrap on write. `podEtag` uses `''` (empty string) rather than `null` because TinyBase string cells cannot be null; accessors convert `''` ↔ `null` at the boundary.

`syncRootId` is set at write time and not recomputed on every read, so roots can be relabelled without re-scanning files. When a sync root is removed, all `file_sync_state` rows with that `syncRootId` are deleted from local state.

### Pod-side manifests (post-MVP optimization)

The sync-roots manifest and per-root file manifest described below are **not part of the MVP**. MVP uses recursive `SolidLdpFilePersister.listFiles()` for all pull operations. The manifest types are documented here for future implementation.

**Sync roots manifest** — at `{podRoot}/{config.podNamespace}/sync-roots-manifest.json`:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-02-20T00:00:00Z",
  "roots": [
    {
      "id": "abc123",
      "label": "All files",
      "localPath": "/",
      "podUrl": "https://alice.solidcommunity.net/devalbo/files/",
      "webId": "https://alice.solidcommunity.net/profile/card#me",
      "readonly": false
    }
  ]
}
```

**Per-root file manifest** — at `{root.podUrl}_manifest.json`. Contains per-file `mtime`, `size`, and `sha256`. Would allow a fresh device to skip HEAD-ing every resource. Post-MVP: add after recursive listing proves too slow for large pod containers.

### New file: `packages/solid-client/src/sync-root-resolver.ts`

```ts
import type { SyncRoot } from '@devalbo/shared';

export const findSyncRoot = (localPath: AbsolutePath, roots: SyncRoot[]): SyncRoot | null
export const localPathToPodUrl = (localPath: AbsolutePath, root: SyncRoot): PodUrl
export const podUrlToLocalPath = (podUrl: PodUrl, root: SyncRoot): AbsolutePath | null
```

Implementation notes:
- `findSyncRoot`: filter to enabled roots whose `localPath` is a prefix of the input (segment-boundary-safe because `localPath` is enforced to end with `/`), sort by `localPath.length` descending, return first. Defensively skip any root whose `localPath` does not end with `/`.
- `localPathToPodUrl`: all internal paths are POSIX-style (see Canonical Path Format). Compute `relativePath = localPath.slice(root.localPath.length)`, split by `/`, filter empty segments, `encodeURIComponent` each segment individually (never the separator), rejoin with `/`, append to `root.podUrl`. If `localPath` is a directory (ends with `/`), the encoded URL also ends with `/`.
- `podUrlToLocalPath`: verify `podUrl.startsWith(root.podUrl)`, take the suffix, split by `/`, `decodeURIComponent` each segment, rejoin with `/`, prepend `root.localPath`. Return `null` if the URL is not under `root.podUrl`.

### New file: `packages/solid-client/src/ldp-file-persister.ts`

```ts
export class SolidLdpFilePersister {
  // podContainerUrl is the root's podUrl — caller resolves root before constructing.
  constructor(podContainerUrl: PodUrl, fetchFn: typeof fetch) { ... }

  async ensurePath(relativePath: RelativePath): Promise<void>
  async putFile(relativePath: RelativePath, content: Uint8Array, mimeType?: string): Promise<{ etag: PodETag | null }>
  async getFile(relativePath: RelativePath): Promise<{ content: Uint8Array; etag: PodETag | null } | null>
  async statFile(relativePath: RelativePath): Promise<{ etag: PodETag | null; size: ByteCount } | null>
  async deleteFile(relativePath: RelativePath): Promise<void>
  // Recursively lists all resources (not containers). Returns paths relative to podContainerUrl.
  // MVP: full recursive traversal. Post-MVP: replace with manifest-based listing for large pods.
  async listFiles(dirRelativePath?: RelativePath): Promise<Array<{ path: RelativePath; etag: PodETag | null; size: ByteCount }>>
  // Deletes all resources recursively under podContainerUrl. Used by files-root-remove delete-from-pod.
  async deleteAll(): Promise<void>
}
```

Key implementation notes:
- `ensurePath('src/components/')` creates `src/` container then `src/components/` container under the pod container URL — walking depth-first.
- `listFiles` distinguishes LDP containers (URLs ending `/`) from resources, and recurses into containers.
- `etag` comes from the `ETag` HTTP response header. If the server does not return one, store an empty string and fall back to always downloading on poll (skip the ETag pre-check). ETag is stored in `file_sync_state.podEtag` solely as a cheap pre-check — it is a server-defined opaque string and must never be compared against `contentHash` (SHA-256 of bytes). These are independent values in completely different value spaces.
- `getManifest` / `putManifest` are **post-MVP** — omit from the MVP implementation.

### New file: `packages/solid-client/src/ldp-file-synchronizer.ts`

One instance per sync root. The app holds the collection and manages lifecycle.

```ts
export class SolidLdpFileSynchronizer {
  constructor(
    root: SyncRoot,
    allRoots: SyncRoot[],              // validated at construction time — constructor throws if any root overlaps with root.localPath
    session: SolidSession,             // must match root.webId
    store: Store,                      // for file_sync_state table
    driver: IFilesystemDriver,
    watcher: IWatcherService,
    syncConfig: AppConfig['sync']['files'],
    connectivity: IConnectivityService // required — caller passes BrowserConnectivityService or AlwaysOnlineConnectivityService explicitly
  ) { ... }

  start(): void
  stop(): void

  pushAll(): Promise<FileSyncSummary>
  pullAll(): Promise<FileSyncSummary>
  resolveConflict(path: AbsolutePath, resolution: 'keep-local' | 'keep-pod' | 'keep-both'): Promise<void>
}

export type FileSyncSummary = {
  rootId: SyncRootId;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
};
```

**Outbound (local → pod):**
- `watcher.watch(root.localPath, handler)` — scoped to the root's local directory. Because the constructor validated no root overlaps, every event under `root.localPath` belongs unambiguously to this root. No runtime path-routing check is needed.
- On Created/Modified: compute SHA-256 `contentHash` of the file bytes. If `contentHash` matches the stored `file_sync_state.contentHash` (no real change), skip. Otherwise, `persister.putFile(relativePath, content)`, update `file_sync_state` with `status: 'synced'`, new `contentHash`, and `podEtag` from the PUT response (if the server returns one).
- On Deleted: `persister.deleteFile(relativePath)`, remove `file_sync_state` row.
- Skip if `root.readonly`.
- Debounce per `syncConfig.outboundDebounceMs`.
- While offline (`!connectivity.isOnline()`): set status to `pending_upload` / `pending_delete` instead of calling pod. Register `connectivity.onOnline(() => this.flushQueue())` to retry when reconnected.

**Inbound (pod → local, polling):**
- Every `syncConfig.pollIntervalMs`: `persister.listFiles()` → compare with `file_sync_state` rows where `syncRootId === root.id`.
- New pod file (no local state row): download, compute SHA-256, write locally. Create `file_sync_state` with `status: 'synced'`, `podEtag` from response, `contentHash` of bytes.
- **Conflict detection — two-step (ETag pre-check, then SHA-256 authoritative)**:
  1. Call `persister.statFile(relativePath)` to get the current pod ETag without downloading.
  2. If pod ETag matches stored `file_sync_state.podEtag` → pod unchanged, skip.
  3. If ETag differs (or unavailable): download the file, compute SHA-256 of the bytes.
     - SHA-256 matches stored `contentHash` → same bytes despite different ETag (server quirk — e.g. re-upload with no change). Update `podEtag` only, status stays `'synced'`.
     - SHA-256 differs → real change on pod side. Check local status:
       - `'pending_upload'` → local also changed. Set `status: 'conflict'`. Do not overwrite either side.
       - `'synced'` → only pod changed. Overwrite local file. Update `podEtag` and `contentHash`.
- Local row not present on pod → pod deleted it. Auto-delete local only if `status === 'synced'`; if `'pending_upload'` or `'conflict'`, set `status: 'conflict'` instead.
- `suppressOutbound` flag prevents echo writes during poll.

### Conflict resolution

Status `conflict` → File Explorer shows ⚠. `files-resolve` command (or UI panel) offers:

- `keep-local` — re-upload local version, overwriting pod.
- `keep-pod` — download pod version, overwriting local.
- `keep-both` — rename local to `{name}.local.{ext}`, download pod version as `{name}`.

No CRDT or three-way merge — that is a future enhancement.

---

## Implementation Steps (for a coding agent)

Each step lists every file to create or modify with exact changes, followed by how to verify the step is complete. Steps must be implemented in order — later steps depend on earlier ones.

---

### Step 1 — Shared types and app config

#### Files to CREATE

**`packages/shared/src/app-config.ts`**

```ts
export type AppConfig = {
  appId: string;
  appName: string;
  storageKey: string;
  podNamespace: string;
  /** Reserved local path prefix for social data. File sync roots may not overlap with this path. Default: '/_social/' */
  socialLocalPath: string;
  sync: {
    social: { pollIntervalMs: Milliseconds; outboundDebounceMs: Milliseconds };
    files: { pollIntervalMs: Milliseconds; outboundDebounceMs: Milliseconds; maxFileSizeBytes: ByteCount };
  };
  features: { socialSync: boolean; fileSync: boolean; fileSharing: boolean };
};
```

**`packages/shared/src/schemas/sync-root.ts`**

```ts
import { z } from 'zod';
import { SyncRootIdSchema, DirectoryPathSchema, PodUrlSchema, WebIdSchema } from '../types/branded';

export const SyncRootSchema = z.object({
  id:        SyncRootIdSchema,          // UUID v4
  label:     z.string(),
  localPath: DirectoryPathSchema,       // absolute POSIX path, ends with '/'
  podUrl:    PodUrlSchema,              // valid URL, ends with '/'
  webId:     WebIdSchema,               // valid URL; Solid account for this root
  readonly:  z.boolean(),
  enabled:   z.boolean()
});
export type SyncRoot = z.infer<typeof SyncRootSchema>;
```

**`packages/state/src/accessors/sync-roots.ts`**

```ts
import type { Store } from 'tinybase';
import type { SyncRoot } from '@devalbo/shared';

export const SYNC_ROOTS_TABLE = 'sync_roots' as const;

export const getSyncRoot = (store: Store, id: SyncRootId): SyncRoot | null => { ... }
export const setSyncRoot = (store: Store, root: SyncRoot): void => { ... }
export const listSyncRoots = (store: Store): SyncRoot[] => { ... }
export const deleteSyncRoot = (store: Store, id: SyncRootId): void => { ... }
```

Each function reads/writes from the `sync_roots` table. `setSyncRoot` uses `root.id` as the row key. `listSyncRoots` maps all rows to `SyncRoot` objects. `deleteSyncRoot` calls `store.delRow`.

**`packages/state/src/accessors/file-sync-state.ts`**

```ts
import type { Store } from 'tinybase';

export const FILE_SYNC_STATE_TABLE = 'file_sync_state' as const;
export type FileSyncStatus = 'synced' | 'pending_upload' | 'pending_delete' | 'conflict';
export type FileSyncStateRow = {
  path: AbsolutePath;        // absolute POSIX file path — row key
  syncRootId: SyncRootId;
  podEtag: PodETag | null;   // null when server returned no ETag (stored as '' in TinyBase)
  contentHash: ContentHash;  // SHA-256 hex of bytes at last sync — authoritative comparison
  status: FileSyncStatus;
};

export const getFileSyncState = (store: Store, path: AbsolutePath): FileSyncStateRow | null => { ... }
export const setFileSyncState = (store: Store, row: FileSyncStateRow): void => { ... }   // row.path is the row key
export const deleteFileSyncState = (store: Store, path: AbsolutePath): void => { ... }
export const listFileSyncStatesForRoot = (store: Store, rootId: SyncRootId): FileSyncStateRow[] => { ... }
```

**`packages/state/src/hooks/use-app-config.ts`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { AppConfig } from '@devalbo/shared';

export const AppConfigContext = createContext<AppConfig | null>(null);

export const AppConfigProvider: React.FC<{ config: AppConfig; children: ReactNode }> = ({ config, children }) => (
  <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>
);

export const useAppConfig = (): AppConfig => {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return ctx;
};
```

**`naveditor-web/src/config.ts`**

```ts
import type { AppConfig } from '@devalbo/shared';
import { MillisecondsSchema, ByteCountSchema } from '@devalbo/shared';

const ms = (n: number) => MillisecondsSchema.parse(n);
const bytes = (n: number) => ByteCountSchema.parse(n);

export const defaultAppConfig: AppConfig = {
  appId: 'naveditor',
  appName: 'naveditor',
  storageKey: 'devalbo-store',
  podNamespace: 'devalbo',
  socialLocalPath: '/_social/',
  sync: {
    social: { pollIntervalMs: ms(30_000), outboundDebounceMs: ms(1_000) },
    files:  { pollIntervalMs: ms(30_000), outboundDebounceMs: ms(1_500), maxFileSizeBytes: bytes(5 * 1024 * 1024) }
  },
  features: { socialSync: true, fileSync: false, fileSharing: false }
};
```

**`naveditor-desktop/src/config.ts`** — identical to `naveditor-web/src/config.ts`.

#### Files to MODIFY

**`packages/shared/src/schemas/index.ts`** — add one line:

```ts
// Before (3 lines):
export * from './file-tree';
export * from './editor-buffer';
export * from './social';

// After (4 lines):
export * from './file-tree';
export * from './editor-buffer';
export * from './social';
export * from './sync-root';
```

**`packages/shared/src/index.ts`** — add one line at the end:

```ts
export * from './app-config';
```

**`packages/state/src/store.ts`** — inside `store.setTablesSchema({...})`, after the `buffers` entry and before `...socialTablesSchema`, add:

```ts
sync_roots: {
  label:     { type: 'string' },
  localPath: { type: 'string' },
  podUrl:    { type: 'string' },
  webId:     { type: 'string' },
  readonly:  { type: 'boolean' },
  enabled:   { type: 'boolean' }
},
file_sync_state: {
  path:        { type: 'string' },
  syncRootId:  { type: 'string' },
  podEtag:     { type: 'string' },  // ETag from pod at last sync — cheap change pre-check
  contentHash: { type: 'string' },  // SHA-256 of bytes at last sync — authoritative comparison
  status:      { type: 'string' }
},
```

**`packages/state/src/accessors/index.ts`** — add two lines at the end:

```ts
export * from './sync-roots';
export * from './file-sync-state';
```

**`packages/state/src/hooks/index.ts`** — add one line at the end:

```ts
export * from './use-app-config';
```

#### Automated verification

```bash
pnpm --filter @devalbo/shared build
pnpm --filter @devalbo/state build
pnpm --filter naveditor test:unit
```

`test:unit` runs `node tests/scripts/run-unit.mjs` using Vitest. All builds and existing tests must pass without regression. No new tests are required for this step — the new types and accessors are covered indirectly by tests added in later steps.

#### Human verification

1. In a terminal, run `pnpm --filter naveditor-web dev`.
2. Open the app in a browser — it must load without errors.
3. Open browser DevTools → Console — confirm no runtime errors related to `AppConfigProvider` or missing context.

---

### Step 2 — Propagate `podNamespace` through `SolidLdpPersister` and callers

This step makes the hardcoded `'devalbo'` pod path configurable. It must be done as a single atomic change across all affected files to avoid breaking the build mid-step.

#### Files to MODIFY

**`packages/solid-client/src/ldp-persister.ts`**

Change the constructor (line 22–25):

```ts
// BEFORE:
constructor(podRoot: string, private readonly fetchFn: FetchFn) {
  const base = podRoot.endsWith('/') ? podRoot : `${podRoot}/`;
  this.appRoot = `${base}devalbo/`;
}

// AFTER:
constructor(podRoot: string, private readonly podNamespace: string, private readonly fetchFn: FetchFn) {
  const base = podRoot.endsWith('/') ? podRoot : `${podRoot}/`;
  this.appRoot = `${base}${podNamespace}/`;
}
```

In `ensureContainer`, replace the two hardcoded `'devalbo'` references (lines ~38–49):

```ts
// BEFORE:
const parentUrl = this.appRoot.replace(/devalbo\/$/, '');
const createApp = await this.fetchFn(parentUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'text/turtle', Slug: 'devalbo', Link: LDP_CONTAINER_LINK },
  body: ''
});

// AFTER:
const parentUrl = this.appRoot.slice(0, -(this.podNamespace.length + 1));
const createApp = await this.fetchFn(parentUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'text/turtle', Slug: this.podNamespace, Link: LDP_CONTAINER_LINK },
  body: ''
});
```

**`packages/solid-client/src/ldp-synchronizer.ts`**

Change constructor signature (line 35) and persister instantiation (line 41):

```ts
// BEFORE:
constructor(private readonly store: Store, session: SolidSession) {
  ...
  this.persister = new SolidLdpPersister(podRoot, session.fetch);
}

// AFTER:
constructor(
  private readonly store: Store,
  session: SolidSession,
  podNamespace: string,
  private readonly syncConfig?: { pollIntervalMs: number; outboundDebounceMs: number }
) {
  ...
  this.persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);
}
```

Change `start(pollIntervalMs = 30_000)` (line 44) to read from config:

```ts
// BEFORE:
start(pollIntervalMs = 30_000): void {
  ...
  this.pollIntervalId = setInterval(() => void this.poll(), pollIntervalMs);
}

// AFTER:
start(): void {
  const pollIntervalMs = this.syncConfig?.pollIntervalMs ?? 30_000;
  ...
  this.pollIntervalId = setInterval(() => void this.poll(), pollIntervalMs);
}
```

Change `scheduleFlush(tableId: string, debounceMs = 1_000)` (line 73) to read from config:

```ts
// BEFORE:
private scheduleFlush(tableId: string, debounceMs = 1_000): void {
  ...
  const timerId = setTimeout(() => void this.flushTable(tableId), debounceMs);

// AFTER:
private scheduleFlush(tableId: string): void {
  const debounceMs = this.syncConfig?.outboundDebounceMs ?? 1_000;
  ...
  const timerId = setTimeout(() => void this.flushTable(tableId), debounceMs);
```

**`packages/solid-client/src/pod-sync.ts`**

Both `podPush` and `podPull` instantiate `SolidLdpPersister`. Add `podNamespace` as a **required** parameter and pass it through. Existing callers will fail to compile — that is intentional; they must be updated to pass `config.podNamespace` explicitly.

```ts
// BEFORE:
export const podPush = async (store: Store, session: SolidSession): Promise<PodPushResult> => {
  ...
  const persister = new SolidLdpPersister(podRoot, session.fetch);

// AFTER:
export const podPush = async (store: Store, session: SolidSession, podNamespace: string): Promise<PodPushResult> => {
  ...
  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);
```

Apply the same change to `podPull`.

**`naveditor-lib/src/lib/pod-sync.ts`**

This is the CLI-layer adapter used by the `solid-pod-push` and `solid-pod-pull` commands. It also instantiates `SolidLdpPersister` directly. Add `podNamespace` as a **required** parameter to both `pushPodData` and `pullPodData` and pass it through:

```ts
// In pushPodData (line 42):
// BEFORE: const persister = new SolidLdpPersister(podRoot, session.fetch);
// AFTER:  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);

// In pullPodData (line 72):
// BEFORE: const persister = new SolidLdpPersister(podRoot, session.fetch);
// AFTER:  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);
```

The callers in `naveditor-lib/src/commands/solid.ts` will fail to compile. Update them in the same commit to pass `options.config.podNamespace` (once `ExtendedCommandOptions` includes `config: AppConfig` from Step 7) or hard-code the literal `'devalbo'` as a named constant `POD_NAMESPACE` at the top of `solid.ts` as a temporary marker — never a silent default.

**`packages/solid-client/tests/ldp-persister.test.ts`** (untracked — already exists)

Every call to `new SolidLdpPersister(podRoot, fetchFn)` must become `new SolidLdpPersister(podRoot, 'devalbo', fetchFn)`. Search the file and update all occurrences.

**`packages/solid-client/tests/ldp-synchronizer.test.ts`** (untracked — already exists)

Every call to `new SolidLdpSynchronizer(store, session)` must become `new SolidLdpSynchronizer(store, session, 'devalbo')`. The tests will fail to compile otherwise — fix all occurrences.

**`naveditor-web/src/App.tsx`**

Four changes:

1. Add imports at the top:
   ```ts
   import { AppConfigProvider, useAppConfig } from '@devalbo/state';
   import { defaultAppConfig } from './config';
   ```

2. In `AppContent` (which is inside `AppConfigProvider`), add `useAppConfig`:
   ```ts
   const config = useAppConfig();
   ```

3. In `AppContent`'s `useEffect` for `SolidLdpSynchronizer`, pass `podNamespace` and sync config:
   ```ts
   // BEFORE:
   sync = new SolidLdpSynchronizer(store, session);
   sync.start();

   // AFTER:
   sync = new SolidLdpSynchronizer(store, session, config.podNamespace, config.sync.social);
   sync.start();
   ```

4. In `App`, wrap with `AppConfigProvider` and use `config.storageKey` for the persister:
   ```tsx
   // BEFORE:
   const persister = createLocalPersister(store, 'devalbo-store');
   ...
   return (
     <SolidSessionProvider>
       <AppContent store={store} />
     </SolidSessionProvider>
   );

   // AFTER:
   const persister = createLocalPersister(store, defaultAppConfig.storageKey);
   ...
   return (
     <AppConfigProvider config={defaultAppConfig}>
       <SolidSessionProvider>
         <AppContent store={store} />
       </SolidSessionProvider>
     </AppConfigProvider>
   );
   ```
   Note: `App` uses `defaultAppConfig` directly (it cannot call `useAppConfig()` because it renders the provider). `AppContent` uses the hook.

**`naveditor-desktop/src/App.tsx`**

Same changes as `naveditor-web/src/App.tsx` except:
- There is no `createLocalPersister` call in the current desktop App — omit change 4's persister line.
- Import `defaultAppConfig` from `'./config'` (desktop's own config file).

**`naveditor-lib/src/components/social/SolidSyncBar.tsx`**

Update `runPush` and `runPull` to pass `podNamespace`. Add `useAppConfig` import:

```ts
// Add import:
import { useAppConfig, ... } from '@devalbo/state';  // add useAppConfig to existing import

// In component body, add:
const config = useAppConfig();

// In runPush, change:
const summary = await podPush(store, session);
// To:
const summary = await podPush(store, session, config.podNamespace);

// In runPull, change:
const summary = await podPull(store, session);
// To:
const summary = await podPull(store, session, config.podNamespace);
```

#### Automated verification

```bash
pnpm --filter @devalbo/solid-client build
pnpm --filter @devalbo/solid-client test
pnpm --filter naveditor test
pnpm --filter naveditor-web build
```

All must pass without TypeScript errors or test failures.

#### Human verification

1. Run `pnpm --filter naveditor-web dev`.
2. Open browser — app loads, no console errors.
3. If a Solid session was previously active, the green "Connected:" badge must still appear after page reload, confirming SolidLdpSynchronizer still starts correctly.

---

### Step 3 — Build `sync-root-resolver.ts`

#### Files to CREATE

**`packages/solid-client/src/sync-root-resolver.ts`**

```ts
import type { SyncRoot, AbsolutePath, PodUrl } from '@devalbo/shared';
import { AbsolutePathSchema, PodUrlSchema } from '@devalbo/shared';

// Returns the unique enabled root whose localPath covers the given localPath.
// Because roots are enforced to be non-overlapping, at most one root matches.
// Returns null if no enabled root covers the path.
// Defensive: skips any root whose localPath does not end with '/' (malformed — should not exist
// given files-root-add validation, but guard here to avoid silent bad matches).
export const findSyncRoot = (localPath: AbsolutePath, roots: SyncRoot[]): SyncRoot | null => {
  // Normalize: ensure the input ends with '/' when it represents a directory,
  // but leave file paths as-is. The startsWith check is segment-safe because
  // root.localPath always ends with '/'.
  const matches = roots.filter(r =>
    r.enabled &&
    r.localPath.endsWith('/') &&   // defensive: skip malformed roots
    localPath.startsWith(r.localPath)
  );
  return matches[0] ?? null;  // at most one match given non-overlapping invariant
};

// Returns every pair [a, b] (each pair listed once) where a.localPath and b.localPath
// overlap — i.e., one is a prefix of the other. Used by files-root-add validation
// and the SolidLdpFileSynchronizer constructor.
export const findRootConflicts = (roots: SyncRoot[]): Array<[SyncRoot, SyncRoot]>;

// Converts a local absolute path to its pod URL using the given root.
// Splits the relative portion by '/', percent-encodes each segment individually
// (never encodes the '/' separator), and appends to root.podUrl.
export const localPathToPodUrl = (localPath: AbsolutePath, root: SyncRoot): PodUrl => {
  const relative = localPath.slice(root.localPath.length);
  const encoded = relative.split('/').map(encodeURIComponent).join('/');
  return PodUrlSchema.parse(`${root.podUrl}${encoded}`);
};

// Converts a pod resource URL back to a local absolute path.
// Returns null if podUrl is not under root.podUrl.
export const podUrlToLocalPath = (podUrl: PodUrl, root: SyncRoot): AbsolutePath | null => {
  if (!podUrl.startsWith(root.podUrl)) return null;
  const relative = podUrl.slice(root.podUrl.length);
  const decoded = relative.split('/').map(decodeURIComponent).join('/');
  return AbsolutePathSchema.parse(`${root.localPath}${decoded}`);
};
```

**`packages/solid-client/tests/sync-root-resolver.test.ts`**

Write unit tests covering:
- `findSyncRoot` with non-overlapping roots `/work/` and `/personal/` — `/work/foo` returns the `/work/` root; `/personal/bar` returns the `/personal/` root; `/tmp/scratch` returns `null`.
- `findSyncRoot` ignores roots where `enabled: false`.
- `localPathToPodUrl` with a path segment containing spaces and special characters — e.g., `'hello world'` must become `'hello%20world'` in the URL but the `/` separator must not be encoded.
- `podUrlToLocalPath` returns `null` for a URL not under `root.podUrl`.
- Round-trip: `podUrlToLocalPath(localPathToPodUrl(p, root), root) === p` for valid paths.
- `findRootConflicts` returns `[[A, B]]` when root A is `/work/` and root B is `/work/project/` (B is under A).
- `findRootConflicts` returns `[]` for roots `/work/` and `/personal/` (independent).
- `findRootConflicts` returns `[]` for a single root.

#### Files to MODIFY

**`packages/solid-client/src/index.ts`** — add one line:

```ts
export * from './sync-root-resolver';
```

#### Automated verification

```bash
pnpm --filter @devalbo/solid-client test
```

The test script runs `vitest run tests`. All tests in the package (including the new `sync-root-resolver.test.ts`) must pass. The test runner is Vitest — do not use `--testPathPattern` (Jest flag).

#### Human verification

None required at this step — the module has no UI.

---

### Step 4 — Build `SolidLdpFilePersister`

#### Files to CREATE

**`packages/solid-client/src/ldp-file-persister.ts`**

```ts
import type { PodUrl, ByteCount } from '@devalbo/shared';
import type { PodETag, RelativePath } from './types';

type FetchFn = typeof globalThis.fetch;

export class SolidLdpFilePersister {
  // podContainerUrl is the root's podUrl (caller resolves sync root before constructing).
  constructor(private readonly podContainerUrl: PodUrl, private readonly fetchFn: FetchFn) {}

  // Creates intermediate containers so that relativePath can be written.
  // E.g., ensurePath('src/components/') creates 'src/' then 'src/components/' under podContainerUrl.
  async ensurePath(relativePath: RelativePath): Promise<void>

  async putFile(relativePath: RelativePath, content: Uint8Array, mimeType?: string): Promise<{ etag: PodETag | null }>
  async getFile(relativePath: RelativePath): Promise<{ content: Uint8Array; etag: PodETag | null } | null>
  async statFile(relativePath: RelativePath): Promise<{ etag: PodETag | null; size: ByteCount } | null>
  async deleteFile(relativePath: RelativePath): Promise<void>

  // MVP: recursively lists all resources (not containers) under podContainerUrl.
  // Returns paths relative to podContainerUrl.
  // Post-MVP: replace with manifest-based listing once recursive traversal is a bottleneck.
  async listFiles(dirRelativePath?: RelativePath): Promise<Array<{ path: RelativePath; etag: PodETag | null; size: ByteCount }>>

  // Deletes every resource under podContainerUrl recursively. Used by files-root-remove delete-from-pod.
  async deleteAll(): Promise<void>
}
```

Implementation notes:
- `putFile`: call `ensurePath` for the parent directory, then PUT with `Content-Type: mimeType ?? 'application/octet-stream'`. Capture `ETag` from the response header for use as a change indicator.
- `getFile`: GET the resource, return raw bytes as `Uint8Array` and `etag` from `ETag` response header. If server does not return `ETag`, fall back to `Last-Modified` as a string. Return `null` on 404.
- `listFiles`: distinguish LDP containers (URLs ending in `/`) from resources; recurse into containers. Paginate via `link rel="next"` header (same pattern as `SolidLdpPersister.listContainerMembers`). Return `etag` from container members' `ETag` fields in the JSON-LD body, or null if absent.
- `statFile`: HEAD request; read `Content-Length` and `ETag` headers.
- `deleteAll`: call `listFiles()`, DELETE each resource. Does not DELETE the container itself.
- **Do not implement** `getManifest` / `putManifest` in the MVP.

**`packages/solid-client/tests/ldp-file-persister.test.ts`**

Write unit tests with a mocked `fetch`. Cover:
- `putFile` sends PUT with correct `Content-Type`.
- `getFile` returns `null` on 404; returns bytes and `etag` on 200.
- `listFiles` correctly recurses through nested LDP containers and follows `link rel="next"` pagination.
- `ensurePath` makes POST requests for each container level, depth-first.
- `deleteAll` issues DELETE for every resource returned by `listFiles`.

#### Files to MODIFY

**`packages/solid-client/src/index.ts`** — add one line:

```ts
export * from './ldp-file-persister';
```

#### Automated verification

```bash
pnpm --filter @devalbo/solid-client test
```

All tests in the package must pass. The test runner is Vitest (`vitest run tests`).

#### Human verification

None required at this step — the class has no UI.

---

### Step 5 — Build shared file sync ops and `SolidLdpFileSynchronizer`

#### Files to CREATE

This step has two sub-parts: first create the shared ops module (eliminates duplicate logic), then the synchronizer that delegates to it.

#### Files to CREATE

**`packages/solid-client/src/ldp-file-sync-ops.ts`** (shared logic — no duplication)

This module contains the traversal and write logic used by both the live synchronizer and CLI commands. Neither the synchronizer nor the CLI commands reimplement this logic.

```ts
import type { SyncRoot, IFilesystemDriver, IConnectivityService,
              SyncRootId, AbsolutePath, PodETag, ContentHash } from '@devalbo/shared';
import type { SolidSession } from './session';
import type { Store } from 'tinybase';
import { SolidLdpFilePersister } from './ldp-file-persister';
import { localPathToPodUrl, podUrlToLocalPath } from './sync-root-resolver';
import { setFileSyncState, deleteFileSyncState, getFileSyncState } from '@devalbo/state';

export type FileSyncSummary = {
  rootId: SyncRootId;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
};

// Pushes all local files under root.localPath to the pod. Updates file_sync_state.
export const pushFilesForRoot = async (
  root: SyncRoot,
  session: SolidSession,
  driver: IFilesystemDriver,
  store: Store
): Promise<FileSyncSummary>

// Pulls all files from the pod for root.podUrl into root.localPath. Updates file_sync_state.
// Conflict detection — two-step:
//   1. ETag pre-check (statFile): if pod ETag matches stored podEtag → skip (no download).
//   2. If ETag differs: download, compute SHA-256. If SHA-256 matches stored contentHash → server
//      quirk; update podEtag only. If SHA-256 differs and local status='pending_upload' → conflict.
//      If SHA-256 differs and local status='synced' → overwrite local, update podEtag+contentHash.
export const pullFilesForRoot = async (
  root: SyncRoot,
  session: SolidSession,
  driver: IFilesystemDriver,
  store: Store
): Promise<FileSyncSummary>

// Resolves a conflict for a specific local file path.
export const resolveFileConflict = async (
  localPath: AbsolutePath,
  resolution: 'keep-local' | 'keep-pod' | 'keep-both',
  root: SyncRoot,
  session: SolidSession,
  driver: IFilesystemDriver,
  store: Store
): Promise<void>
```

SHA-256 hashing: use `crypto.subtle.digest('SHA-256', bytes)` (available in browser and modern Node). Store as hex string in `file_sync_state.contentHash`.

**`packages/solid-client/src/ldp-file-synchronizer.ts`**

Delegates `pushAll`, `pullAll`, and `resolveConflict` to `ldp-file-sync-ops`. Handles watcher events, debounce, polling, and offline queuing.

```ts
import type { SyncRoot, AppConfig, IFilesystemDriver, IWatcherService, IConnectivityService } from '@devalbo/shared';
import type { SolidSession } from './session';
import type { Store } from 'tinybase';
// Note: findSyncRoot is NOT imported here — the constructor validates no overlap exists,
// so the watcher handler needs no runtime path routing. Import findRootConflicts instead.
import { findRootConflicts } from './sync-root-resolver';
import { pushFilesForRoot, pullFilesForRoot, resolveFileConflict, type FileSyncSummary } from './ldp-file-sync-ops';
export type { FileSyncSummary };

export class SolidLdpFileSynchronizer {
  constructor(
    private readonly root: SyncRoot,
    private readonly allRoots: SyncRoot[],
    private readonly session: SolidSession,
    private readonly store: Store,
    private readonly driver: IFilesystemDriver,
    private readonly watcher: IWatcherService,
    private readonly syncConfig: AppConfig['sync']['files'],
    private readonly connectivity: IConnectivityService   // required — caller passes BrowserConnectivityService or AlwaysOnlineConnectivityService explicitly
  ) {}

  start(): void   // attaches watcher handler + starts polling interval + registers connectivity.onOnline once
  stop(): void    // detaches watcher handler + clears interval + calls the onOnline unsubscribe returned by start

  pushAll(): Promise<FileSyncSummary>   // delegates to pushFilesForRoot
  pullAll(): Promise<FileSyncSummary>   // delegates to pullFilesForRoot
  resolveConflict(path: AbsolutePath, resolution: 'keep-local' | 'keep-pod' | 'keep-both'): Promise<void>  // delegates to resolveFileConflict
}
```

**Watcher handler (outbound, local → pod):**

```ts
private handleWatchEvent = (event: WatchEvent): void => {
  // No path-routing check needed — the constructor validated no root overlaps,
  // so every event under root.localPath belongs unambiguously to this root.
  if (this.root.readonly) return;
  // Debounce per path:
  this.scheduleOutbound(event.path, event.type);
};
```

- On `Created`/`Modified`: read file, compute SHA-256. If hash matches `file_sync_state.contentHash` → skip (no real change). Otherwise: if `connectivity.isOnline()` → `persister.putFile(...)`, set state `status: 'synced'`, update `contentHash`. If offline → set `status: 'pending_upload'` (the `onOnline` handler registered in `start()` will call `flushQueue()` when connectivity returns — no additional registration here).
- On `Deleted`: if online → `persister.deleteFile(...)`, delete state row. If offline → set `status: 'pending_delete'` (same `onOnline` handler covers flush).
- `suppressOutbound` flag prevents echo writes during inbound poll.

**Inbound poll** delegates to `pullFilesForRoot` with `suppressOutbound = true` guard. After the call, clears `suppressOutbound`.

**`packages/solid-client/tests/ldp-file-sync-ops.test.ts`** and **`packages/solid-client/tests/ldp-file-synchronizer.test.ts`**

For `ldp-file-sync-ops.test.ts`:
- `pushFilesForRoot` reads all driver files, calls `persister.putFile` for each, and updates `contentHash` and `podEtag` in state.
- `pullFilesForRoot`: when pod ETag matches stored `podEtag` → skips download entirely (no stat/download call).
- `pullFilesForRoot`: when pod ETag differs but SHA-256 of downloaded bytes matches stored `contentHash` → updates `podEtag` only, does not change file or status (server re-upload with identical content).
- `pullFilesForRoot`: when pod ETag differs and SHA-256 differs with local `status: 'pending_upload'` → sets `status: 'conflict'`, does not overwrite either side.
- `pullFilesForRoot`: when pod ETag differs and SHA-256 differs with local `status: 'synced'` → overwrites local file, updates `podEtag` and `contentHash`.
- `resolveFileConflict('keep-both')` renames local file with `.local.` infix and downloads pod version.

For `ldp-file-synchronizer.test.ts`:
- Constructor throws when `allRoots` contains a root whose `localPath` is a prefix of (or equal to) `root.localPath`, and logs the conflicting root IDs.
- Constructor throws when `allRoots` contains a root whose `localPath` starts with `root.localPath` (current root is a prefix of another), and logs the conflicting root IDs.
- Constructor succeeds when all roots in `allRoots` are non-overlapping with `root.localPath`.
- When `connectivity.isOnline()` returns `false`, events set `status: 'pending_upload'` instead of calling persister.
- `pushAll()` and `pullAll()` delegate to the ops functions (verify via spy/mock).
- `flushQueue` is called when `connectivity.onOnline` fires.

#### Files to MODIFY

**`packages/solid-client/src/index.ts`** — add two lines:

```ts
export * from './ldp-file-sync-ops';
export * from './ldp-file-synchronizer';
```

**`packages/shared/src/types/environment.ts`** (or `packages/shared/src/environment/connectivity.ts`) — add:

```ts
export interface IConnectivityService {
  isOnline(): boolean;
  onOnline(callback: () => void): () => void;  // returns unsubscribe
}

// Always returns online — use in tests and CLI contexts.
export class AlwaysOnlineConnectivityService implements IConnectivityService {
  isOnline() { return true; }
  onOnline() { return () => {}; }
}

// Browser implementation — use in naveditor-web.
export class BrowserConnectivityService implements IConnectivityService {
  isOnline() { return navigator.onLine; }
  onOnline(cb: () => void) {
    window.addEventListener('online', cb);
    return () => window.removeEventListener('online', cb);
  }
}
```

Export both from `packages/shared/src/index.ts`.

#### Automated verification

```bash
pnpm --filter @devalbo/solid-client test
```

All tests in the package must pass. The test runner is Vitest (`vitest run tests`).

#### Human verification

None required at this step — the class has no UI.

---

### Step 6 — CLI commands

#### Files to CREATE

**`naveditor-lib/src/commands/files.ts`**

Export a `filesCommands` record with these keys (all `AsyncCommandHandler`):

| Command | Required args | Optional flags | Behavior |
|---|---|---|---|
| `files-root-add` | `<localPath> <podUrl>` | `--label <label>`, `--readonly`, `--web-id <webId>` | Both args required. Errors if either is missing, if either does not end with `/`, if `localPath` overlaps any existing root's `localPath` (one is a prefix of the other), or if `podUrl` overlaps with the app's social data namespace (see Architecture). Creates a `SyncRoot` with a new UUID, saves via `setSyncRoot(store, root)`. |
| `files-root-list` | none | none | Calls `listSyncRoots(store)`, renders a table: id (first 8 chars), label, localPath, podUrl, enabled ✓/✗. |
| `files-root-enable` | `<rootId>` | none | Calls `setSyncRoot(store, { ...existing, enabled: true })`. Errors if root not found. |
| `files-root-disable` | `<rootId>` | none | Same but `enabled: false`. |
| `files-root-remove` | `<rootId> <keep-pod\|delete-from-pod>` | none | Second arg is **required** — error if missing or invalid. `keep-pod`: calls `deleteSyncRoot(store, rootId)`. `delete-from-pod`: constructs `SolidLdpFilePersister` for the root's `podUrl`, calls `persister.deleteAll()`, then calls `deleteSyncRoot`. |
| `files-push` | none | `--root <rootId>` | If `--root` given, push one root; otherwise push all enabled roots. **Delegates to `pushFilesForRoot`** from `@devalbo/solid-client` — does not reimplement traversal. Reports count per root. |
| `files-pull` | none | `--root <rootId>` | If `--root` given, pull one root; otherwise pull all enabled roots. **Delegates to `pullFilesForRoot`** from `@devalbo/solid-client`. Reports count per root. |
| `files-status` | none | `--root <rootId>` | Renders per-root table of `file_sync_state` rows: path, status (synced ✓ / pending ↑ / conflict ⚠). |
| `files-resolve` | `<filePath> <keep-local\|keep-pod\|keep-both>` | none | Both args **required** — error if either missing or second arg is not one of the three values. **Delegates to `resolveFileConflict`** from `@devalbo/solid-client`. |

All commands that require a store must check `hasStore(options)` (same pattern as `solid.ts`). Commands that need a session must check `options?.session?.isAuthenticated`. Commands that call `pushFilesForRoot`/`pullFilesForRoot` need store, session, **and `options.driver`** (IFilesystemDriver) — error with a clear message if driver is absent. `files-push` and `files-pull` also use `options.connectivity` for offline handling — fall back to `AlwaysOnlineConnectivityService` if absent (CLI context is always online).

**`naveditor-lib/src/commands/app.ts`**

```ts
export const appCommands = {
  'app-config': async (_args, options) => {
    // Read config from options or fall back to a stub message if not wired yet.
    // Display each AppConfig field as key: value lines.
    ...
  }
} satisfies Record<'app-config', AsyncCommandHandler>;
```

Note: `app-config` reads config from `ExtendedCommandOptions`. The calling context (`InteractiveShell`) must pass config in options — see Step 7. For now, render a stub message if config is absent.

**`naveditor/tests/unit/commands/files.test.ts`**

Write tests covering:
- `files-root-add` with no args errors with usage message.
- `files-root-add` with a `localPath` not ending in `/` errors.
- `files-root-remove` with only one arg (missing second) errors.
- `files-root-remove` with second arg that is not `keep-pod` or `delete-from-pod` errors.
- `files-resolve` with no args errors.
- `files-resolve` with an invalid resolution arg errors.
- `files-root-list` with empty store renders an empty table (no crash).

#### Files to MODIFY

**`naveditor-lib/src/commands/index.ts`**

Add imports and include in the map:

```ts
// Add imports:
import { filesCommands } from './files';
import { appCommands } from './app';

// Add to CoreCommandName union:
| keyof typeof filesCommands
| keyof typeof appCommands

// Add to baseCommands spread:
...filesCommands,
...appCommands,
```

#### Automated verification

```bash
pnpm --filter naveditor test:unit
pnpm --filter naveditor-web build
```

`test:unit` runs `node tests/scripts/run-unit.mjs` (Vitest, not Jest). All new tests must pass and build must succeed without TypeScript errors. To run only the files command tests during development: `pnpm --filter naveditor exec vitest run tests/unit/commands/files.test.ts`.

#### Human verification

1. Open the terminal tab in the app.
2. Run `files-root-list` — must print an empty table without error.
3. Run `files-root-add /test/ https://example.com/files/` — must succeed and print the new root's id.
4. Run `files-root-list` — must show the newly added root.
5. Run `files-root-remove` (no args) — must print an error with usage instructions.
6. Run `files-root-remove <id>` (one arg, no second) — must print an error requiring `keep-pod` or `delete-from-pod`.
7. Run `app-config` — must display config fields without error.

---

### Step 7 — Wire file synchronizers into `App.tsx`

This step enables live file sync to activate when the user has sync roots defined and a matching Solid session.

#### Files to MODIFY

**`naveditor-lib/src/components/social/FileSyncContext.tsx`** (new file)

Define the context that exposes synchronizer instances to descendant components (needed by `SyncRootsPanel` in Step 8):

```tsx
import { createContext, useContext } from 'react';
import type { SyncRootId } from '@devalbo/shared';
import type { SolidLdpFileSynchronizer } from '@devalbo/solid-client';

export type FileSyncMap = Map<SyncRootId, SolidLdpFileSynchronizer>;

export const FileSyncContext = createContext<FileSyncMap>(new Map());

export const useFileSyncMap = (): FileSyncMap => useContext(FileSyncContext);
```

There is no `naveditor-lib/src/index.ts` barrel — do not create one. Consumers import directly from the file path using the existing `@/` alias (which resolves to `naveditor-lib/src/`):

```ts
import { FileSyncContext, useFileSyncMap, type FileSyncMap } from '@/components/social/FileSyncContext';
```

**`naveditor-web/src/App.tsx`** — inside `AppContent`:

1. Add state for the sync map and a reactive snapshot of sync roots:

```tsx
const [fileSyncMap, setFileSyncMap] = useState<FileSyncMap>(() => new Map());

// Reactive snapshot of the sync_roots TinyBase table.
// Re-renders (and re-runs the synchronizer effect) whenever roots are added, removed, or edited.
const [syncRoots, setSyncRoots] = useState<SyncRoot[]>(() => listSyncRoots(store));
useEffect(() => {
  const listenerId = store.addTableListener(SYNC_ROOTS_TABLE, () => {
    setSyncRoots(listSyncRoots(store));
  });
  return () => store.delListener(listenerId);
}, [store]);
```

2. Replace the simple synchronizer `useEffect` with one that also populates the context:

```tsx
import { listSyncRoots, SYNC_ROOTS_TABLE } from '@devalbo/state';
import { SolidLdpFileSynchronizer } from '@devalbo/solid-client';
import { BrowserConnectivityService } from '@devalbo/shared';
import { FileSyncContext, type FileSyncMap } from '@/components/social/FileSyncContext';

// In AppContent, after the SolidLdpSynchronizer useEffect:
useEffect(() => {
  if (!session?.isAuthenticated || !config.features.fileSync) {
    setFileSyncMap(new Map());
    return;
  }

  const allRoots = syncRoots;
  const activeRoots = allRoots.filter(r => r.enabled && r.webId === session.webId);
  const connectivity = new BrowserConnectivityService();

  const newMap: FileSyncMap = new Map();
  for (const root of activeRoots) {
    try {
      newMap.set(root.id, new SolidLdpFileSynchronizer(
        root, allRoots, session, store, driver, watcher, config.sync.files, connectivity
      ));
    } catch (err) {
      console.warn(`[FileSyncMap] Skipping root ${root.id} (${root.localPath}): constructor threw`, err);
    }
  }

  setFileSyncMap(newMap);
  for (const sync of newMap.values()) sync.start();
  return () => { for (const sync of newMap.values()) sync.stop(); setFileSyncMap(new Map()); };
  // store, driver, watcher are stable singleton refs constructed at AppContent mount — safe to
  // include in deps (they never change, so adding them causes no extra re-runs).
}, [session, syncRoots, config, store, driver, watcher]);
```

3. Wrap the JSX tree with the context provider:

```tsx
<FileSyncContext.Provider value={fileSyncMap}>
  {/* existing JSX: StoreContext.Provider, tabs, etc. */}
</FileSyncContext.Provider>
```

Note: `driver` and `watcher` must be in scope. Construct a `BrowserStoreFSDriver` at `AppContent` mount if not already available. Check the existing `FileExplorer` for how these are currently obtained and thread them to `AppContent` if needed.

4. Wire `app-config` command and file sync CLI dependencies: in `InteractiveShell.tsx`, where `ExtendedCommandOptions` is built, add `config`, `driver`, and `connectivity`. In `_util.tsx`, update `CommandOptionsBase`:

```ts
// Add to CommandOptionsBase (naveditor-lib/src/commands/_util.tsx):
config?: AppConfig;
driver?: IFilesystemDriver;          // required by files-push, files-pull, files-resolve, files-root-remove delete-from-pod
connectivity?: IConnectivityService; // used by files-push, files-pull; if absent, commands fall back to AlwaysOnlineConnectivityService
// Note: watcher is NOT part of CommandOptionsBase — it is only needed by SolidLdpFileSynchronizer (the live sync),
// not by one-shot push/pull/resolve commands which call the shared ops functions directly.
```

How `driver` is constructed per runtime:

| Runtime | Driver class | Where constructed |
|---|---|---|
| Browser (`naveditor-web`) | `BrowserStoreFSDriver` | `InteractiveShell.tsx` at component mount, or reuse from `FileExplorer` |
| Desktop (`naveditor-desktop`) | `TauriFSDriver` | `InteractiveShell.tsx` at component mount |

How `connectivity` is constructed per runtime:

| Runtime | Class | Where constructed |
|---|---|---|
| Browser | `BrowserConnectivityService` | `InteractiveShell.tsx` at component mount |
| Desktop | `TauriConnectivityService` (or `AlwaysOnlineConnectivityService` stub) | `InteractiveShell.tsx` at component mount |

Both are constructed once at `InteractiveShell` mount and passed into every `ExtendedCommandOptions` call — commands do not construct these themselves.

**`naveditor-desktop/src/App.tsx`** — same synchronizer wiring as the web app, using `TauriFSDriver`, the appropriate `IWatcherService` for desktop, and a `TauriConnectivityService` (or `AlwaysOnlineConnectivityService` as a stub until desktop connectivity detection is implemented).

#### Automated verification

```bash
pnpm --filter naveditor-web build
pnpm --filter naveditor-desktop build
```

Both builds must succeed without TypeScript errors.

#### Human verification

1. In the app (web), with `features.fileSync` still `false` (default in config), open terminal and run `files-root-list`. Confirm that no synchronizers start even if roots are defined (sync is gated on the feature flag).
2. Temporarily set `features.fileSync: true` in `naveditor-web/src/config.ts`, rebuild, and add a sync root via `files-root-add`. Confirm no console errors appear when the session becomes active.
3. Revert `features.fileSync` to `false` for the remaining steps (the flag is off by default).

---

### Step 8 — Sync Roots UI in File Explorer

#### Files to CREATE

**`naveditor-lib/src/web/SyncRootsPanel.tsx`**

A React component rendered inside `FileExplorer`. Sections:

1. **Root list**: For each `SyncRoot` from `listSyncRoots(store)`, render a row showing label, `localPath → podUrl`, enabled/disabled toggle (calls `files-root-enable` / `files-root-disable` logic via `setSyncRoot`), per-root pending and conflict counts from `listFileSyncStatesForRoot`, and a Delete button (two-step confirm, same inline pattern as `SolidSyncBar`'s "Clear local data").

2. **Add sync root form**: Fields: `localPath` (text input), `podUrl` (text input), `label` (text input), `readonly` (checkbox). `webId` field is collapsed under "Advanced" and defaults to `session?.webId ?? ''`. On submit, validates that both paths end with `/`, creates a UUID, calls `setSyncRoot`. Shows inline error on validation failure.

3. **Per-file status icons** in the existing file tree: For each file entry visible in the tree, look up its `file_sync_state` row. Render a small badge: `✓` (synced), `↑` (pending_upload), `✗` (pending_delete), `⚠` (conflict). Files with no sync state row show no badge.

4. **Conflict resolution panel**: When a file row is in `conflict` status, render an inline panel with three buttons: `keep-local`, `keep-pod`, `keep-both`. Each button calls `useFileSyncMap()` to get the synchronizer for the file's root and calls `.resolveConflict(path, resolution)` on it.

5. **Per-root Pull button**: A "↓ Pull" button per root row. Calls `useFileSyncMap().get(root.id)?.pullAll()`. Shows a loading state while in progress.

6. **Offline banner**: Uses `IConnectivityService` state (or a `useState`/`useEffect` on `window` events for the browser) — **not** `navigator.onLine` directly. If offline and any `file_sync_state` rows have `status: 'pending_upload'`, render: `"Offline — N changes pending"`.

`SyncRootsPanel` obtains synchronizers via `const fileSyncMap = useFileSyncMap()` (defined in Step 7 above). No prop-drilling required.

#### Files to MODIFY

**`naveditor-lib/src/web/FileExplorer.tsx`** (or wherever `FileExplorer` is currently defined)

Add `<SyncRootsPanel />` below the file tree. No extra props needed — `SyncRootsPanel` reads store via `StoreContext`, session via `SolidSessionContext`, and synchronizers via `FileSyncContext`.

#### Automated verification

```bash
pnpm --filter naveditor test:unit
pnpm --filter naveditor-web build
```

No regressions in existing tests. Build succeeds. Run unit tests with `pnpm --filter naveditor test:unit` (Vitest via `run-unit.mjs`).

#### Human verification

1. Open the File Explorer tab. Confirm the Sync Roots panel appears (empty root list if none added).
2. Add a sync root via the form. Confirm it appears in the list below the form.
3. Toggle the enabled/disabled switch on the root. Confirm the row updates.
4. Click Delete on the root (first click) — confirm the row changes to "Confirm delete? | Cancel". Click Cancel — confirm row returns to normal. Click Delete again, then confirm — confirm root is removed.
5. Artificially create a `file_sync_state` row with `status: 'conflict'` (via `files-root-add` then manually editing state, or by triggering a real conflict) and confirm the ⚠ badge and resolution panel appear for that file.
6. Disable `navigator.onLine` (DevTools → Network → Offline). Create a new local file. Confirm the "Offline — N changes pending" banner appears. Re-enable network. Confirm the banner disappears and the file is uploaded.

---

## Concerns and Trade-offs

### Multiple Solid sessions
Roots can point to different WebIDs. The app currently holds a single session. This plan surfaces roots with a non-matching WebID as "inactive" rather than erroring. Full multi-session support (holding concurrent authenticated sessions) is a future enhancement.

### Content-Type fidelity
Use `inferMimeTypeFromPath` (already in the codebase) for PUT requests; fall back to `application/octet-stream`. Round-tripping must not corrupt binary files — always transfer as `Uint8Array`.

### Large files
Warn before uploading files over `config.sync.files.maxFileSizeBytes`. The `files-push` command surfaces this as a warning with a `--force` flag to proceed anyway. Very large binary assets (video, datasets) are out of scope.

### File deletions from pod
Auto-delete locally only if `file_sync_state.status === 'synced'`. If local status is `pending_upload` or `conflict`, do not auto-delete — prompt instead (or, in CLI, error with a clear message and require `files-resolve` first).

### No directory objects on pod
LDP containers represent directories but cannot hold metadata via PUT. Directory-level metadata is out of scope.

### Path encoding
The resolver handles encoding/decoding at the HTTP boundary. The store, state tables, and CLI always use decoded local paths as keys.

### Watcher limitations
`WatchEventType.Moved` is never emitted. Rename/move appears as Deleted + Created, causing a delete + re-upload on the pod. Acceptable for now; LDP MOVE support is a future enhancement.

### Manifest strategy (post-MVP)
The per-root file manifest is deferred to a post-MVP optimization. MVP uses recursive `listFiles()` (LDP container traversal) for all pull operations. This adds latency for large pods but simplifies the MVP. When manifest support is added, the naming convention (`_manifest.json` prefix) must be validated against target Solid servers — some may reject filenames beginning with `_`.

### Privacy
Root pod containers should be created with private ACL (owner-only) by default. `ensureContainer` should write an explicit ACL after creating a new container rather than relying on inheritance.

---

## Design Decisions (answers to pre-implementation questions)

| Question | Decision |
|---|---|
| **Single source of truth for push/pull API** | `@devalbo/solid-client` owns all pod I/O classes (`SolidLdpPersister`, `SolidLdpFilePersister`, `SolidLdpSynchronizer`, `SolidLdpFileSynchronizer`). Two thin adapter modules call into these: `packages/solid-client/src/pod-sync.ts` for the UI (`SolidSyncBar` push/pull buttons) and `naveditor-lib/src/lib/pod-sync.ts` for the CLI (`solid-pod-push`/`solid-pod-pull` commands). Both adapters call `SolidLdpPersister` directly — neither delegates to the other. File sync CLI commands (`files-push`/`files-pull`) bypass both adapters and call `pushFilesForRoot`/`pullFilesForRoot` from `@devalbo/solid-client` directly. |
| **Canonical internal path format** | POSIX-style: forward slash, absolute paths start with `/`, dirs end with `/`. All desktop/Windows paths are normalized to this format at the driver boundary using `toCanonicalPath`/`fromCanonicalPath`. |
| **Manifest in MVP** | No. MVP uses recursive `listFiles()` (full LDP traversal). Manifest is a post-MVP optimization. |
| **Default pod URL in `files-root-add`** | No defaults — both `<localPath>` and `<podUrl>` are required. The user must make an explicit choice. The command errors on missing args or missing trailing slash. |
| **CLI commands use synchronizer methods** | CLI `files-push`/`files-pull`/`files-resolve` call shared functions from `ldp-file-sync-ops.ts` directly — same code path as `SolidLdpFileSynchronizer.pushAll()`/`pullAll()`. The synchronizer is not a dependency of the CLI; both depend on the shared ops layer. |
| **Social data isolation** | Social data (persona, contacts, groups) lives at `{podRoot}/{podNamespace}/` and is managed exclusively by `SolidLdpSynchronizer`. File sync roots **may** use `{podNamespace}/files/` or any sub-container of it — this is the intended file sync namespace. File sync roots must **not** use any other path directly under `{podNamespace}/` (e.g., `contacts/`, `groups/`, bare `{podNamespace}/` itself). On the local filesystem, roots must not overlap with `config.socialLocalPath`. Both guards are enforced at `files-root-add` time. |

---

## Stretch Goal: Sharing Files with Contacts

A sync root marked `readonly: true` cleanly models receiving a shared folder. The app already holds contact WebIDs and can write ACLs.

**Sharing out:**
1. User runs `files-share <localPath> <contactId> <read|write>` (new command), or uses the File Explorer context menu → "Share with contact…".
2. App writes a WAC `.acl` or ACP policy granting the contact's WebID the requested access on the resource or container.

**Receiving a share:**
1. Contact delivers a pod URL via the existing ActivityPub card mechanism.
2. User runs `files-root-add /shared/alice-project/ <sharedPodUrl> --label "Alice's project" --readonly`.
3. `files-pull --root <rootId>` downloads the contents.

**Concerns:**
- WAC vs ACP: solidcommunity.net uses WAC; CSS 7+ supports ACP. Need to detect which the pod supports.
- The receiving contact must have a Solid account to access the ACL-protected resource.
- Revoking: user runs `files-unshare <localPath> <contactId>` (removes the ACL entry).

This feature depends on this plan being completed first.
