import React from 'react';
import type { ContactId, ContactRow, MembershipId, MembershipRow } from '@devalbo/shared';

interface MembershipListProps {
  memberships: Array<{ id: MembershipId; row: MembershipRow }>;
  contactsById: Map<ContactId, ContactRow>;
}

export const MembershipList: React.FC<MembershipListProps> = ({ memberships, contactsById }) => {
  if (memberships.length === 0) {
    return <div style={{ color: '#94a3b8' }}>No members yet. Try: group add-member &lt;groupId&gt; &lt;contactId&gt;</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {memberships.map(({ id, row }) => {
        const contact = contactsById.get(row.contactId as ContactId);
        const since = row.startDate.trim() ? `since ${row.startDate.trim()}` : '';
        return (
          <div
            key={id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: '8px',
              fontSize: '13px',
              color: '#e2e8f0'
            }}
          >
            <span>{contact?.name ?? '(unknown)'}</span>
            <span style={{ color: '#94a3b8' }}>{row.role.trim() || 'member'}</span>
            <span style={{ color: '#94a3b8' }}>{since || '—'}</span>
          </div>
        );
      })}
    </div>
  );
};
