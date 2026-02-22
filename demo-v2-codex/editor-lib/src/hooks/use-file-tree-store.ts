import { useEffect, useMemo } from 'react';
import { createDevalboStore, FILE_TREE_TABLE } from '@devalbo/state';
import { useFileTree } from './use-file-tree';
import type { DevalboStore } from '@devalbo/state';
import type { UseFileTreeReturn } from './use-file-tree';

export interface UseFileTreeStoreResult {
  store: DevalboStore;
  tree: UseFileTreeReturn;
}

export const useFileTreeStore = (rootPath: string): UseFileTreeStoreResult => {
  const store = useMemo(() => createDevalboStore(), []);
  const tree = useFileTree({ rootPath });

  useEffect(() => {
    store.delTable(FILE_TREE_TABLE);
    tree.entries.forEach((entry) => {
      store.setRow(FILE_TREE_TABLE, entry.path, {
        path: entry.path,
        name: entry.name,
        parentPath: rootPath,
        isDirectory: entry.isDirectory,
        size: entry.size ?? 0,
        mtime: entry.mtime?.toISOString() ?? ''
      });
    });
  }, [rootPath, store, tree.entries]);

  return { store, tree };
};
