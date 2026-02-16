import type { Row, Store } from 'tinybase';
import { FileTreeRowSchema, type FileTreeRow } from '@devalbo/shared';
import { FILE_TREE_TABLE } from '../schemas/file-tree';

export const getEntry = (store: Store, id: string): FileTreeRow | null => {
  const row = store.getRow(FILE_TREE_TABLE, id);
  if (row == null) return null;

  const parsed = FileTreeRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
};

export const setEntry = (store: Store, id: string, entry: FileTreeRow): void => {
  const parsed = FileTreeRowSchema.parse(entry);
  store.setRow(FILE_TREE_TABLE, id, parsed as Row);
};

export const listEntries = (store: Store): Array<{ id: string; row: FileTreeRow }> => {
  const table = store.getTable(FILE_TREE_TABLE);
  if (!table) return [];

  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = FileTreeRowSchema.safeParse(row);
    return parsed.success ? [{ id, row: parsed.data }] : [];
  });
};

export const deleteEntry = (store: Store, id: string): void => {
  store.delRow(FILE_TREE_TABLE, id);
};
