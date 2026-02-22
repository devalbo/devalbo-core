import { useMemo, useState } from 'react';
import {
  useContact,
  useContacts,
  useGroup,
  useGroups,
  useMemberships,
  usePersona,
  usePersonas
} from '@devalbo/state';
import {
  unsafeAsContactId,
  unsafeAsGroupId,
  unsafeAsPersonaId,
  type ContactId,
  type ContactRow
} from '@devalbo/shared';
import { ContactCard, ContactList, GroupCard, GroupList, MembershipList, PersonaCard, PersonaList } from '@devalbo/ui';

type EntityType = 'personas' | 'contacts' | 'groups';

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '6px 10px',
  cursor: 'pointer',
  background: active ? '#0f172a' : '#1e293b',
  color: '#e2e8f0'
});

const panelBaseStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: '8px',
  background: '#0b1220',
  color: '#e2e8f0',
  minHeight: '640px'
};

const PersonaDetail: React.FC<{ selectedId: string | null }> = ({ selectedId }) => {
  const personaId = unsafeAsPersonaId(selectedId ?? '__missing-persona__');
  const persona = usePersona(personaId);

  if (!selectedId) {
    return <div style={{ color: '#94a3b8' }}>Select a persona, contact, or group to view details.</div>;
  }

  if (!persona) {
    return <div style={{ color: '#94a3b8' }}>Entity not found.</div>;
  }

  return (
    <PersonaCard
      id={personaId}
      persona={persona}
      isDefault={persona.isDefault}
    />
  );
};

const ContactDetail: React.FC<{ selectedId: string | null }> = ({ selectedId }) => {
  const contactId = unsafeAsContactId(selectedId ?? '__missing-contact__');
  const contact = useContact(contactId);
  const memberships = useMemberships({ contactId });

  if (!selectedId) {
    return <div style={{ color: '#94a3b8' }}>Select a persona, contact, or group to view details.</div>;
  }

  if (!contact) {
    return <div style={{ color: '#94a3b8' }}>Entity not found.</div>;
  }

  return <ContactCard id={contactId} contact={contact} memberships={memberships} />;
};

const GroupDetail: React.FC<{ selectedId: string | null }> = ({ selectedId }) => {
  const contacts = useContacts();
  const groupId = unsafeAsGroupId(selectedId ?? '__missing-group__');
  const group = useGroup(groupId);
  const memberships = useMemberships({ groupId });
  const contactsById = useMemo(() => {
    const map = new Map<ContactId, ContactRow>();
    for (const { id, row } of contacts) map.set(id, row);
    return map;
  }, [contacts]);

  if (!selectedId) {
    return <div style={{ color: '#94a3b8' }}>Select a persona, contact, or group to view details.</div>;
  }

  if (!group) {
    return <div style={{ color: '#94a3b8' }}>Entity not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <GroupCard id={groupId} group={group} memberCount={memberships.length} />
      <div>
        <div style={{ marginBottom: '8px', color: '#94a3b8', fontSize: '12px' }}>Members</div>
        <MembershipList memberships={memberships} contactsById={contactsById} />
      </div>
    </div>
  );
};

export const SocialPanel: React.FC = () => {
  const [entityType, setEntityType] = useState<EntityType>('personas');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const personas = usePersonas();
  const contacts = useContacts();
  const groups = useGroups();
  const memberships = useMemberships();

  const defaultPersonaId = personas.find(({ row }) => row.isDefault)?.id;
  const groupMemberCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { row } of memberships) {
      counts.set(row.groupId, (counts.get(row.groupId) ?? 0) + 1);
    }
    return counts;
  }, [memberships]);

  const setType = (nextType: EntityType) => {
    setEntityType(nextType);
    setSelectedId(null);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', minHeight: '680px' }}>
      <div style={{ ...panelBaseStyle, overflow: 'auto' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #334155', color: '#cbd5e1', fontWeight: 600 }}>People</div>
        <div style={{ display: 'flex', gap: '8px', padding: '10px', borderBottom: '1px solid #334155' }}>
          <button type="button" onClick={() => setType('personas')} style={tabButtonStyle(entityType === 'personas')}>Personas</button>
          <button type="button" onClick={() => setType('contacts')} style={tabButtonStyle(entityType === 'contacts')}>Contacts</button>
          <button type="button" onClick={() => setType('groups')} style={tabButtonStyle(entityType === 'groups')}>Groups</button>
        </div>
        <div style={{ padding: '10px' }}>
          {entityType === 'personas' && (
            <PersonaList
              personas={personas}
              {...(defaultPersonaId ? { defaultPersonaId } : {})}
              {...(selectedId ? { selectedId: unsafeAsPersonaId(selectedId) } : {})}
              onSelect={(id) => setSelectedId(id)}
            />
          )}
          {entityType === 'contacts' && (
            <ContactList
              contacts={contacts}
              {...(selectedId ? { selectedId: unsafeAsContactId(selectedId) } : {})}
              onSelect={(id) => setSelectedId(id)}
              searchable
            />
          )}
          {entityType === 'groups' && (
            <GroupList
              groups={groups.map((group) => ({ ...group, memberCount: groupMemberCounts.get(group.id) ?? 0 }))}
              {...(selectedId ? { selectedId: unsafeAsGroupId(selectedId) } : {})}
              onSelect={(id) => setSelectedId(id)}
            />
          )}
        </div>
      </div>

      <div style={{ ...panelBaseStyle, padding: '12px' }}>
        {entityType === 'personas' && <PersonaDetail selectedId={selectedId} />}
        {entityType === 'contacts' && <ContactDetail selectedId={selectedId} />}
        {entityType === 'groups' && <GroupDetail selectedId={selectedId} />}
      </div>
    </div>
  );
};
