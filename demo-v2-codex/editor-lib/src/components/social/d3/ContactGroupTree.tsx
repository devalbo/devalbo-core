import { useMemo, useState } from 'react';
import type { ContactId, ContactRow, GroupId, GroupRow, MembershipId, MembershipRow } from '@devalbo/shared';

interface ContactGroupTreeProps {
  groups: Array<{ id: GroupId; row: GroupRow }>;
  contacts: Array<{ id: ContactId; row: ContactRow }>;
  memberships: Array<{ id: MembershipId; row: MembershipRow }>;
  selectedId: string | null;
  selectedType: 'group' | 'contact' | null;
  onSelectGroup: (id: GroupId) => void;
  onSelectContact: (id: ContactId) => void;
}

const rowButton = (selected: boolean): React.CSSProperties => ({
  width: '100%',
  border: 'none',
  background: selected ? '#0f172a' : 'transparent',
  color: '#e2e8f0',
  textAlign: 'left',
  borderRadius: '6px',
  padding: '4px 8px'
});

export const ContactGroupTree: React.FC<ContactGroupTreeProps> = ({
  groups,
  contacts,
  memberships,
  selectedId,
  selectedType,
  onSelectGroup,
  onSelectContact
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(groups.map((group) => group.id)));

  const contactsById = useMemo(() => {
    const map = new Map<string, { id: ContactId; row: ContactRow }>();
    for (const contact of contacts) map.set(contact.id, contact);
    return map;
  }, [contacts]);

  const groupMembers = useMemo(() => {
    const map = new Map<string, Array<{ id: ContactId; row: ContactRow }>>();
    for (const group of groups) map.set(group.id, []);

    for (const { row } of memberships) {
      const contact = contactsById.get(row.contactId);
      if (!contact) continue;
      const list = map.get(row.groupId) ?? [];
      list.push(contact);
      map.set(row.groupId, list);
    }

    return map;
  }, [contactsById, groups, memberships]);

  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { row } of memberships) ids.add(row.contactId);
    return ids;
  }, [memberships]);

  const ungrouped = contacts.filter(({ id }) => !groupedContactIds.has(id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {groups.map(({ id, row }) => {
        const isExpanded = expanded.has(id);
        const members = groupMembers.get(id) ?? [];

        return (
          <div key={id}>
            <button
              type="button"
              onClick={() => {
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
                onSelectGroup(id);
              }}
              style={rowButton(selectedType === 'group' && selectedId === id)}
            >
              {isExpanded ? '▾ ' : '▸ '}
              {row.name} ({row.groupType})
            </button>
            {isExpanded && members.map((contact) => (
              <button
                key={`${id}:${contact.id}`}
                type="button"
                onClick={() => onSelectContact(contact.id)}
                style={{ ...rowButton(selectedType === 'contact' && selectedId === contact.id), paddingLeft: '22px' }}
              >
                {contact.row.name}
              </button>
            ))}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div>
          <div style={{ color: '#94a3b8', padding: '4px 8px' }}>Ungrouped</div>
          {ungrouped.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => onSelectContact(contact.id)}
              style={rowButton(selectedType === 'contact' && selectedId === contact.id)}
            >
              {contact.row.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
