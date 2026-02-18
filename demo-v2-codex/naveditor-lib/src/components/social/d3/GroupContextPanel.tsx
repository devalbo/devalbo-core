import { useMemo } from 'react';
import { GroupCard, MembershipList } from '@devalbo/ui';
import { useActivities, useContacts, useGroup, useMemberships } from '@devalbo/state';
import type { GroupId, PersonaId } from '@devalbo/shared';
import { ActivityLog } from '../d2/ActivityLog';
import { QuickActionsPanel } from '../d2/QuickActionsPanel';

interface GroupContextPanelProps {
  groupId: GroupId;
  actorPersonaId: PersonaId | null;
}

export const GroupContextPanel: React.FC<GroupContextPanelProps> = ({ groupId, actorPersonaId }) => {
  const group = useGroup(groupId);
  const memberships = useMemberships({ groupId });
  const contacts = useContacts();
  const activities = useActivities({ subjectType: 'group', subjectId: groupId });

  const contactsById = useMemo(() => {
    const map = new Map();
    for (const { id, row } of contacts) map.set(id, row);
    return map;
  }, [contacts]);

  if (!group) return <div style={{ color: '#94a3b8' }}>Group not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <GroupCard id={groupId} group={group} memberCount={memberships.length} />
      <div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Members</div>
        <MembershipList memberships={memberships} contactsById={contactsById} />
      </div>
      <QuickActionsPanel subjectType="group" subjectId={groupId} subjectName={group.name} actorPersonaId={actorPersonaId} />
      <ActivityLog activities={activities} emptyMessage="Nothing shared yet." />
    </div>
  );
};
