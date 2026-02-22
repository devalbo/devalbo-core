import { useMemo, useState } from 'react';
import { ContactCard } from '@devalbo/ui';
import { addMember, removeMember, useActivities, useContact, useGroups, useMemberships, useStore } from '@devalbo/state';
import type { ContactId, GroupId, PersonaId } from '@devalbo/shared';
import { ActivityLog } from '../d2/ActivityLog';
import { QuickActionsPanel } from '../d2/QuickActionsPanel';

interface ContactContextPanelProps {
  contactId: ContactId;
  actorPersonaId: PersonaId | null;
}

export const ContactContextPanel: React.FC<ContactContextPanelProps> = ({ contactId, actorPersonaId }) => {
  const store = useStore();
  const contact = useContact(contactId);
  const groups = useGroups();
  const memberships = useMemberships({ contactId });
  const activities = useActivities({ subjectType: 'contact', subjectId: contactId });
  const [addGroupId, setAddGroupId] = useState<GroupId | ''>('');

  const groupsById = useMemo(() => {
    const map = new Map<GroupId, { name: string }>();
    for (const { id, row } of groups) map.set(id, row);
    return map;
  }, [groups]);

  const memberGroupIds = useMemo(
    () => new Set(memberships.map((membership) => membership.row.groupId)),
    [memberships]
  );

  const available = useMemo(
    () => groups.filter(({ id }) => !memberGroupIds.has(id)),
    [groups, memberGroupIds]
  );

  if (!contact) return <div style={{ color: '#94a3b8' }}>Contact not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <ContactCard id={contactId} contact={contact} memberships={memberships} />
      <div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Groups</div>
        {memberships.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '12px' }}>Not in any group.</div>
        ) : (
          memberships.map((membership) => (
            <div key={membership.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ color: '#e2e8f0' }}>{groupsById.get(membership.row.groupId as GroupId)?.name ?? membership.row.groupId}</span>
              <button
                type="button"
                onClick={() => removeMember(store, membership.row.groupId as GroupId, contactId)}
                style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#fda4af', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          ))
        )}
        {available.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <select
              value={addGroupId}
              onChange={(event) => setAddGroupId(event.target.value as GroupId | '')}
              style={{ flex: 1, border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
            >
              <option value="">Add to group...</option>
              {available.map(({ id, row }) => (
                <option key={id} value={id}>{row.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addGroupId}
              onClick={() => {
                if (!addGroupId) return;
                addMember(store, { groupId: addGroupId as GroupId, contactId, role: '', startDate: '', endDate: '' });
                setAddGroupId('');
              }}
              style={{
                border: '1px solid #334155',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#e2e8f0',
                padding: '6px 10px',
                cursor: addGroupId ? 'pointer' : 'not-allowed',
                opacity: addGroupId ? 1 : 0.6
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
      <QuickActionsPanel subjectType="contact" subjectId={contactId} subjectName={contact.name} actorPersonaId={actorPersonaId} />
      <ActivityLog activities={activities} />
    </div>
  );
};
