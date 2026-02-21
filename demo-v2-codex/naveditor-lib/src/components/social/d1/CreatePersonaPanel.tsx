import { useState } from 'react';
import { getDefaultPersona, setPersona, useStore } from '@devalbo/state';
import { PersonaIdToolbox, unsafeAsPersonaId, type PersonaId } from '@devalbo/shared';

interface CreatePersonaPanelProps {
  onCreated: (id: PersonaId) => void;
}

export const CreatePersonaPanel: React.FC<CreatePersonaPanelProps> = ({ onCreated }) => {
  const store = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [homepage, setHomepage] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    const rawId = PersonaIdToolbox.createRandomId?.() ?? crypto.randomUUID();
    const id = unsafeAsPersonaId(rawId);
    const isDefault = !getDefaultPersona(store);

    setPersona(store, id, {
      name: trimmedName,
      nickname: '',
      givenName: '',
      familyName: '',
      email: email.trim(),
      phone: '',
      image: '',
      bio: bio.trim(),
      homepage: homepage.trim(),
      oidcIssuer: '',
      inbox: '',
      publicTypeIndex: '',
      privateTypeIndex: '',
      preferencesFile: '',
      storage: '',
      profileDoc: '',
      isDefault,
      updatedAt: new Date().toISOString()
    });
    setError('');
    onCreated(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ margin: 0 }}>Create Persona</h3>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Email
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Homepage
        <input
          value={homepage}
          onChange={(event) => setHomepage(event.target.value)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Bio
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={4}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px', resize: 'vertical' }}
        />
      </label>

      <div>
        <button
          type="button"
          onClick={submit}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#1e293b', color: '#e2e8f0', padding: '6px 10px' }}
        >
          Create Persona
        </button>
      </div>

      {error && <div style={{ color: '#f87171' }}>{error}</div>}
    </div>
  );
};
