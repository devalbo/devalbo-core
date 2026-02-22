import { useMemo } from 'react';
import { contactToJsonLd, useContact } from '@devalbo/state';
import { unsafeAsContactId, type ContactId } from '@devalbo/shared';

interface ContactForwardPanelProps {
  contactId: ContactId;
  onCopy?: (text: string) => void | Promise<void>;
  copyStatus?: 'idle' | 'copied' | 'error';
}

export const ContactForwardPanel: React.FC<ContactForwardPanelProps> = ({ contactId, onCopy, copyStatus = 'idle' }) => {
  const resolvedId = unsafeAsContactId(contactId);
  const contact = useContact(resolvedId);

  const json = useMemo(() => {
    if (!contact) return '';
    return JSON.stringify(contactToJsonLd(contact, resolvedId), null, 2);
  }, [contact, resolvedId]);

  if (!contact) {
    return <div style={{ color: '#94a3b8' }}>Contact not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ margin: 0 }}>Share {contact.name}'s info</h3>
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
      <div>
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
    </div>
  );
};
