import { usePersonas } from '@devalbo/state';
import { unsafeAsPersonaId } from '@devalbo/shared';
import { useActivePersona } from './ActivePersonaContext';

interface PersonaSwitcherProps {
  label?: string;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ label = 'My Card' }) => {
  const personas = usePersonas();
  const { activePersonaId, setActivePersonaId } = useActivePersona();

  if (personas.length === 0) {
    return <span style={{ color: '#94a3b8' }}>{label}: no personas</span>;
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
      <select
        value={activePersonaId ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          setActivePersonaId(value ? unsafeAsPersonaId(value) : null);
        }}
        style={{
          border: '1px solid #334155',
          borderRadius: '6px',
          background: '#0f172a',
          color: '#e2e8f0',
          padding: '6px 8px'
        }}
      >
        {personas.map(({ id, row }) => (
          <option key={id} value={id}>{row.name}</option>
        ))}
      </select>
    </label>
  );
};
