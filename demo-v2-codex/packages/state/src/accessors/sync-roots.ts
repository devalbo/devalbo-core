import type { Row, Store } from 'tinybase';
import { SyncRootSchema, type SyncRoot, type SyncRootId } from '@devalbo/shared';

export const SYNC_ROOTS_TABLE = 'sync_roots' as const;

export const getSyncRoot = (store: Store, id: SyncRootId): SyncRoot | null => {
  if (!store.hasRow(SYNC_ROOTS_TABLE, id)) return null;
  const row = store.getRow(SYNC_ROOTS_TABLE, id);
  const parsed = SyncRootSchema.safeParse({ id, ...row });
  return parsed.success ? parsed.data : null;
};

export const setSyncRoot = (store: Store, root: SyncRoot): void => {
  const parsed = SyncRootSchema.parse(root);
  const { id, ...row } = parsed;
  store.setRow(SYNC_ROOTS_TABLE, id, row as Row);
};

export const listSyncRoots = (store: Store): SyncRoot[] => {
  const table = store.getTable(SYNC_ROOTS_TABLE);
  if (!table) return [];
  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = SyncRootSchema.safeParse({ id, ...row });
    return parsed.success ? [parsed.data] : [];
  });
};

export const deleteSyncRoot = (store: Store, id: SyncRootId): void => {
  store.delRow(SYNC_ROOTS_TABLE, id);
};
