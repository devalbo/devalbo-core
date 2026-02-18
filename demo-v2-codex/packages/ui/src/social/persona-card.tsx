import React from 'react';
import type { PersonaId, PersonaRow } from '@devalbo/shared';

interface PersonaCardProps {
  persona: PersonaRow;
  id: PersonaId;
  isDefault?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({ persona, isDefault, onClick, selected }) => {
  const name = persona.name.trim() || '(unnamed)';
  const meta = [persona.nickname.trim() ? `@${persona.nickname.trim()}` : '', persona.email.trim()].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: '8px',
        border: `1px solid ${selected ? '#38bdf8' : '#334155'}`,
        background: selected ? '#0f172a' : 'transparent',
        color: '#e2e8f0',
        padding: '10px',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <strong style={{ fontSize: '14px' }}>{name}</strong>
        {isDefault && <span style={{ color: '#94a3b8', fontSize: '12px' }}>(default)</span>}
      </div>
      {meta && <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>{meta}</div>}
    </button>
  );
};
