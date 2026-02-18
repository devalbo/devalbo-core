import { useEffect, useState } from 'react';
import { ContactList } from '@devalbo/ui';
import { useContacts } from '@devalbo/state';
import { detectPlatform, RuntimePlatform, unsafeAsContactId, type ContactId } from '@devalbo/shared';
import { PersonaSwitcher } from '../PersonaSwitcher';
import { useActivePersona } from '../ActivePersonaContext';
import { ContactForwardPanel } from './ContactForwardPanel';
import { ImportCardPanel } from './ImportCardPanel';
import { ShareCardPanel } from './ShareCardPanel';

type Mode = 'share' | 'import' | 'contact';

export const CardExchangeTab: React.FC = () => {
  const contacts = useContacts();
  const { activePersonaId } = useActivePersona();
  const [mode, setMode] = useState<Mode>('share');
  const [selectedContactId, setSelectedContactId] = useState<ContactId | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = setTimeout(() => setCopyStatus('idle'), 1200);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const copyText = async (text: string) => {
    try {
      if (detectPlatform().platform === RuntimePlatform.Browser || detectPlatform().platform === RuntimePlatform.Tauri) {
        await navigator.clipboard.writeText(text);
      } else {
        console.log(text);
      }
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', minHeight: '680px' }}>
      <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'auto', background: '#0b1220' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #334155' }}>
          <PersonaSwitcher label="My Card" />
        </div>
        <div style={{ padding: '10px' }}>
          <ContactList
            contacts={contacts}
            searchable
            {...(selectedContactId ? { selectedId: selectedContactId } : {})}
            onSelect={(id) => {
              setSelectedContactId(id);
              setMode('contact');
            }}
          />
        </div>
        <div style={{ padding: '10px', borderTop: '1px solid #334155' }}>
          <button
            type="button"
            onClick={() => setMode('import')}
            style={{ border: '1px solid #334155', borderRadius: '6px', background: '#1e293b', color: '#e2e8f0', padding: '6px 10px' }}
          >
            + Import Card
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: '8px', background: '#0b1220', color: '#e2e8f0', padding: '12px' }}>
        {mode === 'import' && (
          <ImportCardPanel
            onImported={(id) => {
              setSelectedContactId(id);
              setMode('contact');
            }}
          />
        )}
        {mode === 'contact' && selectedContactId && (
          <ContactForwardPanel contactId={unsafeAsContactId(selectedContactId)} onCopy={copyText} copyStatus={copyStatus} />
        )}
        {(mode === 'share' || (mode === 'contact' && !selectedContactId)) && (
          <ShareCardPanel personaId={activePersonaId} onCopy={copyText} copyStatus={copyStatus} />
        )}
      </div>
    </div>
  );
};
