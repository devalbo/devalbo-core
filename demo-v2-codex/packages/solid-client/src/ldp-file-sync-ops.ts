import type { Store } from 'tinybase';
import {
  deleteFileSyncState,
  getFileSyncState,
  listFileSyncStatesForRoot,
  setFileSyncState
} from '@devalbo/state';
import type {
  AbsolutePath,
  ContentHash,
  IConnectivityService,
  PodETag,
  RelativePath,
  SyncRoot,
  SyncRootId
} from '@devalbo/shared';
import {
  unsafeAsAbsolutePath,
  unsafeAsContentHash,
  unsafeAsDirectoryPath,
  unsafeAsFilePath,
  unsafeAsRelativePath
} from '@devalbo/shared';
import type { IFilesystemDriver } from '@devalbo/filesystem';
import { SolidLdpFilePersister } from './ldp-file-persister';

export type FileSyncSummary = {
  rootId: SyncRootId;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
};

const inferMimeTypeFromPath = (path: string): string => {
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.jsonld')) return 'application/ld+json';
  if (path.endsWith('.txt') || path.endsWith('.md') || path.endsWith('.ts') || path.endsWith('.tsx')) {
    return 'text/plain; charset=utf-8';
  }
  return 'application/octet-stream';
};

const toRelativePath = (absolutePath: AbsolutePath, root: SyncRoot): RelativePath =>
  unsafeAsRelativePath(absolutePath.slice(root.localPath.length));

const toAbsolutePath = (relativePath: RelativePath, root: SyncRoot): AbsolutePath =>
  unsafeAsAbsolutePath(`${root.localPath}${relativePath}`);

const toHex = (bytes: Uint8Array): string => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256 = async (bytes: Uint8Array): Promise<ContentHash> => {
  const stableBytes = new Uint8Array(bytes);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', stableBytes);
    return unsafeAsContentHash(toHex(new Uint8Array(digest)));
  }
  // Fallback hash for runtimes without WebCrypto.
  let hash = 2166136261;
  for (const byte of stableBytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return unsafeAsContentHash(hash.toString(16).padStart(64, '0').slice(0, 64));
};

const listLocalFiles = async (
  driver: IFilesystemDriver,
  dirPath: string
): Promise<AbsolutePath[]> => {
  const entries = await driver.readdir(unsafeAsDirectoryPath(dirPath));
  const out: AbsolutePath[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const next = await listLocalFiles(driver, entry.path);
      out.push(...next);
    } else {
      out.push(unsafeAsAbsolutePath(entry.path));
    }
  }
  return out;
};

const setPending = (
  store: Store,
  path: AbsolutePath,
  rootId: SyncRootId,
  hash: ContentHash,
  status: 'pending_upload' | 'pending_delete'
): void => {
  const prev = getFileSyncState(store, path);
  setFileSyncState(store, {
    path,
    syncRootId: rootId,
    podEtag: prev?.podEtag ?? null,
    contentHash: hash,
    status
  });
};

