import React from 'react';
import type { GroupId, GroupRow } from '@devalbo/shared';

interface GroupCardProps {
  group: GroupRow;
  id: GroupId;
  memberCount?: number;
  onClick?: () => void;
  selected?: boolean;
}

const groupTypeBadgeColor = (groupType: GroupRow['groupType']) => {
  switch (groupType) {
    case 'organization':
      return '#166534';
    case 'team':
      return '#1d4ed8';
    default:
      return '#334155';
  }
};

export const GroupCard: React.FC<GroupCardProps> = ({ group, memberCount, onClick, selected }) => {
  const detailBits: string[] = [];
  if (typeof memberCount === 'number') detailBits.push(`${memberCount} members`);
  if (group.url.trim()) detailBits.push(group.url.trim());

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
        <strong style={{ fontSize: '14px' }}>{group.name}</strong>
        <span
          style={{
            fontSize: '11px',
            color: '#e2e8f0',
            background: groupTypeBadgeColor(group.groupType),
            borderRadius: '999px',
            padding: '2px 8px'
          }}
        >
          {group.groupType}
        </span>
      </div>
      {detailBits.length > 0 && <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>{detailBits.join(' · ')}</div>}
    </button>
  );
};
