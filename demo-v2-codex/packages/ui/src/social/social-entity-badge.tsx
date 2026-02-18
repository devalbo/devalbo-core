import React from 'react';

interface SocialEntityBadgeProps {
  kind: 'persona' | 'contact' | 'group';
  name: string;
}

export const SocialEntityBadge: React.FC<SocialEntityBadgeProps> = ({ kind, name }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      border: '1px solid #334155',
      borderRadius: '999px',
      background: '#1e293b',
      color: '#e2e8f0',
      fontSize: '11px',
      padding: '2px 8px'
    }}
  >
    <span style={{ color: '#94a3b8' }}>{kind}</span>
    <span>{name}</span>
  </span>
);
