import type { Row, Store } from 'tinybase';
import { GroupRowSchema, type GroupRow, type GroupRowInput } from '@devalbo/shared';
import { GROUPS_TABLE, MEMBERSHIPS_TABLE } from '../schemas/social';
import { safeParseWithWarning } from './_validation';

export const getGroup = (store: Store, id: string): GroupRow | null => {
  if (!store.hasRow(GROUPS_TABLE, id)) return null;
  const row = store.getRow(GROUPS_TABLE, id);
  return safeParseWithWarning<GroupRow>(GroupRowSchema, row, GROUPS_TABLE, id, 'get');
};

export const setGroup = (store: Store, id: string, group: GroupRowInput): void => {
  const parsed = GroupRowSchema.parse(group);
  store.setRow(GROUPS_TABLE, id, parsed as Row);
};

export const listGroups = (store: Store): Array<{ id: string; row: GroupRow }> => {
  const table = store.getTable(GROUPS_TABLE);
  if (!table) return [];

  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = safeParseWithWarning<GroupRow>(GroupRowSchema, row, GROUPS_TABLE, id, 'list');
    return parsed ? [{ id, row: parsed }] : [];
  });
};

export const deleteGroup = (store: Store, id: string): void => {
  const membershipsTable = store.getTable(MEMBERSHIPS_TABLE);
  if (membershipsTable) {
    for (const [rowId, row] of Object.entries(membershipsTable)) {
      if (row.groupId === id) {
        store.delRow(MEMBERSHIPS_TABLE, rowId);
      }
    }
  }
  store.delRow(GROUPS_TABLE, id);
};
