import type { Row, Store } from 'tinybase';
import { ContactRowSchema, type ContactRow, type ContactRowInput } from '@devalbo/shared';
import { CONTACTS_TABLE, MEMBERSHIPS_TABLE, PERSONAS_TABLE } from '../schemas/social';
import { safeParseWithWarning } from './_validation';

export const getContact = (store: Store, id: string): ContactRow | null => {
  if (!store.hasRow(CONTACTS_TABLE, id)) return null;
  const row = store.getRow(CONTACTS_TABLE, id);
  return safeParseWithWarning<ContactRow>(ContactRowSchema, row, CONTACTS_TABLE, id, 'get');
};

export const setContact = (store: Store, id: string, contact: ContactRowInput): void => {
  const parsed = ContactRowSchema.parse(contact);
  store.setRow(CONTACTS_TABLE, id, parsed as Row);
};

export const listContacts = (store: Store): Array<{ id: string; row: ContactRow }> => {
  const table = store.getTable(CONTACTS_TABLE);
  if (!table) return [];

  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = safeParseWithWarning<ContactRow>(ContactRowSchema, row, CONTACTS_TABLE, id, 'list');
    return parsed ? [{ id, row: parsed }] : [];
  });
};

export const deleteContact = (store: Store, id: string): void => {
  const membershipsTable = store.getTable(MEMBERSHIPS_TABLE);
  if (membershipsTable) {
    for (const [rowId, row] of Object.entries(membershipsTable)) {
      if (row.contactId === id) {
        store.delRow(MEMBERSHIPS_TABLE, rowId);
      }
    }
  }
  store.delRow(CONTACTS_TABLE, id);
};

export const searchContacts = (store: Store, query: string): Array<{ id: string; row: ContactRow }> => {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return listContacts(store);

  return listContacts(store).filter(({ row }) => {
    const fields = [
      row.name,
      row.nickname,
      row.email,
      row.phone,
      row.organization,
      row.notes,
      row.role
    ];

    return fields.some((value) => value?.toLowerCase().includes(trimmed));
  });
};

export const linkContactToPersona = (store: Store, contactId: string, personaId: string): void => {
  const contact = getContact(store, contactId);
  if (!contact) throw new Error(`Contact not found: ${contactId}`);

  const personaExists = store.hasRow(PERSONAS_TABLE, personaId);
  if (!personaExists) throw new Error(`Persona not found: ${personaId}`);

  store.setCell(CONTACTS_TABLE, contactId, 'linkedPersona', personaId);
};
