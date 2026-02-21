import type { Row, Store } from 'tinybase';
import type { AbsolutePath, ContentHash, PodETag, SyncRootId } from '@devalbo/shared';
import { unsafeAsContentHash } from '@devalbo/shared';

export const FILE_SYNC_STATE_TABLE = 'file_sync_state' as const;

export type FileSyncStatus = 'synced' | 'pending_upload' | 'pending_delete' | 'conflict';

export type FileSyncStateRow = {
  path: AbsolutePath;
  syncRootId: SyncRootId;
  podEtag: PodETag | null;
  contentHash: ContentHash;
  status: FileSyncStatus;
};

const isFileSyncStatus = (value: unknown): value is FileSyncStatus =>
  value === 'synced' || value === 'pending_upload' || value === 'pending_delete' || value === 'conflict';

const parseRow = (path: string, row: Record<string, unknown>): FileSyncStateRow | null => {
  const syncRootId = row.syncRootId;
  const podEtagValue = row.podEtag;
  const contentHash = row.contentHash;
  const status = row.status;

  if (typeof syncRootId !== 'string') return null;
  if (typeof contentHash !== 'string') return null;
  if (!isFileSyncStatus(status)) return null;

  return {
    path: path as AbsolutePath,
    syncRootId: syncRootId as SyncRootId,
    podEtag: typeof podEtagValue === 'string' && podEtagValue.length > 0 ? (podEtagValue as PodETag) : null,
    contentHash: unsafeAsContentHash(contentHash),
    status
  };
};

export const getFileSyncState = (store: Store, path: AbsolutePath): FileSyncStateRow | null => {
  if (!store.hasRow(FILE_SYNC_STATE_TABLE, path)) return null;
  const row = store.getRow(FILE_SYNC_STATE_TABLE, path);
  return parseRow(path, row);
};

export const setFileSyncState = (store: Store, row: FileSyncStateRow): void => {
  store.setRow(FILE_SYNC_STATE_TABLE, row.path, {
    path: row.path,
    syncRootId: row.syncRootId,
    podEtag: row.podEtag ?? '',
    contentHash: row.contentHash,
    status: row.status
  } as Row);
};

export const deleteFileSyncState = (store: Store, path: AbsolutePath): void => {
  store.delRow(FILE_SYNC_STATE_TABLE, path);
};

export const listFileSyncStatesForRoot = (store: Store, rootId: SyncRootId): FileSyncStateRow[] => {
  const table = store.getTable(FILE_SYNC_STATE_TABLE);
  if (!table) return [];
  return Object.entries(table).flatMap(([path, row]) => {
    if ((row as Record<string, unknown>).syncRootId !== rootId) return [];
    const parsed = parseRow(path, row as Record<string, unknown>);
    return parsed ? [parsed] : [];
  });
};
