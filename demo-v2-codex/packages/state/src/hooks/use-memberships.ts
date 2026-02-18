import { useMemo } from 'react';
import type { ContactId, GroupId, MembershipId, MembershipRow } from '@devalbo/shared';
import { listMemberships } from '../accessors/memberships';
import { MEMBERSHIPS_TABLE } from '../schemas/social';
import { useTable } from './use-table';
import { useStore } from './use-store';

export interface MembershipFilter {
  groupId?: GroupId;
  contactId?: ContactId;
}

const applyMembershipFilter = (
  rows: Array<{ id: MembershipId; row: MembershipRow }>,
  filter?: MembershipFilter
): Array<{ id: MembershipId; row: MembershipRow }> => {
  if (!filter) return rows;

  return rows.filter(({ row }) => {
    if (filter.groupId && row.groupId !== filter.groupId) return false;
    if (filter.contactId && row.contactId !== filter.contactId) return false;
    return true;
  });
};

export const useMemberships = (filter?: MembershipFilter): Array<{ id: MembershipId; row: MembershipRow }> => {
  const store = useStore();
  const table = useTable(MEMBERSHIPS_TABLE);
  return useMemo(() => applyMembershipFilter(listMemberships(store), filter), [store, table, filter]);
};
