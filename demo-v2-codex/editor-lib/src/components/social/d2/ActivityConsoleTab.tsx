import { useMemo, useState } from 'react';
import { ContactCard, GroupCard } from '@devalbo/ui';
import { useActivities, useContact, useContacts, useGroup, useGroups } from '@devalbo/state';
import { unsafeAsContactId, unsafeAsGroupId, type ContactId, type GroupId } from '@devalbo/shared';
import { PersonaSwitcher } from '../PersonaSwitcher';
import { useActivePersona } from '../ActivePersonaContext';
import { ActivityLog } from './ActivityLog';
import { QuickActionsPanel } from './QuickActionsPanel';

type Selection =
  | { type: 'contact'; id: ContactId }
  | { type: 'group'; id: GroupId }
  | null;

const itemButton = (selected: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  borderRadius: '6px',
  background: selected ? '#0f172a' : 'transparent',
  color: '#e2e8f0',
  padding: '6px 8px'
});

export const ActivityConsoleTab: React.FC = () => {
  const { activePersonaId } = useActivePersona();
  const contacts = useContacts();
  const groups = useGroups();
  const activities = useActivities();
  const [selection, setSelection] = useState<Selection>(null);

  const selectedContact = useContact(
    unsafeAsContactId(selection?.type === 'contact' ? selection.id : '__none__')
  );
  const selectedGroup = useGroup(
    unsafeAsGroupId(selection?.type === 'group' ? selection.id : '__none__')
  );

  const selectedActivities = useMemo(() => {
    if (!selection) return [];
    return activities.filter(({ row }) => row.subjectType === selection.type && row.subjectId === selection.id);
  }, [activities, selection]);

  const hasActivity = useMemo(() => {
    const contactIds = new Set<string>();
    const groupIds = new Set<string>();
    for (const { row } of activities) {
      if (row.subjectType === 'contact') contactIds.add(row.subjectId);
      if (row.subjectType === 'group') groupIds.add(row.subjectId);
    }
    return { contactIds, groupIds };
  }, [activities]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', minHeight: '680px' }}>
      <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'auto', background: '#0b1220' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #334155' }}>
          <PersonaSwitcher label="Acting as" />
        </div>
        <div style={{ padding: '10px', color: '#94a3b8', fontSize: '12px' }}>Contacts</div>
        <div style={{ padding: '0 10px 10px' }}>
          {contacts.map(({ id, row }) => (
            <button key={id} type="button" style={itemButton(selection?.type === 'contact' && selection.id === id)} onClick={() => setSelection({ type: 'contact', id })}>
              {row.name} {hasActivity.contactIds.has(id) ? '●' : ''}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px', color: '#94a3b8', fontSize: '12px', borderTop: '1px solid #334155' }}>Groups</div>
        <div style={{ padding: '0 10px 10px' }}>
          {groups.map(({ id, row }) => (
            <button key={id} type="button" style={itemButton(selection?.type === 'group' && selection.id === id)} onClick={() => setSelection({ type: 'group', id })}>
              {row.name} {hasActivity.groupIds.has(id) ? '●' : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: '8px', background: '#0b1220', color: '#e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!selection && <div style={{ color: '#94a3b8' }}>Select a contact or group.</div>}

        {selection?.type === 'contact' && selectedContact && (
          <>
            <ContactCard id={selection.id} contact={selectedContact} />
            <QuickActionsPanel subjectType="contact" subjectId={selection.id} subjectName={selectedContact.name} actorPersonaId={activePersonaId} />
            <ActivityLog activities={selectedActivities} />
          </>
        )}

        {selection?.type === 'group' && selectedGroup && (
          <>
            <GroupCard id={selection.id} group={selectedGroup} />
            <QuickActionsPanel subjectType="group" subjectId={selection.id} subjectName={selectedGroup.name} actorPersonaId={activePersonaId} />
            <ActivityLog activities={selectedActivities} />
          </>
        )}
      </div>
    </div>
  );
};
