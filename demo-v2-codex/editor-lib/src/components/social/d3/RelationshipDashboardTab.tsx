import { useState } from 'react';
import { setGroup, useContacts, useGroups, useMemberships } from '@devalbo/state';
import { GroupIdToolbox, unsafeAsContactId, unsafeAsGroupId, type ContactId, type GroupId } from '@devalbo/shared';
import { useStore } from '@devalbo/state';
import { PersonaSwitcher } from '../PersonaSwitcher';
import { useActivePersona } from '../ActivePersonaContext';
import { ContactContextPanel } from './ContactContextPanel';
import { ContactGroupTree } from './ContactGroupTree';
import { GroupContextPanel } from './GroupContextPanel';

export const RelationshipDashboardTab: React.FC = () => {
  const store = useStore();
  const { activePersonaId } = useActivePersona();
  const groups = useGroups();
  const contacts = useContacts();
  const memberships = useMemberships();

  const [selectedGroupId, setSelectedGroupId] = useState<GroupId | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<ContactId | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '12px', minHeight: '680px' }}>
      <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'auto', background: '#0b1220', padding: '10px' }}>
        <ContactGroupTree
          groups={groups}
          contacts={contacts}
          memberships={memberships}
          selectedId={selectedContactId ?? selectedGroupId}
          selectedType={selectedContactId ? 'contact' : selectedGroupId ? 'group' : null}
          onSelectGroup={(id) => {
            setSelectedGroupId(id);
            setSelectedContactId(null);
          }}
          onSelectContact={(id) => {
            setSelectedContactId(id);
          }}
        />
        <div style={{ marginTop: '10px', borderTop: '1px solid #334155', paddingTop: '10px', display: 'flex', gap: '8px' }}>
          <input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="New group name"
            style={{ flex: 1, border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = newGroupName.trim();
              if (!trimmed) return;
              const id = unsafeAsGroupId(GroupIdToolbox.createRandomId?.() ?? crypto.randomUUID());
              setGroup(store, id, {
                name: trimmed,
                groupType: 'group',
                updatedAt: new Date().toISOString()
              });
              setNewGroupName('');
              setSelectedGroupId(id);
              setSelectedContactId(null);
            }}
            style={{ border: '1px solid #334155', borderRadius: '6px', background: '#1e293b', color: '#e2e8f0', padding: '6px 10px' }}
          >
            + New Group
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: '8px', background: '#0b1220', color: '#e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PersonaSwitcher label="Acting as" />
        </div>

        {selectedContactId && <ContactContextPanel contactId={unsafeAsContactId(selectedContactId)} actorPersonaId={activePersonaId} />}
        {!selectedContactId && selectedGroupId && <GroupContextPanel groupId={unsafeAsGroupId(selectedGroupId)} actorPersonaId={activePersonaId} />}
        {!selectedContactId && !selectedGroupId && <div style={{ color: '#94a3b8' }}>Select a group or contact.</div>}
      </div>
    </div>
  );
};
