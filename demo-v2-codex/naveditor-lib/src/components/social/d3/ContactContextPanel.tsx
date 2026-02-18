import { ContactCard } from '@devalbo/ui';
import { useActivities, useContact, useMemberships } from '@devalbo/state';
import type { ContactId, PersonaId } from '@devalbo/shared';
import { ActivityLog } from '../d2/ActivityLog';
import { QuickActionsPanel } from '../d2/QuickActionsPanel';

interface ContactContextPanelProps {
  contactId: ContactId;
  actorPersonaId: PersonaId | null;
}

export const ContactContextPanel: React.FC<ContactContextPanelProps> = ({ contactId, actorPersonaId }) => {
  const contact = useContact(contactId);
  const memberships = useMemberships({ contactId });
  const activities = useActivities({ subjectType: 'contact', subjectId: contactId });

  if (!contact) return <div style={{ color: '#94a3b8' }}>Contact not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <ContactCard id={contactId} contact={contact} memberships={memberships} />
      <QuickActionsPanel subjectType="contact" subjectId={contactId} subjectName={contact.name} actorPersonaId={actorPersonaId} />
      <ActivityLog activities={activities} />
    </div>
  );
};
