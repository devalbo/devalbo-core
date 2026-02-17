import type { Row, Store } from 'tinybase';
import {
  MembershipRowSchema,
  type ContactId,
  type GroupId,
  type MembershipId,
  type MembershipRow,
  type MembershipRowInput
} from '@devalbo/shared';
import { CONTACTS_TABLE, GROUPS_TABLE, MEMBERSHIPS_TABLE } from '../schemas/social';
import { safeParseWithWarning } from './_validation';

type MembershipInput = Omit<MembershipRowInput, 'groupId' | 'contactId'> & {
  groupId: GroupId;
  contactId: ContactId;
};

export const getMembershipRowId = (groupId: GroupId, contactId: ContactId): MembershipId =>
  `${groupId}:${contactId}` as MembershipId;

export const addMember = (store: Store, membership: MembershipInput): MembershipId => {
  const parsed = MembershipRowSchema.parse(membership);

  if (!store.hasRow(GROUPS_TABLE, parsed.groupId)) {
    throw new Error(`Group not found: ${parsed.groupId}`);
  }
  if (!store.hasRow(CONTACTS_TABLE, parsed.contactId)) {
    throw new Error(`Contact not found: ${parsed.contactId}`);
  }

  const rowId = getMembershipRowId(parsed.groupId as GroupId, parsed.contactId as ContactId);
  store.setRow(MEMBERSHIPS_TABLE, rowId, parsed as Row);
  return rowId;
};

export const removeMember = (store: Store, groupId: GroupId, contactId: ContactId): void => {
  store.delRow(MEMBERSHIPS_TABLE, getMembershipRowId(groupId, contactId));
};

export const listMembers = (store: Store, groupId: GroupId): Array<{ id: MembershipId; row: MembershipRow }> => {
  const table = store.getTable(MEMBERSHIPS_TABLE);
  if (!table) return [];

  return Object.entries(table)
    .flatMap(([id, row]) => {
      const parsed = safeParseWithWarning<MembershipRow>(MembershipRowSchema, row, MEMBERSHIPS_TABLE, id, 'list');
      return parsed ? [{ id: id as MembershipId, row: parsed }] : [];
    })
    .filter(({ row }) => row.groupId === groupId);
};

export const getGroupsForContact = (store: Store, contactId: ContactId): GroupId[] => {
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

  return [...new Set(groupIds)].sort() as GroupId[];
};
