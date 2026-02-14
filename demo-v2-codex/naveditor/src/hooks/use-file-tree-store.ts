import { useEffect, useMemo } from 'react';
import { createDevalboStore, FILE_TREE_TABLE } from '@devalbo/state';
import { useFileTree } from './use-file-tree';

export const useFileTreeStore = (rootPath: string) => {
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
