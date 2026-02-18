import React from 'react';
import type { PersonaId, PersonaRow } from '@devalbo/shared';
import { PersonaCard } from './persona-card';

interface PersonaListProps {
  personas: Array<{ id: PersonaId; row: PersonaRow }>;
  defaultPersonaId?: PersonaId;
  selectedId?: PersonaId;
  onSelect?: (id: PersonaId) => void;
}

export const PersonaList: React.FC<PersonaListProps> = ({ personas, defaultPersonaId, selectedId, onSelect }) => {
  if (personas.length === 0) {
    return <div style={{ color: '#94a3b8' }}>No personas yet. Try: persona create "Alice"</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {personas.map(({ id, row }) => (
        <PersonaCard
          key={id}
          id={id}
          persona={row}
          isDefault={defaultPersonaId === id}
          selected={selectedId === id}
          {...(onSelect ? { onClick: () => onSelect(id) } : {})}
        />
      ))}
    </div>
  );
};
