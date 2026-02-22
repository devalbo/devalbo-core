import { useEffect, useMemo, useState } from 'react';
import { personaToJsonLd, setPersona, usePersona, useStore } from '@devalbo/state';
import { unsafeAsPersonaId, type PersonaId } from '@devalbo/shared';

interface ShareCardPanelProps {
  personaId: PersonaId | null;
  onCopy?: (text: string) => void | Promise<void>;
  copyStatus?: 'idle' | 'copied' | 'error';
}

export const ShareCardPanel: React.FC<ShareCardPanelProps> = ({ personaId, onCopy, copyStatus = 'idle' }) => {
  const store = useStore();
  const resolvedPersonaId = unsafeAsPersonaId(personaId ?? '__missing-persona__');
  const persona = usePersona(resolvedPersonaId);
  const [localName, setLocalName] = useState(persona?.name ?? '');
  const [localEmail, setLocalEmail] = useState(persona?.email ?? '');
  const [localPhone, setLocalPhone] = useState(persona?.phone ?? '');
  const [localHomepage, setLocalHomepage] = useState(persona?.homepage ?? '');
  const [localBio, setLocalBio] = useState(persona?.bio ?? '');
  const [localImage, setLocalImage] = useState(persona?.image ?? '');

  useEffect(() => {
    if (!persona) return;
    setLocalName(persona.name);
    setLocalEmail(persona.email);
    setLocalPhone(persona.phone);
    setLocalHomepage(persona.homepage);
    setLocalBio(persona.bio);
    setLocalImage(persona.image);
  }, [personaId]);

  type EditablePersonaField = 'name' | 'email' | 'phone' | 'homepage' | 'bio' | 'image';

  const commit = (field: EditablePersonaField, value: string) => {
    if (!persona || !personaId) return;
    setPersona(store, resolvedPersonaId, {
      ...persona,
      [field]: value,
      updatedAt: new Date().toISOString()
    });
  };

  const json = useMemo(() => {
    if (!personaId || !persona) return '';
    return JSON.stringify(personaToJsonLd(persona, resolvedPersonaId), null, 2);
  }, [persona, personaId, resolvedPersonaId]);

  if (!personaId) {
    return <div style={{ color: '#94a3b8' }}>Select a persona to share.</div>;
  }

  if (!persona) {
    return <div style={{ color: '#94a3b8' }}>Persona not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ margin: 0 }}>Share My Card</h3>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Name
        <input
          value={localName}
          onChange={(event) => setLocalName(event.target.value)}
          onBlur={() => commit('name', localName)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Email
        <input
          value={localEmail}
          onChange={(event) => setLocalEmail(event.target.value)}
          onBlur={() => commit('email', localEmail)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Phone
        <input
          value={localPhone}
          onChange={(event) => setLocalPhone(event.target.value)}
          onBlur={() => commit('phone', localPhone)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Homepage
        <input
          value={localHomepage}
          onChange={(event) => setLocalHomepage(event.target.value)}
          onBlur={() => commit('homepage', localHomepage)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Bio
        <textarea
          value={localBio}
          onChange={(event) => setLocalBio(event.target.value)}
          onBlur={() => commit('bio', localBio)}
          rows={3}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px', resize: 'vertical' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
        Image
        <input
          value={localImage}
          onChange={(event) => setLocalImage(event.target.value)}
          onBlur={() => commit('image', localImage)}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '6px 8px' }}
        />
      </label>
      <pre
        style={{
          margin: 0,
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '10px',
          background: '#020617',
          color: '#e2e8f0',
          overflowX: 'auto'
        }}
      >
        {json}
      </pre>
      {persona.profileDoc.trim() && (
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>WebID: {persona.profileDoc}</div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => {
            void onCopy?.(json);
          }}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#1e293b', color: '#e2e8f0', padding: '6px 10px' }}
        >
          {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      {/* TODO: QR code */}
    </div>
  );
};
