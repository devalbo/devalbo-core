import React from 'react';
import type { ContactId, ContactRow, MembershipId, MembershipRow } from '@devalbo/shared';

interface ContactCardProps {
  contact: ContactRow;
  id: ContactId;
  memberships?: Array<{ id: MembershipId; row: MembershipRow }>;
  onClick?: () => void;
  selected?: boolean;
}

const kindBadgeColor = (kind: ContactRow['kind']) => (kind === 'agent' ? '#7e22ce' : '#0e7490');

export const ContactCard: React.FC<ContactCardProps> = ({ contact, memberships, onClick, selected }) => {
  const meta = [contact.email.trim(), contact.phone.trim()].filter(Boolean).join(' · ');

  const groups = (memberships ?? [])
    .map(({ row }) => (row.role.trim() ? `${row.groupId} (${row.role.trim()})` : row.groupId))
    .join(', ');

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: '8px',
        border: `1px solid ${selected ? '#38bdf8' : '#334155'}`,
        background: selected ? '#0f172a' : 'transparent',
        color: '#e2e8f0',
        padding: '10px',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <strong style={{ fontSize: '14px' }}>{contact.name}</strong>
        <span
          style={{
            fontSize: '11px',
            color: '#e2e8f0',
            background: kindBadgeColor(contact.kind),
            borderRadius: '999px',
            padding: '2px 8px'
          }}
        >
          {contact.kind}
        </span>
      </div>
      {meta && <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>{meta}</div>}
      {groups && <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>Groups: {groups}</div>}
    </button>
  );
};
