import { useMemo } from 'react';
import type { GroupId, GroupRow } from '@devalbo/shared';
import { listGroups } from '../accessors/groups';
import { GROUPS_TABLE } from '../schemas/social';
import { useTable } from './use-table';
import { useStore } from './use-store';

export const useGroups = (): Array<{ id: GroupId; row: GroupRow }> => {
  const store = useStore();
  const table = useTable(GROUPS_TABLE);
  return useMemo(() => listGroups(store), [store, table]);
};
