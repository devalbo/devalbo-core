import { useMemo } from 'react';
import { personaToJsonLd, usePersona } from '@devalbo/state';
import { unsafeAsPersonaId, type PersonaId } from '@devalbo/shared';

interface ShareCardPanelProps {
  personaId: PersonaId | null;
  onCopy?: (text: string) => void | Promise<void>;
  copyStatus?: 'idle' | 'copied' | 'error';
}

export const ShareCardPanel: React.FC<ShareCardPanelProps> = ({ personaId, onCopy, copyStatus = 'idle' }) => {
  const resolvedPersonaId = unsafeAsPersonaId(personaId ?? '__missing-persona__');
  const persona = usePersona(resolvedPersonaId);

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
