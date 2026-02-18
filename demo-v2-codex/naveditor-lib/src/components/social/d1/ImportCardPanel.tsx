import { useState } from 'react';
import { jsonLdToContactRow, setContact, useStore } from '@devalbo/state';
import { ContactIdToolbox, unsafeAsContactId, type ContactId } from '@devalbo/shared';

interface ImportCardPanelProps {
  onImported?: (contactId: ContactId) => void;
}

const normalizeContactJson = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.contacts) && record.contacts[0] && typeof record.contacts[0] === 'object') {
      return record.contacts[0] as Record<string, unknown>;
    }
    return record;
  }
  throw new Error('Expected a JSON object');
};

export const ImportCardPanel: React.FC<ImportCardPanelProps> = ({ onImported }) => {
  const store = useStore();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const submit = () => {
    setStatus('');
    setError('');

    const trimmed = text.trim();
    if (!trimmed) {
      setError('Paste some JSON-LD or a WebID URL first.');
      return;
    }

    if (/^https?:\/\//.test(trimmed)) {
      setError('WebID URL import is not supported yet. Paste JSON-LD text.');
      return;
    }

    try {
      const raw = JSON.parse(trimmed) as unknown;
      const json = normalizeContactJson(raw);
      const parsed = jsonLdToContactRow(json);
      const contactId = parsed.id || unsafeAsContactId(ContactIdToolbox.createRandomId?.() ?? crypto.randomUUID());
      setContact(store, contactId, {
        ...parsed.row,
        uid: parsed.row.uid || `urn:uuid:${crypto.randomUUID()}`
      });
      setStatus(`Added contact: ${parsed.row.name}`);
      onImported?.(contactId);
    } catch (err) {
      setError(`Error: ${(err as Error).message || 'Failed to parse/import card'}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ margin: 0 }}>Import Card</h3>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste JSON-LD"
        rows={10}
        style={{
          border: '1px solid #334155',
          borderRadius: '8px',
          background: '#020617',
          color: '#e2e8f0',
          padding: '10px',
          resize: 'vertical'
        }}
      />
      <div>
        <button
          type="button"
          onClick={submit}
          style={{ border: '1px solid #334155', borderRadius: '6px', background: '#1e293b', color: '#e2e8f0', padding: '6px 10px' }}
        >
          Parse + Add
        </button>
      </div>
      {status && <div style={{ color: '#22c55e' }}>{status}</div>}
      {error && <div style={{ color: '#f87171' }}>{error}</div>}
    </div>
  );
};
