import { useEffect, useState } from 'react';
import type { Table } from 'tinybase';
import { useStore } from './use-store';

export const useTable = (tableId: string): Table => {
  const store = useStore();
  const [table, setTable] = useState<Table>(() => store.getTable(tableId));

  useEffect(() => {
    setTable(store.getTable(tableId));
    const listenerId = store.addTableListener(tableId, () => {
      setTable(store.getTable(tableId));
    });
    return () => {
      store.delListener(listenerId);
    };
  }, [store, tableId]);

  return table;
};
