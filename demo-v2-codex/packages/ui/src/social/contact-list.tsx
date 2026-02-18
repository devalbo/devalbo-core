import React, { useMemo, useState } from 'react';
import type { ContactId, ContactRow } from '@devalbo/shared';
import { ContactCard } from './contact-card';

interface ContactListProps {
  contacts: Array<{ id: ContactId; row: ContactRow }>;
  selectedId?: ContactId;
  onSelect?: (id: ContactId) => void;
  searchable?: boolean;
}

export const ContactList: React.FC<ContactListProps> = ({ contacts, selectedId, onSelect, searchable }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchable) return contacts;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contacts;

    return contacts.filter(({ row }) => {
      const name = row.name.toLowerCase();
      const email = row.email.toLowerCase();
      return name.includes(normalized) || email.includes(normalized);
    });
  }, [contacts, query, searchable]);

  if (contacts.length === 0) {
    return <div style={{ color: '#94a3b8' }}>No contacts yet. Try: contact add "Bob"</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {searchable && (
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contacts"
          style={{
            border: '1px solid #334155',
            borderRadius: '6px',
            background: '#0f172a',
            color: '#e2e8f0',
            padding: '6px 8px'
          }}
        />
      )}
      {filtered.length === 0 && query.trim() ? (
        <div style={{ color: '#94a3b8' }}>No contacts match "{query}"</div>
      ) : (
        filtered.map(({ id, row }) => (
          <ContactCard
            key={id}
            id={id}
            contact={row}
            selected={selectedId === id}
            {...(onSelect ? { onClick: () => onSelect(id) } : {})}
          />
        ))
      )}
    </div>
  );
};
