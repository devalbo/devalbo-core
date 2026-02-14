import { useSyncExternalStore } from 'react';
import type { Table } from 'tinybase';
import { useStore } from './use-store';

export const useTable = (tableId: string): Table => {
  const store = useStore();

  return useSyncExternalStore(
    (onStoreChange) => {
      const listenerId = store.addTableListener(tableId, () => onStoreChange());
      return () => store.delListener(listenerId);
    },
    () => store.getTable(tableId)
  );
};
