import React from 'react';
import type { GroupId, GroupRow } from '@devalbo/shared';
import { GroupCard } from './group-card';

interface GroupListProps {
  groups: Array<{ id: GroupId; row: GroupRow; memberCount?: number }>;
  selectedId?: GroupId;
  onSelect?: (id: GroupId) => void;
}

export const GroupList: React.FC<GroupListProps> = ({ groups, selectedId, onSelect }) => {
  if (groups.length === 0) {
    return <div style={{ color: '#94a3b8' }}>No groups yet. Try: group create "Avengers" --type organization</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {groups.map(({ id, row, memberCount }) => (
        <GroupCard
          key={id}
          id={id}
          group={row}
          {...(typeof memberCount === 'number' ? { memberCount } : {})}
          selected={selectedId === id}
          {...(onSelect ? { onClick: () => onSelect(id) } : {})}
        />
      ))}
    </div>
  );
};