export const pushFilesForRoot = async (
  root: SyncRoot,
  store: Store,
  driver: IFilesystemDriver,
  fetchFn: typeof fetch,
  connectivity: IConnectivityService
): Promise<FileSyncSummary> => {
  const summary: FileSyncSummary = { rootId: root.id, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
  if (root.readonly) return summary;

  const persister = new SolidLdpFilePersister(root.podUrl, fetchFn);
  const localFiles = await listLocalFiles(driver, root.localPath);
  for (const filePath of localFiles) {
    try {
      const content = await driver.readFile(unsafeAsFilePath(filePath));
      const contentHash = await sha256(content);
      if (!connectivity.isOnline()) {
        setPending(store, filePath, root.id, contentHash, 'pending_upload');
        continue;
      }

      const relativePath = toRelativePath(filePath, root);
      const result = await persister.putFile(relativePath, content, inferMimeTypeFromPath(filePath));
      setFileSyncState(store, {
        path: filePath,
        syncRootId: root.id,
        podEtag: result.etag as PodETag | null,
        contentHash,
        status: 'synced'
      });
      summary.uploaded += 1;
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return summary;
};

export const pullFilesForRoot = async (
  root: SyncRoot,
  store: Store,
  driver: IFilesystemDriver,
  fetchFn: typeof fetch
): Promise<FileSyncSummary> => {
  const summary: FileSyncSummary = { rootId: root.id, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
  const persister = new SolidLdpFilePersister(root.podUrl, fetchFn);
  const remoteFiles = await persister.listFiles();
  const byPath = new Map(listFileSyncStatesForRoot(store, root.id).map((row) => [row.path, row]));

  const seenPaths = new Set<AbsolutePath>();

  for (const remote of remoteFiles) {
    try {
      const absolutePath = toAbsolutePath(remote.path, root);
      seenPaths.add(absolutePath);
      const existing = byPath.get(absolutePath);

      // ETag pre-check: if both sides have an ETag and they match, pod is unchanged — skip download.
      if (existing?.podEtag && remote.etag && existing.podEtag === remote.etag) continue;

      const downloaded = await persister.getFile(remote.path);
      if (!downloaded) continue;
      const remoteHash = await sha256(downloaded.content);

      // SHA-256 same-bytes case: ETag changed (server re-upload) but content is identical — update ETag only.
      if (existing && existing.contentHash === remoteHash) {
        setFileSyncState(store, { ...existing, podEtag: downloaded.etag });
        continue;
      }

      // Real pod change. Check for local conflict.
      if (existing && existing.status === 'pending_upload') {
        setFileSyncState(store, { ...existing, status: 'conflict' });
        summary.conflicts += 1;
        continue;
      }

      // No conflict — overwrite local with pod version.
      await driver.writeFile(unsafeAsFilePath(absolutePath), downloaded.content);
      setFileSyncState(store, {
        path: absolutePath,
        syncRootId: root.id,
        podEtag: downloaded.etag,
        contentHash: remoteHash,
        status: 'synced'
      });
      summary.downloaded += 1;
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Pod-deleted-file cleanup: any tracked file not present in the pod listing was deleted on the pod.
  for (const [path, state] of byPath) {
    if (seenPaths.has(path)) continue;
    if (state.status === 'synced') {
      // Safe to delete locally — no local changes pending.
      try {
        await driver.rm(unsafeAsFilePath(path));
      } catch {
        // Ignore if already gone locally.
      }
      deleteFileSyncState(store, path);
    } else {
      // Local changes pending or already conflicted — mark as conflict rather than silently deleting.
      setFileSyncState(store, { ...state, status: 'conflict' });
      summary.conflicts += 1;
    }
  }

  return summary;
};

export const resolveFileConflict = async (
  localPath: AbsolutePath,
  resolution: 'keep-local' | 'keep-pod' | 'keep-both',
  root: SyncRoot,
  store: Store,
  driver: IFilesystemDriver,
  fetchFn: typeof fetch
): Promise<void> => {
  const state = getFileSyncState(store, localPath);
  if (!state || state.status !== 'conflict') {
    throw new Error(`No conflict found for ${localPath}`);
  }

  const persister = new SolidLdpFilePersister(root.podUrl, fetchFn);
  const relativePath = toRelativePath(localPath, root);

  if (resolution === 'keep-local') {
    const bytes = await driver.readFile(unsafeAsFilePath(localPath));
    const etag = (await persister.putFile(relativePath, bytes, inferMimeTypeFromPath(localPath))).etag;
    setFileSyncState(store, { ...state, podEtag: etag, contentHash: await sha256(bytes), status: 'synced' });
    return;
  }

  const podFile = await persister.getFile(relativePath);
  if (!podFile) throw new Error(`Pod file not found for ${localPath}`);

  if (resolution === 'keep-both') {
    const splitIndex = localPath.lastIndexOf('.');
    const renamed = splitIndex > 0
      ? `${localPath.slice(0, splitIndex)}.local${localPath.slice(splitIndex)}`
      : `${localPath}.local`;
    const bytes = await driver.readFile(unsafeAsFilePath(localPath));
    await driver.writeFile(unsafeAsFilePath(renamed), bytes);
  }

  await driver.writeFile(unsafeAsFilePath(localPath), podFile.content);
  setFileSyncState(store, {
    ...state,
    podEtag: podFile.etag,
    contentHash: await sha256(podFile.content),
    status: 'synced'
  });
};
