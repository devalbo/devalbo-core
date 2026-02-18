import { useMemo } from 'react';
import type { ContactId, ContactRow } from '@devalbo/shared';
import { listContacts } from '../accessors/contacts';
import { CONTACTS_TABLE } from '../schemas/social';
import { useTable } from './use-table';
import { useStore } from './use-store';

export const useContacts = (): Array<{ id: ContactId; row: ContactRow }> => {
  const store = useStore();
  const table = useTable(CONTACTS_TABLE);
  return useMemo(() => listContacts(store), [store, table]);
};
