import { useMemo } from 'react';
import type { ActivityId, ActivityRow } from '@devalbo/shared';
import { listActivities } from '../accessors/activities';
import { ACTIVITIES_TABLE } from '../schemas/social';
import { useStore } from './use-store';
import { useTable } from './use-table';

export interface ActivityFilter {
  subjectType?: ActivityRow['subjectType'];
  subjectId?: string;
}

export const useActivities = (filter?: ActivityFilter): Array<{ id: ActivityId; row: ActivityRow }> => {
  const store = useStore();
  const table = useTable(ACTIVITIES_TABLE);

  return useMemo(() => {
    const rows = listActivities(store);
    if (!filter) return rows;
    return rows.filter(({ row }) => {
      if (filter.subjectType && row.subjectType !== filter.subjectType) return false;
      if (filter.subjectId && row.subjectId !== filter.subjectId) return false;
      return true;
    });
  }, [filter, store, table]);
};
