import { useState } from 'react';
import { personaToJsonLd, useContact, usePersona } from '@devalbo/state';
import { deliverCard, fetchWebIdProfile, type SolidSession } from '@devalbo/solid-client';
import { unsafeAsContactId, unsafeAsPersonaId, type ContactId, type PersonaId } from '@devalbo/shared';

interface SendCardPanelProps {
  personaId: PersonaId;
  contactId: ContactId;
  session: SolidSession;
}

type SendStatus = 'idle' | 'loading' | 'success' | 'error';

const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const SendCardPanel: React.FC<SendCardPanelProps> = ({ personaId, contactId, session }) => {
  const persona = usePersona(unsafeAsPersonaId(personaId));
  const contact = useContact(unsafeAsContactId(contactId));
  const [status, setStatus] = useState<SendStatus>('idle');
  const [message, setMessage] = useState('');

  if (!contact?.webId || !persona) return null;

  const profileDoc = persona.profileDoc.trim();
  const actorWebId = isValidUrl(profileDoc) ? profileDoc : (isValidUrl(personaId) ? personaId : '');
  const canSend = !!actorWebId;

  const send = async () => {
    if (!canSend) return;
    setStatus('loading');
    setMessage('');

    const profileResult = await fetchWebIdProfile(contact.webId);
    if (!profileResult.ok) {
      setStatus('error');
      setMessage(`Could not fetch contact profile: ${profileResult.error}`);
      return;
    }
    if (!profileResult.row.inbox) {
      setStatus('error');
      setMessage("Contact's profile does not list an inbox.");
      return;
    }

    const cardJsonLd = personaToJsonLd(persona, personaId);
    const result = await deliverCard(
      profileResult.row.inbox,
      actorWebId,
      contact.webId,
      cardJsonLd,
      session.fetch
    );

    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    setStatus('success');
    setMessage(`Card sent to ${contact.name || contact.webId}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
      <h4 style={{ margin: 0 }}>Send My Card</h4>
      {!canSend && (
        <div style={{ color: '#fbbf24', fontSize: '12px' }}>
          Your persona needs a WebID. Run `solid-fetch-profile &lt;your-webId&gt;` or `solid-pod-pull` first.
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={() => { void send(); }}
          disabled={status === 'loading' || !canSend}
          style={{
            border: '1px solid #334155',
            borderRadius: '6px',
            background: '#1e293b',
            color: '#e2e8f0',
            padding: '6px 10px',
            opacity: status === 'loading' || !canSend ? 0.6 : 1,
            cursor: status === 'loading' || !canSend ? 'not-allowed' : 'pointer'
          }}
        >
          {status === 'loading' ? 'Sending...' : 'Send my card'}
        </button>
      </div>
      {message && (
        <div style={{ color: status === 'success' ? '#22c55e' : '#f87171' }}>
          {message}
        </div>
      )}
    </div>
  );
};
