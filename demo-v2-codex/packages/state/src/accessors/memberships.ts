import type { Row, Store } from 'tinybase';
import { MembershipRowSchema, type MembershipRow, type MembershipRowInput } from '@devalbo/shared';
import { CONTACTS_TABLE, GROUPS_TABLE, MEMBERSHIPS_TABLE } from '../schemas/social';
import { safeParseWithWarning } from './_validation';

export const getMembershipRowId = (groupId: string, contactId: string): string => `${groupId}:${contactId}`;

export const addMember = (store: Store, membership: MembershipRowInput): string => {
  const parsed = MembershipRowSchema.parse(membership);

  if (!store.hasRow(GROUPS_TABLE, parsed.groupId)) {
    throw new Error(`Group not found: ${parsed.groupId}`);
  }
  if (!store.hasRow(CONTACTS_TABLE, parsed.contactId)) {
    throw new Error(`Contact not found: ${parsed.contactId}`);
  }

  const rowId = getMembershipRowId(parsed.groupId, parsed.contactId);
  store.setRow(MEMBERSHIPS_TABLE, rowId, parsed as Row);
  return rowId;
};

export const removeMember = (store: Store, groupId: string, contactId: string): void => {
  store.delRow(MEMBERSHIPS_TABLE, getMembershipRowId(groupId, contactId));
};

export const listMembers = (store: Store, groupId: string): Array<{ id: string; row: MembershipRow }> => {
  const table = store.getTable(MEMBERSHIPS_TABLE);
  if (!table) return [];

  return Object.entries(table)
    .flatMap(([id, row]) => {
      const parsed = safeParseWithWarning<MembershipRow>(MembershipRowSchema, row, MEMBERSHIPS_TABLE, id, 'list');
      return parsed ? [{ id, row: parsed }] : [];
    })
    .filter(({ row }) => row.groupId === groupId);
};

export const getGroupsForContact = (store: Store, contactId: string): string[] => {
  const table = store.getTable(MEMBERSHIPS_TABLE);
  if (!table) return [];

  const groupIds = Object.entries(table)
    .flatMap(([id, row]) => {
      const parsed = safeParseWithWarning<MembershipRow>(
        MembershipRowSchema,
        row,
        MEMBERSHIPS_TABLE,
        id,
        'list'
      );
      return parsed && parsed.contactId === contactId ? [parsed.groupId] : [];
    });

  return [...new Set(groupIds)].sort();
};
