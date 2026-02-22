import { useMemo, useState } from 'react';
import { GroupCard } from '@devalbo/ui';
import { addMember, removeMember, useActivities, useContacts, useGroup, useMemberships, useStore } from '@devalbo/state';
import type { ContactId, GroupId, PersonaId } from '@devalbo/shared';
import { ActivityLog } from '../d2/ActivityLog';
import { QuickActionsPanel } from '../d2/QuickActionsPanel';

interface GroupContextPanelProps {
  groupId: GroupId;
  actorPersonaId: PersonaId | null;
}

export const GroupContextPanel: React.FC<GroupContextPanelProps> = ({ groupId, actorPersonaId }) => {
  const store = useStore();
  const group = useGroup(groupId);
  const memberships = useMemberships({ groupId });
  const contacts = useContacts();
  const activities = useActivities({ subjectType: 'group', subjectId: groupId });
  const [addContactId, setAddContactId] = useState<ContactId | ''>('');

  const contactsById = useMemo(() => {
    const map = new Map<ContactId, { name: string }>();
    for (const { id, row } of contacts) map.set(id, row);
    return map;
  }, [contacts]);

  const memberContactIds = useMemo(
    () => new Set(memberships.map((membership) => membership.row.contactId)),
    [memberships]
  );

  const available = useMemo(
    () => contacts.filter(({ id }) => !memberContactIds.has(id)),
    [contacts, memberContactIds]
  );

  if (!group) return <div style={{ color: '#94a3b8' }}>Group not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <GroupCard id={groupId} group={group} memberCount={memberships.length} />
      <div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Members</div>
        {memberships.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '12px' }}>No members yet.</div>
        ) : (
          memberships.map((membership) => {
            const name = contactsById.get(membership.row.contactId as ContactId)?.name ?? membership.row.contactId;
            return (
              <div key={membership.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ color: '#e2e8f0' }}>{name}</span>
                <button
                  type="button"
                  onClick={() => removeMember(store, groupId, membership.row.contactId as ContactId)}
                  style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#fda4af', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            );
          })
        )}
        {available.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <select
              value={addContactId}
              onChange={(event) => setAddContactId(event.target.value as ContactId | '')}
              style={{ flex: 1, border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
            >
              <option value="">Add member...</option>
              {available.map(({ id, row }) => (
                <option key={id} value={id}>{row.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addContactId}
              onClick={() => {
                if (!addContactId) return;
                addMember(store, { groupId, contactId: addContactId as ContactId, role: '', startDate: '', endDate: '' });
                setAddContactId('');
              }}
              style={{
                border: '1px solid #334155',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#e2e8f0',
                padding: '6px 10px',
                cursor: addContactId ? 'pointer' : 'not-allowed',
                opacity: addContactId ? 1 : 0.6
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
      <QuickActionsPanel subjectType="group" subjectId={groupId} subjectName={group.name} actorPersonaId={actorPersonaId} />
      <ActivityLog activities={activities} emptyMessage="Nothing shared yet." />
    </div>
  );
};
