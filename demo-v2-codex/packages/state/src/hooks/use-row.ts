import { useEffect, useState } from 'react';
import type { Row } from 'tinybase';
import { useStore } from './use-store';

export const useRow = (tableId: string, rowId: string): Row => {
  const store = useStore();
  const [row, setRow] = useState<Row>(() => store.getRow(tableId, rowId));

  useEffect(() => {
    setRow(store.getRow(tableId, rowId));
    const listenerId = store.addRowListener(tableId, rowId, () => {
      setRow(store.getRow(tableId, rowId));
    });
    return () => {
      store.delListener(listenerId);
    };
  }, [rowId, store, tableId]);

  return row;
};
